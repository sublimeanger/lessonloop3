# API Reference

> **Document Type**: API Documentation  
> **Last Updated**: 2026-01-20

---

## 1. Overview

LessonLoop uses two types of APIs:

1. **Supabase Database API**: Direct database access via PostgREST
2. **Edge Functions**: Custom serverless functions for complex operations

All APIs require JWT authentication (except public endpoints).

---

## 2. Authentication Endpoints

### 2.1 Sign Up

Creates a new user account.

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    data: {
      full_name: 'John Doe'
    }
  }
});
```

**Response**:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "user_metadata": { "full_name": "John Doe" }
  },
  "session": {
    "access_token": "jwt...",
    "refresh_token": "..."
  }
}
```

### 2.2 Sign In

Authenticates existing user.

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password'
});
```

### 2.3 Sign Out

Ends user session.

```typescript
const { error } = await supabase.auth.signOut();
```

### 2.4 Password Reset

Sends password reset email.

```typescript
const { error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com',
  { redirectTo: 'https://app.lessonloop.com/reset-password' }
);
```

---

## 3. Edge Functions

### 3.1 LoopAssist Chat

**Endpoint**: `POST /functions/v1/looopassist-chat`

Handles AI chat requests with context-aware responses.

**Headers**:
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Request Body**:
```json
{
  "message": "How many lessons are scheduled this week?",
  "conversationId": "uuid-optional",
  "pageContext": {
    "page": "/calendar",
    "studentCount": 25,
    "overdueInvoices": 3
  }
}
```

**Response** (streaming):
```
Based on your calendar, you have 42 lessons scheduled this week.

[Student:abc123] has 3 lessons, and [Student:def456] has 2 lessons...
```

**Response Features**:
- Streaming text response
- Entity references in `[Type:ID]` format
- Optional action proposals in response

---

### 3.2 LoopAssist Execute

**Endpoint**: `POST /functions/v1/looopassist-execute`

Executes confirmed AI action proposals.

**Headers**:
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Request Body**:
```json
{
  "proposalId": "proposal-uuid",
  "action": "confirm"
}
```

**Supported Actions**:
| Action Type | Description | Parameters |
|-------------|-------------|------------|
| `confirm` | Execute the proposal | `proposalId` |
| `cancel` | Cancel the proposal | `proposalId` |

**Response**:
```json
{
  "success": true,
  "message": "Billing run created with 15 invoices",
  "result": {
    "invoicesCreated": 15,
    "totalAmount": 225000
  }
}
```

---

### 3.3 CSV Import Mapping

**Endpoint**: `POST /functions/v1/csv-import-mapping`

Uses AI to suggest CSV column mappings.

**Headers**:
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Request Body**:
```json
{
  "headers": ["Name", "Email Address", "Phone #", "DOB"],
  "sampleRows": [
    ["John Doe", "john@example.com", "07123456789", "15/03/2010"]
  ],
  "targetType": "students"
}
```

**Response**:
```json
{
  "mappings": {
    "Name": { "field": "full_name", "confidence": 0.95 },
    "Email Address": { "field": "email", "confidence": 0.98 },
    "Phone #": { "field": "phone", "confidence": 0.92 },
    "DOB": { "field": "dob", "confidence": 0.88 }
  },
  "warnings": ["DOB format detected: DD/MM/YYYY"]
}
```

---

### 3.4 CSV Import Execute

**Endpoint**: `POST /functions/v1/csv-import-execute`

Performs transactional data import.

**Headers**:
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Request Body**:
```json
{
  "targetType": "students",
  "mappings": {
    "Name": "full_name",
    "Email Address": "email"
  },
  "data": [
    { "Name": "John Doe", "Email Address": "john@example.com" }
  ],
  "options": {
    "skipDuplicates": true,
    "dryRun": false
  }
}
```

**Response**:
```json
{
  "success": true,
  "imported": 45,
  "skipped": 3,
  "errors": [
    { "row": 12, "error": "Invalid email format" }
  ]
}
```

---

### 3.5 GDPR Export

**Endpoint**: `POST /functions/v1/gdpr-export`

Exports all organization data for GDPR compliance.

**Headers**:
```
Authorization: Bearer <jwt>
```

**Request Body**: None required

**Response**:
```json
{
  "organisation": "Smith Music Academy",
  "exportedAt": "2026-01-20T10:30:00Z",
  "files": {
    "students": "id,first_name,last_name,email...\n1,John,Doe,john@...",
    "guardians": "id,full_name,email...\n1,Jane Doe,jane@...",
    "lessons": "...",
    "invoices": "...",
    "payments": "..."
  },
  "counts": {
    "students": 45,
    "guardians": 38,
    "lessons": 520,
    "invoices": 156,
    "payments": 142
  }
}
```

---

### 3.6 GDPR Delete

**Endpoint**: `POST /functions/v1/gdpr-delete`

Soft-deletes or anonymizes records.

**Headers**:
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Request Body**:
```json
{
  "action": "anonymise",
  "entityType": "student",
  "entityId": "student-uuid"
}
```

**Actions**:
| Action | Effect |
|--------|--------|
| `soft_delete` | Sets `deleted_at`, marks inactive |
| `anonymise` | Replaces PII with placeholders |

**Response**:
```json
{
  "success": true,
  "message": "Student record anonymised successfully"
}
```

---

### 3.7 Send Message

**Endpoint**: `POST /functions/v1/send-message`

Sends email messages via Resend.

**Headers**:
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Request Body**:
```json
{
  "recipientType": "guardian",
  "recipientId": "guardian-uuid",
  "subject": "Lesson Reminder",
  "body": "This is a reminder for tomorrow's lesson...",
  "messageType": "reminder"
}
```

**Response**:
```json
{
  "success": true,
  "messageId": "msg-uuid",
  "sentAt": "2026-01-20T10:30:00Z"
}
```

---

### 3.8 Send Invoice Email

**Endpoint**: `POST /functions/v1/send-invoice-email`

Sends invoice notification emails.

**Headers**:
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Request Body**:
```json
{
  "invoiceId": "invoice-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "sentTo": "parent@example.com",
  "invoiceNumber": "LL-2026-00042"
}
```

---

### 3.9 Send Invite Email

**Endpoint**: `POST /functions/v1/send-invite-email`

Sends organization invitation emails.

**Headers**:
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Request Body**:
```json
{
  "inviteId": "invite-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "sentTo": "newteacher@example.com",
  "expiresAt": "2026-01-27T10:30:00Z"
}
```

---

## 4. Database API (PostgREST)

### 4.1 Query Examples

#### List Students
```typescript
const { data, error } = await supabase
  .from('students')
  .select('id, first_name, last_name, email, status')
  .eq('status', 'active')
  .order('last_name');
```

#### Get Lessons with Participants
```typescript
const { data, error } = await supabase
  .from('lessons')
  .select(`
    *,
    lesson_participants(
      student:students(id, first_name, last_name)
    ),
    location:locations(name),
    room:rooms(name)
  `)
  .gte('start_at', '2026-01-20')
  .lte('start_at', '2026-01-27')
  .order('start_at');
```

#### Get Invoices with Items and Payments
```typescript
const { data, error } = await supabase
  .from('invoices')
  .select(`
    *,
    invoice_items(*),
    payments(*),
    payer_guardian:guardians(full_name, email)
  `)
  .eq('status', 'sent')
  .order('due_date');
```

### 4.2 Insert Examples

#### Create Student
```typescript
const { data, error } = await supabase
  .from('students')
  .insert({
    org_id: currentOrg.id,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com'
  })
  .select()
  .single();
```

#### Create Invoice with Items
```typescript
// Create invoice
const { data: invoice } = await supabase
  .from('invoices')
  .insert({
    org_id: currentOrg.id,
    payer_guardian_id: guardianId,
    due_date: '2026-02-01'
  })
  .select()
  .single();

// Add items
const { data: items } = await supabase
  .from('invoice_items')
  .insert([
    {
      org_id: currentOrg.id,
      invoice_id: invoice.id,
      description: 'Piano Lesson - January',
      quantity: 4,
      unit_price_minor: 3500,
      amount_minor: 14000
    }
  ]);
```

### 4.3 Update Examples

#### Update Lesson Status
```typescript
const { error } = await supabase
  .from('lessons')
  .update({ status: 'completed' })
  .eq('id', lessonId);
```

#### Record Payment
```typescript
const { error } = await supabase
  .from('payments')
  .insert({
    org_id: currentOrg.id,
    invoice_id: invoiceId,
    amount_minor: 14000,
    method: 'bank_transfer'
  });

// Update invoice status
await supabase
  .from('invoices')
  .update({ status: 'paid' })
  .eq('id', invoiceId);
```

### 4.4 Delete Examples

#### Soft Delete Student
```typescript
const { error } = await supabase
  .from('students')
  .update({ 
    deleted_at: new Date().toISOString(),
    status: 'inactive'
  })
  .eq('id', studentId);
```

---

## 5. Realtime Subscriptions

### 5.1 Subscribe to Lessons

```typescript
const channel = supabase
  .channel('lessons-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'lessons',
      filter: `org_id=eq.${currentOrg.id}`
    },
    (payload) => {
      console.log('Lesson changed:', payload);
    }
  )
  .subscribe();
```

### 5.2 Subscribe to Messages

```typescript
const channel = supabase
  .channel('message-requests')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'message_requests'
    },
    (payload) => {
      showNotification('New message request');
    }
  )
  .subscribe();
```

---

## 6. Error Codes

### 6.1 HTTP Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 200 | Success | Request completed |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Missing/invalid JWT |
| 403 | Forbidden | RLS policy denied |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate record |
| 422 | Unprocessable | Validation failed |
| 500 | Server Error | Internal error |

### 6.2 Supabase Error Codes

| Code | Description |
|------|-------------|
| `PGRST116` | No rows returned |
| `23505` | Unique constraint violation |
| `23503` | Foreign key violation |
| `42501` | RLS policy violation |
| `22P02` | Invalid UUID format |

### 6.3 Edge Function Errors

```json
{
  "error": true,
  "code": "UNAUTHORIZED",
  "message": "User not authorized for this action"
}
```

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid input |
| `INTERNAL_ERROR` | Server error |

---

## 7. Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Auth (signup/login) | 30 | 1 minute |
| Database queries | 1000 rows | Per query |
| Edge functions | 100 | 1 minute |
| Email sending | 100 | 1 hour |

---

## 8. Webhooks

Currently no outgoing webhooks are configured. Future considerations:

| Event | Webhook |
|-------|---------|
| Payment received | Payment processor callback |
| Lesson reminder | Scheduled trigger |
| Invoice overdue | Scheduled trigger |

---

→ Next: [AUDIT_LOGGING.md](./AUDIT_LOGGING.md)
