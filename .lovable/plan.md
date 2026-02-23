

# Messages Page -- World-Class Design Upgrade

## Problems Identified

From the screenshot:
- Thread cards are flat with no visual hierarchy -- subjects, recipients, and dates all blend together
- Expanded messages use a uniform `bg-muted/30` background with no sender differentiation
- Date separators are barely visible thin lines
- No avatars or initials to quickly identify senders vs recipients
- Reply section is utilitarian with no visual polish
- Status badges ("Sent") are small and easy to miss
- The overall feel is data-dense without enough breathing room or visual anchoring

## Design Approach

Upgrade the three key components (`ThreadCard`, `ThreadMessageItem`, `ThreadedMessageList`) plus the parent Messages page tab bar and filters on the main Messages page, following existing brand patterns (rounded-2xl, shadow-card, hover:shadow-elevated, active:scale effects).

---

## Changes

### 1. `ThreadCard.tsx` -- Premium thread card design

**Collapsed state:**
- Add a coloured left accent bar (4px primary border-left) on threads with recent activity
- Add an avatar circle with recipient initials (consistent with sidebar pattern)
- Make subject bolder (font-semibold) with slightly larger text
- Message count badge gets pill style (rounded-full) with better contrast
- Timestamp uses relative format ("2h ago", "Yesterday") for quick scanning
- Card gets `rounded-2xl shadow-card hover:shadow-elevated active:scale-[0.995]` treatment
- Unread indicator: subtle primary ring + dot indicator next to subject

**Expanded state:**
- Messages area gets a subtle inset background (`bg-muted/20 rounded-xl` container)
- Reply section gets a cleaner layout with better spacing
- Add keyboard shortcut hint styled as a subtle kbd element

### 2. `ThreadMessageItem.tsx` -- Chat-style message bubbles

Replace the flat layout with differentiated message styling:
- **Outgoing messages (sent by current user/staff):** Right-aligned with `bg-primary/10` background, rounded-2xl with `rounded-br-sm` tail
- **Incoming messages (from recipient):** Left-aligned with `bg-muted/50` background, rounded-2xl with `rounded-bl-sm` tail
- Add sender initials avatar circle (32px) on the left/right side
- Sender name + arrow + recipient becomes a compact header line
- Timestamp moves to a subtle bottom-right position within the bubble
- Status badge integrates inline with a small icon (check mark for sent, X for failed)
- Remove the redundant "Sent" badge text, use a subtle checkmark icon instead

### 3. `ThreadedMessageList.tsx` -- List polish

- Loading skeleton: Use rounded-2xl card-shaped skeletons instead of plain rectangles
- Empty state: Larger illustration area, warmer copy, and a CTA button to compose
- Thread spacing: Increase gap from `space-y-3` to `space-y-4`
- "Load more" button: Match premium button style

### 4. `Messages.tsx` (admin page) -- Filter bar and tab polish

- Tabs: Style with pill design (rounded-full) matching parent portal
- Search input: Add subtle shadow and rounded-xl corners
- View toggle (Threads/List): Better visual distinction for active state
- Overall spacing improvements

### 5. Date separators (inside ThreadCard)

- Replace thin lines with a styled pill-shaped date chip centred in the timeline
- Date chip: `bg-muted rounded-full px-3 py-1 text-xs font-medium` with no horizontal lines

---

## Technical Details

### Files to modify:
1. **`src/components/messages/ThreadCard.tsx`** -- Card container, collapsed header, expanded content, reply section
2. **`src/components/messages/ThreadMessageItem.tsx`** -- Message bubble layout with sender differentiation
3. **`src/components/messages/ThreadedMessageList.tsx`** -- Loading/empty states, spacing
4. **`src/pages/Messages.tsx`** -- Tab and filter bar styling
5. **`src/hooks/useMessageThreads.ts`** -- Add `sender_id` to `ThreadMessage` interface if not already present (needed to differentiate outgoing vs incoming)

### New utility needed:
- `getInitials(name: string)` helper -- already exists in AppSidebar, will extract or inline

### Mobile considerations (390px):
- Thread cards: Full-width with tighter padding (p-3 vs p-4)
- Message bubbles: Max-width 85% on mobile for readability
- Reply section: Full-width textarea, send button stacks below on small screens
- Avatar circles: 28px on mobile vs 32px on desktop
- Timestamps: Abbreviate further on mobile ("2h" vs "2 hours ago")

### No functionality changes:
- All hooks, mutations, and data flow remain identical
- Only visual/layout changes to existing components

