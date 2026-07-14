import { useEffect, useRef, useState, type DependencyList } from "react";
import { api } from "../api";

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
