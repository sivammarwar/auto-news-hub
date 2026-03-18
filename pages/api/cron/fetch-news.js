// api/cron/fetch-news.js
// Updated: Creates DRAFT articles that need images before publishing

import axios from 'axios';
import xml2js from 'xml2js';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const xmlParser = new xml2js.Parser();
const CATEGORIES = ['cricket', 'bollywood', 'technology'];

// RSS feed sources for each category
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

// Main handler
export default async function handler(req, res) {
  // Verify this is a valid cron request
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    let totalInserted = 0;
    const timestamp = new Date().toISOString();
    console.log(`\n=== CRON JOB STARTED at ${timestamp} ===\n`);

    for (const category of CATEGORIES) {
      console.log(`\n📰 Processing ${category.toUpperCase()} news...`);
      
      // Fetch articles from multiple sources
      const [newsApiArticles, rssArticles] = await Promise.all([
        fetchNewsFromNewsAPI(category),
        fetchRSSFeeds(category)
      ]);

      const allArticles = [...newsApiArticles, ...rssArticles];
      console.log(`   ✓ Found ${allArticles.length} total articles`);

      if (allArticles.length === 0) {
        console.log(`   ⚠️  No articles found for ${category}`);
        continue;
      }

      // Remove duplicates
      const uniqueArticles = await deduplicateArticles(allArticles);
      console.log(`   ✓ After dedup: ${uniqueArticles.length} new articles`);

      if (uniqueArticles.length === 0) {
        console.log(`   ℹ️  All articles already in database`);
        continue;
      }

      // Insert raw articles into database AS DRAFTS
      const insertedData = await insertArticles(uniqueArticles);
      console.log(`   ✓ Inserted ${insertedData.count} draft articles`);
      totalInserted += insertedData.count;

      // Process summaries and scores asynchronously (don't wait for this)
      if (insertedData.data && insertedData.data.length > 0) {
        processArticlesAsync(
          insertedData.data.map((d, idx) => ({
            id: d.id,
            article: uniqueArticles[idx]
          }))
        ).catch(err => console.error('   ✗ Async processing error:', err.message));
      }
    }

    console.log(`\n=== CRON JOB COMPLETED ===`);
    console.log(`Total draft articles created: ${totalInserted}\n`);
    console.log('📋 Visit /admin panel to add images and publish articles\n');

    return res.status(200).json({
      success: true,
      articlesInserted: totalInserted,
      timestamp: timestamp,
      message: `Successfully created ${totalInserted} draft articles. Visit admin panel to add images and publish.`
    });

  } catch (error) {
    console.error('\n❌ CRON JOB ERROR:', error.message);
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchNewsFromNewsAPI(category) {
  const NEWS_API_KEY = process.env.NEWS_API_KEY;
  if (!NEWS_API_KEY) {
    console.log('   ⚠️  NEWS_API_KEY not set, skipping NewsAPI');
    return [];
  }

  const queries = {
    cricket: 'cricket news',
    bollywood: 'bollywood OR hindi cinema OR indian films',
    technology: 'technology OR AI OR startups OR software'
  };

  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      q: queries[category] || category,
      sortBy: 'publishedAt',
      language: 'en',
      pageSize: 30,
      apiKey: NEWS_API_KEY,
      timeout: 10000
    });

    return (response.data.articles || []).map(article => ({
      title: article.title,
      sourceUrl: article.url,
      sourceName: article.source?.name || 'News API',
      rawContent: article.content || article.description || '',
      imageUrl: article.urlToImage,
      publishedDate: new Date(article.publishedAt),
      category: category
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
            title: title,
            sourceUrl: sourceUrl,
            sourceName: item.source?.[0]?._ || extractDomainFromUrl(sourceUrl),
            rawContent: item.description?.[0] || item.content?.[0] || '',
            imageUrl: extractImageFromContent(item.description?.[0]),
            publishedDate: new Date(item.pubDate?.[0] || Date.now()),
            category: category
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
    return articles; // Return all if dedup fails
  }
}

async function insertArticles(articles) {
  if (articles.length === 0) return { count: 0, data: [] };

  try {
    const { data, error } = await supabaseAdmin
      .from('articles')
      .insert(
        articles.map(a => ({
          title: a.title,
          source_url: a.sourceUrl,
          source_name: a.sourceName,
          raw_content: a.rawContent || '',
          category: a.category,
          image_url: a.imageUrl,
          published_date: a.publishedDate.toISOString(),
          summary: 'Processing...', // Will be updated by async process
          score: 5.0, // Default score
          is_published: false,
          is_draft: true,  // 👈 NEW: Mark as draft
          admin_notes: '⏳ Waiting for images to be added'  // 👈 NEW: Admin note
        }))
      )
      .select('id');

    if (error) throw error;

    return {
      count: data?.length || 0,
      data: data || []
    };
  } catch (error) {
    console.error(`   ✗ Insert error: ${error.message}`);
    throw error;
  }
}

async function processArticlesAsync(articles) {
  console.log(`\n   🤖 Processing ${articles.length} articles (async)...`);

  for (const { id, article } of articles) {
    try {
      // Generate summary
      const summary = await summarizeArticle(article.title, article.rawContent);
      
      // Generate score
      const score = await scoreArticle(article.title, summary, article.category);

      // Update database
      await supabaseAdmin
        .from('articles')
        .update({
          summary: summary,
          score: score,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      console.log(`   ✓ Article ${id}: ${score}/10`);
    } catch (error) {
      console.error(`   ✗ Error processing article ${id}: ${error.message}`);
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function summarizeArticle(title, content) {
  if (!content || content.length < 50) {
    return content || title;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a news summarization AI. Create concise, factual summaries of news articles.

Requirements:
- Be factual, avoid sensationalism or exaggeration
- Include key details (who, what, when, where, why)
- Do not add commentary, opinion, or speculation
- Write in clear, simple English language
- Aim for 80-120 tokens
- Use bullet points if helpful for clarity`
        },
        {
          role: 'user',
          content: `Summarize this news article:

Title: ${title}

Content: ${content.substring(0, 2500)}`
        }
      ],
      max_tokens: 150,
      temperature: 0.5
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error(`Summarization error: ${error.message}`);
    // Fallback to truncated content
    return content.substring(0, 300) + '...';
  }
}

async function scoreArticle(title, summary, category) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a news relevance scoring AI for ${category} news.

Score articles 0-10 based on:
- Relevance to ${category} (most important)
- Recency and timeliness (published today/yesterday = +2)
- Engagement potential and virality
- Factual accuracy and credibility
- Overall news value and importance to readers

RETURN ONLY a single number between 0-10, nothing else.
Example valid responses: "7" or "8.5" or "6.0"`
        },
        {
          role: 'user',
          content: `Score this ${category} article on 0-10 scale:

Title: ${title}

Summary: ${summary}`
        }
      ],
      max_tokens: 5,
      temperature: 0.3
    });

    const scoreText = response.choices[0].message.content.trim();
    const score = parseFloat(scoreText);
    
    if (isNaN(score)) {
      console.warn(`Invalid score response: "${scoreText}", using default 5.0`);
      return 5.0;
    }

    return Math.min(10, Math.max(0, score));
  } catch (error) {
    console.error(`Scoring error: ${error.message}`);
    return 5.0; // Default middle score
  }
}

function extractImageFromContent(content) {
  if (!content) return null;
  try {
    const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
    return imgMatch ? imgMatch[1] : null;
  } catch {
    return null;
  }
}

function extractDomainFromUrl(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return 'News';
  }
}