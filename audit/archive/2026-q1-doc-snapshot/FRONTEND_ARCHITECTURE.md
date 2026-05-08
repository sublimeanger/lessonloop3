# Frontend Architecture

> **Document Type**: UI Structure Reference  
> **Last Updated**: 2026-01-20

---

## 1. Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool & dev server |
| React Router | 6.30.1 | Client-side routing |
| TanStack Query | 5.83.0 | Server state management |
| Tailwind CSS | 3.x | Utility-first styling |
| shadcn/ui | Latest | Component library |
| Lucide React | 0.462.0 | Icons |
| date-fns | 3.6.0 | Date manipulation |
| Zod | 3.25.76 | Schema validation |
| React Hook Form | 7.61.1 | Form handling |

---

## 2. Project Structure

```
src/
├── components/
│   ├── auth/           # Authentication components
│   ├── calendar/       # Calendar and scheduling
│   ├── invoices/       # Billing components
│   ├── layout/         # App and portal layouts
│   ├── looopassist/    # AI assistant components
│   ├── messages/       # Messaging components
│   ├── portal/         # Parent portal components
│   ├── settings/       # Settings tabs
│   ├── shared/         # Reusable components
│   └── ui/             # shadcn/ui components
├── contexts/
│   ├── AuthContext.tsx
│   ├── OrgContext.tsx
│   └── LoopAssistContext.tsx
├── hooks/
│   ├── useCalendarData.ts
│   ├── useInvoices.ts
│   ├── useLoopAssist.ts
│   └── ... (domain hooks)
├── integrations/
│   └── supabase/
│       ├── client.ts
│       └── types.ts
├── lib/
│   └── utils.ts
├── pages/
│   ├── portal/         # Parent portal pages
│   ├── reports/        # Report pages
│   └── ... (main pages)
├── test/
│   ├── setup.ts
│   └── example.test.ts
├── App.tsx
├── main.tsx
└── index.css
```

---

## 3. Routing

### 3.1 Route Configuration

```typescript
// App.tsx - Route structure
<Routes>
  {/* Public Routes */}
  <Route path="/" element={<PublicRoute><Index /></PublicRoute>} />
  <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
  <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
  <Route path="/forgot-password" element={<ForgotPassword />} />
  <Route path="/accept-invite" element={<AcceptInvite />} />

  {/* Protected Routes - Require Auth + Onboarding */}
  <Route path="/onboarding" element={<RouteGuard requireAuth><Onboarding /></RouteGuard>} />
  <Route path="/dashboard" element={<RouteGuard requireAuth requireOnboarding><Dashboard /></RouteGuard>} />
  <Route path="/calendar" element={<RouteGuard requireAuth requireOnboarding><CalendarPage /></RouteGuard>} />
  <Route path="/students" element={<RouteGuard requireAuth requireOnboarding><Students /></RouteGuard>} />
  <Route path="/students/import" element={<RouteGuard requireAuth requireOnboarding><StudentsImport /></RouteGuard>} />
  <Route path="/students/:id" element={<RouteGuard requireAuth requireOnboarding><StudentDetail /></RouteGuard>} />
  <Route path="/teachers" element={<RouteGuard requireAuth requireOnboarding><Teachers /></RouteGuard>} />
  <Route path="/locations" element={<RouteGuard requireAuth requireOnboarding><Locations /></RouteGuard>} />
  <Route path="/invoices" element={<RouteGuard requireAuth requireOnboarding><Invoices /></RouteGuard>} />
  <Route path="/invoices/:id" element={<RouteGuard requireAuth requireOnboarding><InvoiceDetail /></RouteGuard>} />
  <Route path="/messages" element={<RouteGuard requireAuth requireOnboarding><Messages /></RouteGuard>} />
  <Route path="/reports" element={<RouteGuard requireAuth requireOnboarding><Reports /></RouteGuard>} />
  <Route path="/reports/*" element={<RouteGuard requireAuth requireOnboarding><ReportSubpages /></RouteGuard>} />
  <Route path="/settings" element={<RouteGuard requireAuth requireOnboarding><Settings /></RouteGuard>} />

  {/* Parent Portal Routes */}
  <Route path="/portal" element={<RouteGuard requireAuth allowedRoles={['parent']}><PortalHome /></RouteGuard>} />
  <Route path="/portal/schedule" element={<RouteGuard requireAuth allowedRoles={['parent']}><PortalSchedule /></RouteGuard>} />
  <Route path="/portal/invoices" element={<RouteGuard requireAuth allowedRoles={['parent']}><PortalInvoices /></RouteGuard>} />
  <Route path="/portal/messages" element={<RouteGuard requireAuth allowedRoles={['parent']}><PortalMessages /></RouteGuard>} />

  {/* Catch-all */}
  <Route path="*" element={<NotFound />} />
</Routes>
```

### 3.2 Route Guards

```typescript
// RouteGuard component
interface RouteGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireOnboarding?: boolean;
  allowedRoles?: string[];
  redirectTo?: string;
}

function RouteGuard({
  children,
  requireAuth = false,
  requireOnboarding = false,
  allowedRoles,
  redirectTo = '/login'
}: RouteGuardProps) {
  const { user, isLoading, hasCompletedOnboarding, userRoles } = useAuth();
  
  if (isLoading) return <LoadingState />;
  
  if (requireAuth && !user) {
    return <Navigate to={redirectTo} />;
  }
  
  if (requireOnboarding && !hasCompletedOnboarding) {
    return <Navigate to="/onboarding" />;
  }
  
  if (allowedRoles && !allowedRoles.some(r => userRoles.includes(r))) {
    return <Navigate to="/dashboard" />;
  }
  
  return <>{children}</>;
}
```

### 3.3 Route Summary

| Route | Component | Guard | Description |
|-------|-----------|-------|-------------|
| `/` | Index | Public | Landing page |
| `/login` | Login | Public | Sign in |
| `/signup` | Signup | Public | Create account |
| `/forgot-password` | ForgotPassword | None | Password reset |
| `/accept-invite` | AcceptInvite | None | Accept org invite |
| `/onboarding` | Onboarding | Auth | Initial setup |
| `/dashboard` | Dashboard | Auth+Onboard | Main dashboard |
| `/calendar` | CalendarPage | Auth+Onboard | Lesson calendar |
| `/students` | Students | Auth+Onboard | Student list |
| `/students/import` | StudentsImport | Auth+Onboard | CSV import |
| `/students/:id` | StudentDetail | Auth+Onboard | Student profile |
| `/teachers` | Teachers | Auth+Onboard | Teacher list |
| `/locations` | Locations | Auth+Onboard | Location management |
| `/invoices` | Invoices | Auth+Onboard | Invoice list |
| `/invoices/:id` | InvoiceDetail | Auth+Onboard | Invoice details |
| `/messages` | Messages | Auth+Onboard | Message center |
| `/reports` | Reports | Auth+Onboard | Report hub |
| `/settings` | Settings | Auth+Onboard | Org settings |
| `/portal/*` | Portal* | Parent role | Parent portal |

---

## 4. Layouts

### 4.1 AppLayout

Used for admin/teacher interface:

```typescript
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
      <LoopAssistDrawer />
    </SidebarProvider>
  );
}
```

### 4.2 PortalLayout

Used for parent portal:

```typescript
function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PortalSidebar />
      <main className="lg:ml-64 p-6">
        {children}
      </main>
    </div>
  );
}
```

### 4.3 Layout Hierarchy

```
App
├── AuthProvider
│   ├── OrgProvider
│   │   ├── QueryClientProvider
│   │   │   ├── LoopAssistProvider
│   │   │   │   ├── Routes
│   │   │   │   │   ├── AppLayout (admin routes)
│   │   │   │   │   │   └── Page content
│   │   │   │   │   └── PortalLayout (portal routes)
│   │   │   │   │       └── Portal content
│   │   │   │   └── Toaster
```

---

## 5. State Management

### 5.1 Context Providers

#### AuthContext

```typescript
interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;
  userRoles: string[];
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}
```

#### OrgContext

```typescript
interface OrgContextType {
  currentOrg: Organisation | null;
  currentRole: string | null;
  organisations: Organisation[];
  memberships: OrgMembership[];
  isLoading: boolean;
  isOrgAdmin: boolean;
  isOrgOwner: boolean;
  setCurrentOrg: (org: Organisation) => void;
  createOrganisation: (data: CreateOrgData) => Promise<Organisation>;
  refreshOrganisations: () => Promise<void>;
}
```

#### LoopAssistContext

```typescript
interface LoopAssistContextType {
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
}
```

### 5.2 Server State (TanStack Query)

```typescript
// Example: useStudents hook
function useStudents() {
  const { currentOrg } = useOrg();
  
  return useQuery({
    queryKey: ['students', currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('org_id', currentOrg?.id)
        .is('deleted_at', null)
        .order('last_name');
      
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrg?.id
  });
}
```

### 5.3 Query Key Conventions

| Pattern | Example | Description |
|---------|---------|-------------|
| `[entity]` | `['students']` | All students |
| `[entity, orgId]` | `['students', 'uuid']` | Students in org |
| `[entity, id]` | `['student', 'uuid']` | Single student |
| `[entity, filters]` | `['lessons', { week: '2026-W03' }]` | Filtered list |

---

## 6. Component Patterns

### 6.1 Page Structure

```typescript
function StudentsPage() {
  const { data: students, isLoading, error } = useStudents();
  
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!students?.length) return <EmptyState />;
  
  return (
    <AppLayout>
      <PageHeader title="Students" actions={<AddButton />} />
      <FiltersBar />
      <StudentList students={students} />
    </AppLayout>
  );
}
```

### 6.2 Form Pattern

```typescript
function StudentForm({ student, onSubmit }: StudentFormProps) {
  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: student || defaultValues
  });
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* More fields... */}
        <Button type="submit">Save</Button>
      </form>
    </Form>
  );
}
```

### 6.3 Modal Pattern

```typescript
function CreateStudentModal({ open, onOpenChange }: ModalProps) {
  const createStudent = useCreateStudent();
  
  const handleSubmit = async (data: StudentFormData) => {
    await createStudent.mutateAsync(data);
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Student</DialogTitle>
        </DialogHeader>
        <StudentForm onSubmit={handleSubmit} />
      </DialogContent>
    </Dialog>
  );
}
```

---

## 7. Styling System

### 7.1 Design Tokens

```css
/* index.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --muted: 210 40% 96.1%;
  --accent: 210 40% 96.1%;
  --destructive: 0 84.2% 60.2%;
  --success: 142 76% 36%;
  --warning: 38 92% 50%;
  --border: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... dark mode overrides */
}
```

### 7.2 Component Variants

```typescript
// Button variants
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-white hover:bg-success/90",
        warning: "bg-warning text-white hover:bg-warning/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

### 7.3 Responsive Design

```typescript
// Tailwind breakpoints
const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px' // Extra large
};

// Usage in components
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Responsive grid */}
</div>
```

---

## 8. Data Fetching Hooks

### 8.1 Core Hooks

| Hook | Purpose | Key Features |
|------|---------|--------------|
| `useCalendarData` | Fetch lessons for calendar | Date-range queries, batch fetching |
| `useStudents` | Student list and CRUD | Soft-delete aware |
| `useInvoices` | Invoice management | Status filtering, pagination |
| `useBillingRuns` | Billing run operations | Date range, summary stats |
| `useMessages` | Message log and templates | Filtering, pagination |
| `useParentPortal` | Parent portal data | Linked students only |
| `useReports` | Report data aggregation | Multiple queries combined |
| `usePayroll` | Teacher payroll data | Date range, teacher filter |
| `useLoopAssist` | AI chat functionality | Streaming, proposals |
| `useGDPR` | Export and deletion | Admin only |
| `useAuditLog` | Audit log queries | Admin only |

### 8.2 Hook Pattern

```typescript
function useStudents(options?: UseStudentsOptions) {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  
  // Query
  const query = useQuery({
    queryKey: ['students', currentOrg?.id, options],
    queryFn: async () => { /* fetch */ },
    enabled: !!currentOrg?.id
  });
  
  // Mutations
  const createStudent = useMutation({
    mutationFn: async (data: StudentInput) => { /* create */ },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({ title: 'Student created' });
    }
  });
  
  return {
    ...query,
    createStudent,
    updateStudent,
    deleteStudent
  };
}
```

---

## 9. Accessibility

### 9.1 Standards

- WCAG 2.1 Level AA compliance target
- Semantic HTML elements
- ARIA labels and roles
- Keyboard navigation
- Focus management

### 9.2 Implementation

```typescript
// Focus trapping in modals
<Dialog>
  <DialogContent>
    {/* Focus trapped within */}
  </DialogContent>
</Dialog>

// Skip links
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>

// Keyboard navigation
<Button
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Action
</Button>

// Screen reader announcements
<div role="status" aria-live="polite">
  {loadingMessage}
</div>
```

### 9.3 Color Contrast

All color combinations meet WCAG AA requirements:
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- UI components: 3:1 minimum

---

## 10. Performance

### 10.1 Optimizations

| Technique | Implementation |
|-----------|----------------|
| Code splitting | React.lazy() for routes |
| Image optimization | Lazy loading, WebP |
| Query caching | TanStack Query stale-time |
| Debouncing | Search inputs |
| Virtual scrolling | Large lists (future) |
| Bundle analysis | Vite build analysis |

### 10.2 Loading States

```typescript
// Skeleton components
function ListSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

// Progressive loading
function StudentList() {
  const { data, isLoading, isFetching } = useStudents();
  
  if (isLoading) return <ListSkeleton />;
  
  return (
    <div className={cn(isFetching && 'opacity-50')}>
      {/* List content */}
    </div>
  );
}
```

### 10.3 Bundle Size

Target metrics:
- Initial bundle: < 200KB (gzipped)
- Route chunks: < 50KB each
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.5s

---

## 11. Testing

### 11.1 Test Setup

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true
  }
});
```

### 11.2 Test Patterns

```typescript
// Component test
describe('StudentCard', () => {
  it('displays student name', () => {
    render(<StudentCard student={mockStudent} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
  
  it('calls onEdit when edit button clicked', async () => {
    const onEdit = vi.fn();
    render(<StudentCard student={mockStudent} onEdit={onEdit} />);
    
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    
    expect(onEdit).toHaveBeenCalledWith(mockStudent.id);
  });
});
```

### 11.3 Test Coverage Targets

| Area | Target |
|------|--------|
| Unit tests | 80% |
| Integration tests | 60% |
| E2E tests | Critical paths |

---

## 12. Error Handling

### 12.1 Error Boundaries

```typescript
class ErrorBoundary extends React.Component<Props, State> {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### 12.2 Query Error Handling

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      onError: (error) => {
        console.error('Query error:', error);
        toast({ title: 'Error loading data', variant: 'destructive' });
      }
    },
    mutations: {
      onError: (error) => {
        console.error('Mutation error:', error);
        toast({ title: 'Operation failed', variant: 'destructive' });
      }
    }
  }
});
```

---

→ Next: [PERFORMANCE.md](./PERFORMANCE.md)
