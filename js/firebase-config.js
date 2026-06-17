// Firebase ウェブ設定。
// Firebaseコンソール > プロジェクトの設定 > マイアプリ（ウェブ）の「SDK設定と構成」から
// 取得した値で下記の REPLACE_ME を置き換える。
//
// ※これらはクライアント用の公開識別子であり秘匿情報ではない（静的サイトに含めて問題ない）。
//   アクセス制御は Realtime Database のセキュリティルールで行う（docs/FIREBASE.md 参照）。
//
// Realtime Database を使うため databaseURL は必須。

export const firebaseConfig = {
  apiKey: "AIzaSyCVeolT0ogivVQcX0nIswl5kyumn7TiJmw",
  authDomain: "shiritori-app-733cc.firebaseapp.com",
  // ↓ Realtime Database に必須。RTDBコンソールのデータタブ上部に表示されるURLを貼る。
  //   米国リージョン例: https://shiritori-app-733cc-default-rtdb.firebaseio.com
  //   それ以外の例:     https://shiritori-app-733cc-default-rtdb.<region>.firebasedatabase.app
  databaseURL: "https://shiritori-app-733cc-default-rtdb.firebaseio.com/",
  projectId: "shiritori-app-733cc",
  storageBucket: "shiritori-app-733cc.firebasestorage.app",
  messagingSenderId: "685827522375",
  appId: "1:685827522375:web:aaa0a7ee6861246a571662"
};

/** 設定が完了しているか（databaseURL はRTDBに必須なので併せて確認） */
export function isConfigured() {
  return (
    firebaseConfig.apiKey !== "REPLACE_ME" &&
    !!firebaseConfig.databaseURL &&
    firebaseConfig.databaseURL !== "REPLACE_ME"
  );
}
