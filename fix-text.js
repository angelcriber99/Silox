const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;
      
      // We want to replace text-white with text-foreground, UNLESS it's on a button with bg-blue/purple/primary etc.
      // A safe heuristic for this project: replace text-white with text-foreground
      content = content.replace(/text-white/g, 'text-foreground');
      
      // Fix cases where it SHOULD be white
      content = content.replace(/bg-blue-600(.*?)text-foreground/g, 'bg-blue-600$1text-white');
      content = content.replace(/bg-purple-600(.*?)text-foreground/g, 'bg-purple-600$1text-white');
      content = content.replace(/bg-primary(.*?)text-foreground/g, 'bg-primary$1text-primary-foreground');
      
      // In ai-chat-dialog.tsx, there's `bg-blue-600 text-white`
      // In add-asset-modal.tsx, `bg-blue-600 hover:bg-blue-500 text-white`
      
      // For Activity icons inside gradients, if they got changed to text-foreground, let's fix them if they are inside a gradient
      // but it's hard to catch all.
      
      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log('Updated', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'app'));
processDir(path.join(__dirname, 'components'));
