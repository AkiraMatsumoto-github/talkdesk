import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { Message, Thread, ThreadStatus, ThreadType } from "../api/types";
import { useApiData } from "../hooks/useApiData";
import { useAuth } from "../stores/auth";
import { useOrgCtx } from "../layout/OrgContext";
import { useChannel } from "./ChannelLayout";
import { ThreadView } from "./ThreadView";
import { Button, EmptyState, Modal, SkeletonList, StatusBadge, UnreadBadge } from "../components/ui";
import { formatDateTime, formatShortDate, isOverdue } from "../utils/format";

type Filter = "all" | ThreadStatus | "topic";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "全て" },
  { key: "open", label: "依頼中" },
  { key: "in_progress", label: "対応中" },
  { key: "awaiting_review", label: "確認待ち" },
  { key: "done", label: "完了" },
  { key: "topic", label: "トピック" },
];

interface Row {
  thread: Thread;
  unread: number;
  lastMessage?: Message;
  lastAuthorName?: string;
}

/** (B)スレッド一覧 + (C)スレッド の2ペイン */
export function ThreadsPane() {
  const { threadId } = useParams<{ threadId?: string }>();
  return (
    <>
      {/* SHELL-5: 1024px未満ではスレッド表示中は一覧を隠して全画面化 */}
      <div className={`w-80 shrink-0 border-r border-slate-200 xl:w-96 ${threadId ? "max-lg:hidden" : "max-lg:w-full max-lg:border-r-0"}`}>
        <ThreadListColumn />
      </div>
      <div className={`min-w-0 flex-1 ${threadId ? "" : "max-lg:hidden"}`}>
        {threadId ? (
          <ThreadView key={threadId} />
        ) : (
          <EmptyState icon="🧵" title="スレッドを選択してください" description="左の一覧からスレッドを選ぶと、ここにやり取りが表示されます。" />
        )}
      </div>
    </>
  );
}

function ThreadListColumn() {
  const user = useAuth((s) => s.user)!;
  const { channel } = useChannel();
  const { basePath } = useOrgCtx();
  const { threadId: activeId } = useParams<{ threadId?: string }>();
  const [filter, setFilter] = useState<Filter>("all");
  const [doneOpen, setDoneOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useApiData<Row[]>(async () => {
    const threads = await api.listThreads(channel.id);
    return Promise.all(
      threads.map(async (thread) => {
        const [unread, messages] = await Promise.all([
          api.getThreadUnreadCount(user.id, thread.id),
          api.listMessages(thread.id),
        ]);
        const lastMessage = [...messages].reverse().find((m) => !m.deleted && !m.system);
        const lastAuthorName = lastMessage ? (await api.getUser(lastMessage.authorId))?.name : undefined;
        return { thread, unread, lastMessage, lastAuthorName };
      }),
    );
  }, [channel.id, user.id]);

  if (!rows) return <SkeletonList rows={6} />;

  const matches = (r: Row) => {
    switch (filter) {
      case "all":
        return true;
      case "topic":
        return r.thread.type === "topic";
      default:
        return r.thread.type === "request" && r.thread.status === filter;
    }
  };
  const filtered = rows.filter(matches);
  // TL-3: 既定は「全て（完了以外）」/ TL-6: 完了済みは折りたたみ
  const mainRows = filter === "all" ? filtered.filter((r) => r.thread.status !== "done" || r.thread.type === "topic") : filtered;
  const doneRows = filter === "all" ? filtered.filter((r) => r.thread.type === "request" && r.thread.status === "done") : [];

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-2 border-b border-slate-200 p-3">
        {!channel.archived && (
          <Button onClick={() => setCreateOpen(true)} variant="secondary" className="w-full border-dashed">
            ＋ 新規スレッド
          </Button>
        )}
        {/* TL-3: ステータスフィルタ */}
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                filter === f.key ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {mainRows.length === 0 && doneRows.length === 0 && (
          // STATE-1: 空状態
          <EmptyState
            icon="🗂"
            title={filter === "all" ? "スレッドはまだありません" : "該当するスレッドがありません"}
            description={filter === "all" && !channel.archived ? "最初の依頼を作成しましょう。" : undefined}
            action={
              filter === "all" && !channel.archived ? (
                <Button onClick={() => setCreateOpen(true)}>＋ 新規スレッド</Button>
              ) : undefined
            }
          />
        )}
        {mainRows.map((r) => (
          <ThreadRow key={r.thread.id} row={r} active={r.thread.id === activeId} basePath={basePath} />
        ))}

        {doneRows.length > 0 && (
          <div className="border-t border-slate-100">
            <button
              onClick={() => setDoneOpen((v) => !v)}
              className="flex w-full items-center gap-1 px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-600"
            >
              <span className={`transition-transform ${doneOpen ? "rotate-90" : ""}`}>▸</span>
              完了済み ({doneRows.length})
            </button>
            {doneOpen &&
              doneRows.map((r) => (
                <ThreadRow key={r.thread.id} row={r} active={r.thread.id === activeId} basePath={basePath} muted />
              ))}
          </div>
        )}
      </div>

      {createOpen && <CreateThreadModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function ThreadRow({ row, active, basePath, muted }: { row: Row; active: boolean; basePath: string; muted?: boolean }) {
  const { thread, unread, lastMessage, lastAuthorName } = row;
  const overdue = isOverdue(thread);
  return (
    <Link
      to={`${basePath}/channels/${thread.channelId}/threads/${thread.id}`}
      className={`block border-b border-slate-100 px-3 py-2.5 transition-colors ${
        active ? "bg-indigo-50" : "hover:bg-slate-50"
      } ${muted ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        {thread.type === "request" ? <StatusBadge status={thread.status} size="sm" /> : <span className="text-xs">💬</span>}
        {/* TL-5: 期日超過バッジ */}
        {overdue && (
          <span className="rounded bg-rose-100 px-1.5 py-px text-[11px] font-bold text-rose-600">⚠ 期日超過</span>
        )}
        <span className="ml-auto shrink-0 text-[11px] text-slate-400">{formatDateTime(thread.updatedAt)}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="shrink-0 text-sm">{thread.type === "request" ? "🧵" : "💬"}</span>
        <span className={`min-w-0 flex-1 truncate text-sm ${unread > 0 ? "font-bold" : "font-medium"}`}>
          {thread.title}
        </span>
        {thread.type === "request" && thread.dueDate && (
          <span className={`shrink-0 text-[11px] ${overdue ? "font-bold text-rose-600" : "text-slate-400"}`}>
            期日{formatShortDate(thread.dueDate)}
          </span>
        )}
        <UnreadBadge count={unread} />
      </div>
      {lastMessage && (
        <div className="mt-0.5 truncate text-xs text-slate-400">
          {lastAuthorName && <span>{lastAuthorName.split(" ")[0]}: </span>}
          {lastMessage.body || "📎 添付ファイル"}
        </div>
      )}
    </Link>
  );
}

/** TL-2: 新規スレッド作成モーダル（FR-T1） */
function CreateThreadModal({ onClose }: { onClose: () => void }) {
  const user = useAuth((s) => s.user)!;
  const { channel } = useChannel();
  const { basePath } = useOrgCtx();
  const navigate = useNavigate();
  const [type, setType] = useState<ThreadType>("request");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    const th = await api.createThread(
      channel.id,
      { type, title: title.trim(), body: body.trim() || undefined, dueDate: due || undefined },
      user.id,
    );
    onClose();
    navigate(`${basePath}/channels/${channel.id}/threads/${th.id}`);
  };

  const valid = title.trim().length > 0 && (type === "topic" || body.trim().length > 0);

  return (
    <Modal
      title="新規スレッド"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>キャンセル</Button>
          <Button onClick={create} disabled={!valid} loading={saving}>作成する</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { key: "request", icon: "🧵", label: "依頼", desc: "期日とステータスで進捗を管理" },
              { key: "topic", icon: "💬", label: "トピック", desc: "依頼に紐づかない質問・連絡" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              className={`rounded-xl border-2 p-3 text-left transition-colors ${
                type === t.key ? "border-indigo-600 bg-indigo-50" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-sm font-bold">{t.icon} {t.label}</div>
              <div className="mt-0.5 text-xs text-slate-500">{t.desc}</div>
            </button>
          ))}
        </div>
        <label className="block text-sm font-medium">
          タイトル
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={type === "request" ? "例: 7月分給与計算" : "例: 経費精算の質問"}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
        </label>
        {type === "request" && (
          <>
            <label className="block text-sm font-medium">
              依頼内容
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="依頼の内容・条件・参考情報など"
                className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block text-sm font-medium">
              期日 <span className="font-normal text-slate-400">(任意)</span>
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}
