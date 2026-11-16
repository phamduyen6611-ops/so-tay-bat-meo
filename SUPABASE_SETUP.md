# Shared cat map setup

The Supabase project is `so-tay-bat-meo` (`sxeslpgevuzabvetfijl`). The project URL and publishable key are configured in `index.html`.

Anyone can view the shared map. Users create an account or sign in before adding cats; new cats appear on the map immediately. A signed-in user can edit or delete only cats created by that account. The administrator can edit and delete every cat. These permissions are enforced by Supabase row-level security, not just by the app interface.

When the location name field is left blank, the app sends the coordinates to OpenStreetMap's Nominatim reverse-geocoding service and saves the nearest available road or area name. Users can enter a location name themselves to skip the lookup. If the lookup fails, the cat is still saved with its coordinates and the app reports the failure.

Users can sign in to update a shared cat's status to **Vẫn thấy**, **Đã được giúp đỡ**, or **Không còn ở đây**. The map shows when a status was last reported. New cat records start as **Vẫn thấy**; existing records start as **Chưa cập nhật** until a user reports their status. Status updates go through a restricted database function and do not grant permission to edit another user's cat details.

## Deployment and account settings

The app is hosted on GitHub Pages at <https://phamduyen6611-ops.github.io/so-tay-bat-meo/>. This URL is configured as the Supabase Auth Site URL and Redirect URL.

In Supabase **Authentication → Settings → User Signups**, enable user signups. Email confirmation can remain enabled; new users will need to confirm their email before signing in. The app requires passwords of at least 8 characters.

On the login form, users can choose **Quên mật khẩu?**, enter their email, and follow the recovery link to set a new password in the app. Make sure the GitHub Pages URL is included in Supabase **Authentication → URL Configuration → Redirect URLs** so recovery links can return to the app.

## Apply database permissions

Run the updated `supabase-setup.sql` in the Supabase SQL Editor. It updates row-level security so authenticated users can create cats and manage only their own records, while the existing administrator retains access to all records. It also keeps the administrator account marked as an admin and disables new inserts into the legacy moderation queue.

Existing records keep their current `created_by` owner. Records without an owner can only be edited or deleted by the administrator. Cats already in the old moderation queue remain available for the admin to review, but no one can add new submissions there.

The database also enforces the app's field limits: cat names up to 40 characters, location names up to 120 characters, and notes up to 2,000 characters. These checks protect the shared data even when a write does not come through the app form.

Cat photos are stored in the public `cat-images` Supabase Storage bucket (maximum 3 MiB per file); only signed-in users can upload, and users can write only within their own folder. The map is public, so stored photos are publicly viewable. After applying the SQL setup, sign in as admin and use **Chuyển ảnh cũ lên Storage** in the account panel to migrate images from both the shared map and the legacy moderation queue. Each old database image is replaced only after its Storage upload and row update succeed. The button can be run again to resume if an earlier migration stops.

## Administrator

The existing administrator account is in `public.cat_editors` with `is_admin = true`. Sign in with that account in the app to manage all cats and review any entries left in the legacy moderation queue.

To grant another account administrator access:

1. The person creates an account in the app and confirms their email if required.
2. Copy their user UUID from Supabase **Authentication → Users**.
3. Run this in the SQL Editor, replacing the UUID:

   ```sql
   insert into public.cat_editors (user_id, is_admin)
   values ('00000000-0000-0000-0000-000000000000', true)
   on conflict (user_id) do update set is_admin = true;
   ```

## Existing local data

Shared mode does not automatically upload or replace IndexedDB data. Local copies remain on the device. After signing in, use **Đưa ... mèo trên thiết bị lên dữ liệu chung** to upload them. The account performing the upload becomes the owner of those new shared records. The app asks for confirmation and keeps the originals on the device. Use **Sao lưu** to download a JSON backup.

Browser backups include public image URLs for photos stored in Supabase Storage, so the photos can still be imported while the Storage bucket remains available.
