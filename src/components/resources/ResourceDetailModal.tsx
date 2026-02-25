import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { STALE_STABLE } from '@/config/query-stale-times';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Pencil,
  Check,
  X,
  Loader2,
  Users,
  Download,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { ResourceWithShares } from '@/hooks/useResources';
import { useUpdateResource, useRemoveResourceShare } from '@/hooks/useUpdateResource';
import { supabase } from '@/integrations/supabase/client';
import { getFileIcon, getFileTypeBadge, formatFileSize } from '@/lib/fileUtils';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/contexts/OrgContext';
import { ResourcePreviewModal, isPreviewable } from './ResourcePreviewModal';

interface ResourceDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: ResourceWithShares | null;
}

export function ResourceDetailModal({
  open,
  onOpenChange,
  resource,
}: ResourceDetailModalProps) {
  const { user } = useAuth();
  const { currentRole } = useOrg();
  const updateMutation = useUpdateResource();
  const removeShareMutation = useRemoveResourceShare();

  const canEdit =
    currentRole === 'owner' ||
    currentRole === 'admin' ||
    user?.id === resource?.uploaded_by;

  // Inline edit state
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (resource) {
      setTitleDraft(resource.title);
      setDescDraft(resource.description || '');
    }
    setEditingTitle(false);
    setEditingDesc(false);
  }, [resource]);

  // Fetch uploader profile
  const { data: uploaderProfile } = useQuery({
    queryKey: ['profile', resource?.uploaded_by],
    queryFn: async () => {
      if (!resource?.uploaded_by) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', resource.uploaded_by)
        .maybeSingle();
      return data;
    },
    enabled: !!resource?.uploaded_by && open,
    staleTime: STALE_STABLE,
  });

  // Fetch share details with student names
  const { data: sharesWithStudents = [] } = useQuery({
    queryKey: ['resource-shares-detail', resource?.id],
    queryFn: async () => {
      if (!resource?.id) return [];
      const { data, error } = await supabase
        .from('resource_shares')
        .select(`
          id,
          student_id,
          shared_at,
          shared_by,
          students:student_id (id, first_name, last_name)
        `)
        .eq('resource_id', resource.id);
      if (error) throw error;
      return data as Array<{
        id: string;
        student_id: string;
        shared_at: string;
        shared_by: string;
        students: { id: string; first_name: string; last_name: string } | null;
      }>;
    },
    enabled: !!resource?.id && open,
  });

  if (!resource) return null;

  const FileIcon = getFileIcon(resource.file_type);
  const canPreview = isPreviewable(resource.file_type) !== 'none';

  const handleSaveTitle = async () => {
    if (!titleDraft.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id: resource.id,
        title: titleDraft.trim(),
        description: resource.description,
      });
      setEditingTitle(false);
    } catch {
      // toast handled by hook
    }
  };

  const handleSaveDesc = async () => {
    try {
      await updateMutation.mutateAsync({
        id: resource.id,
        title: resource.title,
        description: descDraft.trim() || null,
      });
      setEditingDesc(false);
    } catch {
      // toast handled by hook
    }
  };

  const handleDownload = async () => {
    const { data } = await supabase.storage
      .from('teaching-resources')
      .createSignedUrl(resource.file_path, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const uploaderName =
    uploaderProfile?.full_name || uploaderProfile?.email || 'Unknown';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="h-screen w-screen max-w-none overflow-y-auto rounded-none border-0 p-4 sm:max-h-[85vh] sm:max-w-[550px] sm:rounded-lg sm:border sm:p-6 flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="sr-only">Resource Details</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 pr-1">
            {/* Title */}
            <div>
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    className="text-lg font-semibold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') {
                        setTitleDraft(resource.title);
                        setEditingTitle(false);
                      }
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={handleSaveTitle}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => {
                      setTitleDraft(resource.title);
                      setEditingTitle(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group/title">
                  <h2 className="text-lg font-semibold">{resource.title}</h2>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 opacity-100 transition-opacity sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover/title:opacity-100"
                      onClick={() => setEditingTitle(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Description
              </label>
              {editingDesc ? (
                <div className="mt-1 space-y-2">
                  <Textarea
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    rows={3}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setDescDraft(resource.description || '');
                        setEditingDesc(false);
                      }
                    }}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      size="sm"
                      className="min-h-11 sm:min-h-9"
                      onClick={handleSaveDesc}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending && (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      )}
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-11 sm:min-h-9"
                      onClick={() => {
                        setDescDraft(resource.description || '');
                        setEditingDesc(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-1 group/desc flex items-start gap-2">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {resource.description || 'No description'}
                  </p>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0 opacity-100 transition-opacity sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover/desc:opacity-100"
                      onClick={() => setEditingDesc(true)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* File metadata */}
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">
                  Type
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary" className="text-xs">
                    {getFileTypeBadge(resource.file_type)}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">
                  Size
                </span>
                <p className="mt-1">{formatFileSize(resource.file_size_bytes)}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">
                  File name
                </span>
                <p className="mt-1 truncate" title={resource.file_name}>
                  {resource.file_name}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">
                  Uploaded by
                </span>
                <p className="mt-1 truncate">{uploaderName}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">
                  Uploaded
                </span>
                <p className="mt-1">
                  {format(new Date(resource.created_at), 'dd MMM yyyy, HH:mm')}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">
                  Last modified
                </span>
                <p className="mt-1">
                  {format(new Date(resource.updated_at), 'dd MMM yyyy, HH:mm')}
                </p>
              </div>
            </div>

            <Separator />

            {/* Shared students */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Shared with ({sharesWithStudents.length})
                </span>
              </div>
              {sharesWithStudents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not shared with any students yet.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {sharesWithStudents.map((share) => (
                    <li
                      key={share.id}
                      className="flex items-center justify-between text-sm group/share"
                    >
                      <span>
                        {share.students
                          ? `${share.students.first_name} ${share.students.last_name}`
                          : 'Unknown student'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(share.shared_at), 'dd MMM yyyy')}
                        </span>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover/share:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            onClick={() =>
                              removeShareMutation.mutate({
                                resourceId: resource.id,
                                studentId: share.student_id,
                              })
                            }
                            disabled={removeShareMutation.isPending}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="shrink-0 flex justify-end gap-2 pt-3 border-t mt-2">
            {canPreview && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {previewOpen && resource && (
        <ResourcePreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          filePath={resource.file_path}
          fileName={resource.file_name}
          fileType={resource.file_type}
          title={resource.title}
        />
      )}
    </>
  );
}
