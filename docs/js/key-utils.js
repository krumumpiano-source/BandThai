// ── KEY DISPLAY UTILITIES ────────────────────────────────────────────
// Shared key notation system for all pages
// Usage: Import this file and call formatKey(key) to respect user preference

var _KEY_MAP = {
  'C / Am': 'C / Am',
  '1#': 'G / Em',   '2#': 'D / Bm',    '3#': 'A / F#m',
  '4#': 'E / C#m',  '5#': 'B / G#m',   '6#': 'F# / D#m',  '7#': 'C# / A#m',
  '1b': 'F / Dm',   '2b': 'Bb / Gm',   '3b': 'Eb / Cm',
  '4b': 'Ab / Fm',  '5b': 'Db / Bbm',  '6b': 'Gb / Ebm',  '7b': 'Cb / Abm'
};

function getKeyDisplayMode() {
  return localStorage.getItem('keyDisplayMode') || 'number';
}

function setKeyDisplayMode(mode) {
  localStorage.setItem('keyDisplayMode', mode);
}

function formatKey(key, mode) {
  if (!key) return '';
  var displayMode = mode || getKeyDisplayMode();
  if (displayMode === 'letter' && _KEY_MAP[key]) {
    return _KEY_MAP[key];
  }
  return key;
}

function toggleKeyDisplayMode() {
  var current = getKeyDisplayMode();
  var newMode = current === 'number' ? 'letter' : 'number';
  setKeyDisplayMode(newMode);
  return newMode;
}
