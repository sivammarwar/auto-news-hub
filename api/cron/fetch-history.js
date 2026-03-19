// api/cron/fetch-history.js
// Uses GROQ API (FREE) instead of OpenAI
// Generates ONE deeply researched original article about forgotten history

import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ✅ FIXED: SUPABASE_URL instead of VITE_SUPABASE_URL
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    console.log('\n=== HISTORY CRON STARTED (Groq) ===\n');
    const timestamp = new Date().toISOString();

    const { data: previousArticles } = await supabaseAdmin
      .from('articles')
      .select('title')
      .eq('category', 'history')
      .order('published_date', { ascending: false })
      .limit(50);

    const previousTitles = (previousArticles || []).map(a => a.title).join('\n- ');

    console.log('🎯 Selecting this week\'s history topic...');

    const randomCategory = TOPIC_CATEGORIES[Math.floor(Math.random() * TOPIC_CATEGORIES.length)];

    const topicResponse = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [
        {
          role: 'system',
          content: `You are a history researcher who specializes in obscure, fascinating stories.

Pick ONE specific, real, fascinating subject in this category: "${randomCategory}"

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
      temperature: 0.9,
    });

    const chosenTopic = topicResponse.choices[0].message.content.trim();
    console.log(`✅ Topic selected: "${chosenTopic}"`);

    console.log('✍️  Generating full article with Groq...');

    const articleResponse = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [
        {
          role: 'system',
          content: `You are a gifted history writer who makes forgotten stories come alive.

Write a deeply researched, engaging article about the given subject.

Structure your article exactly like this:

HOOK (2-3 sentences that immediately grab attention with the most surprising fact)

WHO/WHAT WERE THEY (Background — who was this person/place/thing, when did they exist, where)

THE RISE (Their most impressive achievement, what made them remarkable, specific details and numbers where possible)

THE UNKNOWN PART (The specific detail that almost nobody knows — the twist, the secret)

THE FALL OR MYSTERY (How it ended, why they were forgotten, or what mystery remains)

WHY IT MATTERS TODAY (1-2 sentences connecting this history to the present)

Rules:
- 600-800 words total
- Use specific dates, names, and numbers
- Write like a journalist, not a textbook
- Do NOT use markdown headers — write in flowing paragraphs
- Be 100% factual — no invented details`,
        },
        {
          role: 'user',
          content: `Write a full history article about: ${chosenTopic}`,
        },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const fullArticle = articleResponse.choices[0].message.content.trim();
    console.log(`✅ Article generated (${fullArticle.split(' ').length} words)`);

    const summaryResponse = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [
        {
          role: 'system',
          content: `Write a 2-sentence teaser summary for a history article. Make it intriguing enough that someone HAS to click. Do not reveal the full story.`,
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

    const scoreResponse = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [
        {
          role: 'system',
          content: `Score this history article 0-10 based on: how surprising the subject is, how engaging the writing is, whether readers would share this. RETURN ONLY a number like "8.5"`,
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

    const { data, error } = await supabaseAdmin
      .from('articles')
      .insert([{
        title: chosenTopic,
        source_url: `https://internal/history/${Date.now()}`,
        source_name: 'History Correspondent',
        summary,
        raw_content: fullArticle,
        category: 'history',
        score,
        image_url: null,
        published_date: new Date().toISOString(),
        is_published: false,
        is_draft: true,
        admin_notes: 'Original history article (Groq). Add images and publish when ready.'
      }])
      .select('id');

    if (error) throw error;

    console.log(`\n✅ History article created as draft! ID: ${data?.[0]?.id}`);
    console.log(`   Title: ${chosenTopic}`);
    console.log(`   Score: ${score}/10`);
    console.log('\n=== HISTORY CRON COMPLETED ===\n');

    return res.status(200).json({
      success: true,
      article: { id: data?.[0]?.id, title: chosenTopic, score, wordCount: fullArticle.split(' ').length, status: 'draft' },
      timestamp,
      message: 'Original history article created. Review and publish in admin panel.'
    });

  } catch (error) {
    console.error('\n❌ HISTORY CRON ERROR:', error.message);
    return res.status(500).json({ error: error.message });
  }
}