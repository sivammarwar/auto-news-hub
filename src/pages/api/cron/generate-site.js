// pages/api/cron/generate-site.js
// This cron job runs after fetch-news to generate static HTML and publish articles

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../../../public');

export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('\n=== STATIC SITE GENERATION STARTED ===\n');

    // 1. Get high-scoring published articles
    const { data: articles, error } = await supabaseAdmin
      .from('articles')
      .select('*')
      .eq('is_published', false)
      .gt('score', 6.0)
      .order('score', { ascending: false })
      .order('published_date', { ascending: false })
      .limit(100);

    if (error) throw error;

    console.log(`📄 Found ${articles.length} articles to publish`);

    if (articles.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No articles to publish',
        timestamp: new Date().toISOString()
      });
    }

    // 2. Generate HTML files
    console.log('🏗️  Generating HTML pages...');
    
    // Create articles directory if it doesn't exist
    const articlesDir = path.join(publicDir, 'articles');
    try {
      await fs.mkdir(articlesDir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }

    // Generate index.html
    const indexHtml = generateIndexHTML(articles.slice(0, 50));
    await fs.writeFile(path.join(publicDir, 'index.html'), indexHtml);
    console.log('   ✓ index.html');

    // Generate category pages
    const categories = [...new Set(articles.map(a => a.category))];
    for (const category of categories) {
      const categoryArticles = articles.filter(
        a => a.category === category
      ).slice(0, 30);
      
      const categoryHtml = generateCategoryHTML(category, categoryArticles);
      const categoryFile = path.join(publicDir, `category-${category}.html`);
      await fs.writeFile(categoryFile, categoryHtml);
      console.log(`   ✓ category-${category}.html`);
    }

    // Generate individual article pages
    let articleCount = 0;
    for (const article of articles.slice(0, 100)) {
      const articleHtml = generateArticleHTML(article);
      const articleFile = path.join(articlesDir, `${article.id}.html`);
      await fs.writeFile(articleFile, articleHtml);
      articleCount++;
      
      if (articleCount % 10 === 0) {
        console.log(`   ✓ Generated ${articleCount} article pages`);
      }
    }
    console.log(`   ✓ Total: ${articleCount} article pages`);

    // 3. Generate SEO files
    console.log('🔍 Generating SEO files...');
    
    const sitemap = generateSitemap(articles.slice(0, 100));
    await fs.writeFile(path.join(publicDir, 'sitemap.xml'), sitemap);
    console.log('   ✓ sitemap.xml');

    const rss = generateRSS(articles.slice(0, 50));
    await fs.writeFile(path.join(publicDir, 'feed.xml'), rss);
    console.log('   ✓ feed.xml');

    // 4. Mark articles as published
    console.log('📌 Marking articles as published...');
    const articleIds = articles.slice(0, 100).map(a => a.id);
    
    const { error: updateError } = await supabaseAdmin
      .from('articles')
      .update({ is_published: true })
      .in('id', articleIds);

    if (updateError) throw updateError;
    console.log(`   ✓ Marked ${articleIds.length} articles as published`);

    console.log('\n=== SITE GENERATION COMPLETED ===\n');

    return res.status(200).json({
      success: true,
      articlesPublished: articleIds.length,
      pagesGenerated: articleCount + 1 + categories.length,
      timestamp: new Date().toISOString(),
      message: `Generated site with ${articleIds.length} articles in ${articleCount + 1 + categories.length} pages`
    });

  } catch (error) {
    console.error('\n❌ GENERATION ERROR:', error.message);
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// ============================================================================
// HTML GENERATORS
// ============================================================================

function generateIndexHTML(articles) {
  if (!articles || articles.length === 0) {
    return generateErrorPage('No articles available');
  }

  const heroArticle = articles[0];
  const gridArticles = articles.slice(1, 13);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Latest news on cricket, bollywood, and technology">
  <title>News Hub - Latest Headlines</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff;
      color: #000000;
      line-height: 1.6;
    }
    header {
      background: #ffffff;
      border-bottom: 1px solid #e0e0e0;
      padding: 20px 0;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
    h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; }
    .nav { margin-top: 15px; display: flex; gap: 20px; }
    .nav a { color: #0066cc; text-decoration: none; font-size: 14px; font-weight: 500; }
    .nav a:hover { text-decoration: underline; }
    
    main { padding: 40px 0; }
    
    .hero {
      background: #f8f8f8;
      padding: 30px;
      margin-bottom: 40px;
      border-radius: 0;
    }
    .hero h2 { 
      font-size: 32px; 
      font-weight: 700; 
      margin-bottom: 15px; 
      line-height: 1.3;
    }
    .hero .meta { 
      color: #666;
      font-size: 13px;
      margin-bottom: 15px;
      display: flex;
      gap: 15px;
    }
    .hero p { 
      font-size: 16px;
      line-height: 1.6;
      color: #333;
      margin-bottom: 15px;
    }
    .hero a { color: #0066cc; text-decoration: none; font-weight: 500; }
    .hero a:hover { text-decoration: underline; }
    
    .section-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 25px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 30px;
      margin-bottom: 50px;
    }
    
    .card {
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 20px;
    }
    
    .card h3 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 10px;
      line-height: 1.4;
    }
    
    .card a { color: #0066cc; text-decoration: none; }
    .card a:hover { text-decoration: underline; }
    
    .card .meta {
      color: #666;
      font-size: 12px;
      margin-bottom: 10px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    
    .card .score {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 600;
    }
    
    .card p {
      font-size: 14px;
      color: #555;
      line-height: 1.5;
      margin-bottom: 10px;
      flex-grow: 1;
    }
    
    .card .source {
      background: #f0f0f0;
      padding: 3px 8px;
      border-radius: 3px;
      font-weight: 500;
      font-size: 11px;
    }
    
    footer {
      background: #f9f9f9;
      border-top: 1px solid #e0e0e0;
      padding: 30px 0;
      margin-top: 50px;
      font-size: 13px;
      color: #666;
    }
    
    footer a { color: #0066cc; text-decoration: none; }
    footer a:hover { text-decoration: underline; }
    
    .footer-links { margin-bottom: 15px; }
    .footer-links a { margin-right: 20px; }
    
    .powered { margin-top: 15px; font-size: 12px; color: #999; }
    
    @media (max-width: 768px) {
      h1 { font-size: 22px; }
      .grid { grid-template-columns: 1fr; }
      .hero h2 { font-size: 24px; }
      .nav { flex-direction: column; gap: 10px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>📰 News Hub</h1>
      <nav class="nav">
        <a href="/">Home</a>
        <a href="/category-cricket.html">Cricket</a>
        <a href="/category-bollywood.html">Bollywood</a>
        <a href="/category-technology.html">Technology</a>
        <a href="/feed.xml">RSS</a>
      </nav>
    </div>
  </header>

  <main class="container">
    ${heroArticle ? `
    <section class="hero">
      <h2><a href="/articles/${heroArticle.id}.html">${escapeHtml(heroArticle.title)}</a></h2>
      <div class="meta">
        <span class="source">${escapeHtml(heroArticle.source_name)}</span>
        <span>${formatDate(heroArticle.published_date)}</span>
        ${heroArticle.score ? `<span class="score">⭐ ${heroArticle.score.toFixed(1)}</span>` : ''}
      </div>
      <p>${escapeHtml(heroArticle.summary.substring(0, 300))}${heroArticle.summary.length > 300 ? '...' : ''}</p>
      <p><a href="/articles/${heroArticle.id}.html">Read full article →</a></p>
    </section>
    ` : ''}

    <h2 class="section-title">Latest News</h2>
    <div class="grid">
      ${gridArticles.map(article => `
        <div class="card">
          <h3><a href="/articles/${article.id}.html">${escapeHtml(article.title)}</a></h3>
          <div class="meta">
            <span class="source">${escapeHtml(article.source_name)}</span>
            <span>${formatDate(article.published_date)}</span>
            ${article.score ? `<span class="score">⭐ ${article.score.toFixed(1)}</span>` : ''}
          </div>
          <p>${escapeHtml(article.summary.substring(0, 200))}...</p>
          <p><a href="/articles/${article.id}.html">Read more →</a></p>
        </div>
      `).join('')}
    </div>
  </main>

  <footer>
    <div class="container">
      <div class="footer-links">
        <a href="/">Home</a>
        <a href="/feed.xml">RSS Feed</a>
        <a href="/sitemap.xml">Sitemap</a>
      </div>
      <p>© 2026 News Hub. All rights reserved.</p>
      <p class="powered">Powered by autonomous AI — no human involvement in content generation.</p>
    </div>
  </footer>
</body>
</html>`;
}

function generateCategoryHTML(category, articles) {
  const categoryTitles = {
    cricket: '🏏 Cricket News',
    bollywood: '🎬 Bollywood News',
    technology: '💻 Technology News'
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(categoryTitles[category])} - News Hub</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #ffffff;
      color: #000000;
    }
    header { background: #fff; border-bottom: 1px solid #e0e0e0; padding: 20px 0; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 10px; }
    .breadcrumb { color: #666; font-size: 14px; margin-bottom: 30px; }
    .breadcrumb a { color: #0066cc; text-decoration: none; }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 30px;
      margin-bottom: 50px;
    }
    
    .card {
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 20px;
    }
    
    .card h3 { font-size: 18px; font-weight: 600; margin-bottom: 10px; line-height: 1.4; }
    .card a { color: #0066cc; text-decoration: none; }
    .card a:hover { text-decoration: underline; }
    .card .meta { color: #666; font-size: 12px; margin-bottom: 10px; }
    .card p { font-size: 14px; color: #555; line-height: 1.5; margin-bottom: 10px; }
    
    footer { background: #f9f9f9; border-top: 1px solid #e0e0e0; padding: 30px 0; margin-top: 50px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <h1>${escapeHtml(categoryTitles[category])}</h1>
      <div class="breadcrumb"><a href="/">Home</a> / ${escapeHtml(categoryTitles[category])}</div>
    </div>
  </header>

  <main class="container">
    <div class="grid">
      ${articles.map(article => `
        <div class="card">
          <h3><a href="/articles/${article.id}.html">${escapeHtml(article.title)}</a></h3>
          <div class="meta">
            <strong>${escapeHtml(article.source_name)}</strong> • ${formatDate(article.published_date)}
            ${article.score ? ` • ⭐ ${article.score.toFixed(1)}` : ''}
          </div>
          <p>${escapeHtml(article.summary.substring(0, 200))}...</p>
          <p><a href="/articles/${article.id}.html">Read more →</a></p>
        </div>
      `).join('')}
    </div>
  </main>

  <footer>
    <div class="container">
      <p>© 2026 News Hub. All rights reserved.</p>
      <p>Powered by autonomous AI — no human involvement in content generation.</p>
    </div>
  </footer>
</body>
</html>`;
}

function generateArticleHTML(article) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapeHtml(article.summary.substring(0, 160))}">
  <title>${escapeHtml(article.title)} - News Hub</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #ffffff;
      color: #000000;
      line-height: 1.8;
    }
    header { background: #fff; border-bottom: 1px solid #e0e0e0; padding: 20px 0; }
    .container { max-width: 800px; margin: 0 auto; padding: 0 20px; }
    .back { color: #0066cc; text-decoration: none; font-weight: 500; margin-bottom: 30px; display: inline-block; }
    .back:hover { text-decoration: underline; }
    
    h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 15px;
      line-height: 1.3;
    }
    
    .meta {
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    
    .meta strong { color: #0066cc; }
    
    .content {
      font-size: 16px;
      line-height: 1.8;
      color: #333;
      margin-bottom: 40px;
    }
    
    .source-box {
      background: #f0f0f0;
      padding: 20px;
      margin: 30px 0;
      border-left: 3px solid #0066cc;
    }
    
    .source-box p { margin-bottom: 10px; }
    .source-box a { color: #0066cc; text-decoration: none; word-break: break-all; }
    .source-box a:hover { text-decoration: underline; }
    
    footer { background: #f9f9f9; border-top: 1px solid #e0e0e0; padding: 30px 0; margin-top: 50px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <header>
    <div class="container">
      <a class="back" href="/">← Back to News</a>
    </div>
  </header>

  <main class="container">
    <h1>${escapeHtml(article.title)}</h1>
    <div class="meta">
      <div><strong>${escapeHtml(article.source_name)}</strong></div>
      <div>${formatDate(article.published_date)}</div>
      ${article.score ? `<div>Score: ${article.score.toFixed(1)}/10</div>` : ''}
    </div>
    
    <div class="content">${escapeHtml(article.summary)}</div>
    
    <div class="source-box">
      <p><strong>Read the original article:</strong></p>
      <p><a href="${escapeHtml(article.source_url)}" target="_blank" rel="noopener">${escapeHtml(article.source_url.substring(0, 80))}...</a></p>
    </div>
  </main>

  <footer>
    <div class="container">
      <p>© 2026 News Hub. All rights reserved.</p>
      <p>Powered by autonomous AI — no human involvement in content generation.</p>
    </div>
  </footer>
</body>
</html>`;
}

function generateSitemap(articles) {
  const urls = [
    '<url><loc>https://yourdomain.com/</loc><priority>1.0</priority><changefreq>daily</changefreq></url>',
    '<url><loc>https://yourdomain.com/category-cricket.html</loc><priority>0.9</priority><changefreq>daily</changefreq></url>',
    '<url><loc>https://yourdomain.com/category-bollywood.html</loc><priority>0.9</priority><changefreq>daily</changefreq></url>',
    '<url><loc>https://yourdomain.com/category-technology.html</loc><priority>0.9</priority><changefreq>daily</changefreq></url>',
    ...articles.map(a => 
      `<url><loc>https://yourdomain.com/articles/${a.id}.html</loc><lastmod>${new Date(a.published_date).toISOString().split('T')[0]}</lastmod><priority>0.8</priority></url>`
    )
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

function generateRSS(articles) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>News Hub</title>
    <link>https://yourdomain.com</link>
    <description>AI-powered news aggregator with latest headlines</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${articles.map(a => `
    <item>
      <title>${escapeHtml(a.title)}</title>
      <link>https://yourdomain.com/articles/${a.id}.html</link>
      <pubDate>${new Date(a.published_date).toUTCString()}</pubDate>
      <description>${escapeHtml(a.summary)}</description>
      <source>${escapeHtml(a.source_name)}</source>
      <category>${escapeHtml(a.category)}</category>
    </item>
    `).join('')}
  </channel>
</rss>`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today at ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

function generateErrorPage(message) {
  return `<!DOCTYPE html>
<html>
<head><title>News Hub</title></head>
<body>
  <h1>News Hub</h1>
  <p>${escapeHtml(message)}</p>
</body>
</html>`;
}