import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";

/** ROUTE-2: 権限のないルートは404相当（403で存在を教えない） */
export function NotFoundPane() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 bg-white p-8 text-center">
      <FileQuestion size={48} strokeWidth={1.5} className="text-slate-300" />
      <h1 className="text-lg font-bold text-slate-700">ページが見つかりません</h1>
      <p className="text-sm text-slate-500">
        URLが間違っているか、ページが存在しません。
      </p>
      <Link to="/" className="text-sm font-medium text-indigo-600 hover:underline">
        ホームへ戻る
      </Link>
    </div>
  );
}
