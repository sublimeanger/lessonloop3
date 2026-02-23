import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** @deprecated breadcrumbs are no longer rendered */
  breadcrumbs?: unknown[];
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-page-title tracking-tight">{title}</h1>
          {description && (
            <p className="text-caption text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
