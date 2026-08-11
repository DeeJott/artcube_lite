const fs = require('fs');
const code = fs.readFileSync('public/test-background.html', 'utf8');

const lines = code.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('particleGeo')) {
    console.log(`${idx + 1}: ${line}`);
  }
});
