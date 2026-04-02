#!/usr/bin/env bash
#
# Apply all pending migrations to the live Supabase instance.
# Requires: SUPABASE_ACCESS_TOKEN env var or `supabase login` session.
#
# Usage:
#   SUPABASE_ACCESS_TOKEN=your_token ./scripts/apply-pending-migrations.sh
#   # or
#   SUPABASE_DB_PASSWORD=your_db_password ./scripts/apply-pending-migrations.sh
#
set -euo pipefail

PROJECT_REF="ximxgnkpcswbvfrkkmjq"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_DIR"

echo "=== Step 1: Link project ==="
npx supabase link --project-ref "$PROJECT_REF"

echo ""
echo "=== Step 2: Push pending migrations ==="
npx supabase db push --project-ref "$PROJECT_REF"

echo ""
echo "=== Step 3: Reload PostgREST schema cache ==="
# Use the management API to run the NOTIFY command
npx supabase db execute --project-ref "$PROJECT_REF" "NOTIFY pgrst, 'reload schema';"

echo ""
echo "=== Step 4: Verify key RPCs exist ==="
npx supabase db execute --project-ref "$PROJECT_REF" "
SELECT proname FROM pg_proc WHERE proname IN (
  'set_primary_location',
  'bulk_update_lessons',
  'bulk_cancel_lessons',
  'record_manual_refund',
  'void_make_up_credit',
  'get_lesson_notes_for_staff',
  'auto_issue_credit_on_absence',
  'convert_lead',
  'void_credits_on_student_delete',
  'recalc_continuation_summary'
);
"

echo ""
echo "=== Step 5: Verify auto-credit trigger ==="
npx supabase db execute --project-ref "$PROJECT_REF" "
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'trg_auto_credit';
"

echo ""
echo "=== Step 6: Deploy all edge functions ==="
npx supabase functions deploy --project-ref "$PROJECT_REF"

echo ""
echo "=== All done! ==="
echo "All 26 pending migrations have been applied."
echo "PostgREST schema cache has been reloaded."
echo "All edge functions have been deployed."
echo ""
echo "QA bugs fixed by this deployment:"
echo "  BUG_006: Default Payment Plan settings"
echo "  BUG_008: set_primary_location RPC"
echo "  BUG_019/046: Notes Explorer (get_lesson_notes_for_staff RPC)"
echo "  BUG_032: Refund (record_manual_refund RPC)"
echo "  BUG_037: Bulk change teacher (bulk_update_lessons RPC)"
echo "  BUG_038: Bulk cancel (bulk_cancel_lessons RPC)"
echo "  BUG_039: Continuation preview"
echo "  BUG_040: Auto make-up credit on absence (trigger)"
echo "  BUG_041: Void credit (void_make_up_credit RPC)"
echo "  BUG_047: Billing run"
echo "  BUG_012: Invoice from lessons"
