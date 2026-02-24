import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { STALE_SIGNED_URL, GC_SIGNED_URL } from '@/config/query-stale-times';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import {
  MoreVertical,
  Download,
  Share2,
  Trash2,
  Loader2,
  Users,
  Check,
  Eye,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { ResourceWithShares, useDeleteResource } from '@/hooks/useResources';
import { supabase } from '@/integrations/supabase/client';
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
import { getFileIcon, getFileTypeBadge, formatFileSize } from '@/lib/fileUtils';
import { ResourcePreviewModal, isPreviewable } from './ResourcePreviewModal';
import { ResourceDetailModal } from './ResourceDetailModal';
import { AudioPlayer } from './AudioPlayer';

interface ResourceCardProps {
  resource: ResourceWithShares;
  onShare: (resource: ResourceWithShares) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function ResourceCard({ resource, onShare, selectionMode, selected, onToggleSelect }: ResourceCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();
  const { currentRole } = useOrg();
  const deleteMutation = useDeleteResource();

  const canDelete = currentRole === 'owner' || currentRole === 'admin' || user?.id === resource.uploaded_by;
  const canPreview = isPreviewable(resource.file_type) !== 'none';
  const isAudio = resource.file_type.startsWith('audio/');
  const isImage = resource.file_type.startsWith('image/');

  const FileIcon = getFileIcon(resource.file_type);
  const shareCount = resource.resource_shares?.length || 0;

  const { data: thumbnailUrl } = useQuery({
    queryKey: ['resource-thumbnail', resource.id],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('teaching-resources')
        .createSignedUrl(resource.file_path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: isImage,
    staleTime: STALE_SIGNED_URL,
    gcTime: GC_SIGNED_URL,
  });

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('teaching-resources')
        .createSignedUrl(resource.file_path, 3600);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error: any) {
      toast({
        title: 'Download failed',
        description: error?.message || 'Could not generate download link. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(resource);
    setShowDeleteConfirm(false);
  };

  const handleTitleClick = () => {
    if (selectionMode) return;
    setDetailOpen(true);
  };

  return (
    <>
      <Card
        role="article"
        aria-label={resource.title}
        className={`group hover:shadow-md transition-shadow ${selectionMode ? 'cursor-pointer' : ''} ${selected ? 'ring-2 ring-primary' : ''}`}
        onClick={selectionMode ? () => onToggleSelect?.(resource.id) : undefined}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {selectionMode && (
              <div className={`mt-1 h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                {selected && <Check className="h-3.5 w-3.5" />}
              </div>
            )}
            <button
              type="button"
              className={`rounded-lg shrink-0 overflow-hidden ${isImage && thumbnailUrl ? 'h-12 w-12' : 'p-2 bg-muted'} ${!selectionMode ? 'hover:bg-primary/10 cursor-pointer transition-colors' : ''}`}
              onClick={handleTitleClick}
              disabled={selectionMode}
              title="View details"
            >
              {isImage && thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={resource.title}
                  className="h-12 w-12 rounded-lg object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.classList.add('p-2', 'bg-muted');
                  }}
                />
              ) : (
                <FileIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <h3
                className={`font-medium truncate ${!selectionMode ? 'hover:text-primary cursor-pointer' : ''}`}
                title={resource.title}
                onClick={handleTitleClick}
                role="button"
                tabIndex={!selectionMode ? 0 : undefined}
              >
                {resource.title}
              </h3>
              {resource.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                  {resource.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {getFileTypeBadge(resource.file_type)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(resource.file_size_bytes)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(resource.created_at), 'dd MMM yyyy')}
                </span>
              </div>
              {shareCount > 0 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  Shared with {shareCount} student{shareCount !== 1 ? 's' : ''}
                </div>
              )}
              {isAudio && !selectionMode && (
                <AudioPlayer filePath={resource.file_path} title={resource.title} />
              )}
            </div>

            {!selectionMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 sm:h-9 sm:w-9" aria-label="Resource actions">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDetailOpen(true)}>
                    <Info className="mr-2 h-4 w-4" />
                    Details
                  </DropdownMenuItem>
                  {canPreview && (
                    <DropdownMenuItem onClick={() => setPreviewOpen(true)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Preview
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleDownload} disabled={isDownloading}>
                    {isDownloading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onShare(resource)}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Share with students
                  </DropdownMenuItem>
                  {canDelete && (
                    <DropdownMenuItem
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardContent>
      </Card>

      <ResourceDetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        resource={resource}
      />

      <ResourcePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        filePath={resource.file_path}
        fileName={resource.file_name}
        fileType={resource.file_type}
        title={resource.title}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete resource?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{resource.title}" and remove access for all students it was shared with.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
