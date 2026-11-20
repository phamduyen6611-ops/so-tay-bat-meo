create table if not exists public.cats (
    id text primary key,
    lat double precision not null check (lat between -90 and 90),
    lng double precision not null check (lng between -180 and 180),
    name text not null default '' check (char_length(name) <= 40),
    location_name text not null default '' check (char_length(location_name) <= 120),
    note text not null default '' check (char_length(note) <= 2000),
    image text,
    approximate boolean not null default false,
    current_status text not null default 'unknown'
        check (current_status in ('unknown', 'seen', 'helped', 'not_found', 'other')),
    status_note text not null default '' check (char_length(status_note) <= 200),
    status_updated_at timestamptz,
    created_by uuid references auth.users(id) on delete set null,
    updated_by uuid references auth.users(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table public.cats
    add column if not exists location_name text not null default '' check (char_length(location_name) <= 120);

alter table public.cats
    add column if not exists current_status text not null default 'unknown',
    add column if not exists status_note text not null default '',
    add column if not exists status_updated_at timestamptz,
    add column if not exists last_fed_at timestamptz,
    add column if not exists last_fed_by text not null default '' check (char_length(last_fed_by) <= 40),
    add column if not exists fed_count int not null default 0,
    add column if not exists pate_count int not null default 0,
    add column if not exists is_sos boolean not null default false,
    add column if not exists sos_note text not null default '' check (char_length(sos_note) <= 200),
    add column if not exists sightings_count int not null default 1;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.cats'::regclass
          and conname = 'cats_name_length_check'
    ) then
        alter table public.cats
            add constraint cats_name_length_check check (char_length(name) <= 40);
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.cats'::regclass
          and conname = 'cats_note_length_check'
    ) then
        alter table public.cats
            add constraint cats_note_length_check check (char_length(note) <= 2000);
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.cats'::regclass
          and conname = 'cats_status_note_length_check'
    ) then
        alter table public.cats
            add constraint cats_status_note_length_check check (char_length(status_note) <= 200);
    end if;
end;
$$;

alter table public.cats drop constraint if exists cats_current_status_check;
alter table public.cats
    add constraint cats_current_status_check
    check (current_status in ('unknown', 'seen', 'helped', 'not_found', 'other'));

create table if not exists public.cat_editors (
    user_id uuid primary key references auth.users(id) on delete cascade,
    added_at timestamptz not null default now(),
    is_admin boolean not null default false
);

alter table public.cat_editors
    add column if not exists is_admin boolean not null default false;

create table if not exists public.cat_submissions (
    id text primary key,
    lat double precision not null check (lat between -90 and 90),
    lng double precision not null check (lng between -180 and 180),
    name text not null default '' check (char_length(name) <= 40),
    note text not null default '' check (char_length(note) <= 2000),
    image text check (image is null or char_length(image) <= 3000000),
    approximate boolean not null default false,
    submitted_at timestamptz not null default now()
);

alter table public.cats enable row level security;
alter table public.cat_editors enable row level security;
alter table public.cat_submissions enable row level security;

create or replace function public.is_cat_editor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.cat_editors
        where user_id = (select auth.uid())
    );
$$;

create or replace function public.is_cat_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.cat_editors
        where user_id = (select auth.uid())
          and is_admin
    );
$$;

create or replace function public.report_cat_status(p_cat_id text, p_status text, p_status_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if (select auth.uid()) is null then
        raise exception 'Sign in to update a cat status.';
    end if;
    if p_status is null or p_status not in ('seen', 'helped', 'not_found', 'other') then
        raise exception 'Invalid cat status.';
    end if;
    if p_status = 'other' then
        if p_status_note is null or char_length(trim(p_status_note)) = 0 or char_length(p_status_note) > 200 then
            raise exception 'Other cat status must include a note of at most 200 characters.';
        end if;
    else
        p_status_note := '';
    end if;

    update public.cats
    set current_status = p_status,
        status_note = p_status_note,
        status_updated_at = now()
    where id = p_cat_id;

    if not found then
        raise exception 'Cat not found.';
    end if;
end;
$$;

create or replace function public.report_cat_status(p_cat_id text, p_status text)
returns void
language sql
security definer
set search_path = ''
as $$
    select public.report_cat_status(p_cat_id, p_status, '');
$$;

create or replace function public.check_in_cat_feed(p_cat_id text, p_feeder_name text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_feeder text;
begin
    v_feeder := trim(coalesce(p_feeder_name, ''));
    if v_feeder = '' then
        v_feeder := 'Một Sen tốt bụng';
    end if;
    if char_length(v_feeder) > 40 then
        v_feeder := substring(v_feeder from 1 for 40);
    end if;

    update public.cats
    set last_fed_at = now(),
        fed_count = coalesce(fed_count, 0) + 1,
        last_fed_by = v_feeder
    where id = p_cat_id;

    if not found then
        raise exception 'Cat not found.';
    end if;
end;
$$;

create or replace function public.give_cat_pate(p_cat_id text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_new_count int;
begin
    update public.cats
    set pate_count = coalesce(pate_count, 0) + 1
    where id = p_cat_id
    returning pate_count into v_new_count;

    if not found then
        raise exception 'Cat not found.';
    end if;

    return v_new_count;
end;
$$;

create or replace function public.toggle_cat_sos(p_cat_id text, p_is_sos boolean, p_sos_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.cats
    set is_sos = p_is_sos,
        sos_note = case when p_is_sos then trim(coalesce(p_sos_note, '')) else '' end
    where id = p_cat_id;

    if not found then
        raise exception 'Cat not found.';
    end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'cat-images',
    'cat-images',
    true,
    3145728,
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view cat images" on storage.objects;
create policy "Public can view cat images"
on storage.objects for select
to public
using (bucket_id = 'cat-images');

drop policy if exists "Users can upload cat images" on storage.objects;
create policy "Users can upload cat images"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'cat-images'
    and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or public.is_cat_admin()
    )
);

drop policy if exists "Users can update own cat images" on storage.objects;
create policy "Users can update own cat images"
on storage.objects for update
to authenticated
using (
    bucket_id = 'cat-images'
    and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or public.is_cat_admin()
    )
)
with check (
    bucket_id = 'cat-images'
    and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or public.is_cat_admin()
    )
);

drop policy if exists "Users can delete own cat images" on storage.objects;
create policy "Users can delete own cat images"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'cat-images'
    and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or public.is_cat_admin()
    )
);

create or replace function public.set_cat_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        new.created_by := coalesce((select auth.uid()), new.created_by);
    end if;
    new.updated_by := coalesce((select auth.uid()), new.updated_by);
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists set_cat_audit_fields on public.cats;
create trigger set_cat_audit_fields
before insert or update on public.cats
for each row execute function public.set_cat_audit_fields();

drop policy if exists "Anyone can view cats" on public.cats;
create policy "Anyone can view cats"
on public.cats for select
to anon, authenticated
using (true);

drop policy if exists "Invited editors can add cats" on public.cats;
drop policy if exists "Authenticated users can add cats" on public.cats;
create policy "Authenticated users can add cats"
on public.cats for insert
to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "Invited editors can update cats" on public.cats;
drop policy if exists "Owners and admins can update cats" on public.cats;
create policy "Owners and admins can update cats"
on public.cats for update
to authenticated
using (created_by = (select auth.uid()) or public.is_cat_admin())
with check (created_by = (select auth.uid()) or public.is_cat_admin());

drop policy if exists "Invited editors can delete cats" on public.cats;
drop policy if exists "Owners and admins can delete cats" on public.cats;
create policy "Owners and admins can delete cats"
on public.cats for delete
to authenticated
using (created_by = (select auth.uid()) or public.is_cat_admin());

drop policy if exists "Editors can view own membership" on public.cat_editors;
create policy "Editors can view own membership"
on public.cat_editors for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Anyone can submit cats for review" on public.cat_submissions;

drop policy if exists "Admins can view submissions" on public.cat_submissions;
create policy "Admins can view submissions"
on public.cat_submissions for select
to authenticated
using (public.is_cat_admin());

drop policy if exists "Admins can update submissions" on public.cat_submissions;
create policy "Admins can update submissions"
on public.cat_submissions for update
to authenticated
using (public.is_cat_admin())
with check (public.is_cat_admin());

drop policy if exists "Admins can delete submissions" on public.cat_submissions;
create policy "Admins can delete submissions"
on public.cat_submissions for delete
to authenticated
using (public.is_cat_admin());

create or replace function public.approve_cat_submission(p_submission_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    submission public.cat_submissions%rowtype;
begin
    if not public.is_cat_admin() then
        raise exception 'Only a cat map administrator can approve submissions.';
    end if;

    select * into submission
    from public.cat_submissions
    where id = p_submission_id
    for update;

    if not found then
        raise exception 'Submission not found.';
    end if;

    insert into public.cats (id, lat, lng, name, note, image, approximate, created_by)
    values (
        submission.id,
        submission.lat,
        submission.lng,
        submission.name,
        submission.note,
        submission.image,
        submission.approximate,
        (select auth.uid())
    );

    delete from public.cat_submissions where id = p_submission_id;
end;
$$;

create or replace function public.reject_cat_submission(p_submission_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.is_cat_admin() then
        raise exception 'Only a cat map administrator can reject submissions.';
    end if;

    delete from public.cat_submissions where id = p_submission_id;
    if not found then
        raise exception 'Submission not found.';
    end if;
end;
$$;

grant select on public.cats to anon, authenticated;
grant insert, update, delete on public.cats to authenticated;
grant select on public.cat_editors to authenticated;
grant select, update, delete on public.cat_submissions to authenticated;
revoke insert on public.cat_submissions from public, anon, authenticated;
revoke all on function public.is_cat_admin() from public, anon;
revoke all on function public.report_cat_status(text, text, text) from public, anon;
revoke all on function public.report_cat_status(text, text) from public, anon;
revoke all on function public.approve_cat_submission(text) from public, anon;
revoke all on function public.reject_cat_submission(text) from public, anon;
grant execute on function public.is_cat_editor() to authenticated;
grant execute on function public.is_cat_admin() to authenticated;
grant execute on function public.report_cat_status(text, text, text) to authenticated;
grant execute on function public.report_cat_status(text, text) to authenticated;
grant execute on function public.approve_cat_submission(text) to authenticated;
grant execute on function public.reject_cat_submission(text) to authenticated;
grant execute on function public.check_in_cat_feed(text, text) to anon, authenticated;
grant execute on function public.give_cat_pate(text) to anon, authenticated;
grant execute on function public.toggle_cat_sos(text, boolean, text) to anon, authenticated;

insert into public.cat_editors (user_id, is_admin)
values ('642005de-39c8-4930-abbb-92c6169b67a1', true)
on conflict (user_id) do update set is_admin = true;

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'cats'
    ) then
        alter publication supabase_realtime add table public.cats;
    end if;
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'cat_submissions'
    ) then
        alter publication supabase_realtime add table public.cat_submissions;
    end if;
end;
$$;

-- Run only in the Sổ Tay Bắt Mèo Supabase project (sxeslpgevuzabvetfijl).
-- Favorites belong to an account and never change the shared cat record.
begin;

create table if not exists public.cat_favorites (
    user_id uuid not null default auth.uid()
        references auth.users(id) on delete cascade,
    cat_id text not null references public.cats(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, cat_id)
);

create index if not exists cat_favorites_cat_id_idx
    on public.cat_favorites (cat_id);

alter table public.cat_favorites enable row level security;

drop policy if exists "Users can view own cat favorites" on public.cat_favorites;
create policy "Users can view own cat favorites"
    on public.cat_favorites for select to authenticated
    using (user_id = (select auth.uid()));

drop policy if exists "Users can add own cat favorites" on public.cat_favorites;
create policy "Users can add own cat favorites"
    on public.cat_favorites for insert to authenticated
    with check (user_id = (select auth.uid()));

drop policy if exists "Users can remove own cat favorites" on public.cat_favorites;
create policy "Users can remove own cat favorites"
    on public.cat_favorites for delete to authenticated
    using (user_id = (select auth.uid()));

-- Supabase default privileges can include more than this feature needs.
revoke all on table public.cat_favorites from public, anon, authenticated;
grant select, insert, delete on table public.cat_favorites to authenticated;



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

-- ===== Ví Sen do server quản lý & chống spam (xem migrations/20261120_server_wallet_rate_limit.sql) =====

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
