// src/types/article.ts
export interface Article {
  id: number;
  created_at: string;
  updated_at: string;
  title: string;
  source_url: string;
  source_name: string;
  summary: string;
  raw_content: string | null;
  category: string;
  score: number | null;
  image_url: string | null;
  published_date: string;
  is_published: boolean;
  is_draft: boolean;
  admin_notes: string | null;
  slug: string | null;
}
