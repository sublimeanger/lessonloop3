
# Comprehensive E2E Testing Plan for Investor Demo Readiness

## Executive Summary

This plan covers systematic end-to-end testing of LessonLoop across all three subscription tiers (Teacher, Studio, Agency) with production-like datasets. The goal is to validate every feature, ensure cohesive design, and identify any issues before investor review.

## Test Environment Setup

### Domain Email Requirements
All test accounts will use `@lessonloop.net` domain emails to verify Resend email delivery:
- Transactional emails from: `billing@`, `notifications@`, `noreply@`, `hello@`
- Test recipient addresses: `test-teacher@lessonloop.net`, `test-studio@lessonloop.net`, `test-agency@lessonloop.net`

### Test Account Structure

| Tier | Email | Org Type | Purpose |
|------|-------|----------|---------|
| **Teacher** | `test-teacher@lessonloop.net` | `solo_teacher` | Solo teacher with 10 students |
| **Studio** | `test-studio@lessonloop.net` | `academy` | Studio with 3 teachers, 25 students, 2 locations |
| **Agency** | `test-agency@lessonloop.net` | `agency` | Agency with 8 teachers, 50 students, 5 locations |

---

## Phase 1: Teacher Tier Testing (Solo Teacher)

### 1.1 Account Setup
1. **Signup & Onboarding**
   - Navigate to `/signup`
   - Register with `test-teacher@lessonloop.net`
   - Complete onboarding selecting "Solo Teacher"
   - Verify 30-day trial activated
   - Confirm FirstRunExperience appears

2. **Profile Configuration**
   - Update profile name to "Emma Thompson"
   - Set phone number

3. **Settings Setup**
   - Add organisation address
   - Configure VAT (optional)
   - Set default payment terms (14 days)
   - Create rate cards: 30min @ £25, 45min @ £35, 60min @ £45

### 1.2 Core Data Entry (10 Students)
Create realistic UK student profiles with guardians:

| Student | Guardian | Email | Relationship |
|---------|----------|-------|--------------|
| Oliver Brown | Sarah Brown | `parent1@lessonloop.net` | Mother (Primary Payer) |
| Sophie Williams | David Williams | `parent2@lessonloop.net` | Father (Primary Payer) |
| James Taylor | Emma Taylor | `parent3@lessonloop.net` | Mother (Primary Payer) |
| Charlotte Davies | Mark Davies | `parent4@lessonloop.net` | Father (Primary Payer) |
| Harry Wilson | Lisa Wilson | `parent5@lessonloop.net` | Mother (Primary Payer) |
| Amelia Anderson | Paul Anderson | `parent6@lessonloop.net` | Father (Primary Payer) |
| Thomas Martin | Karen Martin | `parent7@lessonloop.net` | Mother (Primary Payer) |
| Isabella White | John White | `parent8@lessonloop.net` | Father (Primary Payer) |
| George Harris | Claire Harris | `parent9@lessonloop.net` | Mother (Primary Payer) |
| Olivia Clark | Michael Clark | `parent10@lessonloop.net` | Father (Primary Payer) |

**For each student:**
- Use StudentWizard to create profile
- Add guardian with email and phone
- Mark guardian as Primary Payer
- Set teaching defaults (location, rate card)

### 1.3 Location Setup
1. Create single location: "Home Studio"
   - Type: Studio
   - Address: 42 Maple Lane, Cambridge, CB1 2AB
   - Add room: "Teaching Room"

2. **Verify Feature Gate**: Attempt to add second location
   - Should show upgrade prompt for Studio plan

### 1.4 Schedule Creation (4 Weeks)
Create realistic weekly schedule:

| Day | Time | Student | Duration |
|-----|------|---------|----------|
| Monday | 15:00 | Oliver Brown | 45 mins |
| Monday | 15:45 | Sophie Williams | 30 mins |
| Monday | 16:30 | James Taylor | 60 mins |
| Tuesday | 15:00 | Charlotte Davies | 45 mins |
| Tuesday | 16:00 | Harry Wilson | 45 mins |
| Wednesday | 14:30 | Amelia Anderson | 30 mins |
| Wednesday | 15:30 | Thomas Martin | 45 mins |
| Thursday | 15:00 | Isabella White | 60 mins |
| Thursday | 16:00 | George Harris | 30 mins |
| Friday | 15:00 | Olivia Clark | 45 mins |

**For each lesson:**
- Create with weekly recurrence (4 weeks)
- Verify conflict detection completes
- Add lesson notes for first occurrence
- Mark past lessons as "delivered"

### 1.5 Billing Workflow
1. **Billing Run**
   - Open BillingRunWizard
   - Select date range covering past lessons
   - Preview payer grouping
   - Generate invoices (should create 10 draft invoices)

2. **Invoice Management**
   - Review generated invoices
   - Edit one invoice to add custom line item
   - Send 5 invoices via email (verify emails arrive)
   - Record 3 payments (full and partial)
   - Send reminder for 2 overdue invoices
   - Void 1 invoice

3. **Manual Invoice**
   - Create manual invoice for "Exam prep materials"
   - Add line items manually
   - Send to parent

### 1.6 Parent Portal Testing
1. **Invite Guardian**
   - From Settings > Org Members, invite `parent1@lessonloop.net` as parent
   - Verify invite email sent
   - Accept invite (use incognito browser)

2. **Portal Experience**
   - Login as parent
   - Verify redirect to `/portal/home`
   - Check children cards display correctly
   - View upcoming lessons
   - View outstanding invoices with "Pay Now" button
   - Test Stripe checkout flow (test mode)
   - Submit reschedule request
   - Log practice session with timer

### 1.7 Reports Testing
- **Outstanding**: Verify ageing buckets show correctly
- **Lessons Delivered**: Check lesson counts
- **Revenue**: Confirm paid invoices reflected
- **Cancellations**: Test after cancelling a lesson

### 1.8 Messaging
- Compose and send email to guardian
- Verify message appears in log
- Test in-app message

### 1.9 Resources
- Upload PDF resource
- Share with student
- Verify visible in parent portal

### 1.10 LoopAssist AI
- Open LoopAssist drawer
- Test: "What lessons do I have this week?"
- Test: "Show me outstanding invoices"
- Test: "Draft a progress update for Oliver Brown"
- Test action confirmation flow

---

## Phase 2: Studio Tier Testing (Academy)

### 2.1 Account Setup
1. Create new account: `test-studio@lessonloop.net`
2. Complete onboarding as "Academy"
3. Configure organisation: "Melody Music Academy"

### 2.2 Multi-Location Setup
Create 2 locations:

| Location | Type | Rooms |
|----------|------|-------|
| Central Studio | Studio | Teaching Room A, Teaching Room B, Practice Room |
| Northside School | School | Music Room 1, Music Room 2 |

### 2.3 Teacher Team (3 Teachers)
Invite additional teachers:

| Teacher | Email | Instruments |
|---------|-------|-------------|
| Owner (self) | `test-studio@lessonloop.net` | Piano, Guitar |
| Teacher 1 | `teacher1@lessonloop.net` | Violin, Viola |
| Teacher 2 | `teacher2@lessonloop.net` | Drums, Percussion |

**For each teacher:**
- Send invite and accept
- Configure teacher profile (instruments, display name)
- Set availability blocks (working hours)

### 2.4 Student Roster (25 Students)
Create 25 students across multiple families:

**Multi-Child Families (test deduplication):**
- Wilson Family: 3 children (same primary payer)
- Thompson Family: 2 children (same primary payer)
- Regular families: 18 individual students

**Assign students to teachers:**
- Owner: 8 students
- Teacher 1: 10 students
- Teacher 2: 7 students

### 2.5 Rate Cards by Duration
- 30min: £28
- 45min: £38
- 60min: £48

### 2.6 Scheduling (4 Weeks)
Create cross-teacher schedule:
- Owner: Piano lessons M/W/F
- Teacher 1: Violin lessons Tu/Th
- Teacher 2: Drums W/Sat

**Test Conflicts:**
- Attempt double-booking same room
- Attempt student overlap
- Verify travel buffer warnings (if locations differ)

### 2.7 Billing with Family Deduplication
1. Run billing for past month
2. **Verify**: Wilson family (3 children) gets single invoice
3. **Verify**: Thompson family (2 children) gets single invoice
4. Total invoices should consolidate family payers

### 2.8 Payroll Report
- Run payroll report for past month
- Verify each teacher shows correct lesson counts and earnings

### 2.9 Room Utilisation Report
- View utilisation for Central Studio
- Verify percentage calculation against capacity

### 2.10 Reschedule Policy Testing
- Set org reschedule policy to "self_service"
- Login as parent
- Verify can pick new slot via RescheduleSlotPicker
- Change policy to "request_only"
- Verify parent can only submit request

### 2.11 Make-Up Credits
1. Cancel a lesson with reason
2. Issue make-up credit to student
3. Apply credit to next invoice
4. Verify invoice total reduced

---

## Phase 3: Agency Tier Testing

### 3.1 Account Setup
1. Create account: `test-agency@lessonloop.net`
2. Complete onboarding as "Agency"
3. Configure: "Premier Music Education Agency"

### 3.2 Multi-Location (5 Locations)
Simulate school-based teaching:

| Location | Type | Reschedule Policy |
|----------|------|-------------------|
| Head Office | Studio | self_service |
| Riverside Primary | School | admin_only |
| Oak Tree Academy | School | admin_only |
| Community Centre | Studio | request_only |
| Online | Online | self_service |

### 3.3 Teacher Team (8 Teachers)
Invite 7 additional teachers with varied profiles:
- Mix of employment types (permanent, contractor)
- Different instrument specialties
- Varied availability patterns

### 3.4 Student Roster (50 Students)
Distribute across locations and teachers:
- 10 students at each school location
- 20 students for private/online lessons
- Multiple multi-child families

### 3.5 High-Volume Scheduling
- Create 200+ lessons across 4 weeks
- Test calendar performance with large dataset
- Verify filters work efficiently

### 3.6 Bulk Operations
1. **Bulk Billing Run**: Generate 40+ invoices
2. **Bulk Send**: Select multiple drafts, send together
3. **Bulk Void**: Void multiple invoices

### 3.7 CSV Import Testing
- Prepare CSV with 20 students
- Test import mapping flow
- Verify students created correctly

### 3.8 Advanced Reports
All reports with larger dataset:
- Revenue trends over time
- Outstanding ageing with 40+ invoices
- Payroll across 8 teachers
- Utilisation across 5 locations

### 3.9 API Access Verification
- Verify API access feature is unlocked
- Check no feature gate blocks

### 3.10 Scale Testing
- Navigate through all pages with full dataset
- Verify no performance degradation
- Check mobile responsiveness with data

---

## Phase 4: Cross-Tier Validation

### 4.1 Feature Gate Accuracy
Verify correct restrictions per tier:

| Feature | Teacher | Studio | Agency |
|---------|---------|--------|--------|
| Multi-location | 1 only | Unlimited | Unlimited |
| Teachers | 1 | 5 (+£5/extra) | Unlimited |
| Payroll Reports | No | Yes | Yes |
| Room Utilisation | No | Yes | Yes |
| API Access | No | No | Yes |
| LoopAssist | Yes | Yes | Yes |

### 4.2 Upgrade Prompts
From Teacher tier:
- Attempt multi-location > verify upgrade prompt
- Attempt add teacher > verify upgrade prompt

### 4.3 Trial Expiry Flow
1. Manually set trial to expire in 1 day
2. Verify trial warning banner appears
3. Test Stripe checkout for subscription
4. Verify subscription activates correctly

---

## Phase 5: UI/UX Cohesion Check

### 5.1 Design Consistency Audit
For each page, verify:
- Consistent header patterns
- Breadcrumb accuracy
- Empty state illustrations
- Loading skeleton patterns
- Error state handling
- Mobile responsive layout

### 5.2 Dark Mode Testing
- Toggle dark mode
- Verify all pages render correctly
- Check contrast ratios

### 5.3 Mobile Testing (390x844)
Test all flows on mobile:
- Signup/onboarding
- Student creation
- Calendar navigation
- Invoice management
- Parent portal

### 5.4 Accessibility
- Tab navigation on key forms
- Screen reader landmarks
- Focus management in modals

---

## Phase 6: Email Verification

### 6.1 Transactional Emails
Verify receipt and content for:
- Invoice email (with "View & Pay" CTA)
- Payment reminder
- Invite email
- Streak milestone notification
- Practice reminder

### 6.2 Email Links
Test deep-links work:
- Invoice email > portal/invoices > correct invoice highlighted
- Invite email > accept flow works

---

## Phase 7: Error Handling & Edge Cases

### 7.1 Network Resilience
- Simulate slow network
- Verify loading states
- Test retry mechanisms

### 7.2 Data Edge Cases
- Student with no guardian
- Invoice with zero amount
- Lesson with past date
- Overlapping recurrence series

### 7.3 Browser Compatibility
- Chrome (primary)
- Safari
- Firefox
- Mobile Safari/Chrome

---

## Test Execution Order

```text
Day 1: Phase 1 (Teacher Tier)
├── 1.1-1.4: Setup & Core Data (2 hours)
├── 1.5-1.6: Billing & Portal (2 hours)
└── 1.7-1.10: Reports, Messages, AI (1 hour)

Day 2: Phase 2 (Studio Tier)
├── 2.1-2.4: Setup & Multi-entity (2 hours)
├── 2.5-2.8: Scheduling & Billing (2 hours)
└── 2.9-2.11: Advanced Features (1 hour)

Day 3: Phase 3 (Agency Tier)
├── 3.1-3.4: Large-scale Setup (2 hours)
├── 3.5-3.7: Bulk Operations (1.5 hours)
└── 3.8-3.10: Scale Testing (1.5 hours)

Day 4: Phases 4-7 (Cross-cutting)
├── Feature Gates & Upgrades (1 hour)
├── UI/UX Audit (2 hours)
├── Email & Error Testing (2 hours)
```

---

## Success Criteria

| Area | Criteria |
|------|----------|
| **Core Flows** | All user journeys complete without error |
| **Data Integrity** | No orphaned records, correct FK relationships |
| **Billing Accuracy** | Invoice totals match lesson rates, family deduplication works |
| **Email Delivery** | All transactional emails arrive with correct content |
| **Feature Gates** | Correct restrictions enforced per tier |
| **Performance** | Pages load <3s with full dataset |
| **Mobile** | All critical flows work on 390px width |
| **Design** | Consistent patterns, no broken layouts |

---

## Technical Notes

### Test Data Cleanup
After testing, preserve one account per tier for demo purposes. Document login credentials securely.

### Known Issues to Watch
1. **Conflict Detection Timeout**: Fixed with 5s failsafe + Skip button
2. **Calendar performance**: Monitor with 200+ lessons
3. **Email rate limits**: Resend has hourly limits

### Browser Automation
Use browser tool for systematic testing:
- Automate repetitive data entry
- Screenshot each major flow
- Capture network requests for debugging
