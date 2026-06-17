// Firebase ウェブ設定。
// Firebaseコンソール > プロジェクトの設定 > マイアプリ（ウェブ）の「SDK設定と構成」から
// 取得した値で下記の REPLACE_ME を置き換える。
//
// ※これらはクライアント用の公開識別子であり秘匿情報ではない（静的サイトに含めて問題ない）。
//   アクセス制御は Realtime Database のセキュリティルールで行う（docs/FIREBASE.md 参照）。
//
// Realtime Database を使うため databaseURL は必須。

export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  databaseURL: "https://REPLACE_ME-default-rtdb.firebaseio.com",
  projectId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

/** 設定がまだプレースホルダのままか */
export function isConfigured() {
  return firebaseConfig.apiKey !== "REPLACE_ME";
}
