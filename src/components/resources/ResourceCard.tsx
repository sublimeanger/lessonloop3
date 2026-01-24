import { useState } from 'react';
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
  FileText,
  Image,
  Music,
  Video,
  File,
  MoreVertical,
  Download,
  Share2,
  Trash2,
  Loader2,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import { ResourceWithShares, useDeleteResource, useResourceDownloadUrl } from '@/hooks/useResources';
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

interface ResourceCardProps {
  resource: ResourceWithShares;
  onShare: (resource: ResourceWithShares) => void;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return Image;
  if (fileType.startsWith('audio/')) return Music;
  if (fileType.startsWith('video/')) return Video;
  if (fileType.includes('pdf') || fileType.includes('word')) return FileText;
  return File;
}

function getFileTypeBadge(fileType: string): string {
  if (fileType.startsWith('image/')) return 'Image';
  if (fileType.startsWith('audio/')) return 'Audio';
  if (fileType.startsWith('video/')) return 'Video';
  if (fileType.includes('pdf')) return 'PDF';
  if (fileType.includes('word')) return 'Document';
  return 'File';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResourceCard({ resource, onShare }: ResourceCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const deleteMutation = useDeleteResource();
  const { data: downloadUrl, refetch: fetchDownloadUrl } = useResourceDownloadUrl(resource.file_path);

  const FileIcon = getFileIcon(resource.file_type);
  const shareCount = resource.resource_shares?.length || 0;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { data } = await fetchDownloadUrl();
      if (data) {
        window.open(data, '_blank');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(resource);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <Card className="group hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted shrink-0">
              <FileIcon className="h-6 w-6 text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate" title={resource.title}>
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
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
                <DropdownMenuItem
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

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
