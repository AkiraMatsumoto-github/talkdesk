import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookText } from "lucide-react";
import { api } from "../api";
import { useApiData } from "../hooks/useApiData";
import { useOrgCtx } from "../layout/OrgContext";
import { useChannel } from "./ChannelLayout";
import { Markdown } from "../components/Markdown";
import { Button, SkeletonList } from "../components/ui";
import { formatDateTime } from "../utils/format";
import { NotFoundPane } from "./NotFound";

/** §4.2 ページ閲覧 */
export function PageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const { channel } = useChannel();
  const { basePath } = useOrgCtx();

  const page = useApiData(() => api.getPage(pageId!), [pageId]);
  const editor = useApiData(
    async () => (page ? api.getUser(page.updatedBy) : undefined),
    [page?.updatedBy],
  );

  if (page === undefined) return <div className="flex-1"><SkeletonList /></div>;
  if (!page || page.channelId !== channel.id) return <NotFoundPane />;

  const base = `${basePath}/channels/${channel.id}/pages`;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-3">
        <Link to={base} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="ページ一覧へ戻る"><ArrowLeft size={18} /></Link>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 truncate text-base font-bold"><BookText size={17} className="shrink-0 text-slate-400" /> {page.title}</h2>
          <div className="text-xs text-slate-400">
            最終更新: {formatDateTime(page.updatedAt)} {editor?.name}（rev.{page.rev}）
          </div>
        </div>
        {!channel.archived && (
          <Link to={`${base}/${page.id}/edit`}>
            <Button>編集</Button>
          </Link>
        )}
        <Link to={`${base}/${page.id}/history`}>
          <Button variant="secondary">履歴</Button>
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-3xl">
          {page.body.trim() ? (
            <Markdown>{page.body}</Markdown>
          ) : (
            <p className="text-sm text-slate-400">まだ本文がありません。</p>
          )}
        </div>
      </div>
    </div>
  );
}
