

# AI Chat Widget + Contact Form Updates

## Overview

Add a floating AI chat widget to all marketing pages where visitors can ask questions about LessonLoop and get instant answers. Also update the contact form to remove telephone numbers and forward submissions to jamie@searchflare.co.uk with "LessonLoop enquiry" as the subject.

## What Changes

### 1. New AI Chat Edge Function (`supabase/functions/marketing-chat/index.ts`)
- Backend function that calls Lovable AI (Gemini 3 Flash) with a comprehensive system prompt
- System prompt contains all LessonLoop knowledge: pricing (Teacher £12/mo, Studio £29/mo, Agency £79/mo), features, FAQs, trial info, security/GDPR details
- No authentication required (public endpoint for marketing visitors)
- Streams responses back via SSE for real-time typing effect

### 2. New Floating Chat Component (`src/components/marketing/MarketingChatWidget.tsx`)
- Floating button (bottom-right corner) with a chat bubble icon
- Opens a chat panel with message history, input field, and streaming AI responses
- Markdown rendering for AI responses
- Branded with LessonLoop styling (teal accent, clean design)
- Mobile-responsive (full-width on small screens, fixed-width panel on desktop)
- Persists within session (messages kept in React state)
- Suggested starter questions ("What plans do you offer?", "Is there a free trial?", "How does scheduling work?")

### 3. Update MarketingLayout (`src/components/layout/MarketingLayout.tsx`)
- Add the chat widget so it appears on every marketing page

### 4. Update Contact Page (`src/pages/marketing/Contact.tsx`)
- Remove the "Call Us" card with the phone number from the contact methods array
- Keep only Email and Live Chat contact methods (2-column grid)

### 5. Update Contact Edge Function (`supabase/functions/send-contact-message/index.ts`)
- Change `RECIPIENT_EMAIL` from `hello@lessonloop.net` to `jamie@searchflare.co.uk`
- Change subject line format to `LessonLoop enquiry` (fixed subject, with original subject/name in the body)

## Technical Details

### AI System Prompt Knowledge Base
The system prompt will be embedded in the edge function and will cover:
- All three pricing plans with exact prices, limits, and features (sourced from `pricing-config.ts`)
- Trial details (30 days, no credit card)
- FAQs from the pricing page
- Core features: scheduling, invoicing, parent portal, LoopAssist AI, practice tracking, resources
- UK-centric defaults (GBP, DD/MM/YYYY, VAT optional, term calendar)
- Security and GDPR compliance
- Supported user types (solo teachers, academies, agencies)
- Guidance to direct complex queries to the contact form

### SSE Streaming on Frontend
- Uses the same proven SSE parsing pattern already used by `useLoopAssist.ts`
- Token-by-token rendering with buffer management
- Handles `[DONE]`, CRLF, partial JSON safely

### Edge Function Config
- Add `marketing-chat` to `supabase/config.toml` with `verify_jwt = false` (public endpoint)

