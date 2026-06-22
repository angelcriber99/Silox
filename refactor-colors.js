const fs = require('fs');
const path = require('path');

const replacements = [
  { regex: /bg-\[\#09090b\]\/90/g, replacement: 'bg-background/90' },
  { regex: /bg-\[\#09090b\]\/80/g, replacement: 'bg-background/80' },
  { regex: /bg-\[\#09090b\]/g, replacement: 'bg-background' },
  
  { regex: /bg-zinc-900\/60/g, replacement: 'bg-card' },
  { regex: /bg-zinc-900\/95/g, replacement: 'bg-card/95' },
  { regex: /bg-zinc-900\/50/g, replacement: 'bg-card/50' },
  { regex: /bg-zinc-900/g, replacement: 'bg-card' },

  { regex: /bg-zinc-800\/60/g, replacement: 'bg-muted' },
  { regex: /bg-zinc-800\/80/g, replacement: 'bg-muted' },
  { regex: /bg-zinc-800\/40/g, replacement: 'bg-muted/50' },
  { regex: /bg-zinc-800/g, replacement: 'bg-muted' },

  { regex: /border-zinc-800\/60/g, replacement: 'border-border' },
  { regex: /border-zinc-800\/40/g, replacement: 'border-border' },
  { regex: /border-zinc-800/g, replacement: 'border-border' },
  
  { regex: /border-zinc-700\/50/g, replacement: 'border-border' },
  { regex: /border-zinc-700/g, replacement: 'border-border' },

  { regex: /text-zinc-100/g, replacement: 'text-foreground' },
  { regex: /text-zinc-200/g, replacement: 'text-foreground/90' },
  { regex: /text-zinc-300/g, replacement: 'text-foreground/80' },
  { regex: /text-zinc-400/g, replacement: 'text-muted-foreground' },
  { regex: /text-zinc-500/g, replacement: 'text-muted-foreground/80' },
  { regex: /text-zinc-600/g, replacement: 'text-muted-foreground/60' }
];

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;
      for (const { regex, replacement } of replacements) {
        content = content.replace(regex, replacement);
      }
      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        console.log('Updated', fullPath);
      }
    }
  }
}

processDir(path.join(__dirname, 'app'));
processDir(path.join(__dirname, 'components'));
