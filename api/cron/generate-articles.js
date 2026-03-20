// api/cron/generate-articles.js
// ════════════════════════════════════════════════════════════════════════════
// MASTER AUTONOMOUS PIPELINE
// Schedule: "0 2 * * *"  → runs daily at 2 AM UTC (7:30 AM IST)
//
// What it does (zero human touch):
//   1. Fetches live RSS headlines for all 11 categories
//   2. Picks 6 trending topics per category (66 articles total)
//   3. Writes full original articles in Arjun Mehta's voice (Groq)
//   4. Generates 4 subject-specific image search queries per article
//   5. Fetches images — Wikimedia for persons/places, Pexels for context
//   6. Saves images to article_images table
//   7. Verifies content in DB, then auto-publishes if score ≥ 7.0 + ≥ 1 image
//   8. Low-score articles saved as drafts for manual review
//
// Env vars required:
//   GROQ_API_KEY              — primary Groq key (groq.com)
//   GROQ_API_KEY_2            — second Groq key (optional, different account)
//   GROQ_API_KEY_3            — third Groq key  (optional, different account)
//   PEXELS_API_KEY            — pexels.com/api (free, 200 req/hr)
//   TMDB_API_KEY              — themoviedb.org (free, register at developers.themoviedb.org)
//   CRICAPI_KEY               — cricapi.com (free lifetime tier, 100 calls/day)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   CRON_SECRET
// ════════════════════════════════════════════════════════════════════════════

import axios from 'axios';
import Groq   from 'groq-sdk';
import { createClient }             from '@supabase/supabase-js';
import { hybridFetchAndSaveImages } from '../lib/image-pipeline.js';

// ─── Groq key rotator ─────────────────────────────────────────────────────────
const GROQ_KEYS = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY_3,
].filter(Boolean);

if (GROQ_KEYS.length === 0) throw new Error('No GROQ_API_KEY set in environment variables');

let currentKeyIndex   = 0;
let keyExhaustedUntil = {};

function getActiveGroq() {
  const now = Date.now();
  for (let i = 0; i < GROQ_KEYS.length; i++) {
    const idx = (currentKeyIndex + i) % GROQ_KEYS.length;
    if (!keyExhaustedUntil[idx] || keyExhaustedUntil[idx] < now) {
      currentKeyIndex = idx;
      return new Groq({ apiKey: GROQ_KEYS[idx] });
    }
  }
  const soonest = Object.entries(keyExhaustedUntil).sort((a, b) => a[1] - b[1])[0];
  currentKeyIndex = parseInt(soonest[0]);
  console.log(`   ⚠ All Groq keys exhausted — key #${currentKeyIndex + 1} recovers soonest`);
  return new Groq({ apiKey: GROQ_KEYS[currentKeyIndex] });
}

function markKeyExhausted(keyIdx, waitMs) {
  keyExhaustedUntil[keyIdx] = Date.now() + waitMs;
  console.log(`   🔑 Key #${keyIdx + 1} exhausted — rotating`);
  for (let i = 1; i < GROQ_KEYS.length; i++) {
    const next = (keyIdx + i) % GROQ_KEYS.length;
    if (!keyExhaustedUntil[next] || keyExhaustedUntil[next] < Date.now()) {
      currentKeyIndex = next;
      console.log(`   ✅ Switched to Groq key #${next + 1}`);
      return;
    }
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const ARTICLES_PER_CATEGORY   = 6;
const AUTO_PUBLISH_SCORE      = 7.0;
const MIN_IMAGES_TO_PUBLISH   = 1;
const TARGET_IMAGES           = 4;
const INTER_ARTICLE_DELAY_MS  = 8_000;
const INTER_CATEGORY_DELAY_MS = 3_000;
const BATCH_SIZE              = 10;
const BATCH_PAUSE_MS          = 25 * 60 * 1000;

// ─── AUTHOR PERSONA ───────────────────────────────────────────────────────────
const AUTHOR_NAME    = 'Arjun Mehta';
const AUTHOR_TAGLINE = 'Senior Correspondent, The Daily Pulse';
const AUTHOR_BIO =
  `Arjun Mehta is a 34-year-old investigative journalist from Mumbai with 11 years of experience ` +
  `covering politics, cricket, Bollywood, and technology for major Indian publications. ` +
  `He is known for his sharp, no-nonsense writing style — blunt, conversational, occasionally ` +
  `sarcastic, always factual. He does not write press releases. He writes like he is explaining ` +
  `a story to a smart friend over chai. He uses short punchy sentences mixed with longer analytical ones. ` +
  `He always asks "why does this matter to the average Indian?" and answers it in every article. ` +
  `He never uses corporate jargon. He never says "it is worth noting" or "it is important to mention". ` +
  `He calls things as they are. His opinions are informed and direct but always backed by facts. ` +
  `He ends every article with a sharp one-liner that sticks in the reader's mind.`;

// ─── NEWS SOURCES — 11 categories ────────────────────────────────────────────
const NEWS_SOURCES = {
  cricket:    { context: 'Indian cricket IPL Test matches BCCI player news controversies',
                feeds: ['https://www.thehindu.com/sport/cricket/feeder/default.rss', 'https://timesofindia.indiatimes.com/rssfeeds/4719148.cms'] },
  bollywood:  { context: 'Bollywood movies celebrity gossip box office OTT releases controversies',
                feeds: ['https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms', 'https://www.thehindu.com/entertainment/feeder/default.rss'] },
  technology: { context: 'AI Indian startups global tech companies gadgets software funding',
                feeds: ['https://news.ycombinator.com/rss', 'https://timesofindia.indiatimes.com/rssfeeds/66949542.cms'] },
  viral:      { context: 'Trending viral news shocking stories human interest outrage India',
                feeds: ['https://feeds.feedburner.com/ndtvnews-top-stories', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms'] },
  business:   { context: 'Indian economy corporate news startup funding RBI government policy',
                feeds: ['https://timesofindia.indiatimes.com/rssfeeds/1898055.cms', 'https://www.thehindu.com/business/feeder/default.rss'] },
  sports:     { context: 'Football kabaddi wrestling badminton chess Olympics Indian sports',
                feeds: ['https://feeds.feedburner.com/ndtvnews-sports', 'https://www.thehindu.com/sport/feeder/default.rss'] },
  india:      { context: 'Indian politics government policy social issues national events elections',
                feeds: ['https://feeds.feedburner.com/ndtvnews-india-news', 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms'] },
  world:      { context: 'International news affecting India US politics Middle East China geopolitics',
                feeds: ['https://feeds.bbci.co.uk/news/world/rss.xml', 'https://feeds.feedburner.com/ndtvnews-world-news'] },
  health:     { context: 'Health medicine fitness Indian healthcare wellness mental health',
                feeds: ['https://timesofindia.indiatimes.com/rssfeeds/3908999.cms', 'https://feeds.bbci.co.uk/news/health/rss.xml'] },
  science:    { context: 'Space ISRO scientific discoveries environment climate change',
                feeds: ['https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'https://timesofindia.indiatimes.com/rssfeeds/2647163.cms'] },
  stocks:     { context: 'NSE BSE Nifty Sensex Indian stock market equity mutual funds IPO trading investing',
                feeds: ['https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', 'https://www.moneycontrol.com/rss/marketreports.xml', 'https://feeds.feedburner.com/ndtvnews-business'] },
};

// ─── Pexels fallback queries per category ────────────────────────────────────
const CATEGORY_IMAGE_FALLBACKS = {
  cricket:    ['cricket sport bat ball',     'cricket stadium crowd',   'sport india',            'cricket player action'],
  bollywood:  ['bollywood cinema hall',       'film production set',     'stage performance',       'indian entertainment'],
  technology: ['technology laptop code',      'startup office india',    'artificial intelligence', 'digital screen data'],
  viral:      ['india street crowd',          'urban india people',      'social media phone',      'india public space'],
  business:   ['stock market trading',        'business meeting india',  'rupee currency finance',  'corporate office'],
  sports:     ['sport stadium athlete',       'football match action',   'olympic sport training',  'sports arena india'],
  india:      ['india new delhi city',        'indian culture festival', 'india parliament',        'india street market'],
  world:      ['world map globe',             'city skyline night',      'airport international',   'global summit'],
  health:     ['doctor hospital india',       'medical healthcare',      'yoga wellness fitness',   'medicine pharmacy'],
  science:    ['rocket launch fire',          'science laboratory',      'space stars galaxy',      'nature forest india'],
  stocks:     ['stock market trading screen', 'nse bse india exchange',  'indian investor money',   'sensex nifty chart'],
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime       = Date.now();
  const timestamp       = new Date().toISOString();
  const totalCategories = Object.keys(NEWS_SOURCES).length;
  const totalTarget     = totalCategories * ARTICLES_PER_CATEGORY;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`AUTONOMOUS PIPELINE STARTED — ${timestamp}`);
  console.log(`Categories: ${totalCategories} | Per category: ${ARTICLES_PER_CATEGORY} | Total: ${totalTarget}`);
  console.log(`Auto-publish: score ≥ ${AUTO_PUBLISH_SCORE} + DB content verified`);
  console.log(`${'='.repeat(60)}\n`);

  let totalSaved         = 0;
  let totalPublished     = 0;
  let totalDrafts        = 0;
  let totalImagesFetched = 0;
  let globalIdx          = 0;
  const results          = [];

  try {
    for (const [category, config] of Object.entries(NEWS_SOURCES)) {
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`📰 ${category.toUpperCase()}`);
      console.log(`${'─'.repeat(50)}`);

      // ── Step 1: Fetch headlines ──────────────────────────────────────────
      const headlines = await fetchHeadlines(config.feeds);
      console.log(`   Headlines: ${headlines.length}`);

      const headlineContext = headlines.length > 0
        ? headlines.slice(0, 20).map((h, i) => `${i + 1}. ${h}`).join('\n')
        : `[No live feed — use knowledge of: ${config.context}]`;

      // ── Step 2: Pick topics ──────────────────────────────────────────────
      const topicsRaw = await groqCall([
        {
          role: 'system',
          content:
            `You are a trending news analyst for Indian audiences. ` +
            `Return a JSON array of exactly ${ARTICLES_PER_CATEGORY} specific trending topics for: ${category}. ` +
            `Context: ${config.context}. ` +
            `Return ONLY the raw JSON array — no markdown, no backticks. ` +
            `Example: ["Topic one", "Topic two", "Topic three"]`,
        },
        {
          role: 'user',
          content: headlines.length > 0
            ? `${category.toUpperCase()} headlines:\n${headlineContext}\n\nReturn JSON array of ${ARTICLES_PER_CATEGORY} topics. Raw JSON only.`
            : `Generate JSON array of ${ARTICLES_PER_CATEGORY} trending ${category} topics for Indian audiences. Raw JSON only.`,
        },
      ], 300);

      const topics = extractJSON(topicsRaw);
      if (!Array.isArray(topics) || topics.length === 0) {
        console.log(`   ✗ No topics — skipping`);
        continue;
      }

      const validTopics = topics.filter(t => typeof t === 'string' && t.trim().length > 3).slice(0, ARTICLES_PER_CATEGORY);
      console.log(`   ✅ Topics: ${validTopics.join(' | ')}`);

      // ── Step 3: Write each article ───────────────────────────────────────
      for (const topic of validTopics) {
        globalIdx++;
        console.log(`\n   ✍️  [${globalIdx}/${totalTarget}] "${topic}"`);

        // Batch pause every 10 articles
        if (globalIdx > 1 && (globalIdx - 1) % BATCH_SIZE === 0) {
          const pm = Math.round(BATCH_PAUSE_MS / 60_000);
          console.log(`\n⏸️  Batch pause — waiting ${pm} min...`);
          await sleep(BATCH_PAUSE_MS);
          console.log(`▶️  Resuming...`);
        }

        await sleep(INTER_ARTICLE_DELAY_MS);

        const raw = await groqCall([
          {
            role: 'system',
            content:
              `You are ${AUTHOR_NAME}, ${AUTHOR_TAGLINE}.\n\nYOUR STYLE:\n${AUTHOR_BIO}\n\n` +
              `LEGAL: 100% ORIGINAL journalism. Not a rewrite. Your own voice only.\n\n` +
              `TITLE RULES:\n` +
              `- 12–20 words. Creates curiosity gap or emotional reaction.\n` +
              `- BANNED: plain summaries like "Nifty Falls 200 Points" or "Kohli Trains"\n` +
              `- Use one of:\n` +
              `  • "[X] Just Did [Thing] And Nobody Is Talking About What It Actually Means"\n` +
              `  • "The Real Reason [X] Is Happening And Why Every Indian Should Pay Attention"\n` +
              `  • "Stop Pretending [X] Is Normal — Here Is What Is Actually Going On"\n` +
              `  • "Why [X] Is The Biggest Story Nobody In India Is Taking Seriously Enough"\n` +
              `  • "[X] Just Happened — Here Is Why Your [Wallet/Portfolio/Future] Will Feel It"\n\n` +
              `IMAGE QUERY RULES (4 Pexels/Wikimedia search strings):\n` +
              `- Famous person → their role not name (e.g. "stock market trader india")\n` +
              `- Famous place → search directly (e.g. "dalal street mumbai", "nse building")\n` +
              `- Finance/stocks → visual concepts (e.g. "stock chart trading screen", "sensex graph")\n` +
              `- 3–6 words each\n\n` +
              `Return ONLY raw JSON:\n` +
              `{ "title": "...", "summary": "2-3 punchy teaser sentences", "content": "500-700 word article paragraphs separated by \\n\\n ending with sharp one-liner", "score": 0-10, "image_queries": ["q1","q2","q3","q4"] }`,
          },
          {
            role: 'user',
            content:
              `Write your original ${category} piece on: "${topic}"\n` +
              `Context: ${config.context}\n` +
              (headlines.length > 0
                ? `Background (do NOT copy): ${headlines.slice(0, 3).map(h => `- ${h}`).join('\n')}`
                : 'Write from your own knowledge.') +
              `\n\nSpicy title + 4 image_queries. Raw JSON only.`,
          },
        ], 1300);

        const parsed = extractJSON(raw);
        if (!parsed?.title || !parsed?.summary || !parsed?.content) {
          console.log(`   ✗ Bad response — skipping`);
          continue;
        }

        const score = clamp(parseFloat(String(parsed.score)) || 7.5, 0, 10);

        // ── Step 4: Save ─────────────────────────────────────────────────────
        const { data: saved, error: saveErr } = await supabase
          .from('articles')
          .insert({
            title:          parsed.title.substring(0, 255),
            source_url:     `https://ai-generated/${category}/${Date.now()}`,
            source_name:    AUTHOR_NAME,
            summary:        parsed.summary.substring(0, 500),
            raw_content:    parsed.content,
            category,
            score,
            published_date: new Date().toISOString(),
            is_draft:       true,
            is_published:   false,
            image_url:      null,
            admin_notes:    `Auto. Topic: "${topic}"`,
          })
          .select('id')
          .single();

        if (saveErr) { console.log(`   ✗ DB error: ${saveErr.message}`); continue; }

        totalSaved++;
        const articleId = saved.id;
        console.log(`   ✅ #${articleId} | score ${score.toFixed(1)}`);

        // ── Step 5: Images ───────────────────────────────────────────────────
        const imageQueries = Array.isArray(parsed.image_queries) && parsed.image_queries.length > 0
          ? parsed.image_queries
          : CATEGORY_IMAGE_FALLBACKS[category] ?? ['india news'];

        const imageCount = await fetchAndSaveImages(articleId, parsed.title, category, imageQueries);
        totalImagesFetched += imageCount;

        // ── Step 6: Verify then publish ──────────────────────────────────────
        if (score >= AUTO_PUBLISH_SCORE && imageCount >= MIN_IMAGES_TO_PUBLISH && parsed.content?.trim().length > 100) {
          const { data: verify } = await supabase
            .from('articles').select('raw_content, image_url').eq('id', articleId).single();

          if (verify?.raw_content?.length > 100 && verify?.image_url) {
            const { error: pubErr } = await supabase
              .from('articles')
              .update({ is_published: true, is_draft: false, updated_at: new Date().toISOString() })
              .eq('id', articleId);

            if (!pubErr) {
              totalPublished++;
              console.log(`   🚀 PUBLISHED #${articleId}`);
              results.push({ id: articleId, title: parsed.title, score, status: 'published', images: imageCount });
            } else {
              totalDrafts++;
              results.push({ id: articleId, title: parsed.title, score, status: 'draft', images: imageCount });
            }
          } else {
            totalDrafts++;
            console.log(`   ⚠ DB check failed — draft`);
            results.push({ id: articleId, title: parsed.title, score, status: 'draft', images: imageCount });
          }
        } else {
          totalDrafts++;
          console.log(`   📋 Draft`);
          results.push({ id: articleId, title: parsed.title, score, status: 'draft', images: imageCount });
        }
      }

      await sleep(INTER_CATEGORY_DELAY_MS);
    }

    const durationSec = Math.round((Date.now() - startTime) / 1000);
    console.log(`\nPIPELINE DONE — ${durationSec}s | Saved: ${totalSaved} | Published: ${totalPublished} | Images: ${totalImagesFetched}\n`);

    return res.status(200).json({
      success: true, timestamp, durationSeconds: durationSec,
      totalSaved, totalPublished, totalDrafts, totalImagesFetched, articles: results,
    });

  } catch (e) {
    console.error(`PIPELINE ERROR: ${e.message}`);
    return res.status(500).json({ error: e.message, timestamp });
  }
}

// ─── Image pipeline ───────────────────────────────────────────────────────────
async function fetchAndSaveImages(articleId, title, category, imageQueries) {
  return hybridFetchAndSaveImages({
    supabase, articleId, title, category, imageQueries,
    targetImages:      TARGET_IMAGES,
    categoryFallbacks: CATEGORY_IMAGE_FALLBACKS[category],
  });
}

// ─── Groq with key rotation ───────────────────────────────────────────────────
async function groqCall(messages, maxTokens, retries = 5) {
  const maxTotal = retries * GROQ_KEYS.length;
  let attempts   = 0;

  while (attempts < maxTotal) {
    attempts++;
    const keyIdx     = currentKeyIndex;
    const groqClient = getActiveGroq();
    try {
      const r = await groqClient.chat.completions.create({
        model: 'llama-3.3-70b-versatile', messages, max_tokens: maxTokens, temperature: 0.75,
      });
      return r.choices[0]?.message?.content?.trim() ?? null;
    } catch (e) {
      const msg    = e?.message ?? '';
      const status = e?.status  ?? 0;
      if (status === 429 || msg.includes('rate_limit')) {
        if (msg.includes('tokens per day') || msg.includes('TPD')) {
          markKeyExhausted(keyIdx, 24 * 60 * 60 * 1000);
          if (GROQ_KEYS.length === 1) await sleep(60_000);
          continue;
        }
        await sleep(62_000 + attempts * 2_000);
        continue;
      }
      if (status === 503 || status === 500) { await sleep(attempts * 6_000); continue; }
      await sleep(attempts * 3_000);
    }
  }
  return null;
}

// ─── RSS ──────────────────────────────────────────────────────────────────────
async function fetchHeadlines(feedUrls) {
  const headlines = [];
  for (const url of feedUrls) {
    try {
      const res = await axios.get(url, { timeout: 9000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const matches = res.data.match(/<title[^>]*>([^<]{5,200})<\/title>/gi) ?? [];
      matches.forEach(m => { const t = m.replace(/<[^>]*>/g,'').trim(); if (t && t.length > 5) headlines.push(t); });
    } catch { /* skip */ }
    await sleep(300);
  }
  return [...new Set(headlines)];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractJSON(raw) {
  if (!raw) return null;
  const c = raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
  try { return JSON.parse(c); } catch {}
  const a = c.match(/\[[\s\S]*\]/); if (a) try { return JSON.parse(a[0]); } catch {}
  const o = c.match(/\{[\s\S]*\}/); if (o) try { return JSON.parse(o[0]); } catch {}
  return null;
}
function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
function sleep(ms)         { return new Promise(r => setTimeout(r, ms)); }