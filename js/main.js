// DOM制御とゲーム進行
import { judge, lastChar } from "./game.js";
import { randomStarter } from "./dictionary.js";

const el = {
  currentWord: document.getElementById("currentWord"),
  nextChar: document.getElementById("nextChar"),
  input: document.getElementById("wordInput"),
  form: document.getElementById("wordForm"),
  message: document.getElementById("message"),
  resetBtn: document.getElementById("resetBtn"),
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
  const result = judge(word, prev, state.used);

  if (!result.ok) {
    if (result.end === "lose") {
      state.words.push(word);
      state.used.add(word);
      state.over = true;
      render();
    }
    setMessage(result.reason, result.end ? "lose" : "error");
    return;
  }

  state.words.push(word);
  state.used.add(word);
  el.input.value = "";

  if (result.end) {
    state.over = true;
    setMessage(result.reason, result.end);
  } else {
    setMessage("OK！次どうぞ", "ok");
  }
  render();
  el.input.focus();
});

el.resetBtn.addEventListener("click", start);

start();
