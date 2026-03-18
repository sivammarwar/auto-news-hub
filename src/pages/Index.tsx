import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import HeroSection from '@/components/HeroSection';
import ArticleCard from '@/components/ArticleCard';
import EmptyState from '@/components/EmptyState';
import { useArticles } from '@/hooks/useArticles';

const Index = () => {
  const { data: articles, isLoading } = useArticles();

  const heroArticle = articles?.[0];
  const gridArticles = articles?.slice(1) ?? [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {isLoading ? (
          <div className="py-32 text-center">
            <span className="text-meta animate-pulse">Loading articles...</span>
          </div>
        ) : !heroArticle ? (
          <EmptyState />
        ) : (
          <>
            <HeroSection article={heroArticle} />

            <section className="max-w-screen-xl mx-auto px-6 py-16">
              <div className="mb-8">
                <span className="text-meta text-foreground font-bold">Latest</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
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
