// デモ用: 一定間隔で「相手からの新着メッセージ」を注入し、
// リアルタイム受信（トースト・未読バッジ・一覧の並び替え）を体験できるようにする。

import type { Attachment } from "../api/types";
import { db, genId, notify } from "./db";
import { canViewChannel } from "./mockApi";

interface Script {
  threadId: string;
  authorId: string;
  body: string;
  attachments?: Attachment[];
}

// 依頼者側でログインしているとき: アシスタントからの新着
const clientScripts: Script[] = [
  {
    threadId: "th-keihi-6",
    authorId: "u-tanaka",
    body: "経費精算の処理、残り10件まで進みました。本日中に完了見込みです。",
  },
  {
    threadId: "th-kotsuhi",
    authorId: "u-tanaka",
    body: "補足です。タクシー利用は3,000円を超える場合のみ利用理由の記載をお願いしています。",
  },
  {
    threadId: "th-seikyu-7",
    authorId: "u-tanaka",
    body: "請求先リストを確認しました。新規2社の請求書フォーマットは既存と同じで問題なさそうです。",
  },
];

// アシスタントでログインしているとき: 依頼者からの新着
const assistantScripts: Script[] = [
  {
    threadId: "th-juminzei",
    authorId: "u-sato",
    body: "横浜市の通知書、再スキャンしました。こちらで読み取れますでしょうか。",
    attachments: [{ id: genId("a"), name: "住民税決定通知書_横浜市_再スキャン.pdf", size: 820_000 }],
  },
  {
    threadId: "th-hoge-tsuki",
    authorId: "u-yamada",
    body: "ABC商事の入金明細を確認しました。差額は振込手数料でした。雑費で処理してください。",
  },
  {
    threadId: "th-kyuyo-6",
    authorId: "u-suzuki",
    body: "ダブルチェックしました。問題ありません。",
  },
];

export function startDemoFeed(getUserId: () => string | undefined): () => void {
  let i = 0;
  const timer = setInterval(() => {
    const userId = getUserId();
    if (!userId) return;
    const me = db.users.find((u) => u.id === userId);
    if (!me || me.role === "ops") return;
    const scripts = me.role === "assistant" ? assistantScripts : clientScripts;
    if (i >= scripts.length) {
      clearInterval(timer);
      return;
    }
    const s = scripts[i++];
    const th = db.threads.find((t) => t.id === s.threadId);
    const ch = th && db.channels.find((c) => c.id === th.channelId);
    if (!th || !ch) return;
    const msg = {
      id: genId("m"),
      threadId: s.threadId,
      authorId: s.authorId,
      body: s.body,
      createdAt: new Date().toISOString(),
      attachments: s.attachments ?? [],
      readBy: [],
    };
    db.messages.push(msg);
    th.updatedAt = msg.createdAt;
    // 通知は現在ユーザーが閲覧権限を持つチャンネルの場合のみ積む（CH-2/FR-H1/ROUTE-2）
    if (canViewChannel(me, ch)) {
      db.notifications.unshift({
        id: genId("nt"),
        userId,
        kind: "message",
        text: `#${ch.name} に新着メッセージがあります`,
        orgId: ch.orgId,
        channelId: ch.id,
        threadId: th.id,
        read: false,
        createdAt: msg.createdAt,
      });
    }
    notify({ type: "message", message: msg, channelId: ch.id, orgId: ch.orgId });
  }, 40_000);
  return () => clearInterval(timer);
}
