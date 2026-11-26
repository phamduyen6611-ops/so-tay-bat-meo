begin;
create table if not exists public.cat_profiles (
 id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
 display_name text not null check (char_length(btrim(display_name)) between 1 and 40)
);
create table if not exists public.cat_comments (
 id uuid primary key default gen_random_uuid(),
 cat_id text not null references public.cats(id) on delete cascade,
 author_id uuid not null references public.cat_profiles(id) on delete cascade default auth.uid(),
 parent_id uuid references public.cat_comments(id) on delete set null,
 body text not null check (char_length(btrim(body)) between 1 and 1500),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists cat_comments_cat_time on public.cat_comments(cat_id,created_at desc,id);
create index if not exists cat_comments_parent on public.cat_comments(parent_id);
create table if not exists public.cat_comment_reports (
 id uuid primary key default gen_random_uuid(),
 comment_id uuid not null references public.cat_comments(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 reason text not null check (char_length(btrim(reason)) between 1 and 500),
 created_at timestamptz not null default now(),
 unique(comment_id,reporter_id)
);
create or replace function public.validate_cat_comment() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
 if tg_op = 'INSERT' and new.parent_id is not null then
   if not exists(select 1 from public.cat_comments p where p.id=new.parent_id and p.cat_id=new.cat_id and p.parent_id is null) then
     raise exception 'Câu trả lời phải thuộc bình luận gốc của cùng bé mèo';
   end if;
 end if;
 if tg_op = 'UPDATE' then new.updated_at=now(); end if;
 return new;
end $$;
revoke all on function public.validate_cat_comment() from public;
drop trigger if exists validate_cat_comment on public.cat_comments;
create trigger validate_cat_comment before insert or update on public.cat_comments
 for each row execute function public.validate_cat_comment();
alter table public.cat_profiles enable row level security;
alter table public.cat_comments enable row level security;
alter table public.cat_comment_reports enable row level security;
revoke all on public.cat_profiles,public.cat_comments,public.cat_comment_reports from anon,authenticated;
grant select on public.cat_profiles,public.cat_comments to anon,authenticated;
grant insert(id,display_name),update(id,display_name) on public.cat_profiles to authenticated;
grant insert(cat_id,author_id,parent_id,body),update(body),delete on public.cat_comments to authenticated;
grant select,delete on public.cat_comment_reports to authenticated;
grant insert(comment_id,reporter_id,reason) on public.cat_comment_reports to authenticated;
drop policy if exists profiles_read on public.cat_profiles;
create policy profiles_read on public.cat_profiles for select using(true);
drop policy if exists profiles_insert on public.cat_profiles;
create policy profiles_insert on public.cat_profiles for insert to authenticated with check(id=(select auth.uid()));
drop policy if exists profiles_update on public.cat_profiles;
create policy profiles_update on public.cat_profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
drop policy if exists comments_read on public.cat_comments;
create policy comments_read on public.cat_comments for select using(true);
drop policy if exists comments_insert on public.cat_comments;
create policy comments_insert on public.cat_comments for insert to authenticated with check(author_id=(select auth.uid()));
drop policy if exists comments_update on public.cat_comments;
create policy comments_update on public.cat_comments for update to authenticated using(author_id=(select auth.uid())) with check(author_id=(select auth.uid()));
drop policy if exists comments_delete on public.cat_comments;
create policy comments_delete on public.cat_comments for delete to authenticated using(author_id=(select auth.uid()) or public.is_cat_admin());
drop policy if exists reports_read on public.cat_comment_reports;
create policy reports_read on public.cat_comment_reports for select to authenticated using(reporter_id=(select auth.uid()) or public.is_cat_admin());
drop policy if exists reports_insert on public.cat_comment_reports;
create policy reports_insert on public.cat_comment_reports for insert to authenticated with check(reporter_id=(select auth.uid()));
drop policy if exists reports_delete on public.cat_comment_reports;
create policy reports_delete on public.cat_comment_reports for delete to authenticated using(public.is_cat_admin());
commit;
