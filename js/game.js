// しりとりのコアロジック（DOM非依存・純粋関数中心）

// 末尾「ー」や小書き文字を、しりとり接続上の標準文字へ正規化する対応表
const SMALL_TO_LARGE = {
  "ぁ": "あ", "ぃ": "い", "ぅ": "う", "ぇ": "え", "ぉ": "お",
  "ゃ": "や", "ゅ": "ゆ", "ょ": "よ", "っ": "つ", "ゎ": "わ",
};

/** 単語の最後の有効文字を返す（末尾の「ー」はその前の文字を採用） */
export function lastChar(word) {
  let i = word.length - 1;
  while (i >= 0 && word[i] === "ー") i--;
  if (i < 0) return "";
  const c = word[i];
  return SMALL_TO_LARGE[c] ?? c;
}

/** 単語の最初の有効文字を返す */
export function firstChar(word) {
  const c = word[0] ?? "";
  return SMALL_TO_LARGE[c] ?? c;
}

/** ひらがな（長音符含む）のみで構成され、2文字以上か */
export function isValidInput(word) {
  if (!word || word.length < 2) return false;
  return /^[ぁ-んー]+$/.test(word);
}

/** 「ん」で終わるか */
export function endsWithN(word) {
  return lastChar(word) === "ん";
}

/**
 * 入力単語を判定する。
 * @param {object} [opts]
 * @param {(w:string)=>boolean} [opts.isRealWord] 指定時、実在語チェックを行う
 * @returns {{ok:boolean, reason?:string, end?:"win"|"lose"}}
 */
export function judge(word, prevWord, usedSet, opts = {}) {
  if (!isValidInput(word)) {
    return { ok: false, reason: "ひらがな2文字以上で入力してね" };
  }
  if (opts.isRealWord && !opts.isRealWord(word)) {
    return { ok: false, reason: `「${word}」は辞書にない単語です` };
  }
  if (usedSet.has(word)) {
    return { ok: false, end: "lose", reason: `「${word}」は既出！あなたの負け` };
  }
  if (prevWord && firstChar(word) !== lastChar(prevWord)) {
    return { ok: false, reason: `「${lastChar(prevWord)}」から始めてね` };
  }
  if (endsWithN(word)) {
    return { ok: true, end: "lose", reason: `「ん」で終了！あなたの負け` };
  }
  return { ok: true };
}
