// DOM制御とゲーム進行。ソロ／オンライン対戦の2モードを切り替える。
import { judge, lastChar } from "./game.js";
import { randomStarter, isRealWord, loadDictionary } from "./dictionary.js";
import { loadHistory, saveGame, clearHistory } from "./history.js";
import { isConfigured } from "./firebase-config.js";
import * as online from "./online.js";

const el = {
  board: document.getElementById("board"),
  currentWord: document.getElementById("currentWord"),
  nextChar: document.getElementById("nextChar"),
  input: document.getElementById("wordInput"),
  form: document.getElementById("wordForm"),
  message: document.getElementById("message"),
  resetBtn: document.getElementById("resetBtn"),
  rematchBtn: document.getElementById("rematchBtn"),
  chain: document.getElementById("chain"),
  historyList: document.getElementById("historyList"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  dictToggle: document.getElementById("dictToggle"),
  minLengthSelect: document.getElementById("minLengthSelect"),
  ruleHint: document.getElementById("ruleHint"),
  // モード・オンライン
  modeSolo: document.getElementById("modeSolo"),
  modeOnline: document.getElementById("modeOnline"),
  rules: document.getElementById("rules"),
  lobby: document.getElementById("lobby"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  joinForm: document.getElementById("joinForm"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  lobbyMsg: document.getElementById("lobbyMsg"),
  roomBanner: document.getElementById("roomBanner"),
  roomCode: document.getElementById("roomCode"),
  roomStatus: document.getElementById("roomStatus"),
  leaveBtn: document.getElementById("leaveBtn"),
};

let mode = "solo";        // "solo" | "online"
let state;                // ソロ用の状態
let session = null;       // { code, playerId, seat }
let unsub = null;         // ルーム購読解除関数
let lastRoom = null;      // 直近のルームスナップショット（差分検知用）

// ───────── 共通描画 ─────────
function renderBoard(words, minLength) {
  const prev = words[words.length - 1];
  el.currentWord.textContent = prev ?? "―";
  el.nextChar.textContent = prev ? lastChar(prev) : "―";
  renderRuleHint(minLength);
  renderChain(words);
}

function renderRuleHint(minLength) {
  if (minLength > 2) {
    el.ruleHint.textContent = `しばり: ${minLength}文字以上`;
    el.ruleHint.hidden = false;
  } else {
    el.ruleHint.hidden = true;
  }
}

function renderChain(words) {
  el.chain.innerHTML = "";
  words.forEach((w) => {
    const li = document.createElement("li");
    li.className = "chain__item";
    li.textContent = w;
    el.chain.appendChild(li);
  });
}

function setMessage(text, type = "") {
  el.message.textContent = text;
  el.message.className = `message${type ? " message--" + type : ""}`;
}

/** クラスを付け直してCSSアニメを再生する（reflowで再トリガ） */
function flash(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

function renderHistory() {
  const list = loadHistory();
  el.historyList.innerHTML = "";
  if (list.length === 0) {
    el.historyList.innerHTML = '<li class="history__empty">まだ記録はありません</li>';
    return;
  }
  list.forEach((g) => {
    const li = document.createElement("li");
    li.className = "history__item";
    li.innerHTML =
      `<span class="history__meta">${g.date}・${g.length}語</span>` +
      `<span class="history__words">${g.words.join(" → ")}</span>`;
    el.historyList.appendChild(li);
  });
}

// ───────── ソロモード ─────────
function newState() {
  const starter = randomStarter();
  return { words: [starter], used: new Set([starter]), over: false };
}

function soloMinLength() {
  const m = Number(el.minLengthSelect.value);
  return m;
}

function renderSolo() {
  renderBoard(state.words, soloMinLength());
  el.input.disabled = state.over;
}

function soloStart() {
  state = newState();
  setMessage("");
  el.input.value = "";
  renderSolo();
  el.input.focus();
}

function soloSubmit(word) {
  if (state.over) return;
  const prev = state.words[state.words.length - 1];
  const opts = {};
  if (el.dictToggle.checked) opts.isRealWord = isRealWord;
  const min = soloMinLength();
  if (min > 2) opts.minLength = min;

  const result = judge(word, prev, state.used, opts);

  if (!result.ok) {
    if (result.end === "lose") {
      state.words.push(word);
      state.used.add(word);
      soloEnd("lose");
      flash(el.board, "is-lose");
    } else {
      flash(el.input, "is-shake");
    }
    setMessage(result.reason, result.end ? "lose" : "error");
    return;
  }

  state.words.push(word);
  state.used.add(word);
  el.input.value = "";

  if (result.end) {
    soloEnd(result.end);
    setMessage(result.reason, result.end);
    flash(el.board, "is-lose");
  } else {
    setMessage("よし、次へ", "ok");
    renderSolo();
    flash(el.board, "is-ok");
  }
  el.input.focus();
}

function soloEnd(result) {
  state.over = true;
  saveGame(state.words, result);
  renderSolo();
  renderHistory();
}

// ───────── オンラインモード ─────────
function seatOf(room, seat) {
  const players = room.players || {};
  return Object.values(players).find((p) => p.seat === seat) || null;
}

function startSubscription(sess) {
  session = sess;
  if (unsub) unsub();
  lastRoom = null;
  unsub = online.subscribeRoom(session.code, renderOnline);
  el.roomCode.textContent = session.code;
  el.lobby.hidden = true;
  el.roomBanner.hidden = false;
  el.rematchBtn.hidden = true;
}

function renderOnline(room) {
  if (mode !== "online" || !session) return;

  if (!room) {
    setMessage("ルームが見つかりません（解散された可能性があります）", "error");
    el.input.disabled = true;
    lastRoom = null;
    return;
  }

  const words = room.words && room.words.length ? room.words : [room.starter];
  const minLength = room.rule ? room.rule.minLength : 2;
  renderBoard(words, minLength);

  const myTurn = room.status === "playing" && room.turn === session.seat;
  el.input.disabled = !myTurn;

  // 自分の手番への遷移を検知（=相手が打った）→盤面ポップ
  if (lastRoom && lastRoom.words && room.words &&
      room.words.length > lastRoom.words.length && room.status === "playing") {
    flash(el.board, "is-ok");
  }

  const opponent = seatOf(room, 1 - session.seat);
  const seatLabel = session.seat === 0 ? "先攻" : "後攻";

  if (room.status === "waiting") {
    el.roomStatus.textContent = "相手を待っています…";
    setMessage(`コード「${session.code}」を相手に共有してね（あなたは${seatLabel}）`, "");
    el.rematchBtn.hidden = true;
  } else if (room.status === "playing") {
    const disconnected = opponent && opponent.online === false;
    el.roomStatus.textContent = disconnected
      ? "相手が切断中…"
      : myTurn ? "▶ あなたの番" : "相手の番です";
    if (myTurn) {
      setMessage("あなたの番。単語をどうぞ", "");
      el.input.focus();
    } else {
      setMessage("相手の入力を待っています…", "");
    }
    el.rematchBtn.hidden = true;
  } else if (room.status === "over") {
    const iLost = room.loser === session.seat;
    el.roomStatus.textContent = iLost ? "敗北" : "勝利";
    setMessage(iLost ? "あなたの負け…" : "あなたの勝ち！", iLost ? "lose" : "win");
    if (iLost) flash(el.board, "is-lose");
    el.input.disabled = true;
    el.rematchBtn.hidden = false;
  }

  lastRoom = room;
}

async function onlineSubmit(word) {
  if (!session || el.input.disabled) return;
  el.input.disabled = true;
  try {
    const res = await online.submitWord(session, word);
    if (!res.ok && !res.end) {
      setMessage(res.reason, "error");
      flash(el.input, "is-shake");
      el.input.disabled = false;
      el.input.focus();
      return;
    }
    el.input.value = "";
    // 成功時は購読(renderOnline)が状態を反映する
    if (res.ok && !res.end) flash(el.board, "is-ok");
  } catch (e) {
    console.error(e);
    setMessage("送信に失敗しました。通信状態を確認してね", "error");
    el.input.disabled = false;
  }
}

function lobbyError(msg) {
  el.lobbyMsg.textContent = msg;
  el.lobbyMsg.className = "lobby__msg lobby__msg--error";
}

async function onCreateRoom() {
  if (!ensureConfigured()) return;
  el.createRoomBtn.disabled = true;
  el.lobbyMsg.textContent = "";
  try {
    const rule = {
      dictCheck: el.dictToggle.checked,
      minLength: soloMinLength(),
    };
    const sess = await online.createRoom({ name: "ホスト", rule });
    startSubscription(sess);
  } catch (e) {
    lobbyError(e.message || "ルーム作成に失敗しました");
  } finally {
    el.createRoomBtn.disabled = false;
  }
}

async function onJoinRoom(e) {
  e.preventDefault();
  if (!ensureConfigured()) return;
  const code = el.roomCodeInput.value.trim();
  if (!code) { lobbyError("ルームコードを入力してね"); return; }
  el.lobbyMsg.textContent = "";
  try {
    const sess = await online.joinRoom({ code, name: "ゲスト" });
    startSubscription(sess);
  } catch (e2) {
    lobbyError(e2.message || "参加に失敗しました");
  }
}

async function onLeaveRoom() {
  if (unsub) { unsub(); unsub = null; }
  if (session) await online.leaveRoom(session);
  session = null;
  lastRoom = null;
  el.roomBanner.hidden = true;
  el.lobby.hidden = false;
  el.rematchBtn.hidden = true;
  el.lobbyMsg.textContent = "";
  el.input.value = "";
  el.input.disabled = true;
  setMessage("");
  el.currentWord.textContent = "―";
  el.nextChar.textContent = "―";
  el.chain.innerHTML = "";
  el.ruleHint.hidden = true;
}

async function onRematch() {
  if (!session) return;
  try {
    await online.rematch(session.code);
  } catch (e) {
    setMessage("再戦の開始に失敗しました", "error");
  }
}

function ensureConfigured() {
  if (isConfigured()) return true;
  lobbyError("Firebase未設定です（firebase-config.js の databaseURL 等）");
  el.createRoomBtn.disabled = true;
  el.joinForm.querySelector("button").disabled = true;
  el.roomCodeInput.disabled = true;
  return false;
}

// ───────── モード切替 ─────────
function setMode(next) {
  if (mode === next) return;
  if (mode === "online") onLeaveRoom();
  mode = next;

  const isOnline = next === "online";
  el.modeSolo.classList.toggle("is-active", !isOnline);
  el.modeOnline.classList.toggle("is-active", isOnline);
  el.modeSolo.setAttribute("aria-selected", String(!isOnline));
  el.modeOnline.setAttribute("aria-selected", String(isOnline));

  el.resetBtn.hidden = isOnline;
  el.lobby.hidden = !isOnline || !!session;
  el.roomBanner.hidden = true;
  el.rematchBtn.hidden = true;

  if (isOnline) {
    setMessage("");
    el.input.value = "";
    el.input.disabled = true;
    el.currentWord.textContent = "―";
    el.nextChar.textContent = "―";
    el.chain.innerHTML = "";
    el.ruleHint.hidden = true;
    ensureConfigured();
  } else {
    soloStart();
  }
}

// ───────── イベント ─────────
el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const word = el.input.value.trim();
  if (mode === "solo") soloSubmit(word);
  else onlineSubmit(word);
});

el.minLengthSelect.addEventListener("change", () => {
  if (mode === "solo") renderRuleHint(soloMinLength());
});
el.resetBtn.addEventListener("click", soloStart);
el.clearHistoryBtn.addEventListener("click", () => {
  clearHistory();
  renderHistory();
});

el.modeSolo.addEventListener("click", () => setMode("solo"));
el.modeOnline.addEventListener("click", () => setMode("online"));
el.createRoomBtn.addEventListener("click", onCreateRoom);
el.joinForm.addEventListener("submit", onJoinRoom);
el.leaveBtn.addEventListener("click", onLeaveRoom);
el.rematchBtn.addEventListener("click", onRematch);
window.addEventListener("beforeunload", () => {
  if (session) online.leaveRoom(session);
});

// 辞書(約45,000語)は非同期読み込み。読み込み中はチェックモードを無効化。
el.dictToggle.disabled = true;
const dictLabel = el.dictToggle.closest(".toggle");
if (dictLabel) dictLabel.dataset.state = "loading";
loadDictionary().then((ok) => {
  el.dictToggle.disabled = !ok;
  if (dictLabel) dictLabel.dataset.state = ok ? "ready" : "error";
});

renderHistory();
soloStart();
