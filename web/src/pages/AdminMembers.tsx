import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { User } from "../api/types";
import { useApiData } from "../hooks/useApiData";
import { useAuth } from "../stores/auth";
import { useToasts } from "../stores/toast";
import { useOrgCtx } from "../layout/OrgContext";
import { Avatar, Button, Modal, SkeletonList } from "../components/ui";
import { formatDateTime } from "../utils/format";

/** §5.3 メンバー管理（クライアント管理者のみ） */
export function AdminMembers() {
  const user = useAuth((s) => s.user)!;
  const { org } = useOrgCtx();
  const pushToast = useToasts((s) => s.push);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState<User | null>(null);

  const members = useApiData(() => api.listMembers(org.id), [org.id]);
  const invitations = useApiData(() => api.listInvitations(org.id), [org.id]);
  const audits = useApiData(() => api.listAuditLogs(org.id), [org.id]);

  if (!members || !invitations) return <div className="flex-1"><SkeletonList /></div>;

  return (
    <div className="min-w-0 flex-1 overflow-y-auto bg-slate-50/50">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">メンバー管理</h1>
          <Button onClick={() => setInviteOpen(true)}>＋ 招待</Button>
        </div>
        {/* MEM-4: 監査ログの明記 */}
        <p className="mt-1 text-xs text-slate-500">
          🛡 この画面での操作（招待・ロール変更・無効化）はすべて監査ログに記録されます。
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} me={user} onDisable={() => setConfirmDisable(m)} />
          ))}
          {/* MEM-3: 招待中 */}
          {invitations.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-md border-2 border-dashed border-slate-300 text-slate-400">✉</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-600">{inv.email}</span>
                  <span className="rounded bg-amber-100 px-1.5 py-px text-[11px] font-bold text-amber-700">招待中</span>
                  {inv.role === "admin" && <span className="rounded bg-indigo-100 px-1.5 py-px text-[11px] text-indigo-700">管理者</span>}
                </div>
                <div className="text-xs text-slate-400">招待日時: {formatDateTime(inv.invitedAt)}（有効期限7日）</div>
              </div>
              <Button
                variant="secondary"
                className="text-xs"
                onClick={async () => {
                  await api.resendInvitation(inv.id);
                  pushToast({ title: `${inv.email} に招待メールを再送しました`, kind: "success" });
                }}
              >
                再送
              </Button>
              <Button
                variant="ghost"
                className="text-xs text-rose-600"
                onClick={async () => {
                  await api.cancelInvitation(inv.id, user.id);
                  pushToast({ title: "招待を取り消しました" });
                }}
              >
                取消
              </Button>
            </div>
          ))}
        </div>

        {/* 監査ログ（FR-P4） */}
        {audits && audits.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-bold text-slate-600">監査ログ</h2>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {audits.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-baseline gap-3 border-b border-slate-50 px-4 py-2 text-xs last:border-b-0">
                  <span className="shrink-0 text-slate-400">{formatDateTime(a.createdAt)}</span>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-px font-medium text-slate-600">{a.action}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-600">{a.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} />}

      {/* MEM-2: 無効化確認 */}
      {confirmDisable && (
        <Modal
          title="メンバーを無効化"
          onClose={() => setConfirmDisable(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmDisable(null)}>キャンセル</Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await api.disableMember(confirmDisable.id, user.id);
                  setConfirmDisable(null);
                  pushToast({ title: `${confirmDisable.name} を無効化しました` });
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
            無効化すると即時に全セッションが失効し、ログインできなくなります。この操作は監査ログに記録されます。
          </p>
        </Modal>
      )}
    </div>
  );
}

function MemberRow({ member: m, me, onDisable }: { member: User; me: User; onDisable: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pushToast = useToasts((s) => s.push);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  return (
    <div className={`flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 ${m.disabled ? "opacity-50" : ""}`}>
      <Avatar user={m} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-bold">{m.name}</span>
          {m.role === "admin" && <span className="rounded bg-indigo-100 px-1.5 py-px text-[11px] font-bold text-indigo-700">管理者</span>}
          {m.id === me.id && <span className="text-[11px] text-slate-400">(自分)</span>}
        </div>
        <div className="truncate text-xs text-slate-400">{m.email}</div>
      </div>
      <span className={`text-xs ${m.disabled ? "text-rose-500" : "text-emerald-600"}`}>
        {m.disabled ? "無効" : "アクティブ"}
      </span>
      {/* MEM-2: ⋮メニュー */}
      {m.id !== me.id && !m.disabled && (
        <div className="relative" ref={ref}>
          <button onClick={() => setMenuOpen((v) => !v)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100" aria-label="メンバーメニュー">⋮</button>
          {menuOpen && (
            <div className="absolute right-0 z-30 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {m.role === "member" ? (
                <button
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                  onClick={async () => {
                    setMenuOpen(false);
                    await api.setMemberRole(m.id, "admin", me.id);
                    pushToast({ title: `${m.name} を管理者に昇格しました` });
                  }}
                >
                  管理者に昇格
                </button>
              ) : (
                <button
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                  onClick={async () => {
                    setMenuOpen(false);
                    await api.setMemberRole(m.id, "member", me.id);
                    pushToast({ title: `${m.name} をメンバーに降格しました` });
                  }}
                >
                  メンバーに降格
                </button>
              )}
              <button
                className="block w-full px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50"
                onClick={() => {
                  setMenuOpen(false);
                  onDisable();
                }}
              >
                無効化…
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** MEM-1: メール招待（複数可・ロール選択） */
function InviteModal({ onClose }: { onClose: () => void }) {
  const user = useAuth((s) => s.user)!;
  const { org } = useOrgCtx();
  const pushToast = useToasts((s) => s.push);
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [saving, setSaving] = useState(false);

  const list = emails
    .split(/[\n,、]/)
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));

  const invite = async () => {
    setSaving(true);
    await api.inviteMembers(org.id, list, role, user.id);
    pushToast({ title: `${list.length}件の招待メールを送信しました`, kind: "success" });
    onClose();
  };

  return (
    <Modal
      title="メンバーを招待"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>キャンセル</Button>
          <Button onClick={invite} disabled={list.length === 0} loading={saving}>
            {list.length > 0 ? `${list.length}件を招待` : "招待"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          メールアドレス <span className="font-normal text-slate-400">(改行またはカンマ区切りで複数可)</span>
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            rows={4}
            placeholder={"tanaka@example.com\nsuzuki@example.com"}
            className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            autoFocus
          />
        </label>
        <div>
          <span className="text-sm font-medium">ロール</span>
          <div className="mt-1 flex gap-2">
            {(
              [
                { key: "member", label: "メンバー", desc: "権限のあるチャンネルのみ閲覧" },
                { key: "admin", label: "管理者", desc: "全チャンネル閲覧・メンバー管理" },
              ] as const
            ).map((r) => (
              <button
                key={r.key}
                onClick={() => setRole(r.key)}
                className={`flex-1 rounded-xl border-2 p-2.5 text-left ${role === r.key ? "border-indigo-600 bg-indigo-50" : "border-slate-200 hover:border-slate-300"}`}
              >
                <div className="text-sm font-bold">{r.label}</div>
                <div className="mt-0.5 text-xs text-slate-500">{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500">招待リンクの有効期限は7日間です。操作は監査ログに記録されます。</p>
      </div>
    </Modal>
  );
}
