import { motion } from 'framer-motion';

interface EmptyStateProps {
  title?: string;
  message?: string;
}

const EmptyState = ({ 
  title = "No articles yet",
  message = "The autonomous pipeline hasn't published any articles yet. Content will appear here once the AI begins processing."
}: EmptyStateProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="py-32 px-6 text-center"
    >
      <h2 className="text-2xl font-bold tracking-tightest text-foreground mb-4">{title}</h2>
      <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">{message}</p>
      <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Pipeline status: awaiting first run
      </div>
    </motion.div>
  );
};

export default EmptyState;
