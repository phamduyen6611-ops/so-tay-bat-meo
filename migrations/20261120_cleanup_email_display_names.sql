-- Run only in the Sổ Tay Bắt Mèo Supabase project (sxeslpgevuzabvetfijl).
-- Dọn tên hiển thị công khai đã bị lấy từ phần trước dấu @ của email
-- (trước khi app có biệt danh). Đổi các tên đó thành 'Một Sen tốt bụng'.
--
-- Xem trước sẽ đổi bao nhiêu dòng (chạy riêng, không bắt buộc):
--   select 'cats' as bang, count(*) from public.cats c
--   where exists (select 1 from auth.users u where u.email is not null
--                 and lower(split_part(u.email, '@', 1)) = lower(trim(c.last_fed_by)))
--   union all
--   select 'cat_sightings', count(*) from public.cat_sightings s
--   where exists (select 1 from auth.users u where u.email is not null
--                 and lower(split_part(u.email, '@', 1)) = lower(trim(s.reporter_name)));
begin;

-- Tạm tắt trigger cập nhật updated_at/updated_by để việc dọn tên không làm
-- các bé mèo nhảy lên đầu danh sách "mới cập nhật".
alter table public.cats disable trigger set_cat_audit_fields;

update public.cats c
set last_fed_by = 'Một Sen tốt bụng'
where c.last_fed_by <> ''
  and exists (
      select 1 from auth.users u
      where u.email is not null
        and lower(split_part(u.email, '@', 1)) = lower(trim(c.last_fed_by))
  );

alter table public.cats enable trigger set_cat_audit_fields;

update public.cat_sightings s
set reporter_name = 'Một Sen tốt bụng'
where s.reporter_name <> ''
  and exists (
      select 1 from auth.users u
      where u.email is not null
        and lower(split_part(u.email, '@', 1)) = lower(trim(s.reporter_name))
  );

commit;
