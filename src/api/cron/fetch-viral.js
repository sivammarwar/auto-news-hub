// pages/api/cron/fetch-viral.js
// Runs daily at 3:00 AM UTC
// Finds the top 10 most viral/trending articles across ALL categories

import axios from 'axios';
import xml2js from 'xml2js';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const xmlParser = new xml2js.Parser();

// These RSS feeds are specifically chosen for viral/trending content
const VIRAL_SOURCES = [
  'https://feeds.feedburner.com/ndtvnews-top-stories',
  'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
  'https://www.thehindu.com/news/feeder/default.rss',
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://rss.cnn.com/rss/edition.rss',
  'https://news.ycombinator.com/rss', // Tech viral
  'https://www.reddit.com/r/worldnews/top/.rss?limit=25',
  'https://www.reddit.com/r/india/top/.rss?limit=25',
];

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('\n=== VIRAL CRON STARTED ===\n');
    const timestamp = new Date().toISOString();

    // ── Step 1: Fetch from all viral sources ──────────────────────────────
    console.log('📡 Fetching from viral sources...');
    const allArticles = [];

    for (const rssUrl of VIRAL_SOURCES) {
      try {
        const response = await axios.get(rssUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
          },
        });
        const parsed = await xmlParser.parseStringPromise(response.data);
        const items = parsed.rss?.channel?.[0]?.item || parsed.feed?.entry || [];

        items.forEach((item) => {
          const sourceUrl =
            item.link?.[0]?.$?.href || // Atom feeds
            item.link?.[0] ||
            item.guid?.[0];
          const title = item.title?.[0]?._ || item.title?.[0] || 'No title';

          if (sourceUrl && title && title !== 'No title') {
            allArticles.push({
              title: typeof title === 'string' ? title : title,
              sourceUrl: typeof sourceUrl === 'string' ? sourceUrl : sourceUrl._,
              sourceName: extractDomainFromUrl(
                typeof sourceUrl === 'string' ? sourceUrl : sourceUrl._
              ),
              rawContent: item.description?.[0] || item.summary?.[0] || '',
              imageUrl: extractImageFromContent(item.description?.[0]),
              publishedDate: new Date(item.pubDate?.[0] || item.updated?.[0] || Date.now()),
              category: 'viral',
            });
          }
        });

        console.log(`   ✓ ${items.length} items from ${extractDomainFromUrl(rssUrl)}`);
      } catch (err) {
        console.error(`   ✗ Failed ${rssUrl}: ${err.message}`);
      }
    }

    console.log(`\n📰 Total raw articles: ${allArticles.length}`);

    // ── Step 2: Deduplicate ───────────────────────────────────────────────
    const urls = allArticles.map((a) => a.sourceUrl);
    const { data: existing } = await supabaseAdmin
      .from('articles')
      .select('source_url')
      .in('source_url', urls);

    const existingUrls = new Set((existing || []).map((a) => a.source_url));
    const newArticles = allArticles.filter((a) => !existingUrls.has(a.sourceUrl));
    console.log(`✅ New articles after dedup: ${newArticles.length}`);

    if (newArticles.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No new viral articles found',
        timestamp,
      });
    }

    // ── Step 3: Score ALL articles with GPT to find the truly viral ones ──
    console.log('\n🤖 Scoring articles for virality...');
    const scored = [];

    for (const article of newArticles.slice(0, 50)) { // Score top 50 candidates
      try {
        const score = await scoreForVirality(article.title, article.rawContent);
        scored.push({ ...article, viralScore: score });
        await sleep(300); // Avoid OpenAI rate limits
      } catch (err) {
        console.error(`   ✗ Score error: ${err.message}`);
        scored.push({ ...article, viralScore: 5.0 });
      }
    }

    // ── Step 4: Pick TOP 10 by viral score ───────────────────────────────
    const top10 = scored
      .sort((a, b) => b.viralScore - a.viralScore)
      .slice(0, 10);

    console.log(`\n🏆 Top 10 viral articles selected`);
    top10.forEach((a, i) =>
      console.log(`   ${i + 1}. [${a.viralScore}/10] ${a.title.substring(0, 60)}...`)
    );

    // ── Step 5: Generate summaries for the top 10 ────────────────────────
    console.log('\n📝 Generating summaries...');
    const enriched = [];

    for (const article of top10) {
      try {
        const summary = await summarizeAsViral(article.title, article.rawContent);
        enriched.push({
          title: article.title,
          source_url: article.sourceUrl,
          source_name: article.sourceName,
          summary,
          raw_content: article.rawContent || null,
          category: 'viral',
          score: article.viralScore,
          image_url: article.imageUrl || null,
          published_date: article.publishedDate.toISOString(),
          is_published: true, // Viral articles publish immediately
        });
        await sleep(300);
      } catch (err) {
        console.error(`   ✗ Summary error: ${err.message}`);
      }
    }

    // ── Step 6: Insert into Supabase ──────────────────────────────────────
    if (enriched.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('articles')
        .insert(enriched)
        .select('id');

      if (error) throw error;
      console.log(`\n✅ Inserted ${data?.length} viral articles`);
    }

    // ── Step 7: Clean up old viral articles (keep only last 30 days) ──────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await supabaseAdmin
      .from('articles')
      .delete()
      .eq('category', 'viral')
      .lt('published_date', thirtyDaysAgo.toISOString());

    console.log('\n=== VIRAL CRON COMPLETED ===\n');

    return res.status(200).json({
      success: true,
      viralArticlesPublished: enriched.length,
      timestamp,
    });
  } catch (error) {
    console.error('\n❌ VIRAL CRON ERROR:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

// ── AI Functions ──────────────────────────────────────────────────────────────

async function scoreForVirality(title, content) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a viral content scoring AI.

Score this article 0-10 based on:
- Shock value or surprise factor
- Emotional reaction potential (anger, joy, awe, disbelief)
- Share-worthiness — would people forward this?
- Broad appeal (not niche — everyone would care)
- Headline strength

RETURN ONLY a single number. Example: "8.5"`,
        },
        {
          role: 'user',
          content: `Title: ${title}\n\nContent: ${(content || '').substring(0, 500)}`,
        },
      ],
      max_tokens: 5,
      temperature: 0.2,
    });

    const score = parseFloat(response.choices[0].message.content.trim());
    return isNaN(score) ? 5.0 : Math.min(10, Math.max(0, score));
  } catch {
    return 5.0;
  }
}

async function summarizeAsViral(title, content) {
  if (!content || content.length < 30) return title;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You summarize viral news articles. Your summaries should:
- Be punchy and engaging (not dry)
- Start with the most shocking/interesting fact
- Be 80-100 words
- Make the reader want to click the source
- Be factual — no invention or exaggeration`,
        },
        {
          role: 'user',
          content: `Summarize this viral article:\n\nTitle: ${title}\n\nContent: ${content.substring(0, 2000)}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.6,
    });

    return response.choices[0].message.content.trim();
  } catch {
    return content.substring(0, 300) + '...';
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function extractImageFromContent(content) {
  if (!content) return null;
  try {
    const match = content.match(/<img[^>]+src="([^">]+)"/);
    return match ? match[1] : null;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}