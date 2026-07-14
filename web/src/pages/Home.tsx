import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useApiData } from "../hooks/useApiData";
import { useAuth } from "../stores/auth";
import { useOrgCtx } from "../layout/OrgContext";
import { EmptyState, SkeletonList } from "../components/ui";

/** ROUTE-3: `/` は最後に閲覧したチャンネルへリダイレクト */
export function HomeRedirect() {
  const user = useAuth((s) => s.user)!;
  const lastChannelByOrg = useAuth((s) => s.lastChannelByOrg);
  const { org, basePath } = useOrgCtx();
  const navigate = useNavigate();
  const channels = useApiData(() => api.listVisibleChannels(user.id, org.id), [user.id, org.id]);

  useEffect(() => {
    if (!channels) return;
    const actives = channels.filter((c) => !c.archived);
    const last = lastChannelByOrg[org.id];
    const target = last && channels.some((c) => c.id === last) ? last : actives[0]?.id;
    if (target) navigate(`${basePath}/channels/${target}`, { replace: true });
  }, [channels, lastChannelByOrg, org.id, basePath, navigate]);

  if (!channels) return <div className="flex-1"><SkeletonList /></div>;
  if (channels.filter((c) => !c.archived).length === 0) {
    // CH-6: チャンネルゼロ
    return (
      <div className="flex-1">
        <EmptyState
          icon="📮"
          title="チャンネルはまだありません"
          description="アシスタントが業務チャンネルを作成するのをお待ちください。作成されるとここに表示されます。"
        />
      </div>
    );
  }
  return null;
}
