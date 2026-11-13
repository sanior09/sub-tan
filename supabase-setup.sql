-- ============================================================================
-- Sub-Tan (ผีตาลหลอน Beta) - Supabase Global Leaderboard Setup SQL
-- วิธีใช้: เปิด Supabase Dashboard -> SQL Editor -> New query -> วางโค้ดนี้แล้วกด Run
-- ============================================================================

-- 1. สร้างตารางเก็บสถิติสูงสุดต่อผู้เล่น (1 อุปกรณ์ / client_id = 1 แถวสถิติสูงสุด)
create table if not exists public.leaderboard (
  client_id text primary key,
  nickname text not null check (char_length(nickname) between 1 and 18),
  distance integer not null default 0 check (distance >= 0 and distance <= 500000),
  garlands integer not null default 0 check (garlands >= 0 and garlands <= 50000),
  updated_at timestamptz not null default now()
);

-- ดัชนีสำหรับดึง Top 10 เรียงตามระยะทางสูงสุด -> พวงมาลัย -> เวลา
create index if not exists idx_leaderboard_rank
  on public.leaderboard (distance desc, garlands desc, updated_at asc);

-- 2. เปิด Row Level Security (ให้ทุกคนอ่านอันดับได้ แต่ห้ามแก้ไข/ลบทิ้งตรงๆ จากฝั่งหน้าเว็บ)
alter table public.leaderboard enable row level security;

drop policy if exists "Public can view leaderboard" on public.leaderboard;
create policy "Public can view leaderboard"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

-- 3. ฟังก์ชันส่งคะแนนอย่างปลอดภัย (จะอัปเดตเฉพาะเมื่อทำสถิติใหม่สูงกว่าเดิม และคำนวณอันดับกลับไปให้ทันที)
create or replace function public.submit_score(
  p_client_id text,
  p_nickname text,
  p_distance integer,
  p_garlands integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_id text := left(trim(coalesce(p_client_id, '')), 64);
  v_clean_name text := left(regexp_replace(trim(coalesce(p_nickname, '')), '[\r\n\t]+', ' ', 'g'), 16);
  v_dist integer := greatest(0, least(500000, coalesce(p_distance, 0)));
  v_gar integer := greatest(0, least(50000, coalesce(p_garlands, 0)));
  v_best_dist integer;
  v_best_gar integer;
  v_rank bigint;
  v_total bigint;
begin
  if char_length(v_clean_id) < 6 then
    raise exception 'Invalid client_id';
  end if;
  if char_length(v_clean_name) = 0 then
    v_clean_name := 'ผู้แก้บนนิรนาม';
  end if;

  insert into public.leaderboard (client_id, nickname, distance, garlands, updated_at)
  values (v_clean_id, v_clean_name, v_dist, v_gar, now())
  on conflict (client_id) do update
  set
    nickname = excluded.nickname,
    distance = greatest(public.leaderboard.distance, excluded.distance),
    garlands = case
      when excluded.distance > public.leaderboard.distance then excluded.garlands
      when excluded.distance = public.leaderboard.distance then greatest(public.leaderboard.garlands, excluded.garlands)
      else public.leaderboard.garlands
    end,
    updated_at = case
      when excluded.distance >= public.leaderboard.distance then now()
      else public.leaderboard.updated_at
    end
  returning distance, garlands into v_best_dist, v_best_gar;

  select count(*) + 1 into v_rank
  from public.leaderboard
  where distance > v_best_dist
     or (distance = v_best_dist and garlands > v_best_gar);

  select count(*) into v_total from public.leaderboard;

  return jsonb_build_object(
    'client_id', v_clean_id,
    'nickname', v_clean_name,
    'distance', v_best_dist,
    'garlands', v_best_gar,
    'rank', v_rank,
    'total', v_total
  );
end;
$$;

grant execute on function public.submit_score(text, text, integer, integer) to anon, authenticated;

-- 4. ฟังก์ชันดึงอันดับส่วนตัวล่าสุดของผู้เล่น (ใช้ตอนเปิดดูตารางจากหน้าเมนู)
create or replace function public.get_player_rank(p_client_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_id text := left(trim(coalesce(p_client_id, '')), 64);
  v_rec record;
  v_rank bigint;
  v_total bigint;
begin
  select count(*) into v_total from public.leaderboard;
  select client_id, nickname, distance, garlands
    into v_rec
    from public.leaderboard
    where client_id = v_clean_id
    limit 1;

  if not found then
    return jsonb_build_object('found', false, 'total', v_total);
  end if;

  select count(*) + 1 into v_rank
  from public.leaderboard
  where distance > v_rec.distance
     or (distance = v_rec.distance and garlands > v_rec.garlands);

  return jsonb_build_object(
    'found', true,
    'client_id', v_rec.client_id,
    'nickname', v_rec.nickname,
    'distance', v_rec.distance,
    'garlands', v_rec.garlands,
    'rank', v_rank,
    'total', v_total
  );
end;
$$;

grant execute on function public.get_player_rank(text) to anon, authenticated;
