import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useApiData } from "../hooks/useApiData";
import { useAuth } from "../stores/auth";
import { useOrgCtx } from "./OrgContext";
import { Button, Modal, UnreadBadge } from "../components/ui";

/** §3.1 (A) チャンネル一覧カラム */
export function ChannelColumn() {
  const user = useAuth((s) => s.user)!;
  const { org, basePath } = useOrgCtx();
  const location = useLocation();
  const [archOpen, setArchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const channels = useApiData(() => api.listVisibleChannels(user.id, org.id), [user.id, org.id]);
  const unreads = useApiData(() => api.getChannelUnreads(user.id, org.id), [user.id, org.id]);

  const activeId = location.pathname.match(/\/channels\/([^/]+)/)?.[1];
  const canCreate = user.role === "admin" || user.role === "assistant"; // CH-1 / FR-H9
  const actives = (channels ?? []).filter((c) => !c.archived);
  const archived = (channels ?? []).filter((c) => c.archived);

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-slate-800 text-slate-300 max-lg:hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase">チャンネル</h2>
        {canCreate && (
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
            title="チャンネルを作成"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 2v10M2 7h10" /></svg>
          </button>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {channels === undefined && (
          <div className="animate-pulse space-y-2 px-2 py-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-6 rounded bg-slate-700/60" />
            ))}
          </div>
        )}
        {channels !== undefined && actives.length === 0 && (
          // CH-6: チャンネルゼロの空状態
          <p className="px-2 py-3 text-xs leading-relaxed text-slate-500">
            まだチャンネルがありません。アシスタントが業務チャンネルを作成するのをお待ちください。
          </p>
        )}
        {actives.map((c) => {
          const u = unreads?.find((x) => x.channelId === c.id);
          const hasUnread = (u?.count ?? 0) > 0;
          return (
            <Link
              key={c.id}
              to={`${basePath}/channels/${c.id}`}
              className={`group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm ${
                c.id === activeId
                  ? "bg-indigo-600 font-medium text-white"
                  : hasUnread
                    ? "font-bold text-white hover:bg-slate-700"
                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <span className="text-slate-400 group-hover:text-slate-300">#</span>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              {u && <UnreadBadge count={u.count} mention={u.mention} />}
            </Link>
          );
        })}

        {archived.length > 0 && (
          <div className="mt-3 border-t border-slate-700 pt-2">
            <button
              onClick={() => setArchOpen((v) => !v)}
              className="flex w-full items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-300"
            >
              <span className={`transition-transform ${archOpen ? "rotate-90" : ""}`}>▸</span>
              アーカイブ済み ({archived.length})
            </button>
            {archOpen &&
              archived.map((c) => (
                <Link
                  key={c.id}
                  to={`${basePath}/channels/${c.id}`}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm ${
                    c.id === activeId ? "bg-slate-700 text-white" : "text-slate-500 hover:bg-slate-700"
                  }`}
                >
                  <span>#</span>
                  <span className="min-w-0 flex-1 truncate line-through decoration-slate-600">{c.name}</span>
                  <span className="text-[10px] text-slate-500">📦</span>
                </Link>
              ))}
          </div>
        )}
      </nav>

      {/* CH-5: 管理導線（クライアント管理者のみ） */}
      {user.role === "admin" && (
        <div className="border-t border-slate-700 px-2 py-2">
          <Link to="/admin/members" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-white">
            ⚙ メンバー管理
          </Link>
          <Link to="/admin/permissions" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-white">
            🔒 チャンネル権限管理
          </Link>
        </div>
      )}

      {createOpen && <CreateChannelModal onClose={() => setCreateOpen(false)} />}
    </aside>
  );
}

/** CH-1: チャンネル作成モーダル */
function CreateChannelModal({ onClose }: { onClose: () => void }) {
  const user = useAuth((s) => s.user)!;
  const { org, basePath } = useOrgCtx();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    const ch = await api.createChannel(org.id, name.trim(), desc.trim(), user.id);
    onClose();
    navigate(`${basePath}/channels/${ch.id}`);
  };

  return (
    <Modal
      title="チャンネルを作成"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>キャンセル</Button>
          <Button onClick={create} disabled={!name.trim()} loading={saving}>作成する</Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          チャンネル名
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 給与計算"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            autoFocus
          />
        </label>
        <label className="block text-sm font-medium">
          説明
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="この業務チャンネルの説明"
            rows={2}
            className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
        </label>
        <p className="text-xs text-slate-500">
          作成後、依頼者（メンバー）には権限管理で閲覧権限を付与するまで表示されません。
        </p>
      </div>
    </Modal>
  );
}
