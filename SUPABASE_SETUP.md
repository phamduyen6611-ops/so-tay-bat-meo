# Shared cat map setup

The Supabase project is `so-tay-bat-meo` (`sxeslpgevuzabvetfijl`). The project URL and publishable key are configured in `index.html`.

Anyone can view the shared map. Users create an account or sign in before adding cats; new cats appear on the map immediately. A signed-in user can edit or delete only cats created by that account. The administrator can edit and delete every cat. These permissions are enforced by Supabase row-level security, not just by the app interface.

When the location name field is left blank, the app sends the coordinates to OpenStreetMap's Nominatim reverse-geocoding service and saves the nearest available road or area name. Users can enter a location name themselves to skip the lookup. If the lookup fails, the cat is still saved with its coordinates and the app reports the failure.

## Deployment and account settings

The app is hosted on GitHub Pages at <https://phamduyen6611-ops.github.io/so-tay-bat-meo/>. This URL is configured as the Supabase Auth Site URL and Redirect URL.

In Supabase **Authentication → Settings → User Signups**, enable user signups. Email confirmation can remain enabled; new users will need to confirm their email before signing in. The app requires passwords of at least 8 characters.

## Apply database permissions

Run the updated `supabase-setup.sql` in the Supabase SQL Editor. It updates row-level security so authenticated users can create cats and manage only their own records, while the existing administrator retains access to all records. It also keeps the administrator account marked as an admin.

Existing records keep their current `created_by` owner. Records without an owner can only be edited or deleted by the administrator. Cats already in the old moderation queue remain available for the admin to review; new cats no longer wait for approval.

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

The existing browser backup contains images as data URLs. This is convenient for small groups, but it increases database size; consider moving images to Supabase Storage if the collection grows substantially.
