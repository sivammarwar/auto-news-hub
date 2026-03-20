import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Article } from '@/types/article';

// Explicit column list — guarantees raw_content is always fetched.
// Avoids the silent issue where select('*') + a type without a field
// causes that field to be undefined in the component.
const FIELDS = 'id, created_at, updated_at, title, source_url, source_name, summary, raw_content, category, score, image_url, published_date, is_published, is_draft, admin_notes';

export function useArticles(category?: string, limit = 50) {
  return useQuery<Article[]>({
    queryKey: ['articles', category, limit],
    queryFn: async () => {
      let query = supabase
        .from('articles')
        .select(FIELDS)
        .eq('is_published', true)
        .order('published_date', { ascending: false })
        .limit(limit);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as Article[]) ?? [];
    },
    staleTime: 5 * 60 * 1000, // cache 5 min — saves Supabase bandwidth
  });
}

export function useArticle(id: string) {
  return useQuery<Article | null>({
    queryKey: ['article', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select(FIELDS)
        .eq('id', parseInt(id, 10))
        .eq('is_published', true)   // ← only fetch published articles
        .single();

      // PGRST116 = no rows found (article doesn't exist or isn't published yet)
      if (error?.code === 'PGRST116') return null;
      if (error) throw error;
      return data as Article;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
}

export function useRelatedArticles(article: Article | null, limit = 4) {
  return useQuery<Article[]>({
    queryKey: ['related', article?.id, article?.category],
    queryFn: async () => {
      if (!article) return [];

      const { data, error } = await supabase
        .from('articles')
        .select(FIELDS)
        .eq('category', article.category)
        .eq('is_published', true)
        .neq('id', article.id)
        .order('score', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data as Article[]) ?? [];
    },
    enabled: !!article,
    staleTime: 10 * 60 * 1000,
  });
}