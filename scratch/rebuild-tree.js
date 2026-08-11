const fs = require('fs');
const path = require('path');

const logPath = "C:\\Users\\byema\\.gemini\\antigravity-ide\\brain\\f3e097f5-eecb-4f7f-b284-9661d3d50c15\\.system_generated\\logs\\transcript_full.jsonl";
const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

const basePath = "C:\\Users\\byema\\.gemini\\antigravity-ide\\scratch\\artcube_demo\\art-cube-demo\\public\\test-tree.html";
let currentCode = fs.readFileSync(basePath, 'utf8').replace(/\r\n/g, '\n');

console.log("Rebuilding test-tree.html with normalized line endings...");

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const json = JSON.parse(line);
    if (json.step_index > 85) continue; // Previous session edits only
    
    if (json.tool_calls) {
      for (const call of json.tool_calls) {
        if (call.name === 'replace_file_content') {
          const file = call.args.TargetFile || '';
          if (file.includes('test-tree.html')) {
            const target = call.args.TargetContent.replace(/\r\n/g, '\n');
            const replacement = call.args.ReplacementContent.replace(/\r\n/g, '\n');
            
            if (json.step_index === 30) {
              // Special handling for Step 30: replace from <div class="hud"> to the end of the file
              const marker = '  <div class="hud">\n    <h1>Sakura Gitterbaum</h1>';
              const index = currentCode.indexOf(marker);
              if (index !== -1) {
                currentCode = currentCode.substring(0, index) + replacement;
                console.log("Successfully applied Step 30 edit using special marker replacement.");
              } else {
                console.error("ERROR: Special marker for Step 30 not found!");
              }
            } else {
              // Standard replacement
              if (currentCode.includes(target)) {
                currentCode = currentCode.replace(target, replacement);
                console.log(`Successfully applied Step ${json.step_index} edit.`);
              } else {
                const targetNormalized = target.trim();
                const index = currentCode.indexOf(targetNormalized);
                if (index !== -1) {
                  const before = currentCode.substring(0, index);
                  const after = currentCode.substring(index + targetNormalized.length);
                  currentCode = before + replacement + after;
                  console.log(`Successfully applied Step ${json.step_index} edit with trimming.`);
                } else {
                  console.warn(`WARNING: Target content for Step ${json.step_index} not found!`);
                  // Let's print a small snippet of the target to debug
                  console.warn(`Target starts with: ${target.substring(0, 100)}...`);
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("Error parsing line:", e);
  }
}

// Convert back to CRLF for Windows compatibility
const finalCode = currentCode.replace(/\n/g, '\r\n');
fs.writeFileSync(basePath, finalCode, 'utf8');
console.log("Finished rebuilding public/test-tree.html!");
