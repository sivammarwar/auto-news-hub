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
    <section className="py-12 sm:py-20 px-4 sm:px-6 border-b border-border">
      <div className="max-w-screen-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
            <Link
              to={`/category/${article.category}`}
              className="text-primary font-bold font-mono text-[11px] uppercase tracking-[0.15em] hover:underline"
            >
              {article.category}
            </Link>
            <span className="text-muted-foreground font-mono text-[11px] uppercase tracking-[0.1em]">
              {timeAgo}
            </span>
          </div>

          {/* Title — fluid size from mobile to desktop */}
          <Link to={`/article/${article.id}`}>
            <h1
              className="font-bold tracking-tightest leading-[0.92] text-foreground hover:text-primary transition-colors duration-300 mb-6 sm:mb-8"
              style={{
                fontSize: 'clamp(2rem, 6vw, 5rem)',
                textWrap: 'balance',
              } as React.CSSProperties}
            >
              {article.title}
            </h1>
          </Link>

          {/* Summary */}
          <p
            className="text-muted-foreground leading-relaxed mb-6 sm:mb-8 max-w-3xl"
            style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}
          >
            {article.summary}
          </p>

          {/* Hero image */}
          {article.image_url && (
            <div className="w-full mb-6 sm:mb-8 overflow-hidden rounded-xl">
              <img
                src={article.image_url}
                alt={article.title}
                className="w-full h-auto object-cover"
                style={{ maxHeight: '55vh' }}
                loading="eager"
              />
            </div>
          )}

          {/* Footer row */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link
              to={`/article/${article.id}`}
              className="inline-flex items-center font-mono text-sm font-bold border-b-2 border-foreground pb-0.5 hover:text-primary hover:border-primary transition-all"
            >
              READ MORE →
            </Link>
          </div>

        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;