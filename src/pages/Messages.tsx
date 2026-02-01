import { useState, useEffect } from 'react';
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
import { Plus, Search, Filter, Loader2, Users, User, ChevronDown, MessageSquare } from 'lucide-react';

import { useOrg } from '@/contexts/OrgContext';
import { useMessageLog } from '@/hooks/useMessages';
import { usePendingRequestsCount } from '@/hooks/useAdminMessageRequests';
import { useUnreadInternalCount } from '@/hooks/useInternalMessages';
import { MessageList } from '@/components/messages/MessageList';
import { MessageRequestsList } from '@/components/messages/MessageRequestsList';
import { ComposeMessageModal } from '@/components/messages/ComposeMessageModal';
import { BulkComposeModal } from '@/components/messages/BulkComposeModal';
import { InternalComposeModal } from '@/components/messages/InternalComposeModal';
import { InternalMessageList } from '@/components/messages/InternalMessageList';
import { supabase } from '@/integrations/supabase/client';

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
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [activeTab, setActiveTab] = useState('sent');
  const [internalView, setInternalView] = useState<'inbox' | 'sent'>('inbox');

  const { data: messages, isLoading } = useMessageLog({
    channel: channelFilter === 'all' ? undefined : channelFilter,
  });
  const { data: pendingCount } = usePendingRequestsCount();
  const { data: unreadInternalCount } = useUnreadInternalCount();

  // Fetch guardians for compose modal
  useEffect(() => {
    if (currentOrg && !isParent) {
      fetchGuardians();
    }
  }, [currentOrg?.id]);

  const fetchGuardians = async () => {
    if (!currentOrg) return;

    const { data } = await supabase
      .from('guardians')
      .select('id, full_name, email')
      .eq('org_id', currentOrg.id)
      .not('email', 'is', null)
      .order('full_name');

    setGuardians((data || []) as Guardian[]);
  };

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
        <TabsList>
          <TabsTrigger value="sent">Sent to Parents</TabsTrigger>
          {isStaff && (
            <TabsTrigger value="internal" className="gap-2">
              Internal
              {unreadInternalCount && unreadInternalCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1">
                  {unreadInternalCount}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {canViewRequests && (
            <TabsTrigger value="requests" className="gap-2">
              Parent Requests
              {pendingCount && pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="sent">
          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="inapp">In-App</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Message List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <MessageList
              messages={filteredMessages || []}
              isLoading={isLoading}
              emptyMessage="No messages sent yet. Click 'New Message' to send your first message."
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
        onOpenChange={setComposeOpen}
        guardians={guardians}
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
