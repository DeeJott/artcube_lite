const fs = require('fs');
const path = require('path');

const logPath = "C:\\Users\\byema\\.gemini\\antigravity-ide\\brain\\f3e097f5-eecb-4f7f-b284-9661d3d50c15\\.system_generated\\logs\\transcript_full.jsonl";
const outputPath = "C:\\Users\\byema\\.gemini\\antigravity-ide\\scratch\\artcube_demo\\art-cube-demo\\public\\test-tree.html";

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');

let content13 = '';
let content17 = '';

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const json = JSON.parse(line);
    if (json.step_index === 13) {
      content13 = json.content;
    } else if (json.step_index === 17) {
      content17 = json.content;
    }
  } catch (e) {
    // ignore
  }
}

function stripLineNumbers(rawText) {
  const fileLines = rawText.split('\n');
  const codeLines = [];
  for (const fileLine of fileLines) {
    const match = fileLine.match(/^\d+:\s?(.*)$/);
    if (match) {
      codeLines.push(match[1]);
    }
  }
  return codeLines.join('\n');
}

const restored13 = stripLineNumbers(content13);
const restored17 = stripLineNumbers(content17);
const fullCode = restored13 + '\n' + restored17;

fs.writeFileSync(outputPath, fullCode, 'utf8');
console.log("Successfully restored public/test-tree.html!");
