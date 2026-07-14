import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { User } from "../api/types";
import { useAuth } from "../stores/auth";
import { Avatar, Button } from "../components/ui";
import { useApiData } from "../hooks/useApiData";

const ROLE_LABEL: Record<User["role"], string> = {
  member: "依頼者（メンバー）",
  admin: "クライアント管理者",
  assistant: "アシスタント",
  ops: "運営管理者",
};

const ROLE_DESC: Record<User["role"], string> = {
  member: "権限のあるチャンネルだけが見えます",
  admin: "メンバー管理・権限管理ができます",
  assistant: "複数企業を切り替えて対応します",
  ops: "企業発行・アサイン管理を行います",
};

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const login = useAuth((s) => s.login);
  const lastOrgId = useAuth((s) => s.lastOrgId);
  const navigate = useNavigate();
  const location = useLocation();
  const demoUsers = useApiData(() => api.listDemoUsers(), []);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = emailValid && password.length > 0 && !submitting;

  const enter = async (user: User) => {
    login(user);
    // 明示的ログアウト直後は元URLへ復帰しない（ROUTE-1の復帰はセッション失効時のみ）
    const explicitLogout = sessionStorage.getItem("talkdesk-explicit-logout");
    sessionStorage.removeItem("talkdesk-explicit-logout");
    const from = explicitLogout ? undefined : (location.state as { from?: string } | null)?.from;
    if (from) {
      navigate(from, { replace: true });
      return;
    }
    // LOGIN-3: ロールに応じて遷移
    if (user.role === "ops") {
      navigate("/ops/orgs", { replace: true });
    } else if (user.role === "assistant") {
      const orgs = await api.listAssignedOrgs(user.id);
      const target = lastOrgId && orgs.some((o) => o.id === lastOrgId) ? lastOrgId : orgs[0]?.id;
      navigate(target ? `/w/${target}/` : "/", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const user = await api.login(email, password);
      await enter(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
      setSubmitting(false);
    }
  };

  const demoLogin = async (u: User) => {
    setSubmitting(true);
    setError("");
    try {
      const user = await api.login(u.email, "demo-password");
      await enter(user);
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight text-indigo-700">talkdesk</h1>
          <p className="mt-1 text-sm text-slate-500">オンラインアシスタントとの窓口</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-slate-700">
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              autoComplete="email"
            />
          </label>
          {email.length > 0 && !emailValid && (
            <p className="mt-1 text-xs text-rose-600">メールアドレスの形式が正しくありません</p>
          )}
          <label className="mt-4 block text-sm font-medium text-slate-700">
            パスワード
            <span className="relative mt-1 block">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                aria-label={showPw ? "パスワードを隠す" : "パスワードを表示"}
              >
                {showPw ? "🙈" : "👁"}
              </button>
            </span>
          </label>

          {error && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              ⚠ {error}
            </div>
          )}

          <Button type="submit" disabled={!canSubmit} loading={submitting} className="mt-4 w-full py-2">
            ログイン
          </Button>
          <div className="mt-3 text-center">
            <Link to="/password-reset" className="text-xs text-indigo-600 hover:underline">
              パスワードをお忘れですか？
            </Link>
          </div>
        </form>

        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            デモユーザーでログイン
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 gap-2">
            {(demoUsers ?? []).map((u) => (
              <button
                key={u.id}
                onClick={() => demoLogin(u)}
                disabled={submitting}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-indigo-300 hover:shadow disabled:opacity-50"
              >
                <Avatar user={u} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm font-bold">{u.name}</span>
                    <span className="rounded bg-indigo-50 px-1.5 py-px text-[11px] font-medium text-indigo-700">
                      {ROLE_LABEL[u.role]}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">{ROLE_DESC[u.role]}</span>
                </span>
                <span className="text-slate-300">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PasswordReset() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold">パスワードリセット</h1>
        {sent ? (
          // RESET-1: アカウント存在を秘匿する同一文言
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            登録されている場合はメールを送信しました。受信トレイをご確認ください。
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">登録済みのメールアドレスを入力してください。</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <Button onClick={() => setSent(true)} disabled={!email} className="mt-3 w-full">
              送信する
            </Button>
          </>
        )}
        <div className="mt-4 text-center">
          <Link to="/login" className="text-xs text-indigo-600 hover:underline">
            ログインへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
