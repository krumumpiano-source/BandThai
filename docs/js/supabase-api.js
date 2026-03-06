/**
 * BandFlow — Supabase API Wrapper
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
    function sbRun(action, data, callback) {
      dispatch(action, data || {}).then(function (result) {
        if (result && result.authError) {
          clearSession();
          window.location.replace('index.html');
          return;
        }
        if (callback) callback(result);
      }).catch(function (err) {
        console.error('[sbRun]', action, err);
        if (callback) callback({ success: false, message: err.message || err.toString() });
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
        case 'addSong':            return doInsert('band_songs', d.data || d);
        case 'updateSong':         return doUpdate('band_songs', d.songId, d.data || d);
        case 'deleteSong':         return doDelete('band_songs', d.songId);
        case 'savePlaylistHistory':return doSavePlaylistHistory(d);
        case 'getPlaylistHistory': return doGetPlaylistHistory(d);
        case 'getPlaylistHistoryByDate': return doGetPlaylistHistoryByDate(d);
        case 'deletePlaylistHistory': return doDeletePlaylistHistory(d);
        case 'getSongInsights':    return doGetSongInsights(d);
        case 'searchSongs':        return doSearchSongs(d);
        case 'getRequestedSongsFromHistory': return doGetRequestedSongsFromHistory(d);
        case 'bulkAddSongsToLibrary': return doBulkAddSongsToLibrary(d);
        case 'cloneSongsToBand':   return doCloneSongsToBand(d);
        case 'getBandSongStats':   return doGetBandSongStats(d);

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

        // ── Admin ──────────────────────────────────────────────────
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
      return { success: true, data: data && data.length ? toCamel(data[0]) : null };
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

    // ── Songs ─────────────────────────────────────────────────────
    async function doGetAllSongs(d) {
      var source = d.source || 'global';
      var PAGE = 1000;
      var all = [];
      var from = 0;
      while (true) {
        var q = sb.from('band_songs').select('*').order('name').range(from, from + PAGE - 1);
        if (source === 'band') {
          q = q.eq('band_id', getBandId());
        } else {
          q = q.is('band_id', null);
        }
        var { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return { success: true, data: toCamelList(all) };
    }

    async function doSearchSongs(d) {
      var term = (d.query || '').trim();
      var { data, error } = await sb.from('band_songs')
        .select('name, key, bpm, singer, artist')
        .eq('band_id', getBandId())
        .ilike('name', '%' + term + '%')
        .order('name')
        .limit(10);
      if (error) throw error;
      return { success: true, data: toCamelList(data) };
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
      var { data, error } = await sb.from('profiles')
        .select('id, email, user_name, nickname, first_name, last_name, instrument, phone, role, status, title, band_id, band_name, payment_method, payment_account, created_at')
        .eq('band_id', bandId)
        .eq('status', 'active')
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
      var row = {
        band_id: d.bandId || getBandId(),
        member_id: memberId,
        member_name: memberName,
        date: d.date || new Date().toISOString().slice(0, 10),
        venue: d.venue || '',
        slots: d.slots || '[]',
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
        await sb.from('member_check_ins').update(ciRow).eq('id', existCI[0].id);
      } else {
        await sb.from('member_check_ins').insert(ciRow);
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
      // Sync band_name to profiles so dashboard shows correct name after next login
      if (d.bandName) {
        var { data: authUser } = await sb.auth.getUser();
        if (authUser && authUser.user) {
          await sb.from('profiles').update({ band_name: d.bandName }).eq('id', authUser.user.id);
        }
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
        redirectTo: siteUrl + 'index.html'
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
    async function doAdminGetAllUsers() {
      var { data, error } = await sb.from('profiles').select('*').order('email');
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

      // Fetch source songs
      var { data: sourceSongs, error: fetchErr } = await sb.from('band_songs')
        .select('*').in('id', ids);
      if (fetchErr) throw fetchErr;

      // Fetch existing band songs (by name) to deduplicate
      var { data: existing } = await sb.from('band_songs')
        .select('name').eq('band_id', bandId);
      var existingNames = {};
      (existing || []).forEach(function(s) {
        existingNames[(s.name || '').toLowerCase().trim()] = true;
      });

      var toInsert = [];
      var skipped  = [];
      (sourceSongs || []).forEach(function(s) {
        var key = (s.name || '').toLowerCase().trim();
        if (existingNames[key]) { skipped.push(s.name); return; }
        toInsert.push({
          band_id: bandId, source: 'band',
          name: s.name, artist: s.artist || '', key: s.key || '',
          bpm: s.bpm || 0, singer: s.singer || '', era: s.era || '',
          mood: s.mood || '', tags: s.tags || '', notes: s.notes || ''
        });
      });

      var added = 0;
      if (toInsert.length) {
        var { data: inserted, error: insErr } = await sb.from('band_songs').insert(toInsert).select('id');
        if (insErr) throw insErr;
        added = (inserted || []).length;
      }

      return { success: true, added: added, skipped: skipped.length, skippedNames: skipped };
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
        + '<p style="margin-top:40px;text-align:center;color:#888">BandFlow</p>'
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
      var { data, error } = await sb.from('bands')
        .select('id, band_name, band_code, band_plan, province, created_at, profiles!profiles_band_id_fkey(count)')
        .order('created_at', { ascending: false });
      if (error) {
        // Fallback: if join fails, get bands without member count
        var res2 = await sb.from('bands').select('id, band_name, band_code, band_plan, province, created_at').order('created_at', { ascending: false });
        if (res2.error) throw res2.error;
        return { success: true, data: res2.data || [] };
      }
      return { success: true, data: data || [] };
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
        // Join with profiles to filter by plan
        var { data: matching } = await sb.from('profiles').select('id').eq('plan_override', d.plan);
        // Note: if plan_override is null fall back to band plan — simplified filter for broadcast
        if (matching && matching.length > 0) {
          var ids = matching.map(function(p){ return p.id; });
          query = query.in('user_id', ids);
        }
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
          url:     d.url || '/Band-Management-By-SoulCiety/docs/dashboard.html'
        }
      });
      if (result.error) throw result.error;
      return { success: true, sent: subs.length, data: result.data };
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
    });

    console.log('[SoulCiety] Supabase API พร้อมใช้งาน');
  }); // end waitForSDK

})(window);
