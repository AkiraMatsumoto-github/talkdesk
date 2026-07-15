// in-memory モックDB。シードデータ（日本語のリアルなデモデータ）と変更通知を持つ。

import type {
  AppNotification,
  Assignment,
  AuditLog,
  Channel,
  ChannelMember,
  Invitation,
  Message,
  Organization,
  Page,
  ReadState,
  Thread,
  User,
} from "../api/types";
import type { ApiEvent } from "../api/client";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = Date.now();

const ago = (ms: number) => new Date(now - ms).toISOString();
const dateStr = (offsetDays: number) => {
  const d = new Date(now + offsetDays * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** 添付画像プレビュー用のダミー画像（SVG data URL） */
export const sampleImage = (label: string, color: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="280"><rect width="480" height="280" fill="${color}"/><text x="240" y="148" font-family="sans-serif" font-size="22" fill="#fff" text-anchor="middle">${label}</text></svg>`,
  );

export interface Db {
  users: User[];
  orgs: Organization[];
  assignments: Assignment[];
  channels: Channel[];
  channelMembers: ChannelMember[];
  threads: Thread[];
  messages: Message[];
  pages: Page[];
  notifications: AppNotification[];
  invitations: Invitation[];
  auditLogs: AuditLog[];
  readStates: ReadState[];
}

export const db: Db = {
  orgs: [
    { id: "org-sample", name: "株式会社サンプル", initial: "サ", color: "#4f46e5" },
    { id: "org-hoge", name: "株式会社ホゲホゲ", initial: "ホ", color: "#0d9488" },
  ],
  users: [
    // アバター色はブランド（インディゴ／slate）に沿った寒色で統一。
    // サンプル社=インディゴ〜ブルー系 / ホゲホゲ社=ティール〜シアン系 / アシスタント=バイオレット〜パープル系 / 運営=slate
    { id: "u-sato", name: "佐藤 花子", email: "sato@sample.co.jp", role: "admin", orgId: "org-sample", color: "#4338ca" },
    { id: "u-suzuki", name: "鈴木 一郎", email: "suzuki@sample.co.jp", role: "member", orgId: "org-sample", color: "#6366f1" },
    { id: "u-takahashi", name: "高橋 美咲", email: "takahashi@sample.co.jp", role: "member", orgId: "org-sample", color: "#2563eb" },
    { id: "u-yamada", name: "山田 健太", email: "yamada@hogehoge.co.jp", role: "admin", orgId: "org-hoge", color: "#0d9488" },
    { id: "u-kobayashi", name: "小林 直子", email: "kobayashi@hogehoge.co.jp", role: "member", orgId: "org-hoge", color: "#0891b2" },
    { id: "u-tanaka", name: "田中 太郎", email: "tanaka@talkdesk.jp", role: "assistant", color: "#7c3aed" },
    { id: "u-ito", name: "伊藤 さくら", email: "ito@talkdesk.jp", role: "assistant", color: "#9333ea" },
    { id: "u-ops", name: "運営 太一", email: "ops@talkdesk.jp", role: "ops", color: "#475569" },
  ],
  assignments: [
    { assistantId: "u-tanaka", orgId: "org-sample" },
    { assistantId: "u-tanaka", orgId: "org-hoge" },
    { assistantId: "u-ito", orgId: "org-hoge" },
  ],
  channels: [
    { id: "ch-keihi", orgId: "org-sample", name: "経費精算", description: "毎月の経費精算・立替金の処理", archived: false },
    { id: "ch-kyuyo", orgId: "org-sample", name: "給与計算", description: "毎月の給与計算業務（機密）", archived: false },
    { id: "ch-seikyu", orgId: "org-sample", name: "請求書発行", description: "取引先への請求書発行・送付", archived: false },
    { id: "ch-bihin", orgId: "org-sample", name: "備品購入", description: "オフィス備品・消耗品の購買代行", archived: false },
    { id: "ch-nencho", orgId: "org-sample", name: "年末調整2025", description: "2025年の年末調整（完了済み）", archived: true },
    { id: "ch-hoge-keiri", orgId: "org-hoge", name: "経理業務", description: "記帳代行・月次締め", archived: false },
    { id: "ch-hoge-saiyo", orgId: "org-hoge", name: "採用サポート", description: "求人媒体の管理・応募者対応", archived: false },
  ],
  // 依頼者(member)の閲覧権限。管理者・アシスタントは全チャンネル閲覧可
  channelMembers: [
    { channelId: "ch-keihi", userId: "u-suzuki" },
    { channelId: "ch-kyuyo", userId: "u-suzuki" },
    { channelId: "ch-bihin", userId: "u-suzuki" },
    { channelId: "ch-keihi", userId: "u-takahashi" },
    { channelId: "ch-seikyu", userId: "u-takahashi" },
    { channelId: "ch-nencho", userId: "u-suzuki" },
    { channelId: "ch-hoge-keiri", userId: "u-kobayashi" },
  ],
  threads: [
    {
      id: "th-kyuyo-6", channelId: "ch-kyuyo", type: "request", title: "6月分給与計算",
      body: "6月分の給与計算をお願いします。対象は正社員12名＋アルバイト3名です。6/25締めの勤怠データを添付しますので、7/10までに計算結果の共有をお願いします。住民税が6月から新年度の税額に変わっている点にご注意ください。",
      dueDate: dateStr(1), status: "awaiting_review", createdBy: "u-sato", createdAt: ago(9 * DAY), updatedAt: ago(2 * HOUR),
    },
    {
      id: "th-juminzei", channelId: "ch-kyuyo", type: "request", title: "住民税の更新手続き",
      body: "6月からの住民税特別徴収税額の更新をお願いします。各市区町村から届いた決定通知書はスキャンして添付します。",
      dueDate: dateStr(-13), status: "in_progress", createdBy: "u-sato", createdAt: ago(20 * DAY), updatedAt: ago(1 * DAY),
    },
    {
      id: "th-kotsuhi", channelId: "ch-kyuyo", type: "topic", title: "交通費の質問",
      status: "open", createdBy: "u-suzuki", createdAt: ago(3 * DAY), updatedAt: ago(5 * HOUR),
    },
    {
      id: "th-kyuyo-5", channelId: "ch-kyuyo", type: "request", title: "5月分給与計算",
      body: "5月分の給与計算をお願いします。対象は正社員12名＋アルバイト3名です。",
      dueDate: dateStr(-34), status: "done", createdBy: "u-sato", createdAt: ago(40 * DAY), updatedAt: ago(33 * DAY),
    },
    {
      id: "th-kyuyo-4", channelId: "ch-kyuyo", type: "request", title: "4月分給与計算",
      body: "4月分の給与計算をお願いします。新入社員2名の初回給与が含まれます。",
      dueDate: dateStr(-64), status: "done", createdBy: "u-sato", createdAt: ago(70 * DAY), updatedAt: ago(63 * DAY),
    },
    {
      id: "th-keihi-6", channelId: "ch-keihi", type: "request", title: "6月分経費精算の処理",
      body: "6月分の経費精算をお願いします。領収書は経理フォルダにアップロード済みです。件数は約45件です。",
      dueDate: dateStr(6), status: "in_progress", createdBy: "u-suzuki", createdAt: ago(5 * DAY), updatedAt: ago(3 * HOUR),
    },
    {
      id: "th-ic", channelId: "ch-keihi", type: "topic", title: "ICカード読取エラーについて",
      status: "open", createdBy: "u-takahashi", createdAt: ago(2 * DAY), updatedAt: ago(26 * HOUR),
    },
    {
      id: "th-keihi-5", channelId: "ch-keihi", type: "request", title: "5月分経費精算の処理",
      body: "5月分の経費精算をお願いします。",
      dueDate: dateStr(-40), status: "done", createdBy: "u-suzuki", createdAt: ago(45 * DAY), updatedAt: ago(38 * DAY),
    },
    {
      id: "th-seikyu-7", channelId: "ch-seikyu", type: "request", title: "7月分請求書の発行",
      body: "7月分の請求書発行をお願いします。請求先リストを添付します。新規取引先が2社増えています（インボイス登録番号は確認済み）。",
      dueDate: dateStr(11), status: "open", createdBy: "u-sato", createdAt: ago(1 * DAY), updatedAt: ago(1 * DAY),
    },
    {
      id: "th-bihin-monitor", channelId: "ch-bihin", type: "request", title: "モニター3台の購入見積もり",
      body: "開発チーム用に27インチモニター3台の見積もりをお願いします。予算は1台5万円以内、4K対応が条件です。",
      dueDate: dateStr(3), status: "awaiting_review", createdBy: "u-sato", createdAt: ago(4 * DAY), updatedAt: ago(7 * HOUR),
    },
    {
      id: "th-nencho-1", channelId: "ch-nencho", type: "request", title: "2025年 年末調整の実施",
      body: "2025年の年末調整一式をお願いします。",
      dueDate: dateStr(-200), status: "done", createdBy: "u-sato", createdAt: ago(220 * DAY), updatedAt: ago(195 * DAY),
    },
    {
      id: "th-hoge-tsuki", channelId: "ch-hoge-keiri", type: "request", title: "6月度 月次締めと試算表の作成",
      body: "6月度の月次締めをお願いします。仕訳データは会計ソフトに入力済みです。試算表と前月比コメントをお願いします。",
      dueDate: dateStr(2), status: "in_progress", createdBy: "u-yamada", createdAt: ago(6 * DAY), updatedAt: ago(4 * HOUR),
    },
    {
      id: "th-hoge-ukeire", channelId: "ch-hoge-keiri", type: "topic", title: "新しい会計ソフトへの移行相談",
      status: "open", createdBy: "u-yamada", createdAt: ago(10 * DAY), updatedAt: ago(2 * DAY),
    },
    {
      id: "th-hoge-kyujin", channelId: "ch-hoge-saiyo", type: "request", title: "エンジニア求人票の更新",
      body: "求人媒体3社に掲載中のエンジニア求人票を新しい募集要項に更新してください。原稿を添付します。",
      dueDate: dateStr(4), status: "open", createdBy: "u-yamada", createdAt: ago(1 * DAY), updatedAt: ago(20 * HOUR),
    },
  ],
  messages: [
    // --- 6月分給与計算 ---
    {
      id: "m-k6-1", threadId: "th-kyuyo-6", authorId: "u-sato",
      body: "田中さん、今月もよろしくお願いします。勤怠データを添付します。 @田中 太郎",
      createdAt: ago(9 * DAY),
      attachments: [{ id: "a-kintai", name: "勤怠データ_2026-06.csv", size: 48_200 }],
      readBy: ["u-tanaka", "u-suzuki"],
    },
    {
      id: "m-k6-2", threadId: "th-kyuyo-6", authorId: "u-tanaka",
      body: "承知しました。勤怠データを確認して着手します。アルバイトの深夜手当の扱いは先月と同様でよろしいでしょうか？",
      createdAt: ago(9 * DAY - 2 * HOUR),
      attachments: [], readBy: ["u-sato", "u-suzuki"],
    },
    {
      id: "m-k6-3", threadId: "th-kyuyo-6", authorId: "u-sato",
      body: "はい、先月と同じ扱いでお願いします。",
      createdAt: ago(9 * DAY - 3 * HOUR),
      attachments: [], readBy: ["u-tanaka", "u-suzuki"],
    },
    {
      id: "m-k6-sys1", threadId: "th-kyuyo-6", authorId: "u-tanaka", system: true,
      body: "田中 太郎さんがステータスを「対応中」に変更しました",
      createdAt: ago(8 * DAY), attachments: [], readBy: [],
    },
    {
      id: "m-k6-4", threadId: "th-kyuyo-6", authorId: "u-tanaka",
      body: "6月分の給与計算が完了しました。給与一覧を添付しますのでご確認ください。\n住民税は6月からの新税額を反映済みです。1名（社員番号012）だけ普通徴収への切替がありました。",
      createdAt: ago(4 * HOUR),
      attachments: [
        { id: "a-kyuyo-list", name: "給与一覧_2026-06.xlsx", size: 1_258_291 },
        { id: "a-kyuyo-img", name: "住民税更新の確認画面.png", size: 214_500, imageDataUrl: sampleImage("住民税更新の確認画面", "#4f46e5") },
      ],
      readBy: ["u-sato", "u-suzuki"],
    },
    {
      id: "m-k6-sys2", threadId: "th-kyuyo-6", authorId: "u-tanaka", system: true,
      body: "田中 太郎さんがステータスを「確認待ち」に変更しました",
      createdAt: ago(4 * HOUR - 5 * MIN), attachments: [], readBy: [],
    },
    {
      id: "m-k6-5", threadId: "th-kyuyo-6", authorId: "u-sato",
      body: "ありがとうございます。内容を確認します。 @鈴木 一郎 さんもダブルチェックをお願いします。",
      createdAt: ago(2 * HOUR),
      attachments: [], readBy: ["u-tanaka"],
    },
    // --- 住民税の更新手続き（期日超過） ---
    {
      id: "m-j-1", threadId: "th-juminzei", authorId: "u-sato",
      body: "各市区町村の決定通知書をスキャンしました。世田谷区・横浜市・川崎市の3件です。",
      createdAt: ago(20 * DAY),
      attachments: [{ id: "a-juminzei", name: "住民税決定通知書_2026.pdf", size: 3_412_000 }],
      readBy: ["u-tanaka"],
    },
    {
      id: "m-j-sys1", threadId: "th-juminzei", authorId: "u-tanaka", system: true,
      body: "田中 太郎さんがステータスを「対応中」に変更しました",
      createdAt: ago(19 * DAY), attachments: [], readBy: [],
    },
    {
      id: "m-j-2", threadId: "th-juminzei", authorId: "u-tanaka",
      body: "横浜市の1名分だけ通知書の記載が不鮮明で税額が読み取れません。原本の再スキャンをお願いできますか？",
      createdAt: ago(1 * DAY),
      attachments: [], readBy: [],
    },
    // --- 交通費の質問（トピック） ---
    {
      id: "m-t-1", threadId: "th-kotsuhi", authorId: "u-suzuki",
      body: "新幹線の出張費は交通費と出張費のどちらで処理すべきでしょうか？領収書は原本が必要ですか？",
      createdAt: ago(3 * DAY),
      attachments: [], readBy: ["u-tanaka", "u-sato"],
    },
    {
      id: "m-t-2", threadId: "th-kotsuhi", authorId: "u-tanaka",
      body: "新幹線代は「旅費交通費」で処理します。領収書は電子データで問題ありません（電子帳簿保存法対応のため、むしろPDFでの提出をお願いしています）。",
      createdAt: ago(5 * HOUR),
      attachments: [], readBy: [],
    },
    // --- 5月分給与計算（完了） ---
    {
      id: "m-k5-1", threadId: "th-kyuyo-5", authorId: "u-tanaka",
      body: "5月分の給与計算が完了しました。ご確認ください。",
      createdAt: ago(34 * DAY),
      attachments: [{ id: "a-kyuyo-5", name: "給与一覧_2026-05.xlsx", size: 1_190_000 }],
      readBy: ["u-sato", "u-suzuki"],
    },
    {
      id: "m-k5-sys", threadId: "th-kyuyo-5", authorId: "u-sato", system: true,
      body: "佐藤 花子さんがステータスを「完了」に変更しました",
      createdAt: ago(33 * DAY), attachments: [], readBy: [],
    },
    // --- 4月分給与計算（完了） ---
    {
      id: "m-k4-1", threadId: "th-kyuyo-4", authorId: "u-tanaka",
      body: "4月分の給与計算が完了しました。新入社員2名の社会保険料は資格取得時決定の等級で計算しています。",
      createdAt: ago(64 * DAY),
      attachments: [{ id: "a-kyuyo-4", name: "給与一覧_2026-04.xlsx", size: 1_150_000 }],
      readBy: ["u-sato"],
    },
    {
      id: "m-k4-sys", threadId: "th-kyuyo-4", authorId: "u-sato", system: true,
      body: "佐藤 花子さんがステータスを「完了」に変更しました",
      createdAt: ago(63 * DAY), attachments: [], readBy: [],
    },
    // --- 6月分経費精算 ---
    {
      id: "m-e6-1", threadId: "th-keihi-6", authorId: "u-suzuki",
      body: "今月は接待費が多めです。5万円超のものが3件あるので、参加者名簿も添付しました。",
      createdAt: ago(5 * DAY),
      attachments: [{ id: "a-settai", name: "接待費参加者名簿_2026-06.xlsx", size: 22_100 }],
      readBy: ["u-tanaka", "u-sato"],
    },
    {
      id: "m-e6-sys1", threadId: "th-keihi-6", authorId: "u-tanaka", system: true,
      body: "田中 太郎さんがステータスを「対応中」に変更しました",
      createdAt: ago(4 * DAY), attachments: [], readBy: [],
    },
    {
      id: "m-e6-2", threadId: "th-keihi-6", authorId: "u-tanaka",
      body: "処理を進めています。1件だけ領収書の宛名が個人名になっているものがありました（7,800円・タクシー代）。会社宛の再発行は可能でしょうか？",
      createdAt: ago(3 * HOUR),
      attachments: [{ id: "a-ryoshusho", name: "宛名確認_領収書スキャン.png", size: 180_300, imageDataUrl: sampleImage("領収書スキャン", "#0d9488") }],
      readBy: [],
    },
    // --- ICカード読取エラー ---
    {
      id: "m-ic-1", threadId: "th-ic", authorId: "u-takahashi",
      body: "経費精算システムでSuicaの読み取りがエラーになります。「カード残高が取得できません」と表示されます。",
      createdAt: ago(2 * DAY),
      attachments: [], readBy: ["u-tanaka"],
    },
    {
      id: "m-ic-2", threadId: "th-ic", authorId: "u-tanaka",
      body: "モバイルSuicaのバージョンが古い可能性があります。アプリを最新版に更新してから再度お試しください。改善しない場合は利用履歴の画面キャプチャでも代替できます。",
      createdAt: ago(26 * HOUR),
      attachments: [], readBy: ["u-takahashi"],
    },
    // --- 5月分経費精算（完了） ---
    {
      id: "m-e5-1", threadId: "th-keihi-5", authorId: "u-tanaka",
      body: "5月分の経費精算、全42件の処理が完了しました。",
      createdAt: ago(39 * DAY),
      attachments: [{ id: "a-keihi-5", name: "経費精算一覧_2026-05.xlsx", size: 890_000 }],
      readBy: ["u-suzuki", "u-sato"],
    },
    {
      id: "m-e5-sys", threadId: "th-keihi-5", authorId: "u-suzuki", system: true,
      body: "鈴木 一郎さんがステータスを「完了」に変更しました",
      createdAt: ago(38 * DAY), attachments: [], readBy: [],
    },
    // --- 7月分請求書 ---
    {
      id: "m-s7-1", threadId: "th-seikyu-7", authorId: "u-sato",
      body: "請求先リストを添付します。新規2社の締め支払条件は備考欄に記載しています。",
      createdAt: ago(1 * DAY),
      attachments: [{ id: "a-seikyu-list", name: "請求先リスト_2026-07.xlsx", size: 35_600 }],
      readBy: [],
    },
    // --- モニター見積もり ---
    {
      id: "m-b-1", threadId: "th-bihin-monitor", authorId: "u-tanaka",
      body: "3社から見積もりを取得しました。比較表を添付します。おすすめはB社のDell U2723QE（47,800円/台・翌日配送）です。",
      createdAt: ago(7 * HOUR),
      attachments: [{ id: "a-mitsumori", name: "モニター見積比較_3社.pdf", size: 412_000 }],
      readBy: ["u-sato"],
    },
    {
      id: "m-b-sys1", threadId: "th-bihin-monitor", authorId: "u-tanaka", system: true,
      body: "田中 太郎さんがステータスを「確認待ち」に変更しました",
      createdAt: ago(7 * HOUR + 2 * MIN), attachments: [], readBy: [],
    },
    // --- 年末調整（アーカイブ済みチャンネル） ---
    {
      id: "m-n-1", threadId: "th-nencho-1", authorId: "u-tanaka",
      body: "2025年の年末調整、全員分の処理が完了しました。源泉徴収票を添付します。",
      createdAt: ago(196 * DAY),
      attachments: [{ id: "a-nencho", name: "源泉徴収票_2025_一式.pdf", size: 5_800_000 }],
      readBy: ["u-sato", "u-suzuki"],
    },
    // --- ホゲホゲ: 月次締め ---
    {
      id: "m-h1-1", threadId: "th-hoge-tsuki", authorId: "u-yamada",
      body: "6月度の仕訳入力が完了しました。月次締めをお願いします。",
      createdAt: ago(6 * DAY),
      attachments: [], readBy: ["u-tanaka", "u-ito"],
    },
    {
      id: "m-h1-sys", threadId: "th-hoge-tsuki", authorId: "u-ito", system: true,
      body: "伊藤 さくらさんがステータスを「対応中」に変更しました",
      createdAt: ago(5 * DAY), attachments: [], readBy: [],
    },
    {
      id: "m-h1-2", threadId: "th-hoge-tsuki", authorId: "u-ito",
      body: "締め処理を進めています。売掛金の消込で1件不一致があります（株式会社ABC商事・差額12,000円）。入金明細の確認をお願いできますか？",
      createdAt: ago(4 * HOUR),
      attachments: [], readBy: [],
    },
    // --- ホゲホゲ: 会計ソフト移行 ---
    {
      id: "m-h2-1", threadId: "th-hoge-ukeire", authorId: "u-yamada",
      body: "freeeからマネーフォワードへの移行を検討しています。移行の工数感を教えてください。",
      createdAt: ago(10 * DAY),
      attachments: [], readBy: ["u-ito", "u-tanaka"],
    },
    {
      id: "m-h2-2", threadId: "th-hoge-ukeire", authorId: "u-ito",
      body: "期首での移行がおすすめです。仕訳データの移行自体は2〜3営業日、口座連携の再設定を含めると1週間程度を見込んでください。",
      createdAt: ago(2 * DAY),
      attachments: [], readBy: ["u-yamada"],
    },
    // --- ホゲホゲ: 求人票 ---
    {
      id: "m-h3-1", threadId: "th-hoge-kyujin", authorId: "u-yamada",
      body: "新しい募集要項の原稿を添付します。年収レンジが変わっているのでご注意ください。",
      createdAt: ago(1 * DAY),
      attachments: [{ id: "a-kyujin", name: "エンジニア募集要項_v3.docx", size: 88_000 }],
      readBy: ["u-ito"],
    },
  ],
  pages: [
    {
      id: "pg-kyuyo-tejun", channelId: "ch-kyuyo", title: "給与計算の手順", rev: 3,
      updatedBy: "u-tanaka", updatedAt: ago(4 * DAY),
      body: `## 毎月のスケジュール

| 日付 | 作業 | 担当 |
|---|---|---|
| 毎月25日 | 勤怠データのエクスポート | 依頼者 |
| 26〜月末 | 給与計算・チェック | アシスタント |
| 翌月10日 | 計算結果の報告・確認依頼 | アシスタント |
| 翌月15日 | 振込データ作成 | 依頼者 |

## 手順

1. 勤怠システムから当月分のCSVをエクスポートする
2. 控除項目を確認する（**住民税は6月に新年度税額へ更新**）
3. 残業時間の集計値を前月と比較し、大きな乖離があれば依頼者に確認する
4. 計算結果を依頼スレッドに添付して報告する

## チェックリスト

- [ ] 勤怠データの人数が在籍者数と一致しているか
- [ ] 入退社者の日割り計算
- [ ] 社会保険料の等級変更（4月・随時改定）
- [ ] 住民税の税額（6月切替）

## 注意事項

> 給与情報は機密情報です。このチャンネル以外への転載・共有は禁止です。`,
      revisions: [
        {
          rev: 1, title: "給与計算の手順", authorId: "u-tanaka", savedAt: ago(60 * DAY),
          body: "## 手順\n\n1. 勤怠データをエクスポートする\n2. 給与計算を行う\n3. 結果を報告する",
        },
        {
          rev: 2, title: "給与計算の手順", authorId: "u-sato", savedAt: ago(20 * DAY),
          body: "## 手順\n\n1. 毎月25日までに勤怠データをエクスポートする\n2. 控除項目を確認する（住民税は6月に更新）\n3. 計算結果を依頼スレッドに添付して報告する\n\n## 注意事項\n\n> 給与情報は機密情報です。取り扱いに注意してください。",
        },
      ],
    },
    {
      id: "pg-kintai-login", channelId: "ch-kyuyo", title: "勤怠システムのログイン方法", rev: 1,
      updatedBy: "u-sato", updatedAt: ago(16 * DAY),
      body: `## キングオブタイム ログイン情報

- URL: https://example.kingtime.jp/admin
- ID: \`talkdesk-op\`
- パスワード: 別途1Passwordで共有済み

## エクスポート手順

1. 「日別データ」→「エクスポート」を選択
2. 出力形式は **CSV（Shift_JIS）** を選択
3. 対象期間を当月の1日〜末日に設定`,
      revisions: [],
    },
    {
      id: "pg-keihi-rule", channelId: "ch-keihi", title: "経費精算のルール", rev: 2,
      updatedBy: "u-tanaka", updatedAt: ago(8 * DAY),
      body: `## 提出期限

毎月**5営業日目**までに前月分を提出

## 領収書の要件

- 電子データ（PDF/画像）でOK
- 宛名は必ず会社名（株式会社サンプル）で取得する
- 5万円超の接待費は参加者名簿を添付する

## 勘定科目の早見表

| 内容 | 科目 |
|---|---|
| 電車・バス・タクシー | 旅費交通費 |
| 取引先との会食 | 接待交際費 |
| 社内の懇親会 | 福利厚生費 |
| 書籍・セミナー | 研修費 |`,
      revisions: [
        {
          rev: 1, title: "経費精算のルール", authorId: "u-tanaka", savedAt: ago(30 * DAY),
          body: "## 提出期限\n\n毎月5営業日目までに前月分を提出\n\n## 領収書の要件\n\n- 電子データ（PDF/画像）でOK",
        },
      ],
    },
    {
      id: "pg-hoge-getsuji", channelId: "ch-hoge-keiri", title: "月次締めチェックリスト", rev: 1,
      updatedBy: "u-ito", updatedAt: ago(12 * DAY),
      body: `## 月次締めチェックリスト\n\n- [ ] 現金・預金残高の照合\n- [ ] 売掛金の消込\n- [ ] 買掛金の計上漏れ確認\n- [ ] 経過勘定（前払・未払）の計上\n- [ ] 試算表の前月比レビュー`,
      revisions: [],
    },
  ],
  notifications: [
    {
      id: "nt-1", userId: "u-suzuki", kind: "mention",
      text: "佐藤 花子さんがあなたをメンションしました: 「鈴木 一郎 さんもダブルチェックをお願いします」",
      orgId: "org-sample", channelId: "ch-kyuyo", threadId: "th-kyuyo-6", read: false, createdAt: ago(2 * HOUR),
    },
    {
      id: "nt-2", userId: "u-sato", kind: "status",
      text: "「6月分給与計算」のステータスが「確認待ち」になりました",
      orgId: "org-sample", channelId: "ch-kyuyo", threadId: "th-kyuyo-6", read: false, createdAt: ago(4 * HOUR),
    },
    {
      id: "nt-3", userId: "u-sato", kind: "due",
      text: "「住民税の更新手続き」が期日を超過しています",
      orgId: "org-sample", channelId: "ch-kyuyo", threadId: "th-juminzei", read: false, createdAt: ago(10 * HOUR),
    },
    {
      id: "nt-4", userId: "u-tanaka", kind: "message",
      text: "#経費精算 に新着メッセージがあります",
      orgId: "org-sample", channelId: "ch-keihi", threadId: "th-keihi-6", read: true, createdAt: ago(5 * DAY),
    },
    {
      id: "nt-5", userId: "u-tanaka", kind: "due",
      text: "「住民税の更新手続き」が期日を超過しています",
      orgId: "org-sample", channelId: "ch-kyuyo", threadId: "th-juminzei", read: false, createdAt: ago(10 * HOUR),
    },
  ],
  invitations: [
    { id: "inv-1", orgId: "org-sample", email: "watanabe@sample.co.jp", role: "member", invitedAt: ago(2 * DAY) },
  ],
  auditLogs: [
    { id: "al-1", orgId: "org-sample", actorId: "u-sato", action: "権限変更", detail: "高橋 美咲 に #請求書発行 の閲覧権限を付与", createdAt: ago(15 * DAY) },
    { id: "al-2", orgId: "org-sample", actorId: "u-sato", action: "メンバー招待", detail: "watanabe@sample.co.jp を member として招待", createdAt: ago(2 * DAY) },
    { id: "al-3", orgId: "org-sample", actorId: "u-ops", action: "運営閲覧", detail: "運営管理者が #給与計算 を閲覧", createdAt: ago(6 * DAY) },
    { id: "al-4", orgId: "org-hoge", actorId: "u-ops", action: "アサイン", detail: "伊藤 さくら を 株式会社ホゲホゲ にアサイン", createdAt: ago(30 * DAY) },
  ],
  readStates: [
    // 鈴木: 6月分給与計算はメンションより前まで既読（「ここから未読」ラインのデモ）
    { userId: "u-suzuki", threadId: "th-kyuyo-6", lastReadMessageId: "m-k6-sys2" },
    { userId: "u-suzuki", threadId: "th-kotsuhi", lastReadMessageId: "m-t-1" },
    { userId: "u-suzuki", threadId: "th-keihi-6", lastReadMessageId: "m-e6-sys1" },
    { userId: "u-suzuki", threadId: "th-kyuyo-5", lastReadMessageId: "m-k5-sys" },
    { userId: "u-suzuki", threadId: "th-keihi-5", lastReadMessageId: "m-e5-sys" },
    { userId: "u-suzuki", threadId: "th-nencho-1", lastReadMessageId: "m-n-1" },
    // 佐藤: 住民税スレッドの新着と経費が未読
    { userId: "u-sato", threadId: "th-kyuyo-6", lastReadMessageId: "m-k6-5" },
    { userId: "u-sato", threadId: "th-juminzei", lastReadMessageId: "m-j-sys1" },
    { userId: "u-sato", threadId: "th-kotsuhi", lastReadMessageId: "m-t-1" },
    { userId: "u-sato", threadId: "th-keihi-6", lastReadMessageId: "m-e6-1" },
    { userId: "u-sato", threadId: "th-bihin-monitor", lastReadMessageId: "m-b-1" },
    { userId: "u-sato", threadId: "th-kyuyo-5", lastReadMessageId: "m-k5-sys" },
    { userId: "u-sato", threadId: "th-kyuyo-4", lastReadMessageId: "m-k4-sys" },
    { userId: "u-sato", threadId: "th-keihi-5", lastReadMessageId: "m-e5-sys" },
    { userId: "u-sato", threadId: "th-seikyu-7", lastReadMessageId: "m-s7-1" },
    { userId: "u-sato", threadId: "th-nencho-1", lastReadMessageId: "m-n-1" },
    // 高橋
    { userId: "u-takahashi", threadId: "th-ic", lastReadMessageId: "m-ic-2" },
    // 田中（アシスタント）: 経費の返信待ち・サンプル社はだいたい既読、ホゲホゲに未読
    { userId: "u-tanaka", threadId: "th-kyuyo-6", lastReadMessageId: "m-k6-5" },
    { userId: "u-tanaka", threadId: "th-juminzei", lastReadMessageId: "m-j-2" },
    { userId: "u-tanaka", threadId: "th-kotsuhi", lastReadMessageId: "m-t-2" },
    { userId: "u-tanaka", threadId: "th-keihi-6", lastReadMessageId: "m-e6-2" },
    { userId: "u-tanaka", threadId: "th-ic", lastReadMessageId: "m-ic-2" },
    { userId: "u-tanaka", threadId: "th-kyuyo-5", lastReadMessageId: "m-k5-sys" },
    { userId: "u-tanaka", threadId: "th-kyuyo-4", lastReadMessageId: "m-k4-sys" },
    { userId: "u-tanaka", threadId: "th-keihi-5", lastReadMessageId: "m-e5-sys" },
    { userId: "u-tanaka", threadId: "th-bihin-monitor", lastReadMessageId: "m-b-sys1" },
    { userId: "u-tanaka", threadId: "th-nencho-1", lastReadMessageId: "m-n-1" },
    { userId: "u-tanaka", threadId: "th-hoge-ukeire", lastReadMessageId: "m-h2-2" },
    // 山田・小林・伊藤
    { userId: "u-yamada", threadId: "th-hoge-tsuki", lastReadMessageId: "m-h1-sys" },
    { userId: "u-yamada", threadId: "th-hoge-ukeire", lastReadMessageId: "m-h2-2" },
    { userId: "u-yamada", threadId: "th-hoge-kyujin", lastReadMessageId: "m-h3-1" },
    { userId: "u-ito", threadId: "th-hoge-tsuki", lastReadMessageId: "m-h1-2" },
    { userId: "u-ito", threadId: "th-hoge-ukeire", lastReadMessageId: "m-h2-2" },
    { userId: "u-ito", threadId: "th-hoge-kyujin", lastReadMessageId: "m-h3-1" },
  ],
};

// ---- 変更通知（WebSocket相当のファンアウト） ----

type Listener = (ev: ApiEvent) => void;
const listeners = new Set<Listener>();

export function subscribeDb(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notify(ev: ApiEvent = { type: "change" }) {
  for (const l of [...listeners]) l(ev);
}

let seq = 0;
export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
}
