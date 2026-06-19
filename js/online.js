// オンライン対戦のロジック層（DOM非依存）。
// Firebase Realtime Database でルーム状態を同期する。ルームコード方式。
//
// ルームのデータ構造（rooms/{code}）:
//   status    : "waiting" | "playing" | "over"
//   rule      : { mode: "normal"|"atama"|"sugi", dictCheck, minLength, exactLength, limitSec, maxTurns }
//   starter   : string          初期単語
//   words     : string[]        つないだ単語列（words[0] が starter）
//   turn      : 0 | 1           次に打つ席(seat)
//   loser     : 0 | 1 | null    敗者の席（null=引き分け/未決着）
//   endReason : "rule"|"timeout"|"turns"|null  決着理由
//   scores    : { 0:number, 1:number }   しりとりすぎの席別得点
//   turnCount : number          継いだ回数（最大ターン判定）
//   players   : { [playerId]: { name, seat: 0|1, online: bool } }
//
// 勝敗・接続判定は game.js の judge() を権威として transaction 内で再評価する。

import {
  initializeApp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase, ref, get, set, update, onValue,
  runTransaction, onDisconnect, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

import { firebaseConfig, isConfigured } from "./firebase-config.js";
import { judge } from "./game.js";
import { randomStarter, isRealWord } from "./dictionary.js";

let db = null;
let serverOffset = 0; // サーバ時刻 - クライアント時刻（ミリ秒）

/** Firebaseを初期化（未設定なら例外）。複数回呼んでも安全。 */
export function initOnline() {
  if (db) return db;
  if (!isConfigured()) {
    throw new Error("firebase-config.js が未設定です（docs/FIREBASE.md 参照）");
  }
  const app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  // クライアント時計の補正値を購読（タイムアウト期限の同期に使う）
  onValue(ref(db, ".info/serverTimeOffset"), (s) => {
    serverOffset = s.val() || 0;
  });
  return db;
}

/** サーバ基準の現在時刻（ミリ秒）。タイムアウト判定はこれを使う。 */
export function serverNow() {
  return Date.now() + serverOffset;
}

/** 制限時間を 3〜100 秒に丸める（既定10秒） */
export function clampLimit(v) {
  v = Number(v);
  if (!Number.isFinite(v)) v = 10;
  return Math.max(3, Math.min(100, Math.round(v)));
}

/** しりとりすぎの最大ターン数を 2〜99 に丸める（既定12） */
export function clampTurns(v) {
  v = Number(v);
  if (!Number.isFinite(v)) v = 12;
  return Math.max(2, Math.min(99, Math.round(v)));
}

// 紛らわしい文字(I/O/0/1)を除いたルームコード用文字種
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode(len = 4) {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return s;
}

/** 切断時に online=false になるよう presence を設定 */
function setupPresence(code, playerId) {
  const onlineRef = ref(db, `rooms/${code}/players/${playerId}/online`);
  set(onlineRef, true);
  onDisconnect(onlineRef).set(false);
}

/**
 * ルームを作成しホスト(seat 0)として参加する。
 * @returns {Promise<{code:string, playerId:string, seat:0}>}
 */
export async function createRoom({ name, rule } = {}) {
  initOnline();
  const playerId = crypto.randomUUID();
  const starter = randomStarter();
  const m = rule && (rule.mode === "atama" || rule.mode === "sugi") ? rule.mode : "normal";
  const safeRule = {
    mode: m, // 遊び方（normal/atama/sugi）
    dictCheck: !!(rule && rule.dictCheck),
    minLength: (rule && rule.minLength) || 2,
    exactLength: (rule && rule.exactLength) || 0,
    limitSec: rule && rule.limitSec ? clampLimit(rule.limitSec) : 0, // 0=制限なし
    maxTurns: m === "sugi" ? clampTurns(rule && rule.maxTurns) : 0,   // しりとりすぎの最大ターン
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const roomRef = ref(db, `rooms/${code}`);
    const snap = await get(roomRef);
    if (snap.exists()) continue; // コード衝突 → リトライ
    await set(roomRef, {
      status: "waiting",
      createdAt: serverTimestamp(),
      rule: safeRule,
      starter,
      words: [starter],
      turn: 0,
      loser: null,
      endReason: null,
      turnStartedAt: null, // 対戦開始(参加)時にサーバ時刻で設定する
      scores: { 0: 0, 1: 0 }, // しりとりすぎの席別得点
      turnCount: 0,           // 継いだ回数（最大ターン判定用）
      players: { [playerId]: { name: name || "ホスト", seat: 0, online: true } },
    });
    setupPresence(code, playerId);
    return { code, playerId, seat: 0 };
  }
  throw new Error("ルーム作成に失敗しました（コードの空きが見つかりません）");
}

/**
 * 既存ルームにゲスト(seat 1)として参加する。
 * @returns {Promise<{code:string, playerId:string, seat:1}>}
 */
export async function joinRoom({ code, name } = {}) {
  initOnline();
  code = (code || "").trim().toUpperCase();
  if (!code) throw new Error("ルームコードを入力してください");

  const roomRef = ref(db, `rooms/${code}`);
  const snap = await get(roomRef);
  if (!snap.exists()) throw new Error("そのルームは存在しません");

  const room = snap.val();
  const players = room.players || {};
  if (Object.keys(players).length >= 2) throw new Error("ルームは満員です");

  const playerId = crypto.randomUUID();
  await update(ref(db, `rooms/${code}/players/${playerId}`), {
    name: name || "ゲスト", seat: 1, online: true,
  });
  // 対戦開始。先攻(seat0)の手番開始時刻をサーバ時刻で記録（タイムアウト基準）。
  await update(roomRef, { status: "playing", turnStartedAt: serverTimestamp() });
  setupPresence(code, playerId);
  return { code, playerId, seat: 1 };
}

/**
 * ルーム状態を購読する。
 * @param {(room:object|null)=>void} cb
 * @returns {() => void} 購読解除関数
 */
export function subscribeRoom(code, cb) {
  initOnline();
  return onValue(ref(db, `rooms/${code}`), (snap) => cb(snap.val()));
}

/**
 * 自分の手番として単語を送信する。判定は transaction 内で権威評価。
 * ルール(opts)は room.rule から構築するため、両者が同じルールで判定される。
 * @returns {Promise<{ok:boolean, reason?:string, end?:"win"|"lose"}>}
 */
export async function submitWord({ code, seat }, word) {
  initOnline();
  const roomRef = ref(db, `rooms/${code}`);
  let outcome = { ok: false, reason: "送信に失敗しました" };

  await runTransaction(roomRef, (room) => {
    if (!room || room.status !== "playing") {
      outcome = { ok: false, reason: "対戦中ではありません" };
      return room;
    }
    if (room.turn !== seat) {
      outcome = { ok: false, reason: "いまは相手の番です" };
      return room; // 変更なし
    }
    const words = room.words || [];
    const prev = words[words.length - 1];
    const used = new Set(words);

    const opts = {};
    if (room.rule && room.rule.mode === "atama") opts.mode = "atama";
    if (room.rule && room.rule.dictCheck) opts.isRealWord = isRealWord;
    if (room.rule && room.rule.minLength > 2) opts.minLength = room.rule.minLength;
    if (room.rule && room.rule.exactLength) opts.exactLength = room.rule.exactLength;

    const res = judge(word, prev, used, opts);
    outcome = res;

    if (!res.ok && !res.end) {
      return undefined; // 無効入力 → abort（状態を変えない）
    }
    words.push(word);
    room.words = words;
    if (res.end === "lose") {
      room.status = "over";
      room.loser = seat;
      room.endReason = "rule"; // 「ん」終了・重複（点数に関係なく即負け）
    } else if (room.rule && room.rule.mode === "sugi") {
      // しりとりすぎ: 重なり長を加点し、最大ターン到達で点数勝負
      const scores = room.scores || { 0: 0, 1: 0 };
      scores[seat] = (scores[seat] || 0) + (res.points || 0);
      room.scores = scores;
      const tc = (room.turnCount || 0) + 1;
      room.turnCount = tc;
      if (room.rule.maxTurns && tc >= room.rule.maxTurns) {
        room.status = "over";
        room.endReason = "turns";
        const s0 = scores[0] || 0, s1 = scores[1] || 0;
        room.loser = s0 === s1 ? null : (s0 < s1 ? 0 : 1); // 低い方が負け・同点は引き分け(null)
      } else {
        room.turn = 1 - seat;
        room.turnStartedAt = serverTimestamp();
      }
    } else {
      room.turn = 1 - seat;
      room.turnStartedAt = serverTimestamp(); // 次の手番のタイマーを起動
    }
    return room;
  });
  return outcome;
}

/**
 * 制限時間切れによる敗北を確定する。手番のプレイヤー(room.turn)が負け。
 * 両クライアントが同時に呼んでも transaction で冪等（後勝ちしない）。
 * @param {number} expectedTurnStartedAt 期限算出に使った手番開始時刻。ズレていたら無効化。
 */
export async function timeoutLose(code, expectedTurnStartedAt) {
  initOnline();
  await runTransaction(ref(db, `rooms/${code}`), (room) => {
    if (!room || room.status !== "playing") return room;
    // 別の手番に移っている／開始時刻が異なる場合は誤発火なので何もしない
    if (room.turnStartedAt !== expectedTurnStartedAt) return room;
    room.status = "over";
    room.loser = room.turn;
    room.endReason = "timeout";
    return room;
  });
}

/** 同じルームで再戦（状態を初期化） */
export async function rematch(code) {
  initOnline();
  const starter = randomStarter();
  await update(ref(db, `rooms/${code}`), {
    status: "playing", words: [starter], starter, turn: 0,
    loser: null, endReason: null, turnStartedAt: serverTimestamp(),
    scores: { 0: 0, 1: 0 }, turnCount: 0, // しりとりすぎの得点・ターンもリセット
  });
}

/** ルームから退出（presence を落とす） */
export async function leaveRoom({ code, playerId }) {
  if (!db) return;
  try {
    await set(ref(db, `rooms/${code}/players/${playerId}/online`), false);
  } catch (e) {
    console.warn("退出処理に失敗:", e);
  }
}
