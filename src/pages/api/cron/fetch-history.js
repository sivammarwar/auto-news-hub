// pages/api/cron/fetch-history.js
// Runs every Saturday at 8:00 PM IST = 2:30 PM UTC (14:30)
// Generates ONE deeply researched article about a forgotten king/person/startup/etc.

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Topic Pool ────────────────────────────────────────────────────────────────
// GPT picks from these categories and finds a unique, obscure subject
const TOPIC_CATEGORIES = [
  'a forgotten Indian king or queen whose story is almost unknown today',
  'a failed startup that almost changed the world',
  'an ancient Indian city that disappeared from history',
  'a historical figure who invented something but never got credit',
  'a secret or hidden chapter from Indian history most people never learn',
  'a person who changed the world but was erased from textbooks',
  'an empire that was powerful for centuries but is now completely forgotten',
  'a scientific discovery made centuries before it was officially credited',
  'a real historical mystery that was never solved',
  'a company or business from history that dominated its era but no one talks about now',
];

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('\n=== HISTORY CRON STARTED ===\n');
    const timestamp = new Date().toISOString();

    // ── Step 1: Get all previous history titles to avoid repeats ──────────
    const { data: previousArticles } = await supabaseAdmin
      .from('articles')
      .select('title')
      .eq('category', 'history')
      .order('published_date', { ascending: false })
      .limit(50);

    const previousTitles = (previousArticles || []).map((a) => a.title).join('\n- ');

    // ── Step 2: Pick a unique topic with GPT ──────────────────────────────
    console.log('🎯 Selecting this week\'s history topic...');

    const randomCategory = TOPIC_CATEGORIES[Math.floor(Math.random() * TOPIC_CATEGORIES.length)];

    const topicResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a history researcher who specializes in obscure, fascinating stories that most people have never heard of.

Your job: Pick ONE specific, real, fascinating subject in this category: "${randomCategory}"

Rules:
- Must be a REAL person, place, or event — no fiction
- Must be genuinely obscure — not something taught in school
- Must NOT be any of these already covered topics:
${previousTitles ? `- ${previousTitles}` : '(none yet)'}
- Respond with ONLY the subject name/title, nothing else
- Example format: "Rani Velu Nachiyar — The First Queen to Fight British Rule"`,
        },
        {
          role: 'user',
          content: `Pick this week's history subject. Category: ${randomCategory}`,
        },
      ],
      max_tokens: 60,
      temperature: 0.9, // High temperature = more variety
    });

    const chosenTopic = topicResponse.choices[0].message.content.trim();
    console.log(`✅ Topic selected: "${chosenTopic}"`);

    // ── Step 3: Generate the full detailed article ────────────────────────
    console.log('✍️  Generating full article...');

    const articleResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a gifted history writer who makes forgotten stories come alive.

Write a deeply researched, engaging article about the given subject.

Structure your article exactly like this:

**HOOK** (2-3 sentences that immediately grab attention with the most surprising fact)

**WHO/WHAT WERE THEY** (Background — who was this person/place/thing, when did they exist, where)

**THE RISE** (Their most impressive achievement, what made them remarkable, specific details and numbers where possible)

**THE UNKNOWN PART** (The specific detail that almost nobody knows — the twist, the secret, the thing that was hidden from history)

**THE FALL OR MYSTERY** (How it ended, why they were forgotten, or what mystery remains unsolved)

**WHY IT MATTERS TODAY** (1-2 sentences connecting this history to the present)

Rules:
- 600-800 words total
- Use specific dates, names, and numbers — be precise
- Write like a journalist, not a textbook
- Every paragraph should make the reader want to read the next one
- Do NOT use markdown headers — write in flowing paragraphs
- Be 100% factual — no invented details`,
        },
        {
          role: 'user',
          content: `Write a full history article about: ${chosenTopic}`,
        },
      ],
      max_tokens: 1200,
      temperature: 0.7,
    });

    const fullArticle = articleResponse.choices[0].message.content.trim();
    console.log(`✅ Article generated (${fullArticle.split(' ').length} words)`);

    // ── Step 4: Generate a short summary (for article cards) ──────────────
    console.log('📝 Generating summary...');

    const summaryResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Write a 2-sentence teaser summary for a history article. 
Make it intriguing enough that someone HAS to click to read more.
Do not reveal the full story — just enough to hook them.`,
        },
        {
          role: 'user',
          content: `Article title: ${chosenTopic}\n\nFull article:\n${fullArticle.substring(0, 800)}`,
        },
      ],
      max_tokens: 100,
      temperature: 0.6,
    });

    const summary = summaryResponse.choices[0].message.content.trim();

    // ── Step 5: Generate a relevance score ───────────────────────────────
    const scoreResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Score this history article 0-10 based on:
- How surprising or unknown the subject is
- How engaging the writing is
- Whether readers would share this
- Overall quality and depth
RETURN ONLY a number like "8.5"`,
        },
        {
          role: 'user',
          content: `Title: ${chosenTopic}\n\nArticle: ${fullArticle.substring(0, 500)}`,
        },
      ],
      max_tokens: 5,
      temperature: 0.2,
    });

    const score = parseFloat(scoreResponse.choices[0].message.content.trim()) || 8.0;

    // ── Step 6: Insert into Supabase ──────────────────────────────────────
    const { data, error } = await supabaseAdmin
      .from('articles')
      .insert([
        {
          title: chosenTopic,
          source_url: `https://internal/history/${Date.now()}`, // Internal — no external source
          source_name: 'History Desk',
          summary: summary,
          raw_content: fullArticle, // Full article stored in raw_content
          category: 'history',
          score: score,
          image_url: null,
          published_date: new Date().toISOString(),
          is_published: true,
        },
      ])
      .select('id');

    if (error) throw error;

    console.log(`\n✅ History article published! ID: ${data?.[0]?.id}`);
    console.log(`   Title: ${chosenTopic}`);
    console.log(`   Score: ${score}/10`);
    console.log('\n=== HISTORY CRON COMPLETED ===\n');

    return res.status(200).json({
      success: true,
      article: {
        id: data?.[0]?.id,
        title: chosenTopic,
        score,
        wordCount: fullArticle.split(' ').length,
      },
      timestamp,
    });
  } catch (error) {
    console.error('\n❌ HISTORY CRON ERROR:', error.message);
    return res.status(500).json({ error: error.message });
  }
}