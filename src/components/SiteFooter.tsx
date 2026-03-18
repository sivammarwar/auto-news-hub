import { Link } from 'react-router-dom';

const SiteFooter = () => {
  return (
    <footer className="bg-background border-t border-border pt-20 pb-10 px-6">
      <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="font-mono text-[11px] leading-relaxed text-muted-foreground uppercase tracking-tighter">
          <p>© 2026 SIGNAL. All rights reserved.</p>
          <p className="mt-2 text-foreground">
            Powered by autonomous AI — no humans involved in content generation.
          </p>
        </div>
        <div className="flex gap-8 md:justify-end font-mono text-[11px] uppercase tracking-[0.15em]">
          <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">
            Terms
          </Link>
          <Link to="/rss" className="text-muted-foreground hover:text-primary transition-colors">
            RSS
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
