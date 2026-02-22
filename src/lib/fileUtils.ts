import { FileText, Image, Music, Video, File } from 'lucide-react';

export function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return Image;
  if (fileType.startsWith('audio/')) return Music;
  if (fileType.startsWith('video/')) return Video;
  if (fileType.includes('pdf') || fileType.includes('word')) return FileText;
  return File;
}

export function getFileTypeBadge(fileType: string): string {
  if (fileType.startsWith('image/')) return 'Image';
  if (fileType.startsWith('audio/')) return 'Audio';
  if (fileType.startsWith('video/')) return 'Video';
  if (fileType.includes('pdf')) return 'PDF';
  if (fileType.includes('word')) return 'Document';
  return 'File';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
