import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { PortalLayout } from '@/components/layout/PortalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Download,
  Search,
  FolderOpen,
  Loader2,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { useSharedResources, type ShareWithStudent } from '@/hooks/useResources';
import { supabase } from '@/integrations/supabase/client';
import { getFileIcon, getFileTypeBadge, formatFileSize } from '@/lib/fileUtils';
import { ResourcePreviewModal, isPreviewable } from '@/components/resources/ResourcePreviewModal';
import { AudioPlayer } from '@/components/resources/AudioPlayer';
import { useChildFilter } from '@/contexts/ChildFilterContext';

interface ResourceDownloadButtonProps {
  filePath: string;
  fileName: string;
}

function ResourceDownloadButton({ filePath, fileName }: ResourceDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from('teaching-resources')
        .createSignedUrl(filePath, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        const a = document.createElement('a');
        a.href = data.signedUrl;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch {
      toast({
        title: 'Download failed',
        description: 'Please try again. If this persists, contact your teacher.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDownload}
      disabled={isDownloading}
      title="Download"
    >
      {isDownloading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
    </Button>
  );
}

export default function PortalResources() {
  const [search, setSearch] = useState('');
  const [previewResource, setPreviewResource] = useState<{
    filePath: string;
    fileName: string;
    fileType: string;
    title: string;
  } | null>(null);
  const { selectedChildId } = useChildFilter();

  const { data: resources = [], isLoading } = useSharedResources();

  const filteredResources = useMemo(() => {
    let result = resources;
    // Filter by selected child
    if (selectedChildId) {
      result = result.filter(r =>
        r.resource_shares?.some((share: ShareWithStudent) => share.student_id === selectedChildId)
      );
    }
    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [resources, selectedChildId, search]);

  return (
    <PortalLayout>
      <div className="space-y-6">
        <PageHeader title="Resources" description="Teaching materials shared by your teacher" />

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
          <ListSkeleton count={3} />
        ) : filteredResources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-medium">No resources shared yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your teacher will share resources here when available.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredResources.map(resource => {
              const FileIcon = getFileIcon(resource.file_type);
              const canPreview = isPreviewable(resource.file_type) !== 'none';
              const isAudio = resource.file_type.startsWith('audio/');
              const sharedStudents = resource.resource_shares?.map(
                (s: ShareWithStudent) => s.students ? `${s.students.first_name} ${s.students.last_name}` : ''
              ).filter(Boolean);

              return (
                <Card key={resource.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        className={`p-2 rounded-lg bg-muted shrink-0 ${canPreview ? 'hover:bg-primary/10 cursor-pointer transition-colors' : ''}`}
                        onClick={canPreview ? () => setPreviewResource({
                          filePath: resource.file_path,
                          fileName: resource.file_name,
                          fileType: resource.file_type,
                          title: resource.title,
                        }) : undefined}
                        disabled={!canPreview}
                        title={canPreview ? 'Preview' : undefined}
                      >
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                      </button>

                      <div className="flex-1 min-w-0">
                        <h3
                          className={`font-medium truncate ${canPreview ? 'hover:text-primary cursor-pointer' : ''}`}
                          onClick={canPreview ? () => setPreviewResource({
                            filePath: resource.file_path,
                            fileName: resource.file_name,
                            fileType: resource.file_type,
                            title: resource.title,
                          }) : undefined}
                          role={canPreview ? 'button' : undefined}
                          tabIndex={canPreview ? 0 : undefined}
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
                        {sharedStudents && sharedStudents.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            For: {sharedStudents.join(', ')}
                          </p>
                        )}
                        {isAudio && (
                          <AudioPlayer filePath={resource.file_path} title={resource.title} />
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {canPreview && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPreviewResource({
                              filePath: resource.file_path,
                              fileName: resource.file_name,
                              fileType: resource.file_type,
                              title: resource.title,
                            })}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <ResourceDownloadButton
                          filePath={resource.file_path}
                          fileName={resource.file_name}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {previewResource && (
        <ResourcePreviewModal
          open={!!previewResource}
          onOpenChange={(open) => { if (!open) setPreviewResource(null); }}
          filePath={previewResource.filePath}
          fileName={previewResource.fileName}
          fileType={previewResource.fileType}
          title={previewResource.title}
        />
      )}
    </PortalLayout>
  );
}
