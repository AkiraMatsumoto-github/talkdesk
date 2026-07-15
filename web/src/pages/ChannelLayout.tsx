import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useOutletContext, useParams } from "react-router-dom";
import { Archive } from "lucide-react";
import { api } from "../api";
import type { Channel } from "../api/types";
import { useApiData } from "../hooks/useApiData";
import { useAuth } from "../stores/auth";
import { useOrgCtx } from "../layout/OrgContext";
import { SkeletonList } from "../components/ui";
import { NotFoundPane } from "./NotFound";

export interface ChannelCtx {
  channel: Channel;
}

export function useChannel(): ChannelCtx {
  return useOutletContext<ChannelCtx>();
}

/** §3.2 TL-1: チャンネル配下のタブ切替（スレッド/ファイル/ナレッジ） */
export function ChannelLayout() {
  const user = useAuth((s) => s.user)!;
  const { org, basePath } = useOrgCtx();
  const { channelId } = useParams<{ channelId: string }>();
  const setLastChannel = useAuth((s) => s.setLastChannel);
  const location = useLocation();

  // 閲覧権限のあるチャンネルかどうかで404相当を出し分け（ROUTE-2 / FR-H1）
  const channels = useApiData(() => api.listVisibleChannels(user.id, org.id), [user.id, org.id]);
  const channel = channels?.find((c) => c.id === channelId);

  useEffect(() => {
    if (channel) setLastChannel(org.id, channel.id);
  }, [channel, org.id, setLastChannel]);

  if (!channels) return <div className="flex-1"><SkeletonList /></div>;
  if (!channel) return <NotFoundPane />;

  const base = `${basePath}/channels/${channel.id}`;
  const isThreads = !/\/(files|pages)/.test(location.pathname);

  const tabCls = (active: boolean) =>
    `border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
      active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"
    }`;

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-white">
      <div className="flex shrink-0 items-center gap-4 border-b border-slate-200 px-4 pt-2">
        <h1 className="flex items-baseline gap-2 pb-2 text-base font-bold">
          <span className="text-slate-400">#</span>
          {channel.name}
          {channel.description && (
            <span className="hidden max-w-xs truncate text-xs font-normal text-slate-400 xl:inline">
              {channel.description}
            </span>
          )}
        </h1>
        <nav className="ml-auto flex">
          <NavLink to={base} end={false} className={tabCls(isThreads)}>
            スレッド
          </NavLink>
          <NavLink to={`${base}/files`} className={({ isActive }) => tabCls(isActive)}>
            ファイル
          </NavLink>
          <NavLink
            to={`${base}/pages`}
            className={tabCls(location.pathname.includes("/pages"))}
          >
            ナレッジ
          </NavLink>
        </nav>
      </div>

      {/* CH-4: アーカイブ済みは読み取り専用 */}
      {channel.archived && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
          <Archive size={13} className="shrink-0" /> このチャンネルはアーカイブされています（読み取り専用・投稿や編集はできません）
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <Outlet context={{ channel } satisfies ChannelCtx} />
      </div>
    </div>
  );
}
