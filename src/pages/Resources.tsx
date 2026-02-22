import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, FolderOpen, Loader2 } from 'lucide-react';
import { useResources, ResourceWithShares } from '@/hooks/useResources';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { UploadResourceModal } from '@/components/resources/UploadResourceModal';
import { ShareResourceModal } from '@/components/resources/ShareResourceModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { useOrg } from '@/contexts/OrgContext';

export default function Resources() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceWithShares | null>(null);
  const [search, setSearch] = useState('');

  const { currentRole } = useOrg();
  const canUpload = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'teacher';
  
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useResources();

  // Flatten paginated results
  const resources = useMemo(
    () => data?.pages.flat() ?? [],
    [data]
  );

  // Client-side filter — TODO: add server-side search (.ilike) for large libraries
  const filteredResources = resources.filter(resource =>
    resource.title.toLowerCase().includes(search.toLowerCase()) ||
    resource.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleShare = (resource: ResourceWithShares) => {
    setSelectedResource(resource);
    setShareModalOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Resource Library"
          description="Upload and share teaching materials with students"
          actions={
            canUpload && (
              <Button onClick={() => setUploadModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Upload Resource
              </Button>
            )
          }
        />

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredResources.length === 0 ? (
          search ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No resources matching "{search}"</p>
            </div>
          ) : (
            <EmptyState
              icon={FolderOpen}
              title="No resources yet"
              description="Upload teaching materials like PDFs, audio files, or sheet music to share with your students."
              actionLabel="Upload your first resource"
              onAction={() => setUploadModalOpen(true)}
            />
          )
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredResources.map(resource => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onShare={handleShare}
                />
              ))}
            </div>

            {hasNextPage && !search && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <UploadResourceModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
      />

      <ShareResourceModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        resource={selectedResource}
      />
    </AppLayout>
  );
}