import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Article } from '@/types/article';

const FIELDS = 'id, created_at, updated_at, title, source_url, source_name, summary, raw_content, category, score, image_url, published_date, is_published, is_draft, admin_notes, slug';

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
    staleTime: 5 * 60 * 1000,
  });
}

export function useArticle(id: string) {
  return useQuery<Article | null>({
    queryKey: ['article', id],
    queryFn: async () => {
      if (!id) return null;

      const numericId = parseInt(id, 10);
      const isNumeric = !isNaN(numericId) && String(numericId) === id;

      if (isNumeric) {
        // Legacy numeric ID path — old URLs like /article/123
        const { data, error } = await supabase
          .from('articles')
          .select(FIELDS)
          .eq('id', numericId)
          .eq('is_published', true)
          .single();

        if (error?.code === 'PGRST116') return null;
        if (error) throw error;
        return data as Article;

      } else {
        // Slug path — new URLs like /article/polish-officer-charges-german-tank
        const { data, error } = await supabase
          .from('articles')
          .select(FIELDS)
          .eq('slug', id)
          .eq('is_published', true)
          .single();

        if (error?.code === 'PGRST116') return null;
        if (error) throw error;
        return data as Article;
      }
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
