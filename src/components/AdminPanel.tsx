import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Trash2, Zap, RefreshCw } from 'lucide-react';

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
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [filter, setFilter] = useState<'draft' | 'published' | 'all'>('draft');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

      const { data, error: err } = await query.limit(100);
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
    setError(null);
    setSuccess(null);

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

  // ─────────────────────────────────────────────────────────
  // GENERATE ARTICLES — calls /api/manual/generate-articles
  // ─────────────────────────────────────────────────────────
  const handleGenerateArticles = async () => {
    setGenerating(true);
    setError(null);
    setSuccess(null);
    setGenerateProgress('⏳ Fetching articles from RSS sources...');

    try {
      console.log('🚀 Generating articles...');

      // Simulate progress updates while waiting
      const progressMessages = [
        '⏳ Fetching articles from RSS sources...',
        '📡 Fetching cricket, bollywood & tech news...',
        '🤖 Scoring articles with AI (this takes ~30-60s)...',
        '💾 Saving to database...',
      ];

      let progressIndex = 0;
      const progressInterval = setInterval(() => {
        progressIndex = (progressIndex + 1) % progressMessages.length;
        setGenerateProgress(progressMessages[progressIndex]);
      }, 4000);

      const response = await fetch('/api/manual/generate-articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      clearInterval(progressInterval);
      setGenerateProgress('');

      // Handle non-JSON or error responses gracefully
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 200)}`);
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setSuccess(
        `✅ Generation Complete!\n\n` +
        `📰 New articles created: ${data.totalArticlesCreated}\n` +
        `⭐ Draft articles with score ≥ 7.0: ${data.highScoreArticles}\n\n` +
        `The draft tab below will refresh automatically.`
      );

      // Auto-refresh draft list after 2 seconds
      setTimeout(() => {
        setFilter('draft');
        fetchArticles();
      }, 2000);

    } catch (err) {
      setGenerateProgress('');
      console.error('❌ Generation error:', err);
      setError(
        `❌ Generation Failed\n\n` +
        `Error: ${err instanceof Error ? err.message : 'Unknown error'}\n\n` +
        `Checklist:\n` +
        `1. Add SUPABASE_URL to Vercel env vars (NOT VITE_SUPABASE_URL)\n` +
        `2. Add SUPABASE_SERVICE_ROLE_KEY to Vercel env vars\n` +
        `3. Add GROQ_API_KEY to Vercel env vars\n` +
        `4. Make sure the Vercel deployment is live`
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedArticle || !e.target.files?.length) return;

    const file = e.target.files[0];
    setUploading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const fileName = `${selectedArticle.id}/${timestamp}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('article-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('article-images')
        .getPublicUrl(fileName);

      const img = new Image();
      img.onload = async () => {
        try {
          const { error: dbError } = await supabase
            .from('article_images')
            .insert({
              article_id: selectedArticle.id,
              image_url: publicUrl,
              position: images.length,
              width: img.width,
              height: img.height,
              size_kb: Math.round(file.size / 1024),
              alt_text: `Article image`
            });

          if (dbError) throw dbError;

          await selectArticle(selectedArticle);
          setSuccess('✅ Image uploaded!');
          setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
          console.error('Error saving image:', err);
          setError('Failed to save image to database');
        }
      };
      img.onerror = () => {
        setError('Failed to load uploaded image');
      };
      img.src = publicUrl;
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload image to storage');
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
      setSuccess('✅ Image deleted');
      setTimeout(() => setSuccess(null), 2000);
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
      setSuccess('✅ Notes saved!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error('Error saving notes:', err);
      setError('Failed to save notes');
    }
  };

  const publishArticle = async () => {
    if (!selectedArticle) return;

    if (images.length < 4) {
      setError(`⚠️ Need at least 4 images to publish. You have ${images.length}.`);
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
      setSuccess('✅ Article published! It is now live on your website.');
      setTimeout(() => {
        fetchArticles();
        setSelectedArticle(null);
        setImages([]);
      }, 2000);
    } catch (err) {
      console.error('Error publishing article:', err);
      setError('Failed to publish article');
    }
  };

  // Score badge color
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-green-100 text-green-800';
    if (score >= 7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">📰 News Admin Panel</h1>
        <p className="text-gray-500 text-sm">Generate articles, add images, and publish to your website</p>
      </div>

      {/* ─── GENERATE BUTTON CARD ─── */}
      <Card className="p-5 mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-blue-900 flex items-center gap-2 mb-1 text-lg">
              <Zap size={20} className="text-blue-600 shrink-0" />
              Generate Articles On Demand
            </h3>
            <p className="text-sm text-blue-700 mb-1">
              Fetches up to <strong>60 articles</strong> from cricket, bollywood, technology &amp; viral sources.
            </p>
            <p className="text-sm text-blue-700">
              Articles with score <strong>≥ 7.0</strong> will appear in Drafts — add 4–5 images and publish anytime.
            </p>
            {generateProgress && (
              <p className="mt-2 text-sm font-medium text-blue-800 animate-pulse">
                {generateProgress}
              </p>
            )}
          </div>
          <Button
            onClick={handleGenerateArticles}
            disabled={generating}
            className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap shrink-0 px-6 py-3 text-base font-semibold shadow-md"
            size="lg"
          >
            {generating ? (
              <>
                <span className="animate-spin mr-2 inline-block">⚡</span>
                Generating... (~60s)
              </>
            ) : (
              <>
                <Zap size={18} className="mr-2" />
                Generate Now
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* ─── MESSAGES ─── */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          <p className="font-semibold mb-1">Error</p>
          <p className="text-sm whitespace-pre-line">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-red-500 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          <p className="font-semibold mb-1">Success</p>
          <p className="text-sm whitespace-pre-line">{success}</p>
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT — ARTICLES LIST */}
        <div className="lg:col-span-1">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Articles ({articles.length})</h2>
              <button
                onClick={fetchArticles}
                disabled={loading}
                className="text-gray-400 hover:text-gray-600 transition"
                title="Refresh list"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-4">
              {(['draft', 'published', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 py-1 rounded text-sm font-medium transition ${
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {loading && (
              <p className="text-gray-400 text-sm text-center py-4">⏳ Loading...</p>
            )}

            {!loading && articles.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8">
                No articles found.<br />
                {filter === 'draft' && 'Click "Generate Now" to fetch articles.'}
              </p>
            )}

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {articles.map(article => (
                <button
                  key={article.id}
                  onClick={() => selectArticle(article)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition ${
                    selectedArticle?.id === article.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 bg-white'
                  }`}
                >
                  <p className="font-medium text-sm leading-snug line-clamp-2">{article.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 capitalize">{article.category}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${getScoreColor(article.score)}`}>
                      ⭐ {article.score?.toFixed(1) ?? 'N/A'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* RIGHT — ARTICLE DETAIL */}
        <div className="lg:col-span-2">
          {selectedArticle ? (
            <div className="space-y-4">

              {/* ARTICLE INFO */}
              <Card className="p-5">
                <h3 className="text-lg font-bold mb-2 leading-snug">{selectedArticle.title}</h3>
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">{selectedArticle.summary}</p>

                <div className="grid grid-cols-3 gap-3 text-sm mb-5">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-gray-500 text-xs mb-1">Category</p>
                    <p className="font-semibold capitalize">{selectedArticle.category}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-gray-500 text-xs mb-1">Score</p>
                    <p className={`font-bold text-base ${
                      selectedArticle.score >= 7 ? 'text-green-600' : 'text-gray-700'
                    }`}>
                      {selectedArticle.score?.toFixed(1)}/10
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-gray-500 text-xs mb-1">Source</p>
                    <p className="font-semibold truncate">{selectedArticle.source_name}</p>
                  </div>
                </div>

                {/* PUBLISH BUTTON */}
                <Button
                  onClick={publishArticle}
                  disabled={images.length < 4}
                  className={`w-full text-white font-bold py-3 text-base ${
                    images.length >= 4
                      ? 'bg-green-600 hover:bg-green-700 shadow-md'
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  {images.length < 4
                    ? `📸 Add ${4 - images.length} more image${4 - images.length > 1 ? 's' : ''} to publish`
                    : '🚀 Publish Article'}
                </Button>
              </Card>

              {/* ADMIN NOTES */}
              <Card className="p-4">
                <h4 className="font-bold mb-2 text-gray-800">📝 Admin Notes</h4>
                <Textarea
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Add private notes about this article..."
                  className="mb-2 min-h-[80px] text-sm"
                />
                <Button onClick={updateAdminNotes} variant="outline" className="w-full text-sm">
                  Save Notes
                </Button>
              </Card>

              {/* IMAGES */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-800">
                    🖼️ Images ({images.length}/5)
                  </h4>
                  {images.length >= 4 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                      ✅ Ready to publish
                    </span>
                  )}
                </div>

                {/* Upload zone */}
                {images.length < 5 && (
                  <label className="block mb-4">
                    <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                      uploading
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                    }`}>
                      <Upload size={28} className="mx-auto mb-2 text-gray-400" />
                      <p className="text-sm font-medium text-gray-700">
                        {uploading ? '⏳ Uploading...' : 'Click to upload image'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Minimum 1200px wide recommended</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploading || images.length >= 5}
                        className="hidden"
                      />
                    </div>
                  </label>
                )}

                {/* Image grid */}
                {images.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {images.map((image, idx) => (
                      <div key={image.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
                        <img
                          src={image.image_url}
                          alt={`Image ${idx + 1}`}
                          className="w-full h-36 object-cover"
                        />
                        <div className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                          #{idx + 1}
                        </div>
                        <button
                          onClick={() => deleteImage(image.id)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                          title="Delete image"
                        >
                          <Trash2 size={22} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {images.length < 4 && (
                  <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                    ⚠️ Need <strong>{4 - images.length} more image{4 - images.length > 1 ? 's' : ''}</strong> before you can publish.
                  </p>
                )}
              </Card>

            </div>
          ) : (
            <Card className="p-12 text-center text-gray-400 flex flex-col items-center justify-center h-full min-h-[300px]">
              <p className="text-4xl mb-3">👈</p>
              <p className="text-lg font-medium text-gray-500">Select an article from the list</p>
              <p className="text-sm mt-1">to add images and publish it</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}