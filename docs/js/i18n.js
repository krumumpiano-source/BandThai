/**
 * BandFlow — i18n (Thai / English)
 * ทุก text ที่แสดงผลต้องมาจาก dictionary นี้เท่านั้น
 */
(function(global){
  'use strict';
  const LANG_KEY = 'soulciety_lang';

  const i18n = {
    th: {
      appTitle: 'Band Management', appCredit: 'BandFlow',
      langTh: 'ไทย', langEn: 'English',
      login: 'เข้าสู่ระบบ', logout: 'ออกจากระบบ', register: 'สมัครสมาชิก',
      email: 'อีเมล', password: 'รหัสผ่าน', rememberMe: 'จดจำการเข้าสู่ระบบ', forgotPassword: 'ลืมรหัสผ่าน?',
      enterEmail: 'กรุณากรอกอีเมล', enterPassword: 'กรุณากรอกรหัสผ่าน',
      noAccount: 'ยังไม่มีบัญชี?', registerNew: 'สมัครสมาชิกใหม่', haveAccount: 'มีบัญชีแล้ว?', or: 'หรือ',
      fullName: 'ชื่อ-นามสกุล', enterFullName: 'กรุณากรอกชื่อ-นามสกุล',
      confirmPassword: 'ยืนยันรหัสผ่าน', enterConfirmPassword: 'พิมพ์รหัสผ่านอีกครั้ง',
      bandName: 'ชื่อวง', enterBandName: 'กรุณากรอกชื่อวง',
      inviteCode: 'รหัสประจำวง', enterInviteCode: 'กรอกรหัส 6 หลัก',
      backToLogin: '← กลับไปเข้าสู่ระบบ', sendResetLink: 'ส่งลิงก์รีเซ็ตรหัสผ่าน',
      resetPassword: 'รีเซ็ตรหัสผ่าน', newPassword: 'รหัสผ่านใหม่', enterNewPassword: 'กรุณากรอกรหัสผ่านใหม่',
      demoLogin: 'เข้าโหมดทดสอบทันที (ไม่ต้องล็อกอิน)',
      errInvalidEmail: 'กรุณากรอกอีเมลให้ถูกต้อง', errEnterPassword: 'กรุณากรอกรหัสผ่าน',
      save: 'บันทึก', cancel: 'ยกเลิก', delete: 'ลบ', edit: 'แก้ไข', add: 'เพิ่ม', search: 'ค้นหา',
      loading: 'กำลังโหลด...', yes: 'ใช่', no: 'ไม่ใช่', ok: 'ตกลง', close: 'ปิด', back: 'กลับ', next: 'ถัดไป', submit: 'ส่ง', required: 'จำเป็น', confirm: 'ยืนยัน',
      confirmDeleteTitle: 'ยืนยันการลบ', confirmDeleteMsg: 'ต้องการลบรายการนี้ใช่หรือไม่? ไม่สามารถกู้คืนได้',
      nav_dashboard: 'หน้าหลัก', nav_songs: 'คลังเพลง', nav_attendance: 'เบิกจ่าย & ลงเวลา',
      nav_leave: 'คนลาคนแทน', nav_externalPayout: 'จ่ายคนนอก', nav_schedule: 'ตารางงาน', nav_jobCalculator: 'คำนวณราคางาน',
      nav_quotation: 'ใบเสนอราคา', nav_statistics: 'รายได้รวม',
      nav_songInsights: 'สถิติเพลง', nav_bandFund: 'เงินกองกลาง', nav_settings: 'ตั้งค่า',
      nav_bandInfo: 'ข้อมูลวง', nav_userManual: 'คู่มือ', nav_admin: 'แอดมิน',
      nav_equipment: 'อุปกรณ์', nav_clients: 'ลูกค้า', nav_myProfile: 'ข้อมูลส่วนตัว',

      // คีย์ form fields ทั่วไป
      venue: 'สถานที่', client: 'ลูกค้า/ผู้จ้าง', date: 'วันที่',
      jobType: 'ประเภทงาน', payment: 'ค่าตัว (บาท)', status: 'สถานะ', notes: 'หมายเหตุ',
      today: 'วันนี้',
      // Schedule
      addJob: 'เพิ่มงาน', editJob: 'แก้ไขงาน',
      // Attendance-Payroll
      nav_payroll: 'ตรวจสอบ/เบิกค่าตัว',
      selectJob: 'เลือกงาน', selectJobFirst: 'กรุณาเลือกงานก่อน',
      attendance: 'การเข้าร่วม',
      dash_title: 'หน้าหลัก', dash_subtitle: 'ภาพรวมวงดนตรีและสิ่งที่ต้องทำ',
      dash_todaySummary: 'สรุปด่วนวันนี้', dash_date: 'วันที่', dash_todayGigs: 'งานวันนี้',
      dash_todayMembers: 'สมาชิกทำงานวันนี้', dash_nextGig: 'งานถัดไป', dash_noJobs: 'ยังไม่มีข้อมูลงาน',
      dash_viewAllSchedule: 'ดูตารางงานทั้งหมด', dash_finance: 'การเงิน',
      upcomingJobs: 'งานที่กำลังจะมาถึง', viewAll: 'ดูทั้งหมด', financeThisMonth: 'ภาพรวมกองกลาง', quickActions: 'ทางลัด',
      dash_monthlyIncome: 'รายรับเดือนนี้', dash_pendingFromVenues: 'เงินค้างจากร้าน', dash_payToMembers: 'เงินที่ต้องจ่ายสมาชิก',
      dash_quickActions: 'การกระทำด่วน', dash_createSetlist: 'สร้างลิสเพลง', dash_logTime: 'ลงเวลางาน',
      dash_createReceipt: 'สร้างใบเบิก', dash_createQuotation: 'สร้างใบเสนอราคา', dash_manual: 'คู่มือการใช้งาน',
      dash_jobsStatus: 'งาน & สถานะงาน', dash_equipment_alert: 'อุปกรณ์ที่ต้องซ่อม',
      songs_title: 'โปรแกรมลิสเพลง', songs_subtitle: 'เลือกเพลงจากคลัง สร้างลิส คัดลอกหรือบันทึกเป็นรูป',
      songs_addSong: 'เพิ่มเพลง', songs_createSetlist: 'สร้างลิส', songs_filter: 'กรอง',
      songs_noSongs: 'ยังไม่มีเพลง', songs_selectAll: 'เลือกทั้งหมด', songs_clearAll: 'ล้างการเลือก',
      songs_copy: 'คัดลอก', songs_saveAsImage: 'บันทึกเป็นรูป', songs_transpose: 'ทรานสโพส',
      songs_name: 'ชื่อเพลง', songs_key: 'คีย์', songs_bpm: 'BPM', songs_era: 'ยุค', songs_singer: 'นักร้อง', songs_mood: 'อารมณ์',
      att_title: 'ลงเวลาและเบิกเงิน (ร้านประจำ)', att_subtitle: 'บันทึกเวลาทำงานและเบิกเงินจากร้าน',
      ext_title: 'เบิกจ่ายงานนอก', ext_subtitle: 'คำนวณและเบิกจ่ายรายคนสำหรับงานนอก/อีเวนต์',
      sched_title: 'ตารางงาน', sched_subtitle: 'ดูตารางงานทั้งรายคนและทั้งวง เพิ่มงานนอก และดูย้อนหลัง',
      sched_add: 'เพิ่มงาน', sched_venue: 'ร้าน/สถานที่', sched_date: 'วันที่', sched_time: 'เวลา',
      sched_type: 'ประเภท', sched_pay: 'ค่าตอบแทน', sched_status: 'สถานะ',
      calc_title: 'คำนวณงานนอก', calc_subtitle: 'คำนวณต้นทุนก่อนทำใบเสนอราคา',
      quot_title: 'ใบเสนอราคา', quot_subtitle: 'สร้างและจัดการใบเสนอราคา',
      quot_add: 'สร้างใบเสนอราคา', quot_clientName: 'ชื่อลูกค้า/ผู้ว่าจ้าง', quot_jobDetail: 'รายละเอียดงาน',
      quot_eventDate: 'วันจัดงาน', quot_eventType: 'ประเภทงาน', quot_venue: 'สถานที่',
      quot_items: 'รายการ', quot_subtotal: 'ราคาก่อน VAT', quot_vat: 'VAT (%)', quot_total: 'รวมทั้งสิ้น',
      quot_status_draft: 'ร่าง', quot_status_sent: 'ส่งแล้ว', quot_status_approved: 'อนุมัติ', quot_status_rejected: 'ปฏิเสธ',
      quot_generatePdf: 'สร้าง PDF', quot_list: 'รายการใบเสนอราคา', quot_noData: 'ยังไม่มีใบเสนอราคา',
      cont_title: 'สัญญาว่าจ้างวงดนตรี', cont_subtitle: 'ดูสัญญา สร้างสัญญาใหม่ หรือสร้างจากใบเสนอราคา',
      stat_title: 'สถิติ', stat_subtitle: 'ภาพรวมวง รายคน รายร้าน และสถิติเพลง',
      fund_title: 'เงินกองกลางวง', fund_subtitle: 'จัดการเงินทิป เงินสะสม และเงินช่วยเหลือสมาชิก',
      set_title: 'ตั้งค่าวง', set_subtitle: 'จัดการข้อมูลวง ร้าน สมาชิก และการตั้งค่า',
      bandinfo_title: 'ข้อมูลวง', bandinfo_subtitle: 'ดูข้อมูลวงและรายชื่อสมาชิกทั้งหมด',
      equip_title: 'อุปกรณ์และเครื่องดนตรี', equip_subtitle: 'จัดการอุปกรณ์ เครื่องดนตรี และติดตามสถานะ',
      equip_add: 'เพิ่มอุปกรณ์', equip_name: 'ชื่ออุปกรณ์', equip_type: 'ประเภท', equip_owner: 'เจ้าของ',
      equip_serial: 'Serial No.', equip_purchaseDate: 'วันที่ซื้อ', equip_price: 'ราคา',
      equip_status: 'สถานะ', equip_notes: 'หมายเหตุ', equip_noData: 'ยังไม่มีอุปกรณ์',
      equip_status_normal: 'ปกติ', equip_status_repair: 'ซ่อม', equip_status_broken: 'เสีย',
      equip_type_instrument: 'เครื่องดนตรี', equip_type_audio: 'ระบบเสียง', equip_type_lighting: 'ไฟ/แสง',
      equip_type_accessory: 'อุปกรณ์เสริม', equip_type_other: 'อื่นๆ',
      client_title: 'ข้อมูลลูกค้า', client_subtitle: 'จัดการข้อมูลผู้ว่าจ้างและประวัติการจ้าง',
      client_add: 'เพิ่มลูกค้า', client_name: 'ชื่อลูกค้า', client_company: 'บริษัท/องค์กร',
      client_contact: 'ผู้ติดต่อ', client_phone: 'เบอร์โทร', client_email: 'อีเมล',
      client_lineId: 'LINE ID', client_address: 'ที่อยู่', client_notes: 'หมายเหตุ',
      client_totalGigs: 'งานทั้งหมด', client_totalRevenue: 'รายรับรวม', client_noData: 'ยังไม่มีข้อมูลลูกค้า',
      manual_title: 'คู่มือการใช้งาน', manual_subtitle: 'วิธีใช้งาน BandFlow',
      admin_title: 'ตั้งค่าแอดมินระบบ', admin_denied: 'คุณไม่มีสิทธิ์เข้าหน้านี้',
      terms_title: 'ข้อกำหนดและเงื่อนไข', terms_link: 'ข้อกำหนดและเงื่อนไขการใช้งาน',
      msg_saveSuccess: 'บันทึกเรียบร้อยแล้ว ✓', msg_error: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
      msg_deleteSuccess: 'ลบเรียบร้อยแล้ว', msg_loading: 'กำลังโหลด...', msg_noData: 'ไม่มีข้อมูล',
      msg_confirmDelete: 'ต้องการลบรายการนี้ใช่หรือไม่?',
      msg_saved: 'บันทึกเรียบร้อย', msg_deleted: 'ลบเรียบร้อย', noData: 'ไม่มีข้อมูล',
      unit_baht: 'บาท', unit_people: 'คน', unit_gigs: 'งาน', unit_items: 'รายการ',
      yourBand: 'วงของคุณ', user: 'ผู้ใช้',
      placeholderSearch: 'ค้นหา...', placeholderSelect: 'เลือก...',
    },
    en: {
      appTitle: 'Band Management', appCredit: 'BandFlow',
      langTh: 'Thai', langEn: 'English',
      login: 'Login', logout: 'Logout', register: 'Register',
      email: 'Email', password: 'Password', rememberMe: 'Remember me', forgotPassword: 'Forgot password?',
      enterEmail: 'Enter your email', enterPassword: 'Enter your password',
      noAccount: "Don't have an account?", registerNew: 'Register now', haveAccount: 'Have an account?', or: 'or',
      fullName: 'Full Name', enterFullName: 'Enter full name',
      confirmPassword: 'Confirm Password', enterConfirmPassword: 'Re-enter password',
      bandName: 'Band Name', enterBandName: 'Enter band name',
      inviteCode: 'Band Code', enterInviteCode: 'Enter 6-digit code',
      backToLogin: '← Back to Login', sendResetLink: 'Send Reset Link',
      resetPassword: 'Reset Password', newPassword: 'New Password', enterNewPassword: 'Enter new password',
      demoLogin: 'Enter Demo Mode (no login required)',
      errInvalidEmail: 'Please enter a valid email', errEnterPassword: 'Please enter your password',
      save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add', search: 'Search',
      loading: 'Loading...', yes: 'Yes', no: 'No', ok: 'OK', close: 'Close', back: 'Back', next: 'Next', submit: 'Submit', required: 'Required', confirm: 'Confirm',
      confirmDeleteTitle: 'Confirm Delete', confirmDeleteMsg: 'Are you sure you want to delete this item? This cannot be undone.',
      nav_dashboard: 'Dashboard', nav_songs: 'Songs & Setlist', nav_attendance: 'Payroll (Manager)',
      nav_leave: 'Leave & Substitute', nav_externalPayout: 'External Payout', nav_schedule: 'Schedule', nav_jobCalculator: 'Job Calculator',
      nav_quotation: 'Quotation', nav_statistics: 'Statistics',
      nav_songInsights: 'Song Insights', nav_bandFund: 'Band Fund', nav_settings: 'Settings',
      nav_bandInfo: 'Band Info', nav_userManual: 'User Manual', nav_admin: 'Admin',
      nav_equipment: 'Equipment', nav_clients: 'Clients', nav_myProfile: 'My Profile',

      // Common form fields
      venue: 'Venue', client: 'Client/Booker', date: 'Date',
      jobType: 'Job Type', payment: 'Pay (THB)', status: 'Status', notes: 'Notes',
      today: 'Today',
      // Schedule
      addJob: 'Add Gig', editJob: 'Edit Gig',
      // Attendance-Payroll
      nav_payroll: 'Check Payroll',
      selectJob: 'Select Gig', selectJobFirst: 'Please select a gig first',
      attendance: 'Attendance',
      dash_title: 'Dashboard', dash_subtitle: 'Band overview and tasks',
      dash_todaySummary: "Today's Summary", dash_date: 'Date', dash_todayGigs: "Today's Gigs",
      dash_todayMembers: 'Members Today', dash_nextGig: 'Next Gig', dash_noJobs: 'No jobs yet',
      dash_viewAllSchedule: 'View full schedule', dash_finance: 'Finance',
      upcomingJobs: 'Upcoming Jobs', viewAll: 'View All', financeThisMonth: 'Fund Overview', quickActions: 'Quick Actions',
      dash_monthlyIncome: 'Monthly Income', dash_pendingFromVenues: 'Pending from venues', dash_payToMembers: 'Pay to members',
      dash_quickActions: 'Quick Actions', dash_createSetlist: 'Create Setlist', dash_logTime: 'Log Time',
      dash_createReceipt: 'Create Receipt', dash_createQuotation: 'Create Quotation', dash_manual: 'User Manual',
      dash_jobsStatus: 'Jobs & Status', dash_equipment_alert: 'Equipment needs repair',
      songs_title: 'Songs & Setlist', songs_subtitle: 'Select from library, create setlist, copy or save as image',
      songs_addSong: 'Add Song', songs_createSetlist: 'Create Setlist', songs_filter: 'Filter',
      songs_noSongs: 'No songs yet', songs_selectAll: 'Select All', songs_clearAll: 'Clear All',
      songs_copy: 'Copy', songs_saveAsImage: 'Save as Image', songs_transpose: 'Transpose',
      songs_name: 'Song Name', songs_key: 'Key', songs_bpm: 'BPM', songs_era: 'Era', songs_singer: 'Singer', songs_mood: 'Mood',
      att_title: 'Attendance & Payroll', att_subtitle: 'Log work hours and claim pay from venues',
      ext_title: 'External Payout', ext_subtitle: 'Calculate and pay per member for external/event gigs',
      sched_title: 'Schedule', sched_subtitle: 'View schedule by person or band, add gigs, view history',
      sched_add: 'Add Gig', sched_venue: 'Venue', sched_date: 'Date', sched_time: 'Time',
      sched_type: 'Type', sched_pay: 'Pay', sched_status: 'Status',
      calc_title: 'Job Calculator', calc_subtitle: 'Calculate cost before creating quotation',
      quot_title: 'Quotation', quot_subtitle: 'Create and manage quotations',
      quot_add: 'Create Quotation', quot_clientName: 'Client/Venue Name', quot_jobDetail: 'Job Details',
      quot_eventDate: 'Event Date', quot_eventType: 'Event Type', quot_venue: 'Venue',
      quot_items: 'Items', quot_subtotal: 'Subtotal', quot_vat: 'VAT (%)', quot_total: 'Total',
      quot_status_draft: 'Draft', quot_status_sent: 'Sent', quot_status_approved: 'Approved', quot_status_rejected: 'Rejected',
      quot_generatePdf: 'Generate PDF', quot_list: 'Quotation List', quot_noData: 'No quotations yet',
      cont_title: 'Band Contract', cont_subtitle: 'View contracts, create new, or create from quotation',
      stat_title: 'Statistics', stat_subtitle: 'Band overview, per person, per venue, song stats',
      fund_title: 'Band Fund', fund_subtitle: 'Manage tips, savings, and member loans',
      set_title: 'Band Settings', set_subtitle: 'Manage band info, venues, members, and settings',
      bandinfo_title: 'Band Info', bandinfo_subtitle: 'View band information and all members',
      equip_title: 'Equipment & Instruments', equip_subtitle: 'Manage equipment, instruments and track status',
      equip_add: 'Add Equipment', equip_name: 'Equipment Name', equip_type: 'Type', equip_owner: 'Owner',
      equip_serial: 'Serial No.', equip_purchaseDate: 'Purchase Date', equip_price: 'Price',
      equip_status: 'Status', equip_notes: 'Notes', equip_noData: 'No equipment yet',
      equip_status_normal: 'Normal', equip_status_repair: 'In Repair', equip_status_broken: 'Broken',
      equip_type_instrument: 'Instrument', equip_type_audio: 'Audio System', equip_type_lighting: 'Lighting',
      equip_type_accessory: 'Accessory', equip_type_other: 'Other',
      client_title: 'Clients', client_subtitle: 'Manage client information and booking history',
      client_add: 'Add Client', client_name: 'Client Name', client_company: 'Company/Organization',
      client_contact: 'Contact Person', client_phone: 'Phone', client_email: 'Email',
      client_lineId: 'LINE ID', client_address: 'Address', client_notes: 'Notes',
      client_totalGigs: 'Total Gigs', client_totalRevenue: 'Total Revenue', client_noData: 'No clients yet',
      manual_title: 'User Manual', manual_subtitle: 'How to use BandFlow',
      admin_title: 'Admin Settings', admin_denied: 'You do not have permission to access this page',
      terms_title: 'Terms and Conditions', terms_link: 'Terms and Conditions',
      msg_saveSuccess: 'Saved successfully ✓', msg_error: 'An error occurred. Please try again.',
      msg_deleteSuccess: 'Deleted successfully', msg_loading: 'Loading...', msg_noData: 'No data available',
      msg_confirmDelete: 'Are you sure you want to delete this item?',
      msg_saved: 'Saved', msg_deleted: 'Deleted', noData: 'No data',
      unit_baht: 'THB', unit_people: 'people', unit_gigs: 'gigs', unit_items: 'items',
      yourBand: 'Your Band', user: 'User',
      placeholderSearch: 'Search...', placeholderSelect: 'Select...',
    }
  };

  function getLang() {
    try { return localStorage.getItem(LANG_KEY) || 'th'; } catch(e) { return 'th'; }
  }
  function setLang(lang) {
    try {
      localStorage.setItem(LANG_KEY, lang === 'en' ? 'en' : 'th');
      if (typeof window.applyTranslations === 'function') window.applyTranslations();
    } catch(e) {}
  }
  function t(key) {
    var lang = getLang();
    var dict = i18n[lang] || i18n.th;
    return dict[key] !== undefined ? dict[key] : (i18n.th[key] || key);
  }
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  global.i18n = i18n;
  global.getLang = getLang;
  global.setLang = setLang;
  global.t = t;
  global.escapeHtml = escapeHtml;
})(typeof window !== 'undefined' ? window : this);
