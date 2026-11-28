/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Máy chủ bạn bè (Supabase) - bỏ trống thì ẩn tính năng Bạn bè. Xem .env.example. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
