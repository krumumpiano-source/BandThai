const assert = require('assert');

// ── Test 1: Backup key scoping ──
function getLiveBackupKeyOld(bandId, date) {
  return 'live_backup_' + bandId + '_' + date;
}

function getLiveBackupKeyNew(bandId, date, venue, timeSlot) {
  var v = (venue || '').trim();
  var ts = (timeSlot || '').trim();
  return 'live_backup_' + bandId + '_' + date + (v ? '_' + v : '') + (ts ? '_' + ts : '');
}

// In old code, both breaks share the key:
assert.strictEqual(
  getLiveBackupKeyOld('b1', '2026-10-14'),
  getLiveBackupKeyOld('b1', '2026-10-14'),
  'Old code shared key across breaks'
);

// In new code, keys are isolated:
const keyBreak1 = getLiveBackupKeyNew('b1', '2026-10-14', 'ร้าน A', '20:00 - 21:00');
const keyBreak2 = getLiveBackupKeyNew('b1', '2026-10-14', 'ร้าน A', '21:30 - 22:30');
assert.notStrictEqual(keyBreak1, keyBreak2, 'New keys must be distinct for different time slots');

// ── Test 2: Matching row for venue and timeSlot ──
function normSlot(s) {
  return (s || '').toLowerCase().replace(/[\s\-_:]/g, '');
}

function findRowOld(rows, venue, timeSlot) {
  var row = null;
  if (venue || timeSlot) {
    row = rows.find(function(x) {
      return x.venue === venue && x.timeSlot === timeSlot;
    });
    if (!row && venue) {
      row = rows.find(function(x) { return x.venue === venue; });
    }
    if (!row && timeSlot) {
      row = rows.find(function(x) { return x.timeSlot === timeSlot; });
    }
  } else {
    row = rows[0];
  }
  return row;
}

function findRowNew(rows, venue, timeSlot) {
  var row = null;
  if (venue || timeSlot) {
    // 1. Exact match
    row = rows.find(function(x) {
      return (!venue || x.venue === venue) && (!timeSlot || x.timeSlot === timeSlot);
    });
    // 2. Normalized match (ignores spaces/dashes/colons in timeSlot)
    if (!row && timeSlot) {
      var nSlot = normSlot(timeSlot);
      row = rows.find(function(x) {
        return (!venue || !x.venue || x.venue === venue) && normSlot(x.timeSlot) === nSlot;
      });
    }
    // 3. Partial match on timeSlot only (if venue didn't match or was omitted)
    if (!row && timeSlot && !venue) {
      row = rows.find(function(x) { return normSlot(x.timeSlot) === normSlot(timeSlot); });
    }
    // 4. Partial match on venue only — ONLY IF timeSlot was NOT provided!
    if (!row && venue && !timeSlot) {
      row = rows.find(function(x) { return x.venue === venue; });
    }
  } else {
    row = rows[0];
  }
  return row;
}

const dbRows = [
  { id: 1, venue: 'ร้าน A', timeSlot: '20:00 - 21:00', songs: ['Song1', 'Song2'] },
  { id: 2, venue: 'ร้าน A', timeSlot: '21:30 - 22:30', songs: ['Song3', 'Song4'] }
];

// Scenario: user navigates to Break 2 with slight formatting variation ('21:30-22:30' vs '21:30 - 22:30')
// Old code: exact match fails, then falls back to venue-only match -> picks id 1 (Break 1)!!
const oldMatch = findRowOld(dbRows, 'ร้าน A', '21:30-22:30');
assert.strictEqual(oldMatch.id, 1, 'Old code falsely picked Break 1 for Break 2 request');

// New code: normalized match correctly matches Break 2 (id 2)!
const newMatch = findRowNew(dbRows, 'ร้าน A', '21:30-22:30');
assert.strictEqual(newMatch.id, 2, 'New code correctly matches Break 2');

// Scenario: user requests a timeSlot that doesn't exist at all for that venue
// New code must return null/undefined rather than silently hijacking Break 1!
const noMatch = findRowNew(dbRows, 'ร้าน A', '23:00 - 00:00');
assert.ok(!noMatch, 'New code must not hijack Break 1 when timeSlot does not exist');

// ── Test 3: DB overwrite guard ──
// Old guard: if (_syncReceived || _modified || _playlistVersion > 0 || _playlist.length > 0)
// If local backup restored songs, _playlist.length > 0 is true, which dropped DB data!
function shouldSkipDbOverwriteOld(syncReceived, modified, version, playlistLength) {
  return syncReceived || modified || version > 0 || playlistLength > 0;
}

// New guard: only skip if actually modified live or received remote sync
function shouldSkipDbOverwriteNew(syncReceived, modified, version) {
  return syncReceived || modified || version > 0;
}

// After local backup restored songs, but before any live changes:
const fromBackupPlaylistLen = 5;
const modified = false;
const syncReceived = false;
const version = 0;

assert.strictEqual(
  shouldSkipDbOverwriteOld(syncReceived, modified, version, fromBackupPlaylistLen),
  true,
  'Old code incorrectly dropped DB response because local backup had songs'
);

assert.strictEqual(
  shouldSkipDbOverwriteNew(syncReceived, modified, version),
  false,
  'New code allows DB response to update playlist when no live modifications have occurred'
);

console.log('All reproduction and logic tests passed!');
