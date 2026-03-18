const fs = require('fs');
const path = require('path');

// Create .vercel/output/functions directory structure
const functionsDir = '.vercel/output/functions/api/cron';
fs.mkdirSync(functionsDir, { recursive: true });

// Copy each API file
const apiFiles = [
  'fetch-news.js',
  'fetch-viral.js',
  'fetch-history.js',
  'generate-site.js'
];

apiFiles.forEach(file => {
  const src = path.join('pages/api/cron', file);
  const dest = path.join(functionsDir, file);
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied ${file}`);
  } else {
    console.warn(`⚠ ${file} not found`);
  }
});

console.log('✓ API functions ready for Vercel deployment');