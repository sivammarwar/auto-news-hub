import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Article } from '@/types/article';

export function useArticles(category?: string, limit = 50) {
  return useQuery<Article[]>({
    queryKey: ['articles', category, limit],
    queryFn: async () => {
      let query = supabase
        .from('articles')
        .select('*')
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
  });
}

export function useArticle(id: string) {
  return useQuery<Article | null>({
    queryKey: ['article', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', parseInt(id, 10))
        .single();

      if (error) throw error;
      return data as Article;
    },
    enabled: !!id,
  });
}

export function useRelatedArticles(article: Article | null, limit = 4) {
  return useQuery<Article[]>({
    queryKey: ['related', article?.id, article?.category],
    queryFn: async () => {
      if (!article) return [];
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('category', article.category)
        .eq('is_published', true)
        .neq('id', article.id)
        .order('score', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data as Article[]) ?? [];
    },
    enabled: !!article,
  });
}
