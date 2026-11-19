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

drop policy if exists "Public can view cat sightings" on public.cat_sightings;
create policy "Public can view cat sightings"
    on public.cat_sightings for select to public
    using (true);

drop policy if exists "Anyone can insert cat sightings" on public.cat_sightings;
create policy "Anyone can insert cat sightings"
    on public.cat_sightings for insert to anon, authenticated
    with check (true);

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
    v_reporter text;
    v_note text;
begin
    v_sighting_id := gen_random_uuid()::text;
    v_reporter := trim(coalesce(p_reporter_name, ''));
    if v_reporter = '' then
        v_reporter := 'Một Sen tốt bụng';
    end if;
    if char_length(v_reporter) > 40 then
        v_reporter := substring(v_reporter from 1 for 40);
    end if;

    v_note := trim(coalesce(p_note, ''));
    if char_length(v_note) > 1000 then
        v_note := substring(v_note from 1 for 1000);
    end if;

    insert into public.cat_sightings (id, cat_id, seen_at, image, note, reporter_name, created_by, created_at)
    values (
        v_sighting_id,
        p_cat_id,
        coalesce(p_seen_at, now()),
        p_image,
        v_note,
        v_reporter,
        auth.uid(),
        now()
    );

    update public.cats
    set sightings_count = coalesce(sightings_count, 1) + 1
    where id = p_cat_id;

    if not found then
        raise exception 'Cat not found.';
    end if;

    return v_sighting_id;
end;
$$;

grant execute on function public.add_cat_sighting(text, text, text, text, timestamptz) to anon, authenticated;
grant select, insert on table public.cat_sightings to anon, authenticated;

commit;
