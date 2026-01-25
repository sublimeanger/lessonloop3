import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Rocket, 
  Users, 
  Calendar, 
  Receipt, 
  Home, 
  Sparkles, 
  Settings, 
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import { HelpCategory as HelpCategoryType, categoryLabels, getArticlesByCategory } from './helpArticles';
import { cn } from '@/lib/utils';

const iconMap = {
  Rocket,
  Users,
  Calendar,
  Receipt,
  Home,
  Sparkles,
  Settings,
  HelpCircle,
};

interface HelpCategoryCardProps {
  category: HelpCategoryType;
  onClick: () => void;
  isActive?: boolean;
}

export function HelpCategoryCard({ category, onClick, isActive }: HelpCategoryCardProps) {
  const config = categoryLabels[category];
  const articles = getArticlesByCategory(category);
  const Icon = iconMap[config.icon as keyof typeof iconMap] || HelpCircle;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-elevated hover:border-primary/20',
        isActive && 'border-primary ring-2 ring-primary/10'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <Badge variant="secondary" className="text-xs">
            {articles.length} articles
          </Badge>
        </div>
        <CardTitle className="text-lg mt-3">{config.title}</CardTitle>
        <CardDescription className="text-sm">{config.description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center text-sm text-primary font-medium">
          View articles
          <ChevronRight className="h-4 w-4 ml-1" />
        </div>
      </CardContent>
    </Card>
  );
}

interface HelpCategorySidebarProps {
  selectedCategory: HelpCategoryType | null;
  onSelectCategory: (category: HelpCategoryType | null) => void;
}

export function HelpCategorySidebar({ selectedCategory, onSelectCategory }: HelpCategorySidebarProps) {
  const categories = Object.keys(categoryLabels) as HelpCategoryType[];

  return (
    <div className="space-y-1">
      <button
        onClick={() => onSelectCategory(null)}
        className={cn(
          'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
          selectedCategory === null
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        All Categories
      </button>
      {categories.map((category) => {
        const config = categoryLabels[category];
        const Icon = iconMap[config.icon as keyof typeof iconMap] || HelpCircle;
        const count = getArticlesByCategory(category).length;

        return (
          <button
            key={category}
            onClick={() => onSelectCategory(category)}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2',
              selectedCategory === category
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{config.title}</span>
            <span className="text-xs opacity-60">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
