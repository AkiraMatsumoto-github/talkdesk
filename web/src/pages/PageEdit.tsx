import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useApiData } from "../hooks/useApiData";
import { useAuth } from "../stores/auth";
import { useToasts } from "../stores/toast";
import { useOrgCtx } from "../layout/OrgContext";
import { useChannel } from "./ChannelLayout";
import { Markdown } from "../components/Markdown";
import { Button, SkeletonList } from "../components/ui";
import { NotFoundPane } from "./NotFound";

/** §4.2 ページ編集（KB-3: 左右分割ライブプレビュー） */
export function PageEdit() {
  const { pageId } = useParams<{ pageId: string }>();
  const user = useAuth((s) => s.user)!;
  const { channel } = useChannel();
  const { basePath } = useOrgCtx();
  const navigate = useNavigate();
  const pushToast = useToasts((s) => s.push);

  const page = useApiData(() => api.getPage(pageId!), [pageId]);
  const [title, setTitle] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const draftKey = `talkdesk-draft-${pageId}`;

  // 初期値 + ローカル下書き復元（KB-7の下書き保存部分）
  useEffect(() => {
    if (!page || title !== null) return;
    const draft = localStorage.getItem(draftKey);
    if (draft) {
      try {
        const d = JSON.parse(draft) as { title: string; body: string };
        setTitle(d.title);
        setBody(d.body);
        setDraftRestored(true);
        return;
      } catch {
        /* fallthrough */
      }
    }
    setTitle(page.title);
    setBody(page.body);
  }, [page, title, draftKey]);

  // 自動下書き保存
  useEffect(() => {
    if (title === null || body === null) return;
    const t = setTimeout(() => localStorage.setItem(draftKey, JSON.stringify({ title, body })), 400);
    return () => clearTimeout(t);
  }, [title, body, draftKey]);

  if (page === undefined) return <div className="flex-1"><SkeletonList /></div>;
  if (!page || page.channelId !== channel.id || channel.archived) return <NotFoundPane />;
  if (title === null || body === null) return <div className="flex-1"><SkeletonList /></div>;

  const base = `${basePath}/channels/${channel.id}/pages`;

  const save = async () => {
    setSaving(true);
    await api.savePage(page.id, title.trim() || "無題のページ", body, user.id);
    localStorage.removeItem(draftKey);
    pushToast({ title: "ページを保存しました", kind: "success" });
    navigate(`${base}/${page.id}`);
  };

  const discard = () => {
    localStorage.removeItem(draftKey);
    navigate(`${base}/${page.id}`);
  };

  // KB-6: 画像ドラッグ&ドロップ（モック: dataURLで埋め込み）
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    for (const f of Array.from(e.dataTransfer.files)) {
      if (!f.type.startsWith("image/")) {
        pushToast({ title: "画像ファイルのみ添付できます", kind: "error" });
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const md = `\n![${f.name}](${reader.result as string})\n`;
        const ta = taRef.current;
        const pos = ta ? ta.selectionStart : body.length;
        setBody((b) => (b === null ? b : b.slice(0, pos) + md + b.slice(pos)));
      };
      reader.readAsDataURL(f);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-2.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ページタイトル"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-bold outline-none focus:border-indigo-500"
        />
        <Button variant="secondary" onClick={discard}>破棄</Button>
        <Button onClick={save} loading={saving} disabled={!title.trim()}>保存</Button>
      </div>
      {draftRestored && (
        <div className="flex items-center gap-2 border-b border-sky-200 bg-sky-50 px-4 py-1.5 text-xs text-sky-800">
          💾 保存されていない下書きを復元しました。
          <button
            className="font-bold underline"
            onClick={() => {
              localStorage.removeItem(draftKey);
              setTitle(page.title);
              setBody(page.body);
              setDraftRestored(false);
            }}
          >
            元に戻す
          </button>
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-2 max-lg:grid-cols-1">
        <div
          className={`relative flex min-h-0 flex-col border-r border-slate-200 ${dragOver ? "bg-indigo-50" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <textarea
            ref={taRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Markdownで入力…\n\n# 見出し\n- リスト\n| 表 | もOK |\n- [ ] チェックリスト"}
            className="min-h-0 flex-1 resize-none p-4 font-mono text-[13px] leading-relaxed outline-none"
          />
          <div className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
            画像をドラッグ&ドロップで添付できます・編集中はローカルに自動下書き保存されます
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto bg-slate-50/50 p-4 max-lg:hidden">
          <div className="mb-2 text-[11px] font-bold tracking-wide text-slate-400 uppercase">プレビュー</div>
          {body.trim() ? <Markdown>{body}</Markdown> : <p className="text-sm text-slate-400">プレビューがここに表示されます</p>}
        </div>
      </div>
    </div>
  );
}
