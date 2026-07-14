// ドメイン型定義（docs/product-design.md のドメインモデルに対応）

export type Role = "member" | "admin" | "assistant" | "ops";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** 依頼者（member/admin）の所属企業 */
  orgId?: string;
  /** アバターの背景色（Tailwindクラスではなく hex） */
  color: string;
  /** アバター画像（モックでは dataURL） */
  avatarUrl?: string;
  /** 無効化済み */
  disabled?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  /** レール表示用の頭文字 */
  initial: string;
  color: string;
}

/** アシスタントの企業アサイン */
export interface Assignment {
  assistantId: string;
  orgId: string;
}

export interface Channel {
  id: string;
  orgId: string;
  name: string;
  description: string;
  archived: boolean;
}

/** 依頼者(member)のチャンネル閲覧権限（管理者・アシスタントは暗黙で全チャンネル） */
export interface ChannelMember {
  channelId: string;
  userId: string;
}

export type ThreadType = "request" | "topic";
export type ThreadStatus = "open" | "in_progress" | "awaiting_review" | "done";

export interface Thread {
  id: string;
  channelId: string;
  type: ThreadType;
  title: string;
  /** 依頼内容（依頼スレッドのみ） */
  body?: string;
  /** 期日 ISO 日付（依頼スレッドのみ・任意） */
  dueDate?: string;
  status: ThreadStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  /** 画像ならインラインプレビュー用 dataURL（モック） */
  imageDataUrl?: string;
}

export interface Message {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  createdAt: string;
  editedAt?: string;
  deleted?: boolean;
  attachments: Attachment[];
  /** ステータス・期日変更などのシステムメッセージ */
  system?: boolean;
  /** 楽観的更新の失敗をモックで表現するためのフラグ */
  failed?: boolean;
  /** 既読ユーザーID（投稿者以外） */
  readBy: string[];
}

export interface PageRevision {
  rev: number;
  title: string;
  body: string;
  authorId: string;
  savedAt: string;
}

export interface Page {
  id: string;
  channelId: string;
  title: string;
  body: string;
  rev: number;
  updatedBy: string;
  updatedAt: string;
  revisions: PageRevision[];
}

export type NotificationKind = "mention" | "status" | "due" | "message";

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  text: string;
  orgId: string;
  channelId: string;
  threadId: string;
  read: boolean;
  createdAt: string;
}

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  role: "member" | "admin";
  invitedAt: string;
}

export interface AuditLog {
  id: string;
  orgId?: string;
  actorId: string;
  action: string;
  detail: string;
  createdAt: string;
}

/** スレッドごとの未読管理（ユーザー×スレッド） */
export interface ReadState {
  userId: string;
  threadId: string;
  /** このメッセージIDまで既読 */
  lastReadMessageId?: string;
}
