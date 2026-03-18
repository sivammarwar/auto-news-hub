// lib/twitter.js
import axios from 'axios';

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

const TWITTER_QUERIES = {
  cricket: '(cricket OR IPL OR TestCricket OR BCCI) lang:en -is:retweet',
  bollywood: '(bollywood OR "hindi film" OR "new movie" OR "box office") lang:en -is:retweet',
  technology: '(AI OR startup OR "tech news" OR OpenAI OR software) lang:en -is:retweet',
};

export const fetchFromTwitter = async (category) => {
  if (!TWITTER_BEARER_TOKEN) {
    console.log('   ⚠️  TWITTER_BEARER_TOKEN not set, skipping Twitter');
    return [];
  }

  const query = TWITTER_QUERIES[category];
  if (!query) return [];

  try {
    const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
      params: {
        query,
        max_results: 20,
        'tweet.fields': 'created_at,author_id,entities,public_metrics',
        expansions: 'author_id',
        'user.fields': 'name,username',
      },
      headers: {
        Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`,
      },
      timeout: 10000,
    });

    const tweets = response.data?.data || [];
    const users = response.data?.includes?.users || [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    return tweets
      .filter((tweet) => {
        // Only include tweets with URLs (likely linking to actual news)
        return tweet.entities?.urls?.length > 0;
      })
      .map((tweet) => {
        const author = userMap[tweet.author_id];
        // Use the expanded URL from the tweet if available
        const expandedUrl =
          tweet.entities?.urls?.[0]?.expanded_url || `https://twitter.com/i/web/status/${tweet.id}`;

        return {
          title: tweet.text.replace(/https?:\/\/\S+/g, '').trim().substring(0, 200),
          sourceUrl: expandedUrl,
          sourceName: author ? `@${author.username}` : 'Twitter',
          rawContent: tweet.text,
          imageUrl: null,
          publishedDate: new Date(tweet.created_at),
          category,
        };
      });
  } catch (error) {
    // Twitter API v2 free tier is limited — log but don't crash
    if (error.response?.status === 429) {
      console.error('   ✗ Twitter rate limit hit, skipping');
    } else {
      console.error(`   ✗ Twitter error: ${error.message}`);
    }
    return [];
  }
};