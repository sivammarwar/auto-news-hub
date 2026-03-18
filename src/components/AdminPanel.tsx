import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Trash2 } from 'lucide-react';

interface Article {
  id: number;
  title: string;
  summary: string;
  category: string;
  source_name: string;
  score: number;
  is_published: boolean;
  is_draft: boolean;
  admin_notes?: string;
}

interface ArticleImage {
  id: number;
  image_url: string;
  alt_text?: string;
  position: number;
  width: number;
  height?: number;
}

export default function AdminPanel() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [images, setImages] = useState<ArticleImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [filter, setFilter] = useState<'draft' | 'published' | 'all'>('draft');
  const [error, setError] = useState<string | null>(null);

  // Fetch unpublished articles
  useEffect(() => {
    fetchArticles();
  }, [filter]);

  const fetchArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'draft') {
        query = query.eq('is_draft', true);
      } else if (filter === 'published') {
        query = query.eq('is_published', true);
      }

      const { data, error: err } = await query.limit(50);
      if (err) throw err;
      setArticles(data || []);
    } catch (err) {
      console.error('Error fetching articles:', err);
      setError('Failed to fetch articles');
    } finally {
      setLoading(false);
    }
  };

  const selectArticle = async (article: Article) => {
    setSelectedArticle(article);
    setAdminNotes(article.admin_notes || '');
    
    // Fetch images for this article
    try {
      const { data, error: err } = await supabase
        .from('article_images')
        .select('*')
        .eq('article_id', article.id)
        .order('position', { ascending: true });
      
      if (err) throw err;
      setImages(data || []);
    } catch (err) {
      console.error('Error fetching images:', err);
      setError('Failed to fetch images');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedArticle || !e.target.files?.length) return;

    const file = e.target.files[0];
    setUploading(true);
    setError(null);

    try {
      // Upload to Supabase Storage
      const timestamp = Date.now();
      const fileName = `${selectedArticle.id}/${timestamp}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('article-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('article-images')
        .getPublicUrl(fileName);

      // Get file dimensions
      const img = new Image();
      img.onload = async () => {
        try {
          // Save image metadata to database
          const { error: dbError } = await supabase
            .from('article_images')
            .insert({
              article_id: selectedArticle.id,
              image_url: publicUrl,
              position: images.length,
              width: img.width,
              height: img.height,
              size_kb: Math.round(file.size / 1024),
              alt_text: `Article image for ${selectedArticle.title}`
            });

          if (dbError) throw dbError;

          // Refresh images
          await selectArticle(selectedArticle);
          setError(null);
        } catch (err) {
          console.error('Error saving image metadata:', err);
          setError('Failed to save image');
        }
      };
      img.onerror = () => {
        setError('Failed to load image');
      };
      img.src = publicUrl;
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const deleteImage = async (imageId: number) => {
    if (!confirm('Delete this image?')) return;

    try {
      const { error: err } = await supabase
        .from('article_images')
        .delete()
        .eq('id', imageId);

      if (err) throw err;
      setImages(images.filter(img => img.id !== imageId));
      setError(null);
    } catch (err) {
      console.error('Error deleting image:', err);
      setError('Failed to delete image');
    }
  };

  const updateAdminNotes = async () => {
    if (!selectedArticle) return;

    try {
      const { error: err } = await supabase
        .from('articles')
        .update({ admin_notes: adminNotes })
        .eq('id', selectedArticle.id);

      if (err) throw err;
      alert('Notes saved!');
      setError(null);
    } catch (err) {
      console.error('Error saving notes:', err);
      setError('Failed to save notes');
    }
  };

  const publishArticle = async () => {
    if (!selectedArticle) return;

    if (images.length < 4) {
      setError(`Need at least 4 images. You have ${images.length}.`);
      return;
    }

    try {
      const { error: err } = await supabase
        .from('articles')
        .update({
          is_published: true,
          is_draft: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedArticle.id);

      if (err) throw err;
      alert('Article published!');
      fetchArticles();
      setSelectedArticle(null);
      setError(null);
    } catch (err) {
      console.error('Error publishing article:', err);
      setError('Failed to publish article');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      {/* Articles List */}
      <div className="lg:col-span-1">
        <Card className="p-4">
          <h2 className="text-xl font-bold mb-4">Articles</h2>
          
          <div className="flex gap-2 mb-4 flex-wrap">
            {(['draft', 'published', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-sm ${
                  filter === f
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm rounded">
              {error}
            </div>
          )}

          {loading && <p className="text-gray-600 text-sm">Loading...</p>}

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {articles.map(article => (
              <button
                key={article.id}
                onClick={() => selectArticle(article)}
                className={`w-full text-left p-3 rounded border-2 transition ${
                  selectedArticle?.id === article.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold text-sm truncate">{article.title}</p>
                <p className="text-xs text-gray-600">{article.category}</p>
                <p className="text-xs text-gray-500">Score: {article.score?.toFixed(1) || 'N/A'}/10</p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Article Details & Image Manager */}
      <div className="lg:col-span-2">
        {selectedArticle ? (
          <div className="space-y-4">
            {/* Article Info */}
            <Card className="p-4">
              <h3 className="text-lg font-bold mb-2">{selectedArticle.title}</h3>
              <p className="text-sm text-gray-700 mb-3">{selectedArticle.summary}</p>
              
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div>
                  <strong>Category:</strong> {selectedArticle.category}
                </div>
                <div>
                  <strong>Score:</strong> {selectedArticle.score?.toFixed(1) || 'N/A'}/10
                </div>
                <div className="col-span-2">
                  <strong>Source:</strong> {selectedArticle.source_name}
                </div>
              </div>

              <Button
                onClick={publishArticle}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                disabled={images.length < 4}
              >
                Publish {images.length < 4 && `(need ${4 - images.length} more images)`}
              </Button>
            </Card>

            {/* Admin Notes */}
            <Card className="p-4">
              <h4 className="font-bold mb-2">Admin Notes</h4>
              <Textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                placeholder="Add notes about this article..."
                className="mb-2"
              />
              <Button
                onClick={updateAdminNotes}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Save Notes
              </Button>
            </Card>

            {/* Image Manager */}
            <Card className="p-4">
              <h4 className="font-bold mb-4">
                Article Images ({images.length}/5)
              </h4>

              {/* Upload Area */}
              <label className="block mb-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition">
                  <Upload size={24} className="mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600 mb-1">
                    Click to upload image (1200px+ width)
                  </p>
                  <p className="text-xs text-gray-500">
                    JPG, PNG • Max 5 images per article
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading || images.length >= 5}
                    className="hidden"
                  />
                </div>
              </label>

              {uploading && <p className="text-center text-blue-600 text-sm mb-4">Uploading...</p>}

              {/* Images Grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {images.map(image => (
                  <div key={image.id} className="relative group">
                    <img
                      src={image.image_url}
                      alt={image.alt_text}
                      className="w-full h-32 object-cover rounded border"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition rounded flex items-center justify-center gap-2">
                      <button
                        onClick={() => deleteImage(image.id)}
                        className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {image.width}x{image.height || '?'}
                    </p>
                  </div>
                ))}
              </div>

              {images.length < 4 && (
                <p className="text-sm text-yellow-600">
                  ⚠️ Need at least 4 images to publish ({4 - images.length} more needed)
                </p>
              )}
            </Card>
          </div>
        ) : (
          <Card className="p-8 text-center text-gray-500">
            <p>Select an article to manage images</p>
          </Card>
        )}
      </div>
    </div>
  );
}