// api/cron/generate-site.js
// Marks high-scoring articles as published so the dynamic sitemap and
// SSR article route pick them up. File-system writes are removed —
// Vercel serverless does not persist files between requests.

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DOMAIN = 'https://www.hiddenhistoryfacts.com';

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('\n=== PUBLISH JOB STARTED ===\n');

    // Fetch unpublished articles — lowered score threshold to 5.0
    // so articles aren't silently blocked. Raise it again if you want
    // stricter quality filtering.
    const { data: articles, error } = await supabaseAdmin
      .from('articles')
      .select('id, title, slug, category, published_date, score')
      .eq('is_published', false)
      .gt('score', 5.0)
      .order('published_date', { ascending: false })
      .limit(200);

    if (error) throw error;

    console.log(`Found ${articles.length} articles to publish`);

    if (articles.length === 0) {
      // Also log how many are blocked by score so you can diagnose
      const { count } = await supabaseAdmin
        .from('articles')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', false)
        .lte('score', 5.0);

      return res.status(200).json({
        success: true,
        message: 'No articles to publish',
        blockedByScore: count ?? 'unknown',
        timestamp: new Date().toISOString()
      });
    }

    // Mark all fetched articles as published in one batch
    const articleIds = articles.map(a => a.id);

    const { error: updateError } = await supabaseAdmin
      .from('articles')
      .update({ is_published: true })
      .in('id', articleIds);

    if (updateError) throw updateError;

    console.log(`Marked ${articleIds.length} articles as published`);

    // Build the list of URLs now live — useful for logging and
    // optionally submitting to IndexNow (see below)
    const liveUrls = articles.map(a => {
      const path = a.slug ? `/article/${a.slug}` : `/article/${a.id}`;
      return `${DOMAIN}${path}`;
    });

    console.log('Sample live URLs:');
    liveUrls.slice(0, 5).forEach(u => console.log(' ', u));

    // ── Optional: ping IndexNow so Bing/Yandex index immediately ──────────
    // Google doesn't use IndexNow, but Bing does and it's free.
    // Remove this block if you don't want it.
    try {
      if (process.env.INDEXNOW_KEY) {
        const indexNowRes = await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: 'www.hiddenhistoryfacts.com',
            key: process.env.INDEXNOW_KEY,
            keyLocation: `${DOMAIN}/${process.env.INDEXNOW_KEY}.txt`,
            urlList: liveUrls.slice(0, 10000),
          }),
        });
        console.log(`IndexNow ping: ${indexNowRes.status}`);
      }
    } catch (indexNowErr) {
      // Non-fatal — don't fail the whole job
      console.warn('IndexNow ping failed:', indexNowErr.message);
    }

    console.log('\n=== PUBLISH JOB COMPLETED ===\n');

    return res.status(200).json({
      success: true,
      articlesPublished: articleIds.length,
      sampleUrls: liveUrls.slice(0, 5),
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('\nPUBLISH JOB ERROR:', error.message);
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
