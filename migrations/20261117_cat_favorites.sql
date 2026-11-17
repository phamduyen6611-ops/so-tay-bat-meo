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

commit;
