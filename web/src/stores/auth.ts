import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../api/types";

interface AuthState {
  user: User | null;
  /** 企業ごとの最後に見たチャンネル（ROUTE-3） */
  lastChannelByOrg: Record<string, string>;
  /** アシスタントが最後に見ていた企業 */
  lastOrgId?: string;
  login: (user: User) => void;
  logout: () => void;
  setLastChannel: (orgId: string, channelId: string) => void;
  setLastOrg: (orgId: string) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      lastChannelByOrg: {},
      lastOrgId: undefined,
      login: (user) => set({ user }),
      logout: () => {
        // 明示的なログアウトを記録（次回ログインで元URLへ復帰させない。ROUTE-1の復帰はセッション失効時のみ）
        sessionStorage.setItem("talkdesk-explicit-logout", "1");
        set({ user: null });
      },
      setLastChannel: (orgId, channelId) =>
        set((s) => ({ lastChannelByOrg: { ...s.lastChannelByOrg, [orgId]: channelId } })),
      setLastOrg: (orgId) => set({ lastOrgId: orgId }),
    }),
    { name: "talkdesk-auth" },
  ),
);
