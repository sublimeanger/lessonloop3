# AUDIT FIX CHECKLIST — March 2026
# Drop this file in repo root. Claude Code reads it to cross-reference pending branches.

## TIER 1 — LAUNCH BLOCKERS

SEC-C1 | CRITICAL | term_adjustments table does not exist | supabase/functions/process-term-adjustment/index.ts lines 445,535,898 write to it
SEC-C2 | CRITICAL | invoices.is_credit_note column missing | supabase/functions/process-term-adjustment/index.ts lines 379,393,806 filter on it
AI-H1  | CRITICAL | parent-loopassist-chat uses SERVICE_ROLE_KEY for all queries — bypasses ALL RLS | supabase/functions/parent-loopassist-chat/index.ts ~line 50
AI-H2  | CRITICAL | parent-loopassist-chat has ZERO input sanitisation (staff chat has 25+ regex patterns, parent has none) | supabase/functions/parent-loopassist-chat/index.ts
AI-H3  | CRITICAL | parent-loopassist-chat leaks raw error.message to client | supabase/functions/parent-loopassist-chat/index.ts ~line 351
PERF-H1| CRITICAL | gdpr-export 5x unbounded SELECT * — truncated at 1000 rows, GDPR non-compliant | supabase/functions/gdpr-export/index.ts lines 65-69

## TIER 2 — HIGH SEVERITY

CAL-H1  | HIGH | useResizeLesson writes org-local time as UTC — lessons shift by TZ offset on resize | src/components/calendar/useResizeLesson.ts line 116
CAL-H2  | HIGH | useCalendarSync.syncLessons fires N sequential edge function calls | src/hooks/useCalendarSync.ts lines 37-39
BIL-H1  | HIGH | useUpdateInvoiceStatus .update().eq('id') missing .eq('org_id') | src/hooks/useInvoices.ts ~line 293
MSG-H1  | HIGH | send-invoice-email status update by query not by known ID — non-deterministic | supabase/functions/send-invoice-email/index.ts lines 168,209-221
MSG-H2  | HIGH | useMarkInternalRead .update().eq('id') missing org_id + user_id scoping | src/hooks/useInternalMessages.ts ~line 263
MKP-H1  | HIGH | notify-makeup-match edge function has no authentication | supabase/functions/notify-makeup-match/index.ts
AUTH-H1 | HIGH | signUp() missing emailRedirectTo | src/contexts/AuthContext.tsx
PRT-M1  | HIGH | send-parent-message reply auth check uses && instead of || (line 127) | supabase/functions/send-parent-message/index.ts line 127
PUB-M1  | HIGH | marketing-chat passes unsanitised messages with no role validation | supabase/functions/marketing-chat/index.ts
MOB-M1  | HIGH | Deep link handler navigates to ANY path without validation | src/lib/native/init.ts

## TIER 3 — ORG-SCOPING BATCH (each is .update()/.delete() by ID without .eq('org_id'))

MKP-M1 | MEDIUM | deleteCredit | src/hooks/useMakeUpCredits.ts ~line 152
MKP-M2 | MEDIUM | useOfferMakeUp + useDismissMatch | src/hooks/useMakeUpWaitlist.ts ~lines 108,141
RPT-M1 | MEDIUM | useAddPracticeFeedback | src/hooks/usePractice.ts ~line 470
RPT-M2 | MEDIUM | useDeleteResource | src/hooks/useResources.ts ~line 225
RPT-M3 | MEDIUM | useUpdateResource | src/hooks/useUpdateResource.ts ~line 21
RPT-M4 | MEDIUM | useDeleteCategory + useUpdateCategory | src/hooks/useResourceCategories.ts ~lines 68,90
AI-M3  | MEDIUM | bulk_complete_lessons update without org_id | supabase/functions/looopassist-execute/index.ts
TERM-M3| MEDIUM | process-term-adjustment student query without org_id | supabase/functions/process-term-adjustment/index.ts

## TIER 3 — OTHER MEDIUM

SEC-H1  | MEDIUM | Leaked password protection disabled — enable in Supabase Auth settings
BIL-M1  | MEDIUM | Stripe checkout idempotency key collision | supabase/functions/stripe-create-checkout/index.ts ~line 270
BIL-M2  | MEDIUM | Auto-pay dedup checks amount not installment_id | supabase/functions/stripe-auto-pay-installment/index.ts ~lines 88-96
BIL-M3  | MEDIUM | Stripe customer lookup by email org-unscoped | supabase/functions/stripe-create-checkout/index.ts ~lines 201-204
MSG-M1  | MEDIUM | send-parent-reply is orphaned dead code (246 lines) | supabase/functions/send-parent-reply/index.ts
MSG-M2  | MEDIUM | Bulk message guardian fetch hits 1000-row limit | supabase/functions/send-bulk-message/index.ts ~line 440
MSG-M3  | MEDIUM | Thread search uses unescaped ILIKE pattern | src/hooks/useMessageThreads.ts ~line 268
MSG-M4  | MEDIUM | send-message accepts sender_user_id in body (benign but fragile) | supabase/functions/send-message/index.ts
SUB-M1  | MEDIUM | subscription_plan: plan || undefined is a no-op on downgrade | supabase/functions/stripe-webhook/index.ts ~line 544
SUB-M2  | MEDIUM | account-delete doesn't handle sole-owner orgs | supabase/functions/account-delete/index.ts
SUB-M3  | MEDIUM | gdpr-delete infers org from profile.current_org_id not explicit param | supabase/functions/gdpr-delete/index.ts
SUB-M4  | MEDIUM | No server-side grace period for past_due orgs | DB function is_org_write_allowed()
SUB-M5  | MEDIUM | check_subscription_active trigger missing from guardians, attendance_records, practice_logs
RPT-M5  | MEDIUM | Data export queries no pagination — 1000-row truncation | src/hooks/useDataExport.ts
RPT-M6  | MEDIUM | useTeacherPerformance sequential chunked queries | src/hooks/useTeacherPerformance.ts ~lines 157-164
CAL-M1  | MEDIUM | Week view now-line shows on past/future weeks | src/components/calendar/WeekTimeGrid.tsx ~line 341
CAL-M3  | MEDIUM | iCal feed US DST rules wrong (lastSun not firstSun November) | supabase/functions/calendar-ical-feed/index.ts ~lines 40-61
CAL-M4  | MEDIUM | Student picker limited to 500 | src/hooks/useCalendarData.ts ~line 272
EF-M1   | MEDIUM | ~20+ edge functions return raw error.message in 500 responses | grep -rn "error.message" supabase/functions/
PRT-M2  | MEDIUM | useStripePayment never resets isLoading on success | src/hooks/useStripePayment.ts ~line 46
CRM-M1  | MEDIUM | useConvertLead creates guardian without dupe check | search for useConvertLead
CRM-M2  | MEDIUM | useConvertLead uses 'parent' not valid RelationshipType | search for useConvertLead
CRM-M4  | MEDIUM | useStudentLessons orders by created_at not start_at | src/hooks/useStudentDetail.ts or useStudentDetailPage.ts
AUTH-M1 | MEDIUM | Signup Terms/Privacy links point to external URLs not internal routes
MKP-M3  | MEDIUM | useWaitlistStats fires 5 separate count queries | src/hooks/useMakeUpWaitlist.ts ~lines 241-249
AI-M1   | MEDIUM | Staff executeToolCall returns raw DB error.message to AI context | supabase/functions/looopassist-execute/index.ts
AI-M4   | MEDIUM | executeGenerateBillingRun bypasses create_invoice_with_items RPC | supabase/functions/looopassist-execute/index.ts
AI-M5   | MEDIUM | No concurrent proposal execution guard — race condition | supabase/functions/looopassist-execute/index.ts
AI-M6   | MEDIUM | No tool result size cap — could blow context window | supabase/functions/looopassist-execute/index.ts
TERM-M1 | MEDIUM | Term overlap validation client-side only — no DB constraint
TERM-M2 | MEDIUM | process-term-adjustment leaks raw error.message | supabase/functions/process-term-adjustment/index.ts
TERM-M4 | MEDIUM | Resource file type validation client-side only
PUB-M2  | MEDIUM | booking-get-slots no rate limiting | supabase/functions/booking-get-slots/index.ts
PUB-M3  | MEDIUM | booking-get-slots leaks teacher names/IDs to unauthed users | supabase/functions/booking-get-slots/index.ts
PUB-M4  | MEDIUM | booking-get-slots date range unbounded | supabase/functions/booking-get-slots/index.ts
PERF-M1 | MEDIUM | N+1: billing run loops individual DB ops | supabase/functions/create-billing-run/index.ts
PERF-M2 | MEDIUM | N+1: bulk_complete loops individual DB ops | supabase/functions/looopassist-execute/index.ts
PERF-M3 | MEDIUM | N+1: send_bulk_reminders loops individual DB ops
PERF-M4 | MEDIUM | LoopAssist 9 parallel queries per message — 900+ connections at scale | supabase/functions/looopassist-chat/index.ts
PERF-M5 | MEDIUM | Realtime subscriptions org-wide on 6 tables — excessive broadcasts
PERF-L2 | LOW    | Missing composite indexes on attendance_records, practice_logs, message_log

## RESOLVED

SUB-H1 | RESOLVED | check_student_limit trigger confirmed on students table
