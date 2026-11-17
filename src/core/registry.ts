/** Bảng tra định nghĩa nội dung theo id. Báo lỗi sớm khi trùng id hoặc tra id không tồn tại. */
export class Registry<T extends { id: string }> {
  private map = new Map<string, T>();

  constructor(
    readonly kind: string,
    items: readonly T[],
  ) {
    for (const item of items) {
      if (this.map.has(item.id)) throw new Error(`[${kind}] trùng id "${item.id}"`);
      this.map.set(item.id, item);
    }
  }

  get(id: string): T {
    const item = this.map.get(id);
    if (!item) throw new Error(`[${this.kind}] không có id "${id}"`);
    return item;
  }

  has(id: string): boolean {
    return this.map.has(id);
  }

  all(): T[] {
    return [...this.map.values()];
  }
}
