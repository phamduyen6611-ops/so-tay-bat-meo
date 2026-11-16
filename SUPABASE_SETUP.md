# Shared cat map setup

The Supabase project is `so-tay-bat-meo` (`sxeslpgevuzabvetfijl`). Its `cats` and `cat_editors` tables, row-level security policies, audit trigger, and Realtime publication have been created. The project URL and publishable key are configured in `index.html`.

Anyone can view the shared map and submit a cat without signing in. New submissions are private until an administrator approves them. Only invited editors can change approved map records; the administrator can review submissions in the app's account panel. Database row-level security and approval functions enforce these permissions.

## Deployment status

The app is hosted on GitHub Pages at <https://phamduyen6611-ops.github.io/so-tay-bat-meo/>. This URL is configured as the Supabase Auth Site URL and Redirect URL, and public email sign-ups are disabled.

## Invite editors

The invited account has admin access in `public.cat_editors`. Open the invitation email and set a password on the hosted app before signing in. Use **Chờ duyệt** in the account panel to approve or reject public submissions.

To invite another editor:

1. In Supabase **Authentication → Users**, invite the person's email.
2. Copy the invited user's UUID from the Users list.
3. Run this in the SQL Editor, replacing the UUID:

   ```sql
   insert into public.cat_editors (user_id)
   values ('00000000-0000-0000-0000-000000000000');
   ```

4. The invited person opens the invitation link, sets a password in the deployed app, and signs in. Only invited users with a matching `cat_editors` row can change approved shared data.

## Enable public submissions and moderation

Run the updated `supabase-setup.sql` in the Supabase SQL Editor. It adds the private `cat_submissions` queue, lets anonymous visitors submit pending cats, and installs admin-only approval/rejection functions. It also marks the existing administrator account as an admin. Pending submissions are not readable by the public and do not appear on the map until approved.

## Existing local data

Shared mode does not automatically upload or replace IndexedDB data. The local copies remain on the device. After an invited editor signs in, open the ☁️ account panel and use **Đưa ... mèo trên thiết bị lên dữ liệu chung** to explicitly upload them. The app asks for confirmation and keeps the originals on the device. You can also use **Sao lưu** to download a JSON backup.

The existing browser backup contains images as data URLs. This is convenient for small groups, but it increases database size; consider moving images to Supabase Storage if the collection grows substantially.
