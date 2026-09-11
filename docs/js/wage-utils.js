/**
 * BandThai — Centralized Wage Calculation Utility (BandWage)
 * 
 * ให้บริการฟังก์ชันกลางสำหรับการคำนวณเรตราคาค่าแรง (Regular & Discounted Wage)
 * เพื่อให้หน้า Dashboard, Attendance-Payroll, Statistics และ Reports ได้ตัวเลขที่ตรงกัน 100%
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var wageModule = factory();
    root.BandWage = wageModule;
    root.getEffectiveWage = wageModule.getEffectiveWage;
    root.getEffectiveWageDetail = wageModule.getEffectiveWageDetail;
    root.normalizeDateStr = wageModule.normalizeDateStr;
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_FALLBACK_RATE = 350; // เรตราคาปกติพื้นฐาน (บาท/เบรค)

  /**
   * แปลงรูปแบบวันที่ใดๆ (Date object, ISO string, YYYY-MM-DD, DD/MM/YYYY, พ.ศ. 2569)
   * ให้เป็นสตริงมาตรฐาน YYYY-MM-DD (ปี ค.ศ.) เสมอ
   */
  function normalizeDateStr(d) {
    if (!d) return '';
    if (d instanceof Date) {
      if (isNaN(d.getTime())) return '';
      var y = d.getFullYear();
      if (y > 2400) y -= 543; // แปลง พ.ศ. เป็น ค.ศ.
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }

    var s = String(d).trim();
    if (!s) return '';

    // ตัดส่วนเวลา ISO ออก (เช่น 2026-09-07T00:00:00Z หรือ 2026-09-07 15:30:00)
    if (s.indexOf('T') !== -1) s = s.split('T')[0].trim();
    if (s.indexOf(' ') !== -1) s = s.split(' ')[0].trim();

    // รูปแบบ 1: YYYY-MM-DD หรือ YYYY/MM/DD
    var mYMD = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (mYMD) {
      var y1 = parseInt(mYMD[1], 10);
      if (y1 > 2400) y1 -= 543;
      var mo1 = String(parseInt(mYMD[2], 10)).padStart(2, '0');
      var da1 = String(parseInt(mYMD[3], 10)).padStart(2, '0');
      return y1 + '-' + mo1 + '-' + da1;
    }

    // รูปแบบ 2: DD-MM-YYYY หรือ DD/MM/YYYY
    var mDMY = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (mDMY) {
      var y2 = parseInt(mDMY[3], 10);
      if (y2 > 2400) y2 -= 543;
      var mo2 = String(parseInt(mDMY[2], 10)).padStart(2, '0');
      var da2 = String(parseInt(mDMY[1], 10)).padStart(2, '0');
      return y2 + '-' + mo2 + '-' + da2;
    }

    // ลองแปลงด้วย Date object
    var parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      var y3 = parsed.getFullYear();
      if (y3 > 2400) y3 -= 543;
      var mo3 = String(parsed.getMonth() + 1).padStart(2, '0');
      var da3 = String(parsed.getDate()).padStart(2, '0');
      return y3 + '-' + mo3 + '-' + da3;
    }

    return s;
  }

  /**
   * คำนวณวันในสัปดาห์ (0 = อาทิตย์, 1 = จันทร์, ..., 6 = เสาร์)
   * แบบ Timezone-safe เพื่อไม่ให้เกิดปัญหาเลื่อนวันจาก UTC Offset
   */
  function getDowFromDateStr(normDate) {
    if (!normDate || normDate.length < 10) return -1;
    var parts = normDate.split('-');
    if (parts.length !== 3) return -1;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = parseInt(parts[2], 10);
    var dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? -1 : dt.getDay();
  }

  /**
   * แปลงเวลา "HH:mm" หรือ "HH:mm:ss" เป็นจำนวนนาทีนับจากเที่ยงคืน
   */
  function parseMin(t) {
    if (!t) return 0;
    var p = String(t).trim().split(':').map(Number);
    return (p[0] || 0) * 60 + (p[1] || 0);
  }

  /**
   * คำนวณจำนวนชั่วโมงระหว่างสองช่วงเวลา (รองรับข้ามเที่ยงคืน)
   */
  function calcHours(start, end) {
    var s = parseMin(start);
    var e = parseMin(end);
    var diff = e - s;
    if (diff < 0) diff += 1440;
    return diff / 60;
  }

  /**
   * รวบรวมการตั้งค่าเรตราคาและกฎลดราคา (Discount Wage Rules)
   * จาก options, ตัวแปรส่วนกลาง (qciBandSettings, apBandSettings) หรือ localStorage
   */
  function getDiscountWageConfig(customSettings) {
    var s = customSettings;
    if (!s || typeof s !== 'object') {
      if (typeof self !== 'undefined' && self.qciBandSettings && typeof self.qciBandSettings === 'object') {
        s = self.qciBandSettings;
      } else if (typeof self !== 'undefined' && self.apBandSettings && typeof self.apBandSettings === 'object') {
        s = self.apBandSettings;
      } else {
        try {
          if (typeof localStorage !== 'undefined') {
            s = JSON.parse(localStorage.getItem('bandSettings') || '{}');
          }
        } catch (e) {
          s = {};
        }
      }
    }

    var enabled = false;
    var rawRules = null;
    var venues = (s && s.venues) || [];
    var schedule = (s && (s.scheduleData || s.schedule)) || {};

    if (s && s.discount_wage_enabled !== undefined) {
      enabled = !!s.discount_wage_enabled;
      rawRules = s.discount_wage_rules;
    }

    // ซิงก์/Fallback จาก localStorage เสมอหากมีข้อมูลล่าสุด
    try {
      if (typeof localStorage !== 'undefined') {
        var stored = JSON.parse(localStorage.getItem('bandSettings') || '{}');
        if (stored) {
          if (stored.discount_wage_enabled !== undefined) {
            enabled = !!stored.discount_wage_enabled;
          }
          if (stored.discount_wage_rules !== undefined && stored.discount_wage_rules !== null) {
            rawRules = stored.discount_wage_rules;
          }
          if ((!venues || venues.length === 0) && stored.venues) {
            venues = stored.venues;
          }
          if ((!schedule || Object.keys(schedule).length === 0) && (stored.scheduleData || stored.schedule)) {
            schedule = stored.scheduleData || stored.schedule;
          }
        }
      }
    } catch (e) {}

    var rules = [];
    try {
      if (rawRules) {
        rules = (typeof rawRules === 'string') ? JSON.parse(rawRules) : rawRules;
        if (typeof rules === 'string') rules = JSON.parse(rules);
      }
    } catch (e) {
      rules = [];
    }
    if (!Array.isArray(rules)) rules = [];

    return {
      enabled: !!enabled,
      rules: rules,
      venues: venues || [],
      schedule: schedule || {},
      settings: s || {}
    };
  }

  /**
   * ค้นหาเรตประจำตัวของสมาชิกในตารางงานของวง (ถ้าในสล็อตนั้นไม่ได้ระบุเรตไว้)
   */
  function findMemberDefaultRate(memberId, schedule, customFallback) {
    if (!memberId) return { rate: customFallback || DEFAULT_FALLBACK_RATE, type: 'shift' };
    if (schedule && typeof schedule === 'object') {
      for (var d = 0; d < 7; d++) {
        var day = schedule[d] || schedule[String(d)];
        var slots = [];
        if (Array.isArray(day)) slots = day;
        else if (day && day.timeSlots && Array.isArray(day.timeSlots)) slots = day.timeSlots;

        for (var i = 0; i < slots.length; i++) {
          var members = slots[i].members || [];
          for (var j = 0; j < members.length; j++) {
            var m = members[j];
            if (m && (m.memberId === memberId || m.id === memberId)) {
              var r = parseFloat(m.rate);
              if (!isNaN(r) && r > 0) {
                return { rate: r, type: m.rateType || 'shift' };
              }
            }
          }
        }
      }
    }
    return { rate: customFallback || DEFAULT_FALLBACK_RATE, type: 'shift' };
  }

  /**
   * ดึงราคาเรตปกติ (Base Wage) ของสล็อตนั้นๆ ก่อนนำไปคำนวณส่วนลด
   */
  function getBaseWage(slotOrTime, memberId, options) {
    options = options || {};
    var slot = (typeof slotOrTime === 'object' && slotOrTime !== null) ? slotOrTime : {};
    var sStart = slot.start || slot.startTime || '';
    var sEnd = slot.end || slot.endTime || '';

    if (!sStart && typeof slotOrTime === 'string' && slotOrTime.indexOf('-') !== -1) {
      var parts = slotOrTime.split('-');
      sStart = parts[0].trim();
      sEnd = parts[1].trim();
    }

    var memberRate = 0;
    var rateType = 'shift';
    var assigned = false;

    if (slot && Array.isArray(slot.members) && memberId) {
      for (var i = 0; i < slot.members.length; i++) {
        var sm = slot.members[i];
        if (sm && (sm.memberId === memberId || sm.id === memberId)) {
          var r = parseFloat(sm.rate);
          if (!isNaN(r) && r > 0) {
            memberRate = r;
            rateType = sm.rateType || 'shift';
            assigned = true;
            break;
          }
        }
      }
    }

    if (memberRate <= 0) {
      var cfg = getDiscountWageConfig(options.settings);
      var def = findMemberDefaultRate(memberId, cfg.schedule, options.defaultRate);
      memberRate = def.rate;
      rateType = def.type;
    }

    var hours = (sStart && sEnd) ? calcHours(sStart, sEnd) : 1;
    var basePay = (rateType === 'hourly') ? (hours * memberRate) : memberRate;

    return {
      basePay: Math.max(0, basePay),
      rate: memberRate,
      rateType: rateType,
      hours: hours,
      assigned: assigned
    };
  }

  /**
   * ฟังก์ชันกลางสำหรับคำนวณเรตราคาค่าแรง (Centralized Effective Wage Calculation)
   * 
   * @param {string|Date} date วันที่ของงาน (รองรับทั้ง YYYY-MM-DD, พ.ศ., Date Object)
   * @param {object|string} slotOrTime ออบเจกต์ Slot หรือสตริงช่วงเวลา เช่น "20:00-21:00"
   * @param {string} [venue] ชื่อร้านหรือ Venue ID (หากไม่ระบุจะดึงจาก slot.venue/slot.venueId)
   * @param {string} [memberId] รหัสสมาชิกนักดนตรี
   * @param {object} [options] ออปชันเพิ่มเติม เช่น settings, defaultRate, detail (true/false)
   * @returns {number|object} จำนวนเงินค่าแรงสุทธิ (หรือออบเจกต์รายละเอียดหากส่ง detail: true)
   */
  function getEffectiveWage(date, slotOrTime, venue, memberId, options) {
    var detail = getEffectiveWageDetail(date, slotOrTime, venue, memberId, options);
    if (options && options.detail) {
      return detail;
    }
    return detail.effectiveWage;
  }

  /**
   * คืนค่าผลการคำนวณแบบมีรายละเอียดครบถ้วน
   */
  function getEffectiveWageDetail(date, slotOrTime, venue, memberId, options) {
    options = options || {};
    var slot = (typeof slotOrTime === 'object' && slotOrTime !== null) ? slotOrTime : {};
    var timeSlotStr = (typeof slotOrTime === 'string') ? slotOrTime : '';

    var normDate = normalizeDateStr(date);
    var dow = getDowFromDateStr(normDate);
    var dowStr = String(dow);

    var baseInfo = getBaseWage(slotOrTime, memberId, options);
    var baseWage = baseInfo.basePay;

    var sStart = slot.start || slot.startTime || '';
    var sEnd = slot.end || slot.endTime || '';
    if (!sStart && timeSlotStr && timeSlotStr.indexOf('-') !== -1) {
      var tp = timeSlotStr.split('-');
      sStart = tp[0].trim();
      sEnd = tp[1].trim();
    }
    var normSlotTime = (sStart && sEnd) ? (sStart + '-' + sEnd).replace(/\s+/g, '') : '';

    var cfg = getDiscountWageConfig(options.settings);
    var sVenue = (venue || slot.venue || '').trim();
    var sVenueId = (venue ? '' : (slot.venueId || '')).trim();

    // ค้นหาและจับคู่ Venue Name กับ Venue ID จากรายชื่อร้านในระบบ
    if (cfg.venues && cfg.venues.length) {
      // ตรวจสอบว่า sVenue ที่ส่งมาเป็น venue ID หรือไม่
      var vMatchById = cfg.venues.find(function (v) { return v && v.id === sVenue; });
      if (vMatchById) {
        sVenueId = vMatchById.id;
        sVenue = (vMatchById.name || sVenue).trim();
      } else {
        var vMatchByName = cfg.venues.find(function (v) { return v && v.name === sVenue; });
        if (vMatchByName) {
          sVenueId = (vMatchByName.id || '').trim();
        } else if (!sVenueId && slot.venueId && (!venue || venue === slot.venue)) {
          sVenueId = slot.venueId.trim();
        }
      }
    } else if (!sVenueId && slot.venueId && (!venue || venue === slot.venue)) {
      sVenueId = slot.venueId.trim();
    }

    // ตรวจสอบว่าระบบเปิดใช้งาน Discount Wage และมีกฎตั้งไว้หรือไม่
    if (!cfg.enabled || !cfg.rules || cfg.rules.length === 0 || !normDate || options.isExtra) {
      return {
        effectiveWage: baseWage,
        baseWage: baseWage,
        isDiscounted: false,
        rule: null,
        rateType: baseInfo.rateType,
        hours: baseInfo.hours,
        dateStr: normDate,
        dow: dow
      };
    }

    // คำนวณลำดับเบรค (Break Index 1-indexed) ของร้านในวันนั้น (หากมี)
    var breakIdx = -1;
    if (slot.breakIdx) {
      breakIdx = parseInt(slot.breakIdx, 10);
    } else if (dow >= 0 && cfg.schedule) {
      var daySlotsRaw = cfg.schedule[dow] || cfg.schedule[dowStr] || [];
      var daySlots = Array.isArray(daySlotsRaw) ? daySlotsRaw : (daySlotsRaw.timeSlots || []);
      if (Array.isArray(daySlots)) {
        var venueDaySlots = daySlots.filter(function (s) {
          var v1 = (s.venue || '').trim();
          var vid1 = (s.venueId || '').trim();
          return (sVenue && v1.toLowerCase() === sVenue.toLowerCase()) || (sVenueId && vid1.toLowerCase() === sVenueId.toLowerCase());
        });
        for (var b = 0; b < venueDaySlots.length; b++) {
          var bs = (venueDaySlots[b].startTime || venueDaySlots[b].start || '').trim();
          var be = (venueDaySlots[b].endTime || venueDaySlots[b].end || '').trim();
          if (bs === sStart && be === sEnd) {
            breakIdx = b + 1;
            break;
          }
        }
      }
    }

    // วนลูปตรวจสอบกฎลดราคา
    var matchedRule = null;
    var effectiveWage = baseWage;

    for (var j = 0; j < cfg.rules.length; j++) {
      var rule = cfg.rules[j];
      if (!rule) continue;

      // 1. ตรวจสอบร้าน (Venue Match)
      var rVenue = (rule.venue || '*').trim();
      var rVenueId = (rule.venueId || '').trim();
      if (cfg.venues && cfg.venues.length) {
        var rvObj = cfg.venues.find(function (v) { return v && (v.id === rVenue || v.name === rVenue); });
        if (rvObj) {
          if (!rVenueId) rVenueId = (rvObj.id || '').trim();
          rVenue = (rvObj.name || rVenue).trim();
        }
      }

      var venueMatches = false;
      if (rVenue === '*' || rVenue === '') {
        venueMatches = true;
      } else {
        var rLow = rVenue.toLowerCase();
        var rIdLow = rVenueId.toLowerCase();
        if (sVenue && sVenue.toLowerCase() === rLow) venueMatches = true;
        else if (sVenueId && rIdLow && sVenueId.toLowerCase() === rIdLow) venueMatches = true;
        else if (sVenueId && sVenueId.toLowerCase() === rLow) venueMatches = true;
        else if (sVenue && rIdLow && sVenue.toLowerCase() === rIdLow) venueMatches = true;
      }
      if (!venueMatches) continue;

      // 2. ตรวจสอบวันในสัปดาห์ (Day-of-Week Match)
      var dayMatches = false;
      if (rule.day === '*' || rule.days === '*' || (!rule.day && (!rule.days || rule.days.length === 0))) {
        dayMatches = true;
      } else if (Array.isArray(rule.days) && rule.days.length > 0) {
        dayMatches = rule.days.some(function (d) { return String(d).trim() === dowStr; });
      } else if (typeof rule.day === 'string') {
        dayMatches = rule.day.split(',').some(function (d) { return d.trim() === dowStr; });
      } else if (rule.day !== undefined && rule.day !== null) {
        dayMatches = (String(rule.day).trim() === dowStr);
      }
      if (!dayMatches) continue;

      // 3. ตรวจสอบช่วงเวลา / เบรค (TimeSlot or Break Match)
      var timeMatches = true;
      if (rule.timeSlot && rule.timeSlot !== '*') {
        var normRuleTime = rule.timeSlot.replace(/\s+/g, '');
        timeMatches = (normSlotTime === normRuleTime);
      } else if (rule.breakIdx) {
        timeMatches = (String(rule.breakIdx) === String(breakIdx));
      }
      if (!timeMatches) continue;

      // 4. ตรวจสอบช่วงวันที่เริ่มต้นและสิ้นสุดอย่างแม่นยำ (Date Range & Expiry Check)
      var normStart = rule.startDate ? normalizeDateStr(rule.startDate) : '';
      var normEnd = rule.endDate ? normalizeDateStr(rule.endDate) : '';

      var dateMatches = true;
      if (normStart && normDate < normStart) {
        dateMatches = false; // ยังไม่ถึงวันเริ่มต้น
      }
      if (normEnd && normDate > normEnd) {
        dateMatches = false; // หมดเขต / เลยวันสิ้นสุดแล้ว (Expired)
      }

      if (dateMatches) {
        matchedRule = rule;
        var amt = parseFloat(rule.amount) || 0;
        if (rule.type === 'fixed') {
          // ราคาใหม่โดยตรง (เช่น 300 บาท/เบรค)
          effectiveWage = amt;
        } else if (rule.type === 'percent') {
          // ลดเป็นเปอร์เซ็นต์ (เช่น 10%)
          effectiveWage = baseWage * (1 - (amt / 100));
        } else {
          // หักเงินออก (เช่น หัก 50 บาท)
          effectiveWage = baseWage - amt;
        }
        if (effectiveWage < 0) effectiveWage = 0;
        break; // ใช้เงื่อนไขแรกที่ตรง
      }
    }

    // หากไม่ตรงเงื่อนไข หรือหมดช่วงวันที่กำหนด (Expired) จะ Fallback กลับมาใช้ Base Wage ทันที
    return {
      effectiveWage: matchedRule ? Math.round(effectiveWage * 100) / 100 : baseWage,
      baseWage: baseWage,
      isDiscounted: !!matchedRule,
      rule: matchedRule,
      rateType: baseInfo.rateType,
      hours: baseInfo.hours,
      dateStr: normDate,
      dow: dow
    };
  }

  return {
    normalizeDateStr: normalizeDateStr,
    getDowFromDateStr: getDowFromDateStr,
    parseMin: parseMin,
    calcHours: calcHours,
    getDiscountWageConfig: getDiscountWageConfig,
    getBaseWage: getBaseWage,
    getEffectiveWage: getEffectiveWage,
    getEffectiveWageDetail: getEffectiveWageDetail,
    DEFAULT_FALLBACK_RATE: DEFAULT_FALLBACK_RATE
  };
}));
