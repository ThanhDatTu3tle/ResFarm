/**
 * Màu bàn: sau khi gọi món, bong bóng của khách và các món của bàn đó (trên quầy line, trên đầu bồi bàn) cùng một màu
 * để người chơi so màu mà giao đúng bàn. Số màu phải khớp `balance.service.partyColors`; sim gán chỉ số (`Party.color`).
 */
export const PARTY_COLORS = ['#7ed36f', '#ffb347', '#c493f0', '#6cb8f6', '#ff8fb1', '#4fd3c4', '#ffd84d', '#d0a57c'];

/** Màu món của đơn giao tận nơi (màu giấy kraft của túi đóng gói) - trên quầy line, trên đầu bồi bàn. */
export const TAKEOUT_COLOR = '#c99a62';

/** Màu của một món: đơn giao tận nơi = màu túi; món của bàn = màu bàn. */
export function orderColor(state: { restaurant: { parties: { id: number; color?: number | null }[] } }, o: { partyId: number; takeoutId?: number }): string | null {
  if (o.takeoutId != null) return TAKEOUT_COLOR;
  return partyColor(state.restaurant.parties.find((p) => p.id === o.partyId)?.color);
}

/** Màu của bàn theo chỉ số trong state (chưa gọi món = không màu). */
export function partyColor(index: number | null | undefined): string | null {
  return index == null ? null : PARTY_COLORS[index % PARTY_COLORS.length];
}
