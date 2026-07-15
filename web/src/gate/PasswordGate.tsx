import { useEffect, useState, type ReactNode } from "react";

/**
 * 社内共有用の簡易アクセスゲート。
 *
 * ⚠ 本物のセキュリティではない: このアプリはバックエンドのないCSRのSPAのため、
 * 突破判定はブラウザ側で行われる。「URLを知っただけの人に中身を見せない」程度の
 * casualな門であり、devtoolsを開くような相手は想定しない。
 *
 * パスワードの平文はコード・バンドルに残さず、SHA-256ハッシュ（16進）を
 * ビルド時環境変数 VITE_ACCESS_PASSWORD_SHA256 で受け取り、入力値のハッシュと比較する。
 * 環境変数が未設定ならゲートは無効（開発時に素通し）。本番Vercelでは必ず設定すること。
 */

const EXPECTED_HASH = (import.meta.env.VITE_ACCESS_PASSWORD_SHA256 ?? "")
  .trim()
  .toLowerCase();
const STORAGE_KEY = "talkdesk-gate";

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function PasswordGate({ children }: { children: ReactNode }) {
  // 環境変数未設定ならゲート無効（開発時の素通し）
  const [unlocked, setUnlocked] = useState(() => {
    if (!EXPECTED_HASH) return true;
    return localStorage.getItem(STORAGE_KEY) === EXPECTED_HASH;
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  // パスワードが変更（EXPECTED_HASHが変わった）されたら過去の解錠を無効化
  useEffect(() => {
    if (!EXPECTED_HASH) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved !== EXPECTED_HASH) {
      localStorage.removeItem(STORAGE_KEY);
      setUnlocked(false);
    }
  }, []);

  if (unlocked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || checking) return;
    setChecking(true);
    setError("");
    const hash = await sha256Hex(password);
    if (hash === EXPECTED_HASH) {
      localStorage.setItem(STORAGE_KEY, hash);
      setUnlocked(true);
    } else {
      setError("パスワードが違います");
      setPassword("");
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight text-indigo-700">talkdesk</h1>
          <p className="mt-1 text-sm text-slate-500">社内共有モック（プレビュー）</p>
        </div>
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-slate-700">
            アクセスパスワード
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="共有されたパスワードを入力"
            />
          </label>
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={!password || checking}
            className="mt-4 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {checking ? "確認中…" : "入室する"}
          </button>
          <p className="mt-4 text-center text-xs text-slate-400">
            このページは開発中モックの限定共有です
          </p>
        </form>
      </div>
    </div>
  );
}
