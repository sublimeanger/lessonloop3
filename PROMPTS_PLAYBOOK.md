# LessonLoop Polish Sprint — Prompt Playbook

> Copy-paste these prompts one at a time into Claude Code. Do them in order. Don't skip ahead. Each prompt is designed to be a self-contained session. If you break across days, start with Prompt 0 again.

---

## PROMPT 0 — Setup (start of every session)

```
Read every .md file in the project root: DESIGN_BRIEF.md, UX_CHECKLIST.md, FUNCTIONALITY_STANDARDS.md, FUNCTIONALITY_CHECKLIST.md, and COHESION_AUDIT.md. These are our world-class quality standards. Internalise them completely.

Critical rules for this sprint:
1. EVERY change must be checked at both 375px mobile AND 1280px+ desktop
2. Audit FIRST, list ALL issues, then fix one by one
3. Fix at the shared component level wherever possible — never patch page-by-page
4. After each fix, tell me what you changed and how to verify it in the browser
5. No change is too small. Pixel-level precision matters.
6. The quality bar is Linear/Stripe/Notion. If it doesn't match that tier, it's not done.
```

---

## PHASE 1: CROSS-APP COHESION (Do before touching individual pages)

### PROMPT 1 — Full Cohesion Audit

```
Run a complete cohesion audit using COHESION_AUDIT.md. Execute every bash search command in that file against the actual codebase. Go through every category:

1. Visual consistency — card styling, button variants, badge colours, icon sizes, shadows
2. Interaction consistency — add/delete patterns, modal behaviour, filter bar structure
3. Language consistency — terminology (Lesson not Session, Student not Pupil), button labels, toast message patterns, empty state copy tone
4. State consistency — skeleton selection, error boundary coverage, success feedback completeness
5. Animation consistency — page transitions, entrance animations, hover effects
6. Navigation consistency — sidebar highlighting, page titles, back navigation
7. Mobile consistency — modal behaviour on mobile, touch targets, bottom nav

List EVERY inconsistency grouped by category with the exact file and line number. Note whether each affects desktop, mobile, or both. Don't fix anything yet.
```

After reviewing the list:

```
Fix all cohesion issues starting with shared components so fixes cascade everywhere. Work through them in this order:
1. Shared components (EmptyState, LoadingState, PageHeader, DeleteValidationDialog, etc.)
2. Button patterns and variants
3. Badge/status colour mapping
4. Toast message patterns
5. Animation/transition consistency
6. Icon size standardisation

For each fix: tell me the file, what changed, and how to verify at both 375px and 1280px.
```

---

## PHASE 2: LAYOUT & SHARED COMPONENTS

### PROMPT 2 — Shared Components Deep Audit

```
Audit every shared/reusable component against DESIGN_BRIEF.md and UX_CHECKLIST.md. Open each file, read every line, check every class name, every prop, every render path.

Components to audit:
- src/components/shared/EmptyState.tsx (both EmptyState and InlineEmptyState)
- src/components/shared/LoadingState.tsx (LoadingState, LoadingSpinner, and EVERY skeleton variant: CalendarSkeleton, ListSkeleton, DashboardSkeleton, DetailSkeleton, PortalHomeSkeleton, GridSkeleton, CardSkeleton, TableRowSkeleton, StatsCardSkeleton, FormSkeleton, AppShellSkeleton)
- src/components/shared/ErrorBoundary.tsx
- src/components/shared/SectionErrorBoundary.tsx
- src/components/layout/PageHeader.tsx
- src/components/shared/DeleteValidationDialog.tsx
- src/components/shared/OfflineBanner.tsx
- src/components/shared/ContextualHint.tsx
- src/components/shared/HelpTooltip.tsx
- src/components/shared/OnboardingChecklist.tsx
- src/components/shared/LoopAssistPageBanner.tsx
- src/components/shared/AutoBreadcrumbs.tsx
- src/components/shared/KeyboardShortcuts.tsx
- src/components/shared/ScrollToTop.tsx
- src/components/shared/PageTransitionFallback.tsx

For each: check typography (uses semantic scale?), spacing (matches DESIGN_BRIEF?), colours (uses tokens?), responsiveness (works at 375px AND 1280px?), accessibility (ARIA roles, labels?), animation (uses defined tokens?).

List ALL issues with file, line number, what's wrong, which viewport affected. Then fix one by one.
```

### PROMPT 3 — Layout Components Deep Audit

```
Audit every layout component that wraps pages. These define the shell of the entire app, so they must be perfect.

Components:
- src/components/layout/AppLayout.tsx — admin shell
- src/components/layout/AppSidebar.tsx — sidebar nav with grouped items
- src/components/layout/Header.tsx — top bar
- src/components/layout/PortalLayout.tsx — parent portal shell (mobile + desktop paths)
- src/components/layout/PortalSidebar.tsx — portal desktop sidebar
- src/components/layout/PortalBottomNav.tsx — portal mobile bottom nav
- src/components/layout/NotificationBell.tsx — notification indicator
- src/components/NavLink.tsx — nav link component

Check:
Desktop (1280px):
- Sidebar: dark ink background, grouped nav, correct active highlighting, smooth collapse
- Header: clean, not cluttered, notification bell positioned correctly
- Content area: correct padding (p-4 md:p-6 lg:p-8 for admin, p-6 md:p-8 for portal)
- Portal: max-w-4xl mx-auto constraining content

Mobile (375px):
- Admin: sidebar collapses, hamburger accessible, content padding p-4
- Portal: PortalBottomNav renders (h-16, safe-area padding), ChildSwitcher above content, pb-24 on content
- Touch targets: all nav items 44x44px minimum
- Bottom nav: correct item highlighted, unread badge visible, active indicator bar
- No horizontal overflow anywhere

List ALL issues then fix.
```

---

## PHASE 3: PAGE-BY-PAGE AUDIT (Admin Pages)

### PROMPT 4 — Dashboard

```
Audit the Dashboard page and ALL sub-components at BOTH 375px and 1280px:

Files:
- src/pages/Dashboard.tsx
- src/components/dashboard/DashboardHero.tsx (time-aware greeting, sky scene SVGs, stat pills)
- src/components/dashboard/StatCard.tsx (variants: teal, coral, violet, emerald, default)
- src/components/dashboard/TodayTimeline.tsx (lesson rows, empty timeline)
- src/components/dashboard/QuickActionsGrid.tsx
- src/components/dashboard/FirstRunExperience.tsx (new user onboarding)
- src/components/dashboard/UrgentActionsBar.tsx
- src/components/dashboard/LoopAssistWidget.tsx
- src/components/dashboard/LoopAssistAlerts.tsx
- src/components/dashboard/CalendarSyncBanner.tsx

Desktop checks:
- DashboardHero: gradient backgrounds, animated sky scene, stat pills linking to pages, date badge
- StatCard grid: 4-col with whileHover spring animation, decorative gradient orbs
- TodayTimeline: lesson rows with colour bars, time alignment, NOW indicator
- Staggered entrance: itemVariants with opacity+y animation
- QuickActions grid layout

Mobile checks:
- DashboardHero: compact, sky scene smaller (h-16 w-16), date badge shortened
- Stat pills: wrap cleanly, text truncates
- StatCard grid: 2-col then 1-col, padding scales (p-4 sm:p-5 md:p-6)
- TodayTimeline: full-width, lesson rows don't overflow
- Everything tappable, no cramped elements

UX checklist: loading states, empty states, error boundaries, animations.
Functionality: stat data accuracy, links work, real-time invoice hook active.

List ALL issues noting viewport. Fix one by one.
```

### PROMPT 5 — Calendar

```
Audit the entire Calendar system at BOTH 375px and 1280px. This is the most complex page.

Files:
- src/pages/CalendarPage.tsx (main page, view state, filters)
- src/components/calendar/CalendarDesktopLayout.tsx
- src/components/calendar/CalendarMobileLayout.tsx
- src/components/calendar/WeekTimeGrid.tsx (desktop week view)
- src/components/calendar/DayTimelineView.tsx
- src/components/calendar/StackedWeekView.tsx
- src/components/calendar/AgendaView.tsx
- src/components/calendar/MobileWeekView.tsx
- src/components/calendar/MobileDayView.tsx
- src/components/calendar/MobileLessonSheet.tsx
- src/components/calendar/LessonCard.tsx (card rendered on the grid)
- src/components/calendar/LessonDetailPanel.tsx
- src/components/calendar/LessonDetailSidePanel.tsx
- src/components/calendar/LessonModal.tsx (create/edit lesson)
- src/components/calendar/lesson-form/LessonFormBody.tsx
- src/components/calendar/lesson-form/RecurrenceSection.tsx
- src/components/calendar/lesson-form/StudentSelector.tsx
- src/components/calendar/lesson-form/ConflictAlerts.tsx
- src/components/calendar/QuickCreatePopover.tsx
- src/components/calendar/RecurringActionDialog.tsx
- src/components/calendar/RecurringEditDialog.tsx
- src/components/calendar/CalendarFiltersBar.tsx
- src/components/calendar/CalendarFiltersBarWithHelp.tsx
- src/components/calendar/TeacherColourLegend.tsx
- src/components/calendar/WeekContextStrip.tsx
- src/components/calendar/MarkDayCompleteButton.tsx
- src/components/calendar/overlapLayout.ts
- src/components/calendar/teacherColours.ts
- src/components/calendar/useDragLesson.ts
- src/components/calendar/useResizeLesson.ts
- src/components/calendar/useLessonForm.ts
- src/components/calendar/calendarConstants.ts

Desktop: all 4 views render, drag/resize, conflict detection, filters, side panel, quick create, teacher colours.
Mobile: MobileWeekView/MobileDayView, MobileLessonSheet, filters collapse, date nav touch-friendly, no overflow.

List ALL issues. Fix one by one.
```

### PROMPT 6 — Students List + Import

```
Audit Students list page at BOTH viewports:
- src/pages/Students.tsx (search, StatusPills, student cards/rows)
- src/components/students/StudentWizard.tsx (multi-step creation)
- src/components/students/wizard/StudentInfoStep.tsx
- src/components/students/wizard/GuardianStep.tsx
- src/components/students/wizard/TeachingDefaultsStep.tsx
- src/components/students/wizard/WizardSuccess.tsx
- src/components/students/import/UploadStep.tsx
- src/components/students/import/MappingStep.tsx
- src/components/students/import/PreviewStep.tsx
- src/components/students/import/ImportingStep.tsx
- src/components/students/import/CompleteStep.tsx

Desktop: table/grid with search + filters, wizard in modal, import flow.
Mobile: cards not cramped table, wizard full-screen, search prominent, filters accessible.
List ALL issues. Fix.
```

### PROMPT 7 — Student Detail

```
Audit StudentDetail at BOTH viewports:
- src/pages/StudentDetail.tsx
- src/components/students/StudentInfoCard.tsx
- src/components/students/TeachingDefaultsCard.tsx
- src/components/students/GuardiansCard.tsx
- src/components/students/StudentTabsSection.tsx
- src/components/students/StudentLessonNotes.tsx
- src/components/students/StudentPracticePanel.tsx
- src/components/students/TeacherAssignmentsPanel.tsx
- src/components/students/MakeUpCreditsPanel.tsx
- src/components/students/CreditBalanceBadge.tsx
- src/components/students/IssueCreditModal.tsx
- src/components/students/InstrumentGradeSelector.tsx

Desktop: two-column layout, tabs, modals. Mobile: single-column, tabs work, modals full-screen.
List ALL issues. Fix.
```

### PROMPT 8 — Teachers + Attendance

```
Audit at BOTH viewports:
- src/pages/Teachers.tsx + src/components/teachers/TeacherQuickView.tsx
- src/pages/DailyRegister.tsx + src/components/register/RegisterRow.tsx + AbsenceReasonPicker.tsx
- src/pages/BatchAttendance.tsx

Desktop: layouts, inline actions, date navigation.
Mobile: cards, touch-friendly attendance buttons (44px min), absence picker as sheet not tiny popover.
List ALL issues. Fix.
```

### PROMPT 9 — Invoices & Billing

```
Audit the entire billing system at BOTH viewports:
- src/pages/Invoices.tsx
- src/pages/InvoiceDetail.tsx
- src/components/invoices/InvoiceList.tsx
- src/components/invoices/InvoiceFiltersBar.tsx + InvoiceFiltersBarWithHelp.tsx
- src/components/invoices/InvoiceStatsWidget.tsx
- src/components/invoices/CreateInvoiceModal.tsx
- src/components/invoices/BillingRunWizard.tsx
- src/components/invoices/RecordPaymentModal.tsx
- src/components/invoices/SendInvoiceModal.tsx
- src/components/invoices/BulkActionsBar.tsx
- src/components/invoices/PaymentPlanSetup.tsx
- src/components/invoices/PaymentPlansDashboard.tsx
- src/components/invoices/InstallmentTimeline.tsx

Desktop: table, bulk selection, stats grid, modals. Mobile: cards, filters collapse, modals full-screen, currency large and readable. All money via formatCurrencyMinor().
List ALL issues. Fix.
```

### PROMPT 10 — Make-Ups, Practice, Resources

```
Audit at BOTH viewports:

Make-Ups:
- src/pages/MakeUpDashboard.tsx
- src/components/makeups/MakeUpStatsCards.tsx, NeedsActionSection.tsx, WaitlistTable.tsx, AddToWaitlistDialog.tsx

Practice:
- src/pages/Practice.tsx
- src/components/practice/CreateAssignmentModal.tsx, PracticeTrendsChart.tsx, StreakBadge.tsx, StreakCelebration.tsx, TeacherPracticeReview.tsx

Resources:
- src/pages/Resources.tsx
- src/components/resources/ResourceCard.tsx, ResourceDetailModal.tsx, ResourcePreviewModal.tsx, UploadResourceModal.tsx, ShareResourceModal.tsx, ManageCategoriesModal.tsx, CategoryPicker.tsx, AudioPlayer.tsx

Desktop and mobile checks per DESIGN_BRIEF and all checklists.
List ALL issues. Fix.
```

### PROMPT 11 — Messages

```
Audit at BOTH viewports:
- src/pages/Messages.tsx
- src/components/messages/MessageList.tsx, ThreadedMessageList.tsx, ThreadCard.tsx, ThreadMessageItem.tsx
- src/components/messages/MessageFiltersBar.tsx, RecipientFilter.tsx
- src/components/messages/ComposeMessageModal.tsx, BulkComposeModal.tsx, InternalComposeModal.tsx
- src/components/messages/InternalMessageList.tsx, MessageRequestsList.tsx

Desktop: list/thread view, compose modal, filters. Mobile: full-width messages, compose full-screen, send button above keyboard.
List ALL issues. Fix.
```

### PROMPT 12 — Reports

```
Audit at BOTH viewports:
- src/pages/Reports.tsx
- src/pages/reports/LessonsDelivered.tsx, Revenue.tsx, Outstanding.tsx, Cancellations.tsx, Payroll.tsx, Utilisation.tsx
- src/components/reports/DateRangeFilter.tsx, ReportPagination.tsx, ReportSkeleton.tsx, SortableTableHead.tsx

Desktop: tables, date pickers, pagination. Mobile: tables scroll or convert to cards, date filter doesn't overflow, pagination touch-friendly.
List ALL issues. Fix.
```

### PROMPT 13 — Locations + Settings

```
Audit at BOTH viewports:

Locations:
- src/pages/Locations.tsx

Settings (every tab):
- src/pages/Settings.tsx
- src/components/settings/ProfileTab.tsx, OrganisationTab.tsx, OrgMembersTab.tsx, InviteMemberDialog.tsx, PendingInvitesList.tsx, BillingTab.tsx, CalendarIntegrationsTab.tsx, CalendarSyncHealth.tsx, InvoiceSettingsTab.tsx, RateCardsTab.tsx, SchedulingSettingsTab.tsx, TeacherAvailabilityTab.tsx, TermManagementCard.tsx, NotificationsTab.tsx, MessagingSettingsTab.tsx, MusicSettingsTab.tsx, LoopAssistPreferencesTab.tsx, BrandingTab.tsx, PrivacyTab.tsx, HelpToursTab.tsx, AuditLogTab.tsx

Desktop: tab navigation, form layouts, tables. Mobile: tabs scroll horizontally or dropdown, forms single-column, save buttons reachable.
List ALL issues. Fix.
```

---

## PHASE 4: PORTAL (Mobile-First Priority)

### PROMPT 14 — Portal Home + Schedule

```
Audit at 375px FIRST (parents use phones), then 1280px:

Portal Home:
- src/pages/portal/PortalHome.tsx
- src/components/portal/PortalWelcomeDialog.tsx, ChildSwitcher.tsx, PortalErrorState.tsx, PortalFeatureDisabled.tsx

Portal Schedule:
- src/pages/portal/PortalSchedule.tsx
- src/components/portal/RequestModal.tsx, RescheduleSlotPicker.tsx, MakeUpStepper.tsx

Mobile priority: ChildSwitcher prominent, next lesson front-and-centre, request modal full-screen, reschedule slots large and tappable, everything scannable in seconds.
List ALL issues. Fix.
```

### PROMPT 15 — Portal Invoices + Practice

```
Audit at 375px FIRST, then 1280px:

Portal Invoices:
- src/pages/portal/PortalInvoices.tsx
- src/components/portal/PaymentPlanInvoiceCard.tsx

Portal Practice:
- src/pages/portal/PortalPractice.tsx
- src/components/portal/PracticeTimer.tsx, PracticeHistory.tsx, WeeklyProgressCard.tsx, ThisWeekFocus.tsx

Mobile priority: Pay button full-width and PRIMARY, currency large and readable, timer with big start/stop button, progress motivating and scannable.
List ALL issues. Fix.
```

### PROMPT 16 — Portal Resources + Messages + Profile

```
Audit at 375px FIRST, then 1280px:
- src/pages/portal/PortalResources.tsx
- src/pages/portal/PortalMessages.tsx
- src/pages/portal/PortalProfile.tsx

Mobile: resources single-column, audio player touch-friendly, messages full-width, compose full-screen, profile form single-column with reachable save.
List ALL issues. Fix.
```

---

## PHASE 5: SUPPLEMENTARY SYSTEMS

### PROMPT 17 — LoopAssist AI System

```
Audit at BOTH viewports:
- src/components/loopassist/LoopAssistDrawer.tsx
- src/components/loopassist/LoopAssistIntroModal.tsx
- src/components/loopassist/ActionCard.tsx, EntityChip.tsx, MessageFeedback.tsx
- src/components/loopassist/ProactiveAlerts.tsx, ProactiveWelcome.tsx, ResultCard.tsx
- src/components/parent-portal/ParentLoopAssist.tsx
- src/components/dashboard/LoopAssistWidget.tsx

Desktop: drawer width appropriate, cards laid out, response formatting. Mobile: drawer full-screen or near, input above keyboard, action cards tappable, entity chips don't overflow.
List ALL issues. Fix.
```

### PROMPT 18 — Auth + Onboarding + Subscription

```
Audit at BOTH viewports:
- src/pages/Login.tsx, Signup.tsx, ForgotPassword.tsx, ResetPassword.tsx, VerifyEmail.tsx, AcceptInvite.tsx
- src/pages/Onboarding.tsx
- src/components/onboarding/OnboardingProgress.tsx, PlanSelector.tsx
- src/components/auth/PasswordStrengthIndicator.tsx, RouteGuard.tsx
- src/components/subscription/FeatureGate.tsx, TrialExpiredModal.tsx, UpgradeBanner.tsx

Desktop: centred forms, plan selector grid. Mobile: full-width forms, plan selector stacks, social login buttons full-width, password fields don't trigger iOS zoom, all CTAs reachable.
List ALL issues. Fix.
```

### PROMPT 19 — Help + Tours

```
Audit at BOTH viewports:
- src/pages/Help.tsx
- src/components/help/HelpSearch.tsx, HelpCategory.tsx, HelpArticle.tsx, helpArticles.ts
- src/components/tours/TourProvider.tsx, TourTrigger.tsx

Desktop: search, article grid, tour tooltips. Mobile: search full-width, articles stack, tour tooltips don't overflow or overlap bottom nav.
List ALL issues. Fix.
```

---

## PHASE 6: FINAL QUALITY ASSURANCE

### PROMPT 20 — Final Cohesion Sweep

```
The full sprint is complete. Now do one FINAL cohesion sweep across the entire app. Run every search command from COHESION_AUDIT.md again. Navigate to every single page at both 375px and 1280px.

Check for anything that drifted during fixes:
- Inconsistent button labels or variants
- Mismatched toast messages
- Different skeleton patterns
- Terminology drift (Lesson vs Session, Student vs Pupil)
- Spacing inconsistencies between pages
- Modal behaviour inconsistency on mobile
- Animation inconsistency
- Missing error boundaries
- Missing empty states
- Badge colour mismatches

List EVERY remaining issue. Fix them all.
```

### PROMPT 21 — Build Verification

```
Run the full quality gate:
1. npm run build — fix ALL errors
2. npm run lint — fix ALL warnings
3. npm run typecheck — fix ALL type errors
4. Check for any console.log statements that shouldn't be in production
5. Check for any TODO comments that should be resolved
6. Verify no "any" types unless explicitly justified

The app must be completely clean. Zero errors, zero warnings.
```

---

## Notes

- **If context fills up mid-prompt:** Start a new session, run Prompt 0 again, then resume where you left off.
- **If you need to break across days:** Always start with Prompt 0 to re-load the standards.
- **If a fix breaks something:** Tell Claude Code to revert and try a different approach.
- **Give feedback as you go:** "Too tight", "Wrong colour", "Looks off on mobile" — be specific.
- **The bar is Linear/Stripe/Notion.** If it doesn't match, it's not done.
