const fs = require('fs');
const path = require('path');

const logPath = "C:\\Users\\byema\\.gemini\\antigravity-ide\\brain\\f3e097f5-eecb-4f7f-b284-9661d3d50c15\\.system_generated\\logs\\transcript_full.jsonl";
const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

console.log("Searching for the console logs in subagent steps...");

for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i];
  if (!line.trim()) continue;
  try {
    const json = JSON.parse(line);
    if (json.source === 'MODEL' && json.type === 'BROWSER_SUBAGENT' && json.content) {
      if (json.content.includes("Console logs:") || json.content.includes("[error]") || json.content.includes("log")) {
        console.log(`Step ${json.step_index}:`);
        
        // Find index of console logs in content
        const index = json.content.indexOf("console");
        if (index !== -1) {
          console.log(json.content.substring(index, index + 1000));
        } else {
          console.log(json.content.substring(0, 1000));
        }
        console.log("=========================================");
        break;
      }
    }
  } catch (e) {
    // ignore
  }
}
