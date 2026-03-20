// api/cron/cleanup-database.js
// Runs daily at 2AM UTC
// Deletes old unpublished drafts → keeps DB lean → never touches published articles

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const timestamp = new Date().toISOString();
  console.log(`\n=== CLEANUP STARTED at ${timestamp} ===\n`);

  try {
    // Delete draft articles older than 7 days that were never published
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    console.log(`Deleting drafts older than: ${cutoff}`);

    // First delete their associated images (foreign key constraint)
    const { data: oldDrafts } = await supabase
      .from('articles')
      .select('id')
      .eq('is_draft', true)
      .eq('is_published', false)
      .lt('created_at', cutoff);

    const oldIds = (oldDrafts || []).map(a => a.id);

    if (oldIds.length > 0) {
      // Delete images first
      await supabase.from('article_images').delete().in('article_id', oldIds);
      // Then delete articles
      const { error } = await supabase.from('articles').delete().in('id', oldIds);
      if (error) throw error;
    }

    console.log(`✅ Deleted ${oldIds.length} old draft articles + their images`);

    // Stats
    const [total, published, drafts, images] = await Promise.all([
      supabase.from('articles').select('id', { count: 'exact', head: true }),
      supabase.from('articles').select('id', { count: 'exact', head: true }).eq('is_published', true),
      supabase.from('articles').select('id', { count: 'exact', head: true }).eq('is_draft', true),
      supabase.from('article_images').select('id', { count: 'exact', head: true }),
    ]);

    const stats = {
      total_articles:     total.count     || 0,
      published_articles: published.count || 0,
      draft_articles:     drafts.count    || 0,
      total_images:       images.count    || 0,
    };

    console.log('\n📊 DB Stats:');
    Object.entries(stats).forEach(([k, v]) => console.log(`   ${k}: ${v}`));
    console.log('\n=== CLEANUP DONE ===\n');

    return res.status(200).json({
      success: true,
      deleted: oldIds.length,
      stats,
      timestamp,
      message: `Deleted ${oldIds.length} old drafts. ${stats.published_articles} published articles are safe.`,
    });

  } catch (e) {
    console.error('\n❌ CLEANUP ERROR:', e.message);
    return res.status(500).json({ error: e.message, timestamp });
  }
}