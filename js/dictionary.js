// 辞書ロジック層。
// 単語データ(words.json)はIPAdicから tools/build-dictionary.mjs で生成。
// 約45,000語と大きいため、起動時に非同期で読み込む。

let WORDS = new Set();
let loaded = false;

// 初期単語候補（「ん」終わりは含めない）。即時に使うため辞書とは別に保持。
export const STARTERS = [
  "りんご", "さくら", "ねこ", "たいよう", "ひまわり",
  "うみ", "そら", "やま", "かわ", "とり",
  "はな", "ほし", "くも", "ゆき", "さかな",
];

/** ランダムな初期単語を返す */
export function randomStarter() {
  return STARTERS[Math.floor(Math.random() * STARTERS.length)];
}

/** 辞書JSONを読み込む。失敗してもアプリは動作する（チェックモードのみ無効）。 */
export async function loadDictionary() {
  if (loaded) return true;
  try {
    const url = new URL("../words.json", import.meta.url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    WORDS = new Set(await res.json());
    loaded = true;
    return true;
  } catch (e) {
    console.warn("辞書の読み込みに失敗:", e);
    return false;
  }
}

export function isDictionaryReady() {
  return loaded;
}

/** 辞書に存在する実在単語か */
export function isRealWord(word) {
  return WORDS.has(word);
}
