const https = require('https');

https.get('https://krumumpiano-source.github.io/BandThai/live.html?t=' + Date.now(), res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const m = data.match(/<script src="([^"]+live\.js[^"]*)">/);
    console.log('Script tag in live.html:', m ? m[1] : 'not found');
    const hasButton = data.includes('<button id="venueLabel"');
    console.log('Has <button id="venueLabel">: ', hasButton);
    const hasBreakPicker = data.includes('breakPickerModal');
    console.log('Has breakPickerModal: ', hasBreakPicker);
  });
}).on('error', err => console.error(err));
