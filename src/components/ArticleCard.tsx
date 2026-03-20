import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Article } from '@/types/article';
import { formatDistanceToNow } from 'date-fns';

interface ArticleCardProps {
  article: Article;
  index?: number;
}

const ArticleCard = ({ article, index = 0 }: ArticleCardProps) => {
  const timeAgo = formatDistanceToNow(new Date(article.published_date), { addSuffix: true });

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      className="group relative flex flex-col bg-background p-4 sm:p-6 transition-all duration-300 shadow-card hover:shadow-card-hover z-0 hover:z-10"
    >
      {/* Thumbnail */}
      {article.image_url && (
        <div className="aspect-video overflow-hidden mb-4 rounded-lg">
          <img
            src={article.image_url}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>
      )}

      {/* Category + time */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link
          to={`/category/${article.category}`}
          className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary font-bold hover:underline"
        >
          {article.category}
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground shrink-0">
          {timeAgo}
        </span>
      </div>

      {/* Title */}
      <Link to={`/article/${article.id}`} className="block mb-3">
        <h2 className="text-base sm:text-lg font-bold leading-snug tracking-tightest text-foreground group-hover:text-primary transition-colors duration-200">
          {article.title}
        </h2>
      </Link>

      {/* Summary */}
      <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3 mb-5 flex-1">
        {article.summary}
      </p>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-border">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {article.source_name}
        </span>
      </div>
    </motion.article>
  );
};

export default ArticleCard;