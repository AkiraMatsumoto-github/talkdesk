import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { PageRevision } from "../api/types";
import { useApiData, useUsersById } from "../hooks/useApiData";
import { useAuth } from "../stores/auth";
import { useToasts } from "../stores/toast";
import { useOrgCtx } from "../layout/OrgContext";
import { useChannel } from "./ChannelLayout";
import { ArrowLeft, BookText } from "lucide-react";
import { Markdown } from "../components/Markdown";
import { Button, Modal, SkeletonList } from "../components/ui";
import { formatDateTime } from "../utils/format";
import { NotFoundPane } from "./NotFound";

/** §4.2 ページ編集履歴（KB-4 / FR-K3） */
export function PageHistory() {
  const { pageId } = useParams<{ pageId: string }>();
  const user = useAuth((s) => s.user)!;
  const { channel } = useChannel();
  const { basePath } = useOrgCtx();
  const navigate = useNavigate();
  const pushToast = useToasts((s) => s.push);

  const page = useApiData(() => api.getPage(pageId!), [pageId]);
  // 各revの編集者は getUser ベースで解決（権限剥奪・無効化済みでも履歴の編集者名が残る）
  const usersById = useUsersById(page ? [page.updatedBy, ...page.revisions.map((r) => r.authorId)] : []);
  const [selectedRev, setSelectedRev] = useState<number | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<PageRevision | null>(null);
  const [restoring, setRestoring] = useState(false);

  if (page === undefined || !usersById) return <div className="flex-1"><SkeletonList /></div>;
  if (!page || page.channelId !== channel.id) return <NotFoundPane />;

  const base = `${basePath}/channels/${channel.id}/pages`;

  // rev一覧（現行版＋過去版、新しい順）
  const current: PageRevision = { rev: page.rev, title: page.title, body: page.body, authorId: page.updatedBy, savedAt: page.updatedAt };
  const revisions = [current, ...[...page.revisions].sort((a, b) => b.rev - a.rev)];
  const selected = revisions.find((r) => r.rev === (selectedRev ?? page.rev)) ?? current;
  const nameOf = (id: string) => usersById[id]?.name ?? "不明";

  const restore = async (r: PageRevision) => {
    setRestoring(true);
    await api.restoreRevision(page.id, r.rev, user.id);
    pushToast({ title: `rev.${r.rev} を復元しました（新しい版として保存）`, kind: "success" });
    navigate(`${base}/${page.id}`);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3">
        <Link to={`${base}/${page.id}`} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="ページへ戻る"><ArrowLeft size={18} /></Link>
        <h2 className="flex min-w-0 flex-1 items-center gap-2 truncate text-base font-bold"><BookText size={17} className="shrink-0 text-slate-400" /> {page.title} の編集履歴</h2>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="w-72 shrink-0 overflow-y-auto border-r border-slate-200">
          {revisions.map((r) => (
            <button
              key={r.rev}
              onClick={() => setSelectedRev(r.rev)}
              className={`block w-full border-b border-slate-100 px-4 py-3 text-left ${
                selected.rev === r.rev ? "bg-indigo-50" : "hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">rev.{r.rev}</span>
                {r.rev === page.rev && (
                  <span className="rounded bg-emerald-100 px-1.5 py-px text-[10px] font-bold text-emerald-700">現行版</span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                {formatDateTime(r.savedAt)}・{nameOf(r.authorId)}
              </div>
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-2">
            <span className="text-sm text-slate-500">
              rev.{selected.rev}（{formatDateTime(selected.savedAt)}・{nameOf(selected.authorId)}）
            </span>
            {selected.rev !== page.rev && !channel.archived && (
              <Button variant="secondary" onClick={() => setConfirmRestore(selected)} className="ml-auto text-xs">
                この版に復元
              </Button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="mx-auto max-w-3xl">
              <Markdown>{selected.body}</Markdown>
            </div>
          </div>
        </div>
      </div>

      {confirmRestore && (
        <Modal
          title="過去の版に復元"
          onClose={() => setConfirmRestore(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmRestore(null)}>キャンセル</Button>
              <Button onClick={() => restore(confirmRestore)} loading={restoring}>復元する</Button>
            </>
          }
        >
          <p className="text-sm">
            rev.{confirmRestore.rev} の内容を復元します。現在の内容は失われず、復元は<strong>新しい版（rev.{page.rev + 1}）</strong>として保存されます。
          </p>
        </Modal>
      )}
    </div>
  );
}
