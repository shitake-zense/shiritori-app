// 過去ゲーム結果の永続化（localStorage）
const KEY = "shiritori_history";
const MAX = 20; // 保存上限

/** @returns {Array<{date:string, words:string[], length:number, result:string, rule?:object, mode?:string, score?:number}>} */
export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

/**
 * 1ゲームを履歴の先頭に追加（新しい順・上限MAX件）。rule はその対戦のルール設定。
 * @param {string} mode "solo" | "online"（オンラインは自分視点の勝敗を result に持つ）
 * @param {number} [score] しりとりすぎの自分の得点（無関係なルールでは undefined）
 */
export function saveGame(words, result, rule = null, mode = "solo", score) {
  const entry = {
    date: new Date().toLocaleString("ja-JP"),
    words: [...words],
    length: words.length,
    result, // ソロ:"lose"|"clear" / オンライン:"win"|"lose"|"draw"（自分視点）
    rule,   // { mode, dictCheck, minLength, exactLength, limitSec, maxTurns }
    mode,   // "solo" | "online"
    ...(typeof score === "number" ? { score } : {}),
  };
  const list = [entry, ...loadHistory()].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function clearHistory() {
  localStorage.removeItem(KEY);
}
