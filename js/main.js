// DOM制御とゲーム進行
import { judge, lastChar } from "./game.js";
import { randomStarter, isRealWord, loadDictionary } from "./dictionary.js";
import { loadHistory, saveGame, clearHistory } from "./history.js";

const el = {
  currentWord: document.getElementById("currentWord"),
  nextChar: document.getElementById("nextChar"),
  input: document.getElementById("wordInput"),
  form: document.getElementById("wordForm"),
  message: document.getElementById("message"),
  resetBtn: document.getElementById("resetBtn"),
  chain: document.getElementById("chain"),
  historyList: document.getElementById("historyList"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  dictToggle: document.getElementById("dictToggle"),
};

let state;

function newState() {
  const starter = randomStarter();
  return {
    words: [starter],
    used: new Set([starter]),
    over: false,
  };
}

function render() {
  const prev = state.words[state.words.length - 1];
  el.currentWord.textContent = prev;
  el.nextChar.textContent = lastChar(prev);
  el.input.disabled = state.over;
  renderChain();
}

function renderChain() {
  el.chain.innerHTML = "";
  state.words.forEach((w) => {
    const li = document.createElement("li");
    li.className = "chain__item";
    li.textContent = w;
    el.chain.appendChild(li);
  });
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

function setMessage(text, type = "") {
  el.message.textContent = text;
  el.message.className = `message${type ? " message--" + type : ""}`;
}

function start() {
  state = newState();
  setMessage("");
  el.input.value = "";
  render();
  el.input.focus();
}

el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (state.over) return;

  const word = el.input.value.trim();
  const prev = state.words[state.words.length - 1];
  const opts = el.dictToggle.checked ? { isRealWord } : {};
  const result = judge(word, prev, state.used, opts);

  if (!result.ok) {
    if (result.end === "lose") {
      state.words.push(word);
      state.used.add(word);
      endGame("lose");
    }
    setMessage(result.reason, result.end ? "lose" : "error");
    return;
  }

  state.words.push(word);
  state.used.add(word);
  el.input.value = "";

  if (result.end) {
    endGame(result.end);
    setMessage(result.reason, result.end);
  } else {
    setMessage("OK！次どうぞ", "ok");
  }
  render();
  el.input.focus();
});

function endGame(result) {
  state.over = true;
  saveGame(state.words, result);
  render();
  renderHistory();
}

el.resetBtn.addEventListener("click", start);
el.clearHistoryBtn.addEventListener("click", () => {
  clearHistory();
  renderHistory();
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
start();
