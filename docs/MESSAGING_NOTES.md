# LessonLoop Messaging — Design Notes

## Email From Addresses
- billing@lessonloop.net — invoices, receipts, refunds, overdue reminders
- notifications@lessonloop.net — lesson notes, make-up offers, cancellations
- noreply@lessonloop.net — invites, booking confirmations
- hello@lessonloop.net — trial reminders (LessonLoop-branded)

## Notification Preferences
- Transactional emails (invoices, receipts, refunds) ALWAYS send
- Marketing/reminder emails check `isNotificationEnabled()` before sending
- Default: transactional = opt-in, marketing = opt-out (GDPR/PECR)
- Preference keys: email_lesson_reminders, email_invoice_reminders,
  email_payment_receipts, email_marketing, email_makeup_offers

## Message Log Retention
- `message_log` stores all outbound email records indefinitely
- Recommended cleanup: DELETE WHERE sent_at < NOW() - INTERVAL '12 months'
- Run monthly via manual query or scheduled job

## Email Retry
- Currently no automatic retry for failed emails
- Failed sends are logged with `status: 'failed'` and `error_message`
- Future: implement a cron job that retries `status: 'failed'` entries
  where `created_at > NOW() - INTERVAL '24 hours'`
