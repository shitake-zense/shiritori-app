// 辞書ロジック層。単語データは words.js に分離している。
import { WORD_LIST } from "./words.js";

export const WORDS = new Set(WORD_LIST);

// 初期単語候補（「ん」終わりは含めない）。辞書にも存在する語のみ。
export const STARTERS = [
  "りんご", "さくら", "ねこ", "たいよう", "ひまわり",
  "うみ", "そら", "やま", "かわ", "とり",
  "はな", "ほし", "くも", "ゆき", "さかな",
];

/** ランダムな初期単語を返す */
export function randomStarter() {
  return STARTERS[Math.floor(Math.random() * STARTERS.length)];
}

/** 辞書に存在する実在単語か */
export function isRealWord(word) {
  return WORDS.has(word);
}
