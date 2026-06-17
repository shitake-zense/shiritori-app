// しりとりの初期単語候補（厳選・小規模）。
// 単語チェックモード用の辞書は M3 で拡張予定。
export const STARTERS = [
  "りんご", "さくら", "ねこ", "たいよう", "みかん",
  "ひまわり", "うみ", "そら", "やま", "かわ",
  "とり", "はな", "ほし", "くも", "ゆき",
];

/** ランダムな初期単語を返す（「ん」終わりは含めない前提） */
export function randomStarter() {
  return STARTERS[Math.floor(Math.random() * STARTERS.length)];
}
