import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useApiData } from "../hooks/useApiData";
import { useAuth } from "../stores/auth";
import { useToasts } from "../stores/toast";
import { OrgContext, type OrgCtx } from "./OrgContext";
import { ChannelColumn } from "./ChannelColumn";
import { OrgRail } from "./OrgRail";
import { NotificationCenter } from "./NotificationCenter";
import { Avatar, Spinner } from "../components/ui";
import { NotFoundPane } from "../pages/NotFound";
import { HomeRedirect } from "../pages/Home";
import { ChannelLayout } from "../pages/ChannelLayout";
import { ThreadsPane } from "../pages/ThreadList";
import { FilesTab } from "../pages/FilesTab";
import { PagesList } from "../pages/PagesList";
import { PageView } from "../pages/PageView";
import { PageEdit } from "../pages/PageEdit";
import { PageHistory } from "../pages/PageHistory";
import { SettingsProfile, SettingsNotifications } from "../pages/Settings";
import { AdminMembers } from "../pages/AdminMembers";
import { AdminPermissions } from "../pages/AdminPermissions";

export function AppShell() {
  const user = useAuth((s) => s.user);
  const setLastOrg = useAuth((s) => s.setLastOrg);
  const params = useParams<{ orgId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const pushToast = useToasts((s) => s.push);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  // SHELL-4: 切断バナー（モックでは常時接続扱い）
  const [connected] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAssistantView = location.pathname.startsWith("/w/");
  const orgId = user?.role === "assistant" ? params.orgId : user?.orgId;

  const org = useApiData(() => (orgId ? api.getOrg(orgId) : Promise.resolve(undefined)), [orgId]);
  const assignedOrgs = useApiData(
    () => (user?.role === "assistant" ? api.listAssignedOrgs(user.id) : Promise.resolve(undefined)),
    [user?.id, user?.role],
  );

  // アシスタント: 表示中の企業を記憶（RAIL-2 / LOGIN-3）
  useEffect(() => {
    if (user?.role === "assistant" && orgId) setLastOrg(orgId);
  }, [user?.role, orgId, setLastOrg]);

  // NOTIF-1: 表示中の新着はトースト＋通知センター
  useEffect(() => {
    if (!user) return;
    return api.subscribe(async (ev) => {
      if (ev.type !== "message" || ev.message.authorId === user.id || ev.message.system) return;
      const visible = await api.listVisibleChannels(user.id, ev.orgId);
      if (!visible.some((c) => c.id === ev.channelId)) return;
      const [ch, author] = await Promise.all([api.getChannel(ev.channelId), api.getUser(ev.message.authorId)]);
      const base = user.role === "assistant" ? `/w/${ev.orgId}` : "";
      pushToast({
        title: `#${ch?.name ?? ""} ${author?.name ?? ""}`,
        body: ev.message.body,
        to: `${base}/channels/${ev.channelId}/threads/${ev.message.threadId}`,
      });
    });
  }, [user, pushToast]);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const ctx: OrgCtx | null = useMemo(
    () => (org ? { org, basePath: isAssistantView ? `/w/${org.id}` : "", isAssistantView } : null),
    [org, isAssistantView],
  );

  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (user.role === "ops") return <Navigate to="/ops/orgs" replace />;

  // 依頼者が /w/ に入ろうとした場合は404相当（ROUTE-2）
  if (isAssistantView && user.role !== "assistant") return <FullNotFound />;

  // アシスタントがプレフィックスなしで来たら担当企業へ
  if (user.role === "assistant" && !isAssistantView) {
    if (!assignedOrgs) return <FullLoading />;
    const last = useAuth.getState().lastOrgId;
    const target = last && assignedOrgs.some((o) => o.id === last) ? last : assignedOrgs[0]?.id;
    if (!target) return <FullNotFound />;
    return <Navigate to={`/w/${target}/`} replace />;
  }

  // アシスタントが未アサイン企業のURLを開いた場合（ROUTE-2）
  if (user.role === "assistant" && assignedOrgs && orgId && !assignedOrgs.some((o) => o.id === orgId)) {
    return <FullNotFound />;
  }

  if (!ctx) return <FullLoading />;

  const admin = user.role === "admin";

  return (
    <OrgContext.Provider value={ctx}>
      <div className="flex h-full flex-col">
        {/* ヘッダー */}
        <header className="flex h-12 shrink-0 items-center gap-3 bg-slate-900 px-4 text-white">
          <Link to={`${ctx.basePath}/`} className="text-base font-black tracking-tight text-indigo-300">
            talkdesk
          </Link>
          <span className="text-slate-600">|</span>
          {/* SHELL-1: 所属企業名（アシスタントは表示中の企業名） */}
          <span className="truncate text-sm font-bold">{ctx.org.name}</span>
          <div className="ml-auto flex items-center gap-1">
            {/* SHELL-3: 通知センター */}
            <NotificationCenter open={notifOpen} setOpen={setNotifOpen} />
            <Link
              to={`${ctx.basePath}/settings/notifications`}
              className="rounded-md p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white"
              title="通知設定"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            </Link>
            {/* SHELL-2: アバターメニュー */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="ml-1 flex items-center rounded-md p-0.5 hover:bg-slate-700"
                aria-label="アカウントメニュー"
              >
                <Avatar user={user} size={28} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-40 mt-1.5 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-slate-800 shadow-xl">
                  <div className="border-b border-slate-100 px-3 py-2">
                    <div className="text-sm font-bold">{user.name}</div>
                    <div className="truncate text-xs text-slate-500">{user.email}</div>
                  </div>
                  <MenuLink to={`${ctx.basePath}/settings/profile`} onClick={() => setMenuOpen(false)}>プロフィール設定</MenuLink>
                  <MenuLink to={`${ctx.basePath}/settings/notifications`} onClick={() => setMenuOpen(false)}>通知設定</MenuLink>
                  {admin && (
                    <>
                      <div className="my-1 border-t border-slate-100" />
                      <MenuLink to="/admin/members" onClick={() => setMenuOpen(false)}>メンバー管理</MenuLink>
                      <MenuLink to="/admin/permissions" onClick={() => setMenuOpen(false)}>チャンネル権限管理</MenuLink>
                    </>
                  )}
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    className="block w-full px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50"
                    onClick={() => {
                      // 先に /login へ遷移してからログアウト（元URLへの復帰情報を残さない）
                      navigate("/login");
                      setTimeout(() => useAuth.getState().logout(), 0);
                    }}
                  >
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* SHELL-4: 切断バナー（モックでは常時接続のため表示されない） */}
        {!connected && (
          <div className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-xs font-medium text-amber-950">
            <Spinner /> 接続が切れました。再接続しています…
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {/* §6: アシスタントの企業レール */}
          {user.role === "assistant" && <OrgRail orgs={assignedOrgs ?? []} activeOrgId={ctx.org.id} />}
          <ChannelColumn />
          <main className="flex min-w-0 flex-1">
            <Routes>
              <Route index element={<HomeRedirect />} />
              <Route path="channels/:channelId" element={<ChannelLayout />}>
                <Route index element={<ThreadsPane />} />
                <Route path="threads/:threadId" element={<ThreadsPane />} />
                <Route path="files" element={<FilesTab />} />
                <Route path="pages" element={<PagesList />} />
                <Route path="pages/:pageId" element={<PageView />} />
                <Route path="pages/:pageId/edit" element={<PageEdit />} />
                <Route path="pages/:pageId/history" element={<PageHistory />} />
              </Route>
              <Route path="settings/profile" element={<SettingsProfile />} />
              <Route path="settings/notifications" element={<SettingsNotifications />} />
              <Route path="admin/members" element={admin ? <AdminMembers /> : <NotFoundPane />} />
              <Route path="admin/permissions" element={admin ? <AdminPermissions /> : <NotFoundPane />} />
              <Route path="*" element={<NotFoundPane />} />
            </Routes>
          </main>
        </div>
      </div>
    </OrgContext.Provider>
  );
}

function MenuLink({ to, onClick, children }: { to: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link to={to} onClick={onClick} className="block px-3 py-1.5 text-sm hover:bg-slate-50">
      {children}
    </Link>
  );
}

function FullLoading() {
  return (
    <div className="flex h-full items-center justify-center text-slate-400">
      <Spinner />
    </div>
  );
}

function FullNotFound() {
  return (
    <div className="h-full">
      <NotFoundPane />
    </div>
  );
}
