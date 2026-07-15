const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'fix-js-security.js');

const queryOld = `      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(data); } });`;
const queryNew = `      res.on('end', () => {
        if (res.statusCode >= 400) { reject(new Error(\`API Error: \${res.statusCode} - \${data}\`)); return; }
        try { resolve(JSON.parse(data)); } catch(e) { reject(data); }
      });`;

const patRegex = /const PAT = ['"`]sbp_[a-zA-Z0-9]+['"`];/g;
const newPatLine = `let _pat; try { _pat = fs.readFileSync('.env.local', 'utf8').match(/SUPABASE_PAT=(.+)/)[1].trim(); } catch(e) { _pat = process.env.SUPABASE_PAT; }\nconst PAT = _pat;`;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (content.match(patRegex)) {
    content = content.replace(patRegex, newPatLine);
    changed = true;
  }

  if (content.includes(queryOld)) {
    content = content.replace(queryOld, queryNew);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
}
