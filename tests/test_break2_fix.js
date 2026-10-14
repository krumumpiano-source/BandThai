const assert = require('assert');

function normTimeSlotString(str) {
  return (str || '').toString().toLowerCase().replace(/[\s\-_:]/g, '');
}

function sortPlaylistsChronologically(rows) {
  if (!rows || rows.length <= 1) return rows || [];
  return rows.slice().sort(function(a, b) {
    var sA = (a.timeSlot || '').trim();
    var sB = (b.timeSlot || '').trim();

    var timeA = sA.match(/(\d{1,2}):(\d{2})/);
    var timeB = sB.match(/(\d{1,2}):(\d{2})/);
    if (timeA && timeB) {
      var minA = parseInt(timeA[1], 10) * 60 + parseInt(timeA[2], 10);
      var minB = parseInt(timeB[1], 10) * 60 + parseInt(timeB[2], 10);
      if (minA < 360) minA += 1440;
      if (minB < 360) minB += 1440;
      if (minA !== minB) return minA - minB;
    }

    var numA = sA.match(/\d+/);
    var numB = sB.match(/\d+/);
    if (numA && numB && !timeA && !timeB) {
      var nA = parseInt(numA[0], 10);
      var nB = parseInt(numB[0], 10);
      if (nA !== nB) return nA - nB;
    }

    var cA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    var cB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (cA && cB && cA !== cB) return cA - cB;

    return 0;
  });
}

function matchPlaylistRow(allPlaylists, venue, timeSlot) {
  var targetSlot = (timeSlot || '').trim();
  var targetVenue = (venue || '').trim();
  var targetSlotNorm = normTimeSlotString(targetSlot);

  var row = null;
  if (targetVenue && targetSlot) {
    row = allPlaylists.find(function(x) {
      return (x.venue || '').trim() === targetVenue && (x.timeSlot || '').trim() === targetSlot;
    });
    if (!row) {
      row = allPlaylists.find(function(x) {
        return (x.venue || '').trim() === targetVenue && normTimeSlotString(x.timeSlot) === targetSlotNorm;
      });
    }
    if (!row) {
      row = allPlaylists.find(function(x) {
        return normTimeSlotString(x.timeSlot) === targetSlotNorm;
      });
    }
  } else if (targetSlot) {
    row = allPlaylists.find(function(x) {
      return (x.timeSlot || '').trim() === targetSlot;
    });
    if (!row) {
      row = allPlaylists.find(function(x) {
        return normTimeSlotString(x.timeSlot) === targetSlotNorm;
      });
    }
  } else if (targetVenue) {
    row = allPlaylists.find(function(x) {
      return (x.venue || '').trim() === targetVenue;
    });
  }
  return row;
}

// ── Test 1: Bug Reproduction - Empty timeSlot in Break 1 ──
// In DB: Break 1 was saved without timeSlot (timeSlot: ""), Break 2 has timeSlot: "21:15-22:15"
const dbRowsWithEmptySlot1 = [
  { id: 'break1', venue: 'ร้าน A', timeSlot: '', songs: [{ name: 'เพลงเบรค 1 - A' }, { name: 'เพลงเบรค 1 - B' }] },
  { id: 'break2', venue: 'ร้าน A', timeSlot: '21:15-22:15', songs: [{ name: 'เพลงเบรค 2 - X' }, { name: 'เพลงเบรค 2 - Y' }] }
];

// Flawed logic: (!x.timeSlot || !_timeSlot || x.timeSlot === _timeSlot)
// When _timeSlot is '21:15-22:15', !x.timeSlot is true for Break 1, so it matches break1!
const flawedMatch = dbRowsWithEmptySlot1.find(function(x) {
  var _venue = 'ร้าน A';
  var _timeSlot = '21:15-22:15';
  return (!x.venue || !_venue || x.venue === _venue) && (!x.timeSlot || !_timeSlot || x.timeSlot === _timeSlot);
});
assert.strictEqual(flawedMatch.id, 'break1', 'Confirm bug: flawed condition picked Break 1 for Break 2 request!');

// Fixed logic:
const fixedMatch = matchPlaylistRow(dbRowsWithEmptySlot1, 'ร้าน A', '21:15-22:15');
assert.strictEqual(fixedMatch.id, 'break2', 'Fixed logic correctly picks Break 2!');

// ── Test 2: Thai text slots ("เบรค 1" vs "เบรค 2") ──
const thaiRows = [
  { id: 'b1', venue: 'ไม้เอก', timeSlot: 'เบรค 1', songs: ['S1'] },
  { id: 'b2', venue: 'ไม้เอก', timeSlot: 'เบรค 2', songs: ['S2'] }
];
const matchThai2 = matchPlaylistRow(thaiRows, 'ไม้เอก', 'เบรค 2');
assert.strictEqual(matchThai2.id, 'b2', 'Matches Thai break 2 slot correctly');

// ── Test 3: Local Backup matching guard ──
function checkBackupMatch(bk, reqVenue, reqSlot) {
  var bkVenueMatch = !reqVenue ? true : !!(bk.venue && bk.venue === reqVenue);
  var bkSlotMatch = !reqSlot ? true : !!(bk.timeSlot && normTimeSlotString(bk.timeSlot) === normTimeSlotString(reqSlot));
  return bkVenueMatch && bkSlotMatch;
}

const bkBreak1EmptySlot = { venue: 'ร้าน A', timeSlot: '', playlist: ['B1_Song'] };
const bkBreak1WithSlot = { venue: 'ร้าน A', timeSlot: '20:00-21:00', playlist: ['B1_Song'] };
const bkBreak2 = { venue: 'ร้าน A', timeSlot: '21:15-22:15', playlist: ['B2_Song'] };

assert.strictEqual(checkBackupMatch(bkBreak1EmptySlot, 'ร้าน A', '21:15-22:15'), false, 'Empty slot backup must NOT match Break 2');
assert.strictEqual(checkBackupMatch(bkBreak1WithSlot, 'ร้าน A', '21:15-22:15'), false, 'Break 1 backup must NOT match Break 2');
assert.strictEqual(checkBackupMatch(bkBreak2, 'ร้าน A', '21:15-22:15'), true, 'Break 2 backup matches Break 2');

// ── Test 4: Chronological sorting of playlists ──
const unsorted = [
  { id: 'b2', timeSlot: '21:15-22:15', createdAt: '2026-10-14T15:00:00Z' },
  { id: 'b1', timeSlot: '20:00-21:00', createdAt: '2026-10-14T16:00:00Z' } // updated later
];
const sorted = sortPlaylistsChronologically(unsorted);
assert.strictEqual(sorted[0].id, 'b1', 'Break 1 (20:00) comes before Break 2 (21:15)');
assert.strictEqual(sorted[1].id, 'b2');

const unsortedThai = [
  { id: 't2', timeSlot: 'เบรค 2' },
  { id: 't1', timeSlot: 'เบรค 1' }
];
const sortedThai = sortPlaylistsChronologically(unsortedThai);
assert.strictEqual(sortedThai[0].id, 't1', '"เบรค 1" comes before "เบรค 2"');
assert.strictEqual(sortedThai[1].id, 't2');

console.log('All Break 2 verification tests passed cleanly!');
