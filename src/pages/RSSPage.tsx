import { motion } from 'framer-motion';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

const RSS_FEEDS = [
  { label: 'All Articles',   url: '/feed.xml',             description: 'Every published article across all categories' },
  { label: 'Cricket',        url: '/feed/cricket.xml',     description: 'IPL, Tests, BCCI and cricket news' },
  { label: 'Bollywood',      url: '/feed/bollywood.xml',   description: 'Box office, OTT and Bollywood stories' },
  { label: 'Technology',     url: '/feed/technology.xml',  description: 'Startups, gadgets and tech news' },
  { label: 'Viral Today',    url: '/feed/viral.xml',       description: 'Trending stories and viral news' },
  { label: 'Business',       url: '/feed/business.xml',    description: 'Markets, economy and business' },
  { label: 'India',          url: '/feed/india.xml',       description: 'Politics, policy and national news' },
  { label: 'World',          url: '/feed/world.xml',       description: 'Global news affecting India' },
  { label: 'Health',         url: '/feed/health.xml',      description: 'Medicine, wellness and healthcare' },
  { label: 'Science',        url: '/feed/science.xml',     description: 'ISRO, discoveries and science' },
  { label: 'Hidden History', url: '/feed/history.xml',     description: 'Weekly deep-dive history pieces' },
];

const RSS_READERS = [
  { name: 'Feedly',       url: 'https://feedly.com',       desc: 'Most popular, great mobile app' },
  { name: 'Inoreader',    url: 'https://inoreader.com',    desc: 'Powerful filters and search' },
  { name: 'NewsBlur',     url: 'https://newsblur.com',     desc: 'Clean interface, free tier' },
  { name: 'Reeder',       url: 'https://reederapp.com',    desc: 'Best RSS reader for iOS and macOS' },
];

const RSSPage = () => {
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20"
        >
          {/* Header */}
          <div className="mb-10 pb-8 border-b border-border">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary font-bold mb-3">
              Subscribe
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tightest text-foreground mb-4">
              RSS Feeds
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-xl">
              Follow Signal in your favourite RSS reader. Get every new article delivered
              directly to you — no algorithm, no noise, no ads.
            </p>
          </div>

          {/* What is RSS */}
          <div className="mb-10 p-5 sm:p-6 bg-muted rounded-xl">
            <h2 className="font-bold text-base sm:text-lg text-foreground mb-2">
              What is RSS?
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              RSS (Really Simple Syndication) is an open standard that lets you subscribe to
              any website and read its content in one place — your RSS reader app. No email
              required. No account needed. You own your feed.
            </p>
          </div>

          {/* Main feed */}
          <div className="mb-10">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground mb-4 pb-2 border-b border-border">
              Main Feed
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:p-5 border border-border rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-sm mb-1">All Articles</p>
                <p className="font-mono text-[10px] sm:text-[11px] text-muted-foreground truncate">
                  {siteUrl}/feed.xml
                </p>
              </div>
              <a
                href="/feed.xml"
                className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-primary border border-primary rounded-lg px-4 py-2.5 hover:bg-primary hover:text-background transition-colors shrink-0"
              >
                <RSSIcon />
                Subscribe
              </a>
            </div>
          </div>

          {/* Category feeds */}
          <div className="mb-10">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground mb-4 pb-2 border-b border-border">
              Category Feeds
            </h2>
            <div className="space-y-2">
              {RSS_FEEDS.slice(1).map(feed => (
                <div
                  key={feed.url}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl hover:bg-muted transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground">{feed.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{feed.description}</p>
                  </div>
                  <a
                    href={feed.url}
                    className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary hover:underline shrink-0 self-start sm:self-center"
                  >
                    {siteUrl}{feed.url}
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* How to subscribe */}
          <div className="mb-10">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground mb-4 pb-2 border-b border-border">
              How to Subscribe
            </h2>
            <ol className="space-y-3 text-sm sm:text-base text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-mono font-bold text-primary shrink-0">01.</span>
                <span>Choose an RSS reader from the list below and create a free account.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono font-bold text-primary shrink-0">02.</span>
                <span>Copy the feed URL you want from the list above.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono font-bold text-primary shrink-0">03.</span>
                <span>In your RSS reader, click "Add feed" or "Subscribe" and paste the URL.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-mono font-bold text-primary shrink-0">04.</span>
                <span>New Signal articles will appear in your reader automatically.</span>
              </li>
            </ol>
          </div>

          {/* Recommended readers */}
          <div className="mb-10">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground mb-4 pb-2 border-b border-border">
              Recommended RSS Readers
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {RSS_READERS.map(reader => (
                <a
                  key={reader.name}
                  href={reader.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-1 p-4 border border-border rounded-xl hover:border-primary hover:bg-muted transition-colors group"
                >
                  <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    {reader.name} →
                  </span>
                  <span className="text-xs text-muted-foreground">{reader.desc}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="p-4 sm:p-5 bg-muted rounded-xl text-sm text-muted-foreground">
            Questions about our RSS feeds? Contact us at{' '}
            <a href="mailto:shivamkumarsingh8544@gmail.com" className="text-primary hover:underline">
              shivamkumarsingh8544@gmail.com
            </a>
          </div>

        </motion.div>
      </main>

      <SiteFooter />
    </div>
  );
};

const RSSIcon = () => (
  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19.01 7.38 20 6.18 20C4.98 20 4 19.01 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/>
  </svg>
);

export default RSSPage;