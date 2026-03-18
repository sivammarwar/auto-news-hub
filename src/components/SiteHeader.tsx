import { Link, useLocation } from 'react-router-dom';

const categories = [
  { label: 'All', path: '/' },
  { label: 'Cricket', path: '/category/cricket' },
  { label: 'Bollywood', path: '/category/bollywood' },
  { label: 'Technology', path: '/category/tech' },
  { label: 'Viral', path: '/category/viral' },
  { label: 'History', path: '/category/history' },
];

const SiteHeader = () => {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 bg-background shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
      <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-bold text-xl tracking-tightest text-foreground">
          SIGNAL
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {categories.map((cat) => (
            <Link
              key={cat.path}
              to={cat.path}
              className={`font-mono text-[11px] uppercase tracking-[0.15em] transition-colors hover:text-primary ${
                location.pathname === cat.path
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground'
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </nav>
        {/* Mobile nav */}
        <nav className="flex md:hidden items-center gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.path}
              to={cat.path}
              className={`font-mono text-[9px] uppercase tracking-[0.1em] transition-colors hover:text-primary ${
                location.pathname === cat.path
                  ? 'text-primary font-bold'
                  : 'text-muted-foreground'
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default SiteHeader;
