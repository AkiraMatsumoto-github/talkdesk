import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useApiData } from "../hooks/useApiData";
import { useAuth } from "../stores/auth";
import { useToasts } from "../stores/toast";
import { useOrgCtx } from "../layout/OrgContext";
import { Avatar, Button, Modal, SkeletonList } from "../components/ui";

const key = (channelId: string, userId: string) => `${channelId}:${userId}`;

/** §5.4 チャンネル権限マトリクス（クライアント管理者のみ） */
export function AdminPermissions() {
  const user = useAuth((s) => s.user)!;
  const { org } = useOrgCtx();
  const pushToast = useToasts((s) => s.push);

  const members = useApiData(() => api.listMembers(org.id), [org.id]);
  const channels = useApiData(() => api.listVisibleChannels(user.id, org.id), [user.id, org.id]);
  const grants = useApiData(() => api.listChannelGrants(org.id), [org.id]);

  // 編集中の状態（保存で一括反映 PERM-2）
  const [edits, setEdits] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const original = useMemo(() => {
    const set = new Set<string>();
    (grants ?? []).forEach((g) => set.add(key(g.channelId, g.userId)));
    return set;
  }, [grants]);

  const dirty = Object.entries(edits).filter(([k, v]) => original.has(k) !== v);

  // PERM-2: 未保存で離脱時の警告
  useEffect(() => {
    if (dirty.length === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty.length]);

  if (!members || !channels || !grants) return <div className="flex-1"><SkeletonList /></div>;

  const activeMembers = members.filter((m) => !m.disabled);
  const targetChannels = channels.filter((c) => !c.archived);

  const isChecked = (channelId: string, userId: string) => {
    const k = key(channelId, userId);
    return k in edits ? edits[k] : original.has(k);
  };

  const toggle = (channelId: string, userId: string) => {
    const k = key(channelId, userId);
    setEdits((e) => ({ ...e, [k]: !isChecked(channelId, userId) }));
  };

  // PERM-4: 差分の文章化
  const diffTexts = dirty.map(([k, granted]) => {
    const [channelId, userId] = k.split(":");
    const ch = channels.find((c) => c.id === channelId);
    const m = members.find((x) => x.id === userId);
    return granted
      ? `${m?.name}さんに #${ch?.name} の閲覧権限を付与します`
      : `${m?.name}さんから #${ch?.name} の閲覧権限を外します`;
  });

  const save = async () => {
    setSaving(true);
    await api.savePermissions(
      org.id,
      dirty.map(([k, granted]) => {
        const [channelId, userId] = k.split(":");
        return { channelId, userId, granted };
      }),
      user.id,
    );
    setEdits({});
    setSaving(false);
    setConfirmOpen(false);
    // PERM-3: 剥奪されたユーザーの画面からは即時消える（モックでもWebSocket相当のイベントで反映）
    pushToast({ title: "チャンネル権限を保存しました", body: "変更は対象ユーザーの画面に即時反映されます", kind: "success" });
  };

  return (
    <div className="min-w-0 flex-1 overflow-y-auto bg-slate-50/50">
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">チャンネル権限マトリクス</h1>
          <div className="flex items-center gap-3">
            {dirty.length > 0 && <span className="text-xs font-medium text-amber-600">未保存の変更が{dirty.length}件あります</span>}
            <Button onClick={() => setConfirmOpen(true)} disabled={dirty.length === 0}>変更を保存</Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          🛡 メンバーごとのチャンネル閲覧権限を管理します。管理者は常に全チャンネルを閲覧できます。権限変更は監査ログに記録されます。
        </p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-2.5 text-left font-bold text-slate-600">チャンネル</th>
                {activeMembers.map((m) => (
                  <th key={m.id} className="px-3 py-2.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Avatar user={m} size={26} />
                      <span className="text-xs font-bold whitespace-nowrap">
                        {m.name.split(" ")[0]}
                        {m.role === "admin" && <span className="ml-0.5 text-[10px] font-normal text-indigo-500">(管理者)</span>}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {targetChannels.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">
                    <span className="text-slate-400"># </span>
                    {c.name}
                  </td>
                  {activeMembers.map((m) =>
                    m.role === "admin" ? (
                      // PERM-1: 管理者は固定
                      <td key={m.id} className="px-3 py-2.5 text-center">
                        <span className="text-xs text-slate-400" title="管理者は常に全チャンネルを閲覧できます">✓ 固定</span>
                      </td>
                    ) : (
                      <td key={m.id} className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked(c.id, m.id)}
                          onChange={() => toggle(c.id, m.id)}
                          className={`h-4 w-4 cursor-pointer accent-indigo-600 ${
                            key(c.id, m.id) in edits && original.has(key(c.id, m.id)) !== edits[key(c.id, m.id)]
                              ? "ring-2 ring-amber-400 ring-offset-1"
                              : ""
                          }`}
                          aria-label={`${m.name} × ${c.name}`}
                        />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PERM-4: 保存前の差分確認ダイアログ */}
      {confirmOpen && (
        <Modal
          title="権限変更の確認"
          onClose={() => setConfirmOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>キャンセル</Button>
              <Button onClick={save} loading={saving}>保存する</Button>
            </>
          }
        >
          <p className="text-sm">以下の{diffTexts.length}件の変更を保存します。</p>
          <ul className="mt-2 space-y-1.5">
            {diffTexts.map((t, i) => (
              <li key={i} className={`rounded-lg px-3 py-1.5 text-sm ${t.includes("外します") ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                {t.includes("外します") ? "− " : "＋ "}
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            権限を外されたメンバーの画面からは、該当チャンネルが即時に見えなくなります。
          </p>
        </Modal>
      )}
    </div>
  );
}
