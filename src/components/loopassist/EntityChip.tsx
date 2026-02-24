import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { FileText, User, CalendarDays, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

type EntityType = 'invoice' | 'student' | 'lesson' | 'guardian';

interface EntityChipProps {
  type: EntityType;
  id: string;
  label: string;
  className?: string;
}

const chipConfig: Record<EntityType, { icon: typeof FileText; colorClass: string }> = {
  invoice: { icon: FileText, colorClass: 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50' },
  student: { icon: User, colorClass: 'bg-primary/10 text-primary hover:bg-primary/20' },
  lesson: { icon: CalendarDays, colorClass: 'bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:hover:bg-teal-900/50' },
  guardian: { icon: Users, colorClass: 'bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50' },
};

export function EntityChip({ type, id, label, className }: EntityChipProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    switch (type) {
      case 'invoice':
        navigate(`/invoices?search=${encodeURIComponent(id)}`);
        break;
      case 'student':
        navigate(`/students/${id}`);
        break;
      case 'lesson':
        // TODO: Pass lesson date through entity chip data-date attribute for date-aware navigation (/calendar?date=YYYY-MM-DD)
        navigate('/calendar');
        break;
      case 'guardian':
        // No specific guardian page; no-op
        break;
    }
  };

  const config = chipConfig[type];
  const Icon = config.icon;

  return (
    <Badge
      variant="secondary"
      className={cn(
        'cursor-pointer gap-1 border-0 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        config.colorClass,
        className
      )}
      onClick={handleClick}
      tabIndex={0}
      role="link"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

// HTML-escape to prevent XSS when injecting into rehype-raw spans
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Preprocess entity chip patterns into HTML spans for use with rehype-raw
// eslint-disable-next-line react-refresh/only-export-components
export function preprocessEntityChips(content: string): string {
  return content
    .replace(/\[Invoice:(LL-\d{4}-\d{5})\]/g, (_, num) => {
      const safe = escapeHtml(num);
      return `<span data-entity-type="invoice" data-entity-id="${safe}" data-entity-label="${safe}">${safe}</span>`;
    })
    .replace(/\[Student:([a-f0-9-]{36}):([^\]]+)\]/g, (_, id, name) => {
      const safe = escapeHtml(name);
      return `<span data-entity-type="student" data-entity-id="${id}" data-entity-label="${safe}">${safe}</span>`;
    })
    .replace(/\[Student:([a-f0-9-]{36})\](?!:)/g, (_, id) =>
      `<span data-entity-type="student" data-entity-id="${id}" data-entity-label="Student">Student</span>`
    )
    .replace(/\[Lesson:([a-f0-9-]{36}):([^\]]+)\]/g, (_, id, title) => {
      const safe = escapeHtml(title);
      return `<span data-entity-type="lesson" data-entity-id="${id}" data-entity-label="${safe}">${safe}</span>`;
    })
    .replace(/\[Lesson:([a-f0-9-]{36})\](?!:)/g, (_, id) =>
      `<span data-entity-type="lesson" data-entity-id="${id}" data-entity-label="Lesson">Lesson</span>`
    )
    .replace(/\[Guardian:([a-f0-9-]{36}):([^\]]+)\]/g, (_, id, name) => {
      const safe = escapeHtml(name);
      return `<span data-entity-type="guardian" data-entity-id="${id}" data-entity-label="${safe}">${safe}</span>`;
    })
    .replace(/\[Guardian:([a-f0-9-]{36})\](?!:)/g, (_, id) =>
      `<span data-entity-type="guardian" data-entity-id="${id}" data-entity-label="Guardian">Guardian</span>`
    );
}

// Parse message content and extract entity references
// eslint-disable-next-line react-refresh/only-export-components
export function parseEntityReferences(content: string): Array<{
  type: EntityType;
  id: string;
  label: string;
  fullMatch: string;
}> {
  const entities: Array<{
    type: EntityType;
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

  // Match [Student:uuid:Name] pattern (new format with name)
  const studentNamePattern = /\[Student:([a-f0-9-]{36}):([^\]]+)\]/g;
  while ((match = studentNamePattern.exec(content)) !== null) {
    entities.push({
      type: 'student',
      id: match[1],
      label: match[2],
      fullMatch: match[0],
    });
  }

  // Fallback: Match [Student:uuid] pattern (old format without name)
  const studentPattern = /\[Student:([a-f0-9-]{36})\](?!:)/g;
  while ((match = studentPattern.exec(content)) !== null) {
    // Skip if already captured by the name pattern
    const alreadyCaptured = entities.some(e => e.type === 'student' && e.id === match![1]);
    if (!alreadyCaptured) {
      entities.push({
        type: 'student',
        id: match[1],
        label: 'Student',
        fullMatch: match[0],
      });
    }
  }

  // Match [Lesson:uuid:Title] pattern
  const lessonNamePattern = /\[Lesson:([a-f0-9-]{36}):([^\]]+)\]/g;
  while ((match = lessonNamePattern.exec(content)) !== null) {
    entities.push({
      type: 'lesson',
      id: match[1],
      label: match[2],
      fullMatch: match[0],
    });
  }

  // Fallback: Match [Lesson:uuid] pattern
  const lessonPattern = /\[Lesson:([a-f0-9-]{36})\](?!:)/g;
  while ((match = lessonPattern.exec(content)) !== null) {
    const alreadyCaptured = entities.some(e => e.type === 'lesson' && e.id === match![1]);
    if (!alreadyCaptured) {
      entities.push({
        type: 'lesson',
        id: match[1],
        label: 'Lesson',
        fullMatch: match[0],
      });
    }
  }

  // Match [Guardian:uuid:Name] pattern
  const guardianNamePattern = /\[Guardian:([a-f0-9-]{36}):([^\]]+)\]/g;
  while ((match = guardianNamePattern.exec(content)) !== null) {
    entities.push({
      type: 'guardian',
      id: match[1],
      label: match[2],
      fullMatch: match[0],
    });
  }

  // Fallback: Match [Guardian:uuid] pattern
  const guardianPattern = /\[Guardian:([a-f0-9-]{36})\](?!:)/g;
  while ((match = guardianPattern.exec(content)) !== null) {
    const alreadyCaptured = entities.some(e => e.type === 'guardian' && e.id === match![1]);
    if (!alreadyCaptured) {
      entities.push({
        type: 'guardian',
        id: match[1],
        label: 'Guardian',
        fullMatch: match[0],
      });
    }
  }

  return entities;
}

// Render message content with entity chips inline
// eslint-disable-next-line react-refresh/only-export-components
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
