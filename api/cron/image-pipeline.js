// api/lib/image-pipeline.js
// ════════════════════════════════════════════════════════════════════════════
// HYBRID IMAGE PIPELINE — Priority order per category:
//
//   BOLLYWOOD articles:
//     1. OMDb API — official IMDB movie posters (free, commercial use OK)
//     2. Wikimedia — actor/director photos
//     3. Pexels — film sets, cinema, mood shots
//
//   CRICKET articles:
//     1. Wikimedia — action shots using smart cricket search terms
//        (batting/bowling/match queries — better than headshot APIs)
//     2. Pexels — stadium/crowd atmosphere shots
//
//   ALL OTHER categories:
//     1. Wikimedia — persons/places detected in title
//     2. Pexels — context/atmospheric shots
//
// API keys required (add to Vercel env vars):
//   OMDB_API_KEY      — omdbapi.com (free, 1000 req/day, commercial OK)
//   PEXELS_API_KEY    — pexels.com/api (free, 200 req/hr)
// ════════════════════════════════════════════════════════════════════════════

import axios      from 'axios';
import { createClient } from '@supabase/supabase-js';

const IMAGE_MIN_WIDTH = 800;

// ─── Well-known Indian/global persons — maps name → Wikimedia search term ────
// Wikimedia search works best with the person's full name or common name
const KNOWN_PERSONS = {
  // Cricket
  'virat kohli':        'Virat Kohli',
  'kohli':              'Virat Kohli',
  'rohit sharma':       'Rohit Sharma cricketer',
  'rohit':              'Rohit Sharma cricketer',
  'ms dhoni':           'MS Dhoni',
  'dhoni':              'MS Dhoni',
  'sachin tendulkar':   'Sachin Tendulkar',
  'sachin':             'Sachin Tendulkar',
  'bumrah':             'Jasprit Bumrah',
  'jasprit bumrah':     'Jasprit Bumrah',
  'shubman gill':       'Shubman Gill',
  'shreyas iyer':       'Shreyas Iyer cricketer',
  'sanju samson':       'Sanju Samson',
  'hardik pandya':      'Hardik Pandya',
  'ravindra jadeja':    'Ravindra Jadeja',
  'smriti mandhana':    'Smriti Mandhana',
  'pat cummins':        'Pat Cummins',
  'ben stokes':         'Ben Stokes',
  'joe root':           'Joe Root cricketer',
  // Bollywood
  'ranveer singh':      'Ranveer Singh actor',
  'ranveer':            'Ranveer Singh actor',
  'deepika padukone':   'Deepika Padukone',
  'deepika':            'Deepika Padukone',
  'shah rukh khan':     'Shah Rukh Khan',
  'srk':                'Shah Rukh Khan',
  'aamir khan':         'Aamir Khan actor',
  'salman khan':        'Salman Khan actor',
  'ranbir kapoor':      'Ranbir Kapoor',
  'alia bhatt':         'Alia Bhatt',
  'nora fatehi':        'Nora Fatehi',
  'priyanka chopra':    'Priyanka Chopra',
  'katrina kaif':       'Katrina Kaif',
  'hrithik roshan':     'Hrithik Roshan',
  'akshay kumar':       'Akshay Kumar actor',
  'taapsee pannu':      'Taapsee Pannu',
  'vidya balan':        'Vidya Balan',
  'kangana ranaut':     'Kangana Ranaut',
  'ayushmann khurrana': 'Ayushmann Khurrana',
  'vicky kaushal':      'Vicky Kaushal actor',
  'sara ali khan':      'Sara Ali Khan',
  'janhvi kapoor':      'Janhvi Kapoor',
  'tiger shroff':       'Tiger Shroff',
  'kartik aaryan':      'Kartik Aaryan',
  'rajkummar rao':      'Rajkummar Rao',
  'pankaj tripathi':    'Pankaj Tripathi actor',
  'nawazuddin siddiqui':'Nawazuddin Siddiqui',
  'irrfan khan':        'Irrfan Khan',
  'siddharth malhotra': 'Sidharth Malhotra actor',
  'ananya panday':      'Ananya Panday',
  'shraddha kapoor':    'Shraddha Kapoor',
  'kareena kapoor':     'Kareena Kapoor',
  'kajol':              'Kajol actress',
  'madhuri dixit':      'Madhuri Dixit',
  'aishwarya rai':      'Aishwarya Rai',
  'amitabh bachchan':   'Amitabh Bachchan',
  'abhishek bachchan':  'Abhishek Bachchan',
  'sunny deol':         'Sunny Deol actor',
  'bobby deol':         'Bobby Deol actor',
  'rohit shetty':       'Rohit Shetty director',
  'karan johar':        'Karan Johar director',
  'sanjay leela bhansali': 'Sanjay Leela Bhansali',
  // OTT / streaming
  'farhan akhtar':      'Farhan Akhtar',
  'konkona sen sharma': 'Konkona Sen Sharma',
  'manoj bajpayee':     'Manoj Bajpayee',
  // Politics
  'modi':               'Narendra Modi',
  'narendra modi':      'Narendra Modi',
  'rahul gandhi':       'Rahul Gandhi',
  'yogi adityanath':    'Yogi Adityanath',
  'arvind kejriwal':    'Arvind Kejriwal',
  'mamata banerjee':    'Mamata Banerjee',
  'elon musk':          'Elon Musk',
  'donald trump':       'Donald Trump',
  'joe biden':          'Joe Biden',
  'xi jinping':         'Xi Jinping',
  // Business
  'mukesh ambani':      'Mukesh Ambani',
  'ambani':             'Mukesh Ambani',
  'adani':              'Gautam Adani',
  'gautam adani':       'Gautam Adani',
  'ratan tata':         'Ratan Tata',
  'sundar pichai':      'Sundar Pichai',
  // Sports (non-cricket)
  'neeraj chopra':      'Neeraj Chopra',
  'pv sindhu':          'PV Sindhu',
  'mary kom':           'Mary Kom',
  'bajrang punia':      'Bajrang Punia',
};

// ─── Well-known places — maps name → Wikimedia search term ───────────────────
const KNOWN_PLACES = {
  'mumbai':           'Mumbai city skyline',
  'delhi':            'New Delhi India',
  'new delhi':        'New Delhi India',
  'bangalore':        'Bangalore city India',
  'bengaluru':        'Bengaluru city India',
  'chennai':          'Chennai city India',
  'kolkata':          'Kolkata city India',
  'hyderabad':        'Hyderabad city India',
  'pune':             'Pune city India',
  'ahmedabad':        'Ahmedabad city India',
  'jaipur':           'Jaipur city India',
  'varanasi':         'Varanasi ghats India',
  'agra':             'Agra Taj Mahal',
  'taj mahal':        'Taj Mahal Agra',
  'dubai':            'Dubai skyline',
  'london':           'London cityscape',
  'new york':         'New York City skyline',
  'washington':       'Washington DC Capitol',
  'beijing':          'Beijing China',
  'islamabad':        'Islamabad Pakistan',
  'haifa':            'Haifa Israel',
  'tel aviv':         'Tel Aviv Israel',
  'tehran':           'Tehran Iran',
  'moscow':           'Moscow Russia',
  'wankhede':         'Wankhede Stadium Mumbai',
  'eden gardens':     'Eden Gardens Kolkata',
  'lords':            'Lord\'s Cricket Ground London',
};

// ════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — call this from all cron files instead of fetchAndSaveImages
// ════════════════════════════════════════════════════════════════════════════
export async function hybridFetchAndSaveImages({
  supabase,
  articleId,
  title,
  category,
  imageQueries,        // array from article JSON — specific to subject
  targetImages = 4,    // how many images to save (4 for regular, 8 for history)
  categoryFallbacks,   // Pexels fallback queries for this category
}) {
  const pexelsKey = process.env.PEXELS_API_KEY;

  // ── Step 1: Detect persons and places in title + image_queries ─────────────
  const textToScan = [title, ...(imageQueries ?? [])].join(' ').toLowerCase();
  const detectedPersons = detectEntities(textToScan, KNOWN_PERSONS);
  const detectedPlaces  = detectEntities(textToScan, KNOWN_PLACES);

  console.log(`   🔍 Detected persons: ${detectedPersons.length > 0 ? detectedPersons.map(p => p.wikiTerm).join(', ') : 'none'}`);
  console.log(`   🔍 Detected places:  ${detectedPlaces.length > 0 ? detectedPlaces.map(p => p.wikiTerm).join(', ') : 'none'}`);

  const allPhotos = [];
  const seen      = new Set();

  // ── Step 2a: BOLLYWOOD → OMDb first (official IMDB posters, high-res) ──────
  if (category === 'bollywood') {
    const omdbPhotos = await fetchOMDbImages(title, 2);
    for (const photo of omdbPhotos) {
      if (!seen.has(photo.id)) { seen.add(photo.id); allPhotos.push(photo); }
    }
    console.log(`   🎬 OMDb "${title}": ${omdbPhotos.length} photos`);
    await sleep(300);
  }

  // ── Step 2b: CRICKET → Wikimedia with action-shot search terms ─────────────
  // No 3rd-party API needed — Wikimedia has excellent cricket action photos.
  // We use sport-specific search terms to get action shots, not portraits.
  if (category === 'cricket') {
    const cricketQueries = extractCricketQueries(title, imageQueries);
    for (const query of cricketQueries.slice(0, 2)) {
      if (allPhotos.length >= 2) break;
      const wikiPhotos = await fetchWikimediaImages(query, 2);
      for (const photo of wikiPhotos) {
        if (!seen.has(photo.id)) { seen.add(photo.id); allPhotos.push(photo); }
      }
      console.log(`   🏏 Cricket Wikimedia "${query}": ${wikiPhotos.length} photos`);
      await sleep(300);
    }
  }

  // ── Step 3: Fetch person photos from Wikimedia (up to 2 slots) ────────────
  for (const person of detectedPersons.slice(0, 2)) {
    if (allPhotos.length >= Math.floor(targetImages / 2)) break;
    const wikiPhotos = await fetchWikimediaImages(person.wikiTerm, 2);
    for (const photo of wikiPhotos) {
      if (!seen.has(photo.id)) { seen.add(photo.id); allPhotos.push(photo); }
    }
    console.log(`   👤 Wikimedia "${person.wikiTerm}": ${wikiPhotos.length} photos`);
    await sleep(300);
  }

  // ── Step 4: Fetch place photos from Wikimedia (up to 2 slots) ────────────
  for (const place of detectedPlaces.slice(0, 2)) {
    if (allPhotos.length >= Math.floor(targetImages / 2)) break;
    const wikiPhotos = await fetchWikimediaImages(place.wikiTerm, 2);
    for (const photo of wikiPhotos) {
      if (!seen.has(photo.id)) { seen.add(photo.id); allPhotos.push(photo); }
    }
    console.log(`   📍 Wikimedia "${place.wikiTerm}": ${wikiPhotos.length} photos`);
    await sleep(300);
  }

  // ── Step 5: Fill remaining slots with Pexels context images ────────────
  if (pexelsKey && allPhotos.length < targetImages) {
    const fallbacks = categoryFallbacks ?? ['india news', 'current events'];
    const pexelsQueries = [
      ...(imageQueries ?? []).filter(q => typeof q === 'string' && q.trim().length > 2).slice(0, 4),
      ...fallbacks,
    ].slice(0, 6);

    for (const query of pexelsQueries) {
      if (allPhotos.length >= targetImages) break;
      const pexelsPhotos = await fetchPexelsImages(pexelsKey, query, 2);
      for (const photo of pexelsPhotos) {
        if (!seen.has(photo.id)) { seen.add(photo.id); allPhotos.push(photo); }
      }
      await sleep(400);
    }

    // Broad category fallback if still not enough
    if (allPhotos.length < Math.ceil(targetImages / 2) && fallbacks.length > 0) {
      const broadPhotos = await fetchPexelsImages(pexelsKey, fallbacks[0], targetImages);
      for (const photo of broadPhotos) {
        if (!seen.has(photo.id)) { seen.add(photo.id); allPhotos.push(photo); }
      }
    }
  }

  if (allPhotos.length === 0) {
    console.log(`   ⚠ No images found for article #${articleId}`);
    return 0;
  }

  const toSave = allPhotos.slice(0, targetImages);
  console.log(`   🖼  Total found: ${allPhotos.length} | Saving: ${toSave.length} (${toSave.filter(p=>p.source==='omdb').length} OMDb + ${toSave.filter(p=>p.source==='wikimedia').length} Wikimedia + ${toSave.filter(p=>p.source==='pexels').length} Pexels)`);

  // ── Step 5: Save to article_images table ──────────────────────────────────
  const imageRows = toSave.map((photo, i) => ({
    article_id: articleId,
    image_url:  photo.url,
    alt_text:   photo.alt || `${title} — via ${{ wikimedia: 'Wikimedia Commons', pexels: 'Pexels', omdb: 'OMDb' }[photo.source] || photo.source}`,
    position:   i,
    width:      photo.width  || 1080,
    height:     photo.height || 720,
    size_kb:    0,
  }));

  const { error } = await supabase.from('article_images').insert(imageRows);
  if (error) {
    console.log(`   ✗ Image DB error: ${error.message}`);
    return 0;
  }

  // Set first image (ideally the person/place photo) as article cover
  await supabase
    .from('articles')
    .update({ image_url: imageRows[0].image_url })
    .eq('id', articleId);

  // Pexels does not require download tracking

  return toSave.length;
}

// ════════════════════════════════════════════════════════════════════════════
// WIKIMEDIA COMMONS FETCHER
// No API key required. Returns Creative Commons licensed images.
// Uses the Wikimedia search API to find images of persons/places.
// ════════════════════════════════════════════════════════════════════════════
async function fetchWikimediaImages(searchTerm, count = 2) {
  const photos = [];
  try {
    // Step 1: Search for pages matching the term
    const searchRes = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action:   'query',
        list:     'search',
        srsearch: searchTerm,
        srnamespace: 6,  // File namespace = images
        srlimit:  count * 3,
        format:   'json',
        origin:   '*',
      },
      timeout: 8000,
    });

    const searchResults = searchRes.data?.query?.search ?? [];
    if (searchResults.length === 0) {
      // Fallback: try direct image search via opensearch
      return await fetchWikimediaByTitle(searchTerm, count);
    }

    // Step 2: Get image info for each result
    for (const result of searchResults.slice(0, count * 2)) {
      if (photos.length >= count) break;
      const title = result.title; // e.g. "File:Virat Kohli.jpg"
      if (!title.startsWith('File:')) continue;

      const infoRes = await axios.get('https://en.wikipedia.org/w/api.php', {
        params: {
          action:  'query',
          titles:  title,
          prop:    'imageinfo',
          iiprop:  'url|size|mime|extmetadata',
          iiurlwidth: 1200,
          format:  'json',
          origin:  '*',
        },
        timeout: 8000,
      });

      const pages = infoRes.data?.query?.pages ?? {};
      for (const page of Object.values(pages)) {
        const info = page.imageinfo?.[0];
        if (!info) continue;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(info.mime)) continue;
        if (info.width < IMAGE_MIN_WIDTH) continue;

        // Check license — only use free licenses
        const license = info.extmetadata?.LicenseShortName?.value ?? '';
        if (!isFreeWikimediaLicense(license)) continue;

        const desc = info.extmetadata?.ImageDescription?.value ?? '';
        const artist = info.extmetadata?.Artist?.value ?? '';

        photos.push({
          id:               `wiki_${page.pageid}`,
          url:              info.thumburl || info.url,
          alt:              stripHtml(desc) || `${searchTerm} — Wikimedia Commons`,
          width:            info.thumbwidth || info.width,
          height:           info.thumbheight || info.height,
          source:           'wikimedia',
          credit:           stripHtml(artist),
          downloadLocation: null,
        });

        if (photos.length >= count) break;
      }
      await sleep(200);
    }
  } catch (e) {
    console.log(`   ⚠ Wikimedia error for "${searchTerm}": ${e.message}`);
  }

  // If file search returned nothing, try article-based image search
  if (photos.length === 0) {
    return await fetchWikimediaByTitle(searchTerm, count);
  }

  return photos;
}

// Fallback: get images from a Wikipedia article about the person/place
async function fetchWikimediaByTitle(searchTerm, count = 2) {
  const photos = [];
  try {
    // Find the Wikipedia article
    const searchRes = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action:   'query',
        list:     'search',
        srsearch: searchTerm,
        srlimit:  3,
        format:   'json',
        origin:   '*',
      },
      timeout: 8000,
    });

    const results = searchRes.data?.query?.search ?? [];
    if (results.length === 0) return photos;

    const pageTitle = results[0].title;

    // Get images used in that Wikipedia article
    const imagesRes = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action:    'query',
        titles:    pageTitle,
        prop:      'images',
        imlimit:   10,
        format:    'json',
        origin:    '*',
      },
      timeout: 8000,
    });

    const pages  = imagesRes.data?.query?.pages ?? {};
    const images = Object.values(pages)[0]?.images ?? [];

    // Filter to likely portrait/photo files
    const imageFiles = images
      .map(img => img.title)
      .filter(t => /\.(jpg|jpeg|png|webp)$/i.test(t) && !t.toLowerCase().includes('icon') && !t.toLowerCase().includes('logo') && !t.toLowerCase().includes('flag'));

    for (const fileTitle of imageFiles.slice(0, count * 3)) {
      if (photos.length >= count) break;

      const infoRes = await axios.get('https://en.wikipedia.org/w/api.php', {
        params: {
          action:  'query',
          titles:  fileTitle,
          prop:    'imageinfo',
          iiprop:  'url|size|mime|extmetadata',
          iiurlwidth: 1200,
          format:  'json',
          origin:  '*',
        },
        timeout: 6000,
      });

      const infoPages = infoRes.data?.query?.pages ?? {};
      for (const page of Object.values(infoPages)) {
        const info = page.imageinfo?.[0];
        if (!info) continue;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(info.mime)) continue;
        if ((info.thumbwidth || info.width) < IMAGE_MIN_WIDTH) continue;

        const license = info.extmetadata?.LicenseShortName?.value ?? '';
        if (!isFreeWikimediaLicense(license)) continue;

        const desc   = info.extmetadata?.ImageDescription?.value ?? '';
        const artist = info.extmetadata?.Artist?.value ?? '';

        photos.push({
          id:               `wiki_${page.pageid}`,
          url:              info.thumburl || info.url,
          alt:              stripHtml(desc) || `${searchTerm} — Wikimedia Commons`,
          width:            info.thumbwidth || info.width,
          height:           info.thumbheight || info.height,
          source:           'wikimedia',
          credit:           stripHtml(artist),
          downloadLocation: null,
        });
        if (photos.length >= count) break;
      }
      await sleep(150);
    }
  } catch (e) {
    console.log(`   ⚠ Wikimedia article search error: ${e.message}`);
  }
  return photos;
}

// ════════════════════════════════════════════════════════════════════════════
// OMDb FETCHER — Open Movie Database (omdbapi.com)
// Free tier: 1,000 requests/day. Commercial use allowed.
// Get your key free at: https://www.omdbapi.com/apikey.aspx
//
// Strategy:
//   1. Search by title → get IMDb ID
//   2. Fetch full record by ID → get poster URL
//   3. Upgrade poster from SX300 (thumbnail) to SX1000 (high-res)
// ════════════════════════════════════════════════════════════════════════════
async function fetchOMDbImages(title, count = 2) {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) return [];

  const photos = [];
  const OMDB   = 'https://www.omdbapi.com';

  try {
    // ── Step 1: Search by title (returns up to 10 results) ────────────────
    // Use just the first 4 words of the title for better search results
    const searchTitle = title.split(' ').slice(0, 4).join(' ');
    const searchRes = await axios.get(OMDB, {
      params: { apikey: apiKey, s: searchTitle, type: 'movie' },
      timeout: 8000,
    });

    const searchResults = searchRes.data?.Search ?? [];
    if (searchResults.length === 0) {
      // Try TV shows as fallback (OTT series are huge in Bollywood)
      const tvRes = await axios.get(OMDB, {
        params: { apikey: apiKey, s: searchTitle, type: 'series' },
        timeout: 8000,
      });
      searchResults.push(...(tvRes.data?.Search ?? []));
    }

    if (searchResults.length === 0) {
      console.log(`   ⚠ OMDb: no results for "${searchTitle}"`);
      return photos;
    }

    // ── Step 2: Fetch full record for top results ──────────────────────────
    for (const result of searchResults.slice(0, count)) {
      if (photos.length >= count) break;
      if (!result.imdbID) continue;

      const detailRes = await axios.get(OMDB, {
        params: { apikey: apiKey, i: result.imdbID, plot: 'short' },
        timeout: 8000,
      });

      const movie = detailRes.data;
      if (!movie?.Poster || movie.Poster === 'N/A') continue;

      // ── Step 3: Upgrade poster resolution ─────────────────────────────────
      // OMDb returns SX300 (300px wide thumbnail from Amazon CDN)
      // Replacing with SX1000 gives ~1000px wide — good enough for articles
      const highResPoster = movie.Poster
        .replace('SX300', 'SX1000')
        .replace('SY150', 'SY1000');

      photos.push({
        id:               `omdb_${result.imdbID}`,
        url:              highResPoster,
        alt:              `${movie.Title} (${movie.Year}) — via OMDb`,
        width:            1000, // after URL upgrade
        height:           1500, // typical poster ratio
        source:           'omdb',
        credit:           `OMDb — ${movie.Title}`,
        downloadLocation: null,
      });

      await sleep(200);
    }
  } catch (e) {
    console.log(`   ⚠ OMDb error: ${e.message}`);
  }

  return photos;
}

// ════════════════════════════════════════════════════════════════════════════
// PEXELS FETCHER
// Free: 200 req/hour, 20,000 req/month — no download tracking required
// ════════════════════════════════════════════════════════════════════════════
async function fetchPexelsImages(pexelsKey, query, count = 2) {
  try {
    const res = await axios.get('https://api.pexels.com/v1/search', {
      params: { query, per_page: count, orientation: 'landscape' },
      headers: { Authorization: pexelsKey },
      timeout: 8000,
    });
    return (res.data.photos ?? [])
      .filter(p => p.width >= IMAGE_MIN_WIDTH)
      .map(p => ({
        id:               `pexels_${p.id}`,
        url:              p.src.large2x || p.src.large || p.src.original,
        alt:              p.alt || query,
        width:            p.width,
        height:           p.height,
        source:           'pexels',
        credit:           p.photographer,
        downloadLocation: null,   // Pexels does not require download tracking
      }));
  } catch { return []; }
}

// ════════════════════════════════════════════════════════════════════════════
// ENTITY DETECTION
// Scans text for known persons/places, returns matched entities
// ════════════════════════════════════════════════════════════════════════════
function detectEntities(text, entityMap) {
  const found   = [];
  const seenTerms = new Set();
  const lower   = text.toLowerCase();

  for (const [keyword, wikiTerm] of Object.entries(entityMap)) {
    if (lower.includes(keyword) && !seenTerms.has(wikiTerm)) {
      seenTerms.add(wikiTerm);
      found.push({ keyword, wikiTerm });
    }
  }
  return found;
}

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

// Extract cricket-specific Wikimedia search queries
// Returns action-oriented terms that get match photos, not passport headshots
function extractCricketQueries(title, imageQueries) {
  const lower = title.toLowerCase();
  const queries = [];

  // Detect specific players and map to action search terms
  const playerActions = {
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
  };

  for (const [keyword, action] of Object.entries(playerActions)) {
    if (lower.includes(keyword)) {
      queries.push(action);
      break; // one player action per article
    }
  }

  // Detect match/tournament context
  if (lower.includes('ipl'))        queries.push('IPL cricket match');
  if (lower.includes('test'))       queries.push('Test cricket match');
  if (lower.includes('t20'))        queries.push('T20 cricket match');
  if (lower.includes('world cup'))  queries.push('Cricket World Cup');
  if (lower.includes('bcci'))       queries.push('BCCI cricket India');
  if (lower.includes('rcb'))        queries.push('Royal Challengers Bangalore cricket');
  if (lower.includes('csk') || lower.includes('chennai super kings')) queries.push('Chennai Super Kings cricket');
  if (lower.includes('mumbai indians')) queries.push('Mumbai Indians cricket IPL');

  // Fallback to general cricket action if nothing specific detected
  if (queries.length === 0) {
    queries.push('cricket batting action India', 'cricket match stadium India');
  }

  return [...new Set(queries)];
}

// Only use images with clearly free licenses from Wikimedia
function isFreeWikimediaLicense(license) {
  if (!license) return false;
  const free = ['cc0', 'cc-by', 'cc by', 'public domain', 'pd', 'cc-sa', 'cc by-sa', 'attribution'];
  const lower = license.toLowerCase();
  return free.some(f => lower.includes(f));
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }