// api/manual/generate-articles.js
// Manual trigger endpoint - generates 60 articles on demand
// Works: Generates articles, stores as drafts, shows high-quality ones

import axios from 'axios';
import xml2js from 'xml2js';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ✅ FIXED: Use SUPABASE_URL instead of VITE_SUPABASE_URL
// VITE_ prefixed env vars are NOT available in Vercel serverless functions
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const xmlParser = new xml2js.Parser();

// News sources
const NEWS_SOURCES = {
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

const VIRAL_SOURCES = [
  'https://feeds.feedburner.com/ndtvnews-top-stories',
  'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
  'https://www.thehindu.com/news/feeder/default.rss',
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://rss.cnn.com/rss/edition.rss',
  'https://news.ycombinator.com/rss'
];

export default async function handler(req, res) {
  // Set JSON header
  res.setHeader('Content-Type', 'application/json');

  // Only POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'POST only' });
  }

  // ✅ ADDED: Basic env var check at startup so you get a clear error
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables. Add them in Vercel → Settings → Environment Variables.'
    });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Missing GROQ_API_KEY in environment variables.'
    });
  }

  try {
    console.log('🚀 Manual generation started');

    let totalCreated = 0;
    const categories = ['cricket', 'bollywood', 'technology'];

    // ─────────────────────────────────────────────
    // Generate from each category
    // ─────────────────────────────────────────────
    for (const category of categories) {
      try {
        console.log(`📚 Processing category: ${category}...`);
        const sources = NEWS_SOURCES[category] || [];
        const articles = [];

        // Fetch from each RSS source
        for (const source of sources) {
          try {
            const response = await axios.get(source, { timeout: 8000 });
            const parsed = await xmlParser.parseStringPromise(response.data);
            const items = parsed.rss?.channel?.[0]?.item || [];

            items.forEach(item => {
              const url = item.link?.[0] || item.guid?.[0];
              const title = item.title?.[0] || 'Untitled';

              if (url && title) {
                articles.push({
                  title: String(title).trim(),
                  source_url: String(url).trim(),
                  source_name: extractDomain(String(url)),
                  summary: String(item.description?.[0] || '').substring(0, 300),
                  raw_content: String(item.description?.[0] || ''),
                  category: category,
                  published_date: new Date(item.pubDate?.[0] || Date.now()),
                  score: 5.0,
                  image_url: null,
                  is_draft: true,
                  is_published: false
                });
              }
            });
          } catch (e) {
            console.log(`  ✗ Failed to fetch: ${source.split('/')[2]} — ${e.message}`);
          }
        }

        if (articles.length > 0) {
          // Deduplicate by source_url against existing DB records
          const urls = articles.map(a => a.source_url);
          const { data: existing } = await supabaseAdmin
            .from('articles')
            .select('source_url')
            .in('source_url', urls);

          const existingUrls = new Set((existing || []).map(a => a.source_url));
          const newArticles = articles.filter(a => !existingUrls.has(a.source_url));

          if (newArticles.length > 0) {
            // Score each article using Groq
            for (let i = 0; i < newArticles.length; i++) {
              try {
                const a = newArticles[i];
                const scoreResp = await groq.chat.completions.create({
                  model: 'mixtral-8x7b-32768',
                  messages: [
                    {
                      role: 'system',
                      content: 'You are a news scoring assistant. Score the article from 0 to 10 based on how interesting, viral, and engaging it is for a general Indian audience. Reply with ONLY a single number like 7.5'
                    },
                    {
                      role: 'user',
                      content: `${a.title} ${a.summary}`.substring(0, 300)
                    }
                  ],
                  max_tokens: 5,
                  temperature: 0.3
                });
                const score = parseFloat(scoreResp.choices[0].message.content);
                newArticles[i].score = isNaN(score) ? 5.0 : Math.min(10, Math.max(0, score));
              } catch (e) {
                newArticles[i].score = 5.0;
              }
              await sleep(200);
            }

            // ✅ FIXED: Use upsert with onConflict to safely skip duplicates
            const { error: insertErr } = await supabaseAdmin
              .from('articles')
              .upsert(newArticles, {
                onConflict: 'source_url',
                ignoreDuplicates: true
              });

            if (insertErr) {
              console.log(`  ✗ Insert error for ${category}: ${insertErr.message}`);
            } else {
              totalCreated += newArticles.length;
              console.log(`  ✓ ${newArticles.length} articles added for ${category}`);
            }
          } else {
            console.log(`  ℹ No new articles for ${category} (all already exist)`);
          }
        } else {
          console.log(`  ℹ No articles fetched for ${category}`);
        }
      } catch (categoryErr) {
        console.log(`  ✗ Error in category ${category}: ${categoryErr.message}`);
      }
    }

    // ─────────────────────────────────────────────
    // Generate viral articles
    // ─────────────────────────────────────────────
    try {
      console.log(`📡 Fetching viral articles...`);
      const articles = [];

      for (const source of VIRAL_SOURCES) {
        try {
          const response = await axios.get(source, { timeout: 8000 });
          const parsed = await xmlParser.parseStringPromise(response.data);
          const items = parsed.rss?.channel?.[0]?.item || [];

          items.slice(0, 10).forEach(item => {
            const url = item.link?.[0]?.$?.href || item.link?.[0] || item.guid?.[0];
            const title = item.title?.[0]?._ || item.title?.[0] || 'Untitled';

            if (url && title) {
              articles.push({
                title: String(title).trim(),
                source_url: String(url).trim(),
                source_name: extractDomain(String(url)),
                summary: String(item.description?.[0] || '').substring(0, 300),
                raw_content: String(item.description?.[0] || ''),
                category: 'viral',
                published_date: new Date(item.pubDate?.[0] || Date.now()),
                score: 5.0,
                image_url: null,
                is_draft: true,
                is_published: false
              });
            }
          });
        } catch (e) {
          console.log(`  ✗ Failed viral source: ${source.split('/')[2]}`);
        }
      }

      if (articles.length > 0) {
        const urls = articles.map(a => a.source_url);
        const { data: existing } = await supabaseAdmin
          .from('articles')
          .select('source_url')
          .in('source_url', urls);

        const existingUrls = new Set((existing || []).map(a => a.source_url));
        const newArticles = articles.filter(a => !existingUrls.has(a.source_url));

        if (newArticles.length > 0) {
          // Score viral articles
          for (let i = 0; i < newArticles.length; i++) {
            try {
              const a = newArticles[i];
              const scoreResp = await groq.chat.completions.create({
                model: 'mixtral-8x7b-32768',
                messages: [
                  {
                    role: 'system',
                    content: 'You are a viral content scorer. Score from 0 to 10 how viral this news headline is for an Indian audience. Reply with ONLY a single number like 8.0'
                  },
                  {
                    role: 'user',
                    content: `${a.title}`.substring(0, 300)
                  }
                ],
                max_tokens: 5,
                temperature: 0.3
              });
              const score = parseFloat(scoreResp.choices[0].message.content);
              newArticles[i].score = isNaN(score) ? 5.0 : Math.min(10, Math.max(0, score));
            } catch (e) {
              newArticles[i].score = 5.0;
            }
            await sleep(200);
          }

          // ✅ FIXED: Use upsert to safely skip duplicates
          const { error: insertErr } = await supabaseAdmin
            .from('articles')
            .upsert(newArticles, {
              onConflict: 'source_url',
              ignoreDuplicates: true
            });

          if (insertErr) {
            console.log(`  ✗ Viral insert error: ${insertErr.message}`);
          } else {
            totalCreated += newArticles.length;
            console.log(`  ✓ ${newArticles.length} viral articles added`);
          }
        } else {
          console.log(`  ℹ No new viral articles (all already exist)`);
        }
      }
    } catch (viralErr) {
      console.log(`  ✗ Viral fetch error: ${viralErr.message}`);
    }

    // ─────────────────────────────────────────────
    // Count high-quality draft articles
    // ─────────────────────────────────────────────
    const { count: highCount } = await supabaseAdmin
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('is_draft', true)
      .gte('score', 7.0);

    console.log(`✅ Done. Generated ${totalCreated} new articles.`);
    console.log(`📊 ${highCount || 0} draft articles with score ≥ 7.0`);

    return res.status(200).json({
      success: true,
      totalArticlesCreated: totalCreated,
      highScoreArticles: highCount || 0,
      message: `✅ Generated ${totalCreated} articles! ${highCount || 0} have score ≥ 7.0 ready for publishing.`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'News';
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}