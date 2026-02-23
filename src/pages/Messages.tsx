import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, Search, Filter, Users, User, ChevronDown, MessageSquare, List, GitBranch } from 'lucide-react';
import { ListSkeleton } from '@/components/shared/LoadingState';

import { useOrg } from '@/contexts/OrgContext';
import { useMessageLog } from '@/hooks/useMessages';
import { usePendingRequestsCount } from '@/hooks/useAdminMessageRequests';
import { useUnreadInternalCount } from '@/hooks/useInternalMessages';
import { MessageList } from '@/components/messages/MessageList';
import { MessageRequestsList } from '@/components/messages/MessageRequestsList';
import { ComposeMessageModal } from '@/components/messages/ComposeMessageModal';
import { BulkComposeModal } from '@/components/messages/BulkComposeModal';
import { InternalComposeModal } from '@/components/messages/InternalComposeModal';
import type { MessageLogEntry } from '@/hooks/useMessages';
import { InternalMessageList } from '@/components/messages/InternalMessageList';
import { ThreadedMessageList } from '@/components/messages/ThreadedMessageList';
import { MessageFiltersBar, type MessageFilters } from '@/components/messages/MessageFiltersBar';
import { supabase } from '@/integrations/supabase/client';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface Guardian {
  id: string;
  full_name: string;
  email: string | null;
}

export default function Messages() {
  const { currentOrg, currentRole, isOrgAdmin, isOrgOwner } = useOrg();
  const isParent = currentRole === 'parent';
  const canViewRequests = isOrgAdmin || isOrgOwner;
  const isStaff = ['owner', 'admin', 'teacher'].includes(currentRole || '');
  
  const [composeOpen, setComposeOpen] = useState(false);
  const [bulkComposeOpen, setBulkComposeOpen] = useState(false);
  const [internalComposeOpen, setInternalComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('sent');
  const [internalView, setInternalView] = useState<'inbox' | 'sent'>('inbox');
  const [viewMode, setViewMode] = useState<'list' | 'threaded'>('threaded');
  const [replyTarget, setReplyTarget] = useState<Guardian | null>(null);
  const [replyStudentId, setReplyStudentId] = useState<string | undefined>(undefined);
  const [messageFilters, setMessageFilters] = useState<MessageFilters>({});

  const { data: messages, isLoading, hasMore, loadMore, isFetchingMore } = useMessageLog({
    channel: channelFilter === 'all' ? undefined : channelFilter,
  });
  const { data: pendingCount } = usePendingRequestsCount();
  const { data: unreadInternalCount } = useUnreadInternalCount();

  const { data: guardians = [] } = useQuery({
    queryKey: ['compose-guardians', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg) return [];
      const { data } = await supabase
        .from('guardians')
        .select('id, full_name, email')
        .eq('org_id', currentOrg.id)
        .is('deleted_at', null)
        .not('email', 'is', null)
        .order('full_name');
      return (data || []) as Guardian[];
    },
    enabled: !!currentOrg && !isParent,
  });

  // Filter messages by search query
  const filteredMessages = messages?.filter((msg) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      msg.subject.toLowerCase().includes(query) ||
      msg.recipient_name?.toLowerCase().includes(query) ||
      msg.recipient_email.toLowerCase().includes(query) ||
      msg.body.toLowerCase().includes(query)
    );
  });

  if (isParent) {
    // Parent view is handled by portal pages
    return (
      <AppLayout>
        <PageHeader
          title="Messages"
          description="View messages from your teacher"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Messages' },
          ]}
        />
        <MessageList
          messages={filteredMessages || []}
          isLoading={isLoading}
          emptyMessage="You haven't received any messages yet."
          hasMore={hasMore}
          onLoadMore={() => loadMore()}
          isFetchingMore={isFetchingMore}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Messages"
        description="Send messages and manage communications"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Messages' },
        ]}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Message
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setComposeOpen(true)} className="gap-2">
                <User className="h-4 w-4" />
                Message Parent
              </DropdownMenuItem>
              {canViewRequests && (
                <DropdownMenuItem onClick={() => setBulkComposeOpen(true)} className="gap-2">
                  <Users className="h-4 w-4" />
                  Bulk Message
                </DropdownMenuItem>
              )}
              {isStaff && (
                <DropdownMenuItem onClick={() => setInternalComposeOpen(true)} className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Internal Message
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 rounded-full p-1 h-auto">
          <TabsTrigger value="sent" className="rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-1.5 text-sm">Conversations</TabsTrigger>
          {isStaff && (
            <TabsTrigger value="internal" className="gap-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-1.5 text-sm">
              Internal
              {unreadInternalCount != null && unreadInternalCount > 0 ? (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 rounded-full">
                  {unreadInternalCount}
                </Badge>
              ) : null}
            </TabsTrigger>
          )}
          {canViewRequests && (
            <TabsTrigger value="requests" className="gap-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-1.5 text-sm">
              <span className="hidden sm:inline">Cancellation / Reschedule</span>
              <span className="sm:hidden">Requests</span>
              {pendingCount != null && pendingCount > 0 ? (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 rounded-full">
                  {pendingCount}
                </Badge>
              ) : null}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="sent">
          {/* Filters and View Toggle */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search messages…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl shadow-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <ToggleGroup 
                type="single" 
                value={viewMode} 
                onValueChange={(v) => v && setViewMode(v as 'list' | 'threaded')}
                className="border rounded-full p-0.5"
              >
                <ToggleGroupItem value="threaded" aria-label="Threaded view" className="gap-2 px-3 rounded-full data-[state=on]:bg-background data-[state=on]:shadow-sm">
                  <GitBranch className="h-4 w-4" />
                  <span className="hidden sm:inline text-sm">Threads</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view" className="gap-2 px-3 rounded-full data-[state=on]:bg-background data-[state=on]:shadow-sm">
                  <List className="h-4 w-4" />
                  <span className="hidden sm:inline text-sm">List</span>
                </ToggleGroupItem>
              </ToggleGroup>
              {viewMode === 'list' && (
                <Select value={channelFilter} onValueChange={setChannelFilter}>
                  <SelectTrigger className="w-40 rounded-xl">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="inapp">In-App</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Filters for admins */}
          {(isOrgAdmin || isOrgOwner) && viewMode === 'threaded' && (
            <div className="mb-4">
              <MessageFiltersBar filters={messageFilters} onFiltersChange={setMessageFilters} />
            </div>
          )}

          {/* Message View */}
          {viewMode === 'threaded' ? (
            <ThreadedMessageList searchQuery={searchQuery} filters={messageFilters} />
          ) : isLoading ? (
            <ListSkeleton count={3} />
          ) : (
            <MessageList
              messages={filteredMessages || []}
              isLoading={isLoading}
              emptyMessage="Use messages to communicate with parents about lessons, payments, and progress."
              hasMore={hasMore}
              onLoadMore={() => loadMore()}
              isFetchingMore={isFetchingMore}
              onReply={(msg: MessageLogEntry) => {
                if (msg.recipient_id && msg.recipient_email) {
                  setReplyTarget({
                    id: msg.recipient_id,
                    full_name: msg.recipient_name || msg.recipient_email,
                    email: msg.recipient_email,
                  });
                  setReplyStudentId(msg.related_id || undefined);
                  setComposeOpen(true);
                }
              }}
            />
          )}
        </TabsContent>

        {isStaff && (
          <TabsContent value="internal">
            <div className="flex items-center gap-4 mb-6">
              <Tabs value={internalView} onValueChange={(v) => setInternalView(v as 'inbox' | 'sent')}>
                <TabsList>
                  <TabsTrigger value="inbox">Inbox</TabsTrigger>
                  <TabsTrigger value="sent">Sent</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <InternalMessageList view={internalView} />
          </TabsContent>
        )}

        {canViewRequests && (
          <TabsContent value="requests">
            <MessageRequestsList />
          </TabsContent>
        )}
      </Tabs>

      {/* Compose Modal */}
      <ComposeMessageModal
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open);
          if (!open) {
            setReplyTarget(null);
            setReplyStudentId(undefined);
          }
        }}
        guardians={guardians}
        preselectedGuardian={replyTarget || undefined}
        studentId={replyStudentId}
      />

      {/* Bulk Compose Modal */}
      <BulkComposeModal
        open={bulkComposeOpen}
        onOpenChange={setBulkComposeOpen}
      />

      {/* Internal Compose Modal */}
      <InternalComposeModal
        open={internalComposeOpen}
        onOpenChange={setInternalComposeOpen}
      />
    </AppLayout>
  );
}
