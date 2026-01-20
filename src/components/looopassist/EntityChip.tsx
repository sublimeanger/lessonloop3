import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { FileText, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EntityChipProps {
  type: 'invoice' | 'student';
  id: string;
  label: string;
  className?: string;
}

export function EntityChip({ type, id, label, className }: EntityChipProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (type === 'invoice') {
      // Invoice numbers are like LL-2026-00001, navigate by ID lookup or number
      navigate(`/invoices?search=${encodeURIComponent(label)}`);
    } else if (type === 'student') {
      navigate(`/students/${id}`);
    }
  };

  const Icon = type === 'invoice' ? FileText : User;

  return (
    <Badge
      variant="secondary"
      className={cn(
        'cursor-pointer gap-1 transition-colors hover:bg-primary hover:text-primary-foreground',
        className
      )}
      onClick={handleClick}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

// Parse message content and extract entity references
export function parseEntityReferences(content: string): Array<{
  type: 'invoice' | 'student';
  id: string;
  label: string;
  fullMatch: string;
}> {
  const entities: Array<{
    type: 'invoice' | 'student';
    id: string;
    label: string;
    fullMatch: string;
  }> = [];

  // Match [Invoice:LL-2026-XXXXX] pattern
  const invoicePattern = /\[Invoice:(LL-\d{4}-\d{5})\]/g;
  let match;
  while ((match = invoicePattern.exec(content)) !== null) {
    entities.push({
      type: 'invoice',
      id: match[1],
      label: match[1],
      fullMatch: match[0],
    });
  }

  // Match [Student:uuid] pattern
  const studentPattern = /\[Student:([a-f0-9-]{36})\]/g;
  while ((match = studentPattern.exec(content)) !== null) {
    entities.push({
      type: 'student',
      id: match[1],
      label: `Student`,
      fullMatch: match[0],
    });
  }

  return entities;
}

// Render message content with entity chips inline
export function renderMessageWithChips(content: string): React.ReactNode[] {
  const entities = parseEntityReferences(content);
  
  if (entities.length === 0) {
    return [content];
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Sort entities by their position in the content
  const sortedEntities = entities.map(e => ({
    ...e,
    index: content.indexOf(e.fullMatch),
  })).sort((a, b) => a.index - b.index);

  // Remove duplicates
  const seen = new Set<string>();
  const uniqueEntities = sortedEntities.filter(e => {
    const key = e.fullMatch;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  uniqueEntities.forEach((entity, i) => {
    const index = content.indexOf(entity.fullMatch, lastIndex);
    
    // Add text before the entity
    if (index > lastIndex) {
      parts.push(content.slice(lastIndex, index));
    }

    // Add the entity chip
    parts.push(
      <EntityChip
        key={`${entity.type}-${entity.id}-${i}`}
        type={entity.type}
        id={entity.id}
        label={entity.label}
        className="mx-0.5 inline-flex"
      />
    );

    lastIndex = index + entity.fullMatch.length;
  });

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}
