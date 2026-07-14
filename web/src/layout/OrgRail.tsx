import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Organization } from "../api/types";
import { useApiData } from "../hooks/useApiData";
import { useAuth } from "../stores/auth";

/** §6 RAIL-1〜3: アシスタントの企業切り替えレール */
export function OrgRail({ orgs, activeOrgId }: { orgs: Organization[]; activeOrgId: string }) {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const unreads = useApiData(
    () => (user ? api.getOrgUnreads(user.id) : Promise.resolve([])),
    [user?.id],
  );

  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-2 bg-slate-950 py-3">
      {orgs.map((org) => {
        const u = unreads?.find((x) => x.channelId === org.id);
        const active = org.id === activeOrgId;
        return (
          <button
            key={org.id}
            onClick={() => navigate(`/w/${org.id}/`)}
            title={org.name}
            className={`relative flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white transition-all ${
              active ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950" : "opacity-70 hover:opacity-100 hover:rounded-lg"
            }`}
            style={{ backgroundColor: org.color }}
          >
            {org.initial}
            {u && u.count > 0 && (
              <span
                className={`absolute -right-1.5 -bottom-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-slate-950 ${
                  u.mention ? "bg-rose-500" : "bg-slate-500"
                }`}
              >
                {u.count > 99 ? "99+" : u.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
