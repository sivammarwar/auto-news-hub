import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Trash2, Zap, RefreshCw, CheckSquare, Square, X, Clock, Globe } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Article {
  id: number;
  title: string;
  summary: string;
  raw_content?: string;
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
interface GenLog {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warn' | 'progress';
  ts: string;
}

// ════════════════════════════════════════════════════════════════════════════
// AUTHOR PERSONA
// ════════════════════════════════════════════════════════════════════════════
const AUTHOR = {
  name:    'Arjun Mehta',
  tagline: 'Senior Correspondent, The Daily Pulse',
  bio:
    `Arjun Mehta is a 34-year-old investigative journalist from Mumbai with 11 years of experience ` +
    `covering politics, cricket, Bollywood, and technology for major Indian publications. ` +
    `He is known for his sharp, no-nonsense writing style — blunt, conversational, occasionally ` +
    `sarcastic, always factual. He does not write press releases. He writes like he is explaining ` +
    `a story to a smart friend over chai. He uses short punchy sentences mixed with longer analytical ones. ` +
    `He always asks "why does this matter to the average Indian?" and answers it in every article. ` +
    `He never uses corporate jargon. He never says "it is worth noting" or "it is important to mention". ` +
    `He calls things as they are. His opinions are informed and direct but always backed by facts. ` +
    `He ends every article with a sharp one-liner that sticks in the reader's mind.`,
};

// ════════════════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════════════════
const BATCH_SIZE               = 10;         // publish 10 articles, then take a long break
const BATCH_PAUSE_MS           = 25 * 60 * 1000; // 25 min break after every 10 articles
const INTER_ARTICLE_PAUSE_MS   = 8_000;      // 8s between articles — safe under Groq 30 RPM
const GROQ_TIMEOUT_MS          = 40_000;
const MAX_RETRIES               = 5;
const ARTICLES_PER_CATEGORY     = 6;
const AUTO_PUBLISH_SCORE        = 7.0;
const HISTORY_AUTO_PUBLISH_SCORE = 7.5;
const HISTORY_TARGET_IMAGES      = 8;
const HISTORY_MIN_IMAGES         = 4;

const HISTORY_TOPIC_POOL = [
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
const MIN_IMAGES_TO_PUBLISH     = 1;
const TARGET_IMAGES_PER_ARTICLE = 4;
const IMAGE_MIN_WIDTH           = 800;   // Pexels 'regular' is ~1080px, always passes

// ─── NEWS SOURCES ─────────────────────────────────────────────────────────────
const NEWS_SOURCES: Record<string, { feeds: string[]; context: string }> = {
  cricket:    { context: 'Indian cricket IPL Test matches BCCI player news controversies', feeds: ['https://www.thehindu.com/sport/cricket/feeder/default.rss', 'https://timesofindia.indiatimes.com/rssfeeds/4719148.cms', 'https://feeds.feedburner.com/ndtvnews-sports'] },
  bollywood:  { context: 'Bollywood movies celebrity gossip box office OTT releases film controversies', feeds: ['https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms', 'https://www.thehindu.com/entertainment/feeder/default.rss', 'https://feeds.feedburner.com/ndtvnews-entertainment'] },
  technology: { context: 'AI Indian startups global tech companies gadgets software funding news', feeds: ['https://news.ycombinator.com/rss', 'https://feeds.theverge.com/rss/index.xml', 'https://timesofindia.indiatimes.com/rssfeeds/66949542.cms'] },
  viral:      { context: 'Trending viral news shocking stories human interest feel-good outrage India', feeds: ['https://feeds.feedburner.com/ndtvnews-top-stories', 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 'https://feeds.bbci.co.uk/news/world/rss.xml'] },
  business:   { context: 'Indian stock market economy corporate news startup funding RBI government policy', feeds: ['https://timesofindia.indiatimes.com/rssfeeds/1898055.cms', 'https://feeds.feedburner.com/ndtvnews-business', 'https://www.thehindu.com/business/feeder/default.rss'] },
  sports:     { context: 'Football kabaddi wrestling badminton chess Olympics Indian sports beyond cricket', feeds: ['https://timesofindia.indiatimes.com/rssfeeds/4719148.cms', 'https://feeds.feedburner.com/ndtvnews-sports', 'https://www.thehindu.com/sport/feeder/default.rss'] },
  india:      { context: 'Indian politics government policy social issues national events elections', feeds: ['https://feeds.feedburner.com/ndtvnews-india-news', 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms', 'https://www.thehindu.com/news/national/feeder/default.rss'] },
  world:      { context: 'International news affecting India US politics Middle East China geopolitics', feeds: ['https://feeds.bbci.co.uk/news/world/rss.xml', 'https://feeds.feedburner.com/ndtvnews-world-news', 'https://rss.cnn.com/rss/edition.rss'] },
  health:     { context: 'Health medicine fitness Indian healthcare wellness mental health medical breakthroughs', feeds: ['https://timesofindia.indiatimes.com/rssfeeds/3908999.cms', 'https://feeds.feedburner.com/ndtvnews-health', 'https://feeds.bbci.co.uk/news/health/rss.xml'] },
  science:    { context: 'Space ISRO scientific discoveries environment climate change nature', feeds: ['https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'https://timesofindia.indiatimes.com/rssfeeds/2647163.cms', 'https://www.thehindu.com/sci-tech/feeder/default.rss'] },
  stocks:     { context: 'NSE BSE Nifty Sensex Indian stock market equity mutual funds IPO trading investing', feeds: ['https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms', 'https://www.moneycontrol.com/rss/marketreports.xml', 'https://feeds.feedburner.com/ndtvnews-business'] },
};

// ─── CORS Proxies ─────────────────────────────────────────────────────────────
const CORS_PROXIES = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const nowTS  = () => new Date().toLocaleTimeString('en-IN', { hour12: false });
const domain = (url: string) => { try { return new URL(url).hostname.replace('www.', ''); } catch { return 'feed'; } };
const sleep  = (ms: number) => new Promise(r => setTimeout(r, ms));
const clamp  = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function parseRSS(xml: string): { title: string; description: string }[] {
  try {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return Array.from(doc.querySelectorAll('item')).map(el => ({
      title:       el.querySelector('title')?.textContent?.trim() ?? '',
      description: (el.querySelector('description')?.textContent ?? '').replace(/<[^>]*>/g, '').trim().substring(0, 200),
    })).filter(i => i.title.length > 4 && !i.title.includes('<!'));
  } catch { return []; }
}

async function fetchHeadlines(url: string): Promise<{ title: string; description: string }[]> {
  for (const proxy of CORS_PROXIES) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(proxy(url), { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const txt = await res.text();
      if (txt.trim().startsWith('<!DOCTYPE') || txt.trim().startsWith('<html')) continue;
      const items = parseRSS(txt);
      if (items.length > 0) return items;
    } catch { /* next proxy */ }
  }
  return [];
}

// ─── Groq API with key rotation on rate limits ───────────────────────────────
// Detects TPD (daily) vs RPM (per-minute) limits and handles each correctly:
//   TPD → rotate to next key immediately (resets at midnight UTC)
//   RPM → wait 62s and retry same key (resets every minute)
async function groqRequest(
  key: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
  label: string,
  log: (m: string, t: GenLog['type']) => void,
  allKeys?: string[],
  keyExhaustedRef?: Record<number, number>,
  keyIndexRef?: { value: number },
  pipelineSignal?: AbortSignal
): Promise<string | null> {
  const keys       = allKeys ?? [key];
  const exhausted  = keyExhaustedRef ?? {};
  const idxRef     = keyIndexRef ?? { value: 0 };
  const maxTotal   = MAX_RETRIES * keys.length;

  for (let attempt = 1; attempt <= maxTotal; attempt++) {
    // If Stop was clicked — bail out immediately, don't save anything
    if (pipelineSignal?.aborted) return null;

    // Pick active key
    const now = Date.now();
    for (let i = 0; i < keys.length; i++) {
      const idx = (idxRef.value + i) % keys.length;
      if (!exhausted[idx] || exhausted[idx] < now) { idxRef.value = idx; break; }
    }
    const activeKey = keys[idxRef.value];
    const keyLabel  = keys.length > 1 ? ` [key#${idxRef.value + 1}]` : '';

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), GROQ_TIMEOUT_MS);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeKey}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, max_tokens: maxTokens, temperature: 0.75 }),
      });
      clearTimeout(t);

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        const errMsg: string = body?.error?.message ?? '';
        const isTPD = errMsg.includes('tokens per day') || errMsg.includes('TPD');

        if (isTPD) {
          log(`🔴 [${label}]${keyLabel} Daily limit hit — rotating to next key`, 'warn');
          exhausted[idxRef.value] = Date.now() + 24 * 60 * 60 * 1000;
          if (keys.length === 1) {
            log(`⚠️ Only 1 Groq key — add VITE_GROQ_API_KEY_2 for seamless rotation`, 'warn');
            await sleep(60_000);
          }
          continue; // try next key immediately
        }

        // RPM limit — wait and retry same key
        const ra = parseInt(res.headers.get('retry-after') ?? '0', 10);
        const waitMs = Math.max(ra * 1000, 62_000) + (attempt * 2_000);
        log(`⏳ [${label}]${keyLabel} RPM limit — waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt})`, 'warn');
        await sleep(waitMs);
        continue;
      }
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        log(`⚠️ [${label}]${keyLabel} HTTP ${res.status} — attempt ${attempt}`, 'warn');
        await sleep(6000 * Math.ceil(attempt / keys.length));
        continue;
      }

      clearTimeout(t);
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim() ?? null;
      if (!text) { log(`⚠️ [${label}] Empty response — attempt ${attempt}`, 'warn'); await sleep(3000); continue; }
      return text;
    } catch (e: any) {
      clearTimeout(t);
      const msg = e?.name === 'AbortError' ? `Timeout after ${GROQ_TIMEOUT_MS / 1000}s` : (e?.message ?? 'unknown error');
      log(`⚠️ [${label}]${keyLabel} ${msg} — attempt ${attempt}`, 'warn');
      await sleep(4000 * Math.ceil(attempt / keys.length));
    }
  }
  log(`✗ [${label}] All keys and retries exhausted`, 'error');
  return null;
}


// ════════════════════════════════════════════════════════════════════════════
// FIX: Robust JSON extractor
// Handles: markdown fences, arrays AND objects, extra text before/after JSON
// ════════════════════════════════════════════════════════════════════════════
function extractJSON<T>(raw: string | null): T | null {
  if (!raw) return null;

  // Step 1: Aggressively strip ALL markdown fences and surrounding text
  let cleaned = raw.trim();
  // Remove ``` fences with optional language tag and optional space
  cleaned = cleaned.replace(/^`{1,3}(?:json)?\s*/i, '').replace(/\s*`{1,3}\s*$/g, '').trim();

  // Step 2: fixControlChars — convert literal \n \r \t inside JSON strings to escape seqs
  function fixControlChars(s: string): string {
    const out: string[] = [];
    let inStr = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const prev = i > 0 ? s[i - 1] : '';
      if (ch === '"' && prev !== '\\') inStr = !inStr;
      if (inStr && ch === '\n') { out.push('\\n'); continue; }
      if (inStr && ch === '\r') { out.push('\\r'); continue; }
      if (inStr && ch === '\t') { out.push('\\t'); continue; }
      out.push(ch);
    }
    return out.join('');
  }

  // Step 3: Try parse attempts in order
  const attempts = [
    cleaned,
    fixControlChars(cleaned),
  ];

  // Also try extracting just the {...} or [...] portion
  const objM = cleaned.match(/\{[\s\S]*\}/);
  const arrM = cleaned.match(/\[[\s\S]*\]/);
  if (objM) attempts.push(objM[0], fixControlChars(objM[0]));
  if (arrM) attempts.push(arrM[0], fixControlChars(arrM[0]));

  for (const attempt of attempts) {
    try { return JSON.parse(attempt) as T; } catch { /* try next */ }
  }

  // Step 4: Field-by-field extraction for severely malformed JSON
  // Use the cleaned string with control chars fixed
  const fixed = fixControlChars(cleaned);

  const titleM   = fixed.match(/"title"\s*:\s*"([^"]{5,255})"/);
  const summaryM = fixed.match(/"summary"\s*:\s*"([^"]{10,500})"/);
  const scoreM   = fixed.match(/"score"\s*:\s*([\d.]+)/);
  const imgM     = fixed.match(/"image_queries"\s*:\s*(\[[^\]]*\])/);

  // Extract content — everything between "content": " and the next top-level field
  const contentM = fixed.match(/"content"\s*:\s*"([\s\S]{50,}?)"\s*,\s*"(?:score|image_queries)"/)
    || fixed.match(/"content"\s*:\s*"([\s\S]{50,}?)"\s*\}/)
    || fixed.match(/"content"\s*:\s*"([\s\S]{50,})/);

  if (titleM && contentM) {
    const rawContent = contentM[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\t/g, '\t')
      .trim();
    // Trim to last complete sentence
    const lastStop = Math.max(rawContent.lastIndexOf('.'), rawContent.lastIndexOf('।'), rawContent.lastIndexOf('!'), rawContent.lastIndexOf('?'));
    const content = lastStop > 100 ? rawContent.substring(0, lastStop + 1) : rawContent;

    let imgs: string[] = [];
    if (imgM) { try { imgs = JSON.parse(imgM[1]); } catch { /* ignore */ } }

    return {
      title:         titleM[1],
      summary:       summaryM?.[1] ?? content.substring(0, 200).replace(/\n/g, ' '),
      content,
      score:         parseFloat(scoreM?.[1] ?? '7.5') || 7.5,
      image_queries: imgs,
    } as T;
  }

  return null;
}


// ════════════════════════════════════════════════════════════════════════════
// IMAGE PIPELINE
//
// Queries come from the article JSON (image_queries array) — no extra Groq
// call needed. The article prompt instructs the model to return 4 targeted
// queries that are specific to the subject (person, place, film, event) with
// generic fallback queries so Pexels always finds something.
//
// Pexels has: athletes in action, city skylines, stadiums, landmarks,
// cinema halls, tech offices, hospital corridors, space imagery, and much more.
// It does NOT have paparazzi celebrity close-ups — so person queries are
// role/sport/activity based ("cricket batsman action shot") not name-based.
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// HYBRID IMAGE PIPELINE — Wikimedia (persons/places) + Pexels (context)
//
// Strategy:
//   1. Scan title + image_queries for famous persons and places
//   2. Fetch their real photos from Wikimedia Commons (free, CC licensed)
//      → Virat Kohli, Ranveer Singh, Modi, Mumbai, Delhi, Taj Mahal etc.
//   3. Fill remaining slots with Pexels atmospheric/context images
//   4. Mix: person/place photos first, context images pad the rest
// ════════════════════════════════════════════════════════════════════════════

// Famous persons — keyword → Wikimedia search term
const KNOWN_PERSONS: Record<string, string> = {
  'virat kohli': 'Virat Kohli', 'kohli': 'Virat Kohli',
  'rohit sharma': 'Rohit Sharma cricketer', 'rohit': 'Rohit Sharma cricketer',
  'ms dhoni': 'MS Dhoni', 'dhoni': 'MS Dhoni',
  'sachin tendulkar': 'Sachin Tendulkar', 'sachin': 'Sachin Tendulkar',
  'bumrah': 'Jasprit Bumrah', 'jasprit bumrah': 'Jasprit Bumrah',
  'shubman gill': 'Shubman Gill', 'shreyas iyer': 'Shreyas Iyer cricketer',
  'sanju samson': 'Sanju Samson', 'hardik pandya': 'Hardik Pandya',
  'smriti mandhana': 'Smriti Mandhana', 'pat cummins': 'Pat Cummins',
  'ranveer singh': 'Ranveer Singh actor', 'ranveer': 'Ranveer Singh actor',
  'deepika padukone': 'Deepika Padukone', 'deepika': 'Deepika Padukone',
  'shah rukh khan': 'Shah Rukh Khan', 'srk': 'Shah Rukh Khan',
  'aamir khan': 'Aamir Khan actor', 'salman khan': 'Salman Khan actor',
  'ranbir kapoor': 'Ranbir Kapoor', 'alia bhatt': 'Alia Bhatt',
  'nora fatehi': 'Nora Fatehi', 'priyanka chopra': 'Priyanka Chopra',
  'hrithik roshan': 'Hrithik Roshan', 'akshay kumar': 'Akshay Kumar actor',
  'modi': 'Narendra Modi', 'narendra modi': 'Narendra Modi',
  'rahul gandhi': 'Rahul Gandhi', 'elon musk': 'Elon Musk',
  'donald trump': 'Donald Trump', 'mukesh ambani': 'Mukesh Ambani',
  'ambani': 'Mukesh Ambani', 'adani': 'Gautam Adani', 'ratan tata': 'Ratan Tata',
  'neeraj chopra': 'Neeraj Chopra', 'pv sindhu': 'PV Sindhu',
};

// Famous places — keyword → Wikimedia search term
const KNOWN_PLACES: Record<string, string> = {
  'mumbai': 'Mumbai city skyline', 'delhi': 'New Delhi India',
  'new delhi': 'New Delhi India', 'bangalore': 'Bangalore city India',
  'bengaluru': 'Bengaluru city India', 'chennai': 'Chennai city India',
  'kolkata': 'Kolkata city India', 'hyderabad': 'Hyderabad city India',
  'varanasi': 'Varanasi ghats India', 'agra': 'Agra Taj Mahal',
  'taj mahal': 'Taj Mahal Agra', 'dubai': 'Dubai skyline',
  'london': 'London cityscape', 'new york': 'New York City skyline',
  'wankhede': 'Wankhede Stadium Mumbai', 'eden gardens': 'Eden Gardens Kolkata',
};

// Pexels category fallbacks (used for context/mood images)
const CATEGORY_FALLBACK_QUERIES: Record<string, string[]> = {
  cricket:    ['cricket sport bat ball', 'cricket stadium crowd', 'sport india',             'cricket player action'],
  bollywood:  ['bollywood cinema hall',  'film production set',   'stage performance lights', 'indian entertainment'],
  technology: ['technology laptop code', 'startup office india',  'artificial intelligence',  'digital screen data'],
  viral:      ['india street crowd',     'urban india people',    'social media phone',        'india public space'],
  business:   ['stock market trading',   'business meeting india','rupee currency finance',    'corporate office'],
  sports:     ['sport stadium athlete',  'football match action', 'olympic sport training',    'sports arena india'],
  india:      ['india new delhi city',   'indian culture festival','india parliament',          'india street market'],
  world:      ['world map globe',        'city skyline night',    'airport international',     'global summit'],
  health:     ['doctor hospital india',  'medical healthcare',    'yoga wellness fitness',     'medicine pharmacy'],
  science:    ['rocket launch fire',     'science laboratory',    'space stars galaxy',        'nature forest india'],
  stocks:     ['stock market trading screen', 'nse bse india exchange', 'indian investor money', 'sensex nifty chart'],
};

function detectEntities(text: string, entityMap: Record<string, string>): { keyword: string; wikiTerm: string }[] {
  const found: { keyword: string; wikiTerm: string }[] = [];
  const seenTerms = new Set<string>();
  const lower = text.toLowerCase();
  for (const [keyword, wikiTerm] of Object.entries(entityMap)) {
    if (lower.includes(keyword) && !seenTerms.has(wikiTerm)) {
      seenTerms.add(wikiTerm);
      found.push({ keyword, wikiTerm });
    }
  }
  return found;
}

function isFreeWikimediaLicense(license: string): boolean {
  if (!license) return false;
  const free = ['cc0', 'cc-by', 'cc by', 'public domain', 'pd', 'cc-sa', 'cc by-sa', 'attribution'];
  return free.some(f => license.toLowerCase().includes(f));
}

function stripHtml(html: string): string {
  return (html ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

interface HybridPhoto {
  id: string; url: string; alt: string;
  width: number; height: number;
  source: 'wikimedia' | 'pexels' | 'omdb';
  downloadLocation?: string;
}

// ─── Session-level deduplication ─────────────────────────────────────────────
// Tracks ALL Pexels photo IDs used across the entire pipeline run.
// Prevents the same photo appearing in multiple articles.
// Cleared at the start of each Generate run via clearSessionImageCache().
const _sessionUsedPexelsIds = new Set<string>();
const _sessionUsedWikiIds   = new Set<string>();

function clearSessionImageCache() {
  _sessionUsedPexelsIds.clear();
  _sessionUsedWikiIds.clear();
}

async function fetchWikimediaImages(searchTerm: string, count: number = 2): Promise<HybridPhoto[]> {
  const photos: HybridPhoto[] = [];
  const WIKI_API = 'https://en.wikipedia.org/w/api.php';
  try {
    // First try: File namespace search
    const ctrl1 = new AbortController(); setTimeout(() => ctrl1.abort(), 8000);
    const searchRes = await fetch(`${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&srnamespace=6&srlimit=${count * 3}&format=json&origin=*`, { signal: ctrl1.signal });
    if (!searchRes.ok) throw new Error('search failed');
    const searchData = await searchRes.json();
    const results: any[] = searchData?.query?.search ?? [];

    for (const result of results.slice(0, count * 2)) {
      if (photos.length >= count) break;
      if (!result.title?.startsWith('File:')) continue;
      const ctrl2 = new AbortController(); setTimeout(() => ctrl2.abort(), 6000);
      const infoRes = await fetch(`${WIKI_API}?action=query&titles=${encodeURIComponent(result.title)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1200&format=json&origin=*`, { signal: ctrl2.signal });
      if (!infoRes.ok) continue;
      const infoData = await infoRes.json();
      const pages = Object.values(infoData?.query?.pages ?? {}) as any[];
      for (const page of pages) {
        const info = page.imageinfo?.[0];
        if (!info) continue;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(info.mime)) continue;
        if ((info.thumbwidth || info.width) < IMAGE_MIN_WIDTH) continue;
        const license = info.extmetadata?.LicenseShortName?.value ?? '';
        if (!isFreeWikimediaLicense(license)) continue;
        const wid = `wiki_${page.pageid}`;
        // Skip if already used in another article this session
        if (_sessionUsedWikiIds.has(wid)) continue;
        photos.push({
          id:     wid,
          url:    info.thumburl || info.url,
          alt:    stripHtml(info.extmetadata?.ImageDescription?.value ?? '') || `${searchTerm} — Wikimedia Commons`,
          width:  info.thumbwidth  || info.width,
          height: info.thumbheight || info.height,
          source: 'wikimedia',
        });
        if (photos.length >= count) break;
      }
      await sleep(200);
    }

    // Fallback: get images from the Wikipedia article about the subject
    if (photos.length === 0) {
      const ctrl3 = new AbortController(); setTimeout(() => ctrl3.abort(), 8000);
      const artSearch = await fetch(`${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&srlimit=1&format=json&origin=*`, { signal: ctrl3.signal });
      const artData = await artSearch.json();
      const artTitle = artData?.query?.search?.[0]?.title;
      if (artTitle) {
        const ctrl4 = new AbortController(); setTimeout(() => ctrl4.abort(), 8000);
        const imgRes = await fetch(`${WIKI_API}?action=query&titles=${encodeURIComponent(artTitle)}&prop=images&imlimit=10&format=json&origin=*`, { signal: ctrl4.signal });
        const imgData = await imgRes.json();
        const imgPages = Object.values(imgData?.query?.pages ?? {}) as any[];
        const imageFiles: string[] = (imgPages[0]?.images ?? [])
          .map((i: any) => i.title as string)
          .filter((t: string) => /\.(jpg|jpeg|png|webp)$/i.test(t) && !t.toLowerCase().includes('icon') && !t.toLowerCase().includes('logo'));

        for (const fileTitle of imageFiles.slice(0, count * 3)) {
          if (photos.length >= count) break;
          const ctrl5 = new AbortController(); setTimeout(() => ctrl5.abort(), 6000);
          const fi = await fetch(`${WIKI_API}?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1200&format=json&origin=*`, { signal: ctrl5.signal });
          const fd = await fi.json();
          const fp = Object.values(fd?.query?.pages ?? {}) as any[];
          for (const p of fp) {
            const info = p.imageinfo?.[0];
            if (!info) continue;
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(info.mime)) continue;
            if ((info.thumbwidth || info.width) < IMAGE_MIN_WIDTH) continue;
            const license = info.extmetadata?.LicenseShortName?.value ?? '';
            if (!isFreeWikimediaLicense(license)) continue;
            const wid2 = `wiki_${p.pageid}`;
            if (_sessionUsedWikiIds.has(wid2)) continue;
            photos.push({
              id:     wid2,
              url:    info.thumburl || info.url,
              alt:    stripHtml(info.extmetadata?.ImageDescription?.value ?? '') || `${searchTerm} — Wikimedia Commons`,
              width:  info.thumbwidth  || info.width,
              height: info.thumbheight || info.height,
              source: 'wikimedia',
            });
            if (photos.length >= count) break;
          }
          await sleep(150);
        }
      }
    }
  } catch { /* return whatever we have */ }
  return photos;
}

// ════════════════════════════════════════════════════════════════════════════
// SMART CASCADE IMAGE FETCHER
// Never gives up — tries every source in priority order until images found.
//
// Priority per category:
//   BOLLYWOOD: OMDb (movie poster) → Wikimedia (actors) → Pexels (cinema mood)
//   CRICKET:   Wikimedia (player action) → Wikimedia (venue) → Pexels (stadium)
//   OTHERS:    Wikimedia (persons) → Wikimedia (places) → Pexels (context)
//
// Cascade fallback chain — if primary fails, tries:
//   Person photo → Related person → Venue/Ground → Category theme → Generic
// ════════════════════════════════════════════════════════════════════════════
async function fetchAndSaveImages(
  pexelsKey: string,
  articleId: number,
  title: string,
  category: string,
  imageQueries: string[],
  log: (m: string, t: GenLog['type']) => void,
  omdbKey?: string
): Promise<number> {
  const textToScan = [title, ...imageQueries].join(' ').toLowerCase();
  const detectedPersons = detectEntities(textToScan, KNOWN_PERSONS);
  const detectedPlaces  = detectEntities(textToScan, KNOWN_PLACES);
  const allPhotos: HybridPhoto[] = [];
  const seen = new Set<string>();

  const addPhotos = (photos: HybridPhoto[]) => {
    photos.forEach(p => {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        allPhotos.push(p);
        // Register in session tracker to prevent reuse in other articles
        if (p.source === 'pexels')    _sessionUsedPexelsIds.add(p.id);
        if (p.source === 'wikimedia') _sessionUsedWikiIds.add(p.id);
      }
    });
  };

  // Fetch from Pexels — requests extra photos and skips already-used IDs
  // so each article gets fresh images even when queries are similar.
  const pexelsFetch = async (query: string, count = 2): Promise<HybridPhoto[]> => {
    if (!pexelsKey) return [];
    const results: HybridPhoto[] = [];

    // Request 3x more than needed so we have candidates to skip duplicates from
    const perPage = Math.min(count * 3, 15);

    // Random page offset (1–3) so repeated same-query calls get different results
    const page = Math.floor(Math.random() * 3) + 1;

    try {
      const ctrl = new AbortController();
      const t    = setTimeout(() => ctrl.abort(), 8000);
      const res  = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=landscape`,
        { signal: ctrl.signal, headers: { Authorization: pexelsKey } }
      );
      clearTimeout(t);
      if (!res.ok) return [];
      const data = await res.json();

      for (const p of (data.photos ?? [])) {
        if (results.length >= count) break;
        if (p.width < IMAGE_MIN_WIDTH) continue;
        const pid = `pexels_${p.id}`;
        // Skip if this photo was already used in another article this session
        if (_sessionUsedPexelsIds.has(pid)) continue;
        results.push({
          id:               pid,
          url:              p.src.large2x || p.src.large,
          alt:              p.alt || query,
          width:            p.width,
          height:           p.height,
          source:           'pexels' as const,
          downloadLocation: null,
        });
      }

      // If page 1–3 are exhausted (all used), try page 4–6 as fallback
      if (results.length < count && page <= 3) {
        const ctrl2 = new AbortController();
        const t2    = setTimeout(() => ctrl2.abort(), 8000);
        const res2  = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page + 3}&orientation=landscape`,
          { signal: ctrl2.signal, headers: { Authorization: pexelsKey } }
        );
        clearTimeout(t2);
        if (res2.ok) {
          const data2 = await res2.json();
          for (const p of (data2.photos ?? [])) {
            if (results.length >= count) break;
            if (p.width < IMAGE_MIN_WIDTH) continue;
            const pid = `pexels_${p.id}`;
            if (_sessionUsedPexelsIds.has(pid)) continue;
            results.push({
              id: pid, url: p.src.large2x || p.src.large, alt: p.alt || query,
              width: p.width, height: p.height, source: 'pexels' as const, downloadLocation: null,
            });
          }
        }
      }
    } catch { /* return whatever we have */ }

    return results;
  };

  // ── BOLLYWOOD: OMDb → actors → cinema mood ──────────────────────────────
  if (category === 'bollywood') {
    if (omdbKey) {
      const omdb = await fetchOMDbImages(title, omdbKey, 2);
      addPhotos(omdb);
      log(`    🎬 OMDb: ${omdb.length} posters`, omdb.length > 0 ? 'info' : 'warn');
      await sleep(300);
    }
    // Actor/director photos via Wikimedia
    for (const person of detectedPersons.slice(0, 2)) {
      if (allPhotos.length >= 3) break;
      const w = await fetchWikimediaImages(person.wikiTerm, 1);
      addPhotos(w);
      if (w.length > 0) log(`    👤 Wikimedia actor "${person.wikiTerm}": ${w.length}`, 'info');
      await sleep(250);
    }
    // Fallback: cinema/film mood from Pexels
    if (allPhotos.length < TARGET_IMAGES_PER_ARTICLE) {
      for (const q of ['bollywood film set', 'indian cinema audience', 'film production india', 'cinema hall india']) {
        if (allPhotos.length >= TARGET_IMAGES_PER_ARTICLE) break;
        addPhotos(await pexelsFetch(q, 2));
        await sleep(300);
      }
    }
  }

  // ── CRICKET: smart action queries → venue → crowd ───────────────────────
  else if (category === 'cricket') {
    const cricketQueries = extractCricketQueries(title, imageQueries);
    log(`    🏏 Cricket queries: ${cricketQueries.join(', ')}`, 'info');

    // Step 1: try specific player/match action on Wikimedia
    for (const query of cricketQueries.slice(0, 2)) {
      if (allPhotos.length >= 2) break;
      const w = await fetchWikimediaImages(query, 2);
      addPhotos(w);
      log(`    🌐 Wikimedia "${query}": ${w.length}`, w.length > 0 ? 'info' : 'warn');
      await sleep(300);
    }

    // Step 2: if still low — try detected places (stadiums/grounds)
    if (allPhotos.length < 2) {
      for (const place of detectedPlaces.slice(0, 2)) {
        if (allPhotos.length >= 2) break;
        const w = await fetchWikimediaImages(place.wikiTerm, 2);
        addPhotos(w);
        if (w.length > 0) log(`    📍 Wikimedia venue "${place.wikiTerm}": ${w.length}`, 'info');
        await sleep(250);
      }
    }

    // Step 3: fill rest from Pexels — try specific then generic
    if (allPhotos.length < TARGET_IMAGES_PER_ARTICLE) {
      const pexelsCricket = [
        ...imageQueries.slice(0, 2),
        'cricket batsman playing shot india',
        'cricket stadium crowd IPL',
        'cricket player celebrating wicket',
        'cricket ground india',
      ];
      for (const q of pexelsCricket) {
        if (allPhotos.length >= TARGET_IMAGES_PER_ARTICLE) break;
        addPhotos(await pexelsFetch(q, 2));
        await sleep(300);
      }
    }
  }

  // ── ALL OTHER CATEGORIES: persons → places → image queries → fallback ───
  else {
    // Step 1: Wikimedia persons
    for (const person of detectedPersons.slice(0, 2)) {
      if (allPhotos.length >= Math.floor(TARGET_IMAGES_PER_ARTICLE / 2)) break;
      const w = await fetchWikimediaImages(person.wikiTerm, 2);
      addPhotos(w);
      log(`    👤 Wikimedia "${person.wikiTerm}": ${w.length}`, w.length > 0 ? 'info' : 'warn');
      await sleep(300);
    }

    // Step 2: Wikimedia places
    for (const place of detectedPlaces.slice(0, 2)) {
      if (allPhotos.length >= Math.floor(TARGET_IMAGES_PER_ARTICLE / 2)) break;
      const w = await fetchWikimediaImages(place.wikiTerm, 2);
      addPhotos(w);
      log(`    📍 Wikimedia "${place.wikiTerm}": ${w.length}`, w.length > 0 ? 'info' : 'warn');
      await sleep(300);
    }

    // Step 3: Pexels with article-specific queries — shuffled to vary results
    if (allPhotos.length < TARGET_IMAGES_PER_ARTICLE) {
      const queries = [
        ...imageQueries.filter(q => typeof q === 'string' && q.trim().length > 2).slice(0, 4),
        ...(CATEGORY_FALLBACK_QUERIES[category] ?? ['india news']),
      ].slice(0, 6).sort(() => Math.random() - 0.5); // shuffle for variety

      for (const q of queries) {
        if (allPhotos.length >= TARGET_IMAGES_PER_ARTICLE) break;
        addPhotos(await pexelsFetch(q, 2));
        await sleep(350);
      }
    }
  }

  // ── ABSOLUTE LAST RESORT: generic category fallback, NEVER return 0 ─────
  if (allPhotos.length === 0) {
    log(`    ⚠ Primary sources empty — using category fallback`, 'warn');
    const lastResort = CATEGORY_FALLBACK_QUERIES[category] ?? ['india current events', 'india news today'];
    for (const q of lastResort.slice(0, 3)) {
      addPhotos(await pexelsFetch(q, 2));
      await sleep(300);
      if (allPhotos.length >= 2) break;
    }
  }

  if (allPhotos.length === 0) {
    log(`    ✗ Could not find any images for "${title}"`, 'error');
    return 0;
  }

  const toSave = allPhotos.slice(0, TARGET_IMAGES_PER_ARTICLE);
  const omdbC = toSave.filter(p => p.source === 'omdb').length;
  const wikiC = toSave.filter(p => p.source === 'wikimedia').length;
  const pexC  = toSave.filter(p => p.source === 'pexels').length;
  log(`    🖼  Saving ${toSave.length} (${omdbC > 0 ? omdbC + ' OMDb + ' : ''}${wikiC} Wikimedia + ${pexC} Pexels)`, 'info');

  const imageRows = toSave.map((photo, i) => ({
    article_id: articleId,
    image_url:  photo.url,
    alt_text:   photo.alt || title,
    position:   i,
    width:      photo.width  || 1080,
    height:     photo.height || 720,
    size_kb:    0,
  }));

  const { error } = await supabase.from('article_images').insert(imageRows);
  if (error) { log(`    ✗ Image save error: ${error.message}`, 'error'); return 0; }
  await supabase.from('articles').update({ image_url: imageRows[0].image_url }).eq('id', articleId);
  log(`    ✅ ${toSave.length} images saved`, 'success');
  return toSave.length;
}


// ─── OMDb image fetcher (browser-side) ───────────────────────────────────────
async function fetchOMDbImages(title: string, apiKey: string, count: number = 2): Promise<HybridPhoto[]> {
  const photos: HybridPhoto[] = [];
  const OMDB = 'https://www.omdbapi.com';
  try {
    // Search by first 4 words of title
    const searchTitle = title.split(' ').slice(0, 4).join(' ');
    const ctrl1 = new AbortController(); setTimeout(() => ctrl1.abort(), 8000);
    const searchRes = await fetch(`${OMDB}/?apikey=${apiKey}&s=${encodeURIComponent(searchTitle)}&type=movie`, { signal: ctrl1.signal });
    if (!searchRes.ok) return photos;
    const searchData = await searchRes.json();
    let results: any[] = searchData?.Search ?? [];

    // Fallback to TV/series (for OTT shows)
    if (results.length === 0) {
      const ctrl2 = new AbortController(); setTimeout(() => ctrl2.abort(), 8000);
      const tvRes = await fetch(`${OMDB}/?apikey=${apiKey}&s=${encodeURIComponent(searchTitle)}&type=series`, { signal: ctrl2.signal });
      if (tvRes.ok) { const tvData = await tvRes.json(); results = tvData?.Search ?? []; }
    }

    for (const result of results.slice(0, count)) {
      if (photos.length >= count || !result.imdbID) continue;
      const ctrl3 = new AbortController(); setTimeout(() => ctrl3.abort(), 8000);
      const detailRes = await fetch(`${OMDB}/?apikey=${apiKey}&i=${result.imdbID}`, { signal: ctrl3.signal });
      if (!detailRes.ok) continue;
      const movie = await detailRes.json();
      if (!movie?.Poster || movie.Poster === 'N/A') continue;
      // Upgrade from 300px thumbnail to 1000px high-res
      const highRes = movie.Poster.replace('SX300', 'SX1000').replace('SY150', 'SY1000');
      photos.push({
        id:     `omdb_${result.imdbID}`,
        url:    highRes,
        alt:    `${movie.Title} (${movie.Year}) — via OMDb`,
        width:  1000,
        height: 1500,
        source: 'omdb',
      });
      await sleep(200);
    }
  } catch { /* skip */ }
  return photos;
}

// ─── Cricket smart query extractor ───────────────────────────────────────────
function extractCricketQueries(title: string, imageQueries: string[]): string[] {
  const lower = title.toLowerCase();
  const queries: string[] = [];

  const playerActions: Record<string, string> = {
    'virat kohli':    'Virat Kohli batting cricket',
    'kohli':          'Virat Kohli batting cricket',
    'rohit sharma':   'Rohit Sharma batting cricket',
    'rohit':          'Rohit Sharma cricket',
    'ms dhoni':       'MS Dhoni wicketkeeper cricket',
    'dhoni':          'MS Dhoni cricket',
    'bumrah':         'Jasprit Bumrah bowling cricket',
    'jasprit bumrah': 'Jasprit Bumrah bowling',
    'hardik pandya':  'Hardik Pandya cricket',
    'shubman gill':   'Shubman Gill batting',
    'sachin':         'Sachin Tendulkar cricket',
    'jadeja':         'Ravindra Jadeja cricket',
    'pat cummins':    'Pat Cummins bowling cricket',
    'ben stokes':     'Ben Stokes cricket',
    'sanju samson':   'Sanju Samson batting cricket',
  };

  for (const [keyword, action] of Object.entries(playerActions)) {
    if (lower.includes(keyword)) { queries.push(action); break; }
  }

  if (lower.includes('ipl'))         queries.push('IPL cricket match');
  if (lower.includes('test'))        queries.push('Test cricket match');
  if (lower.includes('t20'))         queries.push('T20 cricket match');
  if (lower.includes('world cup'))   queries.push('Cricket World Cup');
  if (lower.includes('bcci'))        queries.push('BCCI cricket India');
  if (lower.includes('rcb'))         queries.push('Royal Challengers Bangalore cricket');
  if (lower.includes('csk'))         queries.push('Chennai Super Kings cricket');
  if (lower.includes('mumbai indians')) queries.push('Mumbai Indians cricket IPL');

  if (queries.length === 0) queries.push('cricket batting action India', 'cricket match stadium India');
  return [...new Set(queries)];
}


// ─── Generate smart image search suggestions based on article title + category ──
// Shown in the image panel so admin knows exactly what to search for
function generateImageSuggestions(title: string, category: string): string[] {
  const lower   = title.toLowerCase();
  const suggestions: string[] = [];

  // Person-specific suggestions
  const personMap: Record<string, string[]> = {
    'virat kohli':      ['Virat Kohli batting', 'Virat Kohli RCB'],
    'kohli':            ['Virat Kohli cricket', 'cricket batsman India'],
    'rohit sharma':     ['Rohit Sharma cricket', 'Mumbai Indians IPL'],
    'dhoni':            ['MS Dhoni CSK', 'dhoni wicketkeeper'],
    'bumrah':           ['Jasprit Bumrah bowling', 'India pace bowler'],
    'hardik pandya':    ['Hardik Pandya cricket', 'IPL allrounder'],
    'modi':             ['Narendra Modi', 'India Prime Minister'],
    'shah rukh khan':   ['Shah Rukh Khan', 'Bollywood actor India'],
    'srk':              ['Shah Rukh Khan movie', 'Bollywood star'],
    'deepika':          ['Deepika Padukone actress', 'Bollywood film'],
    'ranveer':          ['Ranveer Singh actor', 'Bollywood celebrity'],
    'alia':             ['Alia Bhatt actress', 'Bollywood movie'],
    'salman':           ['Salman Khan actor', 'Bollywood film'],
    'akshay':           ['Akshay Kumar actor', 'Bollywood action'],
    'nifty':            ['NSE stock market India', 'sensex trading screen'],
    'sensex':           ['BSE Sensex chart', 'indian stock exchange'],
    'ipl':              ['IPL cricket match', 'cricket stadium crowd'],
    'world cup':        ['Cricket World Cup trophy', 'cricket match India'],
  };

  for (const [keyword, terms] of Object.entries(personMap)) {
    if (lower.includes(keyword)) {
      suggestions.push(...terms);
      if (suggestions.length >= 3) break;
    }
  }

  // Category-specific fallbacks if no person detected
  if (suggestions.length < 2) {
    const categoryDefaults: Record<string, string[]> = {
      cricket:    ['cricket batting action India', 'cricket stadium IPL crowd', 'India cricket team'],
      bollywood:  ['Bollywood film poster India', 'Indian cinema actors', 'Bollywood award ceremony'],
      technology: ['technology startup India', 'coding laptop screen', 'artificial intelligence'],
      stocks:     ['stock market trading India', 'NSE Nifty chart', 'Indian investor rupee'],
      business:   ['Indian business office', 'rupee currency India', 'startup funding India'],
      india:      ['India parliament building', 'New Delhi India gate', 'Indian flag ceremony'],
      world:      ['world map globe', 'international airport', 'global leaders summit'],
      health:     ['doctor patient India', 'hospital healthcare India', 'yoga wellness'],
      science:    ['ISRO rocket launch', 'science laboratory India', 'space satellite'],
      sports:     ['Indian sports stadium', 'athlete training India', 'Olympic sports'],
      viral:      ['social media phone India', 'crowd India street', 'viral news trending'],
      history:    ['ancient India ruins', 'historical monument India', 'Mughal architecture'],
    };
    suggestions.push(...(categoryDefaults[category] ?? ['india news today', 'india current events']));
  }

  return [...new Set(suggestions)].slice(0, 4);
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
export default function AdminPanel() {
  const [articles, setArticles]               = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [images, setImages]                   = useState<ArticleImage[]>([]);
  const [loading, setLoading]                 = useState(false);
  const [uploading, setUploading]             = useState(false);
  const [generating, setGenerating]           = useState(false);
  const [refetchingImages, setRefetchingImages] = useState(false);
  const [historyGenerating, setHistoryGenerating] = useState(false);
  const [historyLogs, setHistoryLogs]           = useState<GenLog[]>([]);
  const [historyDone, setHistoryDone]           = useState<string | null>(null);
  const [genLogs, setGenLogs]                 = useState<GenLog[]>([]);
  const [genDone, setGenDone]                 = useState(0);
  const [genTotal, setGenTotal]               = useState(0);
  const [batchInfo, setBatchInfo]             = useState('');
  const [countdown, setCountdown]             = useState(0);
  const [adminNotes, setAdminNotes]           = useState('');
  const [filter, setFilter]                   = useState<'draft' | 'published' | 'all'>('draft');
  const [error, setError]                     = useState<string | null>(null);
  const [success, setSuccess]                 = useState<string | null>(null);
  const [selectMode, setSelectMode]           = useState(false);
  const [selectedIds, setSelectedIds]         = useState<Set<number>>(new Set());
  const [deleting, setDeleting]               = useState(false);

  const logEndRef      = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const stopRef     = useRef(false);
  const countRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef    = useRef<AbortController | null>(null); // pipeline-level abort

  useEffect(() => { fetchArticles(); }, [filter]);
  useEffect(() => { setSelectMode(false); setSelectedIds(new Set()); }, [filter]);
  useEffect(() => {
    // Scroll ONLY the log container — never scroll the whole page
    const container = logContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [genLogs]);
  useEffect(() => () => { if (countRef.current) clearInterval(countRef.current); }, []);

  const addLog = useCallback((message: string, type: GenLog['type'] = 'info') => {
    setGenLogs(prev => [...prev.slice(-400), { id: Date.now() + Math.random(), message, type, ts: nowTS() }]);
  }, []);

  const startCountdown = (seconds: number): Promise<void> =>
    new Promise(resolve => {
      setCountdown(seconds);
      let rem = seconds;
      countRef.current = setInterval(() => {
        // If stop was clicked during countdown — resolve immediately so pipeline exits
        if (stopRef.current) {
          clearInterval(countRef.current!);
          setCountdown(0);
          resolve();
          return;
        }
        rem--; setCountdown(rem);
        if (rem <= 0) { clearInterval(countRef.current!); setCountdown(0); resolve(); }
      }, 1000);
    });

  const fetchArticles = async () => {
    setLoading(true);
    try {
      let q = supabase.from('articles').select('*').order('created_at', { ascending: false });
      if (filter === 'draft')     q = q.eq('is_draft', true);
      if (filter === 'published') q = q.eq('is_published', true);
      const { data, error: e } = await q.limit(200);
      if (e) throw e;
      setArticles(data ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const selectArticle = async (article: Article) => {
    if (selectMode) return;
    setSelectedArticle(article);
    setAdminNotes(article.admin_notes ?? '');
    setError(null); setSuccess(null);
    try {
      const { data, error: e } = await supabase
        .from('article_images').select('*').eq('article_id', article.id).order('position');
      if (e) throw e;
      setImages(data ?? []);
    } catch (e: any) { setError(e.message); }
  };

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = () =>
    setSelectedIds(selectedIds.size === articles.length ? new Set() : new Set(articles.map(a => a.id)));

  const deleteSelected = async () => {
    if (!selectedIds.size) return;
    if (!confirm(`Delete ${selectedIds.size} article(s)? Cannot be undone.`)) return;
    setDeleting(true);
    try {
      const ids = [...selectedIds];
      await supabase.from('article_images').delete().in('article_id', ids);
      const { error: e } = await supabase.from('articles').delete().in('id', ids);
      if (e) throw e;
      if (selectedArticle && selectedIds.has(selectedArticle.id)) { setSelectedArticle(null); setImages([]); }
      setSelectedIds(new Set()); setSelectMode(false);
      setSuccess(`✅ Deleted ${ids.length} article(s).`);
      await fetchArticles();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setDeleting(false); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN GENERATE PIPELINE
  // ══════════════════════════════════════════════════════════════════════════
  const handleGenerate = async () => {
    // Collect all configured Groq keys — rotate when one hits rate limit
    const groqKeys: string[] = [
      import.meta.env.VITE_GROQ_API_KEY,
      import.meta.env.VITE_GROQ_API_KEY_2,
      import.meta.env.VITE_GROQ_API_KEY_3,
    ].filter(Boolean) as string[];

    const pexelsKey = import.meta.env.VITE_PEXELS_API_KEY as string | undefined;
    const omdbKey   = import.meta.env.VITE_OMDB_API_KEY as string | undefined;

    if (groqKeys.length === 0) {
      setError('Missing VITE_GROQ_API_KEY in environment variables. Add it in Vercel → Settings → Environment Variables and redeploy.');
      return;
    }
    if (!pexelsKey) {
      setError(
        'Missing VITE_PEXELS_API_KEY.\n\n' +
        '1. Go to pexels.com/developers\n' +
        '2. Click "Your apps" → "New Application"\n' +
        '3. Copy the Access Key (not Secret Key)\n' +
        '4. Add VITE_PEXELS_API_KEY in Vercel → Settings → Environment Variables and redeploy.'
      );
      return;
    }

    setGenerating(true);
    setError(null); setSuccess(null);
    setGenLogs([]); setGenDone(0);
    setBatchInfo(''); stopRef.current = false;
    abortRef.current = new AbortController();
    clearSessionImageCache(); // reset cross-article image deduplication
    const _sessionTopics = new Set<string>(); // tracks topics used in THIS run // fresh abort controller for this run

    const log = addLog;
    let groqKeyIndex    = 0;
    const keyExhausted: Record<number, number> = {};
    const getGroqKey = () => {
      const now = Date.now();
      for (let i = 0; i < groqKeys.length; i++) {
        const idx = (groqKeyIndex + i) % groqKeys.length;
        if (!keyExhausted[idx] || keyExhausted[idx] < now) { groqKeyIndex = idx; return groqKeys[idx]; }
      }
      groqKeyIndex = 0; return groqKeys[0];
    };
    const categories    = Object.keys(NEWS_SOURCES);
    const totalArticles = categories.length * ARTICLES_PER_CATEGORY;
    setGenTotal(totalArticles);

    log(`🚀 Starting FULL AUTO pipeline — ${totalArticles} articles`, 'info');
    log(`✍️  Author: ${AUTHOR.name} | 🤖 Groq llama-3.3-70b (${groqKeys.length} key${groqKeys.length > 1 ? 's' : ''}) | 🖼 Images: Pexels | 🔄 Auto-publish: score ≥ ${AUTO_PUBLISH_SCORE}`, 'info');
    log(`⚙️  Batch: ${BATCH_SIZE} articles | Long pause: ${BATCH_PAUSE_MS / 60000} min | Inter-article: ${INTER_ARTICLE_PAUSE_MS / 1000}s | Timeout: ${GROQ_TIMEOUT_MS / 1000}s`, 'info');

    let grandTotal    = 0;
    let autoPublished = 0;
    let globalIdx     = 0;   // FIX: counts articles written, for batch-pause logic

    // ── Pre-fetch recently covered topics per category to avoid repetition ──
    // Fetches last 30 article titles per category so Groq picks fresh topics
    log('🔍 Loading previously covered topics to avoid repetition...', 'info');
    const recentTitlesByCategory: Record<string, string> = {};
    try {
      const { data: recentArticles } = await supabase
        .from('articles')
        .select('title, category')
        .order('published_date', { ascending: false })
        .limit(300); // last 300 articles across all categories

      if (recentArticles) {
        for (const cat of categories) {
          const catTitles = recentArticles
            .filter(a => a.category === cat)
            .slice(0, 30)  // last 30 per category
            .map(a => `- ${a.title}`)
            .join('\n');
          recentTitlesByCategory[cat] = catTitles;
        }
        const totalCovered = recentArticles.length;
        log(`✅ Loaded ${totalCovered} recent articles for topic deduplication`, 'info');
      }
    } catch {
      log('⚠ Could not load recent topics — continuing without dedup', 'warn');
    }

    try {
      for (let ci = 0; ci < categories.length; ci++) {
        if (stopRef.current) { log('⛔ Stopped.', 'error'); break; }

        const category  = categories[ci];
        const catConfig = NEWS_SOURCES[category];

        log(`\n━━━ [${ci + 1}/${categories.length}] ${category.toUpperCase()} ━━━`, 'info');
        log(`📡 Fetching headlines...`, 'info');

        const allHeadlines: string[] = [];
        let feedsWorked = 0;
        for (const feedUrl of catConfig.feeds) {
          const items = await fetchHeadlines(feedUrl);
          if (items.length > 0) {
            feedsWorked++;
            items.forEach(i => { if (i.title) allHeadlines.push(i.title); });
            log(`  ✓ ${domain(feedUrl)}: ${items.length}`, 'info');
          } else {
            log(`  ✗ ${domain(feedUrl)}: blocked`, 'warn');
          }
          await sleep(400);
        }

        const headlineContext = allHeadlines.length > 0
          ? allHeadlines.slice(0, 25).map((h, i) => `${i + 1}. ${h}`).join('\n')
          : `[No live feed — use your knowledge of trending ${catConfig.context}]`;

        if (allHeadlines.length > 0) log(`  📋 ${allHeadlines.length} headlines (${feedsWorked} feeds)`, 'info');
        else log(`  ⚠ All feeds failed — using Groq knowledge`, 'warn');

        // ── FIX: Explicit JSON-only instruction prevents markdown wrapping ──
        const prevCatTitles = recentTitlesByCategory[category] || '';
        const hasPrevious   = prevCatTitles.length > 0;
        log(`  🤖 Picking ${ARTICLES_PER_CATEGORY} fresh topics${hasPrevious ? ' (avoiding recent duplicates)' : ''}...`, 'progress');

        const topicsRaw = await groqRequest(
          getGroqKey(),
          [
            {
              role: 'system',
              content:
                `You are a trending news analyst for Indian audiences. ` +
                `Return a JSON array of exactly ${ARTICLES_PER_CATEGORY} specific trending topics for the category: ${category}. ` +
                `Context: ${catConfig.context}. ` +
                `

CRITICAL — AVOID REPETITION:
` +
                `You must NOT pick topics that are the same as or very similar to these recently covered titles:
` +
                (hasPrevious ? prevCatTitles : '(no previous articles yet — pick freely)') +
                `

RULES:
` +
                `- Pick DIFFERENT angles, DIFFERENT people, DIFFERENT events than the above
` +
                `- If a person was recently covered, pick a different person or a different angle on them
` +
                `- If an event was recently covered, pick a different event
` +
                `- Topics must be genuinely current and newsworthy
` +
                `- Return ONLY the raw JSON array. No markdown, no backticks, no explanation.
` +
                `Example format: ["Topic one here", "Topic two here", "Topic three here"]`,
            },
            {
              role: 'user',
              content: allHeadlines.length > 0
                ? `${category.toUpperCase()} headlines:
${headlineContext}

Return a JSON array of ${ARTICLES_PER_CATEGORY} FRESH trending topics NOT covered in the recent titles above. Raw JSON only.`
                : `Generate a JSON array of ${ARTICLES_PER_CATEGORY} trending ${category} topics for Indian audiences that are NOT similar to the recently covered titles above. Raw JSON array only.`,
            },
          ],
          500,
          `topics:${category}`,
          log,
          groqKeys, keyExhausted, { value: groqKeyIndex },
          abortRef.current?.signal
        );

        // ── FIX: extractJSON now handles arrays correctly ──
        const topics = extractJSON<string[]>(topicsRaw);

        if (!topics || !Array.isArray(topics) || topics.length === 0) {
          log(`  ✗ No topics parsed for ${category} — raw: ${topicsRaw?.substring(0, 120)}`, 'error');
          globalIdx += ARTICLES_PER_CATEGORY;
          setGenDone(d => d + ARTICLES_PER_CATEGORY);
          continue;
        }

        const validTopics = topics
          .filter(t => typeof t === 'string' && t.trim().length > 3)
          // Also filter out any topics already used in this pipeline run
          .filter(t => {
            const key = t.toLowerCase().substring(0, 40);
            if (_sessionTopics.has(key)) { log(`  ⏭ Skipping duplicate: "${t}"`, 'warn'); return false; }
            return true;
          })
          .slice(0, ARTICLES_PER_CATEGORY);

        log(`  ✅ ${validTopics.length} fresh topics identified`, 'success');
        validTopics.forEach((t, i) => log(`    ${i + 1}. ${t}`, 'info'));

        // Generate each article
        for (let ti = 0; ti < validTopics.length; ti++) {
          if (stopRef.current) { log('⛔ Stopped.', 'error'); break; }

          globalIdx++;
          const topic = validTopics[ti];
          _sessionTopics.add(topic.toLowerCase().substring(0, 40)); // register for dedup

          // FIX: batch pause uses globalIdx AFTER increment (correct)
          if (globalIdx > 1 && (globalIdx - 1) % BATCH_SIZE === 0) {
            const ps = BATCH_PAUSE_MS / 1000;
            const pm = Math.round(ps / 60);
            log(`\n⏸️  Published ${BATCH_SIZE} articles — taking a ${pm} min break to stay within Groq limits...`, 'warn');
            setBatchInfo(`Long break: ${pm} min`);
            await startCountdown(ps);
            setBatchInfo('');
            log(`▶️  Resuming...`, 'info');
          }

          log(`\n  ✍️  [${globalIdx}/${totalArticles}] "${topic}"`, 'progress');
          setBatchInfo(`[${globalIdx}/${totalArticles}] Writing: ${topic.substring(0, 50)}...`);

          // ── SPICY TITLE + ARTICLE + SMART IMAGE QUERIES ──
          const raw = await groqRequest(
            getGroqKey(),
            [
              {
                role: 'system',
                content:
                  `You are ${AUTHOR.name}, ${AUTHOR.tagline}.\n\nYOUR STYLE:\n${AUTHOR.bio}\n\n` +
                  `LEGAL — CRITICAL: This is 100% ORIGINAL journalism. NOT a rewrite. Your own voice only.\n\n` +

                  `════ TITLE RULES — READ CAREFULLY ════\n` +
                  `Your title MUST be 12–20 words. It must create a curiosity gap or emotional reaction.\n` +
                  `BANNED: plain news summaries like "Kohli Trains With RCB" or "Stock Market Falls".\n` +
                  `REQUIRED: Every title must do ONE of these:\n` +
                  `  A) Create a curiosity gap — tease something surprising that makes reader click\n` +
                  `  B) Take a strong opinion — not "X happened" but "X just proved everyone wrong"\n` +
                  `  C) Use contrast or irony — "India's biggest star can't buy a decent film"\n` +
                  `  D) Reveal a hidden angle — "The real reason BCCI doesn't want you to know this"\n\n` +

                  `TITLE FORMULAS — use one of these patterns:\n` +
                  `  • "[Name/Thing] Just [Did Something] And Nobody Is Talking About What It Actually Means"\n` +
                  `  • "The Real Reason [X] Is Happening And Why Every Indian Should Be Paying Attention"\n` +
                  `  • "[X] Is [Doing Y] And The Numbers Will Make You Seriously Question Everything"\n` +
                  `  • "We Need To Talk About [X] Because Nobody Else In Indian Media Has The Guts To"\n` +
                  `  • "[X] Just Happened. Here Is Why Your [Wallet/Career/Future] Will Feel It Next Week"\n` +
                  `  • "Stop Pretending [X] Is Normal. Here Is What Is Actually Going On With [Topic]"\n` +
                  `  • "[Person] Did [Thing] And The Internet Completely Missed The Most Important Part"\n` +
                  `  • "Why [X] Is The Biggest [Topic] Story Nobody In India Is Taking Seriously Enough"\n\n` +

                  `TITLE EXAMPLES:\n` +
                  `  Cricket: "Kohli Is Back and RCB Still Has No Clue What To Do With This Man"\n` +
                  `  Bollywood: "Ranveer Singh Gave His Best Performance in Years and Critics Still Got It Wrong"\n` +
                  `  Business: "The Rupee Just Hit a New Low and Your Middle Class Lifestyle Will Pay the Price"\n` +
                  `  Tech: "OpenAI Just Bought the One Company That Could Have Stopped Them And Nobody Noticed"\n` +
                  `  Health: "India Has a Diabetes Crisis and the Government Is Hoping You Do Not Notice"\n\n` +

                  `════ IMAGE QUERIES — READ CAREFULLY ════\n` +
                  `You must return an "image_queries" array of exactly 4 Pexels search strings.\n` +
                  `These must get RELEVANT images for the specific subject of this article.\n\n` +
                  `RULES for image_queries:\n` +
                  `  1. If article is about a FAMOUS PERSON (cricketer, actor, politician, CEO):\n` +
                  `     → Query their SPORT/ROLE/CRAFT, not their name (Pexels has no paparazzi shots)\n` +
                  `     → e.g. Virat Kohli → ["cricket batsman playing shot", "india cricket team practice", ...]\n` +
                  `     → e.g. Ranveer Singh → ["bollywood actor on set", "film production india", ...]\n` +
                  `     → e.g. Nora Fatehi → ["bollywood dancer performance stage", "indian dance show lights", ...]\n` +
                  `  2. If article is about a FAMOUS PLACE (Mumbai, Delhi, Haifa, Dubai, Austin):\n` +
                  `     → Search the place directly — Pexels HAS city photos\n` +
                  `     → e.g. ["mumbai skyline night", "mumbai marine drive", ...]\n` +
                  `     → e.g. ["dubai skyscrapers aerial", "dubai city night lights", ...]\n` +
                  `  3. If article is about a FILM/SHOW/EVENT (IPL, Dhurandhar 2, World Cup):\n` +
                  `     → Search the genre/setting/atmosphere\n` +
                  `     → e.g. IPL → ["cricket stadium full crowd night", "ipl cricket boundary rope", ...]\n` +
                  `     → e.g. action film → ["action movie explosion scene", "film production camera crew", ...]\n` +
                  `  4. Always include 1 WIDE/ESTABLISHING shot query and 1 CLOSE/DETAIL shot query\n` +
                  `  5. Queries must be 3-6 words, descriptive, visual\n\n` +

                  `IMAGE QUERY EXAMPLES:\n` +
                  `  Article about Kohli + RCB: ["cricket batsman playing drive shot", "india cricket practice nets", "red cricket jersey stadium", "cricket crowd waving flags"]\n` +
                  `  Article about Mumbai stocks: ["mumbai city skyline bandra worli", "stock market trading screen", "indian currency rupee notes", "business district india tower"]\n` +
                  `  Article about Nora controversy: ["bollywood dancer stage performance", "indian film award show", "dance lights stage smoke", "entertainment india crowd"]\n` +
                  `  Article about ISRO launch: ["rocket launch fire trail", "india space programme control room", "isro satellite space", "night sky stars milky way"]\n` +
                  `  Article about Dubai Indians: ["dubai skyline burj khalifa", "airport departure lounge crowd", "indian expats abroad", "airplane window seat sky"]\n\n` +

                  `IMPORTANT: Return ONLY raw valid JSON — no markdown, no backticks, no extra text.\n` +
                  `JSON format exactly:\n` +
                  `{ "title": "YOUR SPICY 12-20 WORD TITLE", "summary": "2-3 punchy teaser sentences", "content": "500-700 word article paragraphs separated by \\n\\n ending with sharp one-liner", "score": 0-10, "image_queries": ["query 1", "query 2", "query 3", "query 4"] }`,
              },
              {
                role: 'user',
                content:
                  `Write your original ${category} piece on: "${topic}"\n` +
                  `Context: ${catConfig.context}\n` +
                  (allHeadlines.length > 0
                    ? `Background (do NOT copy): ${allHeadlines.slice(0, 4).map(h => `- ${h}`).join('\n')}`
                    : 'Write from your own knowledge.') +
                  `\n\nRemember: spicy title + 4 specific image_queries for this exact subject. Raw JSON only.`,
              },
            ],
            1300,
            `art:${category}:${ti + 1}`,
            log,
            groqKeys, keyExhausted, { value: groqKeyIndex },
            abortRef.current?.signal
          );

          // If Stop was clicked during the Groq call — discard and exit immediately
          if (stopRef.current) { log('⛔ Stopped — current article discarded.', 'error'); break; }

          interface ArticleJSON { title: string; summary: string; content: string; score: number; image_queries?: string[] }
          const parsed = extractJSON<ArticleJSON>(raw);

          if (!parsed?.title || !parsed?.summary || !parsed?.content) {
            log(`    ✗ Bad response — skipping "${topic}" | raw: ${raw?.substring(0, 100)}`, 'error');
            setGenDone(d => d + 1);
            await sleep(INTER_ARTICLE_PAUSE_MS);
            continue;
          }

          const score = clamp(parseFloat(String(parsed.score)) || 7.5, 0, 10);

          const { data: saved, error: saveErr } = await supabase
            .from('articles')
            .insert({
              title:          parsed.title.substring(0, 255),
              source_url:     `https://ai-generated/${category}/${Date.now()}-${ti}`,
              source_name:    AUTHOR.name,
              summary:        parsed.summary.substring(0, 500),
              raw_content:    parsed.content,
              category,
              score,
              published_date: new Date().toISOString(),
              is_draft:       true,
              is_published:   false,
              image_url:      null,
              admin_notes:    `Topic: "${topic}"`,
            })
            .select('id')
            .single();

          if (saveErr) {
            log(`    ✗ DB save failed: ${saveErr.message}`, 'error');
            setGenDone(d => d + 1);
            await sleep(INTER_ARTICLE_PAUSE_MS);
            continue;
          }

          grandTotal++;
          const articleId = saved.id;
          log(`    ✅ Article #${articleId} saved | score ${score.toFixed(1)}`, 'success');

          // Use article-supplied image_queries (subject-aware) — no extra Groq call
          const imageQueries = Array.isArray(parsed.image_queries) && parsed.image_queries.length > 0
            ? parsed.image_queries
            : [];
          log(`    🖼  Fetching images (${imageQueries.length > 0 ? 'subject-specific' : 'category fallback'})...`, 'progress');
          const imageCount = await fetchAndSaveImages(
            pexelsKey, articleId, parsed.title, category, imageQueries, log, omdbKey
          );

          // ── Publish only when ALL content is confirmed present ──────────
          const hasTitle   = parsed.title.trim().length > 5;
          const hasContent = parsed.content.trim().length > 100;
          const hasSummary = parsed.summary.trim().length > 10;
          const hasImages  = imageCount >= MIN_IMAGES_TO_PUBLISH;
          const goodScore  = score >= AUTO_PUBLISH_SCORE;
          const readyToPublish = hasTitle && hasContent && hasSummary && hasImages && goodScore;

          if (readyToPublish) {
            // Double-check raw_content is actually saved in DB before publishing
            const { data: verify } = await supabase
              .from('articles')
              .select('raw_content, image_url')
              .eq('id', articleId)
              .single();

            const dbHasContent = verify?.raw_content && verify.raw_content.length > 100;
            const dbHasImage   = !!verify?.image_url;

            if (!dbHasContent || !dbHasImage) {
              log(`    ⚠ DB verification failed — keeping as draft (content=${dbHasContent}, image=${dbHasImage})`, 'warn');
            } else {
              const { error: pubErr } = await supabase
                .from('articles')
                .update({ is_published: true, is_draft: false, updated_at: new Date().toISOString() })
                .eq('id', articleId);

              if (pubErr) {
                log(`    ✗ Auto-publish failed: ${pubErr.message}`, 'error');
              } else {
                autoPublished++;
                log(`    🚀 AUTO-PUBLISHED #${articleId} (score ${score.toFixed(1)}, ${imageCount} images, content verified ✓)`, 'success');
              }
            }
          } else {
            const reasons = [
              !hasContent && 'no content',
              !hasSummary && 'no summary',
              !hasImages  && `${imageCount} images (need ${MIN_IMAGES_TO_PUBLISH})`,
              !goodScore  && `score ${score.toFixed(1)} < ${AUTO_PUBLISH_SCORE}`,
            ].filter(Boolean).join(', ');
            log(`    📋 Kept as draft (${reasons})`, 'info');
          }

          fetchArticles();
          setGenDone(d => d + 1);

          if (ti < validTopics.length - 1) await sleep(INTER_ARTICLE_PAUSE_MS);
        }

        if (ci < categories.length - 1 && !stopRef.current) {
          log(`\n⏳ Category done — 2s...`, 'info');
          await sleep(2000);
        }
      }

      log(`\n🎉 PIPELINE COMPLETE!`, 'success');
      log(`   📰 Total articles: ${grandTotal}`, 'success');
      log(`   🚀 Auto-published: ${autoPublished}`, 'success');
      log(`   📋 Kept as draft: ${grandTotal - autoPublished}`, 'info');

      setSuccess(
        `✅ Done!\n\n` +
        `📰 Total articles written: ${grandTotal}\n` +
        `🚀 Auto-published (score ≥ ${AUTO_PUBLISH_SCORE}): ${autoPublished}\n` +
        `📋 Left in drafts for review: ${grandTotal - autoPublished}`
      );
      fetchArticles();

    } catch (e: any) {
      log(`\n❌ Fatal: ${e.message}`, 'error');
      setError('Generation failed: ' + e.message);
    } finally {
      setGenerating(false);
      abortRef.current = null;
      if (countRef.current) clearInterval(countRef.current);
      setCountdown(0); setBatchInfo('');
    }
  };


  // ════════════════════════════════════════════════════════════════════════════
  // HISTORY PIPELINE — Manual trigger for weekly deep-dive history articles
  // Same quality as the cron job — 1200-1500 words, 8 images, Arjun Mehta voice
  // ════════════════════════════════════════════════════════════════════════════
  const handleGenerateHistory = async () => {
    const groqKeys: string[] = [
      import.meta.env.VITE_GROQ_API_KEY,
      import.meta.env.VITE_GROQ_API_KEY_2,
      import.meta.env.VITE_GROQ_API_KEY_3,
    ].filter(Boolean) as string[];

    const pexelsKey = import.meta.env.VITE_PEXELS_API_KEY as string | undefined;
    const omdbKey   = import.meta.env.VITE_OMDB_API_KEY   as string | undefined;

    if (groqKeys.length === 0) { setError('Missing VITE_GROQ_API_KEY'); return; }
    if (!pexelsKey)            { setError('Missing VITE_PEXELS_API_KEY'); return; }

    setHistoryGenerating(true);
    setHistoryDone(null);
    setHistoryLogs([]);
    clearSessionImageCache();

    // Key rotation state — same pattern as main pipeline
    let keyIndex = 0;
    const keyExhausted: Record<number, number> = {};
    const keyIndexRef = { value: 0 };

    const hlog = (msg: string, type: GenLog['type'] = 'info') => {
      setHistoryLogs(prev => [...prev, {
        id: Date.now() + Math.random(), message: msg, type,
        ts: new Date().toLocaleTimeString(),
      }]);
    };

    // Use the SAME groqRequest function as main pipeline — has full key rotation
    const hGroqReq = (messages: { role: string; content: string }[], maxTokens: number, label: string) =>
      groqRequest(
        groqKeys[keyIndexRef.value],  // always use current key from ref
        messages,
        maxTokens,
        label,
        hlog,
        groqKeys,
        keyExhausted,
        keyIndexRef
        // no pipelineSignal for history — it has its own stop mechanism
      );

    try {
      hlog('📜 Starting Hidden History pipeline...', 'info');
      hlog(`📚 ${HISTORY_TOPIC_POOL.length} topic categories available`, 'info');

      // ── Step 1: Get previously covered titles ──────────────────────────────
      const { data: prev } = await supabase
        .from('articles')
        .select('title')
        .eq('category', 'history')
        .order('published_date', { ascending: false })
        .limit(30);

      const prevTitles = (prev ?? []).map((a: any) => `- ${a.title}`).join('\n');
      hlog(`📖 Previously covered: ${prev?.length ?? 0} history articles`, 'info');

      // ── Step 2: Pick topic theme + specific subject ─────────────────────────
      const topicCategory = HISTORY_TOPIC_POOL[Math.floor(Math.random() * HISTORY_TOPIC_POOL.length)];
      hlog(`\n🎯 Topic theme: "${topicCategory}"`, 'info');
      hlog('🤖 Picking specific historical subject...', 'progress');

      // CALL 1: Pick subject — short call, low tokens, same format as main pipeline
      const subjectRaw = await hGroqReq([
        {
          role: 'system',
          content:
            `You are a historian specialising in obscure, surprising true stories from Indian history. ` +
            `Pick ONE specific, real, verifiable subject fitting: "${topicCategory}". ` +
            `It must be obscure, have specific names/dates/numbers, NOT be any of these: ${prevTitles || '(none)'}. ` +
            `Reply with ONLY a compelling title (10-15 words). No JSON. No explanation. Just the title.`,
        },
        { role: 'user', content: `Pick the history subject. Surprising and specific.` },
      ], 80, 'history:subject');

      if (!subjectRaw) { hlog('✗ Could not pick subject — check Groq keys', 'error'); return; }
      const subject = subjectRaw.trim().replace(/^["'`]|["'`]$/g, '');
      hlog(`\n📌 Subject: "${subject}"`, 'success');

      await sleep(3000);

      // ── Step 3: Write article in TWO parts (avoids token truncation) ─────────
      // Part A: Hook + Setup + Rise (first half ~600-700 words)
      hlog('\n✍️  Writing Part 1 of article...', 'progress');

      const part1Raw = await hGroqReq([
        {
          role: 'system',
          content:
            `You are ${AUTHOR.name}, ${AUTHOR.tagline}. ${AUTHOR.bio}\n\n` +
            `Write the FIRST HALF of a deep-dive history article about: "${subject}"\n\n` +
            `Write these sections AS FLOWING PARAGRAPHS with ## headings and **bold** key facts:\n\n` +
            `## [Most shocking fact as heading]\n` +
            `(2-3 sentences) Open with the most surprising fact. **Bold** the key number/detail.\n\n` +
            `## The World They Lived In\n` +
            `(100-150 words) Who, what, when, where. **Specific dates**, **real names**, **exact numbers**.\n\n` +
            `## [Name the subject's greatest achievement]\n` +
            `(300-350 words) Most impressive facts nobody else covers. **Bold** every key figure.\n\n` +
            `RULES: Paragraphs separated by \\n\\n. No bullet points. Every paragraph has one bolded fact.\n` +
            `IMPORTANT: Return ONLY the article text. No JSON. No title. Just the formatted paragraphs.`,
        },
        { role: 'user', content: `Write Part 1 for: "${subject}". Raw text only, no JSON.` },
      ], 1500, 'history:part1');

      if (!part1Raw || part1Raw.length < 200) {
        hlog('✗ Part 1 generation failed', 'error');
        hlog(`   Length: ${part1Raw?.length ?? 0} | Preview: ${part1Raw?.substring(0, 150) ?? 'empty'}`, 'info');
        hlog(`   Using key #${keyIndexRef.value + 1} of ${groqKeys.length}`, 'info');
        return;
      }
      hlog(`   ✅ Part 1: ${part1Raw.split(/\s+/).length} words`, 'success');

      await sleep(4000);

      // Part B: Forgotten + Mystery + Why It Matters + Closer (second half ~500-600 words)
      hlog('✍️  Writing Part 2 of article...', 'progress');

      const part2Raw = await hGroqReq([
        {
          role: 'system',
          content:
            `You are ${AUTHOR.name}, ${AUTHOR.tagline}. ${AUTHOR.bio}\n\n` +
            `Write the SECOND HALF of a deep-dive history article about: "${subject}"\n\n` +
            `Continue with these sections AS FLOWING PARAGRAPHS with ## headings and **bold** key facts:\n\n` +
            `## The Part History Forgot\n` +
            `(200-250 words) What was deliberately buried and why. Be opinionated. **Bold** what was erased.\n\n` +
            `## [The Fall or The Mystery — name it specifically]\n` +
            `(150-200 words) How it ended. What remains unexplained. **Bold** the unresolved question.\n\n` +
            `## Why India Should Care Today\n` +
            `(100-150 words) Direct connection to modern India. No platitudes.\n\n` +
            `## The Line That Says It All\n` +
            `(1 sentence) Sharp, shareable one-liner that sticks in the reader's mind.\n\n` +
            `RULES: Paragraphs separated by \\n\\n. No bullet points. Every paragraph has one bolded fact.\n` +
            `IMPORTANT: Return ONLY the article text. No JSON. No title. Just the formatted paragraphs.`,
        },
        { role: 'user', content: `Write Part 2 for: "${subject}". Raw text only, no JSON.` },
      ], 1500, 'history:part2');

      if (!part2Raw || part2Raw.length < 100) {
        hlog('⚠ Part 2 failed — publishing with Part 1 only', 'warn');
      }
      hlog(`   ✅ Part 2: ${(part2Raw ?? '').split(/\s+/).length} words`, 'success');

      // Combine both parts
      const fullContent = [part1Raw.trim(), (part2Raw ?? '').trim()].filter(Boolean).join('\n\n');
      const wordCount   = fullContent.split(/\s+/).length;
      hlog(`\n📝 Total: ${wordCount} words`, 'success');

      await sleep(3000);

      // CALL 4: Get metadata (title, summary, image queries) — small separate call
      hlog('🏷  Generating title, summary, image queries...', 'progress');

      const metaRaw = await hGroqReq([
        {
          role: 'system',
          content:
            `Return ONLY raw valid JSON — no markdown fences, no backticks, no extra text.\n` +
            `JSON must be on a single line. Use \\n for newlines inside strings.\n` +
            `Format: { "title": "10-20 word compelling title", "summary": "3 punchy teaser sentences without newlines", "score": 8.5, "image_queries": ["query1","query2","query3","query4","query5","query6","query7","query8"] }`,
        },
        {
          role: 'user',
          content:
            `Generate metadata for this history article about: "${subject}"\n\n` +
            `Article preview: ${fullContent.substring(0, 400)}\n\n` +
            `Return a compelling title, 3-sentence summary, score 0-10, and 8 Pexels image queries ` +
            `(mix of ruins, artifacts, landscapes, architecture — no person names). Raw JSON only.`,
        },
      ], 600, 'history:meta');

      // Parse metadata — title/summary/score/images
      interface HistoryMeta { title: string; summary: string; score: number; image_queries: string[] }
      const meta = metaRaw ? extractJSON<HistoryMeta>(metaRaw) : null;

      const title    = meta?.title    ?? subject.substring(0, 200);
      const summary  = meta?.summary  ?? fullContent.substring(0, 300).replace(/\n/g, ' ');
      const score    = meta?.score    ?? 8.5;
      const imgQ     = Array.isArray(meta?.image_queries) ? meta.image_queries : HISTORY_IMAGE_FALLBACKS;

      hlog(`   Title: "${title}"`, 'info');

      // ── Step 5: Save to DB ──────────────────────────────────────────────────
      const { data: saved, error: saveErr } = await supabase
        .from('articles')
        .insert({
          title:          title.substring(0, 255),
          source_url:     `https://ai-generated/history/${Date.now()}`,
          source_name:    AUTHOR.name,
          summary:        summary.substring(0, 500),
          raw_content:    fullContent,
          category:       'history',
          score,
          published_date: new Date().toISOString(),
          is_draft:       true,
          is_published:   false,
          image_url:      null,
          admin_notes:    `Manual history. Subject: "${subject}"`,
        })
        .select('id')
        .single();

      if (saveErr) { hlog(`✗ DB save failed: ${saveErr.message}`, 'error'); return; }
      const articleId = (saved as any).id;
      hlog(`💾 Saved as article #${articleId}`, 'info');

      // ── Step 6: Fetch 8 images ──────────────────────────────────────────────
      hlog('\n🖼  Fetching history images...', 'progress');
      const imageCount = await fetchAndSaveImages(
        pexelsKey, articleId, title, 'history', imgQ, hlog, omdbKey
      );
      hlog(`📸 ${imageCount} images saved`, imageCount >= HISTORY_MIN_IMAGES ? 'success' : 'warn');

      // ── Step 7: Verify + publish ────────────────────────────────────────────
      if (score >= HISTORY_AUTO_PUBLISH_SCORE && imageCount >= HISTORY_MIN_IMAGES) {
        const { data: verify } = await supabase
          .from('articles').select('raw_content, image_url').eq('id', articleId).single();
        if ((verify as any)?.raw_content?.length > 300 && (verify as any)?.image_url) {
          const { error: pubErr } = await supabase
            .from('articles')
            .update({ is_published: true, is_draft: false, updated_at: new Date().toISOString() })
            .eq('id', articleId);
          if (!pubErr) {
            hlog(`\n🚀 PUBLISHED! Article #${articleId} is live`, 'success');
            setHistoryDone(`✅ Published: "${title}"\n${wordCount} words · score ${score.toFixed(1)} · ${imageCount} images`);
          } else {
            hlog(`⚠ Publish failed — saved as draft`, 'warn');
            setHistoryDone(`📋 Draft: "${title}" (publish failed)`);
          }
        } else {
          hlog(`⚠ DB check failed — draft`, 'warn');
          setHistoryDone(`📋 Draft: "${title}"`);
        }
      } else {
        const reason = imageCount < HISTORY_MIN_IMAGES
          ? `only ${imageCount} images (need ${HISTORY_MIN_IMAGES})`
          : `score ${score.toFixed(1)} < ${HISTORY_AUTO_PUBLISH_SCORE}`;
        hlog(`📋 Saved as draft (${reason})`, 'info');
        setHistoryDone(`📋 Draft: "${title}"\nReason: ${reason}`);
      }

      fetchArticles();

    } catch (e: any) {
      hlog(`❌ History pipeline error: ${e.message}`, 'error');
      setError('History generation failed: ' + e.message);
    } finally {
      setHistoryGenerating(false);
    }
  };


  const handleStop = () => {
    stopRef.current = true;
    // Abort any in-flight Groq fetch immediately
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    // Cancel the countdown timer instantly
    if (countRef.current) { clearInterval(countRef.current); setCountdown(0); }
    setGenerating(false);
    setBatchInfo('');
    addLog('⛔ Pipeline stopped immediately.', 'error');
  };


  // ── Re-fetch images for selected article ────────────────────────────────
  const handleRefetchImages = async () => {
    if (!selectedArticle) return;
    setRefetchingImages(true);
    setError(null);
    try {
      const pexelsKey = import.meta.env.VITE_PEXELS_API_KEY as string | undefined;
      const omdbKey   = import.meta.env.VITE_OMDB_API_KEY   as string | undefined;
      if (!pexelsKey) { setError('VITE_PEXELS_API_KEY not set'); return; }

      // Delete existing images first so we don't double-up
      await supabase.from('article_images').delete().eq('article_id', selectedArticle.id);
      await supabase.from('articles').update({ image_url: null }).eq('id', selectedArticle.id);

      const imageQueries: string[] = [];
      const count = await fetchAndSaveImages(
        pexelsKey,
        selectedArticle.id,
        selectedArticle.title,
        selectedArticle.category,
        imageQueries,
        (m) => console.log(m),
        omdbKey
      );

      await selectArticle(selectedArticle);

      if (count > 0) {
        setSuccess(`✅ Found ${count} images!`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Could not find images automatically. Try uploading manually using the suggestions below.');
      }
    } catch (e: any) {
      setError('Re-fetch failed: ' + e.message);
    } finally {
      setRefetchingImages(false);
    }
  };

  // ── Manual image upload ──────────────────────────────────────────────────
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedArticle || !e.target.files?.length) return;
    const file = e.target.files[0];
    setUploading(true); setError(null);
    try {
      const path = `${selectedArticle.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('article-images').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('article-images').getPublicUrl(path);
      await new Promise<void>((res, rej) => {
        const img = new Image();
        img.onload = async () => {
          try {
            const { error: dbErr } = await supabase.from('article_images').insert({
              article_id: selectedArticle.id, image_url: publicUrl,
              position: images.length, width: img.width, height: img.height,
              size_kb: Math.round(file.size / 1024), alt_text: 'Article image',
            });
            if (dbErr) throw dbErr;
            await selectArticle(selectedArticle);
            setSuccess('✅ Image uploaded!'); setTimeout(() => setSuccess(null), 3000);
            res();
          } catch (err) { rej(err); }
        };
        img.onerror = () => rej(new Error('Failed to read image'));
        img.src = publicUrl;
      });
    } catch (e: any) { setError('Upload failed: ' + e.message); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const deleteImage = async (id: number) => {
    if (!confirm('Delete this image?')) return;
    try {
      const { error: e } = await supabase.from('article_images').delete().eq('id', id);
      if (e) throw e;
      setImages(p => p.filter(i => i.id !== id));
      setSuccess('✅ Deleted'); setTimeout(() => setSuccess(null), 2000);
    } catch (e: any) { setError(e.message); }
  };

  const updateAdminNotes = async () => {
    if (!selectedArticle) return;
    try {
      const { error: e } = await supabase.from('articles').update({ admin_notes: adminNotes }).eq('id', selectedArticle.id);
      if (e) throw e;
      setSuccess('✅ Saved!'); setTimeout(() => setSuccess(null), 2000);
    } catch (e: any) { setError(e.message); }
  };

  const publishArticle = async () => {
    if (!selectedArticle) return;
    if (images.length < MIN_IMAGES_TO_PUBLISH) {
      setError(`Need at least ${MIN_IMAGES_TO_PUBLISH} image. You have ${images.length}.`);
      return;
    }
    try {
      const { error: e } = await supabase.from('articles')
        .update({ is_published: true, is_draft: false, updated_at: new Date().toISOString() })
        .eq('id', selectedArticle.id);
      if (e) throw e;
      setSuccess('✅ Article is live!');
      setTimeout(() => { fetchArticles(); setSelectedArticle(null); setImages([]); }, 1500);
    } catch (e: any) { setError(e.message); }
  };

  const deleteArticle = async (article: Article) => {
    if (!confirm(`Permanently delete "${article.title.substring(0, 60)}..."? This cannot be undone.`)) return;
    try {
      await supabase.from('article_images').delete().eq('article_id', article.id);
      const { error: e } = await supabase.from('articles').delete().eq('id', article.id);
      if (e) throw e;
      setSuccess('✅ Article deleted.');
      setSelectedArticle(null);
      setImages([]);
      setTimeout(() => setSuccess(null), 3000);
      fetchArticles();
    } catch (e: any) { setError(e.message); }
  };

  const unpublishArticle = async (article: Article) => {
    if (!confirm('Move this article back to drafts?')) return;
    try {
      const { error: e } = await supabase.from('articles')
        .update({ is_published: false, is_draft: true, updated_at: new Date().toISOString() })
        .eq('id', article.id);
      if (e) throw e;
      setSuccess('✅ Moved to drafts.');
      setTimeout(() => { setSuccess(null); fetchArticles(); setSelectedArticle(null); setImages([]); }, 1500);
    } catch (e: any) { setError(e.message); }
  };

  const scoreColor = (s: number) =>
    s >= 8 ? 'text-green-600 bg-green-50' : s >= 7 ? 'text-yellow-600 bg-yellow-50' : 'text-gray-500 bg-gray-100';
  const logColor = (t: GenLog['type']) =>
    t === 'success' ? 'text-green-400' : t === 'error' ? 'text-red-400' :
    t === 'warn' ? 'text-yellow-300' : t === 'progress' ? 'text-blue-300' : 'text-gray-400';

  const pct = genTotal > 0 ? Math.round((genDone / genTotal) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">

      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">📰 News Admin Panel</h1>
        <p className="text-gray-500 text-sm mt-1">
          Author: <strong>{AUTHOR.name}</strong> ·{' '}
          {Object.keys(NEWS_SOURCES).length} categories × {ARTICLES_PER_CATEGORY} = {Object.keys(NEWS_SOURCES).length * ARTICLES_PER_CATEGORY} articles ·{' '}
          Auto-publish score ≥ {AUTO_PUBLISH_SCORE}
        </p>
      </div>

      {/* ── GENERATE CARD ────────────────────────────────────────────────── */}
      <Card className="mb-6 overflow-hidden border-2 border-blue-200">
        <div className="p-5 bg-blue-50">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            <div className="flex-1">
              <h2 className="font-bold text-blue-900 text-lg flex items-center gap-2 mb-1">
                <Zap size={20} className="text-blue-600 shrink-0" />
                Full Auto Pipeline
              </h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-blue-700 mb-3">
                <span>✍️ Written by {AUTHOR.name}</span>
                <span>🖼 Images from Pexels (free license)</span>
                <span>🚀 Auto-published if score ≥ {AUTO_PUBLISH_SCORE}</span>
                <span>📋 Low-score articles stay in drafts</span>
              </div>

              {generating && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium text-blue-800">
                    <span>{pct}% · {genDone}/{genTotal} articles</span>
                    {countdown > 0 && (
                      <span className="flex items-center gap-1 text-yellow-700 font-bold">
                        <Clock size={12} /> Cooldown: {countdown}s
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                    <div className={`h-3 rounded-full transition-all duration-700 ${countdown > 0 ? 'bg-yellow-400' : 'bg-blue-600'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  {batchInfo && <p className="text-xs text-blue-800 font-medium animate-pulse truncate">{batchInfo}</p>}
                </div>
              )}
            </div>

            <div className="shrink-0">
              {generating ? (
                <Button onClick={handleStop} size="lg" className="bg-red-600 hover:bg-red-700 text-white font-bold px-6">
                  <X size={18} className="mr-1.5" /> Stop
                </Button>
              ) : (
                <Button onClick={handleGenerate} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 shadow-md">
                  <Zap size={18} className="mr-1.5" /> Generate &amp; Publish
                </Button>
              )}
            </div>
          </div>
        </div>

        {genLogs.length > 0 && (
          <div ref={logContainerRef} className="bg-gray-950 p-3 max-h-64 overflow-y-auto font-mono text-xs leading-[1.6] border-t border-gray-800">
            {genLogs.map(l => (
              <div key={l.id} className={logColor(l.type)}>
                <span className="text-gray-600 mr-2 select-none">{l.ts}</span>{l.message}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════════════════
           HISTORY PIPELINE SECTION
      ══════════════════════════════════════════════════════════════════ */}
      <Card className="p-5 border-2 border-amber-200 bg-amber-50/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

          {/* Left: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">📜</span>
              <h2 className="font-bold text-lg text-amber-900">Hidden History</h2>
              <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">Weekly Special</span>
            </div>
            <p className="text-sm text-amber-700 leading-relaxed">
              Generates a single 1200–1500 word deep-dive into forgotten Indian history.
              Picks an obscure subject, writes a gripping narrative, fetches 8 images, auto-publishes if score ≥ 7.5.
            </p>
            <p className="text-xs text-amber-600 mt-1">
              ⏱ Takes ~3–5 minutes · Uses 1 Groq key slot · Avoids previously covered topics automatically
            </p>
          </div>

          {/* Right: button */}
          <div className="shrink-0">
            {historyGenerating ? (
              <div className="flex items-center gap-3">
                <div className="text-sm text-amber-700 animate-pulse font-medium">📜 Writing history...</div>
              </div>
            ) : (
              <Button
                onClick={handleGenerateHistory}
                disabled={generating || historyGenerating}
                className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-6 py-2.5 shadow"
              >
                📜 Generate History Article
              </Button>
            )}
          </div>
        </div>

        {/* History logs */}
        {historyLogs.length > 0 && (
          <div className="mt-4 bg-amber-950 rounded-xl p-3 max-h-48 overflow-y-auto font-mono text-xs leading-[1.7]">
            {historyLogs.map(l => (
              <div key={l.id} className={
                l.type === 'error'    ? 'text-red-400' :
                l.type === 'success'  ? 'text-green-400' :
                l.type === 'warn'     ? 'text-yellow-400' :
                l.type === 'progress' ? 'text-blue-300' :
                'text-amber-200'
              }>
                <span className="text-amber-700 mr-2 select-none">{l.ts}</span>{l.message}
              </div>
            ))}
          </div>
        )}

        {/* Result banner */}
        {historyDone && (
          <div className={`mt-4 p-3 rounded-xl text-sm font-medium whitespace-pre-wrap ${
            historyDone.startsWith('✅')
              ? 'bg-green-100 border border-green-300 text-green-800'
              : 'bg-amber-100 border border-amber-300 text-amber-800'
          }`}>
            {historyDone}
          </div>
        )}
      </Card>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-lg text-red-800">
          <div className="flex justify-between gap-4">
            <p className="font-bold">Error</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-sm shrink-0">✕ Dismiss</button>
          </div>
          <p className="text-sm whitespace-pre-wrap mt-1">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-300 rounded-lg text-green-800">
          <p className="font-bold">Success</p>
          <p className="text-sm whitespace-pre-wrap mt-1">{success}</p>
        </div>
      )}

      {/* ── MAIN GRID ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Article list */}
        <div className="lg:col-span-1">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg">
                Articles ({articles.length})
                {generating && <span className="ml-2 text-xs text-blue-500 animate-pulse font-normal">● live</span>}
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={() => { setSelectMode(s => !s); setSelectedIds(new Set()); }}
                  className={`text-xs px-2 py-1 rounded font-medium transition ${selectMode ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                  {selectMode ? '✕ Cancel' : '☑ Select'}
                </button>
                <button onClick={fetchArticles} disabled={loading} className="text-gray-400 hover:text-blue-600">
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="flex gap-1 mb-3">
              {(['draft', 'published', 'all'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex-1 py-1.5 rounded text-sm font-medium transition ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {selectMode && (
              <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                <div className="flex items-center gap-2">
                  <button onClick={toggleSelectAll}>
                    {selectedIds.size === articles.length ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-gray-400" />}
                  </button>
                  <span className="text-sm text-gray-600">{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select to delete'}</span>
                </div>
                <button onClick={deleteSelected} disabled={!selectedIds.size || deleting}
                  className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded transition ${selectedIds.size ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                  <Trash2 size={14} /> {deleting ? 'Deleting...' : `Delete (${selectedIds.size})`}
                </button>
              </div>
            )}

            {loading && <p className="text-center text-gray-400 py-8">⏳ Loading...</p>}
            {!loading && !articles.length && (
              <div className="text-center text-gray-400 py-10">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm">No articles yet.</p>
                {filter === 'draft' && <p className="text-xs mt-1">Click Generate &amp; Publish to start.</p>}
              </div>
            )}

            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {articles.map(article => (
                <div key={article.id}
                  onClick={() => selectMode ? toggleSelect(article.id) : selectArticle(article)}
                  className={`flex items-start gap-2 p-3 rounded-lg border-2 cursor-pointer transition ${
                    selectedArticle?.id === article.id && !selectMode ? 'border-blue-500 bg-blue-50' :
                    selectedIds.has(article.id) ? 'border-red-300 bg-red-50' :
                    'border-gray-200 hover:border-blue-300 bg-white'
                  }`}
                >
                  {selectMode && (
                    <div className="mt-0.5 shrink-0">
                      {selectedIds.has(article.id) ? <CheckSquare size={18} className="text-red-500" /> : <Square size={18} className="text-gray-400" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug line-clamp-2 mb-1">{article.title}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 capitalize">{article.category}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${scoreColor(article.score)}`}>⭐ {article.score?.toFixed(1) ?? '—'}</span>
                      {article.is_published && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Live</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {!selectedArticle || selectMode ? (
            <Card className="flex flex-col items-center justify-center min-h-[400px] text-gray-400">
              {selectMode ? <><p className="text-5xl mb-3">☑️</p><p className="font-medium text-gray-500">Select articles to delete</p></>
                : generating ? <><p className="text-5xl mb-3 animate-bounce">🤖</p>
                    <p className="font-medium text-gray-500">Full auto pipeline running...</p>
                    <p className="text-sm mt-2 text-blue-500 text-center px-4">Writing articles + fetching images + auto-publishing.<br/>Check Published tab to see live articles.</p></>
                : <><p className="text-5xl mb-3">👈</p><p className="font-medium text-gray-500">Select an article to manage</p><p className="text-sm mt-1">Or click Generate &amp; Publish for full automation</p></>
              }
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="p-5">
                <div className="flex items-start gap-3 mb-2">
                  <h3 className="font-bold text-lg leading-snug flex-1">{selectedArticle.title}</h3>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-sm font-bold px-2 py-1 rounded ${scoreColor(selectedArticle.score)}`}>⭐ {selectedArticle.score?.toFixed(1)}</span>
                    {selectedArticle.is_published && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">🟢 Live</span>}
                  </div>
                </div>

                <p className="text-xs text-gray-400 mb-3 font-medium">
                  ✍️ By <span className="text-blue-600">{selectedArticle.source_name}</span> · {selectedArticle.category}
                </p>
                <p className="text-sm text-gray-600 mb-3 leading-relaxed">{selectedArticle.summary}</p>

                {selectedArticle.raw_content && (
                  <details className="mb-4">
                    <summary className="text-sm text-blue-600 cursor-pointer font-medium hover:underline">📄 View full article</summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-700 leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap">
                      {selectedArticle.raw_content}
                    </div>
                  </details>
                )}

                <div className="grid grid-cols-3 gap-3 mb-5 text-center text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Category</p>
                    <p className="font-bold capitalize">{selectedArticle.category}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Images</p>
                    <p className={`font-bold ${images.length >= 1 ? 'text-green-600' : 'text-orange-500'}`}>{images.length} saved</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Status</p>
                    <p className={`font-bold text-xs ${selectedArticle.is_published ? 'text-green-600' : 'text-orange-500'}`}>
                      {selectedArticle.is_published ? '🟢 Published' : '📋 Draft'}
                    </p>
                  </div>
                </div>

                {!selectedArticle.is_published && (
                  <Button onClick={publishArticle} disabled={images.length < MIN_IMAGES_TO_PUBLISH}
                    className={`w-full font-bold py-3 text-base text-white ${images.length >= MIN_IMAGES_TO_PUBLISH ? 'bg-green-600 hover:bg-green-700 shadow' : 'bg-gray-300 cursor-not-allowed'}`}>
                    {images.length >= MIN_IMAGES_TO_PUBLISH ? '🚀 Publish Now' : `📸 Need at least ${MIN_IMAGES_TO_PUBLISH} image to publish`}
                  </Button>
                )}
                {selectedArticle.is_published && (
                  <div className="space-y-2">
                    <div className="w-full py-2.5 text-center text-green-700 font-bold bg-green-50 rounded-lg border border-green-200 text-sm">
                      🟢 This article is live on your website
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => unpublishArticle(selectedArticle)}
                        variant="outline"
                        className="w-full text-sm font-semibold border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                      >
                        📋 Move to Drafts
                      </Button>
                      <Button
                        onClick={() => deleteArticle(selectedArticle)}
                        className="w-full text-sm font-semibold bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Trash2 size={15} className="mr-1.5" /> Delete Forever
                      </Button>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="p-4">
                <h4 className="font-bold mb-2">📝 Admin Notes</h4>
                <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                  placeholder="Private notes..." className="mb-2 min-h-[70px] text-sm" />
                <Button onClick={updateAdminNotes} variant="outline" className="w-full text-sm">Save Notes</Button>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold">🖼️ Images ({images.length})</h4>
                  <div className="flex items-center gap-2">
                    {images.length === 0 && selectedArticle.is_published && (
                      <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full animate-pulse">
                        ⚠ Published with 0 images!
                      </span>
                    )}
                    <Button
                      variant="outline"
                      onClick={handleRefetchImages}
                      disabled={refetchingImages}
                      className="text-xs h-7 px-2 border-blue-300 text-blue-600 hover:bg-blue-50"
                    >
                      <RefreshCw size={11} className={`mr-1 ${refetchingImages ? 'animate-spin' : ''}`} />
                      {refetchingImages ? 'Fetching...' : 'Re-fetch'}
                    </Button>
                  </div>
                </div>

                {/* ── Image suggestions ─────────────────────────────────── */}
                {images.length < 2 && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-bold text-amber-700 mb-2">
                      💡 Suggested searches for this article:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {generateImageSuggestions(selectedArticle.title, selectedArticle.category).map((suggestion, i) => (
                        <a
                          key={i}
                          href={`https://www.pexels.com/search/${encodeURIComponent(suggestion)}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-white border border-amber-300 text-amber-800 px-2 py-1 rounded-lg hover:bg-amber-100 hover:border-amber-400 transition font-medium"
                        >
                          🔍 {suggestion}
                        </a>
                      ))}
                      {selectedArticle.category === 'bollywood' && (
                        <a
                          href={`https://www.omdbapi.com/?s=${encodeURIComponent(selectedArticle.title.split(' ').slice(0, 3).join(' '))}&apikey=${import.meta.env.VITE_OMDB_API_KEY ?? ''}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-purple-50 border border-purple-300 text-purple-700 px-2 py-1 rounded-lg hover:bg-purple-100 transition font-medium"
                        >
                          🎬 Search OMDb
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-amber-600 mt-2">
                      Click to search, then download and upload below. Or click Re-fetch to auto-try again.
                    </p>
                  </div>
                )}

                {/* ── Manual upload ─────────────────────────────────────── */}
                {images.length < 5 && (
                  <label className="block mb-4 cursor-pointer">
                    <div className={`border-2 border-dashed rounded-xl p-4 text-center transition ${uploading ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}>
                      <Upload size={24} className="mx-auto mb-1 text-gray-400" />
                      <p className="text-sm font-medium text-gray-600">{uploading ? '⏳ Uploading...' : 'Upload image manually'}</p>
                      <p className="text-xs text-gray-400">Min 1200×800px · JPG or PNG</p>
                    </div>
                    <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading || images.length >= 5} className="hidden" />
                  </label>
                )}

                {/* ── Image grid ────────────────────────────────────────── */}
                {images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {images.map((img, idx) => (
                      <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200">
                        <img src={img.image_url} alt={img.alt_text || `Image ${idx + 1}`} className="w-full h-36 object-cover" loading="lazy" />
                        <span className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">#{idx + 1}</span>
                        {img.width >= IMAGE_MIN_WIDTH && (
                          <span className="absolute top-1 right-1 bg-green-600/80 text-white text-xs px-1.5 py-0.5 rounded">✓ {img.width}px</span>
                        )}
                        <button onClick={() => deleteImage(img.id)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <Trash2 size={24} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-red-50 rounded-xl border border-red-200">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-sm font-bold text-red-600">No images</p>
                    <p className="text-xs text-red-400 mt-1">
                      {selectedArticle.is_published
                        ? 'This article is live but has no images — visitors see a blank space!'
                        : 'Use Re-fetch or upload manually above.'}
                    </p>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}