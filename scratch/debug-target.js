const fs = require('fs');
const path = require('path');

const logPath = "C:\\Users\\byema\\.gemini\\antigravity-ide\\brain\\f3e097f5-eecb-4f7f-b284-9661d3d50c15\\.system_generated\\logs\\transcript_full.jsonl";
const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

const basePath = "C:\\Users\\byema\\.gemini\\antigravity-ide\\scratch\\artcube_demo\\art-cube-demo\\public\\test-tree.html";
const currentCode = fs.readFileSync(basePath, 'utf8').replace(/\r\n/g, '\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const json = JSON.parse(line);
    if (json.step_index === 30) {
      const call = json.tool_calls[0];
      const target = call.args.TargetContent.replace(/\r\n/g, '\n');
      console.log("=== Target Content Length ===", target.length);
      console.log("=== Target Content Head ===");
      console.log(target.substring(0, 300));
      console.log("=== Target Content Tail ===");
      console.log(target.substring(target.length - 300));
      
      console.log("=== Matches in currentCode ===");
      const partialTarget = target.substring(0, 100);
      console.log("Does currentCode include partialTarget?", currentCode.includes(partialTarget));
      
      const index = currentCode.indexOf(partialTarget);
      if (index !== -1) {
        console.log("Found match of partial target at index:", index);
        console.log("Snippet from currentCode at index:");
        console.log(currentCode.substring(index, index + 300));
      }
    }
  } catch (e) {
    console.error(e);
  }
}
