import { useParams } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import ArticleCard from '@/components/ArticleCard';
import EmptyState from '@/components/EmptyState';
import { useArticles } from '@/hooks/useArticles';

const categoryNames = {
  cricket: 'Cricket',
  bollywood: 'Bollywood',
  tech: 'Technology',
  viral: 'Viral Today',      // add this
  history: 'Hidden History', // add this
};

const CategoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: articles, isLoading } = useArticles(slug);

  const name = categoryNames[slug ?? ''] ?? slug ?? '';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        <section className="py-16 px-6 border-b border-border">
          <div className="max-w-screen-xl mx-auto">
            <span className="text-meta text-primary font-bold mb-2 block">Category</span>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tightest text-foreground">
              {name}
            </h1>
          </div>
        </section>

        <section className="max-w-screen-xl mx-auto px-6 py-16">
          {isLoading ? (
            <div className="py-16 text-center">
              <span className="text-meta animate-pulse">Loading...</span>
            </div>
          ) : !articles?.length ? (
            <EmptyState
              title={`No ${name} articles`}
              message={`No published articles in the ${name} category yet.`}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0">
              {articles.map((article, i) => (
                <ArticleCard key={article.id} article={article} index={i} />
              ))}
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
};

export default CategoryPage;
