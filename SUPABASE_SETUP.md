# Shared cat map setup

The Supabase project is `so-tay-bat-meo` (`sxeslpgevuzabvetfijl`). Its `cats` and `cat_editors` tables, row-level security policies, audit trigger, and Realtime publication have been created. The project URL and publishable key are configured in `index.html`.

In shared mode, anyone can read the cat map, but only accounts listed in `public.cat_editors` can add, edit, or delete records. The browser UI is not the security boundary; the database policies enforce access.

## Deployment status

The app is hosted on GitHub Pages at <https://phamduyen6611-ops.github.io/so-tay-bat-meo/>. This URL is configured as the Supabase Auth Site URL and Redirect URL, and public email sign-ups are disabled.

## Invite editors

The first editor has been invited and added to `public.cat_editors`. They need to open the invitation email and set a password on the hosted app before signing in.

To invite another editor:

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
