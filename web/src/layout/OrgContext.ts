import { createContext, useContext } from "react";
import type { Organization } from "../api/types";

export interface OrgCtx {
  org: Organization;
  /** アシスタントは "/w/:orgId"、依頼者は "" */
  basePath: string;
  isAssistantView: boolean;
}

export const OrgContext = createContext<OrgCtx | null>(null);

export function useOrgCtx(): OrgCtx {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("OrgContext not provided");
  return ctx;
}
