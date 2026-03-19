// api/cron/fetch-news.js
// Uses GROQ API (FREE) instead of OpenAI
// Fetches and processes news articles automatically

import axios from 'axios';
import xml2js from 'xml2js';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ✅ FIXED: SUPABASE_URL instead of VITE_SUPABASE_URL
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const xmlParser = new xml2js.Parser();
const CATEGORIES = ['cricket', 'bollywood', 'technology'];

const RSS_SOURCES = {
  cricket: [
    'https://www.espncricinfo.com/feeds/rss/cricket_news.xml',
    'https://www.cricbuzz.com/rss/news.xml'
  ],
  bollywood: [
    'https://www.bollywoodhungama.com/news/rss'
  ],
  technology: [
    'https://feeds.techcrunch.com/techcrunch/startups',
    'https://feeds.theverge.com/rss/index.xml',
    'https://news.ycombinator.com/rss'
  ]
};

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let totalInserted = 0;
    const timestamp = new Date().toISOString();
    console.log(`\n=== FETCH-NEWS CRON STARTED at ${timestamp} ===\n`);

    for (const category of CATEGORIES) {
      console.log(`\n📰 Processing ${category.toUpperCase()} news...`);

      const [newsApiArticles, rssArticles] = await Promise.all([
        fetchNewsFromNewsAPI(category),
        fetchRSSFeeds(category)
      ]);

      const allArticles = [...newsApiArticles, ...rssArticles];
      console.log(`   ✓ Found ${allArticles.length} total articles`);

      if (allArticles.length === 0) continue;

      const uniqueArticles = await deduplicateArticles(allArticles);
      console.log(`   ✓ After dedup: ${uniqueArticles.length} new articles`);

      if (uniqueArticles.length === 0) continue;

      const insertedData = await insertArticles(uniqueArticles);
      console.log(`   ✓ Inserted ${insertedData.count} articles`);
      totalInserted += insertedData.count;

      if (insertedData.data && insertedData.data.length > 0) {
        processArticlesAsync(
          insertedData.data.map((d, idx) => ({ id: d.id, article: uniqueArticles[idx] }))
        ).catch(err => console.error('   ✗ Async processing error:', err.message));
      }
    }

    console.log(`\n=== FETCH-NEWS CRON COMPLETED ===`);
    console.log(`Total articles inserted: ${totalInserted}`);

    return res.status(200).json({
      success: true,
      articlesInserted: totalInserted,
      timestamp,
      message: `Successfully fetched ${totalInserted} new articles.`
    });

  } catch (error) {
    console.error('\n❌ FETCH-NEWS CRON ERROR:', error.message);
    return res.status(500).json({ error: error.message, timestamp: new Date().toISOString() });
  }
}

async function fetchNewsFromNewsAPI(category) {
  const NEWS_API_KEY = process.env.NEWS_API_KEY;
  if (!NEWS_API_KEY) return [];

  const queries = {
    cricket: 'cricket news',
    bollywood: 'bollywood OR hindi cinema OR indian films',
    technology: 'technology OR AI OR startups OR software'
  };

  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: queries[category] || category,
        sortBy: 'publishedAt',
        language: 'en',
        pageSize: 30,
        apiKey: NEWS_API_KEY
      },
      timeout: 10000
    });

    return (response.data.articles || []).map(article => ({
      title: article.title,
      sourceUrl: article.url,
      sourceName: article.source?.name || 'News API',
      rawContent: article.content || article.description || '',
      imageUrl: article.urlToImage,
      publishedDate: new Date(article.publishedAt),
      category
    }));
  } catch (error) {
    console.error(`   ✗ NewsAPI error: ${error.message}`);
    return [];
  }
}

async function fetchRSSFeeds(category) {
  const sources = RSS_SOURCES[category] || [];
  const articles = [];

  for (const rssUrl of sources) {
    try {
      const response = await axios.get(rssUrl, { timeout: 10000 });
      const parsed = await xmlParser.parseStringPromise(response.data);
      const items = parsed.rss?.channel?.[0]?.item || [];

      items.forEach(item => {
        const sourceUrl = item.link?.[0] || item.guid?.[0] || item.link;
        const title = item.title?.[0] || 'No title';

        if (sourceUrl) {
          articles.push({
            title,
            sourceUrl,
            sourceName: item.source?.[0]?._ || extractDomainFromUrl(sourceUrl),
            rawContent: item.description?.[0] || item.content?.[0] || '',
            imageUrl: extractImageFromContent(item.description?.[0]),
            publishedDate: new Date(item.pubDate?.[0] || Date.now()),
            category
          });
        }
      });

      console.log(`   ✓ Fetched ${items.length} from ${rssUrl.split('/')[2]}`);
    } catch (error) {
      console.error(`   ✗ RSS error (${rssUrl}): ${error.message}`);
    }
  }

  return articles;
}

async function deduplicateArticles(articles) {
  if (articles.length === 0) return articles;

  const urls = articles.map(a => a.sourceUrl);

  try {
    const { data: existing, error } = await supabaseAdmin
      .from('articles')
      .select('source_url')
      .in('source_url', urls);

    if (error) throw error;

    const existingUrls = new Set(existing?.map(a => a.source_url) || []);
    return articles.filter(a => !existingUrls.has(a.sourceUrl));
  } catch (error) {
    console.error(`   ✗ Dedup error: ${error.message}`);
    return articles;
  }
}

async function insertArticles(articles) {
  if (articles.length === 0) return { count: 0, data: [] };

  try {
    const { data, error } = await supabaseAdmin
      .from('articles')
      .insert(articles.map(a => ({
        title: a.title,
        source_url: a.sourceUrl,
        source_name: a.sourceName,
        raw_content: a.rawContent || '',
        category: a.category,
        image_url: a.imageUrl,
        published_date: a.publishedDate.toISOString(),
        summary: 'Processing...',
        score: 5.0,
        is_published: false,
        is_draft: true
      })))
      .select('id');

    if (error) throw error;

    return { count: data?.length || 0, data: data || [] };
  } catch (error) {
    console.error(`   ✗ Insert error: ${error.message}`);
    throw error;
  }
}

async function processArticlesAsync(articles) {
  for (const { id, article } of articles) {
    try {
      const summary = await summarizeArticle(article.title, article.rawContent);
      const score = await scoreArticle(article.title, summary, article.category);

      await supabaseAdmin
        .from('articles')
        .update({ summary, score, updated_at: new Date().toISOString() })
        .eq('id', id);

      console.log(`   ✓ Article ${id}: ${score}/10`);
    } catch (error) {
      console.error(`   ✗ Error processing article ${id}: ${error.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

async function summarizeArticle(title, content) {
  if (!content || content.length < 50) return content || title;

  try {
    const response = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [
        { role: 'system', content: 'Summarize this news article in 80-120 words. Be factual and concise.' },
        { role: 'user', content: `Title: ${title}\n\nContent: ${content.substring(0, 2500)}` }
      ],
      max_tokens: 150,
      temperature: 0.5
    });
    return response.choices[0].message.content.trim();
  } catch {
    return content.substring(0, 300) + '...';
  }
}

async function scoreArticle(title, summary, category) {
  try {
    const response = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [
        { role: 'system', content: `Score this ${category} article 0-10 on relevance, timeliness, and engagement. RETURN ONLY a single number like "7.5"` },
        { role: 'user', content: `Title: ${title}\n\nSummary: ${summary}` }
      ],
      max_tokens: 5,
      temperature: 0.3
    });
    const score = parseFloat(response.choices[0].message.content.trim());
    return isNaN(score) ? 5.0 : Math.min(10, Math.max(0, score));
  } catch {
    return 5.0;
  }
}

function extractImageFromContent(content) {
  if (!content) return null;
  try {
    const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
    return imgMatch ? imgMatch[1] : null;
  } catch { return null; }
}

function extractDomainFromUrl(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch { return 'News'; }
}