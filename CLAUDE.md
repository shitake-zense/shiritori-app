# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

jig.jp 2026 サマーインターン選考課題のしりとりアプリ。Vanilla JS（ESモジュール）の静的サイトで、**GitHub Pages** にデプロイする。ビルド・パッケージマネージャ・依存関係はなし。

**再開時は `docs/PROGRESS.md` を読む** — 開発方針・進捗・残タスク・次の作業がそこに集約されている。

## Run / Deploy

- ローカル確認: `index.html` は `type="module"` を使うため `file://` 直開きでは動かない。VSCode の **Live Server** 拡張等のローカルHTTPサーバで開く。
- テストフレームワークなし（ロジックは手動確認）。
- デプロイ: `main` への push が GitHub Pages（Source: `main` / root）に反映される。ローカル確認は最小限にし、push → Pages反映確認のサイクルで進める。
- 公開URL: `https://shitake-zense.github.io/shiritori-app/`

## Architecture

ロジックとDOMを意図的に分離している（将来の複数人対戦への拡張を見据えた構成）。

- `js/game.js` — **DOM非依存の純粋ロジック**。文字正規化（小書き文字・末尾「ー」）、`firstChar`/`lastChar`、入力バリデーション、`judge()` による勝敗・継続判定を持つ。ルール変更はここに集約する。
- `js/main.js` — DOM制御とゲーム進行。`state`（`words` 配列・`used` Set・`over`）を保持し、`game.js` の判定結果に応じて描画する。DOMアクセスはこのファイルに閉じる。
- `js/dictionary.js` — 初期単語候補と `randomStarter()`。単語チェックモード用辞書はここを拡張する（小規模・厳選方針）。
- `index.html` / `css/style.css` — 単一画面UI。ミニマル・カードデザイン。

`judge()` の戻り値 `{ok, reason?, end?}` が状態遷移の中心。`end` は `"lose"`（「ん」終了・重複）を表す。新ルール追加時はこの契約を保つこと。

## Conventions

- 日本語コメント・日本語UI。
- コミットは機能単位で細かく分割し、`feat:` / `docs:` / `chore:` 等のprefixを付ける。
- 追加機能の実装順: 履歴表示 → 単語チェックモード → 独自縛りルール → 複数人対戦（後半・必要時のみ Firebase 導入を検討）。
