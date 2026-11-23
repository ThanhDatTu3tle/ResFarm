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
  /** Bảng Cài đặt (nút bánh răng) đang mở — game tạm dừng trong lúc mở. */
  settings: boolean;
  /**
   * Bảng Nông trại chỉ hiện một loại ô (SlotType) hoặc một loại cối (MillType) — khi người chơi bấm vào ô / cối / chỗ mở rộng
   * trong cảnh 3D. null = hiện tất cả (mở từ nút Nông trại).
   */
  farmFocus: string | null;
  /** Tooltip nguồn nguyên liệu đang mở (bấm tag nguyên liệu ở bảng Đơn hàng): "<id đơn>:<id món>". */
  itemTip?: string | null;
  /** Bàn (id) hoặc đồ trang trí (uid) đang chọn ở chế độ sắp xếp — thanh trên cùng hiện nút xoay / cất / bán. */
  editSelected: string | null;
  /** Chế độ chụp ảnh: ẩn hết bảng biểu, chỉ còn cảnh 3D + nút chụp. */
  photo: boolean;
  /** Đang mở bảng chi tiết nhiệm vụ. */
  questOpen: boolean;
  /** Bảng gọi món cho cả đội ở chợ: đang mở không, đang chọn cho ai, chỉ hiện thực đơn của hàng nào (null = mọi hàng). */
  mealOpen: boolean;
  mealWho: string | null;
  mealStall: string | null;
  /** Đang xem bên trong quầy nào ở chợ (khu 'stall'), và món đang chọn mua trong quầy. */
  stallView: string | null;
  buyItem: string | null;
  /** Đang mở hướng dẫn chơi (số trang), null = đóng. */
  guide: number | null;
  /** Cuốn lịch (nút 📅 trên đồng hồ): số mùa lệch so với mùa hiện tại đang xem, null = đóng. Mở lịch thì game tạm dừng. */
  calendar: number | null;
  /** Hộp đổi tên quán đang mở (giữ tên lúc mở làm giá trị ban đầu), null = đóng. Thay cho window.prompt (điện thoại / app cài lên
   *  màn hình chính / trình duyệt trong Zalo, Messenger hay chặn hộp prompt nên bấm không thấy gì). */
  rename: string | null;
  /** Hộp đổi tên đang đổi tên gì: quán (biển hiệu) hay chủ quán (tên trên đầu nhân vật). */
  renameKind: 'shop' | 'owner';
  /** Nội thất (DecorDef id) đang xem trước trong quán ở bảng Siêu thị — chưa mua, chỉ tô lại màu; đóng bảng là thôi. */
  decorPreview?: string | null;
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
