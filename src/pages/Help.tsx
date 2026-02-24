import { useState } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { HelpSearch } from '@/components/help/HelpSearch';
import { HelpCategoryCard, HelpCategorySidebar } from '@/components/help/HelpCategory';
import { HelpArticleView, HelpArticleListItem } from '@/components/help/HelpArticle';
import { 
  helpArticles, 
  searchArticles, 
  getArticlesByCategory, 
  categoryLabels,
  HelpCategory as HelpCategoryType,
  HelpArticle,
} from '@/components/help/helpArticles';
import { Button } from '@/components/ui/button';
import { Sparkles, MessageSquare, Mail, ExternalLink } from 'lucide-react';
import { useLoopAssistUI } from '@/contexts/LoopAssistContext';

export default function Help() {
  usePageMeta('Help | LessonLoop', 'Find answers and learn how to use LessonLoop');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<HelpCategoryType | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const { openDrawer } = useLoopAssistUI();

  // Determine which articles to show
  const getDisplayedArticles = () => {
    if (searchQuery) {
      return searchArticles(searchQuery);
    }
    if (selectedCategory) {
      return getArticlesByCategory(selectedCategory);
    }
    return [];
  };

  const displayedArticles = getDisplayedArticles();
  const categories = Object.keys(categoryLabels) as HelpCategoryType[];
  const showCategories = !searchQuery && !selectedCategory && !selectedArticle;
  const showArticleList = (searchQuery || selectedCategory) && !selectedArticle;

  return (
    <AppLayout>
      <PageHeader
        title="Help Centre"
        description="Find answers, learn features, and get the most out of LessonLoop"
      />

      <div className="max-w-6xl mx-auto">
        {/* Search Bar */}
        <div className="mb-8">
          <HelpSearch
            value={searchQuery}
            onChange={(v) => {
              setSearchQuery(v);
              setSelectedArticle(null);
            }}
            className="w-full md:max-w-xl"
          />
        </div>

        {/* Quick Help Banner */}
        {showCategories && (
          <div className="mb-8 p-6 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/10">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <h2 className="text-section-title mb-1">Need quick help?</h2>
                <p className="text-body text-muted-foreground">
                  Ask LoopAssist anything about scheduling, billing, or managing your lessons.
                </p>
              </div>
              <Button onClick={openDrawer} className="gap-2 shrink-0">
                <Sparkles className="h-4 w-4" />
                Ask LoopAssist
              </Button>
            </div>
          </div>
        )}

        {/* Selected Article View */}
        {selectedArticle && (
          <HelpArticleView 
            article={selectedArticle} 
            onBack={() => setSelectedArticle(null)} 
          />
        )}

        {/* Category Grid (Home View) */}
        {showCategories && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {categories.map((category) => (
              <HelpCategoryCard
                key={category}
                category={category}
                onClick={() => setSelectedCategory(category)}
              />
            ))}
          </div>
        )}

        {/* Article List with Sidebar */}
        {showArticleList && (
          <div className="flex gap-8">
            {/* Sidebar */}
            <div className="hidden lg:block w-56 shrink-0">
              <HelpCategorySidebar
                selectedCategory={selectedCategory}
                onSelectCategory={(cat) => {
                  setSelectedCategory(cat);
                  setSearchQuery('');
                }}
              />
            </div>

            {/* Articles */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-section-title">
                  {searchQuery
                    ? `Search results for "${searchQuery}"`
                    : selectedCategory
                      ? categoryLabels[selectedCategory].title
                      : 'All Articles'
                  }
                </h2>
                <span className="text-caption text-muted-foreground">
                  {displayedArticles.length} article{displayedArticles.length !== 1 ? 's' : ''}
                </span>
              </div>

              {displayedArticles.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/30">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-body-strong mb-1">
                    We couldn't find a match for that
                  </h3>
                  <p className="text-body text-muted-foreground mb-4 max-w-sm mx-auto">
                    Try different keywords, browse the categories below, or ask LoopAssist directly.
                  </p>
                  <div className="flex justify-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 sm:min-h-9"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory(null);
                      }}
                    >
                      Browse categories
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="min-h-11 sm:min-h-9 gap-2"
                      onClick={openDrawer}
                    >
                      <Sparkles className="h-4 w-4" />
                      Ask LoopAssist
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedArticles.map((article) => (
                    <HelpArticleListItem
                      key={article.id}
                      article={article}
                      onClick={() => setSelectedArticle(article)}
                      showCategory={!!searchQuery}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Still Need Help Footer */}
        {!selectedArticle && (
          <div className="mt-12 pt-8 border-t text-center">
            <h3 className="font-medium mb-2">Still need help?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Our support team is here to assist you with any questions.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9 gap-2" asChild>
                <a href="/contact" target="_blank">
                  <ExternalLink className="h-3 w-3" />
                  Contact Support
                </a>
              </Button>
              <Button variant="outline" size="sm" className="min-h-11 sm:min-h-9 gap-2" onClick={openDrawer}>
                <Sparkles className="h-4 w-4" />
                Ask LoopAssist
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
