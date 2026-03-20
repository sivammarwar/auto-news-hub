import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  { label: 'Cricket',        emoji: '🏏', path: '/category/cricket' },
  { label: 'Bollywood',      emoji: '🎬', path: '/category/bollywood' },
  { label: 'Technology',     emoji: '💻', path: '/category/technology' },
  { label: 'Viral Today',    emoji: '🔥', path: '/category/viral' },
  { label: 'Business',       emoji: '📈', path: '/category/business' },
  { label: 'Sports',         emoji: '🏆', path: '/category/sports' },
  { label: 'India',          emoji: '🇮🇳', path: '/category/india' },
  { label: 'World',          emoji: '🌍', path: '/category/world' },
  { label: 'Health',         emoji: '❤️',  path: '/category/health' },
  { label: 'Science',        emoji: '🚀', path: '/category/science' },
  { label: 'Hidden History', emoji: '📜', path: '/category/history' },
  { label: 'Stocks',         emoji: '📊', path: '/category/stocks' },
];

const SiteHeader = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location    = useLocation();

  useEffect(() => {
    setDropdownOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 bg-background shadow-[0_1px_0_0_rgba(0,0,0,0.08)]">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link
            to="/"
            className="font-bold text-xl tracking-tightest text-foreground hover:text-primary transition-colors shrink-0"
          >
            SIGNAL
          </Link>

          {/* ── Desktop nav ─────────────────────────────────────────── */}
          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/"
              className={`font-mono text-[11px] uppercase tracking-[0.15em] transition-colors hover:text-primary ${
                location.pathname === '/' ? 'text-primary font-bold' : 'text-muted-foreground'
              }`}
            >
              Home
            </Link>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                aria-expanded={dropdownOpen}
                className={`flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.15em] transition-colors hover:text-primary ${
                  dropdownOpen ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                Categories
                <svg
                  className={`w-3 h-3 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0,  scale: 1 }}
                    exit={{ opacity: 0,  y: -6,   scale: 0.97 }}
                    transition={{ duration: 0.14 }}
                    className="absolute right-0 mt-3 w-72 bg-background border border-border rounded-xl shadow-xl overflow-hidden"
                    role="menu"
                  >
                    <div className="p-2 grid grid-cols-2 gap-0.5">
                      {CATEGORIES.map(cat => (
                        <Link
                          key={cat.path}
                          to={cat.path}
                          role="menuitem"
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
                            location.pathname === cat.path
                              ? 'bg-muted text-primary font-bold'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <span className="text-sm shrink-0">{cat.emoji}</span>
                          {cat.label}
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </nav>

          {/* ── Mobile hamburger ────────────────────────────────────── */}
          <button
            className="md:hidden flex flex-col justify-center items-center gap-[5px] w-10 h-10 -mr-1 rounded-md hover:bg-muted transition-colors"
            onClick={() => setMobileOpen(v => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            <span className={`block w-5 h-[2px] bg-foreground transition-all duration-300 origin-center ${mobileOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <span className={`block w-5 h-[2px] bg-foreground transition-all duration-300 ${mobileOpen ? 'opacity-0 scale-x-0' : ''}`} />
            <span className={`block w-5 h-[2px] bg-foreground transition-all duration-300 origin-center ${mobileOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>

        </div>
      </header>

      {/* ── Mobile drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Dim backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              style={{ top: '3.5rem' }}
              onClick={() => setMobileOpen(false)}
            />

            {/* Slide-in drawer */}
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.24, ease: 'easeInOut' }}
              className="fixed top-14 right-0 bottom-0 z-50 w-[80vw] max-w-xs bg-background border-l border-border overflow-y-auto md:hidden"
            >
              <div className="p-4">
                {/* Home */}
                <Link
                  to="/"
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl mb-2 font-mono text-[11px] uppercase tracking-[0.1em] transition-colors ${
                    location.pathname === '/'
                      ? 'bg-muted text-primary font-bold'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span className="text-base">🏠</span> Home
                </Link>

                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground px-3 py-2">
                  Categories
                </p>

                {CATEGORIES.map((cat, i) => (
                  <motion.div
                    key={cat.path}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 + i * 0.025, duration: 0.18 }}
                  >
                    <Link
                      to={cat.path}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors ${
                        location.pathname === cat.path
                          ? 'bg-muted text-primary font-bold'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="text-lg w-6 text-center shrink-0">{cat.emoji}</span>
                      <span className="font-medium">{cat.label}</span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default SiteHeader;