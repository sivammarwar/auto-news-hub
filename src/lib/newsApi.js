// lib/newsapi.js
import axios from 'axios';

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = 'https://newsapi.org/v2';

const QUERIES = {
  cricket: 'cricket news',
  bollywood: 'bollywood OR hindi cinema OR indian films',
  technology: 'technology OR AI OR startups OR software',
};

export const fetchNewsFromNewsAPI = async (category) => {
  if (!NEWS_API_KEY) {
    console.log('   ⚠️  NEWS_API_KEY not set, skipping NewsAPI');
    return [];
  }

  try {
    // ✅ Fix: params must be inside { params: {} }, not the second arg directly
    const response = await axios.get(`${NEWS_API_URL}/everything`, {
      params: {
        q: QUERIES[category] || category,
        sortBy: 'publishedAt',
        language: 'en',
        pageSize: 30,
        apiKey: NEWS_API_KEY,
      },
      timeout: 10000,
    });

    return (response.data.articles || [])
      .filter((a) => a.url && a.title && a.title !== '[Removed]')
      .map((article) => ({
        title: article.title,
        sourceUrl: article.url,
        sourceName: article.source?.name || 'News API',
        rawContent: article.content || article.description || '',
        imageUrl: article.urlToImage || null,
        publishedDate: new Date(article.publishedAt),
        category,
      }));
  } catch (error) {
    console.error(`   ✗ NewsAPI error for ${category}: ${error.message}`);
    return [];
  }
};