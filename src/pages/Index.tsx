import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import HeroSection from '@/components/HeroSection';
import ArticleCard from '@/components/ArticleCard';
import EmptyState from '@/components/EmptyState';
import { useArticles } from '@/hooks/useArticles';

const Index = () => {
  const { data: articles, isLoading } = useArticles();

  const heroArticle  = articles?.[0];
  const gridArticles = articles?.slice(1) ?? [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {isLoading ? (
          <div className="py-32 text-center">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
              Loading articles...
            </span>
          </div>
        ) : !heroArticle ? (
          <EmptyState />
        ) : (
          <>
            {/* Hero — top story */}
            <HeroSection article={heroArticle} />

            {/* Article grid */}
            <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
              <div className="mb-6 sm:mb-8">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Latest
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
                {gridArticles.map((article, i) => (
                  <ArticleCard key={article.id} article={article} index={i} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default Index;