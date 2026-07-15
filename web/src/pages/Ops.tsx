import { useEffect, useRef, useState } from "react";
import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { Message, Thread, User } from "../api/types";
import { useApiData, useUsersById } from "../hooks/useApiData";
import { useAuth } from "../stores/auth";
import { useToasts } from "../stores/toast";
import { Avatar, Button, EmptyState, Modal, SkeletonList, StatusBadge } from "../components/ui";
import { formatBytes, formatDateTime } from "../utils/format";
import { NotFoundPane } from "./NotFound";

/** §7 運営管理画面 */
export function OpsRoutes() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "ops") return <NotFoundPane />;

  const tabCls = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-700/60"}`;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-4 bg-slate-900 px-4 text-white">
        <span className="text-base font-black tracking-tight text-indigo-300">
          talkdesk <span className="text-xs font-bold text-slate-400">ops</span>
        </span>
        <nav className="flex gap-1">
          <NavLink to="/ops/orgs" className={tabCls}>企業</NavLink>
          <NavLink to="/ops/assistants" className={tabCls}>アシスタント</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-400">{user.name}</span>
          <Avatar user={user} size={26} />
          <button
            className="text-xs text-slate-400 hover:text-white"
            onClick={() => {
              navigate("/login");
              setTimeout(() => useAuth.getState().logout(), 0);
            }}
          >
            ログアウト
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50">
        <Routes>
          <Route index element={<Navigate to="orgs" replace />} />
          <Route path="orgs" element={<OpsOrgs />} />
          <Route path="orgs/:orgId" element={<OpsOrgDetail />} />
          <Route path="orgs/:orgId/channels/:channelId" element={<OpsChannelView />} />
          <Route path="assistants" element={<OpsAssistants />} />
          <Route path="*" element={<NotFoundPane />} />
        </Routes>
      </div>
    </div>
  );
}

/** §7.1 企業一覧（OPS-1 / FR-O1） */
function OpsOrgs() {
  const user = useAuth((s) => s.user)!;
  const pushToast = useToasts((s) => s.push);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const rows = useApiData(async () => {
    const [orgs, assistants, assignments] = await Promise.all([api.listOrgs(), api.listAssistants(), api.listAssignments()]);
    return Promise.all(
      orgs.map(async (org) => {
        const [members, channels] = await Promise.all([api.listMembers(org.id), api.listVisibleChannels(user.id, org.id)]);
        const assigned = assignments.filter((a) => a.orgId === org.id).map((a) => assistants.find((x) => x.id === a.assistantId)?.name).filter(Boolean);
        return { org, memberCount: members.filter((m) => !m.disabled).length, channelCount: channels.length, assigned };
      }),
    );
  }, [user.id]);

  if (!rows) return <SkeletonList />;

  const create = async () => {
    setSaving(true);
    await api.createOrg(name.trim(), email.trim(), user.id);
    pushToast({ title: `${name} を発行し、初期管理者へ招待メールを送信しました`, kind: "success" });
    setSaving(false);
    setCreateOpen(false);
    setName("");
    setEmail("");
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">企業一覧</h1>
        <Button onClick={() => setCreateOpen(true)}>＋ 企業を発行</Button>
      </div>
      <div className="mt-4 space-y-2">
        {rows.map(({ org, memberCount, channelCount, assigned }) => (
          <Link
            key={org.id}
            to={`/ops/orgs/${org.id}`}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: org.color }}>
              {org.initial}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{org.name}</div>
              <div className="mt-0.5 text-xs text-slate-400">
                メンバー{memberCount} ・ チャンネル{channelCount} ・ 担当: {assigned.length > 0 ? assigned.join("、") : "未アサイン"}
              </div>
            </div>
            <span className="text-slate-300">→</span>
          </Link>
        ))}
      </div>

      {createOpen && (
        <Modal
          title="企業を発行"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCreateOpen(false)}>キャンセル</Button>
              <Button onClick={create} disabled={!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)} loading={saving}>発行して招待</Button>
            </>
          }
        >
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              企業名
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="株式会社◯◯" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" autoFocus />
            </label>
            <label className="block text-sm font-medium">
              初期管理者のメールアドレス
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
            </label>
            <p className="text-xs text-slate-500">発行と同時に、初期管理者へ招待メールが送信されます。</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** §7.2 企業詳細（OPS-2, OPS-3） */
function OpsOrgDetail() {
  const { orgId } = useParams<{ orgId: string }>();
  const user = useAuth((s) => s.user)!;
  const pushToast = useToasts((s) => s.push);
  const [assignError, setAssignError] = useState("");
  const [selectedAssistantId, setSelectedAssistantId] = useState("");

  const org = useApiData(() => api.getOrg(orgId!), [orgId]);
  const assistants = useApiData(() => api.listAssistants(), []);
  const assignments = useApiData(() => api.listAssignments(), []);
  const channels = useApiData(() => api.listVisibleChannels(user.id, orgId!), [user.id, orgId]);
  const audits = useApiData(() => api.listAuditLogs(orgId), [orgId]);

  if (org === undefined || !assistants || !assignments || !channels) return <SkeletonList />;
  if (!org) return <NotFoundPane />;

  const assignedIds = assignments.filter((a) => a.orgId === org.id).map((a) => a.assistantId);
  const assigned = assistants.filter((a) => assignedIds.includes(a.id));
  const candidates = assistants.filter((a) => !assignedIds.includes(a.id) && !a.disabled);

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <Link to="/ops/orgs" className="text-xs text-indigo-600 hover:underline">← 企業一覧へ</Link>
      <div className="mt-2 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold text-white" style={{ backgroundColor: org.color }}>
          {org.initial}
        </span>
        <h1 className="text-lg font-bold">{org.name}</h1>
      </div>

      {/* OPS-2: アサイン管理 */}
      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-600">担当アシスタント</h2>
        <div className="mt-2 space-y-2">
          {assigned.length === 0 && <p className="text-sm text-slate-400">担当アシスタントがいません。</p>}
          {assigned.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
              <Avatar user={a} size={28} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.name}</span>
              <span className="text-xs text-slate-400">{a.email}</span>
              <Button
                variant="ghost"
                className="text-xs text-rose-600"
                onClick={async () => {
                  await api.unassignAssistant(org.id, a.id, user.id);
                  pushToast({ title: `${a.name} のアサインを解除しました` });
                }}
              >
                解除
              </Button>
            </div>
          ))}
        </div>
        {candidates.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <select
              value={selectedAssistantId}
              onChange={(e) => setSelectedAssistantId(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500"
              aria-label="アサインするアシスタント"
            >
              <option value="" disabled>アシスタントを選択…</option>
              {candidates.map((a) => (
                <option key={a.id} value={a.id}>{a.name}（{a.email}）</option>
              ))}
            </select>
            <Button
              variant="secondary"
              disabled={!selectedAssistantId}
              onClick={async () => {
                setAssignError("");
                try {
                  await api.assignAssistant(org.id, selectedAssistantId, user.id);
                  setSelectedAssistantId("");
                  pushToast({ title: "アサインしました", kind: "success" });
                } catch (e) {
                  // FR-O2: 上限10社バリデーション
                  setAssignError(e instanceof Error ? e.message : "アサインに失敗しました");
                }
              }}
            >
              アサイン
            </Button>
          </div>
        )}
        {assignError && <p className="mt-2 text-xs text-rose-600">⚠ {assignError}</p>}
      </section>

      {/* OPS-3: チャンネル閲覧（読み取り専用） */}
      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-600">チャンネル</h2>
        <p className="mt-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          🛡 運営によるチャンネル閲覧はすべて監査ログに記録されます。
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 max-md:grid-cols-1">
          {channels.map((c) => (
            <Link
              key={c.id}
              to={`/ops/orgs/${org.id}/channels/${c.id}`}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <span className="text-slate-400"># </span>
              <span className="font-medium">{c.name}</span>
              {c.archived && <span className="ml-2 text-[10px] text-slate-400">📦 アーカイブ</span>}
              <span className="mt-0.5 block truncate text-xs text-slate-400">{c.description}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 監査ログ */}
      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-600">監査ログ</h2>
        <div className="mt-2">
          {(audits ?? []).slice(0, 10).map((a) => (
            <div key={a.id} className="flex items-baseline gap-3 border-b border-slate-50 py-1.5 text-xs last:border-b-0">
              <span className="shrink-0 text-slate-400">{formatDateTime(a.createdAt)}</span>
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-px font-medium text-slate-600">{a.action}</span>
              <span className="min-w-0 flex-1 truncate text-slate-600">{a.detail}</span>
            </div>
          ))}
          {(audits ?? []).length === 0 && <p className="text-sm text-slate-400">ログはありません。</p>}
        </div>
      </section>
    </div>
  );
}

/** OPS-3: 読み取り専用チャンネルビュー */
function OpsChannelView() {
  const { orgId, channelId } = useParams<{ orgId: string; channelId: string }>();
  const user = useAuth((s) => s.user)!;
  const channel = useApiData(() => api.getChannel(channelId!), [channelId]);
  const threads = useApiData(() => api.listThreads(channelId!), [channelId]);
  const audited = useRef(false);

  // FR-O3: 閲覧の事実を監査ログに記録
  useEffect(() => {
    if (!channel || audited.current) return;
    audited.current = true;
    void api.recordAudit(user.id, "運営閲覧", `運営管理者が #${channel.name} を閲覧`, orgId);
  }, [channel, user.id, orgId]);

  if (channel === undefined || !threads) return <SkeletonList />;
  if (!channel || channel.orgId !== orgId) return <NotFoundPane />;

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <Link to={`/ops/orgs/${orgId}`} className="text-xs text-indigo-600 hover:underline">← 企業詳細へ</Link>
      <h1 className="mt-2 text-lg font-bold">
        <span className="text-slate-400"># </span>
        {channel.name}
      </h1>
      <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
        🛡 読み取り専用ビューです。この閲覧は監査ログに記録されました。
      </div>
      <div className="mt-4 space-y-2">
        {threads.length === 0 && <EmptyState icon="🗂" title="スレッドはありません" />}
        {threads.map((t) => (
          <OpsThreadItem key={t.id} thread={t} />
        ))}
      </div>
    </div>
  );
}

function OpsThreadItem({ thread }: { thread: Thread }) {
  const [open, setOpen] = useState(false);
  const messages = useApiData<Message[] | undefined>(
    () => (open ? api.listMessages(thread.id) : Promise.resolve(undefined)),
    [open, thread.id],
  );
  // #2と同方針: 投稿者は getUser ベースで解決（権限剥奪・無効化済みユーザーも「不明」にならない）
  const usersById = useUsersById((messages ?? []).map((m) => m.authorId));
  const nameOf = (id: string) => usersById?.[id]?.name ?? "不明";
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <span className={`text-xs transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        <span>{thread.type === "request" ? "🧵" : "💬"}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{thread.title}</span>
        {thread.type === "request" && <StatusBadge status={thread.status} size="sm" />}
        <span className="text-xs text-slate-400">{formatDateTime(thread.updatedAt)}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          {thread.body && <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">依頼内容: {thread.body}</p>}
          {(messages ?? []).map((m) => (
            <div key={m.id} className="border-b border-slate-50 py-2 text-sm last:border-b-0">
              {m.system ? (
                <span className="text-xs text-slate-400">⚙ {m.body}</span>
              ) : m.deleted ? (
                <span className="text-xs text-slate-400 italic">🚫 このメッセージは削除されました</span>
              ) : (
                <>
                  <span className="mr-2 text-xs font-bold text-slate-500">{nameOf(m.authorId)}</span>
                  <span className="mr-2 text-[11px] text-slate-400">{formatDateTime(m.createdAt)}</span>
                  <span className="block whitespace-pre-wrap">{m.body}</span>
                  {m.attachments.map((a) => (
                    <span key={a.id} className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      📎 {a.name}（{formatBytes(a.size)}）
                    </span>
                  ))}
                </>
              )}
            </div>
          ))}
          {messages && messages.length === 0 && <p className="text-xs text-slate-400">メッセージはありません。</p>}
        </div>
      )}
    </div>
  );
}

/** §7.3 アシスタント一覧（OPS-4 / FR-O2） */
function OpsAssistants() {
  const user = useAuth((s) => s.user)!;
  const pushToast = useToasts((s) => s.push);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState<User | null>(null);
  const [disabling, setDisabling] = useState(false);

  const data = useApiData(async () => {
    const [assistants, assignments, orgs] = await Promise.all([api.listAssistants(), api.listAssignments(), api.listOrgs()]);
    return assistants.map((a) => ({
      assistant: a,
      orgs: assignments.filter((x) => x.assistantId === a.id).map((x) => orgs.find((o) => o.id === x.orgId)?.name ?? ""),
    }));
  }, []);

  if (!data) return <SkeletonList />;

  const invite = async () => {
    setSaving(true);
    await api.inviteAssistant(email.trim(), name.trim(), user.id);
    pushToast({ title: `${name} を登録しました`, kind: "success" });
    setSaving(false);
    setInviteOpen(false);
    setName("");
    setEmail("");
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">アシスタント一覧</h1>
        <Button onClick={() => setInviteOpen(true)}>＋ アシスタントを登録</Button>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {data.map(({ assistant: a, orgs }) => (
          <div
            key={a.id}
            className={`flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 ${a.disabled ? "opacity-50" : ""}`}
          >
            <Avatar user={a} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{a.name}</span>
                {a.disabled && (
                  <span className="rounded bg-rose-100 px-1.5 py-px text-[11px] font-bold text-rose-700">無効</span>
                )}
              </div>
              <div className="truncate text-xs text-slate-400">{a.email}</div>
            </div>
            <div className="text-right">
              <span className={`text-sm font-bold ${orgs.length >= 10 ? "text-rose-600" : "text-slate-600"}`}>{orgs.length}/10社</span>
              <div className="max-w-56 truncate text-xs text-slate-400">{orgs.join("、") || "担当なし"}</div>
            </div>
            {/* OPS-4: アシスタントの無効化 */}
            {!a.disabled && (
              <Button variant="ghost" className="text-xs text-rose-600" onClick={() => setConfirmDisable(a)}>
                無効化
              </Button>
            )}
          </div>
        ))}
      </div>

      {confirmDisable && (
        <Modal
          title="アシスタントを無効化"
          onClose={() => setConfirmDisable(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmDisable(null)}>キャンセル</Button>
              <Button
                variant="danger"
                loading={disabling}
                onClick={async () => {
                  setDisabling(true);
                  await api.disableMember(confirmDisable.id, user.id);
                  setDisabling(false);
                  pushToast({ title: `${confirmDisable.name} を無効化しました` });
                  setConfirmDisable(null);
                }}
              >
                無効化する
              </Button>
            </>
          }
        >
          <p className="text-sm">
            <strong>{confirmDisable.name}</strong>（{confirmDisable.email}）を無効化します。
          </p>
          <p className="mt-2 text-xs text-slate-500">
            無効化すると即時に全セッションが失効し、担当企業のチャンネルにアクセスできなくなります。この操作は監査ログに記録されます。
          </p>
        </Modal>
      )}

      {inviteOpen && (
        <Modal
          title="アシスタントを登録"
          onClose={() => setInviteOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setInviteOpen(false)}>キャンセル</Button>
              <Button onClick={invite} disabled={!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)} loading={saving}>登録する</Button>
            </>
          }
        >
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              氏名
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" autoFocus />
            </label>
            <label className="block text-sm font-medium">
              メールアドレス
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="assistant@talkdesk.jp" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
            </label>
            <p className="text-xs text-slate-500">モックのため招待メールは送信されず、即時に登録されます。</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
