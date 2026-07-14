import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useApiData } from "../hooks/useApiData";
import { useToasts } from "../stores/toast";
import { useOrgCtx } from "../layout/OrgContext";
import { useChannel } from "./ChannelLayout";
import { EmptyState, SkeletonList } from "../components/ui";
import { formatBytes, formatDateTime } from "../utils/format";

const iconFor = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["xlsx", "xls", "csv"].includes(ext)) return "📊";
  if (["pdf"].includes(ext)) return "📄";
  if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext)) return "🖼";
  if (["doc", "docx"].includes(ext)) return "📝";
  return "📎";
};

/** §4.1 ファイルタブ */
export function FilesTab() {
  const { channel } = useChannel();
  const { basePath } = useOrgCtx();
  const [query, setQuery] = useState("");
  const pushToast = useToasts((s) => s.push);

  const files = useApiData(() => api.listFiles(channel.id), [channel.id]);
  const users = useApiData(() => api.listChannelViewers(channel.id), [channel.id]);

  if (!files || !users) return <div className="flex-1"><SkeletonList /></div>;

  // FILE-1: ファイル名の部分一致検索
  const filtered = files.filter((f) => f.attachment.name.toLowerCase().includes(query.toLowerCase()));

  const download = async (id: string, name: string) => {
    // FILE-3 / FR-F2: 都度署名付きURLを取得
    const url = await api.requestDownloadUrl(id);
    pushToast({ title: `「${name}」の署名付きURLを発行しました`, body: `${url}（有効期限10分・モック）`, kind: "success" });
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-slate-200 p-3">
        <div className="relative max-w-md">
          <span className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ファイル名で検索"
            className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {filtered.length === 0 && (
          <EmptyState
            icon="📂"
            title={query ? "一致するファイルがありません" : "ファイルはまだありません"}
            description={query ? "検索条件を変えてお試しください。" : "スレッドに添付されたファイルがここに一覧されます。"}
          />
        )}
        <div className="mx-auto max-w-3xl space-y-1.5">
          {filtered.map((f) => {
            const uploader = users.find((u) => u.id === f.uploadedBy);
            return (
              <div
                key={f.attachment.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-shadow hover:shadow"
              >
                <span className="text-2xl">{iconFor(f.attachment.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-bold">{f.attachment.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">{formatBytes(f.attachment.size)}</span>
                    <span className="shrink-0 text-xs text-slate-400">{formatDateTime(f.uploadedAt)}</span>
                    {uploader && <span className="shrink-0 text-xs text-slate-500">{uploader.name}</span>}
                  </div>
                  {/* FILE-2: 元スレッドへのリンク */}
                  <Link
                    to={`${basePath}/channels/${channel.id}/threads/${f.thread.id}`}
                    className="mt-0.5 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                  >
                    └ {f.thread.type === "request" ? "🧵" : "💬"} {f.thread.title}
                  </Link>
                </div>
                <button
                  onClick={() => download(f.attachment.id, f.attachment.name)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  title="署名付きURLを取得してダウンロード"
                >
                  ⬇
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
