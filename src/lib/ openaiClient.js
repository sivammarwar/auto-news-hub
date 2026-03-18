import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const summarizeArticle = async (title, content) => {
  if (!content || content.length < 50) {
    return content || title;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a news summarization AI. Create concise, factual summaries of news articles in 90-120 tokens.
          
Requirements:
- Be factual, avoid sensationalism
- Include key details (who, what, when, where)
- Do not add commentary or opinion
- Write in clear, simple language
- Use bullet points if helpful`
        },
        {
          role: 'user',
          content: `Summarize this article:

Title: ${title}

Content: ${content.substring(0, 2000)}`
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI summarization error:', error.message);
    // Fallback to truncated content
    return content.substring(0, 300) + '...';
  }
};

export const scoreArticle = async (title, summary, category) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a news relevance scoring AI. Score articles on a scale of 0-10 based on:
- Relevance to ${category}
- Recency and timeliness
- Potential virality/engagement
- News value and importance

Return ONLY a number between 0-10, nothing else.`
        },
        {
          role: 'user',
          content: `Score this article:\n\nTitle: ${title}\n\nSummary: ${summary}`
        }
      ],
      max_tokens: 5,
      temperature: 0.3
    });

    const score = parseFloat(response.choices[0].message.content.trim());
    return isNaN(score) ? 5.0 : Math.min(10, Math.max(0, score));
  } catch (error) {
    console.error('OpenAI scoring error:', error.message);
    return 5.0; // Default middle score
  }
};