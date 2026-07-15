// TalkdeskApi の in-memory モック実装。
// 実API接続時は src/api/index.ts で REST/WebSocket 実装に差し替える。

import type {
  ApiEvent,
  ChannelUnread,
  FileEntry,
  NewThreadInput,
  PermissionChange,
  TalkdeskApi,
} from "../api/client";
import type {
  AppNotification,
  Attachment,
  Channel,
  Message,
  Organization,
  Thread,
  ThreadStatus,
  User,
} from "../api/types";
import { db, genId, notify, subscribeDb } from "./db";

const delay = (ms = 120) => new Promise<void>((r) => setTimeout(r, ms));

export const STATUS_LABEL: Record<ThreadStatus, string> = {
  open: "依頼中",
  in_progress: "対応中",
  awaiting_review: "確認待ち",
  done: "完了",
};

// ---- 権限ヘルパー ----

export function canViewChannel(user: User, channel: Channel): boolean {
  if (user.disabled) return false;
  switch (user.role) {
    case "ops":
      return true;
    case "assistant":
      return db.assignments.some((a) => a.assistantId === user.id && a.orgId === channel.orgId);
    case "admin":
      return user.orgId === channel.orgId;
    case "member":
      return (
        user.orgId === channel.orgId &&
        db.channelMembers.some((cm) => cm.channelId === channel.id && cm.userId === user.id)
      );
  }
}

function threadMessages(threadId: string): Message[] {
  return db.messages.filter((m) => m.threadId === threadId);
}

function unreadOfThread(userId: string, threadId: string): { count: number; mention: boolean } {
  const user = db.users.find((u) => u.id === userId);
  const msgs = threadMessages(threadId);
  const rs = db.readStates.find((r) => r.userId === userId && r.threadId === threadId);
  const lastIdx = rs?.lastReadMessageId ? msgs.findIndex((m) => m.id === rs.lastReadMessageId) : -1;
  const unread = msgs.slice(lastIdx + 1).filter((m) => m.authorId !== userId && !m.deleted);
  const mention = !!user && unread.some((m) => !m.system && m.body.includes(`@${user.name}`));
  return { count: unread.filter((m) => !m.system).length, mention };
}

/** FR-H7: 自分の投稿のみ・24時間以内（API層のenforce契約をモックにも持たせる） */
function assertOwnRecentMessage(m: Message, byUserId: string, op: string) {
  if (m.authorId !== byUserId) throw new Error(`自分の投稿以外は${op}できません`);
  if (Date.now() - new Date(m.createdAt).getTime() >= 24 * 60 * 60 * 1000) {
    throw new Error(`投稿から24時間を超えたため${op}できません`);
  }
}

/** FR-T2: ロール別のステータス遷移制約 */
const STATUS_TRANSITIONS: Record<"assistant" | "client", [ThreadStatus, ThreadStatus][]> = {
  assistant: [
    ["open", "in_progress"],
    ["in_progress", "awaiting_review"],
  ],
  client: [
    ["awaiting_review", "done"],
    ["awaiting_review", "in_progress"],
  ],
};

function assertStatusTransition(actor: User, from: ThreadStatus, to: ThreadStatus) {
  const side = actor.role === "assistant" ? "assistant" : actor.role === "member" || actor.role === "admin" ? "client" : null;
  if (!side || !STATUS_TRANSITIONS[side].some(([f, t]) => f === from && t === to)) {
    throw new Error(`「${STATUS_LABEL[from]}」から「${STATUS_LABEL[to]}」への変更は許可されていません`);
  }
}

function addAudit(actorId: string, action: string, detail: string, orgId?: string) {
  db.auditLogs.unshift({ id: genId("al"), actorId, action, detail, orgId, createdAt: new Date().toISOString() });
}

function addSystemMessage(threadId: string, authorId: string, body: string): Message {
  const msg: Message = {
    id: genId("m"),
    threadId,
    authorId,
    body,
    system: true,
    createdAt: new Date().toISOString(),
    attachments: [],
    readBy: [],
  };
  db.messages.push(msg);
  return msg;
}

function pushNotification(n: Omit<AppNotification, "id" | "read" | "createdAt">) {
  const notification: AppNotification = { ...n, id: genId("nt"), read: false, createdAt: new Date().toISOString() };
  db.notifications.unshift(notification);
  notify({ type: "notification", notification });
}

function touchThread(threadId: string) {
  const th = db.threads.find((t) => t.id === threadId);
  if (th) th.updatedAt = new Date().toISOString();
}

function advanceReadState(userId: string, threadId: string) {
  const msgs = threadMessages(threadId);
  const last = msgs[msgs.length - 1];
  if (!last) return;
  const rs = db.readStates.find((r) => r.userId === userId && r.threadId === threadId);
  if (rs) rs.lastReadMessageId = last.id;
  else db.readStates.push({ userId, threadId, lastReadMessageId: last.id });
}

// ---- 実装 ----

export const mockApi: TalkdeskApi = {
  // 認証
  async listDemoUsers() {
    await delay(60);
    return db.users.filter((u) => ["u-suzuki", "u-sato", "u-tanaka", "u-ops"].includes(u.id));
  },
  async login(email, password) {
    await delay(500);
    const user = db.users.find((u) => u.email === email && !u.disabled);
    if (!user || !password) throw new Error("メールアドレスまたはパスワードが正しくありません");
    return user;
  },
  async getUser(id) {
    return db.users.find((u) => u.id === id);
  },
  async updateProfile(userId, patch) {
    await delay();
    const u = db.users.find((x) => x.id === userId);
    if (!u) throw new Error("ユーザーが見つかりません");
    if (patch.name !== undefined) u.name = patch.name;
    if (patch.color !== undefined) u.color = patch.color;
    if (patch.avatarUrl !== undefined) u.avatarUrl = patch.avatarUrl;
    notify({ type: "change" });
    return u;
  },

  // 企業
  async getOrg(orgId) {
    return db.orgs.find((o) => o.id === orgId);
  },
  async listOrgs() {
    await delay();
    return [...db.orgs];
  },
  async listAssignedOrgs(assistantId) {
    const ids = db.assignments.filter((a) => a.assistantId === assistantId).map((a) => a.orgId);
    return db.orgs.filter((o) => ids.includes(o.id));
  },
  async listAssignments() {
    return [...db.assignments];
  },
  async listAssistants() {
    await delay();
    return db.users.filter((u) => u.role === "assistant");
  },

  // チャンネル
  async listVisibleChannels(userId, orgId) {
    await delay();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return [];
    return db.channels
      .filter((c) => c.orgId === orgId && canViewChannel(user, c))
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));
  },
  async getChannel(id) {
    return db.channels.find((c) => c.id === id);
  },
  async createChannel(orgId, name, description, byUserId) {
    await delay();
    const ch: Channel = { id: genId("ch"), orgId, name, description, archived: false };
    db.channels.push(ch);
    const actor = db.users.find((u) => u.id === byUserId);
    // 作成者がmember扱いになることはない（管理者/アシスタントのみ作成可）が、念のため付与
    if (actor?.role === "member") db.channelMembers.push({ channelId: ch.id, userId: byUserId });
    addAudit(byUserId, "チャンネル作成", `#${name} を作成`, orgId);
    notify({ type: "change" });
    return ch;
  },
  async listChannelViewers(channelId) {
    const ch = db.channels.find((c) => c.id === channelId);
    if (!ch) return [];
    return db.users.filter((u) => u.role !== "ops" && !u.disabled && canViewChannel(u, ch));
  },

  // スレッド
  async listThreads(channelId) {
    await delay();
    return db.threads
      .filter((t) => t.channelId === channelId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async getThread(id) {
    return db.threads.find((t) => t.id === id);
  },
  async createThread(channelId, input: NewThreadInput, byUserId) {
    await delay();
    const nowIso = new Date().toISOString();
    const th: Thread = {
      id: genId("th"),
      channelId,
      type: input.type,
      title: input.title,
      body: input.type === "request" ? input.body : undefined,
      dueDate: input.type === "request" ? input.dueDate : undefined,
      status: "open",
      createdBy: byUserId,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    db.threads.push(th);
    notify({ type: "change" });
    return th;
  },
  async changeStatus(threadId, status, byUserId) {
    await delay();
    const th = db.threads.find((t) => t.id === threadId);
    const actor = db.users.find((u) => u.id === byUserId);
    if (!th || !actor) return;
    assertStatusTransition(actor, th.status, status);
    th.status = status;
    addSystemMessage(threadId, byUserId, `${actor.name}さんがステータスを「${STATUS_LABEL[status]}」に変更しました`);
    touchThread(threadId);
    advanceReadState(byUserId, threadId);
    const ch = db.channels.find((c) => c.id === th.channelId);
    // 依頼の作成者と担当アシスタントに通知（操作者以外）
    const targets = new Set<string>([th.createdBy]);
    if (ch) {
      db.assignments.filter((a) => a.orgId === ch.orgId).forEach((a) => targets.add(a.assistantId));
    }
    targets.delete(byUserId);
    for (const userId of targets) {
      pushNotification({
        userId,
        kind: "status",
        text: `「${th.title}」のステータスが「${STATUS_LABEL[status]}」になりました`,
        orgId: ch?.orgId ?? "",
        channelId: th.channelId,
        threadId,
      });
    }
    notify({ type: "change" });
  },
  async changeDueDate(threadId, dueDate, byUserId) {
    await delay();
    const th = db.threads.find((t) => t.id === threadId);
    const actor = db.users.find((u) => u.id === byUserId);
    if (!th || !actor) return;
    th.dueDate = dueDate;
    const label = dueDate ? dueDate.replace(/^\d+-0?(\d+)-0?(\d+)$/, "$1/$2") : "なし";
    addSystemMessage(threadId, byUserId, `${actor.name}さんが期日を「${label}」に変更しました`);
    touchThread(threadId);
    advanceReadState(byUserId, threadId);
    notify({ type: "change" });
  },
  async listMessages(threadId) {
    await delay();
    return threadMessages(threadId);
  },
  async postMessage(threadId, body, attachments: Attachment[], byUserId) {
    await delay(250);
    const msg: Message = {
      id: genId("m"),
      threadId,
      authorId: byUserId,
      body,
      createdAt: new Date().toISOString(),
      attachments,
      readBy: [],
    };
    db.messages.push(msg);
    touchThread(threadId);
    advanceReadState(byUserId, threadId);
    const th = db.threads.find((t) => t.id === threadId);
    const ch = th && db.channels.find((c) => c.id === th.channelId);
    // メンション通知
    if (th && ch) {
      const viewers = await this.listChannelViewers(th.channelId);
      for (const v of viewers) {
        if (v.id !== byUserId && body.includes(`@${v.name}`)) {
          const actor = db.users.find((u) => u.id === byUserId);
          pushNotification({
            userId: v.id,
            kind: "mention",
            text: `${actor?.name}さんがあなたをメンションしました（#${ch.name}）`,
            orgId: ch.orgId,
            channelId: ch.id,
            threadId,
          });
        }
      }
      notify({ type: "message", message: msg, channelId: ch.id, orgId: ch.orgId });
    }
    return msg;
  },
  async editMessage(messageId, body, byUserId) {
    await delay();
    const m = db.messages.find((x) => x.id === messageId);
    if (!m) return;
    assertOwnRecentMessage(m, byUserId, "編集");
    m.body = body;
    m.editedAt = new Date().toISOString();
    notify({ type: "change" });
  },
  async deleteMessage(messageId, byUserId) {
    await delay();
    const m = db.messages.find((x) => x.id === messageId);
    if (!m) return;
    assertOwnRecentMessage(m, byUserId, "削除");
    m.deleted = true;
    m.body = "";
    m.attachments = [];
    notify({ type: "change" });
  },

  // 未読
  async getChannelUnreads(userId, orgId) {
    const channels = await this.listVisibleChannels(userId, orgId);
    return channels.map((c) => {
      let count = 0;
      let mention = false;
      for (const t of db.threads.filter((t) => t.channelId === c.id)) {
        const u = unreadOfThread(userId, t.id);
        count += u.count;
        mention = mention || u.mention;
      }
      return { channelId: c.id, count, mention };
    });
  },
  async getThreadUnreadCount(userId, threadId) {
    return unreadOfThread(userId, threadId).count;
  },
  async getFirstUnreadMessageId(userId, threadId) {
    const msgs = threadMessages(threadId);
    const rs = db.readStates.find((r) => r.userId === userId && r.threadId === threadId);
    const lastIdx = rs?.lastReadMessageId ? msgs.findIndex((m) => m.id === rs.lastReadMessageId) : -1;
    // 未読カウント（unreadOfThread）と同じ条件: 他者の通常メッセージのみ
    return msgs.slice(lastIdx + 1).find((m) => m.authorId !== userId && !m.system && !m.deleted)?.id;
  },
  async markThreadRead(userId, threadId) {
    advanceReadState(userId, threadId);
    // 既読カーソル送信（FR-H4/H5）: 他者メッセージに既読者として記録
    for (const m of threadMessages(threadId)) {
      if (m.authorId !== userId && !m.system && !m.readBy.includes(userId)) m.readBy.push(userId);
    }
    notify({ type: "change" });
  },
  async getOrgUnreads(assistantId) {
    const orgs = await this.listAssignedOrgs(assistantId);
    const result: ChannelUnread[] = [];
    for (const org of orgs) {
      const unreads = await this.getChannelUnreads(assistantId, org.id);
      result.push({
        channelId: org.id, // 企業単位の集計（channelIdフィールドをorgIdとして流用）
        count: unreads.reduce((s, u) => s + u.count, 0),
        mention: unreads.some((u) => u.mention),
      });
    }
    return result;
  },

  // ファイル
  async listFiles(channelId) {
    await delay();
    const threads = db.threads.filter((t) => t.channelId === channelId);
    const entries: FileEntry[] = [];
    for (const t of threads) {
      for (const m of threadMessages(t.id)) {
        if (m.deleted) continue; // 削除済みメッセージの添付は表示しない（FILE-3）
        for (const a of m.attachments) {
          entries.push({ attachment: a, message: m, thread: t, uploadedBy: m.authorId, uploadedAt: m.createdAt });
        }
      }
    }
    return entries.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  },
  async requestDownloadUrl(attachmentId) {
    await delay(300);
    return `https://storage.example.com/talkdesk/${attachmentId}?X-Signature=mock&expires=600`;
  },

  // ナレッジ
  async listPages(channelId) {
    await delay();
    return db.pages
      .filter((p) => p.channelId === channelId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async getPage(id) {
    return db.pages.find((p) => p.id === id);
  },
  async createPage(channelId, title, body, byUserId) {
    await delay();
    const page = {
      id: genId("pg"),
      channelId,
      title,
      body,
      rev: 1,
      updatedBy: byUserId,
      updatedAt: new Date().toISOString(),
      revisions: [],
    };
    db.pages.push(page);
    notify({ type: "change" });
    return page;
  },
  async savePage(pageId, title, body, byUserId) {
    await delay();
    const p = db.pages.find((x) => x.id === pageId);
    if (!p) return;
    p.revisions.push({ rev: p.rev, title: p.title, body: p.body, authorId: p.updatedBy, savedAt: p.updatedAt });
    p.title = title;
    p.body = body;
    p.rev += 1;
    p.updatedBy = byUserId;
    p.updatedAt = new Date().toISOString();
    notify({ type: "change" });
  },
  async restoreRevision(pageId, rev, byUserId) {
    const p = db.pages.find((x) => x.id === pageId);
    const r = p?.revisions.find((x) => x.rev === rev);
    if (!p || !r) return;
    await this.savePage(pageId, r.title, r.body, byUserId);
  },

  // 通知
  async listNotifications(userId) {
    await delay(60);
    // SHELL-3 / NOTIF-1: 通知センターには「メンション・担当依頼のステータス変更・期日超過」のみ。
    // 一般の新着メッセージ（kind:"message"）は画面内トースト＋未読バッジで通知し、ここには載せない。
    return db.notifications
      .filter((n) => n.userId === userId && n.kind !== "message")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async markNotificationRead(id) {
    const n = db.notifications.find((x) => x.id === id);
    if (n) n.read = true;
    notify({ type: "change" });
  },
  async markAllNotificationsRead(userId) {
    db.notifications.filter((n) => n.userId === userId).forEach((n) => (n.read = true));
    notify({ type: "change" });
  },

  // メンバー管理
  async listMembers(orgId) {
    await delay();
    return db.users.filter((u) => u.orgId === orgId && (u.role === "member" || u.role === "admin"));
  },
  async listInvitations(orgId) {
    return db.invitations.filter((i) => i.orgId === orgId);
  },
  async inviteMembers(orgId, emails, role, byUserId) {
    await delay();
    for (const email of emails) {
      db.invitations.push({ id: genId("inv"), orgId, email, role, invitedAt: new Date().toISOString() });
      addAudit(byUserId, "メンバー招待", `${email} を ${role} として招待`, orgId);
    }
    notify({ type: "change" });
  },
  async resendInvitation(id) {
    await delay();
    const inv = db.invitations.find((i) => i.id === id);
    if (inv) inv.invitedAt = new Date().toISOString();
    notify({ type: "change" });
  },
  async cancelInvitation(id, byUserId) {
    await delay();
    const idx = db.invitations.findIndex((i) => i.id === id);
    if (idx >= 0) {
      addAudit(byUserId, "招待取消", `${db.invitations[idx].email} の招待を取消`, db.invitations[idx].orgId);
      db.invitations.splice(idx, 1);
    }
    notify({ type: "change" });
  },
  async setMemberRole(userId, role, byUserId) {
    await delay();
    const u = db.users.find((x) => x.id === userId);
    if (!u) return;
    u.role = role;
    addAudit(byUserId, "ロール変更", `${u.name} を ${role === "admin" ? "管理者に昇格" : "メンバーに降格"}`, u.orgId);
    notify({ type: "change" });
  },
  async disableMember(userId, byUserId) {
    await delay();
    const u = db.users.find((x) => x.id === userId);
    if (!u) return;
    u.disabled = true;
    addAudit(byUserId, "メンバー無効化", `${u.name} を無効化（全セッション失効）`, u.orgId);
    notify({ type: "change" });
  },

  // 権限マトリクス
  async listChannelGrants(orgId) {
    const channelIds = db.channels.filter((c) => c.orgId === orgId).map((c) => c.id);
    return db.channelMembers.filter((cm) => channelIds.includes(cm.channelId));
  },
  async savePermissions(orgId, changes: PermissionChange[], byUserId) {
    await delay(300);
    for (const ch of changes) {
      const channel = db.channels.find((c) => c.id === ch.channelId);
      const user = db.users.find((u) => u.id === ch.userId);
      if (!channel || !user) continue;
      if (ch.granted) {
        if (!db.channelMembers.some((cm) => cm.channelId === ch.channelId && cm.userId === ch.userId)) {
          db.channelMembers.push({ channelId: ch.channelId, userId: ch.userId });
        }
        addAudit(byUserId, "権限変更", `${user.name} に #${channel.name} の閲覧権限を付与`, orgId);
      } else {
        db.channelMembers = db.channelMembers.filter(
          (cm) => !(cm.channelId === ch.channelId && cm.userId === ch.userId),
        );
        addAudit(byUserId, "権限変更", `${user.name} から #${channel.name} の閲覧権限を剥奪`, orgId);
      }
    }
    notify({ type: "change" });
  },

  // 運営
  async createOrg(name, adminEmail, byUserId) {
    await delay();
    const org: Organization = {
      id: genId("org"),
      name,
      initial: name.replace(/^(株式会社|有限会社|合同会社)/, "").charAt(0) || "?",
      color: "#6d28d9",
    };
    db.orgs.push(org);
    db.invitations.push({ id: genId("inv"), orgId: org.id, email: adminEmail, role: "admin", invitedAt: new Date().toISOString() });
    addAudit(byUserId, "企業発行", `${name} を発行し ${adminEmail} を初期管理者として招待`, org.id);
    notify({ type: "change" });
    return org;
  },
  async assignAssistant(orgId, assistantId, byUserId) {
    await delay();
    const count = db.assignments.filter((a) => a.assistantId === assistantId).length;
    if (count >= 10) throw new Error("担当企業数が上限（10社）に達しています");
    if (!db.assignments.some((a) => a.orgId === orgId && a.assistantId === assistantId)) {
      db.assignments.push({ orgId, assistantId });
      const u = db.users.find((x) => x.id === assistantId);
      const o = db.orgs.find((x) => x.id === orgId);
      addAudit(byUserId, "アサイン", `${u?.name} を ${o?.name} にアサイン`, orgId);
    }
    notify({ type: "change" });
  },
  async unassignAssistant(orgId, assistantId, byUserId) {
    await delay();
    db.assignments = db.assignments.filter((a) => !(a.orgId === orgId && a.assistantId === assistantId));
    const u = db.users.find((x) => x.id === assistantId);
    const o = db.orgs.find((x) => x.id === orgId);
    addAudit(byUserId, "アサイン解除", `${u?.name} を ${o?.name} から解除`, orgId);
    notify({ type: "change" });
  },
  async inviteAssistant(email, name, byUserId) {
    await delay();
    db.users.push({
      id: genId("u"),
      name,
      email,
      role: "assistant",
      color: "#9333ea",
    });
    addAudit(byUserId, "アシスタント登録", `${name}（${email}）を登録`);
    notify({ type: "change" });
  },
  async listAuditLogs(orgId) {
    await delay();
    const logs = orgId ? db.auditLogs.filter((l) => l.orgId === orgId) : db.auditLogs;
    return [...logs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async recordAudit(actorId, action, detail, orgId) {
    addAudit(actorId, action, detail, orgId);
  },

  subscribe(listener: (ev: ApiEvent) => void) {
    return subscribeDb(listener);
  },
};
