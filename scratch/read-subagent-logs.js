const fs = require('fs');
const path = require('path');

const logPath = "C:\\Users\\byema\\.gemini\\antigravity-ide\\brain\\f3e097f5-eecb-4f7f-b284-9661d3d50c15\\.system_generated\\logs\\transcript_full.jsonl";
const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i];
  if (!line.trim()) continue;
  try {
    const json = JSON.parse(line);
    if (json.content && json.content.includes("console logs") || (json.content && json.content.includes("error"))) {
      if (json.step_index > 220) {
        console.log(`Step ${json.step_index}: Type: ${json.type}`);
        console.log(json.content.substring(0, 1000));
        console.log("-----------------------------------------");
      }
    }
  } catch (e) {
    // ignore
  }
}
