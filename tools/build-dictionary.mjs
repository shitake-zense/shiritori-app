// IPAdic（mecab-ipadic）から、しりとり用のひらがな単語辞書を生成する。
// 出力: ../words.json（ひらがな単語の配列）
// 実行: node tools/build-dictionary.mjs
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// 一般名詞を中心に取得（固有名詞・地名・人名は除外して品質を保つ）
const BASE = "https://raw.githubusercontent.com/taku910/mecab/master/mecab-ipadic/";
const FILES = [
  "Noun.csv",
  "Noun.verbal.csv", // サ変接続名詞（〜する系：べんきょう 等）
  "Noun.adjv.csv",   // 形容動詞語幹（しずか 等）
];

// カタカナ → ひらがな（長音符ーは保持）
function kataToHira(s) {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c >= 0x30a1 && c <= 0x30f6) out += String.fromCodePoint(c - 0x60);
    else out += ch;
  }
  return out;
}

const VALID = /^[ぁ-んー]+$/;

async function fetchEucJp(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder("euc-jp").decode(buf);
}

async function main() {
  const words = new Set();
  for (const f of FILES) {
    const text = await fetchEucJp(BASE + f);
    let kept = 0;
    for (const line of text.split("\n")) {
      if (!line) continue;
      const cols = line.split(",");
      // IPAdic: [0]表層形 ... [11]読み（カタカナ）
      const yomi = cols[11];
      if (!yomi || yomi === "*") continue;
      const hira = kataToHira(yomi);
      if (hira.length < 2 || hira.length > 8) continue;
      if (!VALID.test(hira)) continue;
      if (!words.has(hira)) kept++;
      words.add(hira);
    }
    console.log(`${f}: +${kept}`);
  }

  const list = [...words].sort();
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const out = join(__dirname, "..", "words.json");
  await writeFile(out, JSON.stringify(list));
  console.log(`total ${list.length} words -> words.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
