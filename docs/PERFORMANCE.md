# Performance

> **Document Type**: Performance Optimization Reference  
> **Last Updated**: 2026-01-20

---

## 1. Database Performance

### 1.1 Index Strategy

All frequently queried columns have composite indexes for optimal performance.

#### Lesson Indexes

```sql
-- Primary query patterns
CREATE INDEX idx_lessons_org_start ON lessons (org_id, start_at);
CREATE INDEX idx_lessons_org_teacher ON lessons (org_id, teacher_user_id);
CREATE INDEX idx_lessons_org_status ON lessons (org_id, status);
CREATE INDEX idx_lessons_org_location ON lessons (org_id, location_id);
CREATE INDEX idx_lessons_recurrence ON lessons (recurrence_id);
CREATE INDEX idx_lessons_org_start_end ON lessons (org_id, start_at, end_at);
```

#### Invoice Indexes

```sql
CREATE INDEX idx_invoices_org_status ON invoices (org_id, status);
CREATE INDEX idx_invoices_org_due_date ON invoices (org_id, due_date);
CREATE INDEX idx_invoices_org_payer_guardian ON invoices (org_id, payer_guardian_id);
CREATE INDEX idx_invoices_org_payer_student ON invoices (org_id, payer_student_id);
CREATE INDEX idx_invoices_org_created ON invoices (org_id, created_at);
```

#### Student & Guardian Indexes

```sql
CREATE INDEX idx_students_org_status ON students (org_id, status);
CREATE INDEX idx_students_org_deleted ON students (org_id, deleted_at);
CREATE INDEX idx_students_org_name ON students (org_id, last_name, first_name);

CREATE INDEX idx_guardians_org_deleted ON guardians (org_id, deleted_at);
CREATE INDEX idx_guardians_org_user ON guardians (org_id, user_id);
CREATE INDEX idx_guardians_org_email ON guardians (org_id, email);
```

#### Junction Table Indexes

```sql
CREATE INDEX idx_lesson_participants_org_lesson ON lesson_participants (org_id, lesson_id);
CREATE INDEX idx_lesson_participants_org_student ON lesson_participants (org_id, student_id);

CREATE INDEX idx_student_guardians_org_student ON student_guardians (org_id, student_id);
CREATE INDEX idx_student_guardians_org_guardian ON student_guardians (org_id, guardian_id);

CREATE INDEX idx_invoice_items_org_invoice ON invoice_items (org_id, invoice_id);
CREATE INDEX idx_invoice_items_org_student ON invoice_items (org_id, student_id);
```

#### Audit & Messaging Indexes

```sql
CREATE INDEX idx_audit_log_org_created ON audit_log (org_id, created_at DESC);
CREATE INDEX idx_audit_log_org_entity ON audit_log (org_id, entity_type, created_at DESC);
CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id, created_at);

CREATE INDEX idx_message_log_org_created ON message_log (org_id, created_at DESC);
CREATE INDEX idx_message_log_org_status ON message_log (org_id, status);
CREATE INDEX idx_message_log_org_recipient ON message_log (org_id, recipient_id);
```

### 1.2 Query Optimization

#### Date-Windowed Queries

Calendar queries use date windows to limit data:

```typescript
// useCalendarData.ts
const { data } = await supabase
  .from('lessons')
  .select('*')
  .eq('org_id', orgId)
  .gte('start_at', windowStart.toISOString())
  .lte('start_at', windowEnd.toISOString())
  .order('start_at');
```

#### Batch Fetching

Eliminate N+1 queries with batch fetching:

```typescript
// Before (N+1 problem)
for (const lesson of lessons) {
  const { data: participants } = await supabase
    .from('lesson_participants')
    .select('*, student:students(*)')
    .eq('lesson_id', lesson.id);
}

// After (single query)
const lessonIds = lessons.map(l => l.id);
const { data: allParticipants } = await supabase
  .from('lesson_participants')
  .select('*, student:students(*)')
  .in('lesson_id', lessonIds);

// Group by lesson
const participantsByLesson = groupBy(allParticipants, 'lesson_id');
```

#### Parallel Queries

Fetch independent data in parallel:

```typescript
// useCalendarData.ts
const [lessons, teachers, locations, students] = await Promise.all([
  fetchLessons(orgId, startDate, endDate),
  fetchTeachers(orgId),
  fetchLocations(orgId),
  fetchStudents(orgId)
]);
```

### 1.3 Query Limits

Default Supabase limit is 1000 rows per query:

```typescript
// Explicit pagination for large datasets
const { data, count } = await supabase
  .from('students')
  .select('*', { count: 'exact' })
  .range(0, 99)  // First 100
  .order('last_name');
```

---

## 2. Frontend Performance

### 2.1 Code Splitting

Routes are lazy-loaded:

```typescript
// App.tsx
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'));

<Suspense fallback={<LoadingState />}>
  <Route path="/calendar" element={<CalendarPage />} />
</Suspense>
```

### 2.2 Request Cancellation

Abort stale requests during navigation:

```typescript
// useCalendarData.ts
useEffect(() => {
  const abortController = new AbortController();
  
  fetchData(abortController.signal);
  
  return () => abortController.abort();
}, [startDate, endDate]);
```

### 2.3 TanStack Query Caching

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: false,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000)
    }
  }
});
```

### 2.4 Query Invalidation Strategy

```typescript
// Precise invalidation
queryClient.invalidateQueries({ queryKey: ['students', orgId] });

// Pattern-based invalidation
queryClient.invalidateQueries({ queryKey: ['lessons'] });

// Full reset (rare)
queryClient.clear();
```

### 2.5 Optimistic Updates

```typescript
const updateStudent = useMutation({
  mutationFn: async (data) => {
    const { error } = await supabase
      .from('students')
      .update(data)
      .eq('id', data.id);
    if (error) throw error;
  },
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['students'] });
    
    // Snapshot previous value
    const previous = queryClient.getQueryData(['students']);
    
    // Optimistically update
    queryClient.setQueryData(['students'], (old) => 
      old.map(s => s.id === newData.id ? { ...s, ...newData } : s)
    );
    
    return { previous };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(['students'], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['students'] });
  }
});
```

---

## 3. Rendering Performance

### 3.1 Memoization

```typescript
// Expensive computations
const sortedLessons = useMemo(() => 
  lessons.sort((a, b) => 
    new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  ),
  [lessons]
);

// Stable callbacks
const handleLessonClick = useCallback((lessonId: string) => {
  setSelectedLesson(lessonId);
}, []);

// Component memoization
const LessonCard = memo(function LessonCard({ lesson }: Props) {
  return <div>{/* ... */}</div>;
});
```

### 3.2 Virtual Scrolling (Future)

For large lists (1000+ items):

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function StudentList({ students }: { students: Student[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: students.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10
  });
  
  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <StudentRow 
            key={students[virtualRow.index].id}
            student={students[virtualRow.index]}
            style={{
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

### 3.3 Debouncing

```typescript
// Search input debouncing
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebouncedValue(searchTerm, 300);

useEffect(() => {
  if (debouncedSearch) {
    performSearch(debouncedSearch);
  }
}, [debouncedSearch]);
```

---

## 4. Bundle Optimization

### 4.1 Bundle Analysis

```bash
# Generate bundle stats
npm run build -- --stats

# Analyze with vite-bundle-analyzer
npm run build:analyze
```

### 4.2 Tree Shaking

```typescript
// Good: Named imports
import { Button, Card } from '@/components/ui';

// Bad: Namespace imports
import * as UI from '@/components/ui';
```

### 4.3 Dynamic Imports

```typescript
// Load heavy libraries on demand
const handleExport = async () => {
  const { exportToCSV } = await import('./utils/export');
  exportToCSV(data);
};
```

### 4.4 Target Bundle Sizes

| Chunk | Target | Current |
|-------|--------|---------|
| Initial JS | < 200KB | ~180KB |
| Vendor JS | < 100KB | ~90KB |
| Route chunks | < 50KB | ~30-40KB |
| CSS | < 50KB | ~45KB |

---

## 5. Network Performance

### 5.1 Request Batching

Multiple queries in single request:

```typescript
// Single request with multiple tables
const { data } = await supabase
  .from('lessons')
  .select(`
    *,
    teacher:profiles!teacher_user_id(full_name),
    location:locations(name),
    room:rooms(name),
    participants:lesson_participants(
      student:students(id, first_name, last_name)
    )
  `)
  .gte('start_at', startDate)
  .lte('start_at', endDate);
```

### 5.2 Edge Function Streaming

AI responses use streaming for perceived performance:

```typescript
// looopassist-chat
const stream = new ReadableStream({
  async start(controller) {
    for await (const chunk of aiResponse) {
      controller.enqueue(new TextEncoder().encode(chunk));
    }
    controller.close();
  }
});

return new Response(stream, {
  headers: { 'Content-Type': 'text/event-stream' }
});
```

### 5.3 Compression

All responses are gzip compressed by Supabase/CDN.

---

## 6. Caching Strategy

### 6.1 Cache Hierarchy

```
┌─────────────────────────────────────────┐
│           Browser Memory                 │
│         (TanStack Query)                │
│        TTL: 5-30 minutes                │
├─────────────────────────────────────────┤
│          Service Worker                  │
│        (Future - PWA)                   │
│        TTL: Configurable                │
├─────────────────────────────────────────┤
│            CDN Edge                      │
│        (Static assets)                  │
│        TTL: 1 year                      │
├─────────────────────────────────────────┤
│          Supabase                        │
│     (Connection pooling)                │
└─────────────────────────────────────────┘
```

### 6.2 Cache Invalidation Triggers

| Event | Invalidation |
|-------|--------------|
| Create entity | List + related lists |
| Update entity | Single + list |
| Delete entity | List + related lists |
| Org switch | All queries |
| Logout | Clear all |

---

## 7. Monitoring

### 7.1 Performance Metrics

| Metric | Target | Tool |
|--------|--------|------|
| LCP | < 2.5s | Web Vitals |
| FID | < 100ms | Web Vitals |
| CLS | < 0.1 | Web Vitals |
| TTFB | < 600ms | Web Vitals |
| Bundle size | < 200KB | Build stats |
| Query time | < 500ms | Supabase dashboard |

### 7.2 Query Performance Logging

```typescript
// Log slow queries
const startTime = performance.now();
const { data, error } = await supabase.from('lessons').select('*');
const duration = performance.now() - startTime;

if (duration > 500) {
  console.warn(`Slow query: ${duration}ms`, { table: 'lessons' });
}
```

---

## 8. Performance Checklist

### Database
- [x] Composite indexes on query patterns
- [x] Date-windowed queries for calendar
- [x] Batch fetching for related data
- [x] Parallel independent queries
- [ ] Query explain analysis
- [ ] Connection pooling monitoring

### Frontend
- [x] Code splitting for routes
- [x] Request cancellation
- [x] TanStack Query caching
- [x] Memoization for expensive ops
- [ ] Virtual scrolling for large lists
- [ ] Service worker caching

### Network
- [x] Request batching via select
- [x] Streaming for AI responses
- [x] Gzip compression
- [ ] Preloading critical routes
- [ ] Resource hints (prefetch/preconnect)

### Monitoring
- [ ] Web Vitals tracking
- [ ] Query performance logging
- [ ] Error tracking (Sentry)
- [ ] Bundle size CI checks

---

→ Next: [DEPLOYMENT.md](./DEPLOYMENT.md)
