// 過去ゲーム結果の永続化（localStorage）
const KEY = "shiritori_history";
const MAX = 20; // 保存上限

/** @returns {Array<{date:string, words:string[], length:number, result:string}>} */
export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

/** 1ゲームを履歴の先頭に追加（新しい順・上限MAX件） */
export function saveGame(words, result) {
  const entry = {
    date: new Date().toLocaleString("ja-JP"),
    words: [...words],
    length: words.length,
    result, // "lose" 等
  };
  const list = [entry, ...loadHistory()].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function clearHistory() {
  localStorage.removeItem(KEY);
}
