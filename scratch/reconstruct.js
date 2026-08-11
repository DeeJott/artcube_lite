const fs = require('fs');
const path = require('path');

const logPath = "C:\\Users\\byema\\.gemini\\antigravity-ide\\brain\\f3e097f5-eecb-4f7f-b284-9661d3d50c15\\.system_generated\\logs\\transcript_full.jsonl";
const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

console.log("Analyzing replace_file_content / write_to_file calls...");

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const json = JSON.parse(line);
    
    // Check if it has tool calls
    if (json.tool_calls) {
      for (const call of json.tool_calls) {
        if (call.name === 'replace_file_content' || call.name === 'write_to_file') {
          const file = call.args.TargetFile || '';
          if (file.includes('test-tree.html')) {
            console.log(`Step ${json.step_index}: Tool: ${call.name}, Instruction: ${call.args.Instruction || ''}, StartLine: ${call.args.StartLine || ''}, EndLine: ${call.args.EndLine || ''}`);
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
}
