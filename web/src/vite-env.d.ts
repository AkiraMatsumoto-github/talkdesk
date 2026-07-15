/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 社内共有ゲートのパスワードのSHA-256ハッシュ（16進小文字）。未設定ならゲート無効 */
  readonly VITE_ACCESS_PASSWORD_SHA256?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
