# Phase 1 Audit Progress

Branch: `audit/phase-1-map`

## Setup
- [x] Read core context (claude.md, App.tsx, routes, edge fn directory, migrations, prior audits)
- [x] Create AUDIT_MAP.md and AUDIT_PROGRESS.md
- [x] Commit scaffolding

## Section 1: Flow Inventory (one cluster per commit)
- [x] 1.A Auth & onboarding
- [x] 1.B Academy setup (org, teachers, locations, students)
- [x] 1.C Scheduling (lessons, calendar, slots, recurrence)
- [x] 1.D Attendance & registers
- [x] 1.E Billing & invoicing
- [x] 1.F Payments (Stripe Connect, payment plans, auto-pay, refunds)
- [x] 1.G Xero sync
- [x] 1.H Term continuation
- [x] 1.I Make-up credits & waitlists
- [x] 1.J Parent portal
- [x] 1.K Messaging
- [x] 1.L Practice tracking & resources
- [x] 1.M Notes
- [ ] 1.N LoopAssist
- [ ] 1.O Subscriptions & trials
- [ ] 1.P Payroll
- [ ] 1.Q Reports & exports
- [ ] 1.R GDPR
- [ ] 1.S Native (iOS/Android)
- [ ] 1.T Marketing site → app

## Section 2: Cross-cutting concerns (one per commit)
- [ ] 2.1 Authn/Authz
- [ ] 2.2 Money handling
- [ ] 2.3 State machine enforcement
- [ ] 2.4 Idempotency
- [ ] 2.5 Migrations vs live schema risk
- [ ] 2.6 Cron/scheduled
- [ ] 2.7 External integrations
- [ ] 2.8 RPC inventory

## Section 3
- [ ] Known problem surface

## Section 4
- [ ] Phase 2 plan

## Final
- [ ] Report to user
