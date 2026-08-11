const fs = require('fs');

console.log("Checking syntax of script block in public/test-background.html...");

const html = fs.readFileSync('public/test-background.html', 'utf8');
const scriptMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);

if (scriptMatch) {
  let code = scriptMatch[1];
  // Strip import statements
  code = code.replace(/import\s+[\s\S]*?from\s+['"].*?['"];?/g, '');
  try {
    new Function(code);
    console.log("Syntax is 100% VALID!");
  } catch (err) {
    console.error("Syntax Error found!");
    console.error(err.message);
    process.exit(1);
  }
} else {
  console.log("No script tag found!");
}
