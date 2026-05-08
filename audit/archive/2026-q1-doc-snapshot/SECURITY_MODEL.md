# Security Model

> **Document Type**: Security Architecture Reference  
> **Last Updated**: 2026-01-20

---

## 1. Authentication

### 1.1 Authentication Flow

LessonLoop uses Supabase Auth for all authentication:

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Supabase Auth
    participant Database
    
    User->>Frontend: Enter credentials
    Frontend->>Supabase Auth: signInWithPassword()
    Supabase Auth->>Supabase Auth: Validate credentials
    Supabase Auth-->>Frontend: JWT + Refresh Token
    Frontend->>Frontend: Store in localStorage
    Frontend->>Database: API request + JWT
    Database->>Database: Extract user_id from JWT
    Database->>Database: Evaluate RLS policies
    Database-->>Frontend: Authorized data
```

### 1.2 Supported Auth Methods

| Method | Status | Notes |
|--------|--------|-------|
| Email/Password | ✅ Enabled | Primary method |
| Magic Link | ✅ Available | Not primary UI |
| OAuth (Google, etc.) | ❌ Not configured | Can be enabled |
| Anonymous | ❌ Disabled | Not allowed |

### 1.3 Session Management

- **Access Token Lifetime**: 1 hour (configurable)
- **Refresh Token**: 7 days
- **Storage**: Browser localStorage via Supabase client
- **Auto-refresh**: Handled by `@supabase/supabase-js`

### 1.4 Password Policy

- Minimum 6 characters (Supabase default)
- No complexity requirements (can be enhanced)
- Leaked password protection: Currently disabled (⚠️ Warning)

### 1.5 Email Confirmation

```
Auto-confirm: ENABLED (for development/non-production)
```

⚠️ **Production Recommendation**: Disable auto-confirm and require email verification.

---

## 2. Authorization (RBAC)

### 2.1 Role Definitions

| Role | Scope | Description |
|------|-------|-------------|
| `owner` | Organization | Full control including deletion |
| `admin` | Organization | Full data access, cannot delete org |
| `teacher` | Organization | View schedule, manage own lessons |
| `finance` | Organization | View/manage invoices and payments |
| `parent` | Organization | Portal access to linked data only |

### 2.2 Permission Matrix

| Resource | owner | admin | teacher | finance | parent |
|----------|-------|-------|---------|---------|--------|
| **Organisation** |
| View org settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update org settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete organisation | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Members** |
| View members | ✅ | ✅ | ✅ | ✅ | ❌ |
| Invite members | ✅ | ✅ | ❌ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Students** |
| View all students | ✅ | ✅ | ✅ | ✅ | ❌ |
| View linked students | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create students | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update students | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete students | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Lessons** |
| View all lessons | ✅ | ✅ | ✅ | ✅ | ❌ |
| View linked lessons | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create lessons | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update own lessons | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update all lessons | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete lessons | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Invoices** |
| View all invoices | ✅ | ✅ | ✅ | ✅ | ❌ |
| View own invoices | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create invoices | ✅ | ✅ | ❌ | ✅ | ❌ |
| Update invoices | ✅ | ✅ | ❌ | ✅ | ❌ |
| Delete invoices | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Payments** |
| View payments | ✅ | ✅ | ✅ | ✅ | ✅* |
| Record payments | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Messages** |
| Send messages | ✅ | ✅ | ✅ | ❌ | ❌ |
| View message log | ✅ | ✅ | ✅* | ❌ | ✅* |
| Create requests | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Audit Log** |
| View audit log | ✅ | ✅ | ❌ | ❌ | ❌ |
| **GDPR** |
| Export data | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete/anonymize | ✅ | ✅ | ❌ | ❌ | ❌ |

\* Limited to own data only

### 2.3 Role Assignment

Roles are assigned via `org_memberships` table:

```sql
-- Example: Assign teacher role
INSERT INTO org_memberships (org_id, user_id, role, status)
VALUES ('org-uuid', 'user-uuid', 'teacher', 'active');
```

### 2.4 Role Checking Functions

```sql
-- Check if user is org member
is_org_member(auth.uid(), org_id) → boolean

-- Check if user is admin (owner or admin role)
is_org_admin(auth.uid(), org_id) → boolean

-- Check specific role
has_org_role(auth.uid(), org_id, 'teacher') → boolean

-- Get user's role in org
get_org_role(auth.uid(), org_id) → app_role
```

---

## 3. Row-Level Security (RLS)

### 3.1 RLS Overview

All 26 tables have RLS enabled. Policies enforce:

1. **Organization isolation**: Users can only see data from their organizations
2. **Role-based access**: Actions restricted by user role
3. **Parent scoping**: Parents see only linked student data

### 3.2 Policy Patterns

#### Pattern 1: Org Member Read Access
```sql
CREATE POLICY "Org members can view X"
ON public.table_name
FOR SELECT
USING (is_org_member(auth.uid(), org_id));
```

#### Pattern 2: Admin Write Access
```sql
CREATE POLICY "Admins can create X"
ON public.table_name
FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));
```

#### Pattern 3: Parent Limited Access
```sql
CREATE POLICY "Parents can view their children X"
ON public.table_name
FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent')
  AND is_parent_of_student(auth.uid(), student_id)
);
```

#### Pattern 4: Self-Owned Resources
```sql
CREATE POLICY "Users can manage their own X"
ON public.table_name
FOR ALL
USING (auth.uid() = user_id);
```

### 3.3 RLS Policies by Table

#### `organisations`
| Policy | Command | Condition |
|--------|---------|-----------|
| View own orgs | SELECT | `is_org_member(auth.uid(), id)` |
| Create orgs | INSERT | `auth.uid() = created_by` |
| Update orgs | UPDATE | `is_org_admin(auth.uid(), id)` |
| Delete orgs | DELETE | `has_org_role(auth.uid(), id, 'owner')` |

#### `students`
| Policy | Command | Condition |
|--------|---------|-----------|
| Org members view | SELECT | `deleted_at IS NULL AND is_org_member(...)` |
| Parents view linked | SELECT | `deleted_at IS NULL AND is_parent_of_student(...)` |
| Admins view deleted | SELECT | `deleted_at IS NOT NULL AND is_org_admin(...)` |
| Org members create | INSERT | `is_org_member(...)` |
| Org members update | UPDATE | `is_org_member(...)` |
| Admins delete | DELETE | `is_org_admin(...)` |

#### `lessons`
| Policy | Command | Condition |
|--------|---------|-----------|
| Org members view | SELECT | `is_org_member(...)` |
| Parents view children's | SELECT | `has_org_role(..., 'parent') AND EXISTS(participant check)` |
| Org members create | INSERT | `is_org_member(...)` |
| Teacher/admin update | UPDATE | `teacher_user_id = auth.uid() OR is_org_admin(...)` |
| Admins delete | DELETE | `is_org_admin(...)` |

#### `invoices`
| Policy | Command | Condition |
|--------|---------|-----------|
| Org members view | SELECT | `is_org_member(...)` |
| Parents view own | SELECT | `has_org_role(..., 'parent') AND is_invoice_payer(...)` |
| Admins create | INSERT | `is_org_admin(...)` |
| Admins update | UPDATE | `is_org_admin(...)` |
| Admins delete | DELETE | `is_org_admin(...)` |

#### `audit_log`
| Policy | Command | Condition |
|--------|---------|-----------|
| Admins view | SELECT | `is_org_admin(...)` |
| System insert | INSERT | `actor_user_id = auth.uid() OR actor_user_id IS NULL` |
| No update | UPDATE | ❌ Not allowed |
| No delete | DELETE | ❌ Not allowed |

### 3.4 Special Considerations

#### Soft-Delete Visibility
Students and guardians with `deleted_at IS NOT NULL` are only visible to admins:

```sql
-- Normal members see only active records
WHERE deleted_at IS NULL AND is_org_member(...)

-- Admins can see deleted records
WHERE deleted_at IS NOT NULL AND is_org_admin(...)
```

#### Parent Portal Isolation
Parents can only see:
- Students linked via `student_guardians`
- Lessons their students participate in
- Invoices where they are the payer
- Messages addressed to them

---

## 4. Multi-Tenancy Security

### 4.1 Data Isolation

Every data table includes `org_id` foreign key:

```sql
-- All queries are filtered by org
SELECT * FROM students WHERE org_id = 'current-org-uuid';
```

RLS automatically adds this filter:

```sql
-- User sees only their org's data
USING (is_org_member(auth.uid(), org_id))
```

### 4.2 Cross-Org Prevention

| Attack Vector | Mitigation |
|---------------|------------|
| Direct ID access | RLS rejects if user not in org |
| SQL injection | Parameterized queries via Supabase client |
| Enumeration | UUIDs prevent guessing |
| Session hijacking | JWT validation on every request |

### 4.3 Org Switching

Users can belong to multiple organizations:

```sql
-- Get all orgs for user
SELECT org_id FROM org_memberships 
WHERE user_id = auth.uid() AND status = 'active';
```

Current org is stored in `profiles.current_org_id`.

---

## 5. Edge Function Security

### 5.1 Authentication in Edge Functions

All edge functions validate JWT:

```typescript
// Extract user from Authorization header
const authHeader = req.headers.get('Authorization');
const token = authHeader?.replace('Bearer ', '');

const { data: { user }, error } = await supabase.auth.getUser(token);
if (error || !user) {
  return new Response('Unauthorized', { status: 401 });
}
```

### 5.2 Service Role Usage

Edge functions use service role for privileged operations:

```typescript
const adminClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

⚠️ **Security Note**: Service role bypasses RLS. Functions must manually validate access.

### 5.3 Edge Function Access Matrix

| Function | Auth Required | Role Required | Purpose |
|----------|---------------|---------------|---------|
| `looopassist-chat` | ✅ | Any org member | AI Q&A |
| `looopassist-execute` | ✅ | owner, admin | Execute AI actions |
| `csv-import-mapping` | ✅ | owner, admin | Map CSV headers |
| `csv-import-execute` | ✅ | owner, admin | Import data |
| `gdpr-export` | ✅ | owner, admin | Export org data |
| `gdpr-delete` | ✅ | owner, admin | Delete/anonymize |
| `send-message` | ✅ | Any org member | Send email |
| `send-invoice-email` | ✅ | owner, admin | Invoice notification |
| `send-invite-email` | ✅ | owner, admin | Member invitation |

---

## 6. API Security

### 6.1 Request Authentication

All API requests include JWT in Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 6.2 CORS Configuration

Edge functions allow CORS for the frontend origin:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Restricted in production
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
```

### 6.3 Rate Limiting

Currently relies on Supabase's default rate limiting:
- Auth endpoints: 30 requests/minute
- Database: 1000 rows per query default

---

## 7. Data Protection

### 7.1 Encryption

| Data State | Encryption |
|------------|------------|
| In transit | TLS 1.3 (HTTPS) |
| At rest | AES-256 (Supabase managed) |
| Backups | Encrypted |

### 7.2 Sensitive Fields

| Table | Sensitive Columns | Protection |
|-------|-------------------|------------|
| `students` | email, phone, dob, notes | RLS |
| `guardians` | email, phone | RLS |
| `profiles` | email, phone | Self-access only |
| `teacher_profiles` | pay_rate_value, payroll_notes | RLS |

### 7.3 GDPR Anonymization

```sql
-- Anonymise student
UPDATE students SET
  first_name = 'Deleted',
  last_name = 'User',
  email = NULL,
  phone = NULL,
  dob = NULL,
  notes = NULL,
  deleted_at = now(),
  status = 'inactive'
WHERE id = student_id;
```

---

## 8. Security Monitoring

### 8.1 Audit Logging

All data changes are logged to `audit_log`:

```sql
-- Trigger captures changes
INSERT INTO audit_log (
  org_id, actor_user_id, action, 
  entity_type, entity_id, before, after
) VALUES (...);
```

### 8.2 What's Logged

| Event | Logged | Details |
|-------|--------|---------|
| Record create | ✅ | New state |
| Record update | ✅ | Before/after state |
| Record delete | ✅ | Deleted state |
| GDPR export | ✅ | Export event |
| GDPR delete | ✅ | Deletion event |
| AI action execution | ✅ | Action details |
| Login/logout | ❌ | Supabase Auth logs |
| Failed auth | ❌ | Supabase Auth logs |

### 8.3 Log Retention

- Audit logs: Indefinite (no auto-purge)
- Supabase Auth logs: 7 days (Supabase managed)

---

## 9. Known Vulnerabilities & Mitigations

| Issue | Severity | Status | Mitigation |
|-------|----------|--------|------------|
| Leaked password protection disabled | Medium | ⚠️ Warning | Enable in production |
| Auto-confirm email enabled | Low | Documented | Disable for production |
| Service role in edge functions | Low | By design | Manual access checks |
| No 2FA | Medium | Not implemented | Roadmap item |

---

## 10. Security Checklist

### Pre-Production Checklist

- [ ] Disable auto-confirm email signups
- [ ] Enable leaked password protection
- [ ] Configure CORS for specific origin
- [ ] Review all RLS policies
- [ ] Enable 2FA (when available)
- [ ] Configure rate limiting
- [ ] Set up monitoring/alerting
- [ ] Penetration testing

### Ongoing Security Tasks

- [ ] Regular RLS policy audits
- [ ] Review audit logs weekly
- [ ] Update dependencies monthly
- [ ] Security training for team
- [ ] Incident response plan

---

→ Next: [API_REFERENCE.md](./API_REFERENCE.md)
