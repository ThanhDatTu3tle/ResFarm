-- ============================================================================
-- Quán Nhà Vườn - máy chủ bạn bè (F3, lớp A): đăng nhập ẩn danh, kết bạn bằng mã / link mời / QR,
-- tự đẩy bản chụp quán để bạn bè ghé thăm.
--
-- Cách dùng: Supabase → SQL Editor → dán toàn bộ file này → Run. Chạy lại nhiều lần vẫn được (idempotent).
-- Trước đó bật: Authentication → Sign In / Providers → Anonymous sign-ins.
--
-- Nguyên tắc quyền:
--   * Bảng chỉ đọc / sửa được dòng của CHÍNH MÌNH (RLS). Mã kết bạn do máy chủ sinh, không sửa được.
--   * Mọi thứ liên quan tới người khác (kết bạn, danh sách bạn, xem quán bạn) đi qua hàm security definer
--     bên dưới - hàm tự kiểm tra hai người có là bạn không, bạn có bật "cho ghé thăm" không.
--   * Không lưu email / số điện thoại / mạng xã hội. Chỉ có tên quán + tên chủ quán người chơi tự đặt trong game.
-- ============================================================================

create table if not exists public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  friend_code text not null unique,
  shop_name text not null default '',
  owner_name text not null default '',
  cuisine text not null default '',
  game_day int not null default 1,
  sharing boolean not null default false,
  snapshot jsonb,
  snapshot_at timestamptz,
  created_at timestamptz not null default now(),
  constraint players_names_len check (char_length(shop_name) <= 24 and char_length(owner_name) <= 16 and char_length(cuisine) <= 8),
  -- Bản chụp quán tối đa ~1,5 MB (một ván bình thường vài trăm KB)
  constraint players_snapshot_size check (snapshot is null or pg_column_size(snapshot) < 1500000)
);

create table if not exists public.friendships (
  a uuid not null references public.players (id) on delete cascade,
  b uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  constraint friendships_order check (a < b)
);
create index if not exists friendships_b on public.friendships (b);

alter table public.players enable row level security;
alter table public.friendships enable row level security;

-- Chỉ thấy / sửa dòng của mình. Không có quyền insert / delete trực tiếp (đi qua hàm bên dưới).
drop policy if exists players_own_select on public.players;
create policy players_own_select on public.players for select to authenticated using (auth.uid() = id);
drop policy if exists players_own_update on public.players;
create policy players_own_update on public.players for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

revoke all on public.players from anon, authenticated;
revoke all on public.friendships from anon, authenticated;
grant select on public.players to authenticated;
-- Chỉ được sửa các cột này (friend_code, id, ngày tạo thì không)
grant update (shop_name, owner_name, cuisine, game_day, sharing, snapshot, snapshot_at) on public.players to authenticated;

-- Chống spam: bản chụp mới cách bản trước ít nhất 20 giây; snapshot_at luôn do máy chủ ghi
create or replace function public.players_before_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.snapshot is distinct from old.snapshot then
    if old.snapshot_at is not null and old.snapshot_at > now() - interval '20 seconds' then
      raise exception 'Cập nhật quán hơi nhanh, đợi một chút rồi thử lại.' using errcode = 'P0001';
    end if;
    new.snapshot_at := case when new.snapshot is null then null else now() end;
  else
    new.snapshot_at := old.snapshot_at;
  end if;
  return new;
end $$;
drop trigger if exists players_before_update on public.players;
create trigger players_before_update before update on public.players for each row execute function public.players_before_update();

-- Mã kết bạn 6 ký tự, bỏ các ký tự dễ nhầm (0/O, 1/I/L)
create or replace function public.new_friend_code() returns text
language plpgsql set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from players where friend_code = code);
  end loop;
  return code;
end $$;

-- Lần đầu vào tính năng bạn bè: tạo dòng người chơi (nếu chưa có), trả về dòng của mình (không kèm bản chụp)
create or replace function public.ensure_player()
returns table (id uuid, friend_code text, sharing boolean, snapshot_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập.' using errcode = 'P0001'; end if;
  insert into players (id, friend_code) values (auth.uid(), new_friend_code()) on conflict (id) do nothing;
  return query select p.id, p.friend_code, p.sharing, p.snapshot_at from players p where p.id = auth.uid();
end $$;

-- Kết bạn bằng mã của người kia (link mời / QR cũng chỉ là mã). Trả về thông tin người vừa kết bạn.
create or replace function public.add_friend(code text)
returns table (id uuid, owner_name text, shop_name text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  other uuid;
begin
  if me is null then raise exception 'Chưa đăng nhập.' using errcode = 'P0001'; end if;
  select p.id into other from players p where p.friend_code = upper(trim(code));
  if other is null then raise exception 'Không có ai dùng mã này.' using errcode = 'P0001'; end if;
  if other = me then raise exception 'Đây là mã của chính bạn.' using errcode = 'P0001'; end if;
  if (select count(*) from friendships f where f.a = me or f.b = me) >= 200 then
    raise exception 'Bạn đã có 200 người bạn - tối đa rồi.' using errcode = 'P0001';
  end if;
  insert into friendships (a, b) values (least(me, other), greatest(me, other)) on conflict do nothing;
  return query select p.id, p.owner_name, p.shop_name from players p where p.id = other;
end $$;

create or replace function public.remove_friend(friend uuid) returns void
language sql security definer set search_path = public as $$
  delete from friendships where (a, b) = (least(auth.uid(), friend), greatest(auth.uid(), friend));
$$;

-- Danh sách bạn bè (không kèm bản chụp)
create or replace function public.my_friends()
returns table (id uuid, owner_name text, shop_name text, cuisine text, game_day int, sharing boolean, snapshot_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.owner_name, p.shop_name, p.cuisine, p.game_day, p.sharing and p.snapshot is not null, p.snapshot_at
  from friendships f
  join players p on p.id = case when f.a = auth.uid() then f.b else f.a end
  where f.a = auth.uid() or f.b = auth.uid()
  order by p.snapshot_at desc nulls last;
$$;

-- Bản chụp quán của một người bạn - chỉ khi là bạn của nhau VÀ người đó đang bật "cho ghé thăm"
create or replace function public.friend_snapshot(friend uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  snap jsonb;
begin
  if not exists (select 1 from friendships f where (f.a, f.b) = (least(auth.uid(), friend), greatest(auth.uid(), friend))) then
    raise exception 'Hai bạn chưa kết bạn.' using errcode = 'P0001';
  end if;
  select p.snapshot into snap from players p where p.id = friend and p.sharing;
  if snap is null then raise exception 'Quán này đang đóng cửa với khách thăm.' using errcode = 'P0001'; end if;
  return snap;
end $$;

-- Xoá toàn bộ dữ liệu online của mình (bản chụp, mã, bạn bè). Tài khoản ẩn danh còn lại không chứa gì.
create or replace function public.delete_me() returns void
language sql security definer set search_path = public as $$
  delete from players where id = auth.uid();
$$;

revoke all on function public.new_friend_code() from public, anon, authenticated;
revoke all on function public.ensure_player() from public, anon;
revoke all on function public.add_friend(text) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
revoke all on function public.my_friends() from public, anon;
revoke all on function public.friend_snapshot(uuid) from public, anon;
revoke all on function public.delete_me() from public, anon;
grant execute on function public.ensure_player() to authenticated;
grant execute on function public.add_friend(text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.my_friends() to authenticated;
grant execute on function public.friend_snapshot(uuid) to authenticated;
grant execute on function public.delete_me() to authenticated;
