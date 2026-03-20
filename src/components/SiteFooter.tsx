import { Link } from 'react-router-dom';

const FOOTER_CATEGORIES = [
  { label: 'Cricket',   path: '/category/cricket' },
  { label: 'Bollywood', path: '/category/bollywood' },
  { label: 'Tech',      path: '/category/technology' },
  { label: 'Viral',     path: '/category/viral' },
  { label: 'Business',  path: '/category/business' },
  { label: 'India',     path: '/category/india' },
  { label: 'World',     path: '/category/world' },
  { label: 'History',   path: '/category/history' },
];

const SiteFooter = () => {
  return (
    <footer className="bg-background border-t border-border pt-12 pb-8 px-4 sm:px-6">
      <div className="max-w-screen-xl mx-auto">

        {/* Top row — brand + category links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-10">

          {/* Brand */}
          <div>
            <Link
              to="/"
              className="font-bold text-xl tracking-tightest text-foreground hover:text-primary transition-colors"
            >
              SIGNAL
            </Link>
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted-foreground uppercase tracking-tighter max-w-xs">
              Cutting through the noise. Real stories, real perspectives, no fluff.
            </p>
          </div>

          {/* Category links — wrapping grid on mobile */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
              Sections
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {FOOTER_CATEGORIES.map(cat => (
                <Link
                  key={cat.path}
                  to={cat.path}
                  className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-primary transition-colors"
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom row — copyright + legal links */}
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-tighter">
            © 2026 Signal. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              to="/privacy"
              className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors"
            >
              Terms
            </Link>
            <Link
              to="/rss"
              className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors"
            >
              RSS
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default SiteFooter;