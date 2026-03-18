import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import ArticleCard from '@/components/ArticleCard';
import { useArticle, useRelatedArticles } from '@/hooks/useArticles';

const ArticlePage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: article, isLoading } = useArticle(id ?? '');
  const { data: related } = useRelatedArticles(article ?? null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-meta animate-pulse">Loading article...</span>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <h1 className="text-2xl font-bold tracking-tightest">Article not found</h1>
          <Link to="/" className="text-meta text-primary hover:underline">← Back to home</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const pubDate = format(new Date(article.published_date), 'MMMM d, yyyy · h:mm a');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto px-6 py-20"
        >
          <div className="flex items-center gap-4 mb-6">
            <Link
              to={`/category/${article.category}`}
              className="text-meta text-primary font-bold hover:underline"
            >
              {article.category.toUpperCase()}
            </Link>
            <span className="text-meta">{pubDate}</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tightest leading-[0.95] text-foreground mb-8" style={{ textWrap: 'balance' } as React.CSSProperties}>
            {article.title}
          </h1>

          {article.image_url && (
            <div className="aspect-video overflow-hidden mb-8">
              <img
                src={article.image_url}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="text-lg leading-relaxed text-foreground mb-12 max-w-[65ch]" style={{ textWrap: 'pretty' } as React.CSSProperties}>
            {article.summary}
          </div>

          {article.raw_content && (
            <div className="text-base leading-relaxed text-muted-foreground mb-12 max-w-[65ch]" style={{ textWrap: 'pretty' } as React.CSSProperties}>
              {article.raw_content}
            </div>
          )}

          <div className="border-t border-border pt-6 flex items-center justify-between flex-wrap gap-4">
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center font-mono text-sm font-bold border-b-2 border-foreground pb-1 hover:text-primary hover:border-primary transition-all"
            >
              READ FULL SOURCE →
            </a>
            <div className="flex items-center gap-4">
              <span className="text-meta">{article.source_name}</span>
              {article.score && (
                <span className="text-meta tabular-nums">AI Confidence: {article.score.toFixed(1)}/10</span>
              )}
            </div>
          </div>
        </motion.article>

        {related && related.length > 0 && (
          <section className="max-w-screen-xl mx-auto px-6 pb-20">
            <div className="border-t border-border pt-12 mb-8">
              <span className="text-meta text-foreground font-bold">Related Articles</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
              {related.map((a, i) => (
                <ArticleCard key={a.id} article={a} index={i} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default ArticlePage;
