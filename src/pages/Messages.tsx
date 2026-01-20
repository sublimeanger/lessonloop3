import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Plus, Search, Filter, Loader2 } from 'lucide-react';

import { useOrg } from '@/contexts/OrgContext';
import { useMessageLog } from '@/hooks/useMessages';
import { MessageList } from '@/components/messages/MessageList';
import { ComposeMessageModal } from '@/components/messages/ComposeMessageModal';
import { supabase } from '@/integrations/supabase/client';

interface Guardian {
  id: string;
  full_name: string;
  email: string | null;
}

export default function Messages() {
  const { currentOrg, currentRole } = useOrg();
  const isParent = currentRole === 'parent';
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [guardians, setGuardians] = useState<Guardian[]>([]);

  const { data: messages, isLoading } = useMessageLog({
    channel: channelFilter === 'all' ? undefined : channelFilter,
  });

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
        description="Send messages to students and guardians"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Messages' },
        ]}
        actions={
          <Button onClick={() => setComposeOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Message
          </Button>
        }
      />

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

      {/* Compose Modal */}
      <ComposeMessageModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        guardians={guardians}
      />
    </AppLayout>
  );
}
