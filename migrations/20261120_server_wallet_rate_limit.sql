-- Run only in the Sổ Tay Bắt Mèo Supabase project (sxeslpgevuzabvetfijl).
-- Chạy SAU migration 20261120_harden_wallet_sightings.sql.
--
-- 1. Ví Sen do server quản lý hoàn toàn:
--    * Điểm danh mỗi ngày (+1 pate, ngày thứ 7 của chuỗi +3 thêm) do server cộng.
--    * Thưởng mini-game +1 pate, tối đa 1 lần/ngày, do server cộng.
--    * Tặng pate: server trừ ví và cộng pate_count của mèo trong cùng một giao dịch.
--    * sync_sen_wallet không còn nhận số pate / tổng đã tặng / số lần cho ăn từ client.
-- 2. Chống spam theo từng bé mèo:
--    * Ghi nhận cho ăn: tối đa 1 lần / 10 phút cho mỗi bé.
--    * Bật/tắt SOS: tối đa 1 lần / phút cho mỗi bé; tắt SOS phải đăng nhập.
begin;

alter table public.sen_wallets
    add column if not exists last_game_reward_date date;

alter table public.cats
    add column if not exists sos_updated_at timestamptz,
    add column if not exists sos_updated_by uuid references auth.users(id) on delete set null;

-- ============================================================
-- Hàm nội bộ (không cho gọi qua API)
-- ============================================================
create or replace function public.sen_wallet_id(p_client_id text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
    v_id text;
begin
    if auth.uid() is not null then
        return auth.uid()::text;
    end if;
    v_id := trim(coalesce(p_client_id, ''));
    if v_id !~ '^sen_[A-Za-z0-9-]{8,80}$' then
        raise exception 'Invalid wallet client id.';
    end if;
    return v_id;
end;
$$;

create or replace function public.sen_rank(p_streak int, p_total_given int, out rank_id text, out rank_title text)
language sql
immutable
set search_path = ''
as $$
    select r.rank_id, r.rank_title
    from (values
        (5, 'rank_5', 'Bảo Mẫu Hoàng Gia', 30, 50),
        (4, 'rank_4', 'Đại Gia Pate', 14, 25),
        (3, 'rank_3', 'Sen Cần Mẫn', 7, 10),
        (2, 'rank_2', 'Sen Chu Đáo', 3, 3),
        (1, 'rank_1', 'Sen Tập Sự', 0, 0)
    ) as r(lvl, rank_id, rank_title, min_streak, min_given)
    where p_streak >= r.min_streak or p_total_given >= r.min_given
    order by r.lvl desc
    limit 1;
$$;

create or replace function public.sen_wallet_json(w public.sen_wallets)
returns json
language sql
stable
set search_path = ''
as $$
    select json_build_object(
        'id', w.id,
        'user_id', w.user_id,
        'streak', w.streak,
        'pate', w.pate,
        'total_given', w.total_given,
        'fed_count', w.fed_count,
        'rank_id', w.rank_id,
        'rank_title', w.rank_title,
        'last_checkin_date', w.last_checkin_date,
        'last_game_reward_date', w.last_game_reward_date
    );
$$;

-- Tạo ví nếu chưa có, khóa dòng ví, áp dụng điểm danh ngày mới (giờ Việt Nam)
-- và cập nhật danh hiệu. Trả về dòng ví đã khóa.
create or replace function public.sen_wallet_lock(p_id text)
returns public.sen_wallets
language plpgsql
set search_path = ''
as $$
declare
    v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
    w public.sen_wallets%rowtype;
    v_streak int;
    v_bonus int;
begin
    insert into public.sen_wallets (id, user_id, streak, pate, total_given, fed_count, last_checkin_date)
    values (p_id, auth.uid(), 1, 3, 0, 0, v_today)
    on conflict (id) do nothing;

    select * into w from public.sen_wallets where id = p_id for update;

    if w.last_checkin_date < v_today then
        if w.last_checkin_date = v_today - 1 then
            v_streak := w.streak + 1;
        else
            v_streak := 1;
        end if;
        v_bonus := 1 + case when v_streak % 7 = 0 then 3 else 0 end;
        w.streak := v_streak;
        w.pate := least(w.pate + v_bonus, 9999);
        w.last_checkin_date := v_today;
    end if;

    select r.rank_id, r.rank_title into w.rank_id, w.rank_title
    from public.sen_rank(w.streak, w.total_given) r;

    update public.sen_wallets
    set user_id = coalesce(user_id, auth.uid()),
        streak = w.streak,
        pate = w.pate,
        last_checkin_date = w.last_checkin_date,
        rank_id = w.rank_id,
        rank_title = w.rank_title,
        updated_at = now()
    where id = p_id
    returning * into w;

    return w;
end;
$$;

revoke all on function public.sen_wallet_id(text) from public, anon, authenticated;
revoke all on function public.sen_rank(int, int) from public, anon, authenticated;
revoke all on function public.sen_wallet_json(public.sen_wallets) from public, anon, authenticated;
revoke all on function public.sen_wallet_lock(text) from public, anon, authenticated;

-- ============================================================
-- API công khai
-- ============================================================

-- Đồng bộ ví: chỉ đọc trạng thái từ server (kèm điểm danh ngày mới nếu có).
-- Các tham số số liệu được giữ để client cũ không lỗi, nhưng bị bỏ qua.
create or replace function public.sync_sen_wallet(
    p_client_id text,
    p_streak int default 1,
    p_pate int default 3,
    p_total_given int default 0,
    p_fed_count int default 0,
    p_last_checkin_date date default current_date
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
    return public.sen_wallet_json(public.sen_wallet_lock(public.sen_wallet_id(p_client_id)));
end;
$$;

create or replace function public.claim_game_reward(p_client_id text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
    w public.sen_wallets%rowtype;
begin
    w := public.sen_wallet_lock(public.sen_wallet_id(p_client_id));
    if w.last_game_reward_date is not null and w.last_game_reward_date >= v_today then
        raise exception 'Game reward already claimed today.';
    end if;

    update public.sen_wallets
    set pate = least(pate + 1, 9999),
        last_game_reward_date = v_today,
        updated_at = now()
    where id = w.id
    returning * into w;

    return public.sen_wallet_json(w);
end;
$$;

drop function if exists public.give_cat_pate(text);
create or replace function public.give_cat_pate(p_cat_id text, p_client_id text default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
    w public.sen_wallets%rowtype;
    v_pate_count int;
begin
    w := public.sen_wallet_lock(public.sen_wallet_id(p_client_id));
    if w.pate < 1 then
        raise exception 'Out of pate.';
    end if;

    update public.cats
    set pate_count = coalesce(pate_count, 0) + 1
    where id = p_cat_id
    returning pate_count into v_pate_count;

    if not found then
        raise exception 'Cat not found.';
    end if;

    w.pate := w.pate - 1;
    w.total_given := w.total_given + 1;
    select r.rank_id, r.rank_title into w.rank_id, w.rank_title
    from public.sen_rank(w.streak, w.total_given) r;

    update public.sen_wallets
    set pate = w.pate,
        total_given = w.total_given,
        rank_id = w.rank_id,
        rank_title = w.rank_title,
        updated_at = now()
    where id = w.id
    returning * into w;

    return json_build_object('pate_count', v_pate_count, 'wallet', public.sen_wallet_json(w));
end;
$$;

drop function if exists public.check_in_cat_feed(text, text);
create or replace function public.check_in_cat_feed(
    p_cat_id text,
    p_feeder_name text default '',
    p_client_id text default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_feeder text;
    v_last_fed_at timestamptz;
    w public.sen_wallets%rowtype;
begin
    select last_fed_at into v_last_fed_at
    from public.cats where id = p_cat_id
    for update;

    if not found then
        raise exception 'Cat not found.';
    end if;
    if v_last_fed_at is not null and v_last_fed_at > now() - interval '10 minutes' then
        raise exception 'This cat was just fed. Please wait a few minutes.';
    end if;

    v_feeder := trim(coalesce(p_feeder_name, ''));
    if v_feeder = '' then
        v_feeder := 'Một Sen tốt bụng';
    end if;
    v_feeder := substring(v_feeder from 1 for 40);

    update public.cats
    set last_fed_at = now(),
        fed_count = coalesce(fed_count, 0) + 1,
        last_fed_by = v_feeder
    where id = p_cat_id;

    -- Cộng số lần cho ăn vào ví (nếu xác định được ví).
    if auth.uid() is null and p_client_id is null then
        return null;
    end if;
    w := public.sen_wallet_lock(public.sen_wallet_id(p_client_id));
    update public.sen_wallets
    set fed_count = fed_count + 1, updated_at = now()
    where id = w.id
    returning * into w;

    return public.sen_wallet_json(w);
end;
$$;

create or replace function public.toggle_cat_sos(p_cat_id text, p_is_sos boolean, p_sos_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_sos_updated_at timestamptz;
begin
    if p_is_sos is null then
        raise exception 'Invalid SOS value.';
    end if;
    if not p_is_sos and auth.uid() is null then
        raise exception 'Sign in to resolve an SOS alert.';
    end if;

    select sos_updated_at into v_sos_updated_at
    from public.cats where id = p_cat_id
    for update;

    if not found then
        raise exception 'Cat not found.';
    end if;
    if v_sos_updated_at is not null and v_sos_updated_at > now() - interval '1 minute' then
        raise exception 'SOS was just updated. Please wait a minute.';
    end if;

    update public.cats
    set is_sos = p_is_sos,
        sos_note = case when p_is_sos then substring(trim(coalesce(p_sos_note, '')) from 1 for 200) else '' end,
        sos_updated_at = now(),
        sos_updated_by = auth.uid()
    where id = p_cat_id;
end;
$$;

revoke all on function public.sync_sen_wallet(text, int, int, int, int, date) from public;
revoke all on function public.claim_game_reward(text) from public;
revoke all on function public.give_cat_pate(text, text) from public;
revoke all on function public.check_in_cat_feed(text, text, text) from public;
revoke all on function public.toggle_cat_sos(text, boolean, text) from public;
grant execute on function public.sync_sen_wallet(text, int, int, int, int, date) to anon, authenticated;
grant execute on function public.claim_game_reward(text) to anon, authenticated;
grant execute on function public.give_cat_pate(text, text) to anon, authenticated;
grant execute on function public.check_in_cat_feed(text, text, text) to anon, authenticated;
grant execute on function public.toggle_cat_sos(text, boolean, text) to anon, authenticated;

commit;
