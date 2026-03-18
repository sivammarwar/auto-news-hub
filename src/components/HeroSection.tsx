import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Article } from '@/types/article';
import { formatDistanceToNow } from 'date-fns';

interface HeroSectionProps {
  article: Article;
}

const HeroSection = ({ article }: HeroSectionProps) => {
  const timeAgo = formatDistanceToNow(new Date(article.published_date), { addSuffix: true });

  return (
    <section className="py-20 px-6 border-b border-border">
      <div className="max-w-screen-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center gap-4 mb-4">
            <span className="text-meta text-primary font-bold">Top Story</span>
            <span className="text-meta">{timeAgo}</span>
          </div>

          <Link to={`/article/${article.id}`}>
            <h1 className="text-5xl md:text-8xl font-bold tracking-tightest leading-[0.9] text-foreground mb-8 hover:text-primary transition-colors duration-300" style={{ textWrap: 'balance' } as React.CSSProperties}>
              {article.title}
            </h1>
          </Link>

          <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed mb-8">
            {article.summary}
          </p>

          <div className="flex items-center gap-6">
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center font-mono text-sm font-bold border-b-2 border-foreground pb-1 hover:text-primary hover:border-primary transition-all"
            >
              READ FULL SOURCE →
            </a>
            <span className="text-meta">{article.source_name}</span>
            {article.score && (
              <span className="text-meta tabular-nums">AI {article.score.toFixed(1)}/10</span>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
