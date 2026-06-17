# Firebase セットアップ手順（M5 オンライン対戦）

オンライン対戦は **Firebase Realtime Database** で状態同期する。ルームコード方式。
コード側は `js/online.js`（ロジック）/ `js/firebase-config.js`（設定）に実装済み。
**以下はFirebaseコンソールでの作業（あなたの作業）。**

## 1. プロジェクト作成
1. https://console.firebase.google.com/ で「プロジェクトを追加」。
2. プロジェクト名は任意（例: `shiritori-app`）。Googleアナリティクスは無効でよい。

## 2. ウェブアプリを登録
1. プロジェクト概要 > 「</>」（ウェブ）でアプリを追加。
2. アプリ名は任意。Hostingは不要（GitHub Pagesを使うため）。
3. 表示される `firebaseConfig` の値を控える。

## 3. Realtime Database を作成
1. 左メニュー「構築 > Realtime Database」>「データベースを作成」。
2. ロケーションは任意（例: `asia-southeast1`）。
3. セキュリティルールは後述（まず「ロックモード」で作成→ルールを差し替え）。
4. 表示される `databaseURL`（`https://xxxx-default-rtdb.firebaseio.com`）を控える。

## 4. 設定値を反映（コード）
`js/firebase-config.js` の `REPLACE_ME` を、控えた値で置き換える。
`databaseURL` を含めること（RTDBに必須）。

```js
export const firebaseConfig = {
  apiKey: "…",
  authDomain: "…firebaseapp.com",
  databaseURL: "https://…-default-rtdb.firebaseio.com",
  projectId: "…",
  appId: "…",
};
```

> これらはクライアント用の公開識別子で秘匿情報ではない。アクセス制御はDBルールで行う。

## 5. セキュリティルールを設定
Realtime Database >「ルール」タブに以下を貼り付けて公開。
`/rooms` 配下のみ読み書きを許可し、その他は拒否する（選考デモ向けの簡易ルール）。

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "rooms": {
      "$code": {
        ".read": true,
        ".write": true,
        ".validate": "$code.length <= 8"
      }
    }
  }
}
```

> 本番運用では Firebase Authentication を併用し、書き込みを参加者に限定するのが望ましい。
> 現状は認証なしの公開ルームのため、誰でも `/rooms/{code}` を読み書きできる点に留意。

## 6. 公開ドメインの許可（必要時）
Authentication未使用なら不要。将来Auth導入時は
Authentication > Settings > 承認済みドメインに `shitake-zense.github.io` を追加する。

---

## 動作確認
設定反映後、ローカルHTTPサーバ（Live Server等）または公開URLで:
1. タブAで「ルームを作る」→ コード表示。
2. タブBで同じコードを入力して「参加」。
3. 交互に単語を入力して同期・手番・勝敗が反映されることを確認。

UI（モード切替・ルーム画面）は Round B で実装する。
