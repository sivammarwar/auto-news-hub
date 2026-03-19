// api/cron/analyze-trends.js
// Uses GROQ API (FREE) instead of OpenAI
// Generates ORIGINAL trend analysis articles automatically

import axios from 'axios';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ✅ FIXED: SUPABASE_URL instead of VITE_SUPABASE_URL
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CATEGORIES = ['cricket', 'bollywood', 'technology'];

const RESEARCH_SOURCES = {
  cricket: [
    'https://www.espncricinfo.com/feeds/rss/cricket_news.xml',
    'https://www.cricbuzz.com/rss/news.xml'
  ],
  bollywood: [
    'https://www.bollywoodhungama.com/news/rss',
    'https://www.thehindu.com/entertainment/movies/'
  ],
  technology: [
    'https://feeds.techcrunch.com/techcrunch/startups',
    'https://feeds.theverge.com/rss/index.xml',
    'https://news.ycombinator.com/rss'
  ]
};

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const timestamp = new Date().toISOString();
    console.log(`\n=== TREND ANALYSIS STARTED at ${timestamp} ===\n`);

    let totalCreated = 0;
    const createdArticles = [];

    for (const category of CATEGORIES) {
      console.log(`\n📊 Analyzing trends in ${category.toUpperCase()}...`);

      const researchFacts = await collectResearchFacts(category);

      if (researchFacts.length === 0) {
        console.log(`   ⚠️  No trending topics found for ${category}`);
        continue;
      }

      console.log(`   ✓ Collected ${researchFacts.length} trending topics`);

      const topTrends = researchFacts.slice(0, 2);

      for (const trend of topTrends) {
        try {
          console.log(`\n   🎯 Creating analysis: "${trend.topic}"`);

          const article = await generateOriginalArticle(
            trend.topic,
            trend.facts,
            trend.sources,
            category
          );

          const { data, error } = await supabaseAdmin
            .from('articles')
            .insert([{
              title: article.title,
              source_url: `https://internal/analysis/${Date.now()}`,
              source_name: 'AI Correspondent',
              summary: article.summary,
              raw_content: article.fullArticle,
              category: category,
              score: article.score,
              image_url: null,
              published_date: new Date().toISOString(),
              is_draft: true,
              admin_notes: `Auto-generated from trending topic: ${trend.topic}. Original sources: ${trend.sources.join(', ')}`
            }])
            .select('id');

          if (error) throw error;

          const articleId = data?.[0]?.id;
          console.log(`   ✅ Article created! ID: ${articleId}`);
          console.log(`   📝 Title: ${article.title}`);
          console.log(`   ⭐ Score: ${article.score}/10`);

          totalCreated++;
          createdArticles.push({ id: articleId, title: article.title, score: article.score });

          await sleep(500);
        } catch (error) {
          console.error(`   ✗ Error processing trend: ${error.message}`);
        }
      }
    }

    console.log(`\n=== TREND ANALYSIS COMPLETED ===`);
    console.log(`Total original articles created: ${totalCreated}`);

    return res.status(200).json({
      success: true,
      articlesCreated: totalCreated,
      articles: createdArticles,
      timestamp,
      message: `Created ${totalCreated} original trend analysis articles.`
    });

  } catch (error) {
    console.error('\n❌ TREND ANALYSIS ERROR:', error.message);
    return res.status(500).json({ error: error.message, timestamp: new Date().toISOString() });
  }
}

async function collectResearchFacts(category) {
  const sources = RESEARCH_SOURCES[category] || [];
  const allFacts = [];
  const sourcesUsed = [];

  for (const source of sources) {
    try {
      const response = await axios.get(source, { timeout: 8000 });
      const headlines = extractHeadlines(response.data);

      headlines.slice(0, 5).forEach(headline => {
        if (headline && headline.length > 10) allFacts.push(headline);
      });

      const domain = new URL(source).hostname.replace('www.', '');
      sourcesUsed.push(domain);
    } catch (error) {
      console.error(`   ✗ Error fetching ${source}: ${error.message}`);
    }
    await sleep(300);
  }

  const uniqueFacts = deduplicateFacts(allFacts);

  if (uniqueFacts.length > 0) {
    const topTopic = await identifyTopTrend(uniqueFacts, category);
    return [{ topic: topTopic, facts: uniqueFacts.slice(0, 10), sources: sourcesUsed }];
  }

  return [];
}

async function identifyTopTrend(facts, category) {
  try {
    const response = await groq.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      messages: [
        {
          role: 'system',
          content: `You are a news analyst. Given trending topics in ${category}, identify the SINGLE most important/viral trend. Return ONLY the trend name/topic (2-5 words), nothing else.`
        },
        {
          role: 'user',
          content: `Most discussed topics in ${category} right now:\n${facts.slice(0, 15).map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nWhat is THE top trending topic?`
        }
      ],
      max_tokens: 20,
      temperature: 0.7
    });
    return response.choices[0].message.content.trim();
  } catch (error) {
    return facts[0] || 'Breaking News';
  }
}

async function generateOriginalArticle(trendTopic, facts, sources, category) {
  const articleResponse = await groq.chat.completions.create({
    model: 'mixtral-8x7b-32768',
    messages: [
      {
        role: 'system',
        content: `You are a professional news correspondent covering ${category} trends. Write an ORIGINAL article analyzing the given trend. 600-800 words, engaging, factual, written as original journalism.`
      },
      {
        role: 'user',
        content: `Write an original ${category} article analyzing this trend: "${trendTopic}"\n\nFacts to synthesize:\n${facts.map((f, i) => `${i + 1}. ${f}`).join('\n')}`
      }
    ],
    max_tokens: 1500,
    temperature: 0.7
  });

  const fullArticle = articleResponse.choices[0].message.content.trim();

  const headlineResponse = await groq.chat.completions.create({
    model: 'mixtral-8x7b-32768',
    messages: [
      { role: 'system', content: 'Create a compelling news headline (8-12 words). Just the headline, nothing else.' },
      { role: 'user', content: fullArticle.substring(0, 500) }
    ],
    max_tokens: 20,
    temperature: 0.6
  });

  const summaryResponse = await groq.chat.completions.create({
    model: 'mixtral-8x7b-32768',
    messages: [
      { role: 'system', content: 'Write a 2-sentence summary that makes people want to read this article.' },
      { role: 'user', content: fullArticle.substring(0, 800) }
    ],
    max_tokens: 100,
    temperature: 0.6
  });

  const scoreResponse = await groq.chat.completions.create({
    model: 'mixtral-8x7b-32768',
    messages: [
      { role: 'system', content: `Score this ${category} article 0-10 on originality, depth, engagement. Return ONLY a number like "8.5"` },
      { role: 'user', content: fullArticle.substring(0, 600) }
    ],
    max_tokens: 5,
    temperature: 0.2
  });

  const score = parseFloat(scoreResponse.choices[0].message.content.trim()) || 7.5;

  return {
    title: headlineResponse.choices[0].message.content.trim(),
    summary: summaryResponse.choices[0].message.content.trim(),
    fullArticle,
    score: Math.min(10, Math.max(0, score))
  };
}

function extractHeadlines(rssContent) {
  const headlines = [];
  try {
    const titleMatches = rssContent.match(/<title[^>]*>([^<]+)<\/title>/gi) || [];
    titleMatches.forEach(match => {
      const title = match.replace(/<[^>]*>/g, '').trim();
      if (title && title.length > 10) headlines.push(title);
    });
  } catch (error) {}
  return headlines.slice(0, 20);
}

function deduplicateFacts(facts) {
  const unique = [];
  const seen = new Set();
  for (const fact of facts) {
    const normalized = fact.toLowerCase().substring(0, 30);
    if (!seen.has(normalized) && fact.length > 15) {
      unique.push(fact);
      seen.add(normalized);
    }
  }
  return unique;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}