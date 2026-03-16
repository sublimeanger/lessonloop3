

## Diagnosis

### Bug 1: Styling broken on iOS Capacitor

**Root cause: `pb-safe` is not a real Tailwind utility and is not defined anywhere in the project.**

The class `pb-safe` is used in 4 components (LoopAssistDrawer, ParentLoopAssist, LessonModal, RequestModal) but:
- It's not in `tailwind.config.ts` 
- It's not defined in `src/index.css`
- It's not from any Tailwind plugin

On web browsers this silently does nothing (no safe area inset needed). On iOS Capacitor, the missing bottom padding means content gets clipped behind the home indicator / safe area, making the UI look broken.

Additionally, the Google Fonts import in `index.css` line 1 loads via external URL. The CSP in `index.html` allows `https://fonts.googleapis.com` for styles and `https://fonts.gstatic.com` for fonts, so this should work. The real styling issue is likely the safe-area padding gap causing layout collapse in the sheet.

**Fix:** Add a `pb-safe` utility class in `src/index.css` that maps to `padding-bottom: env(safe-area-inset-bottom, 0px)`. Also add `pt-safe` for symmetry.

### Bug 2: X button doesn't work on iOS

**Root cause: The X button uses `SheetClose asChild` wrapping a `Button`.**

`SheetClose` is `@radix-ui/react-dialog`'s `Close` primitive. On iOS WKWebView (Capacitor), Radix's close primitive sometimes fails to fire because:
1. The composed click event from `asChild` can be swallowed by the iOS touch-to-click delay
2. The `SheetClose` relies on Radix's internal dialog close mechanism, which uses `pointer-events` and event delegation that can conflict with iOS WebView's gesture handling

**Fix:** Replace `SheetClose asChild` with a plain `Button` that calls `onOpenChange(false)` directly. This bypasses Radix's internal event handling entirely. Apply this to both `LoopAssistDrawer` and `ParentLoopAssist`.

### Bug 3: Check all other sheets/drawers

`SheetClose` is used in exactly 2 places: `LoopAssistDrawer` and `ParentLoopAssist`. The default close button in `sheet.tsx` (line 63) also uses `SheetPrimitive.Close` directly — but that one has `hideCloseButton={true}` in LoopAssist's usage. Other sheets across the app that don't use `hideCloseButton` may also be affected. The safest fix is to also update the default `SheetPrimitive.Close` in `sheet.tsx` to use an `onClick` callback pattern.

## Plan

### 1. Add `pb-safe` / `pt-safe` utility classes in `src/index.css`
Add to the `@layer utilities` section:
```css
.pb-safe { padding-bottom: env(safe-area-inset-bottom, 0px); }
.pt-safe { padding-top: env(safe-area-inset-top, 0px); }
```

### 2. Fix LoopAssistDrawer X button (lines 235-240)
Replace `SheetClose asChild` with a direct `Button onClick={() => onOpenChange(false)}`.

### 3. Fix ParentLoopAssist X button (same pattern)
Same replacement — direct `onOpenChange(false)` call instead of `SheetClose asChild`.

### 4. Fix default close button in `sheet.tsx`
Update `SheetContent` to accept an optional `onClose` callback prop. When provided, the built-in X button uses `onClick={onClose}` instead of relying on `SheetPrimitive.Close`. This makes all sheets resilient on iOS Capacitor.

