const https = require('https');

https.get('https://krumumpiano-source.github.io/BandThai/js/live.js?v=20261014b', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('live.js length:', data.length);
    console.log('Has sortPlaylistsChronologically:', data.includes('sortPlaylistsChronologically'));
    console.log('Has switchToBreak:', data.includes('switchToBreak'));
    console.log('Has openBreakPicker:', data.includes('openBreakPicker'));
  });
}).on('error', err => console.error(err));
