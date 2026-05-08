# `avatars` storage bucket lacked mime restriction and size cap

**Severity:** medium
**Status:** fixed
**Area:** storage
**Discovered:** 2026-05-08
**Fixed:** 2026-05-08
**Fixed in:** Direct UPDATE on `storage.buckets` via Management API SQL
**Affected components:** `storage.buckets` row `avatars`

## Symptom

Pre-launch audit of all 5 storage buckets:

| bucket | public | size limit | allowed mime |
|---|---|---|---|
| avatars | true | **NULL** | **NULL** |
| invoice-pdfs | false | 10 MB | application/pdf |
| migration-dump | false | NULL | NULL |
| org-logos | true | 2 MB | image/png, jpeg, webp |
| teaching-resources | false | 50 MB | (broad allowlist) |

`avatars` is `public=true` (correct — avatars need to be served on every page) but lacked **both a file-size limit and an allowed-mime-type allowlist**. Any authenticated user could upload arbitrarily large files of any type into their own avatar folder.

## Risk

Mitigations already in place:
- RLS policies restrict writes to the user's own `<auth.uid()>/` subfolder (no cross-user clobber)
- CSP prevents foreign-origin script execution in browser context
- Avatars are served through Supabase's CDN, not as inline content

What was still possible:
- Disk pressure: a single attacker uploading 1 GB+ files to abuse storage quota
- Mime-confusion attacks: e.g. uploading an HTML file as `avatar.png` and linking to it from elsewhere — the CDN serves with mime detected from extension, so this is partially mitigated, but any client that fetches the URL with a relaxed parser could be tricked

Severity is medium rather than high because the file system is reasonably isolated and the worst exploit is quota abuse, not RCE.

## Fix

Direct UPDATE on `storage.buckets`:

```sql
UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif']::text[]
WHERE id = 'avatars';
```

This brings avatars in line with `org-logos` (2 MB cap, image-only mime) plus adds gif support for animated avatars.

## Verification

Post-change:
- Try uploading a 5 MB image → expect 413 / size-limit error
- Try uploading a `.txt` file with `text/plain` content-type → expect mime-rejection error
- Existing avatar files (already stored) continue to be served (the constraint is enforced at upload time, not on existing rows)

## Lessons / follow-ups

- Add to "new Supabase project bring-up checklist": verify every bucket has an explicit `file_size_limit` and `allowed_mime_types` matching its purpose.
- The `migration-dump` bucket also lacks a size limit — but it's owner-only via RLS and only the service_role writes to it. Acceptable for now.
- Consider a periodic storage audit alert: `SELECT bucket_id, count(*), sum(size) FROM storage.objects GROUP BY bucket_id` — if any user's avatar folder grows beyond 10 MB cumulative, investigate.
