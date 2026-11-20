/**
 * NGƯỜI LÀM VƯỜN + DỤNG CỤ NÔNG TRẠI.
 *  - Người làm vườn: thuê một lần (`balance.gardeners`), tự nhận việc theo các việc người chơi bật (xem sim/systems/gardeners.ts).
 *  - Dụng cụ: mua một lần, dùng mãi; hiệu ứng áp cho cả bác nông dân lẫn người làm vườn (xem sim/systems/farmer.ts).
 * Thêm dụng cụ: thêm 1 mục ở đây rồi viết hiệu ứng trong farmer.ts (`hasTool`).
 */

/** Việc giao được cho người làm vườn. */
export type GardenerJob = 'harvest' | 'animals' | 'water' | 'replant';

export const gardenerJobs: { id: GardenerJob; icon: string; name: string; desc: string }[] = [
  { id: 'harvest', icon: '🧺', name: 'Thu hoạch', desc: 'Thu rau ruộng, luống nhà kính và cây ăn quả khi chín.' },
  { id: 'animals', icon: '🐔', name: 'Chuồng, ao', desc: 'Thu trứng, sữa, thịt, cá; xong thì thả lại con giống cũ.' },
  { id: 'water', icon: '💧', name: 'Tưới cây', desc: 'Tưới ô nào đất sắp khô.' },
  { id: 'replant', icon: '🌱', name: 'Cuốc, gieo lại', desc: 'Ô vừa thu xong thì cuốc đất và gieo lại giống cũ (nếu đang đúng mùa).' },
];

export interface FarmToolDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  level: number;
}

export const farmTools: FarmToolDef[] = [
  { id: 'sickle', name: 'Liềm thép bén', icon: '🌾', desc: 'Thu hoạch nhanh gấp đôi.', cost: 300, level: 2 },
  { id: 'big_can', name: 'Bình tưới lớn', icon: '🚿', desc: 'Tưới một ô là tưới luôn cả hàng ô cùng loại đang khô.', cost: 380, level: 2 },
  { id: 'boots', name: 'Giày vải nhẹ', icon: '👟', desc: 'Bác nông dân và người làm vườn đi nhanh hơn 30%.', cost: 450, level: 3 },
  { id: 'tractor2', name: 'Máy cày đời mới', icon: '🚜', desc: 'Ruộng lúa thu / gieo nhanh gấp đôi, chở lúa tới cối nhanh hơn 50%.', cost: 900, level: 4 },
];
