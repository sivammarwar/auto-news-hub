// api/cron/cleanup-database.js
// Cleanup job that deletes old unpublished draft articles to save storage

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Verify this is a valid cron request
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const timestamp = new Date().toISOString();
    console.log(`\n=== DATABASE CLEANUP STARTED at ${timestamp} ===\n`);

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`🧹 Deleting draft articles older than 7 days...`);
    console.log(`   Cutoff date: ${sevenDaysAgo}`);

    // Delete draft articles older than 7 days
    const { error: deleteError, count } = await supabaseAdmin
      .from('articles')
      .delete()
      .eq('is_draft', true)           // Only drafts
      .eq('is_published', false)      // Extra safety check
      .lt('created_at', sevenDaysAgo); // Older than 7 days

    if (deleteError) throw deleteError;

    console.log(`   ✓ Deleted ${count || 0} old draft articles`);

    // Get statistics
    console.log(`\n📊 Database Statistics:`);

    // Count remaining articles
    const { count: totalArticles } = await supabaseAdmin
      .from('articles')
      .select('id', { count: 'exact', head: true });

    const { count: publishedCount } = await supabaseAdmin
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true);

    const { count: draftCount } = await supabaseAdmin
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('is_draft', true);

    const { count: imageCount } = await supabaseAdmin
      .from('article_images')
      .select('id', { count: 'exact', head: true });

    console.log(`   📝 Total articles: ${totalArticles || 0}`);
    console.log(`   ✅ Published articles: ${publishedCount || 0}`);
    console.log(`   ⏳ Draft articles: ${draftCount || 0}`);
    console.log(`   🖼️  Total images: ${imageCount || 0}`);

    console.log(`\n=== CLEANUP COMPLETED ===`);
    console.log(`Deleted: ${count || 0} old draft articles`);
    console.log(`Remaining: ${totalArticles || 0} total articles`);
    console.log(`Protected: ${publishedCount || 0} published articles (safe!) ✅\n`);

    return res.status(200).json({
      success: true,
      timestamp: timestamp,
      deleted: count || 0,
      message: `Cleanup completed. Deleted ${count || 0} old draft articles. Published articles are protected.`,
      stats: {
        total_articles: totalArticles,
        published_articles: publishedCount,
        draft_articles: draftCount,
        total_images: imageCount
      }
    });

  } catch (error) {
    console.error('\n❌ CLEANUP ERROR:', error.message);
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}