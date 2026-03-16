/**
 * BandThai — Supabase API Wrapper
 * แทนที่ apiCall() ทุก action ด้วย Supabase REST SDK
 *
 * Load order ใน HTML:
 *   1. i18n.js
 *   2. app.js          ← inject Supabase SDK + ไฟล์นี้ อัตโนมัติ
 *   3. nav.js
 */
(function (global) {
  'use strict';

  // ── ⚙️ CONFIG — แก้ค่านี้หลังสร้าง Supabase project ─────────────
  var SUPABASE_URL    = (global._SB_CONFIG && global._SB_CONFIG.url)    || '';
  var SUPABASE_ANON   = (global._SB_CONFIG && global._SB_CONFIG.anon)   || '';
  // ──────────────────────────────────────────────────────────────────

  // รอ SDK โหลดก่อน แล้ว init
  function waitForSDK(cb, tries) {
    tries = tries || 0;
    if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
      cb();
    } else if (tries < 100) {
      setTimeout(function () { waitForSDK(cb, tries + 1); }, 50);
    } else {
      console.error('Supabase SDK โหลดไม่สำเร็จ');
    }
  }

  waitForSDK(function () {
    var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: true, storage: localStorage }
    });
    global._sb = sb;

    // ── Helpers ─────────────────────────────────────────────────────
    function getBandId()   { return localStorage.getItem('bandId')   || ''; }
    function getRole()     { return localStorage.getItem('userRole') || ''; }

    // ── Member Activity Logging (fire-and-forget) ────────────────────
    var _actSessId = 'S' + Date.now() + Math.random().toString(36).slice(2, 7);
    function _logMemberAct(action, label, targetId, targetName, score) {
      var uid   = localStorage.getItem('userId')   || '';
      var uname = localStorage.getItem('userName') || '';
      var bid   = getBandId();
      if (!uid || !bid) return;
      sb.from('member_activity_log').insert({
        band_id:      bid,
        user_id:      uid,
        user_name:    uname,
        action:       action,
        action_label: label,
        target_id:    String(targetId   || ''),
        target_name:  String(targetName || ''),
        score:        score || 1,
        session_id:   _actSessId
      }).then(function(){}).catch(function(e){ console.warn('[activity]', e); });
    }

    function saveSession(session, profile) {
      localStorage.setItem('auth_token',    session.access_token);
      // เก็บ userId (Supabase auth UUID) ไว้ใช้ match check-in/leave records
      localStorage.setItem('userId', (session.user && session.user.id) || '');
      // ข้อมูลส่วนตัว
      localStorage.setItem('userTitle',     profile.title      || '');
      localStorage.setItem('userFirstName', profile.first_name || '');
      localStorage.setItem('userLastName',  profile.last_name  || '');
      localStorage.setItem('userNickname',  profile.nickname   || '');
      localStorage.setItem('userInstrument',profile.instrument || '');
      // ชื่อแสดง: ชื่อเล่น ถ้ามี ไม่มีใช้ first_name หรือ user_name
      var displayName = profile.nickname || profile.first_name || profile.user_name || '';
      localStorage.setItem('userName',   displayName);
      localStorage.setItem('userEmail',  profile.email      || '');
      localStorage.setItem('bandId',     profile.band_id    || '');
      localStorage.setItem('bandName',   profile.band_name  || '');
      localStorage.setItem('userRole',     profile.role       || 'member');
      localStorage.setItem('bandProvince',  profile.province   || '');
      // ระดับแผน: 'free' | 'lite' | 'pro'
      localStorage.setItem('band_plan',    profile.band_plan    || 'free');
      localStorage.setItem('plan_scope',   profile.plan_scope   || 'free');
      localStorage.setItem('plan_override', profile.plan_override || '');
    }

    function clearSession() {
      ['auth_token','userId','bandId','bandName','bandManager','userRole','userName',
       'userTitle','userFirstName','userLastName','userNickname','userInstrument','userEmail',
       'bandProvince','band_plan','plan_scope','plan_override','ad_gate_ts'].forEach(function (k) {
        localStorage.removeItem(k);
      });
    }

    // snake_case → camelCase (เพื่อ backward compat กับ frontend เดิม)
    function toCamel(obj) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
      var result = {};
      Object.keys(obj).forEach(function (k) {
        var camel = k.replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); });
        result[camel] = obj[k];
      });
      return result;
    }
    function toCamelList(arr) { return (arr || []).map(toCamel); }

    // ── sbRun — Supabase API call interface ──────────────────────
    function friendlyError(msg) {
      if (!msg) return msg;
      if (/row.level security|policy/i.test(msg)) return 'สิทธิ์ไม่เพียงพอ — เฉพาะผู้จัดการวงเท่านั้นที่ทำรายการนี้ได้';
      return msg;
    }

    function sbRun(action, data, callback) {
      dispatch(action, data || {}).then(function (result) {
        if (result && result.authError) {
          clearSession();
          window.location.replace('index.html');
          return;
        }
        if (result && !result.success && result.message) result.message = friendlyError(result.message);
        if (callback) callback(result);
      }).catch(function (err) {
        console.error('[sbRun]', action, err);
        var msg = friendlyError(err.message || err.toString());
        if (callback) callback({ success: false, message: msg });
      });
    }
    global.sbRun   = sbRun;
    global.apiCall = sbRun;

    // ── dispatch ────────────────────────────────────────────────────
    async function dispatch(action, d) {
      switch (action) {

        // ── Auth ───────────────────────────────────────────────────
        case 'login':               return doLogin(d);
        case 'register':            return doRegister(d);
        case 'registerBandRequest': return doRegisterBandRequest(d);
        case 'logout':              return doLogout();
        case 'requestPasswordReset': return doRequestPasswordReset(d);
        case 'resetPassword':          return doResetPassword(d);
        case 'lookupEmail':            return doLookupEmail(d);

        // ── Invite / Band Code ─────────────────────────────────────
        case 'generateInviteCode':  return doGenerateInviteCode(d);
        case 'lookupInviteCode':    return doLookupInviteCode(d);
        case 'getBandCode':         return doGetBandCode(d);

        // ── Band Requests (ขอสร้างวงใหม่) ──────────────────────────
        case 'getPendingBandRequests':   return doGetPendingBandRequests();
        case 'approveBandRequest':       return doApproveBandRequest(d);
        case 'rejectBandRequest':        return doRejectBandRequest(d);

        // ── Songs ──────────────────────────────────────────────────
        case 'getAllSongs':
        case 'getSongs':           return doGetAllSongs(d);
        case 'getSong':            return doGetOne('band_songs', d.songId);
        case 'addSong': {
          var _sdata = Object.assign({}, d.data || d);
          var _uid = localStorage.getItem('userId') || '';
          var _uname = localStorage.getItem('userName') || '';
          if (_uid) { _sdata.created_by = _uid; _sdata.createdBy = _uid; _sdata.updated_by = _uid; _sdata.updatedBy = _uid; }
          var _sr = await doInsert('band_songs', _sdata);
          if (_sr.success) _logMemberAct('add_song', 'เพิ่มเพลง', _sr.data && _sr.data.id, _sdata.name || '', 3);
          return _sr;
        }
        case 'updateSong': {
          var _sdata = Object.assign({}, d.data || d);
          var _uid = localStorage.getItem('userId') || '';
          if (_uid) { _sdata.updated_by = _uid; _sdata.updatedBy = _uid; }
          var _sr = await doUpdate('band_songs', d.songId, _sdata);
          if (_sr.success) _logMemberAct('edit_song', 'แก้ไขเพลง', d.songId, _sdata.name || d.songName || '', 1);
          return _sr;
        }
        case 'deleteSong': {
          var _sr = await doDelete('band_songs', d.songId);
          if (_sr.success) _logMemberAct('delete_song', 'ลบเพลง', d.songId, d.songName || d.name || '', 2);
          return _sr;
        }
        case 'getGlobalSongsAll':   return doGetGlobalSongsAll();
        case 'mergeDuplicateSongs': {
          var _sr = await doMergeDuplicateSongs(d);
          if (_sr.success) _logMemberAct('merge_songs', 'รวมเพลงซ้ำ', d.keepId || '', d.keepName || d.name || '', 5);
          return _sr;
        }
        case 'savePlaylistHistory':return doSavePlaylistHistory(d);
        case 'getPlaylistHistory': return doGetPlaylistHistory(d);
        case 'getPlaylistHistoryByDate': return doGetPlaylistHistoryByDate(d);
        case 'deletePlaylistHistory': return doDeletePlaylistHistory(d);
        case 'removeSongFromAllHistory': return doRemoveSongFromAllHistory(d);
        case 'getSongInsights':    return doGetSongInsights(d);
        case 'searchSongs':        return doSearchSongs(d);
        case 'getSongsPage':       return doGetSongsPage(d);
        case 'getRequestedSongsFromHistory': return doGetRequestedSongsFromHistory(d);
        case 'bulkAddSongsToLibrary': {
          var _sr = await doBulkAddSongsToLibrary(d);
          if (_sr.success) {
            var _cnt = Array.isArray(d.songs) ? d.songs.length : (Array.isArray(d.songIds) ? d.songIds.length : 1);
            _logMemberAct('bulk_add', 'เพิ่มเพลงกลุ่ม (' + _cnt + ')', '', _cnt + ' เพลง', Math.max(_cnt, 1) * 2);
          }
          return _sr;
        }
        case 'cloneSongsToBand':   return doCloneSongsToBand(d);
        case 'removeFromBandLibrary': return doRemoveFromBandLibrary(d);
        case 'detachRefSong':      return doDetachRefSong(d);
        case 'getBandSongStats':   return doGetBandSongStats(d);

        // ── Artists (Master) ───────────────────────────────────────
        case 'getArtists':         return doGetArtists();
        case 'getSongArtists':     return doGetSongArtists(d);
        case 'addArtist': {
          var _sr = await doAddArtist(d);
          if (_sr.success) _logMemberAct('add_artist', 'เพิ่มศิลปิน', _sr.data && _sr.data.id, d.name || '', 2);
          return _sr;
        }
        case 'ensureArtist':       return doEnsureArtist(d);
        case 'updateArtist': {
          var _sr = await doUpdateArtist(d);
          if (_sr.success) _logMemberAct('edit_artist', 'แก้ไขศิลปิน', d.artistId || d.id, d.name || '', 1);
          return _sr;
        }
        case 'deleteArtist': {
          var _sr = await doDeleteArtist(d);
          if (_sr.success) _logMemberAct('delete_artist', 'ลบศิลปิน', d.artistId || d.id, d.name || '', 2);
          return _sr;
        }
        case 'cleanupOrphanArtists': return doCleanupOrphanArtists();
        case 'searchArtists':      return doSearchArtists(d);

        // ── Song Suggestions ───────────────────────────────────────
        case 'addSongSuggestion':      return doAddSongSuggestion(d);
        case 'getSongSuggestions':     return doGetSongSuggestions(d);
        case 'reviewSongSuggestion':   return doReviewSongSuggestion(d);

        // ── Band Members ───────────────────────────────────────────
        case 'getAllBandMembers':   return doGetBandMembers();
        case 'getBandProfiles':    return doGetBandProfiles(d);
        case 'addBandMember':      return doInsert('band_members', d.data || d);
        case 'updateBandMember':   return doUpdate('band_members', d.memberId, d.data || d);
        case 'deleteBandMember':   return doDelete('band_members', d.memberId);

        // ── Attendance ─────────────────────────────────────────────
        case 'addAttendancePayroll':    return doInsert('attendance_payroll', d.data || d);
        case 'getAllAttendancePayroll':  return doGetAttendance(d);
        case 'deleteAttendancePayroll': return doDelete('attendance_payroll', d.recordId);

        // ── Check-in ───────────────────────────────────────────────
        case 'memberCheckIn':      return doMemberCheckIn(d);
        case 'getMyCheckIn':       return doGetMyCheckIn(d);
        case 'cancelCheckIn':      return doCancelCheckIn(d);
        case 'getCheckInsForDate': return doSelect('member_check_ins', { band_id: getBandId(), date: d.date });
        case 'getCheckInsForRange': return doSelectRange('member_check_ins', getBandId(), d.dateFrom, d.dateTo, d.memberId);

        // ── Leave ──────────────────────────────────────────────────
        case 'requestLeave':       return doRequestLeave(d);
        case 'getMyLeaveRequests': return doSelect('leave_requests', { band_id: getBandId(), member_id: d.memberId }, '-date', 100);
        case 'getAllLeaveRequests': return doSelect('leave_requests', { band_id: getBandId() }, '-date', 200);
        case 'getLeaveRequestsForRange': return doSelectRange('leave_requests', getBandId(), d.dateFrom, d.dateTo, d.memberId);
        case 'assignSubstitute':   return doUpdate('leave_requests', d.leaveId, { substitute_id: d.substituteId, substitute_name: d.substituteName, status: 'approved' });
        case 'rejectLeave':        return doUpdate('leave_requests', d.leaveId, { status: 'rejected' });

        case 'getDashboardSummary': return doGetDashboardSummary();

        // ── Pending Members ────────────────────────────────────────
        case 'getPendingMembers':  return doGetPendingMembers(d);
        case 'approveMember':      return doApproveMember(d);
        case 'rejectMember':       return doRejectMember(d);
        case 'removeMember':       return doRemoveMember(d);

        // ── Setlist ────────────────────────────────────────────────
        case 'getSetlist':          return doGetSetlist(d);
        case 'saveSetlist':         return doSaveSetlist(d);
        case 'getScheduleForDate':  return doGetScheduleForDate(d);

        // ── Band Fund (กองกลาง) ────────────────────────────────────
        case 'getFundTransactions':    return doGetFundTransactions(d);
        case 'addFundTransaction':     return doAddFundTransaction(d);
        case 'deleteFundTransaction':  return doDeleteFundTransaction(d);
        case 'approveFundTransaction': return doApproveFundTransaction(d);
        case 'rejectFundTransaction':  return doRejectFundTransaction(d);

        // ── External Payout ────────────────────────────────────────
        case 'addExternalPayout':      return doInsert('external_payouts', Object.assign({ band_id: getBandId() }, toSnakeObj(d)));
        case 'getAllExternalPayouts':   return doSelect('external_payouts', { band_id: getBandId() }, '-date');
        case 'deleteExternalPayout':   return doDelete('external_payouts', d.payoutId);

        // ── External Jobs (งานนอก) ─────────────────────────────────
        case 'addExternalJob':         return doInsert('external_jobs', d.data || d);
        case 'getExternalJobs':        return doSelect('external_jobs', { band_id: getBandId() }, '-event_date');
        case 'getUpcomingExternalJobs':return doGetUpcomingExternalJobs(d);
        case 'updateExternalJob':      return doUpdate('external_jobs', d.jobId || d.id, d.data || d);
        case 'deleteExternalJob':      return doDelete('external_jobs', d.jobId || d.id);
        case 'payMemberForJob':        return doPayMemberForJob(d);

        // ── Quotation PDF ──────────────────────────────────────────
        case 'generateQuotationPdf': return doGenerateQuotationPdf(d);

        // ── Band Settings ──────────────────────────────────────────
        case 'saveBandSettings':   return doSaveBandSettings(d);
        case 'getBandSettings':    return doGetBandSettings(d.bandId || getBandId());

        // ── Schedule ───────────────────────────────────────────────
        case 'saveSchedule':  return doSaveSchedule(d);
        case 'getSchedule':   return doGetSchedule(d);

        // ── Equipment ──────────────────────────────────────────────
        case 'getAllEquipment':        return doSelect('equipment', { band_id: getBandId() }, 'name');
        case 'addEquipment':           return doInsert('equipment', d.data || d);
        case 'updateEquipment':        return doUpdate('equipment', d.equipmentId, d.data || d);
        case 'deleteEquipment':        return doDelete('equipment', d.equipmentId);
        case 'uploadEquipmentImage':   return doUploadEquipmentImage(d);

        // ── Clients ────────────────────────────────────────────────
        case 'getAllClients':   return doSelect('clients', { band_id: getBandId() }, 'name');
        case 'addClient':      return doInsert('clients', d.data || d);
        case 'updateClient':   return doUpdate('clients', d.clientId, d.data || d);
        case 'deleteClient':   return doDelete('clients', d.clientId);

        // ── Quotations ─────────────────────────────────────────────
        case 'getAllQuotations': return doSelect('quotations', { band_id: getBandId() }, '-date');
        case 'addQuotation':    return doInsert('quotations', d.data || d);
        case 'updateQuotation': return doUpdate('quotations', d.quotationId, d.data || d);
        case 'deleteQuotation': return doDelete('quotations', d.quotationId);

        // ── Profile ────────────────────────────────────────────────
        case 'getMyProfile':    return doGetMyProfile();
        case 'updateMyProfile': return doUpdateMyProfile(d);
        case 'changeEmail':     return doChangeEmail(d);
        case 'changePassword':  return doChangePassword(d);
        case 'syncBandPlan':    return doSyncBandPlan();

        // ── Admin ──────────────────────────────────────────────────
        case 'verifyAdmin':       return doVerifyAdmin();
        case 'getAllUsers':       return doAdminGetAllUsers();
        case 'updateUserRole':    return doUpdate('profiles', d.userId, { role: d.role });
        case 'setPlanOverride':   return doSetPlanOverride(d);
        case 'deleteUser':        return doAdminDeleteUser(d.userId);
        case 'getSystemInfo':     return doGetSystemInfo();
        case 'getPromoCodes':     return doGetPromoCodes();
        case 'savePromoCode':     return doSavePromoCode(d);
        case 'deletePromoCode':   return doDeletePromoCode(d);
        case 'validatePromoCode': return doValidatePromoCode(d);
        case 'usePromoCode':      return doUsePromoCode(d);

        // ── App Config ─────────────────────────────────────────────
        case 'getAppConfig':          return doGetAppConfig();
        case 'setAppConfigKey':       return doSetAppConfigKey(d);

        // ── Bands Management ───────────────────────────────────────
        case 'getAllBands':            return doGetAllBands();
        case 'setBandPlan':           return doSetBandPlan(d);
        case 'adminDeleteBand':       return doAdminDeleteBand(d);

        // ── Activity Log ───────────────────────────────────────────
        case 'getActivityLog':        return doGetActivityLog(d);
        case 'logActivity':           return doLogActivity(d);
        case 'getMemberActivityLog':     return doGetMemberActivityLog(d);
        case 'getMemberActivitySummary': return doGetMemberActivitySummary(d);
        case 'getMemberWorkStats':       return doGetMemberWorkStats(d);
        case 'backfillMemberActivity':   return doBackfillMemberActivity(d);
        case 'getSongsInRange':          return doGetSongsInRange(d);

        // ── Notification Templates ─────────────────────────────────
        case 'getNotifTemplates':     return doGetNotifTemplates();
        case 'saveNotifTemplate':     return doSaveNotifTemplate(d);

        // ── Broadcast ──────────────────────────────────────────────
        case 'broadcastNotification': return doBroadcastNotification(d);

        // ── Live Guest Tokens ──────────────────────────────────────
        case 'createGuestToken':  return doCreateGuestToken(d);
        case 'verifyGuestToken':  return doVerifyGuestToken(d);
        case 'deleteGuestToken':  return doDeleteGuestToken(d);

        // ── Push Subscriptions ─────────────────────────────────────
        case 'savePushSubscription':      return doSavePushSubscription(d);
        case 'deletePushSubscription':    return doDeletePushSubscription(d);
        case 'getNotifSubscribers':       return doGetNotifSubscribers(d);
        case 'sendTestNotification':      return doSendTestNotification(d);
        case 'cleanStaleSubscriptions':   return doCleanStaleSubscriptions(d);

        // ── Legacy (ไม่รองรับในเวอร์ชันปัจจุบัน) ──────────────────
        case 'createBackup':
        case 'getSpreadsheetUrl':
        case 'runSetupFromAdmin':
        case 'clearAllData':
        case 'resetUsers':
          return { success: false, message: 'ฟีเจอร์นี้ไม่พร้อมใช้งานในเวอร์ชัน Supabase' };

        default:
          return { success: false, message: 'Unknown action: ' + action };
      }
    }

    // ── camelCase payload → snake_case row ──────────────────────────
    function toSnakeObj(obj) {
      if (!obj || typeof obj !== 'object') return obj;
      var result = {};
      var fieldMap = {
        bandId: 'band_id', bandName: 'band_name', venueId: 'venue_id',
        venueName: 'venue_name', memberId: 'member_id', memberName: 'member_name',
        clientId: 'client_id', clientName: 'client_name', quotationId: 'quotation_id',
        leaveId: 'leave_id', substituteId: 'substitute_id', substituteName: 'substitute_name',
        substituteContact: 'substitute_contact',
        scheduleId: 'schedule_id', equipmentId: 'equipment_id',
        timeSlots: 'time_slots', dayOfWeek: 'day_of_week', totalPay: 'total_pay',
        totalAmount: 'total_amount', priceAdjustments: 'price_adjustments',
        defaultHourlyRate: 'default_hourly_rate', defaultPay: 'default_pay',
        joinedAt: 'joined_at', checkInAt: 'check_in_at', expiresAt: 'expires_at',
        eventDate: 'event_date', eventType: 'event_type', vatAmount: 'vat_amount',
        docUrl: 'doc_url', serialNo: 'serial_no', purchaseDate: 'purchase_date',
        purchaseSource: 'purchase_source', fundSource: 'fund_source', imageUrl: 'image_url',
        contactPerson: 'contact_person', lineId: 'line_id',
        totalGigs: 'total_gigs', totalRevenue: 'total_revenue',
        effectiveFrom: 'effective_from', effectiveTo: 'effective_to',
        hourlyRate: 'hourly_rate', startTime: 'start_time', endTime: 'end_time',
        // profile fields
        firstName: 'first_name', lastName: 'last_name', userName: 'user_name',
        userId: 'user_id',
        songId: 'song_id', keyNote: 'key_note',
        createdAt: 'created_at', updatedAt: 'updated_at',
        createdBy: 'created_by', updatedBy: 'updated_by',
        createdBy: 'created_by', sourceContractId: 'source_contract_id',
        // external jobs fields
        jobName: 'job_name', clientPhone: 'client_phone',
        venueAddress: 'venue_address', showDuration: 'show_duration',
        totalFee: 'total_fee', bandFundCut: 'band_fund_cut',
        otherExpenses: 'other_expenses', memberFees: 'member_fees',
        travelInfo: 'travel_info', foodInfo: 'food_info',
        payoutStatus: 'payout_status', payoutDate: 'payout_date',
        jobId: 'job_id', externalJobId: 'external_job_id'
      };
      Object.keys(obj).forEach(function (k) {
        if (k === '_token' || k === 'action') return;
        var snakeKey = fieldMap[k] || k;
        result[snakeKey] = obj[k];
      });
      return result;
    }

    // ── Generic CRUD ─────────────────────────────────────────────
    async function doSelect(table, filters, order, limit) {
      var q = sb.from(table).select('*');
      if (filters) {
        Object.keys(filters).forEach(function (k) { q = q.eq(k, filters[k]); });
      }
      if (order) {
        var desc = order.startsWith('-');
        q = q.order(desc ? order.slice(1) : order, { ascending: !desc });
      }
      if (limit) q = q.limit(limit);
      var { data, error } = await q;
      if (error) throw error;
      return { success: true, data: toCamelList(data) };
    }

    /** Select rows within a date range (gte..lte) – used by statistics */
    async function doSelectRange(table, bandId, dateFrom, dateTo, memberId) {
      var q = sb.from(table).select('*').eq('band_id', bandId);
      if (dateFrom)  q = q.gte('date', dateFrom);
      if (dateTo)    q = q.lte('date', dateTo);
      if (memberId)  q = q.eq('member_id', memberId);
      q = q.order('date', { ascending: true }).limit(5000);
      var { data, error } = await q;
      if (error) throw error;
      return { success: true, data: toCamelList(data) };
    }

    async function doGetOne(table, id) {
      if (!id) return { success: false, message: 'ไม่พบ id' };
      var { data, error } = await sb.from(table).select('*').eq('id', id).single();
      if (error) throw error;
      return { success: true, data: toCamel(data) };
    }

    async function doInsert(table, payload) {
      var row = toSnakeObj(Object.assign({ band_id: getBandId() }, payload));
      delete row.action; delete row._token;
      delete row.band_name; delete row.bandName;
      var { data, error } = await sb.from(table).insert(row).select().single();
      if (error) throw error;
      return { success: true, data: toCamel(data) };
    }

    async function doUpdate(table, id, payload) {
      if (!id) return { success: false, message: 'ไม่พบ id' };
      var row = toSnakeObj(payload);
      delete row.action; delete row._token;
      // Remove ID-like keys that are used for matching, not for updating columns
      delete row.id; delete row.song_id; delete row.songId;
      delete row.band_name; delete row.bandName;
      row.updated_at = new Date().toISOString();
      var { data, error } = await sb.from(table).update(row).eq('id', id).select();
      if (error) throw error;
      // Supabase returns empty array (no error) when RLS blocks or session expired.
      // Auto-refresh token and retry once before reporting failure.
      if (!data || data.length === 0) {
        try {
          var { error: refErr } = await sb.auth.refreshSession();
          if (!refErr) {
            var { data: data2, error: err2 } = await sb.from(table).update(row).eq('id', id).select();
            if (!err2 && data2 && data2.length > 0) {
              return { success: true, data: toCamel(data2[0]) };
            }
          }
        } catch(e) {}
        return { success: false, message: 'บันทึกไม่สำเร็จ — กรุณากด "ลองใหม่" หรือ refresh หน้าและ login ใหม่ (session หมดอายุ หรือสิทธิ์ไม่เพียงพอ)' };
      }
      return { success: true, data: toCamel(data[0]) };
    }

    async function doUploadEquipmentImage(d) {
      var file = d.file;
      if (!file) return { success: false, message: 'ไม่พบไฟล์รูป' };
      var ext = file.name.split('.').pop().toLowerCase();
      var bandId = getBandId();
      var equipId = d.equipmentId || ('new_' + Date.now());
      var path = bandId + '/' + equipId + '/' + Date.now() + '.' + ext;
      var { error: upErr } = await sb.storage.from('equipment-images').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      var { data: urlData } = sb.storage.from('equipment-images').getPublicUrl(path);
      return { success: true, imageUrl: urlData.publicUrl };
    }

    async function doDelete(table, id) {
      if (!id) return { success: false, message: 'ไม่พบ id' };
      var { error } = await sb.from(table).delete().eq('id', id);
      if (error) throw error;
      return { success: true };
    }

    // ── Auth ─────────────────────────────────────────────────────
    async function doLogin(d) {
      var { data, error } = await sb.auth.signInWithPassword({
        email: d.email, password: d.password
      });
      if (error) return { success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };

      // ดึง profile
      var { data: profile } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
      // ดึง band_plan จาก bands table (free | lite | pro)
      if (profile && profile.band_id) {
        var { data: bandRow } = await sb.from('bands').select('band_plan').eq('id', profile.band_id).single();
        if (bandRow) profile.band_plan = bandRow.band_plan || 'free';
      }
      // plan_override รายคน (admin กำหนด) — เลือก rank สูงกว่า
      if (profile && profile.plan_override) {
        var _rank = { free: 0, lite: 1, pro: 2 };
        if ((_rank[profile.plan_override] || 0) >= (_rank[profile.band_plan || 'free'] || 0)) {
          profile.band_plan  = profile.plan_override;
          profile.plan_scope = 'override';
        }
      }
      saveSession(data.session, profile || {});
      var p = profile || {};
      var displayName = p.nickname || p.first_name || p.user_name || d.email.split('@')[0];
      return {
        success:    true,
        token:      data.session.access_token,
        userName:   displayName,
        userTitle:  p.title      || '',
        firstName:  p.first_name || '',
        lastName:   p.last_name  || '',
        nickname:   p.nickname   || '',
        instrument: p.instrument || '',
        bandId:     p.band_id    || '',
        bandName:   p.band_name  || '',
        role:       p.role       || 'member'
      };
    }

    async function doRegister(d) {
      var meta = {
        user_name:  d.nickname || d.firstName || d.name || d.email.split('@')[0],
        title:      d.title      || '',
        first_name: d.firstName  || '',
        last_name:  d.lastName   || '',
        nickname:   d.nickname   || '',
        instrument: d.instrument || '',
        band_name:  d.bandName   || '',
        role:       'member'
      };

      var { data, error } = await sb.auth.signUp({
        email: d.email, password: d.password,
        options: { data: meta }
      });
      if (error) return { success: false, message: error.message };

      // ต้องมี invite code เสมอ (สมัครผ่านรหัสวง)
      if (d.inviteCode && d.inviteCode.trim() && data.user) {
        var { data: result, error: rErr } = await sb.rpc('redeem_invite_code', {
          p_code:    d.inviteCode.toUpperCase(),
          p_user_id: data.user.id
        });
        if (rErr || !result.success) {
          // ลบ user ที่สร้างไปแล้ว
          await sb.auth.admin.deleteUser(data.user.id).catch(function(){});
          return { success: false, message: (result && result.message) || 'รหัสวงไม่ถูกต้อง' };
        }
        var provincePart = result.province ? ' (' + result.province + ')' : '';
        return { success: true, message: 'สมัครสำเร็จ! ส่งคำขอเข้าร่วมวง ' + result.band_name + provincePart + ' แล้ว รอผู้จัดการวงอนุมัติ' };
      }

      return { success: false, message: 'กรุณากรอกรหัสวง' };
    }

    // ── Register for band creation request (ขอสร้างวงใหม่) ─────────
    async function doRegisterBandRequest(d) {
      var meta = {
        user_name:  d.nickname || d.firstName || d.name || d.email.split('@')[0],
        title:      d.title      || '',
        first_name: d.firstName  || '',
        last_name:  d.lastName   || '',
        nickname:   d.nickname   || '',
        instrument: d.instrument || '',
        band_name:  d.bandName   || '',
        role:       'manager'
      };

      var { data, error } = await sb.auth.signUp({
        email: d.email, password: d.password,
        options: { data: meta }
      });
      if (error) return { success: false, message: error.message };
      if (!data.user) return { success: false, message: 'ไม่สามารถสร้างบัญชีได้' };

      // ส่งคำขอสร้างวง
      var fullName = (d.title && d.title !== 'ไม่ระบุ' ? d.title + ' ' : '') + (d.firstName || '') + ' ' + (d.lastName || '');
      var { data: result, error: rErr } = await sb.rpc('submit_band_request', {
        p_user_id:      data.user.id,
        p_band_name:    d.bandName || '',
        p_province:     d.province || '',
        p_member_count: parseInt(d.memberCount) || 1,
        p_name:         fullName.trim(),
        p_email:        d.email
      });
      if (rErr) return { success: false, message: rErr.message };
      return result;
    }

    async function doLogout() {
      await sb.auth.signOut();
      clearSession();
      return { success: true };
    }

    // ── Artists (Master) ──────────────────────────────────────────
    async function doGetArtists() {
      var { data, error } = await sb.from('artists').select('id, name').order('name');
      if (error) throw error;
      return { success: true, data: data || [] };
    }

    async function doGetSongArtists(d) {
      var source = d.source || 'global';
      if (source === 'band') {
        var bandId = getBandId();
        var all = [];
        var { data: refs } = await sb.from('band_song_refs')
          .select('band_songs!inner(artist)').eq('band_id', bandId);
        (refs || []).forEach(function(r) { if (r.band_songs && r.band_songs.artist) all.push(r.band_songs.artist); });
        var { data: owned } = await sb.from('band_songs')
          .select('artist').eq('band_id', bandId);
        (owned || []).forEach(function(s) { if (s.artist) all.push(s.artist); });
        var unique = Array.from(new Set(all)).sort();
        return { success: true, data: unique };
      }
      // global: collect distinct artists from global songs
      var artists = [];
      var gFrom = 0;
      var BATCH = 1000;
      while (true) {
        var { data: chunk, error: cErr } = await sb.from('band_songs')
          .select('artist').is('band_id', null)
          .not('artist', 'is', null)
          .order('artist')
          .range(gFrom, gFrom + BATCH - 1);
        if (cErr) throw cErr;
        if (!chunk || chunk.length === 0) break;
        chunk.forEach(function(s) { if (s.artist) artists.push(s.artist); });
        if (chunk.length < BATCH) break;
        gFrom += BATCH;
      }
      var unique = Array.from(new Set(artists)).sort();
      return { success: true, data: unique };
    }

    async function doAddArtist(d) {
      var { data, error } = await sb.rpc('add_artist', { p_name: (d.name || '').trim() });
      if (error) throw error;
      return data || { success: false, message: 'ไม่มีผลลัพธ์' };
    }

    async function doEnsureArtist(d) {
      var name = (d.name || '').trim();
      if (!name) return { success: true };
      var { error } = await sb.rpc('ensure_artist', { p_name: name });
      if (error) throw error;
      return { success: true };
    }

    async function doUpdateArtist(d) {
      var { error } = await sb.from('artists').update({ name: (d.name || '').trim() }).eq('id', d.artistId);
      if (error) throw error;
      return { success: true };
    }

    async function doDeleteArtist(d) {
      var { error } = await sb.from('artists').delete().eq('id', d.artistId);
      if (error) throw error;
      return { success: true };
    }

    async function doCleanupOrphanArtists() {
      // Get all distinct artist names currently in band_songs
      var { data: songRows, error: e1 } = await sb.from('band_songs').select('artist').not('artist', 'is', null).neq('artist', '');
      if (e1) throw e1;
      var usedNames = new Set((songRows || []).map(function(r) { return (r.artist || '').trim().toLowerCase(); }).filter(Boolean));
      // Get all artists
      var { data: artistRows, error: e2 } = await sb.from('artists').select('id, name');
      if (e2) throw e2;
      var toDelete = (artistRows || []).filter(function(a) { return !usedNames.has((a.name || '').trim().toLowerCase()); });
      for (var i = 0; i < toDelete.length; i++) {
        await sb.from('artists').delete().eq('id', toDelete[i].id);
      }
      return { success: true, deleted: toDelete.length };
    }

    async function doSearchArtists(d) {
      var { data, error } = await sb.rpc('search_artists', { p_query: d.query || '', p_limit: d.limit || 20 });
      if (error) throw error;
      return data || { success: true, data: [] };
    }

    // ── Songs ─────────────────────────────────────────────────────
    async function doGetAllSongs(d) {
      var source = d.source || 'global';
      var PAGE = 500;

      if (source === 'band') {
        // Reference-based: get refs joined with global songs + band-owned songs
        var bandId = d.bandId || getBandId();
        var all = [];

        // 1. Referenced global songs
        var { data: refs, error: refErr } = await sb.from('band_song_refs')
          .select('song_id, band_songs!inner(id, name, artist, key, bpm, singer, era, mood, tags, notes, source, created_at, updated_at)')
          .eq('band_id', bandId);
        if (refErr) throw refErr;
        (refs || []).forEach(function(r) {
          var s = r.band_songs;
          if (s) { s.lib_type = 'ref'; all.push(s); }
        });

        // 2. Band-owned songs
        var { data: owned, error: ownErr } = await sb.from('band_songs')
          .select('*').eq('band_id', bandId);
        if (ownErr) throw ownErr;
        (owned || []).forEach(function(s) { s.lib_type = 'owned'; all.push(s); });

        all.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
        return { success: true, data: toCamelList(all) };
      }

      // Global songs (unchanged)
      var all = [];
      var from = 0;
      while (true) {
        var q = sb.from('band_songs').select('*').order('name').range(from, from + PAGE - 1);
        q = q.is('band_id', null);
        var { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return { success: true, data: toCamelList(all) };
    }

    async function doGetSongsPage(d) {
      var page    = d.page || 1;
      var perPage = Math.min(d.perPage || 30, 500);
      var search  = (d.search || '').trim();
      var source  = d.source || 'global';
      var singer  = d.singer || '';
      var era     = d.era    || '';
      var genre   = d.genre  || '';
      var mood    = d.mood   || '';
      var artist = d.artist || '';
      var sortKey = d.sortKey || 'name';
      var sortAsc = d.sortAsc !== false;

      var SORT_OK = ['name','artist','bpm','singer','era','tags','mood','key','created_at','updated_at'];
      if (SORT_OK.indexOf(sortKey) < 0) sortKey = 'name';

      var from = (page - 1) * perPage;
      var to   = from + perPage - 1;

      if (source === 'band') {
        // Reference-based: get refs + owned, then filter/sort/paginate client-side
        var bandId = getBandId();
        var all = [];

        // 1. Referenced global songs
        var { data: refs, error: refErr } = await sb.from('band_song_refs')
          .select('song_id, band_songs!inner(id, name, artist, key, bpm, singer, era, mood, tags, notes, source, created_at, updated_at)')
          .eq('band_id', bandId);
        if (refErr) throw refErr;
        (refs || []).forEach(function(r) {
          var s = r.band_songs;
          if (s) { s.lib_type = 'ref'; all.push(s); }
        });

        // 2. Band-owned songs
        var { data: owned, error: ownErr } = await sb.from('band_songs')
          .select('*').eq('band_id', bandId);
        if (ownErr) throw ownErr;
        (owned || []).forEach(function(s) { s.lib_type = 'owned'; all.push(s); });

        // Apply filters client-side
        if (search) {
          var sl = search.toLowerCase();
          all = all.filter(function(s) {
            return (s.name || '').toLowerCase().indexOf(sl) >= 0 ||
                   (s.artist || '').toLowerCase().indexOf(sl) >= 0 ||
                   (s.key || '').toLowerCase().indexOf(sl) >= 0;
          });
        }
        if (singer) {
          var singerMap = { 'ชาย': ['ชาย','male'], 'หญิง': ['หญิง','female'], 'คู่': ['คู่','duet','ชาย/หญิง'] };
          var vals = singerMap[singer] || [singer];
          all = all.filter(function(s) { return vals.indexOf(s.singer) >= 0; });
        }
        if (era)   all = all.filter(function(s) { return s.era === era; });
        if (genre) all = all.filter(function(s) { return s.tags === genre; });
        if (mood)  all = all.filter(function(s) { return (s.mood || '').indexOf(mood) >= 0; });
        if (artist) all = all.filter(function(s) { return s.artist === artist; });

        // Sort
        all.sort(function(a, b) { return (a[sortKey] || '').toString().localeCompare((b[sortKey] || '').toString()); });
        if (!sortAsc) all.reverse();

        var total = all.length;
        var sliced = all.slice(from, from + perPage);
        return { success: true, data: toCamelList(sliced), total: total };
      }

      // Global songs (server-side pagination)
      var q = sb.from('band_songs')
        .select('*', { count: 'exact' })
        .order(sortKey, { ascending: sortAsc })
        .range(from, to)
        .is('band_id', null);

      if (search) {
        var s = search.replace(/[,.()'"\\]/g, '');
        if (s) q = q.or('name.ilike.%' + s + '%,artist.ilike.%' + s + '%,key.ilike.%' + s + '%');
      }

      if (singer) {
        if (singer === 'ชาย')       q = q.in('singer', ['ชาย', 'male']);
        else if (singer === 'หญิง') q = q.in('singer', ['หญิง', 'female']);
        else if (singer === 'คู่')  q = q.in('singer', ['คู่', 'duet', 'ชาย/หญิง']);
        else q = q.eq('singer', singer);
      }

      if (era)   q = q.eq('era', era);
      if (genre) q = q.eq('tags', genre);
      if (mood)  q = q.ilike('mood', '%' + mood + '%');
      if (artist) q = q.eq('artist', artist);

      var { data, error, count } = await q;
      if (error) throw error;

      return { success: true, data: toCamelList(data || []), total: count || 0 };
    }

    async function doSearchSongs(d) {
      var term = (d.query || '').trim();
      var bandId = getBandId();
      var all = [];

      // 1. Referenced global songs matching term
      var { data: refs } = await sb.from('band_song_refs')
        .select('song_id, band_songs!inner(name, key, bpm, singer, artist)')
        .eq('band_id', bandId);
      (refs || []).forEach(function(r) {
        var s = r.band_songs;
        if (s && (s.name || '').toLowerCase().indexOf(term.toLowerCase()) >= 0) all.push(s);
      });

      // 2. Band-owned songs
      var { data: owned, error } = await sb.from('band_songs')
        .select('name, key, bpm, singer, artist')
        .eq('band_id', bandId)
        .ilike('name', '%' + term + '%')
        .order('name')
        .limit(10);
      if (error) throw error;
      all = all.concat(owned || []);

      // Sort + limit
      all.sort(function(a, b) { return (a.name || '').localeCompare(b.name || ''); });
      if (all.length > 10) all = all.slice(0, 10);
      return { success: true, data: toCamelList(all) };
    }

    // ── Band Members ──────────────────────────────────────────────
    async function doGetBandMembers() {
      var { data, error } = await sb.from('band_members')
        .select('*')
        .eq('band_id', getBandId())
        .order('name');
      if (error) throw error;
      return { success: true, data: toCamelList(data) };
    }

    // ── Band Profiles (registered members) ─────────────────────────
    async function doGetBandProfiles(d) {
      var bandId = d.bandId || getBandId();
      // ใช้ RPC (SECURITY DEFINER) เพื่อ bypass RLS — แก้ปัญหาสมาชิกไม่แสดง
      try {
        var { data: rpcData, error: rpcErr } = await sb.rpc('get_band_profiles', { p_band_id: bandId });
        if (!rpcErr && rpcData) return { success: true, data: rpcData };
      } catch(e) { /* fallback to direct query */ }
      // Fallback: direct query (ต้องมี RLS policy สำหรับวงเดียวกัน)
      var { data, error } = await sb.from('profiles')
        .select('id, email, user_name, nickname, first_name, last_name, instrument, phone, role, status, title, band_id, band_name, payment_method, payment_account, created_at')
        .eq('band_id', bandId)
        .eq('status', 'active')
        .neq('role', 'pending')
        .order('role')
        .order('nickname');
      if (error) throw error;
      return { success: true, data: data || [] };
    }

    // ── Attendance ────────────────────────────────────────────────
    async function doGetAttendance(d) {
      var bandId   = d.bandId || getBandId();
      var year     = d.year   || String(new Date().getFullYear());
      var page     = Math.max(1, parseInt(d.page)     || 1);
      var pageSize = Math.min(200, parseInt(d.pageSize) || 50);

      var q = sb.from('attendance_payroll').select('*', { count: 'exact' })
        .eq('band_id', bandId)
        .order('date', { ascending: false });

      if (year && year !== 'all') q = q.like('date', year + '%');
      if (d.startDate) q = q.gte('date', d.startDate);
      if (d.endDate)   q = q.lte('date', d.endDate);

      var from = (page - 1) * pageSize;
      q = q.range(from, from + pageSize - 1);

      var { data, error, count } = await q;
      if (error) throw error;
      var totalPages = Math.ceil((count || 0) / pageSize) || 1;
      return { success: true, data: toCamelList(data), total: count, page: page, pageSize: pageSize, totalPages: totalPages, year: year };
    }

    // ── Leave Request ─────────────────────────────────────────────
    async function doRequestLeave(d) {
      var { data: authUser } = await sb.auth.getUser();
      var memberId = d.memberId || (authUser && authUser.user && authUser.user.id) || '';
      var memberName = d.memberName || '';
      if (!memberName && authUser && authUser.user) {
        var meta = authUser.user.user_metadata || {};
        memberName = meta.nickname || meta.first_name || authUser.user.email || '';
      }
      // Parse and validate slots — if empty, try to infer from band schedule
      var _rawSlots = d.slots || '[]';
      var _parsedSlots = [];
      try { _parsedSlots = typeof _rawSlots === 'string' ? JSON.parse(_rawSlots) : (_rawSlots || []); } catch(e) {}
      if (!_parsedSlots.length) {
        // Infer from band_settings schedule for this date's day-of-week
        try {
          var _bId = d.bandId || getBandId();
          var _bsRes = await sb.from('band_settings').select('settings').eq('band_id', _bId).single();
          if (_bsRes.data && _bsRes.data.settings) {
            var _sch = _bsRes.data.settings.scheduleData || _bsRes.data.settings.schedule || {};
            var _dow = new Date(d.date || new Date().toISOString().slice(0, 10)).getDay();
            var _dayData = _sch[_dow] || _sch[String(_dow)];
            if (Array.isArray(_dayData)) {
              _parsedSlots = _dayData.map(function(s) { return (s.startTime||'') + '-' + (s.endTime||''); });
            } else if (_dayData && _dayData.timeSlots) {
              _parsedSlots = _dayData.timeSlots.map(function(s) { return (s.startTime||'') + '-' + (s.endTime||''); });
            }
          }
        } catch(e) { /* schedule lookup failed, proceed with empty */ }
      }
      var row = {
        band_id: d.bandId || getBandId(),
        member_id: memberId,
        member_name: memberName,
        date: d.date || new Date().toISOString().slice(0, 10),
        venue: d.venue || '',
        slots: _parsedSlots.length ? JSON.stringify(_parsedSlots) : (d.slots || '[]'),
        reason: d.reason || 'ลางาน',
        substitute_name: d.substituteName || '',
        substitute_contact: d.substituteContact || '',
        status: 'pending'
      };
      // Upsert: ถ้ามี leave_request เดิมของ member+date → update แทน insert (ป้องกันซ้ำ)
      var { data: existLR } = await sb.from('leave_requests')
        .select('id').eq('band_id', row.band_id)
        .eq('member_id', row.member_id).eq('date', row.date).limit(1);
      var data, error;
      if (existLR && existLR.length > 0) {
        var res = await sb.from('leave_requests').update(row).eq('id', existLR[0].id).select().single();
        data = res.data; error = res.error;
      } else {
        var res = await sb.from('leave_requests').insert(row).select().single();
        data = res.data; error = res.error;
      }
      if (error) throw error;

      // ── Auto check-in as "leave" so no separate check-in needed ──
      var slotsArr = [];
      try { slotsArr = typeof row.slots === 'string' ? JSON.parse(row.slots || '[]') : (row.slots || []); } catch(e){}
      var ciRow = {
        band_id:     row.band_id,
        member_id:   row.member_id,
        member_name: row.member_name,
        date:        row.date,
        venue:       row.venue || '',
        slots:       slotsArr,
        check_in_at: new Date().toISOString(),
        status:      'leave',
        notes:       row.reason + (row.substitute_name ? ' | คนแทน: ' + row.substitute_name : ''),
        substitute:  row.substitute_name ? { name: row.substitute_name, contact: row.substitute_contact || '' } : null
      };
      var { data: existCI } = await sb.from('member_check_ins')
        .select('id').eq('band_id', ciRow.band_id)
        .eq('member_id', ciRow.member_id).eq('date', ciRow.date).limit(1);
      if (existCI && existCI.length > 0) {
        var { error: ciUpErr } = await sb.from('member_check_ins').update(ciRow).eq('id', existCI[0].id);
        if (ciUpErr) console.warn('[doRequestLeave] auto check-in update error:', ciUpErr.message);
      } else {
        var { error: ciInsErr } = await sb.from('member_check_ins').insert(ciRow);
        if (ciInsErr) console.warn('[doRequestLeave] auto check-in insert error:', ciInsErr.message);
      }

      return { success: true, data: toCamel(data) };
    }

    // ── Check-in ──────────────────────────────────────────────────
    async function doMemberCheckIn(d) {
      var { data: authUser } = await sb.auth.getUser();
      var memberId = d.memberId || (authUser && authUser.user && authUser.user.id) || '';
      if (!memberId) return { success: false, message: 'ไม่พบข้อมูลผู้ใช้ กรุณาล็อกอินใหม่' };
      var dateStr = d.date || new Date().toISOString().slice(0, 10);
      var bandId = d.bandId || getBandId();

      var { data: exist } = await sb.from('member_check_ins')
        .select('id').eq('band_id', bandId)
        .eq('member_id', memberId).eq('date', dateStr).limit(1);
      // Substitute info
      var subInfo = null;
      if (d.isSubstitute && d.substituteName) {
        subInfo = { name: d.substituteName, contact: d.substituteContact || '' };
      }

      if (exist && exist.length > 0) {
        // อัปเดตแทน insert ถ้ามีอยู่แล้ว
        var upPayload = {
          venue:       d.venue || '',
          slots:       d.slots || [],
          status:      'pending',
          check_in_at: new Date().toISOString()
        };
        if (subInfo) upPayload.substitute = subInfo;
        if (d.notes) upPayload.notes = d.notes;
        var { error: upErr } = await sb.from('member_check_ins').update(upPayload).eq('id', exist[0].id);
        if (upErr) throw upErr;
        return { success: true, message: subInfo ? 'ลงเวลาแทน ' + subInfo.name + ' เรียบร้อย' : 'อัปเดตเวลาเรียบร้อย' };
      }

      var insertPayload = {
        band_id:     bandId,
        member_id:   memberId,
        member_name: d.memberName || localStorage.getItem('userName') || '',
        date:        dateStr,
        venue:       d.venue || '',
        slots:       d.slots || [],
        check_in_at: new Date().toISOString(),
        status:      'pending'
      };
      if (subInfo) insertPayload.substitute = subInfo;
      if (d.notes) insertPayload.notes = d.notes;
      var { data, error } = await sb.from('member_check_ins').insert(insertPayload).select().single();
      if (error) throw error;
      return { success: true, data: toCamel(data) };
    }

    async function doGetMyCheckIn(d) {
      var { data: authUser } = await sb.auth.getUser();
      var memberId = d.memberId || (authUser && authUser.user && authUser.user.id) || '';
      if (!memberId) return { success: false };
      var dateStr = d.date || new Date().toISOString().slice(0, 10);
      var bandId = d.bandId || getBandId();
      var { data } = await sb.from('member_check_ins')
        .select('*').eq('band_id', bandId)
        .eq('member_id', memberId).eq('date', dateStr).limit(1);
      if (data && data.length > 0) {
        var row = toCamel(data[0]);
        return { success: true, checkIn: { id: row.id, venue: row.venue || '', slots: row.slots || [], status: row.status || 'pending', notes: row.notes || '', checkInAt: row.checkInAt || '', substitute: row.substitute || null } };
      }
      return { success: false };
    }

    async function doCancelCheckIn(d) {
      var { data: authUser } = await sb.auth.getUser();
      var memberId = d.memberId || (authUser && authUser.user && authUser.user.id) || '';
      if (!memberId) return { success: false, message: 'ไม่พบข้อมูลผู้ใช้' };
      var dateStr = d.date || new Date().toISOString().slice(0, 10);
      var bandId = d.bandId || getBandId();
      var { error } = await sb.from('member_check_ins')
        .delete().eq('band_id', bandId)
        .eq('member_id', memberId).eq('date', dateStr);
      if (error) throw error;
      // Also delete any leave_requests for same date
      await sb.from('leave_requests')
        .delete().eq('band_id', bandId)
        .eq('member_id', memberId).eq('date', dateStr);
      return { success: true, message: 'ยกเลิกการลงเวลาเรียบร้อย' };
    }

    // ── Schedule ──────────────────────────────────────────────────
    async function doGetSchedule(d) {
      var bandId = d.bandId || getBandId();
      var year   = d.year   || String(new Date().getFullYear());
      var q = sb.from('schedule').select('*').eq('band_id', bandId).order('date');
      if (year && year !== 'all') q = q.like('date', year + '%');
      var { data, error } = await q.limit(500);
      if (error) throw error;
      return { success: true, data: toCamelList(data) };
    }

    async function doSaveSchedule(d) {
      var bandId = d.bandId || getBandId();
      var items  = d.scheduleData || [];
      // ลบของเดิม
      await sb.from('schedule').delete().eq('band_id', bandId);
      // insert ใหม่
      if (items.length > 0) {
        var rows = items.map(function (item) {
          var row = Object.assign({ band_id: bandId }, toSnakeObj(item));
          // ลบ id ที่ frontend สร้างเอง (เช่น gig_xxx) — ให้ DB สร้าง uuid ใหม่
          if (row.id && typeof row.id === 'string' && !/^[0-9a-f]{8}-/.test(row.id)) delete row.id;
          // ลบ field ที่ DB สร้างเอง
          delete row.created_at;
          delete row.updated_at;
          return row;
        });
        var { error } = await sb.from('schedule').insert(rows);
        if (error) throw error;
      }
      return { success: true, message: 'บันทึกตารางงานเรียบร้อย' };
    }

    // ── Band Settings ─────────────────────────────────────────────
    // ── Dashboard Summary ─────────────────────────────────────────
    async function doGetDashboardSummary() {
      var bandId = getBandId();
      var today = new Date().toISOString().split('T')[0];

      var [memberRes, jobRes, upcomingRes, quotRes, fundRes] = await Promise.all([
        sb.from('band_members').select('id', { count: 'exact', head: true }).eq('band_id', bandId),
        sb.from('schedule').select('id,venue_name,date,type').eq('band_id', bandId).gte('date', today).order('date', { ascending: true }).limit(5),
        sb.from('schedule').select('id', { count: 'exact', head: true }).eq('band_id', bandId).gte('date', today),
        sb.from('quotations').select('id', { count: 'exact', head: true }).eq('band_id', bandId),
        sb.from('fund_transactions').select('amount,type').eq('band_id', bandId)
      ]);

      // Calculate all-time income/expense from fund_transactions (same as band-fund.html)
      var income = 0, expense = 0;
      (fundRes.data || []).forEach(function(r) {
        if (r.type === 'income') income += (r.amount || 0);
        else expense += (r.amount || 0);
      });

      return {
        success: true,
        data: {
          memberCount:    memberRes.count  || 0,
          upcomingJobs:   upcomingRes.count || 0,
          revenueMonth:   income,
          quotationCount: quotRes.count    || 0,
          jobs: (jobRes.data || []).map(function(j) {
            return { date: j.date, venue: j.venue_name || '', band: '', type: j.type || '' };
          }),
          finance: { income: income, expense: expense, fund: income - expense }
        }
      };
    }

    async function doGetBandSettings(bandId) {
      var { data } = await sb.from('band_settings').select('settings').eq('band_id', bandId || getBandId()).single();
      return { success: true, data: (data && data.settings) || {} };
    }

    async function doSaveBandSettings(d) {
      var bandId = d.bandId || getBandId();
      var settings = Object.assign({}, d);
      delete settings.bandId; delete settings.action; delete settings._token;
      var { error } = await sb.from('band_settings').upsert({ band_id: bandId, settings: settings, updated_at: new Date().toISOString() }, { onConflict: 'band_id' });
      if (error) throw error;
      // Sync band_name to bands table + profiles
      if (d.bandName) {
        await sb.from('bands').update({ band_name: d.bandName }).eq('id', bandId);
        await sb.from('profiles').update({ band_name: d.bandName }).eq('band_id', bandId);
        localStorage.setItem('bandName', d.bandName);
      }
      return { success: true };
    }

    // ── Band Code (รหัสประจำวง) ─────────────────────────────────
    async function doGetBandCode(d) {
      var bandId = d.bandId || getBandId();
      var { data, error } = await sb.from('invite_codes')
        .select('code')
        .eq('band_id', bandId)
        .eq('status', 'permanent')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data && data.code) {
        return { success: true, code: data.code };
      }
      return { success: false };
    }

    async function doGenerateInviteCode(d) {
      var bandId   = d.bandId   || getBandId();
      var bandName = d.bandName || localStorage.getItem('bandName') || '';
      var province = d.province || localStorage.getItem('bandProvince') || '';
      var { data, error } = await sb.rpc('generate_band_code', {
        p_band_id:   bandId,
        p_band_name: bandName,
        p_province:  province
      });
      if (error) throw error;
      return { success: true, data: data };
    }

    async function doLookupInviteCode(d) {
      var code = (d.code || '').toUpperCase();
      if (!code) return { success: false, message: 'ไม่มีรหัส' };
      var { data, error } = await sb.rpc('lookup_invite_code', { p_code: code });
      if (error) return { success: false, message: error.message };
      if (!data || !data.success) return { success: false, message: (data && data.message) || 'รหัสวงไม่ถูกต้อง' };
      return { success: true, band_name: data.band_name, province: data.province, member_count: data.member_count };
    }

    // ── Band Requests (ขอสร้างวงใหม่) ─────────────────────────
    async function doGetPendingBandRequests() {
      var { data, error } = await sb.rpc('get_pending_band_requests');
      if (error) throw error;
      return { success: true, data: data || [] };
    }

    async function doApproveBandRequest(d) {
      var { data, error } = await sb.rpc('approve_band_request', {
        p_request_id: d.requestId
      });
      if (error) throw error;
      return data;
    }

    async function doRejectBandRequest(d) {
      var { data, error } = await sb.rpc('reject_band_request', {
        p_request_id: d.requestId,
        p_notes: d.notes || ''
      });
      if (error) throw error;
      return data;
    }

    // ── Pending Members (อนุมัติสมาชิก) ──────────────────────────
    async function doGetPendingMembers(d) {
      var bandId = d.bandId || getBandId();
      var { data, error } = await sb.rpc('get_pending_members', { p_band_id: bandId });
      if (error) throw error;
      return { success: true, data: data || [] };
    }

    async function doApproveMember(d) {
      var bandId = d.bandId || getBandId();
      var { data, error } = await sb.rpc('approve_member', { p_user_id: d.userId, p_band_id: bandId });
      if (error) throw error;
      return data;
    }

    async function doRejectMember(d) {
      var bandId = d.bandId || getBandId();
      var { data, error } = await sb.rpc('reject_member', { p_user_id: d.userId, p_band_id: bandId });
      if (error) throw error;
      return data;
    }

    async function doRemoveMember(d) {
      if (!d.userId) return { success: false, message: 'ไม่ระบุสมาชิก' };
      var { data, error } = await sb.from('profiles').update({ band_id: null, band_name: null, role: 'member', status: 'inactive', updated_at: new Date().toISOString() }).eq('id', d.userId).select().single();
      if (error) throw error;
      return { success: true, data: toCamel(data), message: 'ลบสมาชิกออกจากวงเรียบร้อย' };
    }

    // ── Password Reset ──────────────────────────────────────────
    async function doRequestPasswordReset(d) {
      var email = (d.email || '').trim();
      if (!email) return { success: false, message: 'กรุณากรอกอีเมล' };
      var siteUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
      var { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: siteUrl + 'reset-password.html'
      });
      if (error) return { success: false, message: error.message };
      return { success: true, message: 'ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว กรุณาตรวจสอบกล่องจดหมาย' };
    }

    async function doResetPassword(d) {
      var newPassword = (d.newPassword || '').trim();
      if (!newPassword || newPassword.length < 6) return { success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' };
      var { error } = await sb.auth.updateUser({ password: newPassword });
      if (error) return { success: false, message: error.message };
      return { success: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อย' };
    }

    // ── Lookup Email (ลืมอีเมล) ──────────────────────────────────
    async function doLookupEmail(d) {
      var name  = (d.name  || '').trim().toLowerCase();
      var phone = (d.phone || '').trim().replace(/[^0-9]/g, '');
      if (!name && !phone) return { success: false, message: 'กรุณากรอกชื่อหรือเบอร์โทร' };
      var { data, error } = await sb.rpc('lookup_email', { p_name: name, p_phone: phone });
      if (error) return { success: false, message: error.message };
      if (!data || data.length === 0) return { success: false, message: 'ไม่พบข้อมูลที่ตรงกัน กรุณาตรวจสอบอีกครั้ง' };
      return { success: true, results: data };
    }

    // ── Profile ───────────────────────────────────────────────────
    async function doGetMyProfile() {
      var { data: user } = await sb.auth.getUser();
      if (!user || !user.user) return { success: false, message: 'ไม่ได้ login' };
      var { data, error } = await sb.from('profiles').select('*').eq('id', user.user.id).single();
      if (error) throw error;
      return { success: true, data: toCamel(data) };
    }

    // ── Sync Band Plan — ดึง band_plan ล่าสุดจาก DB แล้วอัปเดต localStorage ──
    async function doSyncBandPlan() {
      var bandId = getBandId();
      if (!bandId) return { success: false, message: 'no band' };
      var { data: bandRow, error } = await sb.from('bands').select('band_plan').eq('id', bandId).single();
      if (error || !bandRow) return { success: false };
      var bandPlan = bandRow.band_plan || 'free';

      // Check plan_override (per-user override from admin)
      var override = localStorage.getItem('plan_override') || '';
      var finalPlan = bandPlan;
      if (override) {
        var _rank = { free: 0, lite: 1, pro: 2 };
        if ((_rank[override] || 0) >= (_rank[bandPlan] || 0)) {
          finalPlan = override;
        }
      }

      var oldPlan = localStorage.getItem('band_plan') || 'free';
      if (oldPlan !== finalPlan) {
        localStorage.setItem('band_plan', finalPlan);
        if (finalPlan !== 'free') localStorage.removeItem('ad_gate_ts');
      }
      return { success: true, plan: finalPlan, changed: oldPlan !== finalPlan };
    }

    async function doUpdateMyProfile(d) {
      var { data: user } = await sb.auth.getUser();
      if (!user || !user.user) return { success: false, message: 'ไม่ได้ login' };
      var uid = user.user.id;

      var row = {
        title:           d.title          || '',
        first_name:      d.firstName      || '',
        last_name:       d.lastName       || '',
        nickname:        d.nickname        || '',
        instrument:      d.instrument      || '',
        phone:           d.phone           || '',
        id_card_number:  d.idCardNumber    || '',
        birth_date:      d.birthDate       || null,
        payment_method:  d.paymentMethod   || '',
        payment_account: d.paymentAccount  || '',
        id_card_address: d.idCardAddress   || {},
        current_address: d.currentAddress  || {},
        updated_at: new Date().toISOString()
      };
      if (d.nickname) row.user_name = d.nickname;

      var { data, error } = await sb.from('profiles').update(row).eq('id', uid).select().single();
      if (error) throw error;

      localStorage.setItem('userTitle',      row.title);
      localStorage.setItem('userFirstName',  row.first_name);
      localStorage.setItem('userLastName',   row.last_name);
      localStorage.setItem('userNickname',   row.nickname);
      localStorage.setItem('userInstrument', row.instrument);
      if (d.nickname) localStorage.setItem('userName', d.nickname);

      return { success: true, data: toCamel(data), message: 'บันทึกข้อมูลส่วนตัวเรียบร้อย' };
    }

    async function doChangeEmail(d) {
      if (!d.email) return { success: false, message: 'กรุณาระบุอีเมลใหม่' };
      var { data, error } = await sb.auth.updateUser({ email: d.email });
      if (error) throw error;
      return { success: true, message: 'ส่งลิงก์ยืนยันไปยังอีเมลใหม่แล้ว กรุณาตรวจสอบกล่องจดหมาย' };
    }

    async function doChangePassword(d) {
      if (!d.password || d.password.length < 6) return { success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' };
      var { data, error } = await sb.auth.updateUser({ password: d.password });
      if (error) throw error;
      return { success: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' };
    }

    // ── Admin ─────────────────────────────────────────────────────
    async function doVerifyAdmin() {
      var { data, error } = await sb.rpc('verify_admin');
      if (error) throw error;
      return data;
    }

    async function doAdminGetAllUsers() {
      var { data, error } = await sb.from('profiles').select('*').order('created_at');
      if (error) throw error;
      return { success: true, data: toCamelList(data) };
    }

    async function doAdminDeleteUser(userId) {
      var { error } = await sb.rpc('admin_delete_user', { p_user_id: userId });
      if (error) throw error;
      return { success: true };
    }

    async function doSetPlanOverride(d) {
      var val = d.planOverride || null;
      var { error } = await sb.from('profiles').update({ plan_override: val }).eq('id', d.userId);
      if (error) throw error;
      return { success: true };
    }

    async function doGetPromoCodes() {
      var { data, error } = await sb.from('promo_codes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return { success: true, data: data || [] };
    }

    async function doSavePromoCode(d) {
      var payload = {
        code:             (d.code || '').toUpperCase().trim(),
        plan:             d.plan             || 'lite',
        months:           parseInt(d.months) || 1,
        discount_percent: parseInt(d.discount_percent) || 0,
        max_uses:         d.max_uses ? parseInt(d.max_uses) : null,
        expires_at:       d.expires_at || null,
        active:           d.active !== false,
        note:             d.note || ''
      };
      if (!payload.code) return { success: false, message: 'กรุณากรอก Code' };
      var { error } = await sb.from('promo_codes').insert(payload);
      if (error) return { success: false, message: error.message };
      return { success: true };
    }

    async function doDeletePromoCode(d) {
      var { error } = await sb.from('promo_codes').delete().eq('id', d.id);
      if (error) throw error;
      return { success: true };
    }

    async function doValidatePromoCode(d) {
      var code = (d.code || '').toUpperCase().trim();
      if (!code) return { success: false, message: 'กรุณากรอก Code' };
      var { data, error } = await sb.from('promo_codes').select('*').eq('code', code).eq('active', true).maybeSingle();
      if (error || !data) return { success: false, message: 'ไม่พบ Promo Code หรือหมดอายุแล้ว' };
      if (data.expires_at && new Date(data.expires_at) < new Date()) return { success: false, message: 'Promo Code หมดอายุแล้ว' };
      if (data.max_uses != null && data.used_count >= data.max_uses) return { success: false, message: 'Promo Code ถูกใช้ครบจำนวนแล้ว' };
      return { success: true, data: data };
    }

    async function doUsePromoCode(d) {
      // นับ used_count +1 หลังชำระสำเร็จ
      var code = (d.code || '').toUpperCase().trim();
      if (!code) return { success: false };
      var { data: cur } = await sb.from('promo_codes').select('id,used_count').eq('code', code).maybeSingle();
      if (cur) {
        await sb.from('promo_codes').update({ used_count: (cur.used_count || 0) + 1 }).eq('id', cur.id);
      }
      return { success: true };
    }

    async function doGetSystemInfo() {
      var [u, b, sg, s, sub] = await Promise.all([
        sb.from('profiles').select('id',       { count: 'exact', head: true }),
        sb.from('bands').select('id',          { count: 'exact', head: true }),
        sb.from('band_songs').select('id',     { count: 'exact', head: true }),
        sb.from('schedule').select('id',       { count: 'exact', head: true }),
        sb.from('subscriptions').select('id',  { count: 'exact', head: true }),
      ]);
      return { success: true, data: {
        userCount:     u.count   || 0,
        bandCount:     b.count   || 0,
        songCount:     sg.count  || 0,
        scheduleCount: s.count   || 0,
        subsCount:     sub.count || 0,
        serverTime:    new Date().toISOString()
      }};
    }

    // ── Setlist (v2 — per date) ──────────────────────────────────
    async function doGetSetlist(d) {
      var bandId  = d.bandId || getBandId();
      var date    = d.date  || new Date().toISOString().substring(0, 10);
      var { data, error } = await sb.from('setlists')
        .select('*').eq('band_id', bandId).eq('date', date)
        .maybeSingle();
      if (error) throw error;
      return { success: true, data: (data && data.sets_data) || {} };
    }

    async function doSaveSetlist(d) {
      var bandId  = d.bandId || getBandId();
      var date    = d.date   || new Date().toISOString().substring(0, 10);
      var { error } = await sb.from('setlists').upsert({
        band_id:    bandId,
        date:       date,
        sets_data:  d.sets || {},
        updated_at: new Date().toISOString()
      }, { onConflict: 'band_id,date' });
      if (error) throw error;
      return { success: true, message: 'บันทึก Setlist เรียบร้อย' };
    }

    async function doGetScheduleForDate(d) {
      var bandId = d.bandId || getBandId();
      var date   = d.date   || new Date().toISOString().substring(0, 10);
      // ดึงรายการงานทั้งหมดของวงในวันนี้
      var { data, error } = await sb.from('schedule')
        .select('id, venue_name, venue, type, time_slots, start_time, end_time, date')
        .eq('band_id', bandId).eq('date', date);
      if (error) throw error;
      // รวม time_slots จากทุก entry ของวันนั้น
      var slots = [];
      (data || []).forEach(function(row) {
        var ts = row.time_slots;
        if (Array.isArray(ts) && ts.length > 0) {
          ts.forEach(function(s){ slots.push(s); });
        } else if (row.start_time || row.end_time) {
          // external gig — นับเป็น 1 slot
          slots.push((row.start_time || '') + (row.end_time ? '-'+row.end_time : ''));
        }
      });
      return { success: true, slots: slots, schedules: toCamelList(data || []) };
    }

    // ── Playlist History ─────────────────────────────────────────
    async function doSavePlaylistHistory(d) {
      var bandId = d.bandId || getBandId();
      var row = {
        band_id:    bandId,
        band_name:  d.bandName || '',
        date:       d.date || '',
        venue:      d.venue || '',
        time_slot:  d.timeSlot || '',
        playlist:   d.songs || [],
        created_by: localStorage.getItem('userName') || ''
      };
      // ถ้ามีลิสเดิมอยู่ (band+date+venue+time_slot เดิม) ให้ update แทน insert
      var { data: existing } = await sb.from('playlist_history')
        .select('id').eq('band_id', bandId)
        .eq('date', row.date).eq('venue', row.venue).eq('time_slot', row.time_slot)
        .limit(1);
      if (existing && existing.length > 0) {
        var { data, error } = await sb.from('playlist_history')
          .update({ playlist: row.playlist, created_by: row.created_by })
          .eq('id', existing[0].id).select().single();
        if (error) throw error;
        return { success: true, data: toCamel(data) };
      }
      var { data, error } = await sb.from('playlist_history').insert(row).select().single();
      if (error) throw error;
      var insertedId = data.id;
      // Post-insert dedup: concurrent inserts may have created duplicate rows
      // Keep newest (highest created_at), delete the rest
      var { data: dupes } = await sb.from('playlist_history')
        .select('id').eq('band_id', bandId)
        .eq('date', row.date).eq('venue', row.venue).eq('time_slot', row.time_slot)
        .order('created_at', { ascending: false });
      if (dupes && dupes.length > 1) {
        var keepId = dupes[0].id;
        var deleteIds = dupes.slice(1).map(function(x) { return x.id; });
        await sb.from('playlist_history').delete().in('id', deleteIds).eq('band_id', bandId);
        if (keepId !== insertedId) {
          // Our insert was older — fetch the kept row to return correct data
          var { data: kept } = await sb.from('playlist_history').select('*').eq('id', keepId).single();
          if (kept) return { success: true, data: toCamel(kept) };
        }
      }
      return { success: true, data: toCamel(data) };
    }

    async function doGetPlaylistHistory(d) {
      var bandId = d.bandId || getBandId();
      var { data, error } = await sb.from('playlist_history')
        .select('*').eq('band_id', bandId)
        .order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      // map playlist jsonb → songs for frontend compat
      var rows = (data || []).map(function(r) {
        return {
          id: r.id, bandId: r.band_id, bandName: r.band_name,
          date: r.date || '', venue: r.venue || '', timeSlot: r.time_slot || '',
          songs: r.playlist || [], createdBy: r.created_by || '',
          createdAt: r.created_at
        };
      });
      return { success: true, data: rows };
    }

    async function doGetPlaylistHistoryByDate(d) {
      var bandId = d.bandId || getBandId();
      var date = d.date || '';
      if (!date) return { success: true, data: [] };
      var { data, error } = await sb.from('playlist_history')
        .select('*').eq('band_id', bandId).eq('date', date)
        .order('created_at', { ascending: false });
      if (error) throw error;
      var rows = (data || []).map(function(r) {
        return {
          id: r.id, bandId: r.band_id, bandName: r.band_name,
          date: r.date || '', venue: r.venue || '', timeSlot: r.time_slot || '',
          songs: r.playlist || [], createdBy: r.created_by || '',
          createdAt: r.created_at
        };
      });
      return { success: true, data: rows };
    }

    async function doDeletePlaylistHistory(d) {
      var id     = d.id     || null;
      var bandId = d.bandId || getBandId();
      if (!id) return { success: false, message: 'ไม่พบ id' };
      var { error } = await sb.from('playlist_history')
        .delete().eq('id', id).eq('band_id', bandId);
      if (error) throw error;
      return { success: true };
    }

    async function doRemoveSongFromAllHistory(d) {
      var bandId   = d.bandId   || getBandId();
      var songName = (d.songName || '').toLowerCase().trim();
      if (!songName) return { success: false, message: 'ไม่พบชื่อเพลง' };
      var { data, error } = await sb.from('playlist_history')
        .select('id, playlist').eq('band_id', bandId);
      if (error) throw error;
      var toUpdate = [];
      (data || []).forEach(function(row) {
        var pl = row.playlist || [];
        var filtered = pl.filter(function(s) {
          return (s.name || '').toLowerCase().trim() !== songName;
        });
        if (filtered.length !== pl.length) toUpdate.push({ id: row.id, playlist: filtered });
      });
      for (var i = 0; i < toUpdate.length; i++) {
        var { error: ue } = await sb.from('playlist_history')
          .update({ playlist: toUpdate[i].playlist })
          .eq('id', toUpdate[i].id).eq('band_id', bandId);
        if (ue) throw ue;
      }
      return { success: true, updated: toUpdate.length };
    }

    // ── Song Insights (สถิติเพลง) ────────────────────────────────
    async function doGetSongInsights(d) {
      var bandId = d.bandId || getBandId();
      // Fetch playlist_history (all) + band_songs in parallel
      var [histRes, songsRes] = await Promise.all([
        sb.from('playlist_history').select('date, playlist, created_by')
          .eq('band_id', bandId).order('date', { ascending: false }).limit(2000),
        sb.from('band_songs').select('id, name, artist, key, created_at')
          .eq('band_id', bandId).order('name')
      ]);
      if (histRes.error) throw histRes.error;
      if (songsRes.error) throw songsRes.error;
      var history = (histRes.data || []).map(function(r) {
        return { date: r.date || '', songs: r.playlist || [], createdBy: r.created_by || '' };
      });
      var songs = toCamelList(songsRes.data || []);
      return { success: true, data: { history: history, songs: songs } };
    }

    // ── Requested Songs from Live History ──────────────────────────────────
    async function doGetRequestedSongsFromHistory(d) {
      var bandId = d.bandId || getBandId();
      // Fetch playlist_history and existing band_songs in parallel
      var [histRes, libRes] = await Promise.all([
        sb.from('playlist_history').select('date, playlist')
          .eq('band_id', bandId).order('date', { ascending: false }).limit(500),
        sb.from('band_songs').select('name').eq('band_id', bandId)
      ]);
      if (histRes.error) throw histRes.error;
      var libNames = new Set(
        (libRes.data || []).map(function(s){ return (s.name||'').trim().toLowerCase(); })
      );
      // Collect all requested songs from history
      var map = {}; // key = name lowercase
      (histRes.data || []).forEach(function(row) {
        var playlist = row.playlist || [];
        playlist.forEach(function(song) {
          if (!song._isRequest || !song.name) return;
          var k = song.name.trim().toLowerCase();
          if (!map[k]) {
            map[k] = {
              name: song.name.trim(),
              key: song.key || song._key || '',
              bpm: song.bpm || 0,
              artist: song.artist || '',
              singer: song.singer || '',
              requestCount: 0,
              lastDate: row.date || '',
              inLibrary: libNames.has(k)
            };
          }
          map[k].requestCount++;
          // keep most recent date and non-empty metadata
          if (row.date > map[k].lastDate) map[k].lastDate = row.date;
          if (!map[k].key && (song.key || song._key)) map[k].key = song.key || song._key || '';
          if (!map[k].bpm && song.bpm) map[k].bpm = song.bpm;
          if (!map[k].artist && song.artist) map[k].artist = song.artist;
          if (!map[k].singer && song.singer) map[k].singer = song.singer;
        });
      });
      var list = Object.values(map).sort(function(a, b) {
        return b.requestCount - a.requestCount;
      });
      return { success: true, data: list };
    }

    async function doBulkAddSongsToLibrary(d) {
      var bandId  = d.bandId  || getBandId();
      var songs   = d.songs   || [];
      if (!songs.length) return { success: true, added: 0 };
      var rows = songs.map(function(s) {
        return {
          band_id:  bandId,
          name:     (s.name || '').trim(),
          key:      s.key   || '',
          bpm:      s.bpm   ? String(s.bpm) : '',
          artist:   s.artist || '',
          singer:   s.singer || '',
          source:   'live_request',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });
      var { data, error } = await sb.from('band_songs').insert(rows).select('id');
      if (error) throw error;
      return { success: true, added: (data || []).length };
    }

    // Clone global songs into band library (batch)
    async function doCloneSongsToBand(d) {
      var ids    = d.ids    || d.songIds || [];
      var bandId = d.bandId || getBandId();
      if (!ids.length || !bandId) return { success: false, message: 'ต้องระบุ ids และ bandId' };

      // Fetch existing refs to deduplicate
      var { data: existRefs } = await sb.from('band_song_refs')
        .select('song_id').eq('band_id', bandId);
      var refSet = {};
      (existRefs || []).forEach(function(r) { refSet[r.song_id] = true; });

      var toInsert = [];
      var skipped  = 0;
      ids.forEach(function(songId) {
        if (refSet[songId]) { skipped++; return; }
        toInsert.push({ band_id: bandId, song_id: songId });
      });

      var added = 0;
      if (toInsert.length) {
        var { data: inserted, error: insErr } = await sb.from('band_song_refs').insert(toInsert).select('id');
        if (insErr) throw insErr;
        added = (inserted || []).length;
      }

      return { success: true, added: added, skipped: skipped };
    }

    async function doRemoveFromBandLibrary(d) {
      var songId = d.songId;
      var bandId = d.bandId || getBandId();
      if (!songId || !bandId) return { success: false, message: 'ต้องระบุ songId และ bandId' };

      var { error } = await sb.from('band_song_refs')
        .delete()
        .eq('band_id', bandId)
        .eq('song_id', songId);
      if (error) throw error;
      return { success: true };
    }

    // Detach a ref song: copy global data → band-owned row, remove ref, return new ID
    async function doDetachRefSong(d) {
      var songId = d.songId;
      var bandId = d.bandId || getBandId();
      if (!songId || !bandId) return { success: false, message: 'ต้องระบุ songId และ bandId' };

      // Fetch global song data
      var { data: src, error: fetchErr } = await sb.from('band_songs')
        .select('*').eq('id', songId).single();
      if (fetchErr) throw fetchErr;

      // Insert as band-owned copy
      var { data: newRow, error: insErr } = await sb.from('band_songs').insert({
        band_id: bandId, source: 'band',
        name: src.name, artist: src.artist || '', key: src.key || '',
        bpm: src.bpm || '', singer: src.singer || '', era: src.era || '',
        mood: src.mood || '', tags: src.tags || '', notes: src.notes || ''
      }).select('id').single();
      if (insErr) throw insErr;

      // Remove the ref
      await sb.from('band_song_refs').delete()
        .eq('band_id', bandId).eq('song_id', songId);

      return { success: true, newSongId: newRow.id };
    }

    // Admin: get per-band song stats
    async function doGetBandSongStats(d) {
      var { data, error } = await sb.from('band_songs')
        .select('band_id, source, id')
        .eq('source', 'band');
      if (error) throw error;
      var stats = {};
      (data || []).forEach(function(r) {
        var bid = r.band_id || 'unknown';
        if (!stats[bid]) stats[bid] = 0;
        stats[bid]++;
      });
      return { success: true, data: stats };
    }

    // ── Song Suggestions (แนะนำแก้ไขเพลง) ───────────────────────
    async function doAddSongSuggestion(d) {
      var user = sb.auth ? (await sb.auth.getUser()).data.user : null;
      var row = {
        song_id: d.songId,
        suggested_by: user ? user.id : null,
        suggested_name: d.suggestedName || (localStorage ? localStorage.getItem('userNickname') || localStorage.getItem('userFirstName') || '' : ''),
        suggested_data: d.suggestedData || {},
        note: d.note || '',
        status: 'pending'
      };
      var { data, error } = await sb.from('song_suggestions').insert(row).select().single();
      if (error) throw error;
      return { success: true, data: toCamel(data) };
    }

    async function doGetSongSuggestions(d) {
      var q = sb.from('song_suggestions').select('*');
      if (d.status) q = q.eq('status', d.status);
      if (d.songId) q = q.eq('song_id', d.songId);
      q = q.order('created_at', { ascending: false });
      if (d.limit) q = q.limit(d.limit);
      var { data, error } = await q;
      if (error) throw error;
      return { success: true, data: toCamelList(data || []) };
    }

    async function doReviewSongSuggestion(d) {
      var user = sb.auth ? (await sb.auth.getUser()).data.user : null;
      var update = {
        status: d.status,
        admin_note: d.adminNote || '',
        reviewed_by: user ? user.id : null,
        reviewed_at: new Date().toISOString()
      };
      var { data, error } = await sb.from('song_suggestions').update(update).eq('id', d.id).select().single();
      if (error) throw error;
      return { success: true, data: toCamel(data) };
    }

    // ── Band Fund (กองกลาง) ──────────────────────────────────────
    async function doGetFundTransactions(d) {
      var bandId = d.bandId || getBandId();
      var { data, error } = await sb.from('fund_transactions')
        .select('*').eq('band_id', bandId).order('date', { ascending: false });
      if (error) throw error;
      var rows = toCamelList(data || []);
      var balance = 0, totalIncome = 0, totalExpense = 0;
      (data || []).forEach(function(r) {
        // คำนวณยอดเฉพาะ approved
        if (r.status === 'approved' || !r.status) {
          if (r.type === 'income') { totalIncome += (r.amount || 0); balance += (r.amount || 0); }
          else { totalExpense += (r.amount || 0); balance -= (r.amount || 0); }
        }
      });
      return { success: true, data: { transactions: rows, balance: balance, totalIncome: totalIncome, totalExpense: totalExpense } };
    }

    async function doAddFundTransaction(d) {
      var bandId   = d.bandId || getBandId();
      var userName = localStorage ? (localStorage.getItem('userNickname') || localStorage.getItem('userFirstName') || localStorage.getItem('userName') || '') : '';
      var userRole = localStorage ? (localStorage.getItem('userRole') || 'member') : 'member';
      // ผู้จัดการ/แอดมิน → approved ทันที, สมาชิก → pending รออนุมัติ
      var isManager = (userRole === 'admin' || userRole === 'manager');
      var row = {
        band_id:      bandId,
        type:         d.type || 'income',
        amount:       parseFloat(d.amount) || 0,
        date:         d.date || new Date().toISOString().slice(0, 10),
        category:     d.category || '',
        description:  d.description || '',
        status:       isManager ? 'approved' : 'pending',
        submitted_by: d.submittedBy || userName,
        approved_by:  isManager ? userName : '',
        approved_at:  isManager ? new Date().toISOString() : null
      };
      var { data, error } = await sb.from('fund_transactions').insert(row).select().single();
      if (error) throw error;
      return { success: true, data: toCamel(data), autoApproved: isManager };
    }

    async function doApproveFundTransaction(d) {
      var userName = localStorage ? (localStorage.getItem('userNickname') || localStorage.getItem('userFirstName') || localStorage.getItem('userName') || 'ผู้จัดการ') : 'ผู้จัดการ';
      var { data, error } = await sb.from('fund_transactions')
        .update({ status: 'approved', approved_by: userName, approved_at: new Date().toISOString(), reject_reason: '' })
        .eq('id', d.txId).select().single();
      if (error) throw error;
      return { success: true, data: toCamel(data) };
    }

    async function doRejectFundTransaction(d) {
      var userName = localStorage ? (localStorage.getItem('userNickname') || localStorage.getItem('userFirstName') || localStorage.getItem('userName') || 'ผู้จัดการ') : 'ผู้จัดการ';
      var { data, error } = await sb.from('fund_transactions')
        .update({ status: 'rejected', approved_by: userName, approved_at: new Date().toISOString(), reject_reason: d.reason || '' })
        .eq('id', d.txId).select().single();
      if (error) throw error;
      return { success: true, data: toCamel(data) };
    }

    async function doDeleteFundTransaction(d) {
      return doDelete('fund_transactions', d.txId);
    }

    // ── Quotation PDF (client-side) ──────────────────────────────
    async function doGenerateQuotationPdf(d) {
      // Fetch quotation data
      var { data, error } = await sb.from('quotations').select('*').eq('id', d.quotationId).single();
      if (error || !data) return { success: false, message: 'ไม่พบใบเสนอราคา' };
      // Generate simple printable page
      var q = toCamel(data);
      var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>ใบเสนอราคา</title>'
        + '<style>body{font-family:Sarabun,sans-serif;padding:40px}table{width:100%;border-collapse:collapse;margin:20px 0}'
        + 'th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f5f5f5}.total{font-size:1.3em;font-weight:bold;text-align:right;margin-top:20px}</style></head>'
        + '<body><h1>ใบเสนอราคา</h1>'
        + '<p><strong>ลูกค้า:</strong> ' + (q.clientName || '-') + '</p>'
        + '<p><strong>วันที่:</strong> ' + (q.date || '-') + '</p>'
        + '<p><strong>รายละเอียด:</strong> ' + (q.description || '-') + '</p>'
        + '<p class="total">รวมทั้งสิ้น: ฿' + (q.totalAmount || q.amount || 0).toLocaleString() + '</p>'
        + '<p style="margin-top:40px;text-align:center;color:#888">BandThai</p>'
        + '</body></html>';
      var blob = new Blob([html], { type: 'text/html' });
      var url = URL.createObjectURL(blob);
      return { success: true, url: url };
    }

    // ── Push Subscriptions ────────────────────────────────────────
    async function doSavePushSubscription(d) {
      /* ใช้ getSession() แทน getUser() — เร็วกว่า (อ่านจาก localStorage cache) */
      var { data: { session } } = await sb.auth.getSession();
      var userId = session && session.user && session.user.id;
      if (!userId) throw new Error('ต้อง login ก่อน — session หมดอายุ กรุณา login ใหม่');
      /* ลบ endpoint เก่า (ถ้ามี) แล้ว insert ใหม่ — หลีกเลี่ยง UPDATE RLS */
      await sb.from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', d.endpoint);
      var { error } = await sb.from('push_subscriptions')
        .insert({
          user_id:  userId,
          band_id:  d.bandId || getBandId(),
          endpoint: d.endpoint,
          p256dh:   d.p256dh,
          auth_key: d.authKey
        });
      if (error) throw error;
      return { success: true };
    }

    async function doDeletePushSubscription(d) {
      var { data: { user }, error: ue } = await sb.auth.getUser();
      if (ue || !user) return { success: true }; // ไม่ต้องทำอะไรถ้าไม่ได้ login
      var { error } = await sb.from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', d.endpoint);
      if (error) throw error;
      return { success: true };
    }

    async function doGetNotifSubscribers(d) {
      var { data, error } = await sb.rpc('get_band_subscribers', { p_band_id: d.bandId || '' });
      if (error) return { success: false, error: error.message };
      return { success: true, data: data || [] };
    }

    async function doSendTestNotification(d) {
      var { data: { session } } = await sb.auth.getSession();
      if (!session) return { success: false, error: 'ไม่ได้ login' };
      var jwt = session.access_token;
      var SUPABASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL) || 'https://wsorngsyowgxikiepice.supabase.co';
      try {
        var resp = await fetch(SUPABASE_URL + '/functions/v1/send-notifications', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + jwt,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action:   'test_push',
            band_id:  d.bandId  || '',
            title:    d.title   || '🔔 การแจ้งเตือนทดสอบ',
            body:     d.body    || 'ระบบการแจ้งเตือนของวงทำงานปกติ ✅'
          })
        });
        var json = await resp.json();
        return { success: !!json.ok, sent: json.sent || 0, error: json.error };
      } catch(e) {
        return { success: false, error: e.message };
      }
    }

    async function doCleanStaleSubscriptions(d) {
      // Stale subscriptions are removed automatically when push fails (410/404 response).
      // This manual clean simply removes subscriptions for users who are no longer
      // members of the band (user removed from band but subscription still exists).
      var bandId = d.bandId || '';
      if (!bandId) return { success: false, error: 'ไม่พบ bandId' };
      var { data: { user }, error: ue } = await sb.auth.getUser();
      if (ue || !user) return { success: false, error: 'ไม่ได้ login' };
      // Get all user IDs still in the band (profiles with this band_id)
      var { data: members } = await sb.from('profiles').select('id').eq('band_id', bandId);
      var memberIds = (members || []).map(function(m){ return m.id; });
      if (memberIds.length === 0) return { success: true, removed: 0 };
      // Delete push_subscriptions where user_id NOT in active members
      var { data: subs } = await sb.from('push_subscriptions')
        .select('id, user_id').eq('band_id', bandId);
      var stale = (subs || []).filter(function(s){ return !memberIds.includes(s.user_id); });
      if (stale.length === 0) return { success: true, removed: 0 };
      var staleIds = stale.map(function(s){ return s.id; });
      var { error } = await sb.from('push_subscriptions').delete().in('id', staleIds);
      if (error) return { success: false, error: error.message };
      return { success: true, removed: stale.length };
    }

    // ── Live Guest Tokens ─────────────────────────────────────────
    async function doCreateGuestToken(d) {
      // สร้าง random token 32 chars
      var arr = new Uint8Array(18);
      crypto.getRandomValues(arr);
      var token = Array.from(arr).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
      var { data: { user }, error: ue } = await sb.auth.getUser();
      if (ue || !user) throw new Error('ต้อง login ก่อนสร้าง guest token');
      var row = {
        token:      token,
        band_id:    d.bandId || getBandId(),
        created_by: user.id,
        date:       d.date || '',
        venue:      d.venue || '',
        time_slot:  d.timeSlot || '',
        expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
      };
      var { error } = await sb.from('live_guest_tokens').insert(row);
      if (error) throw error;
      return { success: true, data: { token: token, expiresAt: row.expires_at } };
    }

    async function doVerifyGuestToken(d) {
      var { data, error } = await sb.from('live_guest_tokens')
        .select('*')
        .eq('token', d.token)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (error) throw error;
      if (!data) return { success: false, message: 'ลิงก์หมดอายุหรือไม่ถูกต้อง' };
      return { success: true, data: {
        bandId:   data.band_id,
        date:     data.date,
        venue:    data.venue,
        timeSlot: data.time_slot,
        expiresAt: data.expires_at
      }};
    }

    async function doDeleteGuestToken(d) {
      if (!d.token) return { success: false, message: 'ไม่พบ token' };
      // ลบโดยใช้ column 'token' โดยตรง (รองรับทั้ง schema v1 และ v2)
      var { error } = await sb.from('live_guest_tokens').delete().eq('token', d.token);
      if (error) throw error;
      return { success: true };
    }

    // ── External Jobs helpers ─────────────────────────────────────

    /** ดึง external_jobs ที่ event_date >= today (งานนอกที่กำลังจะมา) */
    async function doGetUpcomingExternalJobs(d) {
      var today = new Date().toISOString().substring(0, 10);
      var q = sb.from('external_jobs')
        .select('*')
        .eq('band_id', getBandId())
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(50);
      var { data, error } = await q;
      if (error) throw error;
      return { success: true, data: toCamelList(data) };
    }

    /** อัปเดต member_fees JSONB: mark สมาชิกคนหนึ่งว่าได้รับเงินแล้ว
     *  d = { jobId, memberId, paidDate, paymentMethod }
     */
    async function doPayMemberForJob(d) {
      if (!d.jobId) return { success: false, message: 'ไม่พบ jobId' };
      // ดึง job ก่อน
      var { data: job, error: fErr } = await sb.from('external_jobs').select('*').eq('id', d.jobId).single();
      if (fErr) throw fErr;
      if (!job) return { success: false, message: 'ไม่พบงาน' };

      // อัปเดต member_fees JSONB
      var fees = Array.isArray(job.member_fees) ? job.member_fees : [];
      var updated = false;
      fees = fees.map(function(mf) {
        if ((mf.memberId || mf.member_id) === d.memberId) {
          updated = true;
          return Object.assign({}, mf, {
            paid: true,
            paidDate: d.paidDate || new Date().toISOString().substring(0, 10),
            paymentMethod: d.paymentMethod || ''
          });
        }
        return mf;
      });
      if (!updated) return { success: false, message: 'ไม่พบสมาชิกในงานนี้' };

      // คำนวณ payout_status รวม
      var allPaid = fees.every(function(mf) { return mf.paid; });
      var anyPaid = fees.some(function(mf) { return mf.paid; });
      var payoutStatus = allPaid ? 'paid' : (anyPaid ? 'partial' : 'pending');

      var { error: uErr } = await sb.from('external_jobs').update({
        member_fees:    fees,
        payout_status:  payoutStatus,
        payout_date:    allPaid ? (d.paidDate || new Date().toISOString().substring(0, 10)) : '',
        updated_at:     new Date().toISOString()
      }).eq('id', d.jobId);
      if (uErr) throw uErr;
      return { success: true, data: { payoutStatus: payoutStatus } };
    }

    // ── App Config ─────────────────────────────────────────────────
    async function doGetAppConfig() {
      var { data, error } = await sb.from('app_config').select('*').order('key');
      if (error) throw error;
      // Return as both array and key-value map
      var map = {};
      (data || []).forEach(function(row) { map[row.key] = row.value; });
      return { success: true, data: data || [], map: map };
    }

    async function doSetAppConfigKey(d) {
      if (!d.key) return { success: false, message: 'ไม่พบ key' };
      var { error } = await sb.from('app_config')
        .upsert({ key: d.key, value: String(d.value || ''), description: d.description || '', updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      return { success: true };
    }

    // ── Bands Management ───────────────────────────────────────────
    async function doGetAllBands() {
      // ดึงจากตาราง bands (source of truth)
      var { data, error } = await sb.from('bands')
        .select('id, band_name, band_plan, province, manager_id, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data) data = [];

      // เสริมจำนวนสมาชิก + band_code
      if (data.length) {
        var bandIds = data.map(function(b) { return b.id; });

        // นับสมาชิกจาก profiles
        var { data: profiles } = await sb.from('profiles')
          .select('band_id')
          .not('band_id', 'is', null)
          .neq('band_id', '');
        var countMap = {};
        if (profiles) profiles.forEach(function(p) {
          countMap[p.band_id] = (countMap[p.band_id] || 0) + 1;
        });

        // ดึง band code จาก invite_codes
        var { data: codes } = await sb.from('invite_codes')
          .select('band_id, code')
          .in('band_id', bandIds.map(String))
          .eq('status', 'permanent');
        var codeMap = {};
        if (codes) codes.forEach(function(c) { codeMap[c.band_id] = c.code; });

        data.forEach(function(b) {
          b.member_count = countMap[b.id] || 0;
          b.band_code = codeMap[b.id] || '';
        });
      }

      return { success: true, data: data };
    }

    async function doSetBandPlan(d) {
      if (!d.bandId || !d.plan) return { success: false, message: 'ไม่พบ bandId หรือ plan' };
      var { error } = await sb.from('bands').update({ band_plan: d.plan }).eq('id', d.bandId);
      if (error) throw error;
      return { success: true };
    }

    async function doAdminDeleteBand(d) {
      if (!d.bandId) return { success: false, message: 'ไม่พบ bandId' };
      var { error } = await sb.from('bands').delete().eq('id', d.bandId);
      if (error) throw error;
      return { success: true };
    }

    // ── Activity Log ───────────────────────────────────────────────
    async function doGetActivityLog(d) {
      d = d || {};
      var limit  = d.limit  || 100;
      var offset = d.offset || 0;
      var query  = sb.from('activity_log').select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      if (d.action)      query = query.eq('action', d.action);
      if (d.target_type) query = query.eq('target_type', d.target_type);
      if (d.from_date)   query = query.gte('created_at', d.from_date);
      if (d.to_date)     query = query.lte('created_at', d.to_date);
      var { data, error, count } = await query;
      if (error) throw error;
      return { success: true, data: data || [], total: count };
    }

    async function doLogActivity(d) {
      if (!d.action) return { success: false, message: 'ไม่พบ action' };
      var user = await sb.auth.getUser();
      var uid  = (user && user.data && user.data.user) ? user.data.user.id   : null;
      var email= (user && user.data && user.data.user) ? user.data.user.email : '';
      var { error } = await sb.from('activity_log').insert({
        admin_id:    uid,
        admin_email: email,
        action:      d.action,
        target_type: d.target_type || '',
        target_id:   String(d.target_id || ''),
        details:     d.details || {},
        created_at:  new Date().toISOString()
      });
      if (error) throw error;
      return { success: true };
    }

    // ── Member Activity Log (band-level) ──────────────────────────
    async function doGetSongsInRange(d) {
      // ดึงเพลงในช่วงวันที่ เพื่อใช้ backfill
      d = d || {};
      var bid = getBandId();
      var q = sb.from('band_songs').select('id, name, artist, created_at, created_by').eq('band_id', bid);
      if (d.from) q = q.gte('created_at', d.from + 'T00:00:00+00:00');
      if (d.to)   q = q.lte('created_at', d.to   + 'T23:59:59+00:00');
      // เฉพาะเพลงที่ยังไม่มี created_by (ก่อนติดตาม)
      if (d.unclaimedOnly) q = q.eq('created_by', '');
      q = q.order('created_at', { ascending: true }).limit(d.limit || 2000);
      var { data, error } = await q;
      if (error) throw error;
      return { success: true, data: toCamelList(data || []), count: (data || []).length };
    }

    async function doBackfillMemberActivity(d) {
      // Assign เพลงในช่วงวันที่ให้สมาชิกระบุ → insert ใน member_activity_log + update created_by
      d = d || {};
      if (!d.userId || !d.userName) return { success: false, message: 'ระบุ userId และ userName ก่อน' };
      var bid = getBandId();
      if (!bid) return { success: false, message: 'ไม่พบ bandId' };

      // ดึงเพลงในช่วงนั้น
      var q = sb.from('band_songs').select('id, name, created_at').eq('band_id', bid);
      if (d.from) q = q.gte('created_at', d.from + 'T00:00:00+00:00');
      if (d.to)   q = q.lte('created_at', d.to   + 'T23:59:59+00:00');
      if (d.unclaimedOnly) q = q.eq('created_by', '');
      q = q.order('created_at', { ascending: true }).limit(2000);
      var { data: songs, error: e1 } = await q;
      if (e1) throw e1;
      if (!songs || !songs.length) return { success: true, inserted: 0, message: 'ไม่พบเพลงในช่วงวันที่นี้' };

      // Insert log ทีละ batch
      var sessId = 'backfill_' + d.userId.substring(0,8) + '_' + Date.now();
      var rows = songs.map(function(s) {
        return {
          band_id:      bid,
          user_id:      d.userId,
          user_name:    d.userName,
          action:       'add_song',
          action_label: 'เพิ่มเพลง (ย้อนหลัง)',
          target_id:    s.id,
          target_name:  s.name || '',
          score:        3,
          session_id:   sessId,
          created_at:   s.created_at
        };
      });

      // Insert log in batches of 200
      var inserted = 0;
      for (var i = 0; i < rows.length; i += 200) {
        var batch = rows.slice(i, i + 200);
        var { error: e2 } = await sb.from('member_activity_log').insert(batch);
        if (e2) throw e2;
        inserted += batch.length;
      }

      // Update created_by ใน band_songs ด้วย (ถ้า unclaimedOnly หรือ overwrite)
      if (d.updateCreatedBy) {
        var ids = songs.map(function(s){ return s.id; });
        for (var i = 0; i < ids.length; i += 200) {
          var batchIds = ids.slice(i, i + 200);
          await sb.from('band_songs').update({ created_by: d.userId }).in('id', batchIds);
        }
      }

      return { success: true, inserted: inserted, total: songs.length };
    }

    async function doGetMemberActivityLog(d) {
      d = d || {};
      var bid = getBandId();
      var q = sb.from('member_activity_log').select('*').eq('band_id', bid);
      if (d.userId) q = q.eq('user_id', d.userId);
      if (d.action) q = q.eq('action',  d.action);
      if (d.from)   q = q.gte('created_at', d.from + 'T00:00:00+00:00');
      if (d.to)     q = q.lte('created_at', d.to   + 'T23:59:59+00:00');
      q = q.order('created_at', { ascending: false }).limit(d.limit || 5000);
      var { data, error } = await q;
      if (error) throw error;
      return { success: true, data: toCamelList(data || []) };
    }

    async function doGetMemberActivitySummary(d) {
      d = d || {};
      var bid = getBandId();
      var q = sb.from('member_activity_log')
        .select('user_id, user_name, action, score, session_id, created_at')
        .eq('band_id', bid);
      if (d.from) q = q.gte('created_at', d.from + 'T00:00:00+00:00');
      if (d.to)   q = q.lte('created_at', d.to   + 'T23:59:59+00:00');
      q = q.order('created_at', { ascending: true }).limit(10000);
      var { data, error } = await q;
      if (error) throw error;
      return { success: true, data: toCamelList(data || []) };
    }

    async function doGetMemberWorkStats() {
      var bid = getBandId();
      if (!bid) return { success: false, message: 'ไม่พบ bandId' };

      // 1. Band settings → songManagers list + revenueAdminReservedPct
      var r1 = await sb.from('band_settings').select('settings').eq('band_id', bid).limit(1);
      if (r1.error) throw r1.error;
      var settings   = (r1.data && r1.data[0] && r1.data[0].settings) || {};
      var managerIds = settings.songManagers || [];

      // ── Two-Pool Model ──────────────────────────────────────────────────────
      // Pool 1: System Owner Reserved % (เจ้าของระบบ)
      //   - สงวนให้ admin เสมอ = สะท้อนงานสร้างระบบ / ค่า AI / ออกแบบ / ดูแลทุกอย่างนอกคลังเพลง
      //   - configurable ใน band_settings.revenueAdminReservedPct (default 60%)
      // Pool 2: Activity Pool (งานดูแล)
      //   - (100 - reservedPct)% แบ่งตามคะแนนงานสะสม รวมของ admin ด้วย
      //   - ยิ่งทำงานมาก ยิ่งได้สัดส่วนจาก pool นี้มาก
      // ─────────────────────────────────────────────────────────────────────
      var adminReservedPct = parseFloat(settings.revenueAdminReservedPct);
      if (isNaN(adminReservedPct)) adminReservedPct = 60;
      adminReservedPct = Math.max(0, Math.min(95, adminReservedPct));
      var activityPoolPct = 100 - adminReservedPct;

      // 2. Admin profiles (role=admin) — always include in the split
      var r2a = await sb.from('profiles')
        .select('id, first_name, last_name, nickname, user_name, role')
        .eq('band_id', bid)
        .eq('role', 'admin');
      var adminProfiles = (!r2a.error && r2a.data) ? r2a.data : [];
      var adminIds = adminProfiles.map(function(p){ return p.id; });

      // 3. Merge: adminIds + managerIds (deduplicate)
      var allIds = adminIds.slice();
      managerIds.forEach(function(id) {
        if (allIds.indexOf(id) < 0) allIds.push(id);
      });

      // 4. Total songs count
      var r3 = await sb.from('band_songs').select('*', { count: 'exact', head: true }).eq('band_id', bid);
      if (r3.error) throw r3.error;
      var totalSongs = r3.count || 0;

      // 5. Activity log
      var r4 = await sb.from('member_activity_log')
        .select('user_id, user_name, action, score, created_at')
        .eq('band_id', bid)
        .order('created_at', { ascending: true })
        .limit(10000);
      if (r4.error) throw r4.error;
      var logs = r4.data || [];

      // 6. Profile data for non-admin managers (admins already fetched)
      var profiles = adminProfiles.slice();
      var nonAdminManagerIds = managerIds.filter(function(id){ return adminIds.indexOf(id) < 0; });
      if (nonAdminManagerIds.length > 0) {
        var r5 = await sb.from('profiles')
          .select('id, first_name, last_name, nickname, user_name, role')
          .in('id', nonAdminManagerIds);
        if (!r5.error && r5.data) profiles = profiles.concat(r5.data);
      }

      // 7. Compute scores per user from activity log (ALL action types count)
      var actScoreByUser = {};
      logs.forEach(function(l) {
        var uid = l.user_id;
        if (!actScoreByUser[uid]) actScoreByUser[uid] = 0;
        actScoreByUser[uid] += (l.score || 1);
      });

      // 8. Base score = historical songs × 3 pts each, divided equally among all (admins + managers)
      //    This represents work done before tracking started
      var historicalSongs  = Math.max(0, totalSongs - (logs.filter(function(l){ return l.action === 'add_song' || l.action === 'bulk_add'; }).length));
      var totalBaseScore   = historicalSongs * 3;  // add_song = 3 pts
      var numAll           = allIds.length || 1;
      var basePerPerson    = Math.round(totalBaseScore / numAll);

      // 9. Total activity score across all users
      var totalActivityScore = Object.values(actScoreByUser).reduce(function(s, v) { return s + v; }, 0);

      // 10. Build member stats — % based on (baseScore + activityScore)
      var profileMap = {};
      profiles.forEach(function(p) { profileMap[p.id] = p; });

      var members = allIds.map(function(uid) {
        var p           = profileMap[uid] || {};
        var name        = p.nickname || p.first_name || p.user_name || uid.substring(0, 8);
        var isAdm       = p.role === 'admin' || adminIds.indexOf(uid) >= 0;
        var actScore    = actScoreByUser[uid] || 0;
        var totalScore  = basePerPerson + actScore;
        return {
          userId:        uid,
          userName:      name + (isAdm ? ' ⭐' : ''),
          isAdmin:       isAdm,
          baseScore:     basePerPerson,
          activityScore: actScore,
          totalScore:    totalScore,
          pct:           0
        };
      });

      var grandTotal = members.reduce(function(s, m) { return s + m.totalScore; }, 0) || 1;
      members.forEach(function(m) {
        var activityShare = activityPoolPct * m.totalScore / grandTotal;
        if (m.isAdmin) {
          // Admin: ได้ Pool1 (reserved) + ส่วนของตัวเองใน Pool2 (activity)
          m.systemPct   = adminReservedPct;
          m.activityPct = Math.round(activityShare * 10) / 10;
          m.pct         = Math.round((adminReservedPct + activityShare) * 10) / 10;
        } else {
          m.systemPct   = 0;
          m.activityPct = Math.round(activityShare * 10) / 10;
          m.pct         = m.activityPct;
        }
      });
      members.sort(function(a, b) {
        if (a.isAdmin && !b.isAdmin) return -1;
        if (!a.isAdmin && b.isAdmin) return 1;
        return b.totalScore - a.totalScore;
      });

      return {
        success:            true,
        totalSongs:         totalSongs,
        historicalSongs:    historicalSongs,
        baseScore:          totalBaseScore,
        totalActivityScore: totalActivityScore,
        adminReservedPct:   adminReservedPct,
        activityPoolPct:    activityPoolPct,
        trackStart:         logs.length > 0 ? logs[0].created_at : null,
        members:            members
      };
    }

    // ── Notification Templates ──────────────────────────────────────
    async function doGetNotifTemplates() {
      var { data, error } = await sb.from('notification_templates').select('*').order('id');
      if (error) throw error;
      return { success: true, data: data || [] };
    }

    async function doSaveNotifTemplate(d) {
      if (!d.id) return { success: false, message: 'ไม่พบ id' };
      var { error } = await sb.from('notification_templates')
        .upsert({
          id:         d.id,
          name:       d.name    || d.id,
          subject:    d.subject || '',
          body:       d.body    || '',
          variables:  d.variables || [],
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      if (error) throw error;
      return { success: true };
    }

    // ── Broadcast Notification ─────────────────────────────────────
    async function doBroadcastNotification(d) {
      if (!d.title || !d.body) return { success: false, message: 'กรุณากรอก title และ body' };

      // Build query for matching push subscriptions
      var query = sb.from('push_subscriptions').select('endpoint, p256dh, auth, user_id');
      if (d.plan && d.plan !== 'all') {
        // Get users whose effective plan matches the target
        // Effective plan = plan_override if set, otherwise the band's band_plan
        var { data: profiles } = await sb.from('profiles').select('id, plan_override, band_id');
        var matchIds = [];
        if (profiles && profiles.length) {
          // Get all band plans in one query
          var bandIds = profiles.map(function(p) { return p.band_id; }).filter(Boolean);
          var bandPlanMap = {};
          if (bandIds.length) {
            var { data: bands } = await sb.from('bands').select('id, band_plan').in('id', bandIds);
            (bands || []).forEach(function(b) { bandPlanMap[b.id] = b.band_plan || 'free'; });
          }
          profiles.forEach(function(p) {
            var effectivePlan = p.plan_override || bandPlanMap[p.band_id] || 'free';
            if (effectivePlan === d.plan) matchIds.push(p.id);
          });
        }
        if (!matchIds.length) return { success: false, message: 'ไม่พบผู้ใช้ในกลุ่ม ' + d.plan };
        query = query.in('user_id', matchIds);
      }

      var { data: subs, error } = await query.limit(500);
      if (error) throw error;
      if (!subs || !subs.length) return { success: false, message: 'ไม่พบผู้รับ (ไม่มี Push Subscription)' };

      // Fire-and-forget: call existing sendTestNotification for each or use Edge Function
      // We use the existing edge function send-notifications via supabase functions.invoke
      var result = await sb.functions.invoke('send-notifications', {
        body: {
          targets: subs.map(function(s){ return { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }; }),
          title:   d.title,
          body:    d.body,
          url:     d.url || '/BandThai/dashboard.html'
        }
      });
      if (result.error) throw result.error;
      return { success: true, sent: subs.length, data: result.data };
    }

    // ── Global Songs — All (for duplicate check) ───────────────────────────
    async function doGetGlobalSongsAll() {
      var PAGE = 500;
      var all = [];
      var from = 0;
      while (true) {
        var { data, error } = await sb.from('band_songs')
          .select('id, name, artist, singer, key, bpm, era, mood, tags')
          .is('band_id', null)
          .order('name')
          .range(from, from + PAGE - 1);
        if (error) return { success: false, message: error.message };
        if (!data || !data.length) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return { success: true, data: all };
    }

    // ── Merge Duplicate Songs (redirect refs then delete) ─────────────────────
    async function doMergeDuplicateSongs(d) {
      var keepId    = d.keepId;
      var deleteIds = d.deleteIds || [];
      if (!keepId || !deleteIds.length) return { success: false, message: 'ข้อมูลไม่ครบ' };
      // Step 1: redirect band_song_refs → keep ไม่มีวงใดสูญเสียเพลง
      for (var i = 0; i < deleteIds.length; i++) {
        var { error: refErr } = await sb.from('band_song_refs')
          .update({ song_id: keepId })
          .eq('song_id', deleteIds[i]);
        if (refErr) return { success: false, message: 'Redirect refs ล้มเหลว: ' + refErr.message };
      }
      // Step 2: ลบเพลงซ้ำออกจาก Global Library
      var { error: delErr } = await sb.from('band_songs')
        .delete()
        .in('id', deleteIds);
      if (delErr) return { success: false, message: 'ลบไม่สำเร็จ: ' + delErr.message };
      return { success: true, deleted: deleteIds.length };
    }

    // ── Restore session จาก Supabase ─────────────────────────────
    sb.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_IN' && session) {
        localStorage.setItem('auth_token', session.access_token);
      }
      if (event === 'SIGNED_OUT') {
        clearSession();
      }
      if (event === 'TOKEN_REFRESHED' && session) {
        localStorage.setItem('auth_token', session.access_token);
      }
      if (event === 'PASSWORD_RECOVERY' && session) {
        localStorage.setItem('auth_token', session.access_token);
      }
    });

    console.log('[BandThai] Supabase API พร้อมใช้งาน');
  }); // end waitForSDK

})(window);
