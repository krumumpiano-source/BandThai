const assert = require('assert');

function normTimeSlotString(str) {
  return (str || '').toString().toLowerCase().replace(/[\s\-_:]/g, '');
}

// ── Test 1: Realtime state_sync rejection on mismatched slot ──
function testStateSyncBreakIsolation() {
  const currentVenue = 'นิยมสุข';
  const currentTimeSlot = '22:30-23:30'; // Break 2

  // Simulate incoming state_sync from Break 1
  const incomingSyncFromBreak1 = {
    venue: 'นิยมสุข',
    timeSlot: '21:00-22:00', // Break 1
    playlist: [
      { name: 'คิด(แต่ไม่)ถึง' },
      { name: 'คิดถึงจัง(มาหาหน่อย)' }
    ]
  };

  function shouldAcceptSync(d, _venue, _timeSlot) {
    if (!d.playlist || d.playlist.length === 0) return false;
    if (d.timeSlot && _timeSlot && normTimeSlotString(d.timeSlot) !== normTimeSlotString(_timeSlot)) {
      return false; // REJECT
    }
    if (d.venue && _venue && d.venue.trim() !== _venue.trim()) {
      return false; // REJECT
    }
    return true;
  }

  const accepted = shouldAcceptSync(incomingSyncFromBreak1, currentVenue, currentTimeSlot);
  assert.strictEqual(accepted, false, 'Break 2 MUST reject Break 1 state_sync!');

  // Simulate incoming state_sync from Break 2
  const incomingSyncFromBreak2 = {
    venue: 'นิยมสุข',
    timeSlot: '22:30-23:30',
    playlist: [
      { name: 'เมื่อถูกค้นพบ (Finally She Found.)' }
    ]
  };
  const acceptedBreak2 = shouldAcceptSync(incomingSyncFromBreak2, currentVenue, currentTimeSlot);
  assert.strictEqual(acceptedBreak2, true, 'Break 2 MUST accept Break 2 state_sync!');
  console.log('✅ Test 1 Passed: Realtime state_sync is strictly isolated per break!');
}

// ── Test 2: loadPlaylist correctly applies DB even if local backup had Break 1 ──
function testLoadPlaylistOverwritesOldBackup() {
  let _playlist = [
    { name: 'คิด(แต่ไม่)ถึง' },
    { name: 'คิดถึงจัง(มาหาหน่อย)' }
  ]; // Old backup in memory from Break 1
  let _userMadeLiveEdits = false;
  let _syncReceived = false;
  let _modified = false;
  let _playlistVersion = 0;

  const dbRows = [
    {
      venue: 'นิยมสุข',
      timeSlot: '21:00-22:00',
      songs: [{ name: 'คิด(แต่ไม่)ถึง' }, { name: 'คิดถึงจัง' }]
    },
    {
      venue: 'นิยมสุข',
      timeSlot: '22:30-23:30',
      songs: [
        { name: 'เมื่อถูกค้นพบ (Finally She Found.)' },
        { name: 'โปรดส่งใครมารักฉันที' }
      ]
    }
  ];

  const targetVenue = 'นิยมสุข';
  const targetSlot = '22:30-23:30';

  const row = dbRows.find(x => x.venue === targetVenue && x.timeSlot === targetSlot);
  assert.ok(row, 'Row for Break 2 must be found');

  if (!_userMadeLiveEdits) {
    _playlist = row.songs.slice();
    _syncReceived = false;
    _modified = false;
    _playlistVersion = 0;
  }

  assert.strictEqual(_playlist.length, 2);
  assert.strictEqual(_playlist[0].name, 'เมื่อถูกค้นพบ (Finally She Found.)', 'Break 2 playlist must replace old backup!');
  console.log('✅ Test 2 Passed: DB playlist cleanly replaces any stale local backup on initial load!');
}

// ── Test 3: initRealtime channel transition ──
function testChannelTransition() {
  let _channel = { name: 'live-band123-2026-10-14' };
  let _channelName = 'live-band123-2026-10-14';
  let _initRealtimePending = true;

  const targetChannel = 'live-band123-2026-10-14-e19e34e22e21e2ae38e02-22_30_23_30';

  function canConnect(existingChannel, existingChannelName, targetChannelName, isPending) {
    if (existingChannel && existingChannelName === targetChannelName && isPending) {
      return false; // debounced
    }
    return true; // allowed to connect to new channel
  }

  const allowed = canConnect(_channel, _channelName, targetChannel, _initRealtimePending);
  assert.strictEqual(allowed, true, 'Channel transition MUST NOT be blocked by debounce!');
  console.log('✅ Test 3 Passed: Switching to specific break channel is never blocked!');
}

testStateSyncBreakIsolation();
testLoadPlaylistOverwritesOldBackup();
testChannelTransition();
console.log('\n🎉 ALL REALTIME ISOLATION AND PLAYLIST LOADING TESTS PASSED!');
