import { createContext, useContext } from "react";
import type { Organization } from "../api/types";

export interface OrgCtx {
  org: Organization;
  /** アシスタントは "/w/:orgId"、依頼者は ""、運営は "/ops/orgs/:orgId" */
  basePath: string;
  isAssistantView: boolean;
  /** 運営管理者の読み取り専用ビュー: 投稿・編集・既読反映を一切行わない */
  readOnly?: boolean;
}

export const OrgContext = createContext<OrgCtx | null>(null);

export function useOrgCtx(): OrgCtx {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("OrgContext not provided");
  return ctx;
}
