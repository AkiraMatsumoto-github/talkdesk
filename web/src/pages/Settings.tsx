import { useState } from "react";
import { useAuth } from "../stores/auth";
import { useToasts } from "../stores/toast";
import { Avatar, Button } from "../components/ui";

const COLORS = ["#e11d48", "#2563eb", "#7c3aed", "#16a34a", "#ca8a04", "#0891b2", "#db2777", "#475569"];

/** §5.1 プロフィール設定（SET-1, SET-2） */
export function SettingsProfile() {
  const user = useAuth((s) => s.user)!;
  const updateProfile = useAuth((s) => s.updateProfile);
  const pushToast = useToasts((s) => s.push);
  const [name, setName] = useState(user.name);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  return (
    <div className="min-w-0 flex-1 overflow-y-auto bg-slate-50/50">
      <div className="mx-auto max-w-xl px-6 py-6">
        <h1 className="text-lg font-bold">プロフィール設定</h1>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <Avatar user={{ name: name || user.name, color: user.color }} size={56} />
            <div>
              <div className="text-sm font-bold">{name || user.name}</div>
              <div className="text-xs text-slate-400">{user.email}（メールアドレスの変更は将来対応）</div>
            </div>
          </div>
          <label className="mt-4 block text-sm font-medium">
            表示名
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </label>
          <div className="mt-4">
            <span className="text-sm font-medium">アバターカラー</span>
            <div className="mt-1.5 flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateProfile({ color: c })}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${user.color === c ? "ring-2 ring-slate-800 ring-offset-2" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={`カラー ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => {
                updateProfile({ name: name.trim() });
                pushToast({ title: "プロフィールを保存しました", kind: "success" });
              }}
              disabled={!name.trim()}
            >
              保存
            </Button>
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold">パスワード変更</h2>
          <label className="mt-3 block text-sm font-medium">
            現在のパスワード
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
          </label>
          <label className="mt-3 block text-sm font-medium">
            新しいパスワード <span className="font-normal text-slate-400">(8文字以上)</span>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500" />
          </label>
          <div className="mt-4 flex justify-end">
            <Button
              disabled={!current || next.length < 8}
              onClick={() => {
                setCurrent("");
                setNext("");
                pushToast({ title: "パスワードを変更しました（モック）", kind: "success" });
              }}
            >
              変更する
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

/** §5.2 通知設定（NTF-1〜3, UIのみ） */
export function SettingsNotifications() {
  const pushToast = useToasts((s) => s.push);
  const [email, setEmail] = useState(true);
  const [webpush, setWebpush] = useState(true);
  const [digest, setDigest] = useState("10");
  // NTF-2: ブラウザ権限の状態表示
  const permission = typeof Notification !== "undefined" ? Notification.permission : "default";

  return (
    <div className="min-w-0 flex-1 overflow-y-auto bg-slate-50/50">
      <div className="mx-auto max-w-xl px-6 py-6">
        <h1 className="text-lg font-bold">通知設定</h1>
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-600">通知チャネル</h2>

          <label className="mt-3 flex items-start gap-3">
            <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
            <span>
              <span className="block text-sm font-medium">メール通知</span>
              <span className="block text-xs text-slate-500">未読メッセージ・メンションをメールでお知らせします（本文は含まれません）</span>
            </span>
          </label>

          <label className="mt-3 flex items-start gap-3">
            <input type="checkbox" checked={webpush} onChange={(e) => setWebpush(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
            <span className="flex-1">
              <span className="block text-sm font-medium">ブラウザ通知（WebPush）</span>
              <span className="block text-xs text-slate-500">タブが非アクティブなときにプッシュ通知します。購読はデバイスごとです。</span>
              <span className="mt-1.5 flex items-center gap-2 text-xs">
                <span
                  className={`rounded px-1.5 py-px font-medium ${
                    permission === "granted" ? "bg-emerald-100 text-emerald-700" : permission === "denied" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  ブラウザ権限: {permission === "granted" ? "許可済み" : permission === "denied" ? "拒否" : "未設定"}
                </span>
                {permission !== "granted" && (
                  <button
                    className="text-indigo-600 hover:underline"
                    onClick={() => {
                      if (typeof Notification !== "undefined") {
                        void Notification.requestPermission();
                      }
                    }}
                  >
                    許可を再要求
                  </button>
                )}
              </span>
            </span>
          </label>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <label className="flex items-center justify-between gap-3 text-sm font-medium">
              未読をまとめて通知するまでの時間
              <select value={digest} onChange={(e) => setDigest(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500">
                <option value="5">5分</option>
                <option value="10">10分</option>
                <option value="30">30分</option>
                <option value="60">1時間</option>
              </select>
            </label>
            <p className="mt-1.5 text-xs text-slate-500">
              既読にならなかった未読を{digest}分後にまとめて通知します。メンションと担当依頼のステータス変更は即時通知されます。
            </p>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={() => pushToast({ title: "通知設定を保存しました（モック）", kind: "success" })}>保存</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
