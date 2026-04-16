const fs = require('fs');
const path = require('path');

function replaceStr(content) {
  let res = content.replace(/#34B27B/gi, '#5D5FEF');
  // 52,178,123 -> 93,95,239  -- which is the rgb for #5D5FEF
  res = res.replace(/52,\s*178,\s*123/g, '93, 95, 239');
  res = res.replace(/52,178,123/g, '93,95,239');
  return res;
}

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css') || fullPath.endsWith('.css')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const next = replaceStr(content);
      if (next !== content) {
        fs.writeFileSync(fullPath, next);
        console.log('Fixed', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'openscreen-clone', 'src'));
console.log('Done');
