import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Inbox, MessageSquare, X } from "lucide-react";
import type { ThreadStatus, ThreadType, User } from "../api/types";
import { useToasts } from "../stores/toast";

// ---- スレッド種別アイコン（🧵依頼 / 💬トピック の置き換え） ----

export function ThreadTypeIcon({
  type,
  size = 16,
  className = "",
}: {
  type: ThreadType;
  size?: number;
  className?: string;
}) {
  const Icon = type === "request" ? ClipboardList : MessageSquare;
  return <Icon size={size} className={`inline shrink-0 ${className}`} />;
}

// ---- アバター ----

export function Avatar({
  user,
  size = 32,
}: {
  user: Pick<User, "name" | "color"> & { avatarUrl?: string };
  size?: number;
}) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        title={user.name}
        className="shrink-0 rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md font-bold text-white select-none"
      style={{ width: size, height: size, backgroundColor: user.color, fontSize: size * 0.44 }}
      title={user.name}
    >
      {user.name.charAt(0)}
    </span>
  );
}

// ---- ステータスバッジ ----

const STATUS_STYLE: Record<ThreadStatus, { label: string; cls: string; dot: string }> = {
  open: { label: "依頼中", cls: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  in_progress: { label: "対応中", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  awaiting_review: { label: "確認待ち", cls: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  done: { label: "完了", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
};

export const statusLabel = (s: ThreadStatus) => STATUS_STYLE[s].label;

export function StatusBadge({ status, size = "md" }: { status: ThreadStatus; size?: "sm" | "md" }) {
  const st = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap ${st.cls} ${
        size === "sm" ? "px-1.5 py-px text-[11px]" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
      {st.label}
    </span>
  );
}

// ---- モーダル ----

export function Modal({
  title,
  children,
  onClose,
  footer,
  wide,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={onClose}>
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} rounded-xl bg-white shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="閉じる">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---- ボタン ----

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  loading,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
    ghost: "text-slate-600 hover:bg-slate-100",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={`${base} ${variants[variant]} ${className}`}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ---- 空状態・スケルトン ----

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-slate-300">{icon ?? <Inbox size={40} strokeWidth={1.5} />}</div>
      <div className="font-bold text-slate-700">{title}</div>
      {description && <div className="max-w-sm text-sm text-slate-500">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3.5 w-2/3 rounded bg-slate-200" />
          <div className="h-3 w-5/6 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

// ---- トースト ----

export function ToastStack() {
  const { toasts, remove } = useToasts();
  const navigate = useNavigate();
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto cursor-pointer rounded-lg border p-3 shadow-lg transition hover:shadow-xl ${
            t.kind === "error" ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"
          }`}
          onClick={() => {
            if (t.to) navigate(t.to);
            remove(t.id);
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className={`text-sm font-bold ${t.kind === "error" ? "text-rose-700" : "text-slate-800"}`}>{t.title}</div>
            <button
              className="text-slate-400 hover:text-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                remove(t.id);
              }}
              aria-label="閉じる"
            >
              <X size={14} />
            </button>
          </div>
          {t.body && <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.body}</div>}
        </div>
      ))}
    </div>
  );
}

// ---- 未読バッジ ----

export function UnreadBadge({ count, mention }: { count: number; mention?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-px text-[11px] font-bold text-white ${
        mention ? "bg-rose-500" : "bg-slate-400"
      }`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
