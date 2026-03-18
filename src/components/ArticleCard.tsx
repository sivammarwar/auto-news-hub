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
      className="group relative flex flex-col bg-background p-6 transition-all duration-300 shadow-card hover:shadow-card-hover z-0 hover:z-10"
    >
      {article.image_url && (
        <div className="aspect-video overflow-hidden mb-4">
          <img
            src={article.image_url}
            alt={article.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="mb-4 flex items-center justify-between text-meta">
        <span className="text-primary font-bold">{article.category.toUpperCase()}</span>
        <span>{timeAgo}</span>
      </div>

      <Link to={`/article/${article.id}`}>
        <h2 className="text-xl font-bold leading-tight tracking-tightest text-foreground group-hover:text-primary transition-colors duration-200 mb-3">
          {article.title}
        </h2>
      </Link>

      <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3 mb-6">
        {article.summary}
      </p>

      <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
        <span className="text-meta">{article.source_name}</span>
        {article.score && (
          <span className="text-meta tabular-nums">
            AI {article.score.toFixed(1)}/10
          </span>
        )}
      </div>
    </motion.article>
  );
};

export default ArticleCard;
