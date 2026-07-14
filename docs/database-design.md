# talkdesk データベース設計

PostgreSQL 16。主キーはすべて UUIDv7（時系列ソート可能、アプリ側で生成）。
全テーブルに `created_at` / `updated_at` を持つ（以下では省略）。

情報構造は **channels > threads > messages** の3層。権限管理はチャンネル単位。

## ER図

```mermaid
erDiagram
    organizations ||--o{ memberships : "依頼者の所属"
    organizations ||--o{ assignments : "アシスタントの担当"
    organizations ||--o{ channels : ""
    organizations ||--o{ invitations : ""
    users ||--o{ memberships : ""
    users ||--o{ assignments : ""
    users ||--o{ messages : ""
    users ||--o{ thread_read_cursors : ""
    users ||--o{ push_subscriptions : ""
    channels ||--o{ channel_members : "依頼者側の閲覧権限"
    channels ||--o{ threads : "依頼/トピック"
    channels ||--o{ pages : "ナレッジページ"
    pages ||--o{ page_revisions : "編集履歴"
    users ||--o{ channel_members : ""
    threads ||--o{ messages : ""
    threads ||--o{ thread_read_cursors : ""
    messages ||--o{ attachments : ""
```

## テーブル定義

### users

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| idp_uid | text UNIQUE | Identity Platform のUID |
| email | text UNIQUE | |
| display_name | text | |
| role | enum: `client` / `assistant` / `ops_admin` | システム全体のロール |
| avatar_url | text NULL | |
| disabled_at | timestamptz NULL | 無効化（退職等）。非NULLなら全アクセス拒否 |

### organizations

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| name | text | |
| icon_url | text NULL | アシスタントの企業レール用 |

### memberships（依頼者の所属。1ユーザー1社）

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| user_id | uuid FK UNIQUE | UNIQUEにより依頼者は1社のみ所属 |
| org_role | enum: `admin` / `member` | クライアント管理者 / 一般 |

### assignments（アシスタントの担当企業）

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| user_id | uuid FK | UNIQUE(organization_id, user_id) |

- 1人最大10社はアプリ層で担保（INSERT時に `SELECT count(*) ... FOR UPDATE` で検査）

### channels（業務単位。権限管理の単位）

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK | |
| name | text | 例:「給与計算」 |
| description | text NULL | |
| archived_at | timestamptz NULL | 業務終了時のアーカイブ |

### channel_members（依頼者側の閲覧権限）

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| channel_id | uuid FK | |
| user_id | uuid FK | UNIQUE(channel_id, user_id) |

- **依頼者(member)のみ行を持つ**。クライアント管理者・アシスタント・運営は行を持たずに閲覧できる（判定ロジックは下記）

### threads（依頼 / トピック）

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| channel_id | uuid FK | |
| organization_id | uuid FK | テナント境界の多層防御 |
| type | enum: `request` / `topic` | 依頼スレッド / トピックスレッド |
| title | text | |
| body | text NULL | 依頼内容（requestのみ） |
| due_date | date NULL | requestのみ |
| status | enum NULL: `open` / `in_progress` / `in_review` / `done` | requestのみ。依頼中/対応中/確認待ち/完了 |
| created_by | uuid FK(users) | |
| completed_at | timestamptz NULL | |
| last_message_at | timestamptz | スレッド一覧のソート用（非正規化） |

- INDEX: `(channel_id, last_message_at DESC)` — スレッド一覧用
- CHECK: `(type = 'request') = (status IS NOT NULL)`

### messages

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid PK | UUIDv7なのでスレッド内の時系列ソート・差分取得のカーソルを兼ねる |
| thread_id | uuid FK | |
| channel_id | uuid FK | 一覧・購読の絞り込み用（非正規化） |
| organization_id | uuid FK | テナント境界の多層防御 |
| user_id | uuid FK NULL | システムメッセージはNULL |
| type | enum: `chat` / `system` | systemはステータス変更等の自動投稿（FR-T3） |
| body | text | |
| edited_at | timestamptz NULL | 編集済みラベル用 |
| deleted_at | timestamptz NULL | 削除痕跡（FR-H7）。削除時にbodyは空文字化、添付は物理削除 |

- INDEX: `(thread_id, id)` — スレッド内ページング・差分取得用
- attachmentsへの参照は `owner_type='message', owner_id=messages.id`
- INDEX: `(channel_id, id)` — チャンネル単位の差分取得・ファイルタブ用

### attachments

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| owner_type | enum: `message` / `page` | 添付先の種別 |
| owner_id | uuid | メッセージID or ページID |
| file_name | text | |
| content_type | text | |
| size_bytes | bigint | 上限100MB（FR-F3、アプリ層で検査） |
| gcs_object_key | text | 実体はGCS。`org/{org_id}/channel/{channel_id}/...` |

### thread_read_cursors（既読管理）

| カラム | 型 | 備考 |
|---|---|---|
| thread_id | uuid FK | PK(thread_id, user_id) |
| user_id | uuid FK | |
| last_read_message_id | uuid | このID以下のメッセージは既読 |
| read_at | timestamptz | |

- **メッセージ×ユーザーの既読行は作らない**（行数爆発を防ぐ）。「誰が読んだか」（FR-H5）は `last_read_message_id >= 対象メッセージID` のユーザー集合として導出する（UUIDv7の時系列性を利用）。Slackと同じカーソル方式
- 未読数: スレッド単位＝カーソルより新しいメッセージ数、チャンネル単位＝配下スレッドの合計、企業単位（アシスタントのレール用）＝チャンネル合計。集計はRedisにキャッシュ

### pages（ナレッジページ: 業務マニュアル）

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| channel_id | uuid FK | |
| organization_id | uuid FK | テナント境界の多層防御 |
| title | text | |
| body | text | Markdown。最新版を保持 |
| revision | int | 楽観ロック用（FR-K4）。保存時に一致検査してインクリメント |
| updated_by | uuid FK(users) | |
| archived_at | timestamptz NULL | |

### page_revisions（編集履歴）

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| page_id | uuid FK | |
| revision | int | UNIQUE(page_id, revision) |
| title / body | text | 保存時点の全文スナップショット（FR-K3） |
| edited_by | uuid FK(users) | |

- 復元は「過去版の内容で新しいrevisionを作る」操作とし、履歴は改変しない
- ページ内画像はattachmentsを流用（`owner_type = 'page'`）。表示時にAPIが認可チェックして配信する（FR-K5）

### invitations

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid FK NULL | アシスタント・運営招待の場合NULL |
| email | text | |
| role | enum | 招待後のロール（client member/admin, assistant, ops_admin） |
| token | text UNIQUE | 招待リンク用。有効期限7日 |
| expires_at | timestamptz | |
| accepted_at | timestamptz NULL | |

### push_subscriptions（WebPush）

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| endpoint | text UNIQUE | |
| keys_p256dh / keys_auth | text | VAPID用 |

### notification_settings

| カラム | 型 | 備考 |
|---|---|---|
| user_id | uuid PK FK | |
| email_enabled | boolean | |
| webpush_enabled | boolean | |
| digest_delay_minutes | int | 未読が残ったらN分後に通知（既定10分） |

### audit_logs（NFR-3）

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid PK | |
| actor_user_id | uuid | |
| organization_id | uuid NULL | |
| action | text | `permission.grant` / `member.disable` / `ops.view_channel` 等 |
| target | jsonb | 対象の識別情報 |
| created_at | timestamptz | 追記のみ。UPDATE/DELETE権限をアプリDBユーザーに与えない |

## チャンネル閲覧可否の判定（認可の中心ロジック）

スレッド・メッセージ・添付の閲覧権限はすべて所属チャンネルから継承する。

```
can_view(user, channel):
  org = channel.organization_id
  1. user.role = ops_admin                          → 可（audit_logsに記録）
  2. user.role = assistant
       and assignments(user, org) が存在             → 可
  3. memberships(user, org).org_role = admin         → 可
  4. memberships(user, org) が存在
       and channel_members(channel, user) が存在     → 可
  それ以外                                           → 不可
```

- この判定をSQL関数ではなく**Goの単一の認可モジュールに集約**し、チャンネル・スレッド・メッセージ取得・ファイルURL発行・WebSocket購読のすべてが必ず通る構造にする（NFR-1）
- 一覧系クエリは同じ条件をWHERE句に埋め込んだsqlcクエリとして実装し、単体テストで認可モジュールと突き合わせる

## 未決事項

- メッセージ全文検索（将来）: PostgreSQLの`pg_trgm`で始め、規模が出たら外部検索エンジンを検討
