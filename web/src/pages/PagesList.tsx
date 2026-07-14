import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useApiData, useUsersById } from "../hooks/useApiData";
import { useOrgCtx } from "../layout/OrgContext";
import { useChannel } from "./ChannelLayout";
import { Button, EmptyState, SkeletonList } from "../components/ui";
import { formatDateTime } from "../utils/format";

/** §4.2 ナレッジタブ: ページ一覧（KB-2） */
export function PagesList() {
  const { channel } = useChannel();
  const { basePath } = useOrgCtx();
  const [query, setQuery] = useState("");

  const pages = useApiData(() => api.listPages(channel.id), [channel.id]);
  // 更新者の表示は getUser ベース（権限剥奪・無効化済みユーザーの更新も名前を表示できる）
  const usersById = useUsersById((pages ?? []).map((p) => p.updatedBy));

  if (!pages || !usersById) return <div className="flex-1"><SkeletonList /></div>;

  const filtered = pages.filter((p) => p.title.toLowerCase().includes(query.toLowerCase()));
  const base = `${basePath}/channels/${channel.id}/pages`;
  // KB-1: 新規ページは専用ルートで編集し、保存時に初めて作成する（破棄しても空ページを残さない）
  const newPagePath = `${base}/new/edit`;

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 p-3">
        <div className="relative max-w-md flex-1">
          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ページタイトルで検索"
            className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        {/* KB-1: 作成はチャンネル閲覧者全員可（アーカイブ済みは不可） */}
        {!channel.archived && (
          <Link to={newPagePath}>
            <Button>＋ 新規ページ</Button>
          </Link>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {filtered.length === 0 && (
          <EmptyState
            icon="📖"
            title={query ? "一致するページがありません" : "ナレッジページはまだありません"}
            description={query ? undefined : "業務マニュアルや手順をページとして蓄積できます。"}
            action={
              !query && !channel.archived ? (
                <Link to={newPagePath}>
                  <Button>＋ 新規ページ</Button>
                </Link>
              ) : undefined
            }
          />
        )}
        <div className="mx-auto max-w-3xl space-y-1.5">
          {filtered.map((p) => {
            const editor = usersById[p.updatedBy];
            return (
              <Link
                key={p.id}
                to={`${base}/${p.id}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition-shadow hover:shadow"
              >
                <span className="text-2xl">📖</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{p.title}</div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    更新: {formatDateTime(p.updatedAt)} {editor?.name}（rev.{p.rev}）
                  </div>
                </div>
                <span className="text-slate-300">→</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
