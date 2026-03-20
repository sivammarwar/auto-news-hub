import { motion } from 'framer-motion';

interface EmptyStateProps {
  title?: string;
  message?: string;
}

const EmptyState = ({
  title   = 'No articles yet',
  message = 'Fresh stories are on their way. Check back soon.',
}: EmptyStateProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="py-24 sm:py-32 px-6 text-center"
    >
      <div className="text-5xl mb-6">📭</div>
      <h2 className="text-xl sm:text-2xl font-bold tracking-tightest text-foreground mb-3">
        {title}
      </h2>
      <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed text-sm sm:text-base">
        {message}
      </p>
    </motion.div>
  );
};

export default EmptyState;