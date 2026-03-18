// api/sitemap.xml.js
// Dynamic sitemap generator for Google indexing

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // Get your domain from Vercel environment or use fallback
    const domain = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'https://auto-news-hub.vercel.app'; // Replace with your actual domain

    console.log(`Generating sitemap for domain: ${domain}`);

    // Fetch all published articles
    const { data: articles, error } = await supabaseAdmin
      .from('articles')
      .select('id, updated_at, published_date')
      .eq('is_published', true)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Start XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add homepage
    xml += '  <url>\n';
    xml += `    <loc>${domain}/</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    xml += '    <priority>1.0</priority>\n';
    xml += '  </url>\n';

    // Add category pages
    const categories = ['cricket', 'bollywood', 'technology'];
    for (const category of categories) {
      xml += '  <url>\n';
      xml += `    <loc>${domain}/category/${category}</loc>\n`;
      xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
      xml += '    <priority>0.9</priority>\n';
      xml += '  </url>\n';
    }

    // Add article pages
    if (articles && articles.length > 0) {
      for (const article of articles) {
        const lastmod = new Date(article.updated_at || article.published_date)
          .toISOString()
          .split('T')[0];

        xml += '  <url>\n';
        xml += `    <loc>${domain}/article/${article.id}</loc>\n`;
        xml += `    <lastmod>${lastmod}</lastmod>\n`;
        xml += '    <priority>0.8</priority>\n';
        xml += '  </url>\n';
      }
    }

    // Close XML
    xml += '</urlset>';

    // Log stats
    console.log(`✓ Sitemap generated with ${(articles?.length || 0) + 4} URLs`);

    // Send as XML with proper headers
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.write(xml);
    res.end();

  } catch (error) {
    console.error('❌ Sitemap error:', error.message);
    
    // Return basic sitemap on error (so site doesn't break)
    const basicSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://auto-news-hub.vercel.app/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>1.0</priority>
  </url>
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.write(basicSitemap);
    res.end();
  }
}