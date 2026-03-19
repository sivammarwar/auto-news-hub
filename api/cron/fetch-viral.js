// api/cron/fetch-viral.js
// Uses GROQ API (FREE) instead of OpenAI
// Finds top 10 viral articles and scores them

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

const VIRAL_SOURCES = [
  'https://feeds.feedburner.com/ndtvnews-top-stories',
  'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
  'https://www.thehindu.com/news/feeder/default.rss',
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://rss.cnn.com/rss/edition.rss',
  'https://news.ycombinator.com/rss',
  'https://www.reddit.com/r/worldnews/top/.rss?limit=25',
  'https://www.reddit.com/r/india/top/.rss?limit=25',
];

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('\n=== FETCH-VIRAL CRON STARTED ===\n');
    const timestamp = new Date().toISOString();

    console.log('📡 Fetching from viral sources...');
    const allArticles = [];

    for (const rssUrl of VIRAL_SOURCES) {
      try {
        const response = await axios.get(rssUrl, {
          timeout: 10000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
        });
        const parsed = await xmlParser.parseStringPromise(response.data);
        const items = parsed.rss?.channel?.[0]?.item || parsed.feed?.entry || [];

        items.forEach(item => {
          const sourceUrl = item.link?.[0]?.$?.href || item.link?.[0] || item.guid?.[0];
          const title = item.title?.[0]?._ || item.title?.[0] || 'No title';

          if (sourceUrl && title && title !== 'No title') {
            allArticles.push({
              title: typeof title === 'string' ? title : String(title),
              sourceUrl: typeof sourceUrl === 'string' ? sourceUrl : sourceUrl._,
              sourceName: extractDomainFromUrl(typeof sourceUrl === 'string' ? sourceUrl : sourceUrl._),
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

    // Deduplicate
    const urls = allArticles.map(a => a.sourceUrl);
    const { data: existing } = await supabaseAdmin
      .from('articles')
      .select('source_url')
      .in('source_url', urls);

    const existingUrls = new Set((existing || []).map(a => a.source_url));
    const newArticles = allArticles.filter(a => !existingUrls.has(a.sourceUrl));
    console.log(`✅ New articles after dedup: ${newArticles.length}`);

    if (newArticles.length === 0) {
      return res.status(200).json({ success: true, message: 'No new viral articles found', timestamp });
    }

    // Score articles
    console.log('\n🤖 Scoring articles for virality with Groq...');
    const scored = [];

    for (const article of newArticles.slice(0, 50)) {
      try {
        const score = await scoreForVirality(article.title, article.rawContent);
        scored.push({ ...article, viralScore: score });
        await sleep(200);
      } catch {
        scored.push({ ...article, viralScore: 5.0 });
      }
    }

    // Pick top 10
    const top10 = scored.sort((a, b) => b.viralScore - a.viralScore).slice(0, 10);
    console.log(`\n🏆 Top 10 viral articles selected`);

    // Generate summaries
    console.log('\n📝 Generating summaries with Groq...');
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
          is_published: false,
          is_draft: true
        });
        await sleep(200);
      } catch (err) {
        console.error(`   ✗ Summary error: ${err.message}`);
      }
    }

    // Insert into Supabase
    if (enriched.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('articles')
        .insert(enriched)
        .select('id');

      if (error) throw error;
      console.log(`\n✅ Inserted ${data?.length} viral articles as drafts`);
    }

    console.log('\n=== FETCH-VIRAL CRON COMPLETED ===\n');

    return res.status(200).json({
      success: true,
      viralArticlesCreated: enriched.length,
      timestamp,
      message: `Created ${enriched.length} viral articles.`
    });

  } catch (error) {
    console.error('\n❌ FETCH-VIRAL CRON ERROR:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function scoreForVirality(title, content) {
  try {
    const response = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [
        { role: 'system', content: 'Score this article 0-10 for virality. RETURN ONLY a single number.' },
        { role: 'user', content: `Title: ${title}\n\nContent: ${(content || '').substring(0, 500)}` },
      ],
      max_tokens: 5,
      temperature: 0.2,
    });
    const score = parseFloat(response.choices[0].message.content.trim());
    return isNaN(score) ? 5.0 : Math.min(10, Math.max(0, score));
  } catch { return 5.0; }
}

async function summarizeAsViral(title, content) {
  if (!content || content.length < 30) return title;

  try {
    const response = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [
        { role: 'system', content: 'Summarize this viral article in 80-100 words. Start with the most shocking fact. Be punchy and factual.' },
        { role: 'user', content: `Title: ${title}\n\nContent: ${content.substring(0, 2000)}` },
      ],
      max_tokens: 150,
      temperature: 0.6,
    });
    return response.choices[0].message.content.trim();
  } catch { return content.substring(0, 300) + '...'; }
}

function extractImageFromContent(content) {
  if (!content) return null;
  try {
    const match = content.match(/<img[^>]+src="([^">]+)"/);
    return match ? match[1] : null;
  } catch { return null; }
}

function extractDomainFromUrl(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch { return 'News'; }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}