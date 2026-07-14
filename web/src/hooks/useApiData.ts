import { useEffect, useRef, useState, type DependencyList } from "react";
import { api } from "../api";
import type { User } from "../api/types";

/**
 * API取得＋リアルタイム購読フック。
 * APIのイベント（WebSocket相当）を受けるたびに再取得して最新化する。
 */
export function useApiData<T>(fn: () => Promise<T>, deps: DependencyList): T | undefined {
  const [data, setData] = useState<T>();
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    const run = () => {
      fnRef.current()
        .then((d) => {
          if (alive) setData(d);
        })
        .catch(() => {});
    };
    run();
    const unsub = api.subscribe(run);
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}

/**
 * 表示用のユーザー解決（投稿者・更新者・既読者など）。
 * チャンネル閲覧者リストではなく api.getUser で解決するため、
 * 権限剥奪・無効化されたユーザーの過去の発言・更新も正しく表示される。
 */
export function useUsersById(ids: (string | undefined)[]): Record<string, User> | undefined {
  const key = [...new Set(ids.filter((x): x is string => !!x))].sort().join(",");
  return useApiData(async () => {
    const users = await Promise.all(key.split(",").filter(Boolean).map((id) => api.getUser(id)));
    const map: Record<string, User> = {};
    for (const u of users) if (u) map[u.id] = u;
    return map;
  }, [key]);
}
