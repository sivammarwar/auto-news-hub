// api/sitemap.xml.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DOMAIN = 'https://www.hiddenhistoryfacts.com';

const ALL_CATEGORIES = [
  'history',
  'ancient-civilizations',
  'medieval-feudal',
  'age-of-exploration',
  'revolutions-politics',
  'world-wars-conflicts',
  'colonial-imperial',
  'human-rights-movements',
  'science-technology',
  'religion-philosophy',
  'cultural-social',
  'economic-trade',
  'military-warfare',
  'regional-history',
  'archaeology-mysteries',
  'famous-figures',
  'beyond-human-limits',
  'historys-unsung-heroes',
];

export default async function handler(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, slug, published_date, updated_at')
      .eq('is_published', true)
      .order('published_date', { ascending: false })
      .limit(50000);

    if (error) throw error;

    const urls = [];

    // Homepage
    urls.push(makeUrl(`${DOMAIN}/`, 1.0, 'daily', today));

    // Category pages
    ALL_CATEGORIES.forEach(cat => {
      urls.push(makeUrl(`${DOMAIN}/category/${cat}`, 0.9, 'daily', today));
    });

    // Static pages
    urls.push(makeUrl(`${DOMAIN}/contact`, 0.5, 'monthly', today));
    urls.push(makeUrl(`${DOMAIN}/privacy`, 0.3, 'monthly', today));
    urls.push(makeUrl(`${DOMAIN}/terms`,   0.3, 'monthly', today));

    // Article pages
    if (articles && articles.length > 0) {
      articles.forEach(article => {
        const lastmod = new Date(article.updated_at || article.published_date)
          .toISOString().split('T')[0];
        const path = article.slug
          ? `/article/${article.slug}`
          : `/article/${article.id}`;
        urls.push(makeUrl(`${DOMAIN}${path}`, 0.8, 'weekly', lastmod));
      });
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset',
      '  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      '  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
      ...urls,
      '</urlset>',
    ].join('\n');

    console.log(`Sitemap: ${urls.length} URLs (${articles?.length ?? 0} articles)`);

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).send(xml);

  } catch (err) {
    console.error('Sitemap error:', err.message);
    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${DOMAIN}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`);
  }
}

function makeUrl(loc, priority, changefreq, lastmod) {
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority.toFixed(1)}</priority>`,
    '  </url>',
  ].join('\n');
}
