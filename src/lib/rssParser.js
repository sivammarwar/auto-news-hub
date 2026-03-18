import axios from 'axios';
import xml2js from 'xml2js';

const xmlParser = new xml2js.Parser();

const RSS_SOURCES = {
  cricket: [
    'https://www.espncricinfo.com/feeds/rss/cricket_news.xml',
    'https://www.cricbuzz.com/rss/news.xml'
  ],
  bollywood: [
    'https://www.bollywoodhungama.com/news/rss',
    'https://www.hindustantimes.com/feeds/rss/entertainment/bollywood.xml'
  ],
  technology: [
    'https://feeds.techcrunch.com/techcrunch/startups',
    'https://feeds.theverge.com/rss/index.xml',
    'https://news.ycombinator.com/rss'
  ]
};

export const fetchRSSFeed = async (category) => {
  const sources = RSS_SOURCES[category] || [];
  const articles = [];

  for (const rssUrl of sources) {
    try {
      const response = await axios.get(rssUrl, { timeout: 10000 });
      const parsed = await xmlParser.parseStringPromise(response.data);
      
      const items = parsed.rss?.channel?.[0]?.item || [];
      
      items.forEach(item => {
        articles.push({
          title: item.title?.[0] || 'No title',
          sourceUrl: item.link?.[0] || item.guid?.[0],
          sourceName: item.source?.[0]?._ || 'RSS Feed',
          rawContent: item.description?.[0] || '',
          imageUrl: extractImageFromContent(item.description?.[0]),
          publishedDate: new Date(item.pubDate?.[0] || Date.now()),
          category: category
        });
      });
    } catch (error) {
      console.error(`RSS parsing error for ${rssUrl}:`, error.message);
    }
  }

  return articles;
};

function extractImageFromContent(content) {
  if (!content) return null;
  const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
  return imgMatch ? imgMatch[1] : null;
}