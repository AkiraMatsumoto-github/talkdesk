# talkdesk 技術選定

## 全体構成（GCP）

```
Firebase Hosting ── React SPA (CSR)
      │
Cloud Run ── Go APIサーバー（REST + WebSocket）
      │              │
      │        Memorystore for Redis（Pub/Sub: インスタンス間のメッセージ配信）
      │
Cloud SQL for PostgreSQL
Cloud Storage ── 成果物ファイル（署名付きURL）
Identity Platform ── 認証
SendGrid ── メール通知（GCP外部）
WebPush (VAPID) ── ブラウザ通知（将来ネイティブ展開時はFCMに差し替え）
```

## バックエンド（Go）

| 領域 | 採用 | 理由 |
|---|---|---|
| 言語 | Go 1.24+ | 並行処理・WebSocketとの相性、シングルバイナリでCloud Runと好相性 |
| ルーター | chi | 標準net/http互換で薄い。ミドルウェア資産も十分 |
| WebSocket | coder/websocket | メンテ活発、context対応の現代的API |
| DBアクセス | pgx + sqlc | SQLから型安全なGoコードを生成。権限チェックを含む複雑なクエリを素のSQLで管理できる |
| マイグレーション | golang-migrate | 定番 |
| バリデーション | go-playground/validator | 定番 |

### リアルタイム配信の設計

- クライアントはWebSocketで接続し、購読中スレッドの新着メッセージ・ステータス変更を受信
- Cloud Runは複数インスタンスに分かれるため、**Redis Pub/Sub経由でインスタンス間にイベントをファンアウト**する
- **Cloud RunのWebSocketは最大60分で切断される**ため、クライアント側に自動再接続＋切断中の差分取得（最終受信メッセージID以降をRESTで取得）を最初から実装する
  - この再接続処理はネットワーク断・スリープ復帰対策としてどのみち必要なので、実質的なデメリットは小さい
- 通知（WebPush/メール）はWebSocket配信とは別に、未読が一定時間残った場合に送るワーカーをCloud Run Jobs or 同一サービス内goroutineで実装

## フロントエンド（React SPA / CSR）

| 領域 | 採用 | 理由 |
|---|---|---|
| ビルド | Vite + TypeScript | CSR SPAの標準構成 |
| ルーティング | React Router | 定番 |
| サーバー状態 | TanStack Query | REST取得＋WebSocketでのキャッシュ更新パターンが確立している |
| クライアント状態 | Zustand | 軽量。WebSocket接続状態・UI状態の管理 |
| UI | Tailwind CSS + shadcn/ui | チャットUIはカスタム前提。部品はshadcn/uiで時短 |

- Webview搭載（Electron/Tauri・Capacitor）を見据え、通知・ファイル選択などプラットフォームAPIは抽象化レイヤーを1枚挟む

## 認証: Identity Platform（Firebase Auth）

- メール+パスワード、招待フロー、パスワードリセットを自前実装せずに済む
- クライアントはIDトークンをAPIに送り、Go側はJWT検証のみ。**ロール・所属・スレッド権限はすべて自前のDBで管理**（Identity Platformは認証のみ、認可はアプリ側）
- Webviewでも動作する（リダイレクトフローに注意すれば可）

## データベース

- Cloud SQL for PostgreSQL 16
- マルチテナント分離は**単一DB + organization_idカラム**方式（全テーブルに必須）。クエリは必ずorganization_idで絞る規約とし、sqlcのクエリレビューで担保
- 添付ファイルはGCSに置き、DBにはメタデータのみ

## インフラ・運用

| 領域 | 採用 |
|---|---|
| IaC | Terraform |
| CI/CD | GitHub Actions（テスト→Cloud Runデプロイ、SPAはFirebase Hostingへ） |
| 監視 | Cloud Logging / Cloud Monitoring（構造化ログをGoのslogで出力） |
| 環境 | dev / prod の2環境から開始 |

## リポジトリ構成（モノレポ）

```
talkdesk/
├── docs/        # 設計ドキュメント
├── server/      # Go APIサーバー
├── web/         # React SPA
├── infra/       # Terraform
└── .github/     # CI/CD
```
