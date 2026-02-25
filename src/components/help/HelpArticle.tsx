import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { HelpArticle as HelpArticleType, categoryLabels } from './helpArticles';


interface HelpArticleViewProps {
  article: HelpArticleType;
  onBack: () => void;
}

export function HelpArticleView({ article, onBack }: HelpArticleViewProps) {
  const categoryConfig = categoryLabels[article.category];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Badge variant="secondary">{categoryConfig.title}</Badge>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-2">{article.title}</h1>
        <p className="text-muted-foreground">{article.summary}</p>
      </div>

      <div className="prose prose-sm max-w-none dark:prose-invert">
        <MarkdownContent content={article.content} />
      </div>

      <div className="pt-6 border-t">
        <p className="text-sm text-muted-foreground mb-2">Was this helpful?</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Yes, thanks!
          </Button>
          <Button variant="outline" size="sm">
            No, I need more help
          </Button>
        </div>
      </div>
    </div>
  );
}

// Simple markdown-like renderer for help content
function MarkdownContent({ content }: { content: string }) {
  const lines = content.trim().split('\n');
  const elements: JSX.Element[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-3">
          {listItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  const flushTable = () => {
    if (tableRows.length > 1) {
      const headers = tableRows[0];
      const dataRows = tableRows.slice(2); // Skip header separator
      elements.push(
        <div key={`table-${elements.length}`} className="overflow-x-auto my-4">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium">{h.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, i) => (
                <tr key={i} className="border-b">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2">{cell.trim()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Table detection
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      const cells = trimmed.slice(1, -1).split('|');
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Headers
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={i} className="text-xl font-bold mt-6 mb-3 first:mt-0">
          {trimmed.slice(2)}
        </h1>
      );
    } else if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={i} className="text-lg font-semibold mt-5 mb-2">
          {trimmed.slice(3)}
        </h2>
      );
    } else if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={i} className="text-base font-semibold mt-4 mb-2">
          {trimmed.slice(4)}
        </h3>
      );
    }
    // List items
    else if (trimmed.startsWith('- ')) {
      inList = true;
      listItems.push(formatInlineText(trimmed.slice(2)));
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(trimmed)) {
      flushList();
      if (!inList) {
        elements.push(
          <ol key={`ol-start-${i}`} className="list-decimal list-inside space-y-1 my-3">
            {null}
          </ol>
        );
      }
      const match = trimmed.match(/^\d+\.\s(.+)$/);
      if (match) {
        listItems.push(match[1]);
      }
    }
    // Empty line
    else if (!trimmed) {
      flushList();
    }
    // Regular paragraph
    else if (trimmed && !trimmed.startsWith('#')) {
      flushList();
      elements.push(
        <p key={i} className="my-2 leading-relaxed">
          {formatInlineText(trimmed)}
        </p>
      );
    }
  }

  flushList();
  flushTable();

  return <>{elements}</>;
}

// Format inline markdown (bold, links, etc.)
function formatInlineText(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

interface HelpArticleListItemProps {
  article: HelpArticleType;
  onClick: () => void;
  showCategory?: boolean;
}

export function HelpArticleListItem({ article, onClick, showCategory }: HelpArticleListItemProps) {
  const categoryConfig = categoryLabels[article.category];

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-lg border hover:border-primary/20 hover:shadow-card transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium group-hover:text-primary transition-colors">
            {article.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {article.summary}
          </p>
          {showCategory && (
            <Badge variant="outline" className="mt-2 text-xs">
              {categoryConfig.title}
            </Badge>
          )}
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}
