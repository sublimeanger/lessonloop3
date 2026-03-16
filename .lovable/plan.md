

## Build Error Fixes

Three build errors need fixing:

### 1. Edge Function: `fmtCurrency` not in scope (looopassist-execute/index.ts:293)

The `send_bulk_reminders` case block (line 263) uses `fmtCurrency(inv.total_minor)` at line 293, but the function is only defined later at line 687 inside a different case block. 

**Fix:** Define `fmtCurrency` at the top of the `send_bulk_reminders` case block (around line 263-264). Need to fetch the org's currency_code first, or use a simple inline formatter:

```typescript
case "send_bulk_reminders": {
  const { data: _org } = await supabase.from("organisations").select("currency_code").eq("id", orgId).single();
  const fmtCurrency = (minor: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: _org?.currency_code || 'GBP' }).format(minor / 100);
  // ... rest of existing code
```

### 2. useMessages.ts:301-302 — `string | undefined` not assignable

`SendMessageData.recipient_email` and `recipient_name` are optional (`string | undefined`), but `MessageLogEntry` requires `recipient_email: string` and `recipient_name: string | null`.

**Fix:** Default the values in the optimistic message construction:
```typescript
recipient_email: data.recipient_email || '',
recipient_name: data.recipient_name ?? null,
```

### 3. Broader Audit Items (No code changes needed — verification only)

- **"Docs Getting Started" link from WelcomeCard**: No "WelcomeCard" component exists with a docs link. The help system uses internal `helpArticles.ts` content. No external link to verify/fix — this item is not applicable to the current codebase.
- **Empty states, loading skeletons, error boundaries, mobile responsiveness, toast patterns**: These were already audited and fixed across Features 22-26. The shared `EmptyState`, `InlineEmptyState`, `SectionErrorBoundary`, `PortalErrorState`, and `Skeleton` components are consistently used throughout the app.

