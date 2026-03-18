import { supabase } from '@/integrations/supabase/client';

// For backend operations, use service role key
export const createSupabaseAdmin = () => {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
};

export const deduplicateArticles = async (articles) => {
  if (articles.length === 0) return articles;

  const urls = articles.map(a => a.sourceUrl);
  
  const { data: existing, error } = await supabase
    .from('articles')
    .select('source_url')
    .in('source_url', urls);

  if (error) {
    console.error('Deduplication error:', error);
    return articles;
  }

  const existingUrls = new Set(existing.map(a => a.source_url));
  return articles.filter(a => !existingUrls.has(a.sourceUrl));
};

export const insertArticles = async (articles) => {
  if (articles.length === 0) return { count: 0 };

  const { error, data } = await supabase
    .from('articles')
    .insert(articles)
    .select('id');

  if (error) {
    console.error('Insert error:', error);
    throw error;
  }

  return { count: data?.length || 0, data };
};

export const updateArticleScore = async (id, score, summary) => {
  const { error } = await supabase
    .from('articles')
    .update({ score, summary, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Update error:', error);
    throw error;
  }
};

export const getArticlesForPublishing = async (limit = 50) => {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('is_published', false)
    .gt('score', 7.0)
    .order('score', { ascending: false })
    .order('published_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Fetch error:', error);
    throw error;
  }

  return data || [];
};

export const markArticlesAsPublished = async (ids) => {
  const { error } = await supabase
    .from('articles')
    .update({ is_published: true })
    .in('id', ids);

  if (error) {
    console.error('Publish error:', error);
    throw error;
  }
};

export const getPublishedArticles = async (category = null, limit = 20, offset = 0) => {
  let query = supabase
    .from('articles')
    .select('*')
    .eq('is_published', true)
    .order('published_date', { ascending: false });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Fetch published error:', error);
    throw error;
  }

  return data || [];
};