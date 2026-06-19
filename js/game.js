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
 * しりとりすぎ用: 前の単語の末尾と次の単語の先頭が重なる最大文字数（1以上）。
 * 重なりがなければ0。文字列の literal な一致で数える（得点＝この長さ）。
 * 例: overlapLen("ごりら","りらっくす") = 2（"りら"）
 */
export function overlapLen(prevWord, word) {
  const max = Math.min(prevWord.length, word.length);
  for (let n = max; n >= 1; n--) {
    if (prevWord.slice(-n) === word.slice(0, n)) return n;
  }
  return 0;
}

/**
 * 入力単語を判定する。
 * @param {object} [opts]
 * @param {(w:string)=>boolean} [opts.isRealWord] 指定時、実在語チェックを行う
 * @param {number} [opts.minLength] 指定時、この文字数以上の単語のみ許可（文字数しばり）
 * @param {number} [opts.exactLength] 指定時、ちょうどこの文字数の単語のみ許可（3文字縛り等）
 * @param {"normal"|"atama"|"sugi"} [opts.mode] 接続方向。"atama"=あたまとり（次語の末尾が前語の先頭に一致）／"sugi"=しりとりすぎ（末尾と先頭の重なり1文字以上で接続し、重なり長を points で返す）。既定は通常しりとり
 * @returns {{ok:boolean, reason?:string, end?:"win"|"lose", points?:number}}
 */
export function judge(word, prevWord, usedSet, opts = {}) {
  if (!isValidInput(word)) {
    return { ok: false, reason: "ひらがな2文字以上で入力してね" };
  }
  if (opts.exactLength && word.length !== opts.exactLength) {
    return { ok: false, reason: `ちょうど${opts.exactLength}文字で入力してね（${opts.exactLength}文字縛り）` };
  }
  if (opts.minLength && word.length < opts.minLength) {
    return { ok: false, reason: `${opts.minLength}文字以上で入力してね（文字数しばり）` };
  }
  if (opts.isRealWord && !opts.isRealWord(word)) {
    return { ok: false, reason: `「${word}」は辞書にない単語です` };
  }
  if (usedSet.has(word)) {
    return { ok: false, end: "lose", reason: `「${word}」は既出！あなたの負け` };
  }
  let points;
  if (prevWord) {
    if (opts.mode === "atama") {
      // あたまとり: 次の単語の「末尾」が前の単語の「先頭」文字に一致する
      if (lastChar(word) !== firstChar(prevWord)) {
        return { ok: false, reason: `「${firstChar(prevWord)}」で終わる言葉を選んでね` };
      }
    } else if (opts.mode === "sugi") {
      // しりとりすぎ: 前語の末尾と次語の先頭が重なれば接続（重なり長＝得点）
      points = overlapLen(prevWord, word);
      if (points < 1) {
        return { ok: false, reason: `前の言葉の終わりと重なる文字から始めてね` };
      }
    } else {
      // 通常しりとり: 次の単語の「先頭」が前の単語の「末尾」文字に一致する
      if (firstChar(word) !== lastChar(prevWord)) {
        return { ok: false, reason: `「${lastChar(prevWord)}」から始めてね` };
      }
    }
  }
  if (endsWithN(word)) {
    return { ok: true, end: "lose", reason: `「ん」で終了！あなたの負け` };
  }
  return points != null ? { ok: true, points } : { ok: true };
}
