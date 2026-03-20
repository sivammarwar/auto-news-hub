// api/sitemap.xml.js
// ════════════════════════════════════════════════════════════════════════════
// DYNAMIC SITEMAP GENERATOR
//
// Accessed at: https://yourdomain.com/sitemap.xml
// Submit THIS URL once to Google Search Console — never update again.
// Google re-crawls it automatically. As articles grow from 60 to 600+,
// the sitemap always reflects the current state of your database.
//
// Google sitemap limits: 50,000 URLs and 50MB per file.
// At 60 articles/day you'd hit that in ~2 years — split into sitemap index then.
// ════════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL  || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALL_CATEGORIES = [
  'cricket', 'bollywood', 'technology', 'viral',
  'business', 'sports', 'india', 'world', 'health', 'science', 'history', 'stocks',
];

// Change frequency hints for Google
const FREQ = {
  home:     'hourly',
  category: 'daily',
  article:  'weekly',   // articles don't change after publish
  legal:    'monthly',
};

export default async function handler(req, res) {
  try {
    // ── Determine canonical domain ────────────────────────────────────────
    // Priority: SITE_URL env var → request host → fallback
    // Set SITE_URL=https://yourdomain.com in Vercel environment variables
    const domain = process.env.SITE_URL
      || (req.headers.host ? `https://${req.headers.host}` : null)
      || 'https://yourdomain.com'; // ← replace with your actual domain

    console.log(`Generating sitemap for: ${domain}`);
    const today = new Date().toISOString().split('T')[0];

    // ── Fetch all published articles from DB ─────────────────────────────
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, category, published_date, updated_at')
      .eq('is_published', true)
      .order('published_date', { ascending: false })
      .limit(50000); // Google's sitemap limit

    if (error) throw error;

    const articleCount = articles?.length ?? 0;
    console.log(`Found ${articleCount} published articles`);

    // ── Build XML ─────────────────────────────────────────────────────────
    const urls: string[] = [];

    // 1. Homepage
    urls.push(url(domain, '/', 1.0, FREQ.home, today));

    // 2. All category pages
    ALL_CATEGORIES.forEach(cat => {
      urls.push(url(domain, `/category/${cat}`, 0.9, FREQ.category, today));
    });

    // 3. Legal + utility pages
    urls.push(url(domain, '/contact', 0.5, FREQ.legal, today));
    urls.push(url(domain, '/privacy', 0.3, FREQ.legal, today));
    urls.push(url(domain, '/terms',   0.3, FREQ.legal, today));

    // 4. All published article pages
    if (articles && articles.length > 0) {
      articles.forEach(article => {
        const lastmod = new Date(article.updated_at || article.published_date)
          .toISOString()
          .split('T')[0];
        urls.push(url(domain, `/article/${article.id}`, 0.8, FREQ.article, lastmod));
      });
    }

    // ── Assemble final XML ────────────────────────────────────────────────
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset',
      '  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      '  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"',
      '  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
      ...urls,
      '</urlset>',
    ].join('\n');

    console.log(`✓ Sitemap generated — ${urls.length} URLs total (${articleCount} articles)`);

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600'); // 1 hour cache
    res.setHeader('X-Sitemap-Count', String(urls.length));
    res.status(200).send(xml);

  } catch (err) {
    console.error('❌ Sitemap error:', err.message);
    // Return minimal valid sitemap so Google never gets a hard error
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(minimalSitemap());
  }
}

// ─── Helper: build a single <url> block ───────────────────────────────────────
function url(domain, path, priority, changefreq, lastmod) {
  return [
    '  <url>',
    `    <loc>${domain}${path}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority.toFixed(1)}</priority>`,
    '  </url>',
  ].join('\n');
}

// ─── Fallback minimal sitemap ─────────────────────────────────────────────────
function minimalSitemap() {
  const today = new Date().toISOString().split('T')[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${process.env.SITE_URL || 'https://yourdomain.com'}/</loc>
    <lastmod>${today}</lastmod>
    <priority>1.0</priority>
  </url>
</urlset>`;
}