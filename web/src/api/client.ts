// APIインターフェース。
// 現在は src/mocks/ の in-memory 実装が bind されている（src/api/index.ts）。
// 実API接続時はこのインターフェースを満たす REST/WebSocket 実装に差し替える。

import type {
  AppNotification,
  Assignment,
  Attachment,
  AuditLog,
  Channel,
  Invitation,
  Message,
  Organization,
  Page,
  Thread,
  ThreadStatus,
  ThreadType,
  User,
} from "./types";

/** リアルタイムイベント（実装ではWebSocket相当） */
export type ApiEvent =
  | { type: "message"; message: Message; channelId: string; orgId: string }
  | { type: "notification"; notification: AppNotification }
  | { type: "change" };

export interface ChannelUnread {
  channelId: string;
  count: number;
  mention: boolean;
}

export interface FileEntry {
  attachment: Attachment;
  message: Message;
  thread: Thread;
  uploadedBy: string;
  uploadedAt: string;
}

export interface PermissionChange {
  channelId: string;
  userId: string;
  granted: boolean;
}

export interface NewThreadInput {
  type: ThreadType;
  title: string;
  body?: string;
  dueDate?: string;
}

export interface TalkdeskApi {
  // --- 認証 ---
  listDemoUsers(): Promise<User[]>;
  login(email: string, password: string): Promise<User>;
  getUser(id: string): Promise<User | undefined>;
  /** SET-1: 表示名・アバターの変更（db側にも反映し全画面の表示が追随する） */
  updateProfile(userId: string, patch: { name?: string; color?: string; avatarUrl?: string }): Promise<User>;

  // --- 企業・アサイン ---
  getOrg(orgId: string): Promise<Organization | undefined>;
  listOrgs(): Promise<Organization[]>;
  listAssignedOrgs(assistantId: string): Promise<Organization[]>;
  listAssignments(): Promise<Assignment[]>;
  listAssistants(): Promise<User[]>;

  // --- チャンネル ---
  listVisibleChannels(userId: string, orgId: string): Promise<Channel[]>;
  getChannel(id: string): Promise<Channel | undefined>;
  createChannel(orgId: string, name: string, description: string, byUserId: string): Promise<Channel>;
  /** チャンネルを閲覧できるユーザー（メンション補完・既読者表示用） */
  listChannelViewers(channelId: string): Promise<User[]>;

  // --- スレッド・メッセージ ---
  listThreads(channelId: string): Promise<Thread[]>;
  getThread(id: string): Promise<Thread | undefined>;
  createThread(channelId: string, input: NewThreadInput, byUserId: string): Promise<Thread>;
  changeStatus(threadId: string, status: ThreadStatus, byUserId: string): Promise<void>;
  changeDueDate(threadId: string, dueDate: string | undefined, byUserId: string): Promise<void>;
  listMessages(threadId: string): Promise<Message[]>;
  postMessage(threadId: string, body: string, attachments: Attachment[], byUserId: string): Promise<Message>;
  editMessage(messageId: string, body: string, byUserId: string): Promise<void>;
  deleteMessage(messageId: string, byUserId: string): Promise<void>;

  // --- 未読・既読 ---
  getChannelUnreads(userId: string, orgId: string): Promise<ChannelUnread[]>;
  getThreadUnreadCount(userId: string, threadId: string): Promise<number>;
  getFirstUnreadMessageId(userId: string, threadId: string): Promise<string | undefined>;
  markThreadRead(userId: string, threadId: string): Promise<void>;
  /** アシスタント用: 企業ごとの未読合計 */
  getOrgUnreads(assistantId: string): Promise<ChannelUnread[]>;

  // --- ファイル ---
  listFiles(channelId: string): Promise<FileEntry[]>;
  /** 署名付きURLの都度発行（モックではダミーURL） */
  requestDownloadUrl(attachmentId: string): Promise<string>;

  // --- ナレッジページ ---
  listPages(channelId: string): Promise<Page[]>;
  getPage(id: string): Promise<Page | undefined>;
  createPage(channelId: string, title: string, body: string, byUserId: string): Promise<Page>;
  savePage(pageId: string, title: string, body: string, byUserId: string): Promise<void>;
  restoreRevision(pageId: string, rev: number, byUserId: string): Promise<void>;

  // --- 通知 ---
  listNotifications(userId: string): Promise<AppNotification[]>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;

  // --- メンバー管理（クライアント管理者） ---
  listMembers(orgId: string): Promise<User[]>;
  listInvitations(orgId: string): Promise<Invitation[]>;
  inviteMembers(orgId: string, emails: string[], role: "member" | "admin", byUserId: string): Promise<void>;
  resendInvitation(id: string): Promise<void>;
  cancelInvitation(id: string, byUserId: string): Promise<void>;
  setMemberRole(userId: string, role: "member" | "admin", byUserId: string): Promise<void>;
  disableMember(userId: string, byUserId: string): Promise<void>;

  // --- チャンネル権限マトリクス ---
  listChannelGrants(orgId: string): Promise<{ channelId: string; userId: string }[]>;
  savePermissions(orgId: string, changes: PermissionChange[], byUserId: string): Promise<void>;

  // --- 運営 ---
  createOrg(name: string, adminEmail: string, byUserId: string): Promise<Organization>;
  assignAssistant(orgId: string, assistantId: string, byUserId: string): Promise<void>;
  unassignAssistant(orgId: string, assistantId: string, byUserId: string): Promise<void>;
  inviteAssistant(email: string, name: string, byUserId: string): Promise<void>;
  listAuditLogs(orgId?: string): Promise<AuditLog[]>;
  recordAudit(actorId: string, action: string, detail: string, orgId?: string): Promise<void>;

  // --- リアルタイム購読（WebSocket相当） ---
  subscribe(listener: (ev: ApiEvent) => void): () => void;
}

let impl: TalkdeskApi | null = null;

export function setApi(api: TalkdeskApi) {
  impl = api;
}

export const api: TalkdeskApi = new Proxy({} as TalkdeskApi, {
  get(_t, prop: keyof TalkdeskApi) {
    if (!impl) throw new Error("API implementation not bound");
    return impl[prop];
  },
});
