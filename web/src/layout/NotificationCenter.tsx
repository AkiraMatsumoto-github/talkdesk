import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, AtSign, Bell, CircleDot, MessageSquare, type LucideIcon } from "lucide-react";
import { api } from "../api";
import type { AppNotification } from "../api/types";
import { useApiData } from "../hooks/useApiData";
import { useAuth } from "../stores/auth";
import { formatDateTime } from "../utils/format";

const KIND_ICON: Record<AppNotification["kind"], LucideIcon> = {
  mention: AtSign,
  status: CircleDot,
  due: AlertTriangle,
  message: MessageSquare,
};

/** SHELL-3: 通知センター */
export function NotificationCenter({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const notifications = useApiData(
    () => (user ? api.listNotifications(user.id) : Promise.resolve([])),
    [user?.id],
  );
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, setOpen]);

  const openNotification = async (n: AppNotification) => {
    await api.markNotificationRead(n.id);
    setOpen(false);
    const base = user?.role === "assistant" ? `/w/${n.orgId}` : "";
    navigate(`${base}/channels/${n.channelId}/threads/${n.threadId}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white"
        title="通知"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-96 overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-800 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-bold">通知</span>
            {unread > 0 && user && (
              <button
                className="text-xs text-indigo-600 hover:underline"
                onClick={() => api.markAllNotificationsRead(user.id)}
              >
                すべて既読にする
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {(notifications ?? []).length === 0 && (
              <div className="p-6 text-center text-sm text-slate-400">通知はありません</div>
            )}
            {(notifications ?? []).map((n) => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className={`flex w-full items-start gap-2.5 border-b border-slate-50 px-3 py-2.5 text-left hover:bg-slate-50 ${
                  n.read ? "opacity-60" : ""
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    n.kind === "mention"
                      ? "bg-rose-100 text-rose-600"
                      : n.kind === "due"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  {(() => {
                    const Icon = KIND_ICON[n.kind];
                    return <Icon size={13} />;
                  })()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] leading-snug">{n.text}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</span>
                </span>
                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
