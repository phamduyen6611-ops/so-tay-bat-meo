-- Migration: Bảng và hàm đồng bộ Ví Sen & Danh hiệu Sen
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
create policy "Anyone can read sen wallets"
    on public.sen_wallets for select to anon, authenticated
    using (true);

drop policy if exists "Anyone can insert or update sen wallets" on public.sen_wallets;
create policy "Anyone can insert or update sen wallets"
    on public.sen_wallets for all to anon, authenticated
    using (true)
    with check (true);

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
    v_rank_id text;
    v_rank_title text;
    v_row public.sen_wallets%rowtype;
    v_effective_streak int;
    v_effective_total_given int;
begin
    v_user_id := auth.uid();
    if v_user_id is not null then
        v_id := v_user_id::text;
    else
        v_id := trim(coalesce(p_client_id, ''));
        if v_id = '' then
            v_id := gen_random_uuid()::text;
        end if;
    end if;

    v_effective_streak := greatest(1, coalesce(p_streak, 1));
    v_effective_total_given := greatest(0, coalesce(p_total_given, 0));

    if v_effective_streak >= 30 or v_effective_total_given >= 50 then
        v_rank_id := 'rank_5';
        v_rank_title := 'Bảo Mẫu Hoàng Gia';
    elsif v_effective_streak >= 14 or v_effective_total_given >= 25 then
        v_rank_id := 'rank_4';
        v_rank_title := 'Đại Gia Pate';
    elsif v_effective_streak >= 7 or v_effective_total_given >= 10 then
        v_rank_id := 'rank_3';
        v_rank_title := 'Sen Cần Mẫn';
    elsif v_effective_streak >= 3 or v_effective_total_given >= 3 then
        v_rank_id := 'rank_2';
        v_rank_title := 'Sen Chu Đáo';
    else
        v_rank_id := 'rank_1';
        v_rank_title := 'Sen Tập Sự';
    end if;

    insert into public.sen_wallets (
        id, user_id, streak, pate, total_given, fed_count, rank_id, rank_title, last_checkin_date, updated_at
    )
    values (
        v_id, v_user_id, v_effective_streak, greatest(0, coalesce(p_pate, 3)),
        v_effective_total_given, greatest(0, coalesce(p_fed_count, 0)),
        v_rank_id, v_rank_title, coalesce(p_last_checkin_date, current_date), now()
    )
    on conflict (id) do update set
        user_id = coalesce(excluded.user_id, public.sen_wallets.user_id),
        streak = greatest(public.sen_wallets.streak, excluded.streak),
        pate = excluded.pate,
        total_given = greatest(public.sen_wallets.total_given, excluded.total_given),
        fed_count = greatest(public.sen_wallets.fed_count, excluded.fed_count),
        rank_id = excluded.rank_id,
        rank_title = excluded.rank_title,
        last_checkin_date = excluded.last_checkin_date,
        updated_at = now()
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

grant execute on function public.sync_sen_wallet(text, int, int, int, int, date) to anon, authenticated;
grant select, insert, update on table public.sen_wallets to anon, authenticated;
