-- Run only in the Sổ Tay Bắt Mèo Supabase project (sxeslpgevuzabvetfijl).
-- Siết quyền ghi cho Ví Sen và Nhật ký gặp lại:
--   * sen_wallets: không ai ghi trực tiếp vào bảng; chỉ ghi qua sync_sen_wallet.
--     Streak và danh hiệu do server tính theo ngày giờ Việt Nam, không tin số liệu client gửi.
--     Khách chưa đăng nhập chỉ ghi được ví có id dạng 'sen_...', không ghi được ví của tài khoản.
--   * cat_sightings: bỏ quyền insert trực tiếp; chỉ thêm qua add_cat_sighting có kiểm tra dữ liệu.
begin;

-- ============================================================
-- Nhật ký gặp lại mèo (cat_sightings)
-- ============================================================
create table if not exists public.cat_sightings (
    id text primary key,
    cat_id text not null references public.cats(id) on delete cascade,
    seen_at timestamptz not null default now(),
    image text,
    note text not null default '' check (char_length(note) <= 1000),
    reporter_name text not null default '' check (char_length(reporter_name) <= 40),
    created_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists cat_sightings_cat_id_seen_at_idx
    on public.cat_sightings (cat_id, seen_at asc);

alter table public.cat_sightings enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.cat_sightings'::regclass
          and conname = 'cat_sightings_image_length_check'
    ) then
        -- not valid: không chặn các dòng cũ, chỉ áp dụng cho dòng mới.
        alter table public.cat_sightings
            add constraint cat_sightings_image_length_check
            check (image is null or char_length(image) <= 1000000) not valid;
    end if;
end;
$$;

drop policy if exists "Public can view cat sightings" on public.cat_sightings;
create policy "Public can view cat sightings"
    on public.cat_sightings for select to anon, authenticated
    using (true);

drop policy if exists "Anyone can insert cat sightings" on public.cat_sightings;

create or replace function public.add_cat_sighting(
    p_cat_id text,
    p_image text default null,
    p_note text default '',
    p_reporter_name text default '',
    p_seen_at timestamptz default now()
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_sighting_id text;
    v_user_id uuid;
    v_reporter text;
    v_note text;
    v_image text;
    v_seen_at timestamptz;
begin
    v_user_id := auth.uid();

    if not exists (select 1 from public.cats where id = p_cat_id) then
        raise exception 'Cat not found.';
    end if;

    v_reporter := trim(coalesce(p_reporter_name, ''));
    if v_reporter = '' then
        v_reporter := 'Một Sen tốt bụng';
    end if;
    v_reporter := substring(v_reporter from 1 for 40);

    v_note := substring(trim(coalesce(p_note, '')) from 1 for 1000);

    -- Ảnh chỉ được là: ảnh base64 do app nén, hoặc file trong thư mục riêng
    -- của chính người gửi trên bucket cat-images. Không nhận URL ngoài.
    v_image := nullif(trim(coalesce(p_image, '')), '');
    if v_image is not null then
        if v_image ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' then
            if char_length(v_image) > 1000000 then
                raise exception 'Sighting image is too large.';
            end if;
        elsif v_user_id is null
           or v_image !~ ('^' || v_user_id::text || '/sightings/[A-Za-z0-9_.-]{1,120}\.(jpg|png|webp)$') then
            raise exception 'Invalid sighting image.';
        end if;
    end if;

    v_seen_at := coalesce(p_seen_at, now());
    if v_seen_at > now() + interval '1 day' then
        raise exception 'Sighting date cannot be in the future.';
    end if;

    v_sighting_id := gen_random_uuid()::text;
    insert into public.cat_sightings (id, cat_id, seen_at, image, note, reporter_name, created_by, created_at)
    values (v_sighting_id, p_cat_id, v_seen_at, v_image, v_note, v_reporter, v_user_id, now());

    update public.cats
    set sightings_count = coalesce(sightings_count, 1) + 1
    where id = p_cat_id;

    return v_sighting_id;
end;
$$;

revoke all on table public.cat_sightings from public, anon, authenticated;
grant select on table public.cat_sightings to anon, authenticated;
revoke all on function public.add_cat_sighting(text, text, text, text, timestamptz) from public;
grant execute on function public.add_cat_sighting(text, text, text, text, timestamptz) to anon, authenticated;

-- ============================================================
-- Ví Sen (sen_wallets)
-- ============================================================
create table if not exists public.sen_wallets (
    id text primary key,
    user_id uuid references auth.users(id) on delete set null,
    streak int not null default 1,
    pate int not null default 3,
    total_given int not null default 0,
    fed_count int not null default 0,
    rank_id text not null default 'rank_1',
    rank_title text not null default 'Sen Tập Sự',
    last_checkin_date date not null default current_date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.sen_wallets enable row level security;

drop policy if exists "Anyone can read sen wallets" on public.sen_wallets;
drop policy if exists "Anyone can insert or update sen wallets" on public.sen_wallets;
drop policy if exists "Users can read own sen wallet" on public.sen_wallets;
create policy "Users can read own sen wallet"
    on public.sen_wallets for select to authenticated
    using (user_id = (select auth.uid()));

-- p_streak và p_last_checkin_date được giữ trong chữ ký hàm để client cũ không lỗi,
-- nhưng server bỏ qua chúng.
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
declare
    v_id text;
    v_user_id uuid;
    v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
    v_row public.sen_wallets%rowtype;
    v_streak int;
    v_pate int;
    v_total_given int;
    v_fed_count int;
    v_rank_id text;
    v_rank_title text;
begin
    v_user_id := auth.uid();
    if v_user_id is not null then
        v_id := v_user_id::text;
    else
        -- Khách chỉ dùng id do app sinh ra ('sen_' + chuỗi ngẫu nhiên),
        -- nên không thể ghi đè ví của tài khoản (id = UUID người dùng).
        v_id := trim(coalesce(p_client_id, ''));
        if v_id !~ '^sen_[A-Za-z0-9-]{8,80}$' then
            raise exception 'Invalid wallet client id.';
        end if;
    end if;

    v_pate := least(greatest(coalesce(p_pate, 0), 0), 9999);
    v_total_given := least(greatest(coalesce(p_total_given, 0), 0), 100000);
    v_fed_count := least(greatest(coalesce(p_fed_count, 0), 0), 100000);

    insert into public.sen_wallets (id, user_id, streak, pate, total_given, fed_count, last_checkin_date)
    values (v_id, v_user_id, 1, v_pate, v_total_given, v_fed_count, v_today)
    on conflict (id) do nothing;

    select * into v_row from public.sen_wallets where id = v_id for update;

    -- Streak do server tính: cùng ngày giữ nguyên, ngày kế tiếp +1, bỏ ngày thì về 1.
    if v_row.last_checkin_date >= v_today then
        v_streak := v_row.streak;
    elsif v_row.last_checkin_date = v_today - 1 then
        v_streak := v_row.streak + 1;
    else
        v_streak := 1;
    end if;

    v_total_given := greatest(v_row.total_given, v_total_given);
    v_fed_count := greatest(v_row.fed_count, v_fed_count);

    if v_streak >= 30 or v_total_given >= 50 then
        v_rank_id := 'rank_5';
        v_rank_title := 'Bảo Mẫu Hoàng Gia';
    elsif v_streak >= 14 or v_total_given >= 25 then
        v_rank_id := 'rank_4';
        v_rank_title := 'Đại Gia Pate';
    elsif v_streak >= 7 or v_total_given >= 10 then
        v_rank_id := 'rank_3';
        v_rank_title := 'Sen Cần Mẫn';
    elsif v_streak >= 3 or v_total_given >= 3 then
        v_rank_id := 'rank_2';
        v_rank_title := 'Sen Chu Đáo';
    else
        v_rank_id := 'rank_1';
        v_rank_title := 'Sen Tập Sự';
    end if;

    update public.sen_wallets
    set user_id = coalesce(user_id, v_user_id),
        streak = v_streak,
        pate = v_pate,
        total_given = v_total_given,
        fed_count = v_fed_count,
        rank_id = v_rank_id,
        rank_title = v_rank_title,
        last_checkin_date = greatest(last_checkin_date, v_today),
        updated_at = now()
    where id = v_id
    returning * into v_row;

    return json_build_object(
        'id', v_row.id,
        'user_id', v_row.user_id,
        'streak', v_row.streak,
        'pate', v_row.pate,
        'total_given', v_row.total_given,
        'fed_count', v_row.fed_count,
        'rank_id', v_row.rank_id,
        'rank_title', v_row.rank_title,
        'last_checkin_date', v_row.last_checkin_date
    );
end;
$$;

revoke all on table public.sen_wallets from public, anon, authenticated;
grant select on table public.sen_wallets to authenticated;
revoke all on function public.sync_sen_wallet(text, int, int, int, int, date) from public;
grant execute on function public.sync_sen_wallet(text, int, int, int, int, date) to anon, authenticated;

commit;
