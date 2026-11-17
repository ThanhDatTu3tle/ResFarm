/** Event bus có kiểu. E là map `tên sự kiện -> payload`. */
export class EventBus<E extends object> {
  private handlers = new Map<keyof E, Set<(payload: never) => void>>();

  /** Đăng ký lắng nghe; trả về hàm huỷ đăng ký. */
  on<K extends keyof E>(type: K, fn: (payload: E[K]) => void): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn as (payload: never) => void);
    return () => set.delete(fn as (payload: never) => void);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of set) (fn as (payload: E[K]) => void)(payload);
  }
}
