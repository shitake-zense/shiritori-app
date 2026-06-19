// DOM制御とゲーム進行。ソロ／オンライン対戦の2モードを切り替える。
import { judge, lastChar, firstChar } from "./game.js";
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
  ruleMode: document.getElementById("ruleMode"),
  turnsWrap: document.getElementById("turnsWrap"),
  turnsInput: document.getElementById("turnsInput"),
  lengthSelect: document.getElementById("lengthSelect"),
  sealLabel: document.getElementById("sealLabel"),
  score: document.getElementById("score"),
  mastheadTitle: document.getElementById("mastheadTitle"),
  mastheadSub: document.getElementById("mastheadSub"),
  timeToggle: document.getElementById("timeToggle"),
  limitWrap: document.getElementById("limitWrap"),
  limitInput: document.getElementById("limitInput"),
  ruleHint: document.getElementById("ruleHint"),
  streak: document.getElementById("streak"),
  timer: document.getElementById("timer"),
  timerBar: document.getElementById("timerBar"),
  timerNum: document.getElementById("timerNum"),
  // モード・オンライン
  modeTabs: document.getElementById("modeTabs"),
  modeSolo: document.getElementById("modeSolo"),
  modeOnline: document.getElementById("modeOnline"),
  rules: document.getElementById("rules"),
  actions: document.getElementById("actions"),
  startActions: document.getElementById("startActions"),
  startBtn: document.getElementById("startBtn"),
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
let soloPhase = "setup";  // "setup"（ルール設定中）| "play"（対戦中・ルール固定）
let state;                // ソロ用の状態
let session = null;       // { code, playerId, seat }
let unsub = null;         // ルーム購読解除関数
let lastRoom = null;      // 直近のルームスナップショット（差分検知用）

let timerId = null;       // カウントダウンの interval

// ───────── ルール設定（UI読み取り） ─────────
/** 解答時間（秒）。入力値を3〜100に丸める（既定10） */
function ruleLimitSec() {
  let v = parseInt(el.limitInput.value, 10);
  if (isNaN(v)) v = 10;
  return Math.max(3, Math.min(100, v));
}

function timeEnabled() {
  return el.timeToggle.checked;
}

/** しりとりすぎの最大ターン数。入力値を2〜99に丸める（既定12） */
function ruleMaxTurns() {
  let v = parseInt(el.turnsInput.value, 10);
  if (isNaN(v)) v = 12;
  return Math.max(2, Math.min(99, v));
}

/** 文字数しばりの選択値を {minLength?} / {exactLength?} に変換 */
function soloLength() {
  const v = el.lengthSelect.value;
  if (v === "exact3") return { exactLength: 3 };
  if (v.startsWith("min")) return { minLength: Number(v.slice(3)) };
  return {};
}

/** 文字数しばりの表示文字列 */
function lengthHint(rule) {
  if (rule && rule.exactLength) return `ちょうど${rule.exactLength}文字`;
  if (rule && rule.minLength > 2) return `${rule.minLength}文字以上`;
  return "";
}

/** 遊び方ラベル（normal は表示なし） */
function modeLabel(rule) {
  if (rule && rule.mode === "atama") return "あたまとり";
  if (rule && rule.mode === "sugi") return "しりとりすぎ";
  return "";
}

/** 画面最上部の見出し・サブテキストを遊び方ごとに切り替える */
const MASTHEAD = {
  normal: { title: "しりとり", sub: "前の言葉の終わりから、次の言葉へ。" },
  atama:  { title: "あたまとり", sub: "前の言葉の頭の文字で、終わる言葉へ。" },
  sugi:   { title: "しりとりすぎ", sub: "重ねた文字数だけ、得点になる。" },
};
function applyMastheadMode(mode) {
  const m = MASTHEAD[mode] || MASTHEAD.normal;
  el.mastheadTitle.textContent = m.title;
  el.mastheadSub.textContent = m.sub;
}

/** 盤面バッジ用の文字列（遊び方＋文字数しばりを結合） */
function boardHint(rule) {
  const p = [];
  const m = modeLabel(rule);
  if (m) p.push(m);
  const l = lengthHint(rule);
  if (l) p.push(l);
  return p.join("・");
}

/** 現在のルール設定のスナップショット（履歴保存・ルーム作成で共用） */
function ruleSnapshot() {
  const l = soloLength();
  const m = el.ruleMode.value;
  const mode = (m === "atama" || m === "sugi") ? m : "normal";
  return {
    mode,
    dictCheck: el.dictToggle.checked,
    minLength: l.minLength || 0,
    exactLength: l.exactLength || 0,
    limitSec: timeEnabled() ? ruleLimitSec() : 0,
    maxTurns: mode === "sugi" ? ruleMaxTurns() : 0,
  };
}

/** ルールを短い文字列に要約（履歴表示用） */
function ruleSummary(rule) {
  if (!rule) return "通常ルール";
  const p = [];
  const m = modeLabel(rule);
  if (m) p.push(m);
  if (rule.mode === "sugi" && rule.maxTurns) p.push(`${rule.maxTurns}手`);
  if (rule.dictCheck) p.push("辞書チェック");
  if (rule.exactLength) p.push(`${rule.exactLength}文字ちょうど`);
  else if (rule.minLength > 2) p.push(`${rule.minLength}字以上`);
  if (rule.limitSec) p.push(`制限${rule.limitSec}秒`);
  return p.length ? p.join("・") : "通常ルール";
}

function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
  el.timer.hidden = true;
  el.timer.classList.remove("is-low");
}

function paintTimer(remainMs, limitMs) {
  const remain = Math.max(0, remainMs);
  el.timer.hidden = false;
  el.timerNum.textContent = String(Math.ceil(remain / 1000));
  el.timerBar.style.width = `${Math.max(0, Math.min(100, (remain / limitMs) * 100))}%`;
  el.timer.classList.toggle("is-low", remain <= 3000);
}

/** 共通カウントダウン。deadlineを過ぎたら onExpire を呼ぶ。nowFnでサーバ/ローカル時刻を切替 */
function runTimer(deadline, limitMs, nowFn, onExpire) {
  stopTimer();
  const tick = () => {
    const remain = deadline - nowFn();
    paintTimer(remain, limitMs);
    if (remain <= 0) {
      if (timerId) { clearInterval(timerId); timerId = null; }
      onExpire();
    }
  };
  tick();
  timerId = setInterval(tick, 100);
}

// ───────── 共通描画 ─────────
function renderBoard(words, hint, mode = "normal", ended = false) {
  const prev = words[words.length - 1];
  const atama = mode === "atama";
  const sugi = mode === "sugi";
  applyMastheadMode(mode);
  el.currentWord.textContent = prev ?? "―";
  // あたまとり: 次語は前語の「先頭文字」で終わる / しりとりすぎ: 末尾を重ねる / 通常: 末尾文字で始まる
  el.sealLabel.textContent = atama ? "末尾" : sugi ? "重ね" : "次";
  el.nextChar.textContent = prev ? (atama ? firstChar(prev) : lastChar(prev)) : "―";
  renderRuleHint(hint);
  // しりとりすぎは連続数の代わりにスコア表示を使う（caller が描画）
  if (sugi) el.streak.hidden = true;
  else renderStreak(words, ended);
  renderChain(words);
}

/** しりとりすぎのスコア行を描画（text=null で非表示） */
function renderScore(text) {
  if (text == null) { el.score.hidden = true; return; }
  el.score.textContent = text;
  el.score.hidden = false;
}

function renderRuleHint(hint) {
  if (hint) {
    el.ruleHint.textContent = `しばり: ${hint}`;
    el.ruleHint.hidden = false;
  } else {
    el.ruleHint.hidden = true;
  }
}

/** 連続成功回数（初期単語を除いてつないだ数）を表示。ended時はリザルト文言にする */
function renderStreak(words, ended = false) {
  const n = Math.max(0, words.length - 1);
  if (n > 0) {
    el.streak.textContent = ended
      ? `今回の記録：連続 ${n} 回つながった！`
      : `連続 ${n} 回つながり中`;
    el.streak.hidden = false;
  } else {
    el.streak.hidden = true;
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
    // オンライン対戦のみ自分視点の勝敗バッジを出す（ソロは相手不在のため出さない）
    let badge = "";
    if (g.mode === "online") {
      const r = g.result;
      const label = r === "win" ? "勝" : r === "draw" ? "分" : "敗";
      const cls = r === "win" ? "win" : r === "draw" ? "draw" : "lose";
      badge = `<span class="history__result history__result--${cls}">${label}</span>`;
    }
    // しりとりすぎは得点を併記
    const scoreText = (g.rule && g.rule.mode === "sugi" && typeof g.score === "number")
      ? `・${g.score}点` : "";
    li.innerHTML =
      `<span class="history__meta">${badge}${g.date}・${g.length}語${scoreText}</span>` +
      `<span class="history__rule">${ruleSummary(g.rule)}</span>` +
      `<span class="history__words">${g.words.join(" → ")}</span>`;
    el.historyList.appendChild(li);
  });
}

// ───────── ソロモード ─────────
function newState() {
  const starter = randomStarter();
  return { words: [starter], used: new Set([starter]), over: false, score: 0, turns: 0 };
}

function renderSolo() {
  renderBoard(state.words, boardHint(state.rule), state.rule.mode, state.over);
  el.input.disabled = state.over;
  if (state.rule.mode === "sugi") {
    const cap = state.rule.maxTurns ? `／${state.rule.maxTurns}` : "";
    renderScore(`スコア ${state.score} 点 ・ ターン ${state.turns}${cap}`);
  } else {
    renderScore(null);
  }
}

/** ルール設定画面（プレイ前）へ。ルールが編集可能になる。 */
function soloToSetup() {
  soloPhase = "setup";
  stopTimer();
  state = undefined;
  setMessage("");
  el.input.value = "";
  el.currentWord.textContent = "―";
  el.nextChar.textContent = "―";
  el.sealLabel.textContent = "次";
  el.chain.innerHTML = "";
  el.ruleHint.hidden = true;
  el.streak.hidden = true;
  renderScore(null);
  applyMastheadMode(el.ruleMode.value); // 設定画面では選択中の遊び方を見出しに反映
  applyView();
  flash(el.rules, "view-in");
}

/** 開始ボタン: ルールを確定してしりとり開始（以降ルール変更不可）。 */
function soloBegin() {
  soloPhase = "play";
  state = newState();
  state.rule = ruleSnapshot();
  setMessage("");
  el.input.value = "";
  applyView();
  renderSolo();
  if (timeEnabled()) startSoloTimer();
  flash(el.board, "view-in");
  el.input.focus();
}

function startSoloTimer() {
  if (!timeEnabled()) { stopTimer(); return; }
  const limitMs = ruleLimitSec() * 1000;
  runTimer(Date.now() + limitMs, limitMs, Date.now, onSoloTimeout);
}

function onSoloTimeout() {
  if (!state || state.over) return;
  soloEnd("lose");
  setMessage("時間切れ！あなたの負け", "lose");
  flash(el.board, "is-lose");
}

function soloSubmit(word) {
  if (!state || state.over) return;
  const prev = state.words[state.words.length - 1];
  const opts = {};
  if (state.rule.mode !== "normal") opts.mode = state.rule.mode;
  if (state.rule.dictCheck) opts.isRealWord = isRealWord;
  if (state.rule.minLength > 2) opts.minLength = state.rule.minLength;
  if (state.rule.exactLength) opts.exactLength = state.rule.exactLength;

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
    if (state.rule.mode === "sugi") {
      state.score += result.points || 0;
      state.turns += 1;
      // 最大ターン到達でクリア（スコアアタック達成）
      if (state.rule.maxTurns && state.turns >= state.rule.maxTurns) {
        soloEnd("clear");
        setMessage(`達成！最大ターン到達 — 最終スコア ${state.score} 点`, "win");
        flash(el.board, "is-ok");
        el.input.focus();
        return;
      }
      setMessage(`+${result.points} 点（計 ${state.score} 点）`, "ok");
    } else {
      setMessage("よし、次へ", "ok");
    }
    renderSolo();
    flash(el.board, "is-ok");
    startSoloTimer(); // 次の手番のタイマーを再起動
  }
  el.input.focus();
}

function soloEnd(result) {
  stopTimer();
  state.over = true;
  const score = state.rule.mode === "sugi" ? state.score : undefined;
  saveGame(state.words, result, state.rule, "solo", score);
  renderSolo();
  renderHistory();
}

// ───────── オンラインモード ─────────
function seatOf(room, seat) {
  const players = room.players || {};
  return Object.values(players).find((p) => p.seat === seat) || null;
}

/** 画面（ソロ設定 / ソロ盤面 / ロビー / 対戦盤面）の表示を一括制御する */
function applyView() {
  const isOnline = mode === "online";
  const onlineGame = isOnline && !!session;        // オンライン入室中＝対戦画面
  const soloSetup = !isOnline && soloPhase === "setup";
  const soloPlay = !isOnline && soloPhase === "play";

  el.modeTabs.hidden = onlineGame;                 // オンライン対戦中のみタブを隠す

  // ルール編集パネル: 設定中のみ表示（ソロ設定 or オンラインのロビー）
  el.rules.hidden = !(soloSetup || (isOnline && !session));
  // ソロ開始ボタン: ソロ設定中のみ
  el.startActions.hidden = !soloSetup;

  // オンラインのロビー / ルームバナー
  el.lobby.hidden = !(isOnline && !session);
  el.roomBanner.hidden = !onlineGame;

  // 盤面（プレイ領域）: ソロ対戦中 or オンライン対戦中
  const showPlay = soloPlay || onlineGame;
  el.board.hidden = !showPlay;
  el.form.hidden = !showPlay;
  el.chain.hidden = !showPlay;
  el.message.hidden = !showPlay;

  // 操作列（リセット/再戦）
  el.resetBtn.hidden = isOnline;                   // 「はじめから」はソロのみ
  el.actions.hidden = !soloPlay;                   // ソロ対戦中のみ表示。オンラインは決着時にrenderOnlineが開放
}

function updateModeTabs() {
  const isOnline = mode === "online";
  el.modeSolo.classList.toggle("is-active", !isOnline);
  el.modeOnline.classList.toggle("is-active", isOnline);
  el.modeSolo.setAttribute("aria-selected", String(!isOnline));
  el.modeOnline.setAttribute("aria-selected", String(isOnline));
}

function startSubscription(sess) {
  session = sess;
  if (unsub) unsub();
  lastRoom = null;
  unsub = online.subscribeRoom(session.code, renderOnline);
  el.roomCode.textContent = session.code;
  applyView();                                 // ロビー → 対戦画面へ遷移
  flash(el.roomBanner, "view-in");
  flash(el.board, "view-in");
}

function renderOnline(room) {
  if (mode !== "online" || !session) return;

  if (!room) {
    setMessage("ルームが見つかりません（解散された可能性があります）", "error");
    stopTimer();
    el.input.disabled = true;
    lastRoom = null;
    return;
  }

  const words = room.words && room.words.length ? room.words : [room.starter];
  const rule = room.rule || {};
  renderBoard(words, boardHint(rule), rule.mode, room.status === "over");

  // しりとりすぎ: 双方の得点とターン数を表示
  let mine = 0, theirs = 0;
  if (rule.mode === "sugi") {
    const sc = room.scores || {};
    mine = sc[session.seat] || 0;
    theirs = sc[1 - session.seat] || 0;
    const cap = rule.maxTurns ? `／${rule.maxTurns}` : "";
    renderScore(`あなた ${mine} 点 ・ 相手 ${theirs} 点 ・ ターン ${room.turnCount || 0}${cap}`);
  } else {
    renderScore(null);
  }

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
    stopTimer();
    el.actions.hidden = true;
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
    // 共有期限でカウントダウン。期限超過でtransaction決着（手番者の負け）。
    if (room.rule && room.rule.limitSec && typeof room.turnStartedAt === "number") {
      const limitMs = room.rule.limitSec * 1000;
      const startedAt = room.turnStartedAt;
      runTimer(startedAt + limitMs, limitMs, online.serverNow,
        () => online.timeoutLose(session.code, startedAt));
    } else {
      stopTimer();
    }
    el.actions.hidden = true;
    el.rematchBtn.hidden = true;
  } else if (room.status === "over") {
    const draw = room.loser == null;                 // 同点引き分け（loser未設定）
    const iLost = room.loser === session.seat;
    const timeout = room.endReason === "timeout";
    const byTurns = room.endReason === "turns";       // 最大ターン到達で点数勝負
    const pts = rule.mode === "sugi" ? `（あなた${mine}／相手${theirs}）` : "";
    // 決着への遷移を1度だけ履歴保存（自分視点の勝敗・ローカル保存）
    if (lastRoom && lastRoom.status !== "over") {
      const result = draw ? "draw" : iLost ? "lose" : "win";
      const sc = rule.mode === "sugi" ? mine : undefined;
      saveGame(room.words || words, result, room.rule, "online", sc);
      renderHistory();
    }
    el.roomStatus.textContent = draw ? "引き分け" : iLost ? "敗北" : "勝利";
    setMessage(
      draw ? `引き分け！${pts}`
        : iLost ? (timeout ? "時間切れ…あなたの負け" : byTurns ? `ポイント負け…${pts}` : "あなたの負け…")
               : (timeout ? "相手が時間切れ！あなたの勝ち" : byTurns ? `ポイント勝ち！${pts}` : "あなたの勝ち！"),
      draw ? "" : iLost ? "lose" : "win"
    );
    if (iLost) flash(el.board, "is-lose");
    stopTimer();
    el.input.disabled = true;
    el.actions.hidden = false;                 // 決着時のみ操作列を表示
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
    const sess = await online.createRoom({ name: "ホスト", rule: ruleSnapshot() });
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
  stopTimer();
  el.rematchBtn.hidden = true;
  el.lobbyMsg.textContent = "";
  el.roomCodeInput.value = "";
  el.input.value = "";
  el.input.disabled = true;
  setMessage("");
  el.currentWord.textContent = "―";
  el.nextChar.textContent = "―";
  el.sealLabel.textContent = "次";
  el.chain.innerHTML = "";
  el.ruleHint.hidden = true;
  el.streak.hidden = true;
  renderScore(null);
  applyMastheadMode(el.ruleMode.value);
  applyView();                                 // 対戦画面 → ロビーへ遷移
  flash(el.lobby, "view-in");
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
  if (mode === "online" && session) {
    if (unsub) { unsub(); unsub = null; }
    online.leaveRoom(session);
    session = null;
    lastRoom = null;
  }
  mode = next;
  updateModeTabs();
  el.rematchBtn.hidden = true;
  stopTimer();

  if (next === "online") {
    setMessage("");
    el.input.value = "";
    el.input.disabled = true;
    el.lobbyMsg.textContent = "";
    el.roomCodeInput.value = "";
    el.streak.hidden = true;
    renderScore(null);
    applyMastheadMode(el.ruleMode.value);
    applyView();
    flash(el.lobby, "view-in");
    ensureConfigured();
  } else {
    soloToSetup();
  }
}

// ───────── イベント ─────────
el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const word = el.input.value.trim();
  if (mode === "solo") soloSubmit(word);
  else onlineSubmit(word);
});

el.timeToggle.addEventListener("change", () => {
  el.limitWrap.hidden = !el.timeToggle.checked; // ON時のみ解答時間UIを表示
});
el.limitInput.addEventListener("change", () => {
  el.limitInput.value = String(ruleLimitSec()); // 3〜100に丸めて表示も補正
});
el.ruleMode.addEventListener("change", () => {
  el.turnsWrap.hidden = el.ruleMode.value !== "sugi"; // しりとりすぎ時のみ最大ターン入力
  applyMastheadMode(el.ruleMode.value);               // 見出しも遊び方に追従
});
el.turnsInput.addEventListener("change", () => {
  el.turnsInput.value = String(ruleMaxTurns()); // 2〜99に丸めて表示も補正
});
el.startBtn.addEventListener("click", soloBegin);
el.resetBtn.addEventListener("click", soloToSetup);
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
soloToSetup();
