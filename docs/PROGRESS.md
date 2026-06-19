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
オンライン対戦は Firebase Realtime Database を導入済み（CDNからESモジュール読込）。設定は `js/firebase-config.js`＋`docs/FIREBASE.md`。
UIは和モダン（墨×朱×和紙）。WebフォントはGoogle Fonts（Shippori Mincho B1 / Zen Kaku Gothic New）。

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
- [x] **M5 複数人対戦＝オンライン対戦**（push済み・Firebase Realtime Database・ルームコード方式）
  - [x] Round A: ロジック層 `js/online.js`（createRoom/joinRoom/subscribeRoom/submitWord/rematch/leaveRoom）。判定はjudge()をtransaction内で権威評価。`js/firebase-config.js`＋`docs/FIREBASE.md`手順書
  - [x] Firebaseプロジェクト作成・config設定（databaseURL=米国リージョン）・DBルール反映
  - [x] Round B: UI統合（ひとり/ふたり対戦モード切替・ルーム作成/参加・手番/相手切断/勝敗/再戦）。main.jsをソロ/オンライン2モード構成にリファクタ
  - [x] 画面遷移を分離: オンラインは「作成/参加画面」↔「対戦画面」を `applyView()` で切替、ルールは作成画面のみ編集可。`[hidden]`の!important化で潜在バグ解消。実機確認OK

## 完了状況
**想定していた実装はすべて完了（2026-06-19時点）。** M1〜M5の必須要件＋独自機能（履歴・単語チェック・文字数しばり・オンライン対戦・解答時間制限）＋特殊ルール2種（あたまとり・しりとりすぎ）＋UI磨き（見出しのモード連動・終了時リザルト文言）まで実装・push済み。公開URLはFirebase設定済み・コミット済みのため、誰でもそのまま2人対戦できる（遊ぶ側のセットアップ不要）。
残タスクは任意のDBルール強化（Firebase Auth）のみで、選考デモ向けに意図的に見送り中（下記「既知の調整候補」参照）。

### 特殊ルール（計2種・実装済み）
- [x] **あたまとり**（接続反転）。前の単語の「先頭」文字を、次の単語の「末尾」に持ってくる繰り返し（例: りんご→はかり→かれは→わか→ちくわ→おいたち）。「ん」終了は通常どおり負け。時間制限／文字数しばり／単語チェックも併用可。ソロ・オンライン両対応（`opts.mode="atama"` / `rule.mode`）。盤面sealは「末尾＋先頭文字」に切替。遊び方は `#ruleMode` セレクトで選択。
- [x] **しりとりすぎ**（重なり加点）。前語の末尾と次語の先頭が重なる最大長で接続し、その文字数を得点化（例: りんご→ごりら→りらっくす→…→ぷーるさいど＝計11点）。`overlapLen()`＋`judge`の`points`。「ん」終了・被りは負け。最大ターン（`maxTurns`/`#turnsInput`、既定12）設定可。**ソロはスコアアタック**（最大ターン到達で`clear`・最終スコア表示）、**オンラインは席別`scores`＋`turnCount`を集計し最大ターンで点数勝負**（同点は引き分け`endReason:"turns"`/`loser:null`）。時間切れは点数に関係なく即負け。盤面sealは「重ね＋末尾字」、得点行`#score`を表示。履歴に得点併記＋勝/敗/分バッジ。

### 追加機能（実装済み）
- [x] **解答時間制限**（案A=時間切れ即負け／入力は送信しない）。ソロ・オンライン両対応。**ON/OFFトグル（既定OFF）**、ONで解答時間を数値入力3〜100秒（既定10秒）。盤面にカウントダウンバー＋残秒（残り3秒で朱・点滅）
  - ソロ: クライアントタイマー。手番ごとに再起動、無効入力では継続
  - オンライン: `turnStartedAt`(サーバ時刻)＋`.info/serverTimeOffset`補正で期限を両者同期。超過は `online.timeoutLose()` の transaction で冪等決着（手番者=loser、`endReason:"timeout"`）。決着メッセージは時間切れ/通常を出し分け
- [x] **3文字縛り（ちょうど3文字）**。文字数しばりに `ちょうど3文字` を追加（`judge`の`opts.exactLength`）。既存の「N字以上」と排他選択
- [x] **連続成功カウント**。盤面に「連続 N 回つながり中」を表示（words数-1）。終了時は「今回の記録：連続 N 回つながった！」のリザルト文言に切替（`renderStreak(words, ended)`）。しりとりすぎ時は連続数の代わりに得点行を表示
- [x] **見出しのモード連動**。画面最上部の見出し・サブを遊び方で切替（`applyMastheadMode`）。しりとり／あたまとり／しりとりすぎで表示が変わる（設定・対戦・ロビーいずれも反映）
- [x] **履歴にルール設定を併記**。`saveGame(words,result,rule)`でルールを保存し一覧にバッジ表示（`ruleSummary`）
- [x] **開始ボタン＋ルール固定**。ソロは `setup`（ルール編集）→「しりとりを始める」→ `play`（ルール非表示=変更不可）の2フェーズ。「はじめから」で設定へ戻る。オンラインは従来どおりロビーで設定→入室後固定
- [x] **ファビコン** `shiritori.png` をサイトアイコンに設定

### 既知の調整候補
- [x] guestロビーのルール欄: 参加フォームに「参加時はホストの設定が適用される」旨の注記を追加（作成/参加兼用画面のため欄自体は維持）。
- [x] オンライン結果の履歴保存: `renderOnline` の決着遷移で `saveGame(words, win/lose, rule, "online")` を1度だけ保存。履歴一覧にオンラインのみ自分視点の勝敗バッジ（勝＝朱／敗＝かすれ）を表示。`history.js` に `mode` フィールド追加。
- [ ] DBルールは認証なしの公開ルーム（選考デモ向けの**意図的**設計）。本番運用ならFirebase Auth併用が望ましいが、外部サービス設定変更のため**デモでは見送り**。

## 設計メモ
- ロジック(game.js)とDOM(main.js)を分離。judge()の戻り値 `{ok, reason?, end?, points?}` が状態遷移の中心。online.jsもこの`judge()`を権威判定に使う
- `end: "lose"` =「ん」終了・重複。文字数しばり違反は `ok:false`（endなし）。接続方向は `opts.mode`（normal/atama/sugi）、`points`はしりとりすぎの重なり得点。新ルールはこの契約を保って game.js に追加する
- オンライン: ルームデータ構造は `online.js` 冒頭コメント／`docs/FIREBASE.md` 参照（`scores`/`turnCount`/`endReason` 等を含む）。`submitWord`は手番検証＋判定＋加点をtransactionで原子的に行う

## 更新ルール
想定実装は完了済み。以降は追加・修正タスクが発生したら、本ファイルの該当チェックボックス／完了状況を更新する。
