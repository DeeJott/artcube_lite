const fs = require('fs');
const path = require('path');

const logPath = "C:\\Users\\byema\\.gemini\\antigravity-ide\\brain\\f3e097f5-eecb-4f7f-b284-9661d3d50c15\\.system_generated\\logs\\transcript_full.jsonl";
const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

console.log("Searching for the latest BROWSER_SUBAGENT logs...");

for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i];
  if (!line.trim()) continue;
  try {
    const json = JSON.parse(line);
    if (json.type === 'BROWSER_SUBAGENT') {
      console.log(`Step ${json.step_index}:`);
      console.log(json.content);
      console.log("=========================================");
      break; // Only print the absolute latest one!
    }
  } catch (e) {
    // ignore
  }
}
