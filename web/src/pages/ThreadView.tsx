import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { Attachment, Message, ThreadStatus, User } from "../api/types";
import { useApiData, useUsersById } from "../hooks/useApiData";
import { useAuth } from "../stores/auth";
import { useToasts } from "../stores/toast";
import { useOrgCtx } from "../layout/OrgContext";
import { useChannel } from "./ChannelLayout";
import { Avatar, Button, Modal, SkeletonList, StatusBadge } from "../components/ui";
import { formatBytes, formatDateTime, formatShortDate, isOverdue, within24h } from "../utils/format";
import { NotFoundPane } from "./NotFound";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 本文中の @メンション をハイライト */
function renderBody(body: string, users: User[]): ReactNode {
  const names = users.map((v) => v.name).sort((a, b) => b.length - a.length);
  if (names.length === 0) return body;
  const re = new RegExp(`(@(?:${names.map(escapeRe).join("|")}))`, "g");
  const parts = body.split(re);
  return parts.map((part, i) =>
    part.startsWith("@") && names.includes(part.slice(1)) ? (
      <span key={i} className="rounded bg-indigo-100 px-1 py-px font-medium text-indigo-700">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

interface PendingMessage {
  id: string;
  body: string;
  attachments: Attachment[];
  status: "sending" | "failed";
}

/** §3.3 (C) スレッド表示 */
export function ThreadView() {
  const { threadId } = useParams<{ threadId: string }>();
  const user = useAuth((s) => s.user)!;
  const { channel } = useChannel();
  const { basePath } = useOrgCtx();
  const pushToast = useToasts((s) => s.push);

  const thread = useApiData(() => api.getThread(threadId!), [threadId]);
  const messages = useApiData(() => api.listMessages(threadId!), [threadId]);
  // viewers はメンション補完（TH-10）専用。表示用のユーザー解決は usersById（権限剥奪・無効化済みでも解決可能）
  const viewers = useApiData(() => api.listChannelViewers(channel.id), [channel.id]);
  const usersById = useUsersById((messages ?? []).flatMap((m) => [m.authorId, ...m.readBy]));

  // FILE-2: ファイルタブからの遷移で該当メッセージ位置へスクロール
  const [searchParams] = useSearchParams();
  const targetMsgId = searchParams.get("m");
  const [flashId, setFlashId] = useState<string | null>(null);

  // TH-8: 「ここから未読」ライン（スレッドを開いた時点の位置で固定）
  const [firstUnreadId, setFirstUnreadId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    api.getFirstUnreadMessageId(user.id, threadId!).then((id) => {
      if (alive) setFirstUnreadId(id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [threadId, user.id]);

  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [confirmStatus, setConfirmStatus] = useState<ThreadStatus | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [editingDue, setEditingDue] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const unreadLineRef = useRef<HTMLDivElement>(null);
  const initialScrolled = useRef(false);
  const lastCount = useRef(0);

  // 初期スクロール: 未読ラインがあればそこへ、なければ最下部へ
  useEffect(() => {
    if (!messages || firstUnreadId === undefined || initialScrolled.current) return;
    initialScrolled.current = true;
    lastCount.current = messages.length;
    requestAnimationFrame(() => {
      if (firstUnreadId && unreadLineRef.current) {
        unreadLineRef.current.scrollIntoView({ block: "center" });
      } else {
        bottomRef.current?.scrollIntoView({ block: "end" });
      }
    });
  }, [messages, firstUnreadId]);

  // 新着で最下部へ（TL-7 / TH-13）
  useEffect(() => {
    if (!messages || !initialScrolled.current) return;
    if (messages.length > lastCount.current) {
      lastCount.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  // TH-8: 最下部まで見たら既読化（既読カーソル送信）
  useEffect(() => {
    if (!bottomRef.current || firstUnreadId === undefined) return;
    const el = bottomRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void api.markThreadRead(user.id, threadId!);
      },
      { root: scrollRef.current, threshold: 0.9 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threadId, user.id, firstUnreadId, messages?.length]);

  // FILE-2: ?m=<messageId> で該当メッセージへスクロール＋ハイライト
  useEffect(() => {
    if (!messages || !targetMsgId) return;
    const el = document.getElementById(`msg-${targetMsgId}`);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    initialScrolled.current = true;
    setFlashId(targetMsgId);
    const t = setTimeout(() => setFlashId(null), 2500);
    return () => clearTimeout(t);
  }, [messages, targetMsgId]);

  if (thread === undefined || !messages || !viewers || !usersById || firstUnreadId === undefined) {
    return <SkeletonList rows={6} />;
  }
  if (!thread || thread.channelId !== channel.id) return <NotFoundPane />;

  const isClient = user.role === "member" || user.role === "admin";
  const overdue = isOverdue(thread);

  // TH-1/TH-3: ロール別ステータス操作（FR-T2）
  const actions: { label: string; to: ThreadStatus; enabled: boolean; primary?: boolean }[] =
    thread.type !== "request" || channel.archived
      ? []
      : user.role === "assistant"
        ? [
            { label: "対応中にする", to: "in_progress", enabled: thread.status === "open", primary: true },
            { label: "確認待ちにする", to: "awaiting_review", enabled: thread.status === "in_progress", primary: true },
          ]
        : isClient
          ? [
              { label: "完了にする", to: "done", enabled: thread.status === "awaiting_review", primary: true },
              { label: "差し戻す", to: "in_progress", enabled: thread.status === "awaiting_review" },
            ]
          : [];

  const doChangeStatus = async (to: ThreadStatus) => {
    setChangingStatus(true);
    try {
      await api.changeStatus(thread.id, to, user.id);
      setConfirmStatus(null);
    } catch (e) {
      // API層のenforceで拒否された場合（STATE-2）
      pushToast({ title: e instanceof Error ? e.message : "ステータスを変更できませんでした", kind: "error" });
    } finally {
      setChangingStatus(false);
    }
  };

  const send = async (body: string, attachments: Attachment[]) => {
    // TH-12: 楽観的更新
    const temp: PendingMessage = { id: `tmp-${Date.now()}`, body, attachments, status: "sending" };
    setPending((p) => [...p, temp]);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: "end" }));
    try {
      await api.postMessage(thread.id, body, attachments, user.id);
      setPending((p) => p.filter((x) => x.id !== temp.id));
    } catch {
      setPending((p) => p.map((x) => (x.id === temp.id ? { ...x, status: "failed" } : x)));
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* ヘッダー */}
      <div className="shrink-0 border-b border-slate-200 px-4 py-3">
        <div className="flex items-start gap-2">
          <Link
            to={`${basePath}/channels/${channel.id}`}
            className="mt-0.5 rounded p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="スレッド一覧へ戻る"
          >
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <span>{thread.type === "request" ? "🧵" : "💬"}</span>
              <span className="truncate">{thread.title}</span>
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {thread.type === "request" && <StatusBadge status={thread.status} />}
              {overdue && (
                <span className="rounded bg-rose-100 px-1.5 py-px text-[11px] font-bold text-rose-600">⚠ 期日超過</span>
              )}
              {/* TH-2: 期日のインライン編集 */}
              {thread.type === "request" &&
                (editingDue && !channel.archived ? (
                  <input
                    type="date"
                    defaultValue={thread.dueDate ?? ""}
                    autoFocus
                    className="rounded border border-indigo-400 px-1.5 py-0.5 text-xs outline-none"
                    onBlur={async (e) => {
                      setEditingDue(false);
                      const v = e.target.value || undefined;
                      if (v !== thread.dueDate) await api.changeDueDate(thread.id, v, user.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingDue(false);
                    }}
                  />
                ) : (
                  <button
                    onClick={() => !channel.archived && setEditingDue(true)}
                    className={`text-xs ${overdue ? "font-bold text-rose-600" : "text-slate-500"} ${channel.archived ? "cursor-default" : "rounded px-1 py-0.5 hover:bg-slate-100"}`}
                    title={channel.archived ? undefined : "期日を編集"}
                  >
                    期日: {thread.dueDate ? formatShortDate(thread.dueDate) : "未設定"} {!channel.archived && "✎"}
                  </button>
                ))}
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {actions.map((a) => (
              <Button
                key={a.to + a.label}
                variant={a.primary ? "primary" : "secondary"}
                disabled={!a.enabled}
                onClick={() => setConfirmStatus(a.to)}
                className="text-xs"
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>

        {/* TH-4: 依頼内容の常時表示（長文は折りたたみ） */}
        {thread.type === "request" && thread.body && (
          <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-600">
            <span className="mr-1 font-bold text-slate-500">依頼内容:</span>
            {/* 長文は100文字で切って「すべて表示」（line-clamp併用はinlineで効かないため文字数で統一） */}
            <span>{bodyExpanded || thread.body.length <= 100 ? thread.body : `${thread.body.slice(0, 100)}…`}</span>
            {thread.body.length > 100 && (
              <button onClick={() => setBodyExpanded((v) => !v)} className="ml-1 text-indigo-600 hover:underline">
                {bodyExpanded ? "折りたたむ" : "すべて表示"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* メッセージ一覧 */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.map((m) => (
          <div key={m.id}>
            {m.id === firstUnreadId && (
              <div ref={unreadLineRef} className="my-3 flex items-center gap-2 text-[11px] font-bold text-rose-500">
                <span className="h-px flex-1 bg-rose-300" />
                ここから未読
                <span className="h-px flex-1 bg-rose-300" />
              </div>
            )}
            <MessageItem
              message={m}
              me={user}
              usersById={usersById}
              archived={channel.archived}
              flash={m.id === flashId}
              pushToast={pushToast}
            />
          </div>
        ))}
        {pending.map((p) => (
          <div key={p.id} className="mt-2 flex justify-end">
            <div className={`max-w-[75%] rounded-xl rounded-tr-sm px-3 py-2 text-sm ${p.status === "failed" ? "border border-rose-300 bg-rose-50" : "bg-indigo-600/60 text-white"}`}>
              <div className="whitespace-pre-wrap">{p.body}</div>
              {p.status === "sending" && <div className="mt-1 text-right text-[10px] opacity-80">送信中…</div>}
              {p.status === "failed" && (
                <div className="mt-1 flex items-center gap-2 text-[11px] text-rose-600">
                  送信失敗
                  <button className="font-bold underline" onClick={() => { setPending((x) => x.filter((y) => y.id !== p.id)); void send(p.body, p.attachments); }}>再試行</button>
                  <button className="underline" onClick={() => setPending((x) => x.filter((y) => y.id !== p.id))}>破棄</button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} className="h-px" />
      </div>

      {/* 入力欄（アーカイブ済みは非表示 CH-4） */}
      {!channel.archived && <Composer viewers={viewers.filter((v) => v.id !== user.id)} onSend={send} />}

      {/* TH-1: ステータス変更確認モーダル */}
      {confirmStatus && (
        <Modal
          title="ステータスの変更"
          onClose={() => setConfirmStatus(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmStatus(null)}>キャンセル</Button>
              <Button onClick={() => doChangeStatus(confirmStatus)} loading={changingStatus}>変更する</Button>
            </>
          }
        >
          <p className="text-sm">
            「{thread.title}」のステータスを
            <StatusBadge status={confirmStatus} size="sm" />
            に変更します。よろしいですか？
          </p>
          <p className="mt-2 text-xs text-slate-500">変更はシステムメッセージとしてスレッドに記録されます。</p>
        </Modal>
      )}
    </div>
  );
}

// ---- メッセージ1件 ----

function MessageItem({
  message: m,
  me,
  usersById,
  archived,
  flash,
  pushToast,
}: {
  message: Message;
  me: User;
  /** 表示用のユーザー解決（権限剥奪・無効化済みユーザーも含む） */
  usersById: Record<string, User>;
  archived: boolean;
  flash?: boolean;
  pushToast: (t: { title: string; body?: string; kind?: "info" | "error" | "success" }) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(m.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const author = usersById[m.authorId];

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  // TH-7: システムメッセージ
  if (m.system) {
    return (
      <div id={`msg-${m.id}`} className="my-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <span>⚙</span>
        {m.body}
        <span>{formatDateTime(m.createdAt)}</span>
      </div>
    );
  }

  // TH-9: 削除痕跡（FR-H7）
  if (m.deleted) {
    return (
      <div id={`msg-${m.id}`} className="my-2 text-xs text-slate-400 italic">
        <span className="mr-2">🚫</span>このメッセージは削除されました
      </div>
    );
  }

  const mine = m.authorId === me.id;
  const editable = within24h(m.createdAt);
  const readers = m.readBy.map((id) => usersById[id]).filter((u): u is User => !!u);
  const allUsers = Object.values(usersById);

  const download = async (a: Attachment) => {
    const url = await api.requestDownloadUrl(a.id);
    pushToast({ title: `「${a.name}」の署名付きURLを発行しました`, body: `${url}（有効期限10分・モック）`, kind: "success" });
  };

  const bubble = (
    <div className={`group relative max-w-[78%] ${mine ? "ml-auto" : ""}`}>
      <div className="mb-0.5 flex items-baseline gap-2 text-xs text-slate-400">
        {!mine && author && (
          <span className="font-bold text-slate-600">
            {author.name}
            {author.role === "assistant" && <span className="ml-1 rounded bg-emerald-100 px-1 py-px text-[10px] font-medium text-emerald-700">アシスタント</span>}
          </span>
        )}
        {mine && <span className="ml-auto" />}
        <span>{formatDateTime(m.createdAt)}</span>
        {m.editedAt && <span className="text-[10px]">(編集済み)</span>}
        {/* TH-9: 自分のメッセージの⋮メニュー */}
        {mine && !archived && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded px-1 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-500"
              aria-label="メッセージメニュー"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  disabled={!editable}
                  title={editable ? undefined : "投稿から24時間を超えたため編集できません"}
                  onClick={() => { setEditing(true); setEditText(m.body); setMenuOpen(false); }}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  編集
                </button>
                <button
                  disabled={!editable}
                  title={editable ? undefined : "投稿から24時間を超えたため削除できません"}
                  onClick={() => { setConfirmDelete(true); setMenuOpen(false); }}
                  className="block w-full px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  削除
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${mine ? "rounded-tr-sm bg-indigo-600 text-white" : "rounded-tl-sm border border-slate-200 bg-white shadow-sm"}`}>
        {editing ? (
          <div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-indigo-500"
              autoFocus
            />
            <div className="mt-1.5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(false)} className="px-2 py-1 text-xs">キャンセル</Button>
              <Button
                onClick={async () => {
                  try {
                    await api.editMessage(m.id, editText.trim(), me.id);
                    setEditing(false);
                  } catch (e) {
                    pushToast({ title: e instanceof Error ? e.message : "編集できませんでした", kind: "error" });
                  }
                }}
                disabled={!editText.trim()}
                className="px-2 py-1 text-xs"
              >
                保存
              </Button>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap">{renderBody(m.body, allUsers)}</div>
        )}

        {/* TH-5: 添付（画像はインラインプレビュー） */}
        {m.attachments.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {m.attachments.map((a) =>
              a.imageDataUrl ? (
                <button key={a.id} onClick={() => download(a)} className="block text-left" title={`${a.name}（クリックでダウンロード）`}>
                  <img src={a.imageDataUrl} alt={a.name} className="max-h-56 rounded-lg border border-slate-200" />
                  <span className={`mt-0.5 block text-[11px] ${mine ? "text-indigo-100" : "text-slate-400"}`}>{a.name}・{formatBytes(a.size)}</span>
                </button>
              ) : (
                <button
                  key={a.id}
                  onClick={() => download(a)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                    mine ? "border-indigo-400 bg-indigo-500 text-white hover:bg-indigo-400" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                  title="クリックで署名付きURLを取得してダウンロード"
                >
                  <span className="text-base">📎</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
                  <span className={mine ? "text-indigo-200" : "text-slate-400"}>{formatBytes(a.size)}</span>
                  <span>⬇</span>
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {/* TH-6: 既読者アバター（FR-H5） */}
      {readers.length > 0 && (
        <div
          className={`mt-1 flex items-center gap-0.5 ${mine ? "justify-end" : "justify-end"}`}
          title={`既読: ${readers.map((r) => r.name).join("、")}`}
        >
          <span className="mr-0.5 text-[10px] text-slate-400">👁</span>
          {readers.slice(0, 3).map((r) => (
            <Avatar key={r.id} user={r} size={16} />
          ))}
          {readers.length > 3 && <span className="text-[10px] font-bold text-slate-400">+{readers.length - 3}</span>}
        </div>
      )}

      {confirmDelete && (
        <Modal
          title="メッセージを削除"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>キャンセル</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await api.deleteMessage(m.id, me.id);
                    setConfirmDelete(false);
                  } catch (e) {
                    pushToast({ title: e instanceof Error ? e.message : "削除できませんでした", kind: "error" });
                  }
                }}
              >
                削除する
              </Button>
            </>
          }
        >
          <p className="text-sm">このメッセージを削除しますか？</p>
          <p className="mt-2 text-xs text-slate-500">削除後は「このメッセージは削除されました」という痕跡が残ります。</p>
        </Modal>
      )}
    </div>
  );

  return (
    <div
      id={`msg-${m.id}`}
      className={`my-2.5 flex gap-2 rounded-xl transition-colors ${mine ? "justify-end" : ""} ${
        flash ? "bg-amber-100/70 ring-2 ring-amber-300" : ""
      }`}
    >
      {!mine && author && <Avatar user={author} size={32} />}
      {bubble}
    </div>
  );
}

// ---- 入力欄 ----

interface StagedFile extends Attachment {
  progress: number;
}

function Composer({ viewers, onSend }: { viewers: User[]; onSend: (body: string, attachments: Attachment[]) => void }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<StagedFile[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pushToast = useToasts((s) => s.push);

  const candidates =
    mentionQuery === null
      ? []
      : viewers.filter((v) => v.name.toLowerCase().includes(mentionQuery.toLowerCase()));

  const updateMention = (value: string, caret: number) => {
    const beforeCaret = value.slice(0, caret);
    const match = beforeCaret.match(/@([^\s@]*)$/);
    setMentionQuery(match ? match[1] : null);
    setMentionIndex(0);
  };

  const insertMention = (u: User) => {
    const ta = taRef.current;
    if (!ta) return;
    const caret = ta.selectionStart;
    const before = text.slice(0, caret).replace(/@[^\s@]*$/, `@${u.name} `);
    const after = text.slice(caret);
    setText(before + after);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = before.length;
    });
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    for (const f of Array.from(list)) {
      // TH-11: 100MB制限のクライアント検査（FR-F3）
      if (f.size > 100 * 1024 * 1024) {
        pushToast({ title: `「${f.name}」は100MBを超えているため添付できません`, kind: "error" });
        continue;
      }
      const staged: StagedFile = { id: `att-${Date.now()}-${f.name}`, name: f.name, size: f.size, progress: 0 };
      if (f.type.startsWith("image/") && f.size < 3 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onload = () => {
          setFiles((fs) => fs.map((x) => (x.id === staged.id ? { ...x, imageDataUrl: reader.result as string } : x)));
        };
        reader.readAsDataURL(f);
      }
      setFiles((fs) => [...fs, staged]);
      // TH-11: アップロード進捗（モック）
      let p = 0;
      const timer = setInterval(() => {
        p += 25;
        setFiles((fs) => fs.map((x) => (x.id === staged.id ? { ...x, progress: Math.min(p, 100) } : x)));
        if (p >= 100) clearInterval(timer);
      }, 120);
    }
  };

  const canSend = (text.trim().length > 0 || files.length > 0) && files.every((f) => f.progress >= 100);

  const send = () => {
    if (!canSend) return;
    onSend(
      text.trim(),
      files.map(({ progress: _p, ...a }) => a),
    );
    setText("");
    setFiles([]);
    setMentionQuery(null);
  };

  return (
    <div className="relative shrink-0 border-t border-slate-200 p-3">
      {/* TH-10: メンション補完（チャンネル閲覧者のみ） */}
      {mentionQuery !== null && candidates.length > 0 && (
        <div className="absolute bottom-full left-3 z-30 mb-1 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">このチャンネルを閲覧できるメンバー</div>
          {candidates.slice(0, 6).map((u, i) => (
            <button
              key={u.id}
              onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === mentionIndex ? "bg-indigo-50" : "hover:bg-slate-50"}`}
            >
              <Avatar user={u} size={22} />
              <span className="font-medium">{u.name}</span>
              {u.role === "assistant" && <span className="rounded bg-emerald-100 px-1 py-px text-[10px] text-emerald-700">アシスタント</span>}
            </button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f) => (
            <div key={f.id} className="relative w-52 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span>📎</span>
                <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                <button onClick={() => setFiles((fs) => fs.filter((x) => x.id !== f.id))} className="text-slate-400 hover:text-slate-600" aria-label="添付を削除">✕</button>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded bg-slate-200">
                  <div className="h-full bg-indigo-500 transition-all" style={{ width: `${f.progress}%` }} />
                </div>
                <span className="text-[10px] text-slate-400">{f.progress < 100 ? `${f.progress}%` : formatBytes(f.size)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            updateMention(e.target.value, e.target.selectionStart);
          }}
          onKeyDown={(e) => {
            if (mentionQuery !== null && candidates.length > 0) {
              if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => (i + 1) % Math.min(candidates.length, 6)); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => (i - 1 + candidates.length) % Math.min(candidates.length, 6)); return; }
              if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); insertMention(candidates[mentionIndex]); return; }
              if (e.key === "Escape") { setMentionQuery(null); return; }
            }
            // TH-14: Cmd/Ctrl+Enterで送信、Enterは改行
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          rows={Math.min(6, Math.max(1, text.split("\n").length))}
          placeholder="@で誰かにメンション（Enterで改行 / ⌘+Enterで送信）"
          className="max-h-40 flex-1 resize-none bg-transparent px-1 py-1 text-sm outline-none"
        />
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          title="ファイルを添付（1件100MBまで）"
        >
          📎
        </button>
        <Button onClick={send} disabled={!canSend} className="px-4">送信</Button>
      </div>
    </div>
  );
}
