-- ============================================================================
-- Sub-Tan (ผีตาลหลอน Beta) - Supabase Global Leaderboard Setup / Migration SQL
-- ยึดชื่อเล่นเป็นหลัก: จำชื่อในเครื่องเดิมอัตโนมัติ และใส่ชื่อเดิมบนเครื่องอื่นเพื่อต่อสถิติได้
-- วิธีใช้: Supabase Dashboard -> SQL Editor -> New query -> วางโค้ดนี้แล้วกด Run
-- ============================================================================

create table if not exists public.leaderboard (
  nickname_key text primary key,
  nickname text not null check (char_length(nickname) between 1 and 18),
  distance integer not null default 0 check (distance >= 0 and distance <= 500000),
  garlands integer not null default 0 check (garlands >= 0 and garlands <= 50000),
  updated_at timestamptz not null default now()
);

-- หากเคยรันสคริปต์เวอร์ชันเก่า (ที่ใช้ client_id) ให้อัปเกรดตารางเป็น nickname_key โดยไม่เสียข้อมูลเดิม
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leaderboard' and column_name = 'client_id'
  ) then
    alter table public.leaderboard add column if not exists nickname_key text;
    update public.leaderboard
      set nickname_key = lower(regexp_replace(trim(nickname), '\s+', ' ', 'g'))
      where nickname_key is null;

    delete from public.leaderboard a
    using public.leaderboard b
    where a.nickname_key = b.nickname_key
      and (a.distance < b.distance or (a.distance = b.distance and a.ctid < b.ctid));

    alter table public.leaderboard drop constraint if exists leaderboard_pkey;
    alter table public.leaderboard alter column nickname_key set not null;
    alter table public.leaderboard add primary key (nickname_key);
    alter table public.leaderboard drop column if exists client_id;
  end if;
end $$;

create index if not exists idx_leaderboard_rank
  on public.leaderboard (distance desc, garlands desc, updated_at asc);

alter table public.leaderboard enable row level security;

drop policy if exists "Public can view leaderboard" on public.leaderboard;
create policy "Public can view leaderboard"
  on public.leaderboard
  for select
  to anon, authenticated
  using (true);

drop function if exists public.submit_score(text, text, integer, integer);
drop function if exists public.submit_score(text, integer, integer);
drop function if exists public.get_player_rank(text);

-- บันทึกคะแนนอัตโนมัติหลังจบเกม โดยเทียบสถิติสูงสุดตามชื่อเล่น (เล่นเครื่องไหนก็ใช้ชื่อเดิมได้)
create or replace function public.submit_score(
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
  v_clean_name text := left(regexp_replace(trim(coalesce(p_nickname, '')), '[\r\n\t\s]+', ' ', 'g'), 16);
  v_key text;
  v_dist integer := greatest(0, least(500000, coalesce(p_distance, 0)));
  v_gar integer := greatest(0, least(50000, coalesce(p_garlands, 0)));
  v_prev_dist integer := -1;
  v_best_dist integer;
  v_best_gar integer;
  v_rank bigint;
  v_total bigint;
begin
  if char_length(v_clean_name) = 0 then
    v_clean_name := 'ผู้แก้บนนิรนาม';
  end if;
  v_key := lower(v_clean_name);

  select distance into v_prev_dist from public.leaderboard where nickname_key = v_key;

  insert into public.leaderboard (nickname_key, nickname, distance, garlands, updated_at)
  values (v_key, v_clean_name, v_dist, v_gar, now())
  on conflict (nickname_key) do update
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
    'nickname_key', v_key,
    'nickname', v_clean_name,
    'distance', v_best_dist,
    'garlands', v_best_gar,
    'is_new_best', (v_prev_dist is null or v_dist > v_prev_dist),
    'rank', v_rank,
    'total', v_total
  );
end;
$$;

grant execute on function public.submit_score(text, integer, integer) to anon, authenticated;

-- ดึงสถิติและอันดับของชื่อเล่น (ใช้ซิงก์ข้ามเครื่องตอนใส่ชื่อเล่นบนหน้าเมนู และโชว์ด้านล่างตาราง)
create or replace function public.get_player_rank(p_nickname text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_name text := left(regexp_replace(trim(coalesce(p_nickname, '')), '[\r\n\t\s]+', ' ', 'g'), 16);
  v_key text := lower(v_clean_name);
  v_rec record;
  v_rank bigint;
  v_total bigint;
begin
  select count(*) into v_total from public.leaderboard;
  if char_length(v_key) = 0 then
    return jsonb_build_object('found', false, 'total', v_total);
  end if;

  select nickname_key, nickname, distance, garlands
    into v_rec
    from public.leaderboard
    where nickname_key = v_key
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
    'nickname_key', v_rec.nickname_key,
    'nickname', v_rec.nickname,
    'distance', v_rec.distance,
    'garlands', v_rec.garlands,
    'rank', v_rank,
    'total', v_total
  );
end;
$$;

grant execute on function public.get_player_rank(text) to anon, authenticated;
