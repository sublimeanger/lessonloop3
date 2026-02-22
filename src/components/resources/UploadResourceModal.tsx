import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, File, X, Loader2, HardDrive } from 'lucide-react';
import { useUploadResource, useStorageUsage } from '@/hooks/useResources';
import { MAX_FILE_SIZE, ALLOWED_TYPES } from '@/lib/resource-validation';
import { formatFileSize } from '@/lib/fileUtils';
import { formatStorageSize } from '@/lib/pricing-config';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FileEntry {
  file: File;
  title: string;
}

interface UploadResourceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadResourceModal({ open, onOpenChange }: UploadResourceModalProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [description, setDescription] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadIndex, setUploadIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadResource();
  const { totalBytes, limitBytes, percentUsed, isLoading: quotaLoading } = useStorageUsage();

  const totalSelectedSize = files.reduce((sum, f) => sum + f.file.size, 0);
  const quotaExceeded = totalBytes + totalSelectedSize > limitBytes;
  const isUploading = uploadIndex !== null;

  const addFiles = (newFiles: FileList | File[]) => {
    setError(null);
    const entries: FileEntry[] = [];
    const errors: string[] = [];

    Array.from(newFiles).forEach((f) => {
      if (!(ALLOWED_TYPES as readonly string[]).includes(f.type)) {
        errors.push(`${f.name}: unsupported type`);
        return;
      }
      if (f.size > MAX_FILE_SIZE) {
        errors.push(`${f.name}: exceeds 50MB`);
        return;
      }
      entries.push({
        file: f,
        title: f.name.replace(/\.[^/.]+$/, ''),
      });
    });

    if (errors.length) {
      setError(errors.join('. '));
    }
    if (entries.length) {
      setFiles((prev) => [...prev, ...entries]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTitle = (index: number, title: string) => {
    setFiles((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, title } : entry))
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    const desc = description.trim() || undefined;

    for (let i = 0; i < files.length; i++) {
      setUploadIndex(i);
      try {
        await uploadMutation.mutateAsync({
          file: files[i].file,
          title: files[i].title.trim() || files[i].file.name,
          description: desc,
        });
      } catch {
        // Hook's onError shows a toast — stop batch on failure
        setUploadIndex(null);
        return;
      }
    }

    setUploadIndex(null);
    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setFiles([]);
    setDescription('');
    setError(null);
    setUploadIndex(null);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && !isUploading) {
      resetForm();
    }
    if (!isUploading) {
      onOpenChange(isOpen);
    }
  };

  const allTitlesValid = files.every((f) => f.title.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Upload Resources</DialogTitle>
          <DialogDescription>
            Upload teaching materials to share with students. You can select multiple files.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Storage quota bar */}
          {!quotaLoading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <HardDrive className="h-3 w-3" />
                  Using {formatStorageSize(totalBytes)} of {formatStorageSize(limitBytes)}
                </span>
                <span>{percentUsed}%</span>
              </div>
              <Progress value={percentUsed} className="h-1.5" />
              {quotaExceeded && (
                <p className="text-xs text-destructive">
                  Storage quota exceeded. Delete unused resources or upgrade your plan.
                </p>
              )}
            </div>
          )}

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-1">
              Drag and drop files here, or
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              aria-describedby="file-format-hint"
            >
              Browse files
            </Button>
            <p id="file-format-hint" className="text-xs text-muted-foreground mt-2">
              PDF, images, audio, video, Word docs up to 50MB each
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept={ALLOWED_TYPES.join(',')}
              onChange={(e) => {
                if (e.target.files?.length) {
                  addFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              <Label>Files ({files.length})</Label>
              <ScrollArea className={files.length > 4 ? 'h-[200px]' : ''}>
                <div className="space-y-2 pr-2">
                  {files.map((entry, index) => (
                    <div
                      key={`${entry.file.name}-${index}`}
                      className={`flex items-center gap-2 rounded-md border p-2 ${
                        isUploading && uploadIndex === index ? 'border-primary bg-primary/5' : ''
                      } ${isUploading && uploadIndex !== null && index < uploadIndex ? 'opacity-50' : ''}`}
                    >
                      <File className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <Input
                          value={entry.title}
                          onChange={(e) => updateTitle(index, e.target.value)}
                          className="h-7 text-sm"
                          disabled={isUploading}
                          placeholder="Title"
                          required
                        />
                        <p className="text-xs text-muted-foreground truncate">
                          {entry.file.name} · {formatFileSize(entry.file.size)}
                        </p>
                      </div>
                      {!isUploading && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional, applies to all)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the resource(s)..."
              rows={2}
              disabled={isUploading}
            />
          </div>

          {isUploading && (
            <div className="space-y-1.5">
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((uploadIndex! + 1) / files.length) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Uploading {uploadIndex! + 1} of {files.length}…
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={files.length === 0 || !allTitlesValid || isUploading || quotaExceeded}
            >
              {isUploading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Upload {files.length > 1 ? `${files.length} files` : files.length === 1 ? '1 file' : ''}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
