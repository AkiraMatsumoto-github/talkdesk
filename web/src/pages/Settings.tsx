import { useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../stores/auth";
import { useToasts } from "../stores/toast";
import { Avatar, Button } from "../components/ui";

const COLORS = ["#e11d48", "#2563eb", "#7c3aed", "#16a34a", "#ca8a04", "#0891b2", "#db2777", "#475569"];

/** §5.1 プロフィール設定（SET-1, SET-2） */
export function SettingsProfile() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.login);
  const pushToast = useToasts((s) => s.push);
  const [name, setName] = useState(user.name);
  const [color, setColor] = useState(user.color);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // SET-1: アバター画像（モックではdataURLとして保持）
  const pickAvatar = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      pushToast({ title: "画像ファイルを選択してください", kind: "error" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      pushToast({ title: "アバター画像は2MB以内にしてください", kind: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  // API経由で更新 → db.users にも反映され、過去メッセージ・メンバー管理の表示も追随する
  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateProfile(user.id, { name: name.trim(), color, avatarUrl });
      setUser({ ...updated });
      pushToast({ title: "プロフィールを保存しました", kind: "success" });
    } catch (e) {
      pushToast({ title: e instanceof Error ? e.message : "保存に失敗しました", kind: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 flex-1 overflow-y-auto bg-slate-50/50">
      <div className="mx-auto max-w-xl px-6 py-6">
        <h1 className="text-lg font-bold">プロフィール設定</h1>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <Avatar user={{ name: name || user.name, color, avatarUrl }} size={56} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{name || user.name}</div>
              <div className="truncate text-xs text-slate-400">{user.email}（メールアドレスの変更は将来対応）</div>
              <div className="mt-1.5 flex gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    pickAvatar(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  画像をアップロード
                </button>
                {avatarUrl && (
                  <button
                    onClick={() => setAvatarUrl(undefined)}
                    className="rounded-lg px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                  >
                    画像を削除
                  </button>
                )}
              </div>
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
            <span className="text-sm font-medium">アバターカラー <span className="font-normal text-slate-400">(画像未設定のとき使用)</span></span>
            <div className="mt-1.5 flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${color === c ? "ring-2 ring-slate-800 ring-offset-2" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={`カラー ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={save} loading={saving} disabled={!name.trim()}>
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
