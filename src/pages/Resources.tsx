import { useState, useMemo, useCallback, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, FolderOpen, Loader2, CheckSquare, Trash2, X, ArrowUpDown, LayoutGrid, List, Settings } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { safeGetItem, safeSetItem } from '@/lib/storage';
import { useResourceCategories } from '@/hooks/useResourceCategories';
import { ManageCategoriesModal } from '@/components/resources/ManageCategoriesModal';
import { Badge } from '@/components/ui/badge';
import { useResources, useDeleteResource, ResourceWithShares } from '@/hooks/useResources';
import { ResourceCard } from '@/components/resources/ResourceCard';
import { UploadResourceModal } from '@/components/resources/UploadResourceModal';
import { ShareResourceModal } from '@/components/resources/ShareResourceModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { useOrg } from '@/contexts/OrgContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { getFileTypeBadge } from '@/lib/fileUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Resources() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceWithShares | null>(null);
  const [search, setSearch] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [sharedOnly, setSharedOnly] = useState(false);
  const [sortNewest, setSortNewest] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = safeGetItem('resources-view-mode');
    return saved === 'list' || saved === 'grid' ? saved : 'grid';
  });

  // Default to list on mobile, grid on desktop — only on initial mount
  useEffect(() => {
    if (isMobile && !safeGetItem('resources-view-mode')) {
      setViewMode('list');
    }
  }, [isMobile]);

  const handleViewChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    safeSetItem('resources-view-mode', mode);
  };

  // Selection / bulk delete state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteIndex, setBulkDeleteIndex] = useState(0);

  const { currentRole } = useOrg();
  const canUpload = currentRole === 'owner' || currentRole === 'admin' || currentRole === 'teacher';

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useResources();
  const deleteMutation = useDeleteResource();
  const { data: categories = [] } = useResourceCategories();

  const resources = useMemo(
    () => data?.pages.flat() ?? [],
    [data]
  );

  // Client-side filtering — TODO: move to server-side when pagination is implemented (RES-009)
  const filteredResources = resources
    .filter(resource => {
      const matchesSearch =
        resource.title.toLowerCase().includes(search.toLowerCase()) ||
        resource.description?.toLowerCase().includes(search.toLowerCase());
      const matchesType =
        fileTypeFilter === 'all' || getFileTypeBadge(resource.file_type) === fileTypeFilter;
      const matchesShared =
        !sharedOnly || (resource.resource_shares?.length ?? 0) > 0;
      const matchesCategory =
        !categoryFilter || (resource.resource_category_assignments ?? []).some(
          (a) => a.category_id === categoryFilter
        );
      return matchesSearch && matchesType && matchesShared && matchesCategory;
    })
    .sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortNewest ? db - da : da - db;
    });

  const handleShare = (resource: ResourceWithShares) => {
    setSelectedResource(resource);
    setShareModalOpen(true);
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const toDelete = resources.filter(r => selectedIds.has(r.id));
    setBulkDeleting(true);
    for (let i = 0; i < toDelete.length; i++) {
      setBulkDeleteIndex(i);
      try {
        await deleteMutation.mutateAsync(toDelete[i]);
      } catch {
        // Hook shows toast on error — stop batch
        break;
      }
    }
    setBulkDeleting(false);
    setBulkDeleteIndex(0);
    setShowBulkDeleteConfirm(false);
    exitSelectionMode();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Resource Library"
          description="Upload and share teaching materials with students"
          actions={
            <div className="flex items-center gap-2">
              {canUpload && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectionMode ? exitSelectionMode : () => setSelectionMode(true)}
                  >
                    {selectionMode ? (
                      <>
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-4 w-4 mr-1" />
                        Select
                      </>
                    )}
                  </Button>
                   <Button onClick={() => setUploadModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Resource
                  </Button>
                </>
              )}
              {canUpload && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setManageCategoriesOpen(true)}
                  title="Manage categories"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          }
        />

        {/* Search & Filters */}
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search resources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Search resources"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue placeholder="File type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="Image">Image</SelectItem>
                <SelectItem value="Audio">Audio</SelectItem>
                <SelectItem value="Video">Video</SelectItem>
                <SelectItem value="Document">Document</SelectItem>
                <SelectItem value="File">Other</SelectItem>
              </SelectContent>
            </Select>
            <Toggle
              size="sm"
              pressed={sharedOnly}
              onPressedChange={setSharedOnly}
              className="text-xs"
            >
              Shared only
            </Toggle>
            <Toggle
              size="sm"
              pressed={!sortNewest}
              onPressedChange={(pressed) => setSortNewest(!pressed)}
              className="text-xs gap-1"
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortNewest ? 'Newest' : 'Oldest'}
            </Toggle>

            <div className="ml-auto flex items-center border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-r-none"
                onClick={() => handleViewChange('grid')}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-l-none"
                onClick={() => handleViewChange('list')}
                title="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Category filter chips */}
          {categories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={categoryFilter === null ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setCategoryFilter(null)}
              >
                All categories
              </Badge>
              {categories.map((cat) => (
                <Badge
                  key={cat.id}
                  variant={categoryFilter === cat.id ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  style={categoryFilter === cat.id && cat.color ? { backgroundColor: cat.color, color: '#fff', borderColor: cat.color } : cat.color ? { borderColor: cat.color, color: cat.color } : undefined}
                  onClick={() => setCategoryFilter(categoryFilter === cat.id ? null : cat.id)}
                >
                  {cat.name}
                </Badge>
              ))}
            </div>
          )}
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
            <div role="feed" aria-label="Resource library" className={viewMode === 'grid' ? 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-3'}>
              {filteredResources.map(resource => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onShare={handleShare}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(resource.id)}
                  onToggleSelect={toggleSelect}
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

        {/* Bulk delete floating bar */}
        {selectionMode && selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete selected
            </Button>
          </div>
        )}
      </div>

      <UploadResourceModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
      />

      <ManageCategoriesModal
        open={manageCategoriesOpen}
        onOpenChange={setManageCategoriesOpen}
      />

      <ShareResourceModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        resource={selectedResource}
      />

      {/* Bulk delete confirmation */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} resource{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected resources and remove access for all students they were shared with.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {bulkDeleting && (
            <div className="text-sm text-muted-foreground text-center">
              Deleting {bulkDeleteIndex + 1} of {selectedIds.size}…
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDeleting}
            >
              {bulkDeleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
