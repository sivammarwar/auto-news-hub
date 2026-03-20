// api/cron/fetch-viral.js
// ════════════════════════════════════════════════════════════════════════════
// VIRAL STORIES PIPELINE
// Schedule: "0 8 * * *"  → runs daily at 8 AM UTC
//
// What it does (zero human touch):
//   1. Fetches top stories from 6 viral RSS sources
//   2. Scores all headlines for virality in ONE Groq batch call
//   3. Takes top 10 by score
//   4. Rewrites each in Arjun Mehta's voice with spicy headline
//   5. Generates subject-specific image queries per article
//   6. Fetches 4 images per article from Pexels
//   7. Auto-publishes articles with score ≥ 7.0 and ≥ 1 image
// ════════════════════════════════════════════════════════════════════════════

import axios from 'axios';
import Groq   from 'groq-sdk';
import { createClient }        from '@supabase/supabase-js';
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

const TOP_N_ARTICLES        = 10;
const AUTO_PUBLISH_SCORE    = 7.0;
const MIN_IMAGES_TO_PUBLISH = 1;
const TARGET_IMAGES         = 4;
const IMAGE_MIN_WIDTH       = 800;
const INTER_ARTICLE_DELAY   = 8000;

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

const VIRAL_SOURCES = [
  'https://feeds.feedburner.com/ndtvnews-top-stories',
  'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
  'https://www.thehindu.com/news/feeder/default.rss',
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://rss.cnn.com/rss/edition.rss',
  'https://news.ycombinator.com/rss',
];

const VIRAL_IMAGE_FALLBACKS = [
  'india street crowd people',
  'urban india city life',
  'social media phone screen',
  'india public space market',
];

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(60)}\nVIRAL PIPELINE STARTED — ${timestamp}\n${'='.repeat(60)}\n`);

  let totalSaved = 0, totalPublished = 0;
  const results  = [];

  try {
    // ── Step 1: Fetch all headlines ───────────────────────────────────────────
    console.log('Fetching RSS sources...');
    const allHeadlines = [];
    for (const url of VIRAL_SOURCES) {
      try {
        const res = await axios.get(url, {
          timeout: 9000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
        });
        const matches = res.data.match(/<title[^>]*>([^<]{5,200})<\/title>/gi) ?? [];
        let count = 0;
        matches.forEach(m => {
          const t = m.replace(/<[^>]*>/g, '').trim();
          if (t && !t.includes('<!') && t.length > 10) { allHeadlines.push({ title: t, source: extractDomain(url) }); count++; }
        });
        console.log(`  ✓ ${extractDomain(url)}: ${count}`);
      } catch (e) { console.log(`  ✗ ${extractDomain(url)}: ${e.message}`); }
      await sleep(300);
    }

    // Deduplicate headlines
    const seenTitles = new Set();
    const unique = allHeadlines.filter(h => { if (seenTitles.has(h.title)) return false; seenTitles.add(h.title); return true; });
    console.log(`\nUnique headlines: ${unique.length}`);
    if (unique.length === 0) return res.status(200).json({ success: true, message: 'No headlines found', timestamp });

    // ── Step 2: Skip already-saved titles (last 48h) ──────────────────────────
    const { data: recent } = await supabase
      .from('articles').select('title').eq('category', 'viral')
      .gte('published_date', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
    const recentSet = new Set((recent ?? []).map(a => a.title.toLowerCase().substring(0, 50)));
    const fresh = unique.filter(h => !recentSet.has(h.title.toLowerCase().substring(0, 50)));
    console.log(`New after dedup: ${fresh.length}`);
    if (fresh.length === 0) return res.status(200).json({ success: true, message: 'No new stories', timestamp });

    // ── Step 3: Score top 30 in one batch call ────────────────────────────────
    console.log('\nScoring headlines...');
    const toScore = fresh.slice(0, 30);
    const scoringRaw = await groqCall([
      {
        role: 'system',
        content:
          `Score each headline 0-10 for virality with Indian audiences. ` +
          `Consider: emotional impact, shareability, controversy, surprise, relevance to Indians. ` +
          `Return ONLY a JSON array of numbers in the same order. Example: [7.5, 8.0, 6.0]`,
      },
      {
        role: 'user',
        content: `Score these ${toScore.length} headlines:\n` + toScore.map((h, i) => `${i + 1}. ${h.title}`).join('\n') + `\n\nReturn ONLY the JSON array.`,
      },
    ], 200);

    const scores = extractJSON(scoringRaw);
    const scored = toScore.map((h, i) => {
      const s = Array.isArray(scores) ? parseFloat(scores[i]) : 5.0;
      return { ...h, score: isNaN(s) ? 5.0 : clamp(s, 0, 10) };
    });

    const topStories = scored.sort((a, b) => b.score - a.score).slice(0, TOP_N_ARTICLES);
    console.log(`Top ${topStories.length} stories selected`);

    // ── Step 4: Write + image + publish each story ────────────────────────────
    for (const story of topStories) {
      console.log(`\n${'─'.repeat(50)}\n✍️  Writing: "${story.title.substring(0, 70)}"`);
      await sleep(INTER_ARTICLE_DELAY);

      const raw = await groqCall([
        {
          role: 'system',
          content:
            `You are ${AUTHOR_NAME}, ${AUTHOR_TAGLINE}.\n\nYOUR STYLE:\n${AUTHOR_BIO}\n\n` +
            `LEGAL: 100% ORIGINAL journalism. Not a rewrite. Your own voice only.\n\n` +
            `TITLE RULES:\n` +
            `- 12-20 words. Creates curiosity gap or emotional reaction.\n` +
            `- BANNED: plain copy of original headline\n` +
            `- Use one of:\n` +
            `  • "[X] Just Happened And Nobody Is Talking About What It Actually Means"\n` +
            `  • "The Real Reason [X] Is Happening And Why Every Indian Should Pay Attention"\n` +
            `  • "Stop Pretending [X] Is Normal — Here Is What Is Actually Going On"\n` +
            `  • "Why [X] Is The Biggest Story Nobody In India Is Taking Seriously Enough"\n\n` +
            `IMAGE QUERIES: exactly 4 Pexels search strings specific to this story.\n` +
            `- Famous person → their role/action not their name\n` +
            `- Famous place → search it directly\n` +
            `- Event → genre/atmosphere/location\n` +
            `- 3-5 words each\n\n` +
            `Return ONLY raw JSON:\n` +
            `{ "title": "SPICY 12-20 WORD TITLE", "summary": "2-3 punchy teaser sentences", ` +
            `"content": "400-500 word article paragraphs separated by \\n\\n ending with sharp one-liner", ` +
            `"score": 0-10, "image_queries": ["q1","q2","q3","q4"] }`,
        },
        {
          role: 'user',
          content: `Write your original viral piece based on: "${story.title}"\nSource: ${story.source}\nRaw JSON only.`,
        },
      ], 900);

      const parsed = extractJSON(raw);
      if (!parsed?.title || !parsed?.summary || !parsed?.content) { console.log(`   ✗ Bad response — skipping`); continue; }

      const finalScore = clamp(parseFloat(String(parsed.score)) || story.score, 0, 10);

      const { data: saved, error: saveErr } = await supabase.from('articles').insert({
        title:          parsed.title.substring(0, 255),
        source_url:     `https://ai-generated/viral/${Date.now()}`,
        source_name:    AUTHOR_NAME,
        summary:        parsed.summary.substring(0, 500),
        raw_content:    parsed.content,
        category:       'viral',
        score:          finalScore,
        published_date: new Date().toISOString(),
        is_draft:       true,
        is_published:   false,
        image_url:      null,
        admin_notes:    `Viral. Original: "${story.title.substring(0, 100)}"`,
      }).select('id').single();

      if (saveErr) { console.log(`   ✗ DB error: ${saveErr.message}`); continue; }

      totalSaved++;
      const articleId = saved.id;
      console.log(`   ✅ #${articleId} saved | score ${finalScore.toFixed(1)}`);

      const imageQueries = Array.isArray(parsed.image_queries) && parsed.image_queries.length > 0
        ? parsed.image_queries : VIRAL_IMAGE_FALLBACKS;
      const imageCount = await fetchAndSaveImages(articleId, parsed.title, imageQueries);
      console.log(`   🖼  Images: ${imageCount}`);

      if (finalScore >= AUTO_PUBLISH_SCORE && imageCount >= MIN_IMAGES_TO_PUBLISH) {
        const { error: pubErr } = await supabase.from('articles')
          .update({ is_published: true, is_draft: false, updated_at: new Date().toISOString() })
          .eq('id', articleId);
        if (!pubErr) {
          totalPublished++;
          console.log(`   🚀 AUTO-PUBLISHED #${articleId}`);
          results.push({ id: articleId, title: parsed.title, score: finalScore, status: 'published', images: imageCount });
        }
      } else {
        console.log(`   📋 Draft`);
        results.push({ id: articleId, title: parsed.title, score: finalScore, status: 'draft', images: imageCount });
      }
    }

    const durationSec = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n${'='.repeat(60)}\nVIRAL DONE — ${durationSec}s | Saved: ${totalSaved} | Published: ${totalPublished}\n${'='.repeat(60)}\n`);
    return res.status(200).json({ success: true, timestamp, durationSeconds: durationSec, totalSaved, totalPublished, articles: results });

  } catch (e) {
    console.error(`\n❌ VIRAL ERROR: ${e.message}`);
    return res.status(500).json({ error: e.message, timestamp });
  }
}

// ─── Hybrid image fetch + save (Wikimedia for persons/places, Pexels for rest) ──
async function fetchAndSaveImages(articleId, title, imageQueries) {
  return hybridFetchAndSaveImages({
    supabase,
    articleId,
    title,
    category:          'viral',
    imageQueries,
    targetImages:      TARGET_IMAGES,
    categoryFallbacks: VIRAL_IMAGE_FALLBACKS,
  });
}


function extractJSON(raw) {
  if (!raw) return null;
  const c = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try { return JSON.parse(c); } catch { /* fall through */ }
  const a = c.match(/\[[\s\S]*\]/); if (a) try { return JSON.parse(a[0]); } catch { /* fall through */ }
  const o = c.match(/\{[\s\S]*\}/); if (o) try { return JSON.parse(o[0]); } catch { /* fall through */ }
  return null;
}

function extractDomain(url) { try { return new URL(url).hostname.replace('www.', ''); } catch { return 'feed'; } }
function clamp(n, lo, hi)    { return Math.min(hi, Math.max(lo, n)); }
function sleep(ms)            { return new Promise(r => setTimeout(r, ms)); }async function groqCall(messages, maxTokens, retries = 5) {
  const maxTotal = retries * GROQ_KEYS.length;
  let totalAttempts = 0;
  while (totalAttempts < maxTotal) {
    totalAttempts++;
    const keyIdx     = currentKeyIndex;
    const groqClient = getActiveGroq();
    try {
      const r = await groqClient.chat.completions.create({
        model: 'llama-3.3-70b-versatile', messages, max_tokens: maxTokens, temperature: 0.75,
      });
      return r.choices[0]?.message?.content?.trim() ?? null;
    } catch (e) {
      const msg    = e?.message ?? '';
      const status = e?.status ?? 0;
      if (status === 429 || msg.includes('rate_limit') || msg.includes('Rate limit')) {
        if (msg.includes('tokens per day') || msg.includes('TPD')) {
          console.log(`   🔴 Key #${keyIdx + 1} daily limit hit — rotating`);
          markKeyExhausted(keyIdx, 24 * 60 * 60 * 1000);
          if (GROQ_KEYS.length === 1) await sleep(60_000);
          continue;
        }
        const waitMs = 62_000 + (totalAttempts * 2_000);
        console.log(`   ⏳ Key #${keyIdx + 1} RPM limit — waiting ${Math.round(waitMs / 1000)}s`);
        await sleep(waitMs);
        continue;
      }
      if (status === 503 || status === 500) { await sleep(totalAttempts * 6_000); continue; }
      console.log(`   ⚠ Groq error (key #${keyIdx + 1}): ${msg}`);
      await sleep(totalAttempts * 3_000);
    }
  }
  console.log(`   ✗ Groq: all keys and retries exhausted`);
  return null;
}