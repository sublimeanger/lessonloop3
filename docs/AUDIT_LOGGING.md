# Audit Logging

> **Document Type**: Compliance & Audit Trail  
> **Last Updated**: 2026-01-20

---

## 1. Overview

LessonLoop maintains a comprehensive audit trail of all data changes for compliance, debugging, and accountability purposes. The audit system is designed to be:

- **Immutable**: Logs cannot be modified or deleted
- **Automatic**: Captures all CRUD operations via database triggers
- **Queryable**: Filterable by date, action, entity, and actor
- **Role-Restricted**: Only admins can view audit logs

---

## 2. Audit Log Structure

### 2.1 Table Schema

```sql
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id),
  actor_user_id uuid,  -- NULL for system actions
  action text NOT NULL,  -- 'create', 'update', 'delete'
  entity_type text NOT NULL,  -- table name
  entity_id uuid,  -- affected row ID
  before jsonb,  -- state before change
  after jsonb,  -- state after change
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 2.2 Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique log entry ID |
| `org_id` | uuid | Organization the change belongs to |
| `actor_user_id` | uuid | User who made the change (NULL for system) |
| `action` | text | Type of operation performed |
| `entity_type` | text | Database table name |
| `entity_id` | uuid | ID of the affected record |
| `before` | jsonb | Complete record state before change |
| `after` | jsonb | Complete record state after change |
| `created_at` | timestamptz | Timestamp of the change |

---

## 3. Trigger Implementation

### 3.1 Audit Trigger Function

```sql
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _org_id uuid;
  _action text;
  _before jsonb;
  _after jsonb;
  _entity_id uuid;
  _actor_user_id uuid;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    _action := 'create';
    _after := to_jsonb(NEW);
    _before := NULL;
    _entity_id := NEW.id;
    _org_id := NEW.org_id;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'update';
    _before := to_jsonb(OLD);
    _after := to_jsonb(NEW);
    _entity_id := NEW.id;
    _org_id := NEW.org_id;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'delete';
    _before := to_jsonb(OLD);
    _after := NULL;
    _entity_id := OLD.id;
    _org_id := OLD.org_id;
  END IF;

  -- Get current authenticated user
  _actor_user_id := auth.uid();

  -- Insert audit record
  INSERT INTO public.audit_log (
    org_id, actor_user_id, action, 
    entity_type, entity_id, before, after
  )
  VALUES (
    _org_id, _actor_user_id, _action, 
    TG_TABLE_NAME, _entity_id, _before, _after
  );

  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
```

### 3.2 Tables with Audit Triggers

Audit triggers are attached to the following tables:

| Table | Create | Update | Delete | Notes |
|-------|--------|--------|--------|-------|
| `students` | ✅ | ✅ | ✅ | Includes soft-delete |
| `guardians` | ✅ | ✅ | ✅ | Includes soft-delete |
| `lessons` | ✅ | ✅ | ✅ | Full history |
| `invoices` | ✅ | ✅ | ✅ | Status changes tracked |
| `payments` | ✅ | ✅ | ✅ | Financial trail |
| `org_memberships` | ✅ | ✅ | ✅ | Role changes |
| `rate_cards` | ✅ | ✅ | ✅ | Pricing history |

### 3.3 Trigger Attachment

```sql
-- Example: Attach trigger to students table
CREATE TRIGGER audit_students
  AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();
```

---

## 4. Captured Events

### 4.1 Action Types

| Action | Description | Before | After |
|--------|-------------|--------|-------|
| `create` | New record inserted | NULL | New state |
| `update` | Existing record modified | Old state | New state |
| `delete` | Record removed | Old state | NULL |

### 4.2 Tracked Changes

#### Student Changes
```json
{
  "action": "update",
  "entity_type": "students",
  "before": {
    "id": "uuid",
    "first_name": "John",
    "status": "active"
  },
  "after": {
    "id": "uuid",
    "first_name": "John",
    "status": "inactive",
    "deleted_at": "2026-01-20T10:00:00Z"
  }
}
```

#### Invoice Status Changes
```json
{
  "action": "update",
  "entity_type": "invoices",
  "before": {
    "id": "uuid",
    "status": "draft",
    "total_minor": 14000
  },
  "after": {
    "id": "uuid",
    "status": "sent",
    "total_minor": 14000
  }
}
```

#### Payment Recording
```json
{
  "action": "create",
  "entity_type": "payments",
  "before": null,
  "after": {
    "id": "uuid",
    "invoice_id": "invoice-uuid",
    "amount_minor": 14000,
    "method": "bank_transfer",
    "paid_at": "2026-01-20T14:30:00Z"
  }
}
```

---

## 5. Manual Audit Events

### 5.1 GDPR Export Logging

When data is exported via the GDPR export function:

```typescript
// In gdpr-export edge function
await adminClient.from('audit_log').insert({
  org_id: orgId,
  actor_user_id: userId,
  action: 'export',
  entity_type: 'gdpr_export',
  entity_id: null,
  before: null,
  after: {
    exported_at: new Date().toISOString(),
    counts: {
      students: studentsCount,
      guardians: guardiansCount,
      lessons: lessonsCount,
      invoices: invoicesCount,
      payments: paymentsCount
    }
  }
});
```

### 5.2 GDPR Deletion Logging

When records are deleted or anonymized:

```typescript
// In gdpr-delete edge function
await adminClient.from('audit_log').insert({
  org_id: orgId,
  actor_user_id: userId,
  action: request.action, // 'soft_delete' or 'anonymise'
  entity_type: request.entityType,
  entity_id: request.entityId,
  before: { /* original record */ },
  after: { /* anonymized/deleted state */ }
});
```

### 5.3 AI Action Execution Logging

When AI actions are confirmed and executed:

```typescript
// In looopassist-execute edge function
await adminClient.from('audit_log').insert({
  org_id: orgId,
  actor_user_id: userId,
  action: 'ai_action_execute',
  entity_type: 'ai_action_proposals',
  entity_id: proposalId,
  before: { status: 'proposed', proposal: {...} },
  after: { status: 'executed', result: {...} }
});
```

---

## 6. Access Control

### 6.1 RLS Policies

```sql
-- Only admins can view audit logs
CREATE POLICY "Org admins can view audit logs"
ON public.audit_log
FOR SELECT
USING (is_org_admin(auth.uid(), org_id));

-- Only system/triggers can insert
CREATE POLICY "Only triggers can insert audit logs"
ON public.audit_log
FOR INSERT
WITH CHECK (
  (actor_user_id = auth.uid() OR actor_user_id IS NULL)
  AND org_id IS NOT NULL
);

-- No updates allowed
-- No deletes allowed
```

### 6.2 Who Can Access

| Role | View Logs | Create Logs | Modify Logs |
|------|-----------|-------------|-------------|
| owner | ✅ | Via triggers | ❌ |
| admin | ✅ | Via triggers | ❌ |
| teacher | ❌ | Via triggers | ❌ |
| finance | ❌ | Via triggers | ❌ |
| parent | ❌ | ❌ | ❌ |

---

## 7. Querying Audit Logs

### 7.1 UI Access

Audit logs are accessible via **Settings > Audit Log** tab for admins.

### 7.2 Query Examples

#### Recent Activity
```sql
SELECT 
  al.*,
  p.full_name as actor_name
FROM audit_log al
LEFT JOIN profiles p ON al.actor_user_id = p.id
WHERE al.org_id = 'org-uuid'
ORDER BY al.created_at DESC
LIMIT 100;
```

#### Filter by Entity Type
```sql
SELECT * FROM audit_log
WHERE org_id = 'org-uuid'
  AND entity_type = 'invoices'
ORDER BY created_at DESC;
```

#### Filter by Date Range
```sql
SELECT * FROM audit_log
WHERE org_id = 'org-uuid'
  AND created_at >= '2026-01-01'
  AND created_at < '2026-02-01'
ORDER BY created_at DESC;
```

#### Filter by Action
```sql
SELECT * FROM audit_log
WHERE org_id = 'org-uuid'
  AND action = 'delete'
ORDER BY created_at DESC;
```

#### Track Specific Record History
```sql
SELECT * FROM audit_log
WHERE entity_type = 'students'
  AND entity_id = 'student-uuid'
ORDER BY created_at ASC;
```

### 7.3 Frontend Hook

```typescript
// useAuditLog.ts
export function useAuditLog(options?: UseAuditLogOptions) {
  const { currentOrg } = useOrg();
  
  return useQuery({
    queryKey: ['audit-log', currentOrg?.id, options],
    queryFn: async () => {
      let query = supabase
        .from('audit_log')
        .select('*')
        .eq('org_id', currentOrg?.id)
        .order('created_at', { ascending: false });
      
      if (options?.entityType) {
        query = query.eq('entity_type', options.entityType);
      }
      if (options?.action) {
        query = query.eq('action', options.action);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
}
```

---

## 8. Display Formatting

### 8.1 Action Labels

```typescript
function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'create': 'Created',
    'update': 'Updated',
    'delete': 'Deleted',
    'soft_delete': 'Soft Deleted',
    'anonymise': 'Anonymised',
    'export': 'Exported',
    'ai_action_execute': 'AI Action Executed'
  };
  return labels[action] || action;
}
```

### 8.2 Entity Labels

```typescript
function getEntityLabel(entityType: string): string {
  const labels: Record<string, string> = {
    'students': 'Student',
    'guardians': 'Guardian',
    'lessons': 'Lesson',
    'invoices': 'Invoice',
    'payments': 'Payment',
    'org_memberships': 'Member',
    'rate_cards': 'Rate Card',
    'gdpr_export': 'GDPR Export'
  };
  return labels[entityType] || entityType;
}
```

### 8.3 Change Description

```typescript
function getChangeDescription(entry: AuditLogEntry): string {
  const { action, entity_type, before, after } = entry;
  
  if (action === 'create') {
    return `Created ${getEntityLabel(entity_type)}`;
  }
  
  if (action === 'update' && entity_type === 'invoices') {
    if (before?.status !== after?.status) {
      return `Changed invoice status from ${before?.status} to ${after?.status}`;
    }
  }
  
  if (action === 'delete') {
    return `Deleted ${getEntityLabel(entity_type)}`;
  }
  
  return `${getActionLabel(action)} ${getEntityLabel(entity_type)}`;
}
```

---

## 9. Retention & Archival

### 9.1 Current Policy

| Aspect | Value |
|--------|-------|
| Retention Period | Indefinite |
| Auto-Purge | Disabled |
| Archival | Not implemented |
| Backup | Included in DB backups |

### 9.2 Future Considerations

For long-term deployments, consider:

1. **Partitioning by date**: Monthly partitions for query performance
2. **Cold storage archival**: Move old logs to cheaper storage
3. **Aggregation**: Summarize old logs into statistics
4. **Configurable retention**: Per-org retention settings

### 9.3 Recommended Retention

| Industry | Retention |
|----------|-----------|
| General | 3 years |
| Financial services | 7 years |
| Healthcare | 10+ years |
| Education | 7 years |

---

## 10. Performance Indexes

```sql
-- Efficient querying by org and date
CREATE INDEX idx_audit_log_org_created 
ON audit_log (org_id, created_at DESC);

-- Filter by entity type
CREATE INDEX idx_audit_log_org_entity 
ON audit_log (org_id, entity_type, created_at DESC);

-- Track specific entity history
CREATE INDEX idx_audit_log_entity_id 
ON audit_log (entity_type, entity_id, created_at);
```

---

## 11. Compliance Mapping

| Regulation | Requirement | Implementation |
|------------|-------------|----------------|
| GDPR Art. 30 | Records of processing | ✅ Audit log |
| GDPR Art. 33 | Breach notification data | ✅ Full history |
| ICO Guidance | Accountability | ✅ Actor tracking |
| SOC 2 | Audit trail | ✅ Immutable logs |

---

## 12. Troubleshooting

### 12.1 Missing Audit Entries

**Cause**: Trigger not attached to table

**Check**:
```sql
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'table_name';
```

### 12.2 NULL Actor

**Cause**: Action performed by system or edge function with service role

**Normal for**:
- Scheduled jobs
- Edge functions using service role
- Database triggers

### 12.3 Performance Issues

**Symptoms**: Slow inserts on audited tables

**Solutions**:
1. Ensure indexes exist on audit_log
2. Consider async logging for high-volume tables
3. Partition by date for large datasets

---

→ Next: [GDPR_COMPLIANCE.md](./GDPR_COMPLIANCE.md)
