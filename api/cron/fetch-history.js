// api/cron/fetch-history.js
// ════════════════════════════════════════════════════════════════════════════
// WEEKLY DEEP HISTORY PIPELINE
// Schedule: "30 14 * * 6"  → every Saturday at 2:30 PM UTC
//
// What it does (zero human touch):
//   1. Picks a genuinely obscure, never-covered historical subject
//   2. Writes a 1200-1500 word deep-dive in Arjun Mehta's voice
//      — packed with specific dates, numbers, names, forgotten facts
//      — structured as a gripping narrative, not a Wikipedia summary
//   3. Generates 8 targeted Pexels image queries for the subject
//   4. Fetches 7-8 high-quality images from Pexels
//   5. Saves everything and auto-publishes if score ≥ 7.5
//
// Env vars required:
//   GROQ_API_KEY              — groq.com (free)
//   PEXELS_API_KEY       — pexels.com/api (free, 200 req/hr)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   CRON_SECRET
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

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const AUTO_PUBLISH_SCORE    = 7.5;  // higher bar for history — quality over speed
const TARGET_IMAGES         = 8;    // try for 8, accept minimum 4
const MIN_IMAGES_TO_PUBLISH = 4;
const IMAGE_MIN_WIDTH       = 800;

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

// ─── TOPIC POOL ───────────────────────────────────────────────────────────────
// Deliberately broad and varied — Groq picks a specific real subject within each
const TOPIC_POOL = [
  'a forgotten Indian king or queen whose military genius rivals any general in world history',
  'an Indian empire or dynasty that dominated trade routes but was erased from school textbooks',
  'a revolutionary scientific or mathematical discovery made in ancient India centuries before the West',
  'an Indian freedom fighter who took on the British in ways that history books never mention',
  'a lost city, port, or civilization from the Indian subcontinent that archaeologists are still uncovering',
  'an extraordinary woman from Indian history who broke every rule of her era and paid a brutal price',
  'a forgotten Indian inventor or engineer whose creation the entire world uses but never credits India',
  'a real historical mystery from India that experts have never fully explained',
  'a powerful merchant class, guild, or business empire from Indian history that controlled entire economies',
  'a secret chapter of the Mughal empire that mainstream historians skip over',
  'an Indian contribution to medicine, surgery, or astronomy that predates the commonly credited Western discovery',
  'a devastating famine, plague, or disaster in Indian history and the political cover-up behind it',
  'a forgotten Indian diplomat, spy, or strategist who changed the course of a major world event',
  'a pre-colonial Indian city that was larger and wealthier than any European city of its time',
  'an ancient Indian text or manuscript that contains knowledge so advanced it still confounds modern scientists',
];

// ─── Pexels fallback queries for history ────────────────────────────────────
const HISTORY_IMAGE_FALLBACKS = [
  'ancient india ruins archaeology',
  'india historical temple architecture',
  'mughal architecture india',
  'india ancient manuscript scroll',
  'india heritage fort palace',
  'indian history museum artifact',
  'india old city ruins stone',
  'ancient civilization ruins excavation',
];

// ════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`HISTORY PIPELINE STARTED — ${timestamp}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    // ── Step 1: Get previously covered titles to avoid repeats ───────────────
    const { data: prev } = await supabase
      .from('articles')
      .select('title, admin_notes')
      .eq('category', 'history')
      .order('published_date', { ascending: false })
      .limit(30);

    const prevTitles = (prev ?? []).map(a => `- ${a.title}`).join('\n');
    console.log(`Previously covered: ${prev?.length ?? 0} history articles`);

    // ── Step 2: Pick a specific obscure subject ───────────────────────────────
    const topicCategory = TOPIC_POOL[Math.floor(Math.random() * TOPIC_POOL.length)];
    console.log(`\nTopic category: "${topicCategory}"`);

    const subjectRaw = await groqCall(
      [
        {
          role: 'system',
          content:
            `You are a historian specialising in obscure, genuinely surprising true stories from Indian and world history.\n\n` +
            `Pick ONE specific, real, verifiable subject that fits this category: "${topicCategory}"\n\n` +
            `RULES:\n` +
            `- Must be 100% real and historically verified — no myths or legends\n` +
            `- Must be genuinely obscure — not something taught in school or covered by mainstream media\n` +
            `- Must have specific details: real names, real dates, real numbers\n` +
            `- Must NOT be any of these already-covered topics:\n${prevTitles || '(none yet)'}\n\n` +
            `Reply with ONLY the subject as a compelling title (10-15 words).\n` +
            `Example: "Rani Abbakka Chowta: The Queen Who Defeated Portuguese Warships Four Times"`,
        },
        {
          role: 'user',
          content: `Pick this week's history subject. Make it surprising and specific.`,
        },
      ],
      80
    );

    if (!subjectRaw) {
      return res.status(500).json({ error: 'Could not generate history subject', timestamp });
    }

    const subject = subjectRaw.trim().replace(/^["']|["']$/g, '');
    console.log(`\nSubject: "${subject}"`);

    await sleep(4000);

    // ── Step 3: Write the full deep-dive article ──────────────────────────────
    console.log(`\nWriting full 1200-1500 word article...`);

    const articleRaw = await groqCall(
      [
        {
          role: 'system',
          content:
            `You are ${AUTHOR_NAME}, ${AUTHOR_TAGLINE}.\n\nYOUR STYLE:\n${AUTHOR_BIO}\n\n` +

            `ARTICLE STRUCTURE — follow this exactly, written as flowing paragraphs (NO headers, NO bullet points):\n\n` +
            `1. THE HOOK (2-3 sentences): Open with the single most shocking or surprising fact about this subject. ` +
               `Something that makes the reader stop scrolling. A number, a date, a paradox, something that feels unbelievable but is true.\n\n` +
            `2. THE SETUP (100-150 words): Who, what, when, where. Give the reader just enough context ` +
               `to understand why this matters. Specific dates, specific places, specific names. No vague generalities.\n\n` +
            `3. THE RISE / THE STORY (300-400 words): The most impressive, detailed, surprising part of the story. ` +
               `This is where you pack in the facts nobody else covers. Specific numbers — army sizes, trade volumes, ` +
               `dates of battles, names of adversaries. Real quotes if any exist. The kind of detail that makes ` +
               `the reader think "how did I not know this?"\n\n` +
            `4. THE FORGOTTEN PART (200-250 words): The twist. The thing that was deliberately buried, ` +
               `misattributed, or forgotten. Why don't we know about this today? Who benefited from erasing this story? ` +
               `Be direct. Be opinionated. This is Arjun Mehta speaking — he calls things as they are.\n\n` +
            `5. THE MYSTERY OR THE FALL (150-200 words): How did it end? What remains unexplained? ` +
               `What do archaeologists, historians, or researchers still argue about? If there is an unsolved mystery, dig into it.\n\n` +
            `6. WHY IT MATTERS TODAY (100-150 words): Connect this to modern India or the modern world. ` +
               `What does this story tell us about today? Be sharp and direct — no vague "lessons from history" platitudes.\n\n` +
            `7. THE CLOSER (1 sentence): End with a single sharp one-liner that sticks in the reader's mind. ` +
               `The kind of line someone screenshots and shares.\n\n` +

            `QUALITY RULES:\n` +
            `- Total length: 1200-1500 words\n` +
            `- Every paragraph must contain at least one specific fact (date, number, name, place)\n` +
            `- NO phrases like "it is worth noting", "it is important to mention", "in conclusion"\n` +
            `- NO Wikipedia-style neutral tone — this is journalism with a point of view\n` +
            `- Use short punchy sentences mixed with longer analytical ones\n` +
            `- 100% factually accurate — if unsure of a specific detail, use approximate language ("roughly", "around", "estimates suggest")\n\n` +

            `IMAGE QUERY RULES:\n` +
            `Return "image_queries": exactly 8 Pexels search strings for this specific subject.\n` +
            `Think visually — what would make great editorial photos for this article?\n` +
            `Mix of: the place (ruins, city, landscape), the era (architecture, artifacts, maps), ` +
            `the action (battle, trade, exploration), and the atmosphere (ancient, historical, dramatic).\n` +
            `Each query: 3-5 words, descriptive, visual. No person names (Pexels won't have them).\n` +
            `Example for "Rani Abbakka vs Portuguese": ["indian queen warrior historical", "kerala coast ocean waves", ` +
            `"portuguese ship ocean historical", "ancient fort stone walls", "indian spice trade market", ` +
            `"malabar coast india aerial", "medieval battle warriors", "india heritage ruins archaeology"]\n\n` +

            `Return ONLY raw valid JSON — no markdown, no backticks:\n` +
            `{ "title": "compelling 12-18 word headline in Arjun Mehta's voice", ` +
            `"summary": "3-4 punchy sentences that make someone desperate to read this — tease the most surprising fact", ` +
            `"content": "full 1200-1500 word article as described above, paragraphs separated by \\n\\n", ` +
            `"score": 0-10, ` +
            `"image_queries": ["query1", "query2", "query3", "query4", "query5", "query6", "query7", "query8"] }`,
        },
        {
          role: 'user',
          content:
            `Write your deep-dive history article about: "${subject}"\n\n` +
            `Remember: 1200-1500 words, no headers, flowing paragraphs, packed with specific facts nobody else covers. Raw JSON only.`,
        },
      ],
      2200  // higher token limit for longer article
    );

    const parsed = extractJSON(articleRaw);
    if (!parsed?.title || !parsed?.summary || !parsed?.content) {
      console.log(`✗ Bad article response`);
      return res.status(500).json({ error: 'Failed to generate article', timestamp });
    }

    const score = clamp(parseFloat(String(parsed.score)) || 8.0, 0, 10);
    const wordCount = parsed.content.split(/\s+/).length;
    console.log(`✅ Article generated | ${wordCount} words | score ${score.toFixed(1)}`);
    console.log(`   Title: "${parsed.title}"`);

    // ── Step 4: Save article to DB ────────────────────────────────────────────
    const { data: saved, error: saveErr } = await supabase
      .from('articles')
      .insert({
        title:          parsed.title.substring(0, 255),
        source_url:     `https://ai-generated/history/${Date.now()}`,
        source_name:    AUTHOR_NAME,
        summary:        parsed.summary.substring(0, 600),
        raw_content:    parsed.content,
        category:       'history',
        score,
        published_date: new Date().toISOString(),
        is_draft:       true,
        is_published:   false,
        image_url:      null,
        admin_notes:    `Weekly history deep-dive. Subject: "${subject}" | ${wordCount} words`,
      })
      .select('id')
      .single();

    if (saveErr) {
      console.log(`✗ DB save failed: ${saveErr.message}`);
      return res.status(500).json({ error: saveErr.message, timestamp });
    }

    const articleId = saved.id;
    console.log(`\n✅ Article #${articleId} saved`);

    // ── Step 5: Fetch 7-8 images from Pexels ────────────────────────────────
    console.log(`\nFetching ${TARGET_IMAGES} images from Pexels...`);

    const imageQueries = Array.isArray(parsed.image_queries) && parsed.image_queries.length > 0
      ? parsed.image_queries
      : HISTORY_IMAGE_FALLBACKS;

    const imageCount = await fetchAndSaveImages(articleId, parsed.title, imageQueries);
    console.log(`Images saved: ${imageCount}`);

    // ── Step 6: Auto-publish if qualifies ─────────────────────────────────────
    let status = 'draft';
    if (score >= AUTO_PUBLISH_SCORE && imageCount >= MIN_IMAGES_TO_PUBLISH) {
      const { error: pubErr } = await supabase
        .from('articles')
        .update({
          is_published: true,
          is_draft:     false,
          updated_at:   new Date().toISOString(),
        })
        .eq('id', articleId);

      if (!pubErr) {
        status = 'published';
        console.log(`🚀 AUTO-PUBLISHED #${articleId}`);
      } else {
        console.log(`✗ Publish failed: ${pubErr.message}`);
      }
    } else {
      const reason = score < AUTO_PUBLISH_SCORE
        ? `score ${score.toFixed(1)} < ${AUTO_PUBLISH_SCORE}`
        : `only ${imageCount} images (need ${MIN_IMAGES_TO_PUBLISH})`;
      console.log(`📋 Kept as draft (${reason})`);
    }

    const durationSec = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`HISTORY PIPELINE DONE — ${durationSec}s`);
    console.log(`${'='.repeat(60)}\n`);

    return res.status(200).json({
      success:   true,
      timestamp,
      duration:  durationSec,
      article: {
        id:        articleId,
        title:     parsed.title,
        subject,
        score,
        wordCount,
        images:    imageCount,
        status,
      },
    });

  } catch (e) {
    console.error(`\n❌ HISTORY ERROR: ${e.message}`);
    return res.status(500).json({ error: e.message, timestamp });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// IMAGE PIPELINE — Wikimedia (persons/places) + Pexels (ruins/atmosphere)
// History articles target 7-8 images for rich visual storytelling
// ════════════════════════════════════════════════════════════════════════════
async function fetchAndSaveImages(articleId, title, imageQueries) {
  return hybridFetchAndSaveImages({
    supabase,
    articleId,
    title,
    category:          'history',
    imageQueries,
    targetImages:      TARGET_IMAGES,       // 8
    categoryFallbacks: HISTORY_IMAGE_FALLBACKS,
  });
}

// ════════════════════════════════════════════════════════════════════════════
// GROQ API CALL — with smart 429 handling
// ════════════════════════════════════════════════════════════════════════════
async function groqCall(messages, maxTokens, retries = 5) {
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

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════
function extractJSON(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrMatch) try { return JSON.parse(arrMatch[0]); } catch { /* fall through */ }
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) try { return JSON.parse(objMatch[0]); } catch { /* fall through */ }
  return null;
}

function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
function sleep(ms)         { return new Promise(r => setTimeout(r, ms)); }