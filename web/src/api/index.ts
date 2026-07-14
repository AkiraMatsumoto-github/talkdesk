// APIエントリポイント。ここでモック実装を bind している。
// 実API接続時はこのファイルだけ差し替える想定。

import { setApi, api } from "./client";
import { mockApi } from "../mocks/mockApi";

setApi(mockApi);

export { api };
export type * from "./types";
export type { ApiEvent, ChannelUnread, FileEntry, NewThreadInput, PermissionChange, TalkdeskApi } from "./client";
