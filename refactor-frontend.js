const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, 'docs');
const cssDir = path.join(docsDir, 'css');
const jsDir = path.join(docsDir, 'js');

if (!fs.existsSync(cssDir)) fs.mkdirSync(cssDir, { recursive: true });
if (!fs.existsSync(jsDir)) fs.mkdirSync(jsDir, { recursive: true });

const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.html'));

let modifiedCount = 0;

for (const file of files) {
  const filePath = path.join(docsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  const basename = path.basename(file, '.html');
  let changed = false;

  // Extract <style>...</style>
  const styleRegex = /<style>([\s\S]*?)<\/style>/i;
  const styleMatch = content.match(styleRegex);
  if (styleMatch && styleMatch[1].trim().length > 0) {
    const cssContent = styleMatch[1].trim();
    // Only extract if significant (e.g., > 10 lines)
    if (cssContent.split('\n').length > 10) {
      const cssFileName = `${basename}.css`;
      fs.writeFileSync(path.join(cssDir, cssFileName), cssContent, 'utf8');
      content = content.replace(styleRegex, `<link rel="stylesheet" href="css/${cssFileName}">`);
      changed = true;
    }
  }

  // Extract <script>...</script>
  // Non-greedy match that does not contain src=
  const scriptRegex = /<script(?![^>]*src=)>([\s\S]*?)<\/script>/i;
  let scriptMatch = content.match(scriptRegex);
  
  if (scriptMatch && scriptMatch[1].trim().length > 0) {
    let jsContent = scriptMatch[1].trim();
    
    // Replace hardcoded Supabase token
    const tokenRegex = /'sb-wsorngsyowgxikiepice-auth-token'/g;
    if (tokenRegex.test(jsContent)) {
      jsContent = jsContent.replace(tokenRegex, "('sb-' + (window._SB_CONFIG?.url?.match(/https:\\/\\/([^.]+)\\.supabase\\.co/)?.[1] || 'wsorngsyowgxikiepice') + '-auth-token')");
    }
    
    // Check if there are other script tags without src
    const allScripts = content.match(/<script(?![^>]*src=)>[\s\S]*?<\/script>/gi);
    if (allScripts && allScripts.length === 1 && jsContent.split('\n').length > 20) {
      const jsFileName = `${basename}.js`;
      fs.writeFileSync(path.join(jsDir, jsFileName), jsContent, 'utf8');
      content = content.replace(scriptRegex, `<script src="js/${jsFileName}"></script>`);
      changed = true;
    } else if (allScripts && allScripts.length > 1) {
      // Just replace the token inline if there are multiple inline scripts to avoid breaking
       content = content.replace(tokenRegex, "('sb-' + (window._SB_CONFIG?.url?.match(/https:\\/\\/([^.]+)\\.supabase\\.co/)?.[1] || 'wsorngsyowgxikiepice') + '-auth-token')");
       changed = true;
    }
  }

  // Fix Accessibility for Known Buttons
  const a11yFixes = [
    { from: 'id="wPrev">&#9664;</button>', to: 'id="wPrev" aria-label="Previous">&#9664;</button>' },
    { from: 'id="wNext">&#9654;</button>', to: 'id="wNext" aria-label="Next">&#9654;</button>' },
    { from: 'id="slPrev">&#9664;</button>', to: 'id="slPrev" aria-label="Previous">&#9664;</button>' },
    { from: 'id="slNext">&#9654;</button>', to: 'id="slNext" aria-label="Next">&#9654;</button>' },
    { from: 'id="prevPeriod">◀</button>', to: 'id="prevPeriod" aria-label="Previous">◀</button>' },
    { from: 'id="nextPeriod">▶</button>', to: 'id="nextPeriod" aria-label="Next">▶</button>' }
  ];

  for (const fix of a11yFixes) {
    if (content.includes(fix.from)) {
      content = content.replace(new RegExp(fix.from.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), 'g'), fix.to);
      changed = true;
    }
  }

  if (changed && content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    modifiedCount++;
    console.log(`Refactored ${file}`);
  }
}

console.log(`Done! Refactored ${modifiedCount} files.`);
