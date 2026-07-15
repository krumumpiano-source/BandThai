const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, 'docs');
const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.html'));

const results = {};

for (const file of files) {
  const content = fs.readFileSync(path.join(docsDir, file), 'utf8');
  const lines = content.split('\n');
  
  let issues = [];
  
  // 1. Hardcoded Supabase token string
  if (content.includes('sb-wsorngsyowgxikiepice-auth-token')) {
    issues.push('Hardcoded Supabase Auth Token Key');
  }
  
  // 2. Inline Script lines count
  let inScript = false;
  let scriptLines = 0;
  let inStyle = false;
  let styleLines = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('<script>') && !line.includes('src=')) inScript = true;
    if (line.includes('</script>')) inScript = false;
    if (inScript) scriptLines++;
    
    if (line.includes('<style>')) inStyle = true;
    if (line.includes('</style>')) inStyle = false;
    if (inStyle) styleLines++;
  }
  
  if (scriptLines > 100) issues.push(`Heavy Inline JS (${scriptLines} lines)`);
  if (styleLines > 50) issues.push(`Heavy Inline CSS (${styleLines} lines)`);
  
  // 3. Accessibility - buttons without aria-label (simple regex approximation)
  // Check if <button> without aria-label and has symbol or empty
  const buttonMatches = content.match(/<button[^>]*>.*?<\/button>/gi) || [];
  let a11yWarn = false;
  for (const btn of buttonMatches) {
    if (!btn.toLowerCase().includes('aria-label') && (btn.includes('&#') || btn.includes('nav-btn'))) {
      a11yWarn = true;
    }
  }
  if (a11yWarn) issues.push('Possible A11y issue (Icon/Nav Buttons without aria-label)');
  
  // 4. Duplicate helper functions (calcH, formatThaiDateFull if inline)
  if (content.includes('function calcH(')) issues.push('Duplicate function: calcH()');
  
  if (issues.length > 0) {
    results[file] = issues;
  }
}

console.log(JSON.stringify(results, null, 2));
