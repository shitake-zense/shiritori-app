# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

jig.jp 2026 サマーインターン選考課題のしりとりアプリ。Vanilla JS（ESモジュール）の静的サイトで、**GitHub Pages** にデプロイする。ビルド・パッケージマネージャ・依存関係はなし（ローカルにnode_modulesを持たない）。オンライン対戦のみ **Firebase** をCDN（gstatic）からESモジュールで読み込む。

**再開時は `docs/PROGRESS.md` を読む** — 開発方針・進捗・残タスク・次の作業がそこに集約されている。

## Run / Deploy

- ローカル確認: `index.html` は `type="module"` を使うため `file://` 直開きでは動かない。VSCode の **Live Server** 拡張等のローカルHTTPサーバで開く。
- テストフレームワークなし（ロジックは手動確認）。
- デプロイ: `main` への push が GitHub Pages（Source: `main` / root）に反映される。ローカル確認は最小限にし、push → Pages反映確認のサイクルで進める。
- 公開URL: `https://shitake-zense.github.io/shiritori-app/`
- オンライン対戦には Firebase Realtime Database が必要。`js/firebase-config.js`（`databaseURL` 必須）とDBルールの設定手順は `docs/FIREBASE.md`。未設定でもソロプレイは動作する。

## Architecture

ロジックとDOMを意図的に分離している（この分離のおかげでオンライン対戦＝online.jsを後付けで重ねられた）。

- `js/game.js` — **DOM非依存の純粋ロジック**。文字正規化（小書き文字・末尾「ー」）、`firstChar`/`lastChar`、入力バリデーション、`judge()` による勝敗・継続判定を持つ。ルール変更はここに集約する。ソロ／オンライン双方がこの`judge()`を使う。
- `js/main.js` — DOM制御とゲーム進行。**ソロ／オンラインの2モード**を持ち、`applyView()` が画面（ソロ設定／ソロ盤面／オンライン作成画面／対戦画面）の表示を一元制御する。ソロは `soloPhase`（`setup`＝ルール編集中／`play`＝対戦中）を持ち、「しりとりを始める」開始後はルールパネルを隠して変更不可にする（`ruleSnapshot()`で確定）。ソロは `state`（`words`/`used`/`over`/`rule`）、オンラインは `session`＋ルーム購読で描画。描画（renderBoard/renderChain/連続数renderStreak/ルールバッジ）は両モード共通。DOMアクセスはこのファイルに閉じる。
- `js/online.js` — **オンライン対戦のロジック層（DOM非依存）**。Firebase Realtime Database でルーム同期。`createRoom`/`joinRoom`/`subscribeRoom`/`submitWord`/`rematch`/`leaveRoom`。`submitWord` は transaction 内で手番検証＋`judge()`を権威評価し、ルールは `room.rule` 準拠で両者統一。
- `js/firebase-config.js` — Firebaseウェブ設定（公開識別子。秘匿情報ではない）。`databaseURL` はRTDB必須。`isConfigured()` で未設定を検知。
- `js/history.js` — 過去ゲーム結果の localStorage 永続化（`loadHistory`/`saveGame`/`clearHistory`、最大20件・新しい順）。各エントリにその対戦の `rule` も保存し一覧に併記。※現状ソロのみ保存。
- `js/dictionary.js` — 初期単語候補・`randomStarter()`・辞書ロジック。辞書本体(`words.json`/約45,000語)は起動時に非同期fetchで読み込む（`loadDictionary()`）。
- `words.json` — 単語チェック用辞書データ。IPAdicから `tools/build-dictionary.mjs` で生成・コミット済み。語彙更新は `node tools/build-dictionary.mjs` で再生成する。
- `index.html` / `css/style.css` — UI。**和モダン（墨×朱×和紙）**エディトリアル。明朝(Shippori Mincho)見出し×ゴシック(Zen Kaku Gothic New)本文、判子モチーフ、グレイン、勝敗/入力アニメ（`prefers-reduced-motion`対応）。
- `docs/FIREBASE.md` — Firebaseコンソール設定手順とDBセキュリティルール。

`judge()` の戻り値 `{ok, reason?, end?}` が状態遷移の中心。`end` は `"lose"`（「ん」終了・重複）を表す。文字数しばり（`opts.minLength`/`opts.exactLength`）・辞書チェック（`opts.isRealWord`）等の違反は `ok:false`（`end`なし）の再入力要求。解答時間切れは judge 外（ソロはクライアントタイマー、オンラインは `online.timeoutLose()` の transaction）で敗北を確定する。新ルール追加時はこの契約を保つこと（online.jsの権威判定も同じ`judge()`を通すため自動で整合する）。

ルール設定は `{dictCheck, minLength, exactLength, limitSec}`（`limitSec:0`=制限なし）で、ソロは `ruleSnapshot()`、オンラインは `room.rule` に保持する。

## Conventions

- 日本語コメント・日本語UI。
- コミットは機能単位で細かく分割し、`feat:` / `docs:` / `chore:` 等のprefixを付ける。
- 追加機能の実装順（全て実装済み）: 履歴表示(済) → 単語チェックモード(済) → 独自縛りルール=文字数しばり(済) → 複数人対戦=オンライン対戦(済・Firebase RTDB導入済)。
