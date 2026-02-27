export interface HelpArticle {
  id: string;
  title: string;
  category: HelpCategory;
  summary: string;
  content: string;
  keywords: string[];
}

export type HelpCategory = 
  | 'getting-started'
  | 'students-guardians'
  | 'scheduling'
  | 'invoicing'
  | 'parent-portal'
  | 'loopassist'
  | 'settings'
  | 'troubleshooting';

export const categoryLabels: Record<HelpCategory, { title: string; description: string; icon: string }> = {
  'getting-started': {
    title: 'Getting Started',
    description: 'Initial setup and first steps',
    icon: 'Rocket',
  },
  'students-guardians': {
    title: 'Students & Guardians',
    description: 'Managing student records and guardian linking',
    icon: 'Users',
  },
  'scheduling': {
    title: 'Scheduling',
    description: 'Calendar, recurring lessons, and conflict detection',
    icon: 'Calendar',
  },
  'invoicing': {
    title: 'Invoicing & Billing',
    description: 'Creating invoices, billing runs, and payments',
    icon: 'Receipt',
  },
  'parent-portal': {
    title: 'Parent Portal',
    description: 'How parents access and use their portal',
    icon: 'Home',
  },
  'loopassist': {
    title: 'LoopAssist AI',
    description: 'Your AI assistant for queries and actions',
    icon: 'Sparkles',
  },
  'settings': {
    title: 'Settings & Configuration',
    description: 'Rate cards, locations, and team management',
    icon: 'Settings',
  },
  'troubleshooting': {
    title: 'Troubleshooting',
    description: 'Common issues and solutions',
    icon: 'HelpCircle',
  },
};

export const helpArticles: HelpArticle[] = [
  // Getting Started
  {
    id: 'welcome',
    title: 'Welcome to LessonLoop',
    category: 'getting-started',
    summary: 'An introduction to LessonLoop and its core features.',
    content: `
# Welcome to LessonLoop

LessonLoop is the complete scheduling and billing platform for UK music teachers, studios, and academies.

## Core Features

- **Smart Scheduling**: Calendar-first design with conflict detection and recurring lesson support
- **Automated Billing**: Generate invoices for terms or months with a few clicks
- **Parent Portal**: Give parents visibility into lessons, payments, and practice
- **LoopAssist AI**: Your intelligent assistant for quick queries and actions

## Getting Started

1. Complete your organisation setup during onboarding
2. Add your first students and their guardians
3. Create lessons in the calendar
4. Set up rate cards for billing
5. Generate your first invoices

Need help? Use LoopAssist (sparkle icon) to ask questions or request actions.
    `,
    keywords: ['welcome', 'introduction', 'getting started', 'overview', 'features'],
  },
  {
    id: 'first-student',
    title: 'Adding Your First Student',
    category: 'getting-started',
    summary: 'How to add students and link them to guardians.',
    content: `
# Adding Your First Student

## Step 1: Navigate to Students

Click "Students" in the sidebar to open the student list.

## Step 2: Click "Add Student"

Use the "Add Student" button in the top right corner.

## Step 3: Enter Student Details

Fill in:
- **Full Name** (required)
- **Email** (optional, for adult students)
- **Phone** (optional)
- **Status** (Active, Inactive, or Trial)

## Step 4: Link a Guardian (Optional)

For younger students, link a guardian who will receive invoices and notifications.

## Step 5: Assign a Rate Card

Select a rate card to determine lesson pricing for this student.

## Tips

- You can import students in bulk via CSV
- Students can have multiple guardians (e.g., both parents)
- Use the "Trial" status for students on trial lessons
    `,
    keywords: ['student', 'add', 'create', 'guardian', 'first', 'new'],
  },
  {
    id: 'first-lesson',
    title: 'Creating Your First Lesson',
    category: 'getting-started',
    summary: 'How to schedule lessons in the calendar.',
    content: `
# Creating Your First Lesson

## Quick Create (Click)

1. Go to the **Calendar** page
2. Click on any time slot
3. Fill in lesson details
4. Click "Create Lesson"

## Drag to Create

1. Click and drag on the calendar to set duration
2. The lesson modal opens with the time pre-filled
3. Add student, location, and notes
4. Save the lesson

## Lesson Details

- **Title**: Auto-generated from student name or custom
- **Student**: Select one or more students (group lessons)
- **Duration**: 30, 45, or 60 minutes typically
- **Location**: Choose from your locations
- **Notes**: Add private or shared notes

## Recurring Lessons

Enable "Repeat" to create weekly lessons automatically.

## Conflict Detection

LessonLoop warns you if lessons overlap or conflict with closures.
    `,
    keywords: ['lesson', 'create', 'schedule', 'calendar', 'first', 'new', 'recurring'],
  },

  // Students & Guardians
  {
    id: 'managing-students',
    title: 'Managing Student Records',
    category: 'students-guardians',
    summary: 'View, edit, and organise your student database.',
    content: `
# Managing Student Records

## Student List

The Students page shows all your students with:
- Name and status
- Linked guardian(s)
- Next scheduled lesson
- Outstanding balance

## Student Detail View

Click any student to see:
- **Overview**: Contact info, status, rate card
- **Lessons**: Past and upcoming lessons
- **Invoices**: Payment history
- **Practice**: Practice logs and assignments
- **Notes**: Private teacher notes

## Status Types

- **Active**: Currently taking lessons
- **Inactive**: Paused or on break
- **Trial**: On trial period

## Bulk Actions

Select multiple students to:
- Change status
- Assign rate cards
- Send messages

## Import Students

Use "Import" to upload students from a CSV file.
    `,
    keywords: ['student', 'manage', 'edit', 'status', 'list', 'bulk'],
  },
  {
    id: 'linking-guardians',
    title: 'Linking Guardians to Students',
    category: 'students-guardians',
    summary: 'How to connect parents and guardians for billing and communication.',
    content: `
# Linking Guardians to Students

## Why Link Guardians?

Guardians are the billing contacts for students. They:
- Receive invoices
- Access the Parent Portal
- Get lesson notifications

## Adding a Guardian

1. Go to the student's detail page
2. Click "Add Guardian" in the guardians section
3. Enter name, email, and phone
4. The guardian receives a portal invite

## Guardian Portal Access

Linked guardians can:
- View upcoming lessons
- Pay invoices online
- Track practice logs
- Send messages to teachers

## Multiple Guardians

Students can have multiple guardians (e.g., divorced parents). Each guardian:
- Gets their own portal login
- Can receive separate invoices (if needed)

## Adult Students

Adult students can be their own billing contact. No guardian link is needed.
    `,
    keywords: ['guardian', 'parent', 'link', 'portal', 'billing', 'contact'],
  },

  // Scheduling
  {
    id: 'calendar-views',
    title: 'Using Calendar Views',
    category: 'scheduling',
    summary: 'Navigate between week, month, and agenda views.',
    content: `
# Using Calendar Views

## Week View (Default)

Shows a weekly grid with:
- Time slots from your working hours
- Lessons as coloured cards
- Teacher colour coding

Best for: Day-to-day scheduling

## Month View

Shows a monthly overview with:
- Lesson counts per day
- Quick date navigation
- Closure dates highlighted

Best for: Planning ahead

## Agenda View

Shows a list of upcoming lessons:
- Chronological order
- Quick details at a glance
- Easy filtering

Best for: Daily planning, register

## Navigation

- Use arrows to go forward/back
- Click "Today" to return to current date
- Click any date to jump to it

## Filters

Filter the calendar by:
- Teacher
- Location
- Student
- Lesson type
    `,
    keywords: ['calendar', 'view', 'week', 'month', 'agenda', 'filter'],
  },
  {
    id: 'recurring-lessons',
    title: 'Setting Up Recurring Lessons',
    category: 'scheduling',
    summary: 'Create weekly lessons that repeat automatically.',
    content: `
# Setting Up Recurring Lessons

## Creating a Recurring Lesson

1. Create a new lesson in the calendar
2. Toggle "Repeat" to ON
3. Choose frequency: Weekly
4. Set end date (or "Until cancelled")
5. Save the lesson

## Managing Recurring Lessons

When editing a recurring lesson, you can:
- **Edit this instance only**: Changes apply to one lesson
- **Edit this and future**: Changes apply from this date onwards
- **Edit all**: Changes apply to the entire series

## Cancelling Recurring Lessons

Same options apply:
- Cancel single instance
- Cancel from this date
- Cancel entire series

## Recurrence Indicators

- Recurring lessons show a repeat icon
- The series ID links related lessons
- Click "View Series" to see all instances

## Handling Closures

Recurring lessons automatically skip closure dates (bank holidays, term breaks).
    `,
    keywords: ['recurring', 'repeat', 'weekly', 'series', 'cancel', 'edit'],
  },
  {
    id: 'conflict-detection',
    title: 'Conflict Detection',
    category: 'scheduling',
    summary: 'How LessonLoop prevents double-bookings.',
    content: `
# Conflict Detection

## What Gets Checked

LessonLoop detects conflicts for:
- **Teacher**: Same teacher, overlapping times
- **Room**: Same room, overlapping times
- **Student**: Same student, overlapping lessons
- **Closures**: Lessons on closure dates

## Conflict Warnings

When creating or editing a lesson:
- Conflicts show as warnings
- You can proceed if needed (e.g., group lessons)
- Closures block scheduling (configurable)

## Viewing Conflicts

The calendar highlights:
- Overlapping lessons in red
- Closure dates with strikethrough

## Resolving Conflicts

Options:
- Move the lesson to a different time
- Assign a different teacher or room
- Remove the closure date

## Settings

Configure conflict behaviour in Settings > Scheduling:
- Block or warn on closures
- Allow student overlap (for group lessons)
    `,
    keywords: ['conflict', 'overlap', 'double-book', 'warning', 'closure'],
  },

  // Invoicing
  {
    id: 'creating-invoices',
    title: 'Creating Invoices',
    category: 'invoicing',
    summary: 'Manually create invoices for students.',
    content: `
# Creating Invoices

## Manual Invoice

1. Go to Invoices page
2. Click "Create Invoice"
3. Select student or guardian
4. Add line items (lessons or custom)
5. Set due date
6. Save or send

## Invoice Fields

- **Invoice Number**: Auto-generated
- **Issue Date**: When created
- **Due Date**: Payment deadline
- **Line Items**: Lessons and amounts
- **Notes**: Optional message to parent

## Invoice Status

- **Draft**: Not yet sent
- **Sent**: Emailed to guardian
- **Paid**: Fully paid
- **Overdue**: Past due date, unpaid
- **Cancelled**: Voided invoice

## Sending Invoices

- Click "Send" to email the invoice
- Parents can view and pay via portal
- Stripe payments update status automatically

## VAT

If VAT-registered, invoices include:
- VAT amount
- VAT registration number
- Net and gross totals
    `,
    keywords: ['invoice', 'create', 'manual', 'send', 'VAT', 'status'],
  },
  {
    id: 'billing-runs',
    title: 'Running Billing Runs',
    category: 'invoicing',
    summary: 'Generate invoices in bulk for a date range.',
    content: `
# Running Billing Runs

## What is a Billing Run?

A billing run automatically creates invoices for all lessons in a date range.

## Starting a Billing Run

1. Go to Invoices page
2. Click "Billing Run"
3. Select date range (e.g., January 2024)
4. Choose billing type: Monthly or Termly
5. Review lessons to invoice
6. Confirm and generate

## What Gets Invoiced

- Completed lessons (marked attended)
- Lessons charged to rate cards
- One invoice per guardian

## Exclusions

These are NOT invoiced:
- Cancelled lessons
- Already invoiced lessons
- Students without guardians

## Review Before Sending

After generation:
- Review invoice list
- Make any adjustments
- Send all or selected invoices

## LoopAssist

Ask LoopAssist: "Generate invoices for last month" to start a billing run conversationally.
    `,
    keywords: ['billing', 'run', 'bulk', 'generate', 'monthly', 'termly'],
  },
  {
    id: 'recording-payments',
    title: 'Recording Payments',
    category: 'invoicing',
    summary: 'Mark invoices as paid manually or via Stripe.',
    content: `
# Recording Payments

## Automatic (Stripe)

When parents pay via Stripe in the portal:
- Payment recorded automatically
- Invoice status updates to "Paid"
- Receipt sent to parent

## Manual Recording

For bank transfers or cash:
1. Open the invoice
2. Click "Record Payment"
3. Enter amount and date
4. Select payment method
5. Save

## Partial Payments

You can record partial payments:
- Invoice shows remaining balance
- Status stays "Sent" until fully paid
- Multiple payment records allowed

## Payment Methods

- **Stripe**: Online card payment
- **Bank Transfer**: BACS/Faster Payments
- **Cash**: Physical cash
- **Cheque**: Paper cheque
- **Other**: Any other method

## Viewing Payment History

Invoice detail shows:
- All payment records
- Dates and amounts
- Remaining balance
    `,
    keywords: ['payment', 'record', 'Stripe', 'paid', 'manual', 'partial'],
  },

  // Parent Portal
  {
    id: 'parent-portal-overview',
    title: 'Parent Portal Overview',
    category: 'parent-portal',
    summary: 'What parents see and can do in their portal.',
    content: `
# Parent Portal Overview

## Accessing the Portal

Parents receive an email invite with a login link. They can:
- Set their password
- Access their personalised portal

## Portal Features

### Home Dashboard
- Upcoming lessons
- Outstanding invoices
- Practice summary

### Schedule
- View lesson calendar
- See lesson details
- Request changes

### Invoices
- View all invoices
- Pay online via Stripe
- Download PDF invoices

### Practice
- Log practice time
- View assignments
- Track progress

### Resources
- Access shared resources
- Download materials
- View teacher files

### Messages
- Contact the school
- View notifications
- Request schedule changes

## Mobile Friendly

The portal works on phones and tablets.
    `,
    keywords: ['portal', 'parent', 'guardian', 'access', 'home', 'dashboard'],
  },

  // LoopAssist
  {
    id: 'loopassist-intro',
    title: 'Introduction to LoopAssist',
    category: 'loopassist',
    summary: 'Meet your AI assistant for queries and actions.',
    content: `
# Introduction to LoopAssist

## What is LoopAssist?

LoopAssist is your AI-powered assistant that helps you:
- Answer questions about your data
- Propose and execute actions
- Draft messages and emails
- Save time on routine tasks

## Opening LoopAssist

Click the sparkle icon (✨) in the header to open the chat drawer.

## Asking Questions

LoopAssist can answer:
- "What invoices are overdue?"
- "Who has lessons tomorrow?"
- "How much is outstanding?"
- "Show me [student]'s lesson history"

## Requesting Actions

LoopAssist can propose actions:
- "Send reminders for overdue invoices"
- "Generate invoices for January"
- "Reschedule tomorrow's lessons by 30 mins"
- "Draft an email to [student]'s parent"

## Confirming Actions

When LoopAssist proposes an action:
1. Review the action card
2. Click "Confirm" to execute
3. Or click "Cancel" to decline

**No action is taken without your confirmation.**

## Context Awareness

LoopAssist knows which page you're on:
- On a student page? It focuses on that student
- On invoices? It focuses on billing
- On calendar? It focuses on scheduling
    `,
    keywords: ['loopassist', 'AI', 'assistant', 'help', 'questions', 'actions'],
  },
  {
    id: 'loopassist-prompts',
    title: 'Example LoopAssist Prompts',
    category: 'loopassist',
    summary: 'Ideas for what to ask LoopAssist.',
    content: `
# Example LoopAssist Prompts

## Questions

### Invoicing
- "What invoices are overdue?"
- "How much is outstanding this month?"
- "Who hasn't paid for January?"

### Scheduling
- "What lessons do I have today?"
- "Who has lessons this week?"
- "Any cancellations recently?"

### Students
- "How many active students do I have?"
- "Show me [student name]'s details"
- "Who is due for a lesson?"

## Actions

### Billing
- "Send reminders for all overdue invoices"
- "Generate invoices for last month"
- "Run a billing run for January"

### Communication
- "Draft a progress update for [student]"
- "Send a message to all parents"

### Scheduling
- "Reschedule tomorrow's lessons by 30 minutes"
- "Cancel [student]'s lesson on [date]"

## Tips

- Be specific: "invoices overdue by more than 30 days"
- Use student names: "What's [Name]'s balance?"
- Reference dates: "lessons next Monday"
    `,
    keywords: ['prompts', 'examples', 'questions', 'actions', 'ideas'],
  },

  // Settings
  {
    id: 'rate-cards',
    title: 'Setting Up Rate Cards',
    category: 'settings',
    summary: 'Configure pricing for different lesson types.',
    content: `
# Setting Up Rate Cards

## What are Rate Cards?

Rate cards define pricing for lessons:
- Amount per lesson
- Duration (30, 45, 60 mins)
- Currency (GBP default)

## Creating a Rate Card

1. Go to Settings > Rate Cards
2. Click "Add Rate Card"
3. Enter name (e.g., "30 Min Standard")
4. Set price (e.g., £25.00)
5. Set duration
6. Save

## Default Rate Card

Mark one rate card as default. New students use this rate.

## Assigning to Students

Each student can have a different rate card:
1. Go to student detail
2. Edit student
3. Select rate card
4. Save

## Pricing Examples

| Name | Duration | Price |
|------|----------|-------|
| 30 Min Standard | 30 mins | £25 |
| 45 Min Standard | 45 mins | £35 |
| 60 Min Standard | 60 mins | £45 |
| Group Lesson | 60 mins | £15 |

## Changing Rates

When you change a rate card:
- Existing invoices unchanged
- Future lessons use new rate
    `,
    keywords: ['rate', 'card', 'pricing', 'price', 'lesson', 'cost'],
  },
  {
    id: 'team-members',
    title: 'Managing Team Members',
    category: 'settings',
    summary: 'Invite and manage staff with different roles.',
    content: `
# Managing Team Members

## Roles

- **Owner**: Full access, billing, can delete org
- **Admin**: Full access except billing
- **Teacher**: Own schedule, students, practice
- **Finance**: Invoices and payments only

## Inviting Members

1. Go to Settings > Team
2. Click "Invite Member"
3. Enter email
4. Select role
5. Send invite

## Accepting Invites

Team members receive an email to:
- Create an account (if new)
- Accept the invitation
- Access the organisation

## Managing Permissions

- Change roles anytime
- Remove members
- View activity log

## Teacher-Specific

Teachers see:
- Their own schedule
- Their assigned students
- Practice logs for their students

They cannot:
- See other teachers' schedules
- Access billing
- Manage team
    `,
    keywords: ['team', 'member', 'invite', 'role', 'teacher', 'admin'],
  },

  // Troubleshooting
  {
    id: 'invoice-not-sent',
    title: 'Invoice Not Sending',
    category: 'troubleshooting',
    summary: 'What to check when invoices fail to send.',
    content: `
# Invoice Not Sending

## Check Email Address

Ensure the guardian has a valid email:
1. Go to student detail
2. Check linked guardian
3. Verify email address

## Check Invoice Status

Only "Draft" invoices can be sent:
- Already "Sent"? It was already emailed
- "Paid" or "Cancelled"? Cannot resend

## Check Spam Folder

Ask the parent to check:
- Spam/Junk folder
- Promotions tab (Gmail)

## Resend Invoice

1. Open the invoice
2. Click "Resend" to try again

## Still Not Working?

- Check your email settings
- Contact support with invoice number
    `,
    keywords: ['invoice', 'send', 'email', 'fail', 'not working'],
  },
  {
    id: 'lesson-conflict',
    title: 'Resolving Lesson Conflicts',
    category: 'troubleshooting',
    summary: 'How to fix scheduling conflicts.',
    content: `
# Resolving Lesson Conflicts

## Identifying Conflicts

Conflicts appear as:
- Red warning when creating lesson
- Highlighted overlapping lessons
- Error message with details

## Types of Conflicts

### Teacher Overlap
Same teacher has two lessons at same time.

**Fix**: Change time or assign different teacher.

### Room Overlap
Same room booked twice.

**Fix**: Change time or assign different room.

### Student Overlap
Student in two lessons at once.

**Fix**: Change time (unless group lesson intended).

### Closure Date
Lesson scheduled on closure date.

**Fix**: Move to different date or remove closure.

## Allowing Conflicts

Some conflicts are intentional:
- Group lessons (same room, multiple students)
- Teaching pairs (two teachers together)

You can proceed despite warnings if needed.
    `,
    keywords: ['conflict', 'overlap', 'fix', 'resolve', 'error'],
  },
  
  // Additional Getting Started
  {
    id: 'dashboard-overview',
    title: 'Understanding Your Dashboard',
    category: 'getting-started',
    summary: 'A tour of your main dashboard and its features.',
    content: `
# Understanding Your Dashboard

## Dashboard Layout

Your dashboard is your command centre, showing everything at a glance.

### Statistics Cards

At the top, you'll see key metrics:
- **Today's Lessons**: How many lessons are scheduled today
- **Outstanding**: Total unpaid invoices amount
- **Active Students**: Number of active students

### Quick Actions

One-click buttons for common tasks:
- Create a new lesson
- Add a student
- Generate invoices
- Send messages

### Today's Timeline

A visual timeline of your lessons today:
- Upcoming lessons highlighted
- Click any lesson to view details
- Mark attendance directly

### Onboarding Checklist

For new users, a checklist guides you through setup:
- Add your first student ✓
- Create a lesson ✓
- Set up rate cards ✓
- Generate an invoice ✓

## Tips

- Check your dashboard first thing each day
- Use quick actions to save time
- The timeline shows the next 24 hours
    `,
    keywords: ['dashboard', 'overview', 'home', 'stats', 'timeline', 'quick actions'],
  },
  
  // Additional Scheduling
  {
    id: 'attendance-marking',
    title: 'Marking Lesson Attendance',
    category: 'scheduling',
    summary: 'How to mark students as attended, absent, or cancelled.',
    content: `
# Marking Lesson Attendance

## Why Mark Attendance?

Attendance tracking:
- Ensures accurate billing
- Tracks student progress
- Identifies patterns
- Generates reports

## Marking Individual Lessons

1. Click on a lesson in the calendar
2. Open the lesson detail panel
3. For each student, select:
   - **Attended**: Student was present
   - **Absent**: Student missed the lesson
   - **Late Cancel**: Cancelled within notice period
   - **Cancelled**: Cancelled in advance

## Bulk Marking (End of Day)

Use "Mark Day Complete" on the calendar:
1. Click the button in the toolbar
2. All past "Scheduled" lessons become "Completed"
3. Students default to "Attended"

## Attendance and Billing

- **Attended**: Billed normally
- **Absent**: Billed (unless make-up credit issued)
- **Late Cancel**: Billed (policy-dependent)
- **Cancelled**: Not billed

## Make-Up Credits

When a student misses a lesson with valid notice:
1. Mark as "Cancelled"
2. Issue a make-up credit
3. Credit applies to future lessons

## Reports

View attendance trends in Reports > Cancellations.
    `,
    keywords: ['attendance', 'mark', 'complete', 'absent', 'cancel', 'present'],
  },
  {
    id: 'closure-dates',
    title: 'Managing Closure Dates',
    category: 'scheduling',
    summary: 'Set up bank holidays, term breaks, and closures.',
    content: `
# Managing Closure Dates

## What Are Closure Dates?

Dates when your teaching business is closed:
- Bank holidays
- School half-terms
- Christmas break
- Personal holidays

## Adding Closure Dates

1. Go to Settings > Scheduling
2. Click "Add Closure Date"
3. Enter date and reason
4. Choose scope:
   - All locations
   - Specific location only

## How Closures Affect Scheduling

When a closure is set:
- Recurring lessons skip that date
- Warnings show if scheduling on closure
- Calendar shows closure indicator

## UK Bank Holidays

LessonLoop includes UK bank holidays by default:
- New Year's Day
- Good Friday
- Easter Monday
- May bank holidays
- Christmas Day
- Boxing Day

## Term Calendars

For academies, set up term dates:
- Autumn term: Sep - Dec
- Spring term: Jan - Apr
- Summer term: Apr - Jul

Lessons outside terms can be blocked or warned.
    `,
    keywords: ['closure', 'holiday', 'bank', 'term', 'break', 'closed'],
  },
  
  // Additional Invoicing
  {
    id: 'invoice-statuses',
    title: 'Understanding Invoice Statuses',
    category: 'invoicing',
    summary: 'What each invoice status means and how to manage them.',
    content: `
# Understanding Invoice Statuses

## Status Types

### Draft
- Invoice created but not sent
- Can be edited freely
- Not visible to parents

### Sent
- Invoice emailed to parent
- Visible in parent portal
- Awaiting payment

### Paid
- Full payment received
- No further action needed
- Archived automatically

### Overdue
- Past due date
- No payment received
- Triggers reminders

### Void
- Invoice cancelled
- Not counted in reports
- Cannot be undone

## Status Flow

\`\`\`
Draft → Sent → Paid
         ↓
       Overdue → Paid
         ↓
        Void
\`\`\`

## Automatic Status Changes

- **Sent → Overdue**: Automatic when due date passes
- **Sent → Paid**: Automatic when Stripe payment received
- **Draft → Sent**: When you click "Send"

## Manual Status Changes

- Mark as Paid: Record manual payment
- Void: Cancel the invoice
- Resend: Re-email to parent
    `,
    keywords: ['status', 'draft', 'sent', 'paid', 'overdue', 'void'],
  },
  
  // Additional Parent Portal
  {
    id: 'parent-payments',
    title: 'How Parents Pay Invoices',
    category: 'parent-portal',
    summary: 'The payment process from the parent perspective.',
    content: `
# How Parents Pay Invoices

## Receiving an Invoice

Parents are notified when you send an invoice:
1. Email with invoice summary
2. "View & Pay" button in email
3. Link to parent portal

## Viewing in Portal

In the portal, parents see:
- Invoice number and date
- Line items (lessons, amounts)
- Total due
- Due date
- Payment status

## Paying with Stripe

1. Click "Pay Now" on invoice
2. Redirected to secure Stripe checkout
3. Enter card details
4. Confirm payment
5. Receipt sent automatically

## Payment Confirmation

After successful payment:
- Invoice status updates to "Paid"
- Parent sees confirmation screen
- Email receipt sent
- You're notified

## Other Payment Methods

If parents pay by bank transfer:
1. They pay to your bank account
2. You manually record the payment
3. Status updates to "Paid"

## Failed Payments

If a card payment fails:
- Parent can retry
- Invoice stays unpaid
- You can send a reminder
    `,
    keywords: ['payment', 'pay', 'Stripe', 'card', 'portal', 'parent'],
  },
  {
    id: 'parent-practice',
    title: 'Using the Practice Tracker',
    category: 'parent-portal',
    summary: 'How parents and students log practice time.',
    content: `
# Using the Practice Tracker

## What is Practice Tracking?

A way for students to:
- Log daily practice time
- See assignments from teachers
- Track progress and streaks
- Build good habits

## Logging Practice

In the parent portal:
1. Go to Practice section
2. Click "Log Practice"
3. Enter duration (minutes)
4. Add optional notes
5. Save

## Practice Streaks

Consecutive practice days build streaks:
- 🔥 Current streak shown
- Longest streak recorded
- Streak badges earned
- Motivation to continue

## Teacher Assignments

Teachers can set:
- Specific pieces to practice
- Target minutes per day
- Days per week goal
- Due dates

## Viewing Progress

Parents can see:
- Weekly practice totals
- Daily breakdown
- Historical trends
- Teacher feedback

## Tips for Success

- Practice at the same time daily
- Start with small goals (10 mins)
- Use the timer feature
- Celebrate streaks!
    `,
    keywords: ['practice', 'log', 'timer', 'streak', 'assignment', 'progress'],
  },
  
  // Additional LoopAssist
  {
    id: 'loopassist-actions',
    title: 'LoopAssist Action Confirmations',
    category: 'loopassist',
    summary: 'How to review and confirm AI-proposed actions.',
    content: `
# LoopAssist Action Confirmations

## Why Confirm Actions?

LoopAssist proposes actions but never executes without your approval. This ensures:
- You stay in control
- No accidental changes
- Opportunity to review
- Audit trail maintained

## Action Cards

When LoopAssist proposes an action, you'll see a card showing:
- **Action Type**: What will happen
- **Affected Items**: Which records/students/invoices
- **Summary**: What the result will be

## Reviewing Actions

Before confirming:
- Read the summary carefully
- Check the affected items
- Consider any warnings
- Ask follow-up questions if unsure

## Confirming an Action

Click "Confirm" to:
1. Execute the action immediately
2. See the result in chat
3. Get a success/error message
4. Action is logged for audit

## Cancelling an Action

Click "Cancel" to:
- Decline the proposal
- No changes are made
- Continue the conversation
- Ask for something different

## Action Examples

| Request | Action Proposed |
|---------|-----------------|
| "Send overdue reminders" | Email X invoices |
| "Generate January invoices" | Create X invoices for lessons |
| "Reschedule tomorrow +30min" | Move X lessons forward |
| "Cancel Friday's lessons" | Cancel X lessons |

## Safety Limits

Some actions have built-in limits:
- Maximum invoices per run
- Required fields validation
- Conflict detection
- Rate limiting
    `,
    keywords: ['action', 'confirm', 'cancel', 'propose', 'execute', 'safe'],
  },
  
  // Additional Troubleshooting
  {
    id: 'payment-not-showing',
    title: 'Payment Made But Invoice Still Unpaid',
    category: 'troubleshooting',
    summary: 'What to do when a payment doesn\'t update the invoice.',
    content: `
# Payment Made But Invoice Still Unpaid

## Stripe Payments

If a parent paid via Stripe but the invoice shows unpaid:

### Check Stripe Dashboard
1. The payment may be pending
2. 3D Secure might need completion
3. Check for declined cards

### Wait a Few Minutes
- Webhooks can have slight delays
- Refresh the page after 2-3 minutes
- Check your email for notifications

### Still Not Updated?
Contact support with:
- Invoice number
- Approximate payment time
- Parent's email

## Bank Transfer Payments

Bank transfers don't auto-update. You must:
1. Receive the payment notification from your bank
2. Go to the invoice in LessonLoop
3. Click "Record Payment"
4. Enter amount and date
5. Save

## Partial Payments

If the parent paid less than the total:
- Invoice stays "Sent" (not "Paid")
- Record the partial payment
- Remaining balance is shown
- Follow up for the rest

## Overpayments

If the parent paid more than the total:
- Apply the overpayment to a different invoice, OR
- Record as credit for future lessons, OR
- Refund the difference via your bank
    `,
    keywords: ['payment', 'not showing', 'unpaid', 'Stripe', 'bank', 'missing'],
  },
  {
    id: 'cant-login',
    title: 'Cannot Log In to LessonLoop',
    category: 'troubleshooting',
    summary: 'Solutions for login problems.',
    content: `
# Cannot Log In to LessonLoop

## Forgot Password

1. Click "Forgot password" on login
2. Enter your email
3. Check inbox (and spam)
4. Click reset link
5. Set new password

## Email Not Recognised

- Check spelling carefully
- Try alternative email addresses
- Contact the person who invited you
- Check if account was created

## Password Not Working

- Use "Forgot password" to reset
- Check Caps Lock is off
- Try a different browser
- Clear browser cache

## Account Locked

After too many failed attempts:
- Wait 15 minutes
- Try again
- Use password reset if needed

## Browser Issues

Try these steps:
1. Clear cookies for lessonloop.app
2. Use a private/incognito window
3. Try a different browser
4. Disable browser extensions

## Parent Portal Login

Parents log in at a different URL:
- Use the link from your invite email
- Check you're on the portal (not admin)
- Contact your teacher if stuck

## Still Can't Access?

Contact support with:
- Your email address
- When you last logged in
- Any error messages shown
    `,
    keywords: ['login', 'password', 'forgot', 'access', 'locked', 'browser'],
  },
  {
    id: 'term-adjustments-credit-notes',
    title: 'Term Adjustments & Credit Notes',
    category: 'invoicing',
    summary: 'Handle mid-term withdrawals and day/time changes with automatic pro-rata credit notes.',
    content: `
# Term Adjustments & Credit Notes

Term Adjustments handle two common mid-term scenarios with a guided 3-step wizard.

## Mid-Term Withdrawal

When a student leaves partway through a term, the wizard:
1. Counts remaining lessons in their series
2. Calculates the pro-rata amount at their lesson rate
3. Cancels remaining lessons automatically
4. Generates a credit note for the refund amount

## Day/Time Change

When a student moves to a different lesson day or time, the wizard:
1. Cancels remaining lessons on the old schedule
2. Creates new lessons on the new day/time (respecting closure dates)
3. Compares lesson counts and calculates any financial difference
4. Generates a credit note or supplementary invoice as needed

You can also change the teacher and/or location during a day change.

## How to Access

There are two entry points:

**From a student's profile:**
1. Go to the student's detail page
2. Click the **Lessons** tab
3. Click the **Term Adjustment** button in the header

**From the calendar:**
1. Click on a recurring lesson
2. In the lesson detail panel, click **Adjust Term**

## The 3-Step Process

### Step 1: Configure
- Select the student (pre-filled if accessed from student page)
- Choose the adjustment type: **Withdrawal** or **Day/Time Change**
- Select which lesson series to adjust
- Set the effective date
- For day changes: choose the new day, time, teacher, and/or location

### Step 2: Preview
- Review the lesson changes (current vs new)
- See the financial breakdown including VAT
- Choose whether to generate a credit note or supplementary invoice
- Review the linked original invoice

### Step 3: Confirm
- Lessons are cancelled and/or created
- Credit note or supplementary invoice is generated
- You can view the credit note directly from the confirmation screen

## Credit Notes in the Invoice List

Credit notes appear in your invoice list with a blue **Credit Note** badge. The amount is shown in green to distinguish it from regular invoices. Click a credit note to view its details and link back to the original invoice.
    `,
    keywords: ['term adjustment', 'withdrawal', 'credit note', 'day change', 'pro-rata', 'refund', 'mid-term', 'supplementary invoice'],
  },
];

// Search helper
export function searchArticles(query: string): HelpArticle[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return helpArticles;
  
  return helpArticles.filter(article => 
    article.title.toLowerCase().includes(lowerQuery) ||
    article.summary.toLowerCase().includes(lowerQuery) ||
    article.keywords.some(k => k.toLowerCase().includes(lowerQuery)) ||
    article.content.toLowerCase().includes(lowerQuery)
  ).sort((a, b) => {
    // Prioritise title and keyword matches
    const aTitle = a.title.toLowerCase().includes(lowerQuery) ? 2 : 0;
    const bTitle = b.title.toLowerCase().includes(lowerQuery) ? 2 : 0;
    const aKeyword = a.keywords.some(k => k.toLowerCase().includes(lowerQuery)) ? 1 : 0;
    const bKeyword = b.keywords.some(k => k.toLowerCase().includes(lowerQuery)) ? 1 : 0;
    return (bTitle + bKeyword) - (aTitle + aKeyword);
  });
}

// Get articles by category
export function getArticlesByCategory(category: HelpCategory): HelpArticle[] {
  return helpArticles.filter(article => article.category === category);
}
