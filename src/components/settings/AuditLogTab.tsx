import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { useAuditLog, getActionLabel, getEntityLabel, getChangeDescription, AuditLogEntry } from '@/hooks/useAuditLog';
import { History, Eye, User, Calendar, FileText } from 'lucide-react';


const ENTITY_TYPES = [
  { value: 'all', label: 'All Entities' },
  { value: 'students', label: 'Students' },
  { value: 'lessons', label: 'Lessons' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'payments', label: 'Payments' },
  { value: 'org_memberships', label: 'Memberships' },
];

const ACTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Created' },
  { value: 'update', label: 'Updated' },
  { value: 'delete', label: 'Deleted' },
];

export default function AuditLogTab() {
  const [entityType, setEntityType] = useState('all');
  const [action, setAction] = useState('all');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  const { data: logs, isLoading, error } = useAuditLog({
    entityType: entityType === 'all' ? undefined : entityType,
    action: action === 'all' ? undefined : action,
    startDate,
    endDate,
    limit: 200,
  });

  const getActionBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (action) {
      case 'create': return 'default';
      case 'update': return 'secondary';
      case 'delete': return 'destructive';
      default: return 'outline';
    }
  };

  const formatJson = (obj: Record<string, unknown> | null): string => {
    if (!obj) return 'null';
    return JSON.stringify(obj, null, 2);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Audit Log
          </CardTitle>
          <CardDescription>
            Track all changes made to students, lessons, invoices, and more
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="All Entities" />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11 w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11 w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Entries */}
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState icon={History} title="Error loading audit log" description={error.message} />
      ) : !logs || logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No audit entries"
          description="No changes have been recorded in the selected date range."
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(entry.created_at), 'd MMM yyyy, HH:mm')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{entry.actor_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getEntityLabel(entry.entity_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(entry.action)}>
                        {getActionLabel(entry.action)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm">
                      {getChangeDescription(entry)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-11 w-11 p-0 sm:h-9 sm:w-9"
                        aria-label={`View audit entry for ${entry.actor_name}`}
                        onClick={() => setSelectedEntry(entry)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
            {logs && logs.length >= 200 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Showing the first 200 results. Narrow your date range or filters to see more.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="h-[100dvh] w-full max-w-none overflow-y-auto rounded-none border-0 p-4 sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-lg sm:border sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription>
              {selectedEntry && getChangeDescription(selectedEntry)}
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Date & Time</p>
                  <p className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(selectedEntry.created_at), 'd MMM yyyy, HH:mm:ss')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">User</p>
                  <p className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {selectedEntry.actor_name}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Entity Type</p>
                  <Badge variant="outline">{getEntityLabel(selectedEntry.entity_type)}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Action</p>
                  <Badge variant={getActionBadgeVariant(selectedEntry.action)}>
                    {getActionLabel(selectedEntry.action)}
                  </Badge>
                </div>
              </div>

              {selectedEntry.before && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Before</p>
                  <ScrollArea className="h-[150px] rounded-md border bg-muted/50 p-3">
                    <pre className="text-xs whitespace-pre-wrap break-all">{formatJson(selectedEntry.before)}</pre>
                  </ScrollArea>
                </div>
              )}

              {selectedEntry.after && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">After</p>
                  <ScrollArea className="h-[150px] rounded-md border bg-muted/50 p-3">
                    <pre className="text-xs whitespace-pre-wrap break-all">{formatJson(selectedEntry.after)}</pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
