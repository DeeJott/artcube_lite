const fs = require('fs');
const path = require('path');

const logPath = "C:\\Users\\byema\\.gemini\\antigravity-ide\\brain\\f3e097f5-eecb-4f7f-b284-9661d3d50c15\\.system_generated\\logs\\transcript_full.jsonl";
const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const json = JSON.parse(line);
    if (json.tool_calls) {
      for (const call of json.tool_calls) {
        if (JSON.stringify(call).includes('test-tree.html')) {
          console.log(`Step ${json.step_index}: Type: ${json.type}, Tool: ${call.name}, Summary: ${call.args.toolSummary || call.args.Description || ''}`);
        }
      }
    }
  } catch (e) {
    // ignore
  }
}
