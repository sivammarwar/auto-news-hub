import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import ArticleCard from '@/components/ArticleCard';
import { useArticle, useRelatedArticles } from '@/hooks/useArticles';
import { supabase } from '@/integrations/supabase/client';

interface ArticleImage {
  id: number;
  image_url: string;
  alt_text?: string;
  position: number;
  width: number;
  height?: number;
}

const ArticlePage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: article, isLoading } = useArticle(id ?? '');
  const { data: related } = useRelatedArticles(article ?? null);
  const [images, setImages] = useState<ArticleImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);

  // Fetch article images
  useEffect(() => {
    if (!id) return;
    
    const fetchImages = async () => {
      try {
        const { data, error } = await supabase
          .from('article_images')
          .select('*')
          .eq('article_id', parseInt(id))
          .order('position', { ascending: true });

        if (error) throw error;
        setImages(data || []);
      } catch (error) {
        console.error('Error fetching images:', error);
      } finally {
        setImagesLoading(false);
      }
    };

    fetchImages();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-meta animate-pulse">Loading article...</span>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <h1 className="text-2xl font-bold tracking-tightest">Article not found</h1>
          <Link to="/" className="text-meta text-primary hover:underline">← Back to home</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const pubDate = format(new Date(article.published_date), 'MMMM d, yyyy · h:mm a');

  // Split summary into paragraphs and distribute images
  const paragraphs = article.summary.split('\n\n').filter(p => p.trim());
  const contentWithImages: (string | ArticleImage)[] = [];
  
  if (images.length > 0) {
    const imagesPerSection = Math.ceil(paragraphs.length / images.length);
    let imageIndex = 0;
    
    paragraphs.forEach((para, idx) => {
      contentWithImages.push(para);
      
      if ((idx + 1) % imagesPerSection === 0 && imageIndex < images.length) {
        contentWithImages.push(images[imageIndex]);
        imageIndex++;
      }
    });
    
    // Add remaining images at the end
    while (imageIndex < images.length) {
      contentWithImages.push(images[imageIndex]);
      imageIndex++;
    }
  } else {
    // No images - just use paragraphs
    contentWithImages.push(...paragraphs);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto px-6 py-20"
        >
          <div className="flex items-center gap-4 mb-6">
            <Link
              to={`/category/${article.category}`}
              className="text-meta text-primary font-bold hover:underline"
            >
              {article.category.toUpperCase()}
            </Link>
            <span className="text-meta">{pubDate}</span>
            {article.score && (
              <span className="text-meta tabular-nums">AI Confidence: {article.score.toFixed(1)}/10</span>
            )}
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tightest leading-[0.95] text-foreground mb-8" style={{ textWrap: 'balance' } as React.CSSProperties}>
            {article.title}
          </h1>

          {/* Featured Image (first uploaded image or original image_url) */}
          {images.length > 0 ? (
            <div className="w-full mb-8 rounded-lg overflow-hidden">
              <img
                src={images[0].image_url}
                alt={images[0].alt_text || article.title}
                className="w-full h-auto object-cover"
                loading="lazy"
                style={{ minWidth: '1200px', maxWidth: '100%' }}
              />
              {images[0].alt_text && (
                <p className="text-sm text-muted-foreground mt-2 italic">{images[0].alt_text}</p>
              )}
            </div>
          ) : article.image_url ? (
            <div className="aspect-video overflow-hidden mb-8 rounded-lg">
              <img
                src={article.image_url}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : null}

          {/* Content with embedded images */}
          <div className="text-lg leading-relaxed text-foreground mb-12 max-w-[65ch]" style={{ textWrap: 'pretty' } as React.CSSProperties}>
            {contentWithImages.map((item, idx) => {
              if (typeof item === 'string') {
                return (
                  <p key={idx} className="mb-6">
                    {item}
                  </p>
                );
              } else {
                // It's an image
                const img = item as ArticleImage;
                return (
                  <figure key={img.id} className="my-8">
                    <img
                      src={img.image_url}
                      alt={img.alt_text || article.title}
                      className="w-full rounded-lg shadow-lg"
                      loading="lazy"
                      style={{ minWidth: '1200px', maxWidth: '100%' }}
                    />
                    {img.alt_text && (
                      <figcaption className="text-sm text-muted-foreground mt-3 italic">
                        {img.alt_text}
                      </figcaption>
                    )}
                  </figure>
                );
              }
            })}
          </div>

          {article.raw_content && (
            <div className="text-base leading-relaxed text-muted-foreground mb-12 max-w-[65ch]" style={{ textWrap: 'pretty' } as React.CSSProperties}>
              {article.raw_content}
            </div>
          )}

          <div className="border-t border-border pt-6 flex items-center justify-between flex-wrap gap-4">
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center font-mono text-sm font-bold border-b-2 border-foreground pb-1 hover:text-primary hover:border-primary transition-all"
            >
              READ FULL SOURCE →
            </a>
            <div className="flex items-center gap-4">
              <span className="text-meta">{article.source_name}</span>
            </div>
          </div>
        </motion.article>

        {related && related.length > 0 && (
          <section className="max-w-screen-xl mx-auto px-6 pb-20">
            <div className="border-t border-border pt-12 mb-8">
              <span className="text-meta text-foreground font-bold">Related Articles</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
              {related.map((a, i) => (
                <ArticleCard key={a.id} article={a} index={i} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default ArticlePage;