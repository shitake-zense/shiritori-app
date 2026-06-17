# 開発進捗・引き継ぎ

jig.jp 2026サマーインターン課題のしりとりアプリ。再起動時はまず CLAUDE.md と本ファイルを読んで再開する。

## 開発方針（厳守）
- 小〜中規模の変更は確認なしで自律的に進める
- 事前確認するのは: 技術スタック変更 / ディレクトリ構成変更 / データ構造の大幅変更 / 外部サービス導入 / UIコンセプト変更 / 課題要件に影響する変更 のみ
- トークン節約: 長文を書かない・差分中心・要約優先・不要な説明は省く・ファイル全文を何度も読まない
- 実装フェーズは一度に1〜2タスクずつ。各タスク完了後に次タスクを提案する
- 私(ユーザー)の作業とClaudeの作業を毎回明確に分離する（【Claudeの作業】/【あなたの作業】形式）
- Git運用: 1タスク → commit → push → GitHub Pages確認。コミットメッセージも提案する

## 技術スタック
Vanilla JS(ESモジュール) + プレーンCSS、ビルドなし、GitHub Pages配信。
Firebaseは複数人対戦(後半)で必要時のみ導入。

## 公開URL
https://shitake-zense.github.io/shiritori-app/

## 進捗
- [x] **M1 必須機能MVP**（push済み）: 前単語表示 / 文字一致判定 / エラー表示 / 「ん」終了 / 重複終了 / リセット / ランダム初期単語 / ひらがな限定バリデーション
- [x] **M2 履歴表示**（push済み）: 対戦中の単語チェーン表示 + 過去ゲーム結果のlocalStorage保存・一覧・クリア
- [x] **M3 単語チェックモード**（push済み）: ON/OFFトグル。judgeにopts.isRealWordを注入する設計
  - 辞書はIPAdic(mecab-ipadic)から `tools/build-dictionary.mjs` で生成した約45,000語(`words.json`/濁点語含む)。起動時に非同期fetchで読み込む（読込中はトグル無効）
  - 辞書更新: `node tools/build-dictionary.mjs` で words.json 再生成
- [x] **M4 独自縛りルール + UI磨き + README完成**（push済み）
  - [x] 独自縛りルール: 文字数しばり（N文字以上／なし・3・4・5）。judgeにopts.minLength注入
  - [x] README完成（課題提出用・概要/遊び方/機能/構成/実行手順）
  - [x] UI磨き: 和モダン（墨×朱×和紙）へ全面リデザイン。明朝×ゴシック、判子モチーフ、グレイン、勝敗/入力アニメ（prefers-reduced-motion対応）
- [ ] **M5 複数人対戦**（Firebase Realtime Database・ルームコード方式）← 進行中
  - [x] Round A: ロジック層 `js/online.js`（createRoom/joinRoom/subscribeRoom/submitWord/rematch/leaveRoom）。判定はjudge()をtransaction内で権威評価。`js/firebase-config.js`テンプレ・`docs/FIREBASE.md`手順書
  - [x] あなたの作業: Firebaseプロジェクト作成・config設定（databaseURL=米国リージョン）。DBルールはdocs/FIREBASE.md参照で要確認
  - [x] Round B: UI統合（ひとり/ふたり対戦モード切替・ルーム作成/参加・手番/相手切断/勝敗/再戦表示）。main.jsをソロ/オンライン2モード構成にリファクタ
  - [x] 実機確認OK（ユーザー）。画面遷移を分離: オンラインは「作成/参加画面」↔「対戦画面」をapplyView()で切替、ルールは作成画面のみ編集可。[hidden]の!important化で潜在バグ解消
  - [ ] **次**: 画面遷移版の再確認。問題なければM5完了

## 設計メモ
- ロジック(game.js)とDOM(main.js)を分離。judge()の戻り値 `{ok, reason?, end?}` が状態遷移の中心
- `end: "lose"` =「ん」終了・重複。新ルールはこの契約を保って game.js に追加する

## 更新ルール
タスク完了ごとに本ファイルの進捗チェックボックスと「次はここ」を更新する。
