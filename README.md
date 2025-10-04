# ================================
# File: README.md
# ================================
# Hospital Equipment Verification (Next.js + Supabase)
## Deploy
1) Supabase → run `supabase/schema.sql`, then `supabase/functions.sql`.
2) GitHub → add files from this repo.
3) Vercel → import repo, set env vars:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - NEXT_PUBLIC_SITE_URL
4) Open `/signin` → create first user (becomes admin).
5) Import CSV at `/admin/import`. Supported headers:
   - Level|Floor, Room Number|Room, Room Type|Room Name
   - PC Term ID, PC Term ID 2, Printer Term ID, Printer Term ID2
   - Downtime Setup (info-only)
   - All other numeric columns = expected equipment qty.
6) Verify rooms. Flags page for follow-ups. Floor progress/flag badges on Dashboard.

## Notes
- Term IDs and Downtime Setup are excluded from completion.
- Verified counts start empty (NULL) until you check items.
- Follow-Ups page supports filters + bulk assign/resolve.
