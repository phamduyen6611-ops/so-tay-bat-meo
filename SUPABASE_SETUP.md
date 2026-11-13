# Shared cat map setup

The Supabase project is `so-tay-bat-meo` (`sxeslpgevuzabvetfijl`). Its `cats` and `cat_editors` tables, row-level security policies, audit trigger, and Realtime publication have been created. The project URL and publishable key are configured in `index.html`.

In shared mode, anyone can read the cat map, but only accounts listed in `public.cat_editors` can add, edit, or delete records. The browser UI is not the security boundary; the database policies enforce access.

## Finish deployment

1. Deploy `index.html` to a static HTTPS host. Supabase Auth invitation links need a stable web URL; the local `file://` URL is not suitable for inviting collaborators.
2. In Supabase **Authentication → URL Configuration**, set the deployed app URL as the Site URL and add it to the Redirect URLs list.
3. In Supabase **Authentication → Providers → Email**, disable public sign-ups so only invitations can create accounts.

## Invite editors

1. In Supabase **Authentication → Users**, invite the person's email.
2. Copy the invited user's UUID from the Users list.
3. Run this in the SQL Editor, replacing the UUID:

   ```sql
   insert into public.cat_editors (user_id)
   values ('00000000-0000-0000-0000-000000000000');
   ```

4. The invited person opens the invitation link, sets a password in the deployed app, and signs in. Only invited users with a matching `cat_editors` row can change shared data.

## Existing local data

Shared mode does not automatically upload or replace IndexedDB data. The local copies remain on the device. After an invited editor signs in, open the ☁️ account panel and use **Đưa ... mèo trên thiết bị lên dữ liệu chung** to explicitly upload them. The app asks for confirmation and keeps the originals on the device. You can also use **Sao lưu** to download a JSON backup.

The existing browser backup contains images as data URLs. This is convenient for small groups, but it increases database size; consider moving images to Supabase Storage if the collection grows substantially.
