import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { ListSkeleton } from '@/components/shared/LoadingState';
import { logger } from '@/lib/logger';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { useSharedResources, useResourceDownloadUrl } from '@/hooks/useResources';
import { supabase } from '@/integrations/supabase/client';
import { getFileIcon, getFileTypeBadge, formatFileSize } from '@/lib/fileUtils';

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
        // Create a download link
        const a = document.createElement('a');
        a.href = data.signedUrl;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
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
  const { data: resources = [], isLoading } = useSharedResources();

  const filteredResources = resources.filter(resource =>
    resource.title.toLowerCase().includes(search.toLowerCase()) ||
    resource.description?.toLowerCase().includes(search.toLowerCase())
  );

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
              const sharedStudents = resource.resource_shares?.map(
                (s: any) => s.students ? `${s.students.first_name} ${s.students.last_name}` : ''
              ).filter(Boolean);

              return (
                <Card key={resource.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-muted shrink-0">
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{resource.title}</h3>
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
                      </div>

                      <ResourceDownloadButton
                        filePath={resource.file_path}
                        fileName={resource.file_name}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
