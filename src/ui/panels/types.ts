import type { Game } from '../../sim/game';

/** Trạng thái thuần giao diện (không lưu vào save). */
export interface UiState {
  /** Khu 3D đang xem (id của Area). */
  area: string;
  /** Panel đang mở trong ngăn kéo (id của Panel), null = đóng. */
  drawer: string | null;
  /** 0 = tạm dừng. */
  speed: number;
  selectedSlot: string | null;
  /** Sạp vừa bấm ngoài chợ; null = panel chợ hiện mọi sạp. */
  selectedStall: string | null;
  /** Đang ở chế độ kéo-thả sắp xếp bàn ghế trong quán. */
  editLayout: boolean;
}

/**
 * Một bảng trong ngăn kéo bên phải. Thêm panel mới: viết file trong thư mục này rồi thêm vào mảng `panels` ở index.ts.
 * render() phải là hàm thuần: chỉ đọc game.state, trả về HTML; tương tác qua cmd()/ui() trong dom.ts.
 */
export interface Panel {
  id: string;
  label: string;
  icon: string;
  /** Số hiện trên nút mở panel (0 = ẩn). */
  badge?(game: Game): number;
  render(game: Game, ui: UiState): string;
}
