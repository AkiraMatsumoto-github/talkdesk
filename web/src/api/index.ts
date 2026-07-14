// APIエントリポイント。ここでモック実装を bind している。
// 実API接続時はこのファイルだけ差し替える想定（UI層は src/mocks/ を直接importしない）。

import { setApi, api } from "./client";
import { mockApi } from "../mocks/mockApi";
import { startDemoFeed } from "../mocks/demo";
import { useAuth } from "../stores/auth";

setApi(mockApi);

// デモ用: 相手からの新着メッセージを定期注入（ログイン中ユーザーに合わせて出し分け）
startDemoFeed(() => useAuth.getState().user?.id);

export { api };
export type * from "./types";
export type { ApiEvent, ChannelUnread, FileEntry, NewThreadInput, PermissionChange, TalkdeskApi } from "./client";
