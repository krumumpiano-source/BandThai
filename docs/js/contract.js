/* ── Equipment checkboxes ── */
  var EQUIP_LIST = [
    'ระบบเสียง (PA System)', 'ไมโครโฟน', 'เวที (Stage)', 'ไฟเวที (Stage Lighting)',
    'จอแสดงผล (LED Screen)', 'โต๊ะผสมเสียง (Mixer)', 'ไฟฟ้าสำรอง (Generator)',
    'ห้องพักสำหรับวง', 'อาหารสำหรับวง', 'ที่จอดรถ'
  ];

  document.addEventListener('DOMContentLoaded', function(){
    requireAuth();
      checkAdGate();
    renderMainNav('mainNav');
    if (typeof applyTranslations === 'function') applyTranslations();

    // Build equipment checkboxes
    var wrap = document.getElementById('equipCheckboxes');
    EQUIP_LIST.forEach(function(eq, i){
      wrap.innerHTML += '<label style="display:flex;align-items:center;gap:4px;font-size:var(--text-xs);cursor:pointer">'
        +'<input type="checkbox" id="eq_'+i+'" onchange="renderContract()" style="accent-color:var(--premium-gold)"> '+escapeHtml(eq)+'</label>';
    });

    // Set defaults
    document.getElementById('ctContractDate').value = new Date().toISOString().substring(0,10);
    document.getElementById('ctParty2Name').value   = localStorage.getItem('bandName') || 'วงดนตรี';
    document.getElementById('ctParty2Phone').value  = localStorage.getItem('bandPhone') || '';
    document.getElementById('ctParty2Address').value = localStorage.getItem('bandAddress') || '';

    // Load contract data from localStorage
    var cData = null;
    try { cData = JSON.parse(localStorage.getItem('contractData') || 'null'); } catch(e){}
    if (cData) applyContractData(cData);

    renderContract();
  });

  function applyContractData(d){
    if (d.client)       document.getElementById('ctParty1Name').value  = d.client;
    if (d.clientPhone)  document.getElementById('ctParty1Phone').value = d.clientPhone;
    if (d.jobName)      document.getElementById('ctJobName').value     = d.jobName;
    if (d.eventDate)    document.getElementById('ctEventDate').value   = d.eventDate;
    if (d.eventTime)    document.getElementById('ctEventTime').value   = d.eventTime;
    if (d.venue)        document.getElementById('ctVenue').value       = d.venue;
    if (d.members)      document.getElementById('ctMembers').value     = d.members;
    if (d.total)        document.getElementById('ctFee').value         = d.total;
    if (d.paymentTerm)  document.getElementById('ctPayWhen').value     = d.paymentTerm;
    if (d.notes)        document.getElementById('ctSpecial').value     = d.notes;

    // From calcData
    var cd = d.calcData;
    if (cd) {
      if (cd.showHours && cd.showSessions) {
        document.getElementById('ctShowDuration').value =
          cd.showHours + ' ชั่วโมง ' + cd.showSessions + ' รอบ'
          + (cd.breakMins ? ' พัก ' + cd.breakMins + ' นาที' : '');
      }
      if (cd.members && cd.members.length) {
        document.getElementById('ctMembers').value = cd.members.length + ' คน ('
          + cd.members.map(function(m){ return m.name + (m.instrument ? ' '+m.instrument : ''); }).join(', ') + ')';
      }
      if (cd.proposedPrice) {
        document.getElementById('ctFee').value = cd.proposedPrice;
        var dep = Math.round(cd.proposedPrice * 0.3 / 100) * 100;
        document.getElementById('ctDeposit').value    = dep;
        document.getElementById('ctRemaining').value  = cd.proposedPrice - dep;
      }
      if (cd.hasAccommodation) {
        var accomIdx = EQUIP_LIST.indexOf('ห้องพักสำหรับวง');
        if (accomIdx >= 0) { var el = document.getElementById('eq_'+accomIdx); if (el) el.checked = true; }
      }
      if (cd.hasFood) {
        var foodIdx = EQUIP_LIST.indexOf('อาหารสำหรับวง');
        if (foodIdx >= 0) { var el2 = document.getElementById('eq_'+foodIdx); if (el2) el2.checked = true; }
      }
    }
    // Auto-calculate deposit if not set
    autoCalcDeposit();
  }

  function autoCalcDeposit(){
    var fee = parseFloat(document.getElementById('ctFee').value) || 0;
    var dep = parseFloat(document.getElementById('ctDeposit').value) || 0;
    if (fee > 0 && dep === 0) {
      var newDep = Math.round(fee * 0.3 / 100) * 100;
      document.getElementById('ctDeposit').value   = newDep;
      document.getElementById('ctRemaining').value = fee - newDep;
    }
  }

  /* ── Read form values ── */
  function getContractValues(){
    var fee       = parseFloat(document.getElementById('ctFee').value) || 0;
    var deposit   = parseFloat(document.getElementById('ctDeposit').value) || 0;
    var remaining = parseFloat(document.getElementById('ctRemaining').value) || (fee - deposit);
    var equip = [];
    EQUIP_LIST.forEach(function(eq, i){
      var el = document.getElementById('eq_'+i);
      if (el && el.checked) equip.push(eq);
    });
    var equipOther = document.getElementById('ctEquipOther').value.trim();
    if (equipOther) equip.push(equipOther);

    var eventDateVal = document.getElementById('ctEventDate').value;
    var thEventDate  = eventDateVal ? new Date(eventDateVal).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}) : '___________';
    var depDateVal   = document.getElementById('ctDepositDate').value;
    var thDepDate    = depDateVal   ? new Date(depDateVal).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}) : '___________';
    var ctDateVal    = document.getElementById('ctContractDate').value;
    var thCtDate     = ctDateVal    ? new Date(ctDateVal).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}) : '___________';

    return {
      contractDate:   thCtDate,
      contractPlace:  document.getElementById('ctContractPlace').value.trim() || '___________',
      party1Name:     document.getElementById('ctParty1Name').value.trim()    || '___________',
      party1Address:  document.getElementById('ctParty1Address').value.trim() || '___________',
      party1Id:       document.getElementById('ctParty1Id').value.trim()      || '___________',
      party1Phone:    document.getElementById('ctParty1Phone').value.trim()   || '___________',
      party2Name:     document.getElementById('ctParty2Name').value.trim()    || '___________',
      party2Rep:      document.getElementById('ctParty2Rep').value.trim()     || '___________',
      party2Address:  document.getElementById('ctParty2Address').value.trim() || '___________',
      party2Phone:    document.getElementById('ctParty2Phone').value.trim()   || '___________',
      jobName:        document.getElementById('ctJobName').value.trim()       || '___________',
      eventDate:      thEventDate,
      eventTime:      document.getElementById('ctEventTime').value            || '___________',
      venue:          document.getElementById('ctVenue').value.trim()         || '___________',
      showDuration:   document.getElementById('ctShowDuration').value.trim()  || '___________',
      members:        document.getElementById('ctMembers').value.trim()       || '___________',
      fee:            fee,
      deposit:        deposit,
      depositDate:    thDepDate,
      remaining:      remaining,
      payWhen:        document.getElementById('ctPayWhen').value,
      payMethod:      document.getElementById('ctPayMethod').value,
      bankInfo:       document.getElementById('ctBankInfo').value.trim(),
      equip:          equip,
      special:        document.getElementById('ctSpecial').value.trim()
    };
  }

  /* ── Build contract HTML ── */
  function buildContractHtml(v){
    var fmtThb = function(n){ return n.toLocaleString('th-TH') + ' บาท'; };
    function numToThaiText(n){
      // Simple formatter for common amounts
      return n.toLocaleString('th-TH') + ' บาทถ้วน';
    }

    var equipHtml = v.equip.length
      ? '<ul>'+v.equip.map(function(e){ return '<li>'+escapeHtml(e)+'</li>'; }).join('')+'</ul>'
      : '<ul><li>ระบบเสียง (PA System) และไมโครโฟน</li></ul>';

    var specialHtml = v.special
      ? '<div class="ct-clause"><div class="ct-clause-num">เงื่อนไขพิเศษ:</div>'
        +'<div>'+escapeHtml(v.special).replace(/\n/g,'<br>')+'</div></div>'
      : '';

    var bankHtml = v.bankInfo
      ? '<div class="ct-row"><span class="ct-label">ข้อมูลบัญชีรับเงิน:</span><span class="ct-val">'+escapeHtml(v.bankInfo)+'</span></div>'
      : '';

    return '<div class="ct-doc" style="position:relative">'
      + '<div class="ct-watermark">สัญญา</div>'
      + '<h1>สัญญาจ้างวงดนตรี</h1>'
      + '<div class="ct-subtitle">(Band Entertainment Services Agreement)</div>'
      + '<div class="ct-date">ทำที่ '+escapeHtml(v.contractPlace)+'&nbsp;&nbsp;&nbsp;วันที่ '+escapeHtml(v.contractDate)+'</div>'

      // Preamble
      + '<p>สัญญาฉบับนี้ทำขึ้นระหว่างคู่สัญญาสองฝ่าย ดังต่อไปนี้</p>'

      // Party 1
      + '<div class="ct-party-box">'
      + '<div class="ct-party-title">ฝ่ายที่ 1 — ผู้ว่าจ้าง</div>'
      + '<div class="ct-row"><span class="ct-label">ชื่อ:</span><span class="ct-val">'+escapeHtml(v.party1Name)+'</span></div>'
      + '<div class="ct-row"><span class="ct-label">ที่อยู่:</span><span class="ct-val">'+escapeHtml(v.party1Address)+'</span></div>'
      + '<div class="ct-row"><span class="ct-label">เลขบัตรฯ / เลขนิติบุคคล:</span><span class="ct-val">'+escapeHtml(v.party1Id)+'</span></div>'
      + '<div class="ct-row"><span class="ct-label">โทรศัพท์:</span><span class="ct-val">'+escapeHtml(v.party1Phone)+'</span></div>'
      + '</div>'

      // Party 2
      + '<div class="ct-party-box">'
      + '<div class="ct-party-title">ฝ่ายที่ 2 — ผู้รับจ้าง (วงดนตรี)</div>'
      + '<div class="ct-row"><span class="ct-label">ชื่อวง:</span><span class="ct-val">'+escapeHtml(v.party2Name)+'</span></div>'
      + '<div class="ct-row"><span class="ct-label">ผู้แทน / หัวหน้าวง:</span><span class="ct-val">'+escapeHtml(v.party2Rep)+'</span></div>'
      + '<div class="ct-row"><span class="ct-label">ที่อยู่:</span><span class="ct-val">'+escapeHtml(v.party2Address)+'</span></div>'
      + '<div class="ct-row"><span class="ct-label">โทรศัพท์:</span><span class="ct-val">'+escapeHtml(v.party2Phone)+'</span></div>'
      + '</div>'

      + '<p>คู่สัญญาทั้งสองฝ่ายได้ตกลงทำสัญญากันด้วยความสมัครใจ โดยมีข้อกำหนดและเงื่อนไขดังต่อไปนี้</p>'

      // Clause 1: Job details
      + '<div class="ct-section-title">ข้อ 1 — รายละเอียดงาน</div>'
      + '<div class="ct-clause">'
      + '<div class="ct-row"><span class="ct-label">ชื่องาน / อีเวนต์:</span><span class="ct-val">'+escapeHtml(v.jobName)+'</span></div>'
      + '<div class="ct-row"><span class="ct-label">วันที่แสดง:</span><span class="ct-val">'+escapeHtml(v.eventDate)+'</span></div>'
      + '<div class="ct-row"><span class="ct-label">เวลาเริ่มแสดง:</span><span class="ct-val">'+escapeHtml(v.eventTime)+' น.</span></div>'
      + '<div class="ct-row"><span class="ct-label">สถานที่:</span><span class="ct-val">'+escapeHtml(v.venue)+'</span></div>'
      + '<div class="ct-row"><span class="ct-label">ระยะเวลาการแสดง:</span><span class="ct-val">'+escapeHtml(v.showDuration)+'</span></div>'
      + '<div class="ct-row"><span class="ct-label">จำนวนนักดนตรี:</span><span class="ct-val">'+escapeHtml(v.members)+'</span></div>'
      + '</div>'

      // Clause 2: Fee
      + '<div class="ct-section-title">ข้อ 2 — ค่าจ้างและการชำระเงิน</div>'
      + '<div class="ct-clause">'
      + '<div class="ct-highlight-box">ค่าจ้างรวมทั้งสิ้น: <span style="color:#8b6914;font-size:16px">'+fmtThb(v.fee)+' ('+numToThaiText(v.fee)+')</span></div>'
      + (v.deposit > 0
          ? '<p>2.1 ผู้ว่าจ้างตกลงชำระ<b>เงินมัดจำ '+fmtThb(v.deposit)+'</b> ภายในวันที่ '+escapeHtml(v.depositDate)+' เพื่อเป็นการยืนยันการจอง</p>'
          + '<p>2.2 ยอดที่เหลือ<b> '+fmtThb(v.remaining)+'</b> ชำระ'+escapeHtml(v.payWhen)+'</p>'
          : '<p>ผู้ว่าจ้างตกลงชำระค่าจ้างเต็มจำนวน '+fmtThb(v.fee)+' โดย'+escapeHtml(v.payWhen)+'</p>')
      + '<p>วิธีชำระเงิน: '+escapeHtml(v.payMethod)+'</p>'
      + bankHtml
      + '</div>'

      // Clause 3: Responsibilities of party 1
      + '<div class="ct-section-title">ข้อ 3 — หน้าที่ผู้ว่าจ้าง (ฝ่ายที่ 1)</div>'
      + '<div class="ct-clause">'
      + '3.1 ผู้ว่าจ้างมีหน้าที่จัดเตรียมสิ่งต่อไปนี้ให้พร้อมก่อนเวลาแสดงอย่างน้อย 2 ชั่วโมง:'
      + equipHtml
      + '3.2 ผู้ว่าจ้างต้องจัดสถานที่ให้มีสภาพแวดล้อมเหมาะสมและปลอดภัยในการแสดง<br>'
      + '3.3 ผู้ว่าจ้างยินยอมให้ผู้รับจ้างเข้าถึงสถานที่เพื่อติดตั้งอุปกรณ์ล่วงหน้าอย่างน้อย 2 ชั่วโมง<br>'
      + '3.4 หากผู้ว่าจ้างขอยืดระยะเวลาการแสดงเกินกว่าที่ระบุไว้ ต้องแจ้งล่วงหน้าและตกลงค่าตอบแทนเพิ่มเติมกับผู้รับจ้างก่อน<br>'
      + '</div>'

      // Clause 4: Responsibilities of party 2
      + '<div class="ct-section-title">ข้อ 4 — หน้าที่ผู้รับจ้าง (ฝ่ายที่ 2)</div>'
      + '<div class="ct-clause">'
      + '4.1 ผู้รับจ้างตกลงจัดส่งนักดนตรีให้ครบตามจำนวนที่ระบุในสัญญา และพร้อมแสดงตามเวลาที่กำหนด<br>'
      + '4.2 ผู้รับจ้างจะแสดงดนตรีด้วยความเป็นมืออาชีพ สมดุลระดับเสียง และสุภาพต่อผู้ชม<br>'
      + '4.3 ผู้รับจ้างจะรับผิดชอบอุปกรณ์ดนตรีของตนเอง แต่ไม่รับผิดชอบต่ออุปกรณ์ของผู้ว่าจ้างหรือสถานที่<br>'
      + '4.4 ในกรณีที่นักดนตรีคนใดไม่สามารถมาได้ด้วยเหตุสุดวิสัย ผู้รับจ้างจะหานักดนตรีทดแทนในระดับเดียวกัน<br>'
      + '</div>'

      // Clause 5: Cancellation
      + '<div class="ct-section-title">ข้อ 5 — การยกเลิกและค่าชดเชย</div>'
      + '<div class="ct-clause">'
      + '<p><b>5.1 กรณีผู้ว่าจ้างเป็นผู้ยกเลิก:</b></p>'
      + '<ul>'
      + '<li>ยกเลิกล่วงหน้า 30 วันขึ้นไป: <b>ไม่คืนเงินมัดจำ</b></li>'
      + '<li>ยกเลิกล่วงหน้า 15–29 วัน: ผู้ว่าจ้างชำระค่าชดเชย <b>50% ของค่าจ้างทั้งหมด</b></li>'
      + '<li>ยกเลิกล่วงหน้าน้อยกว่า 15 วัน: ผู้ว่าจ้างชำระค่าชดเชย <b>80% ของค่าจ้างทั้งหมด</b></li>'
      + '<li>ยกเลิกในวันงาน: ผู้ว่าจ้างชำระค่าจ้าง <b>เต็มจำนวน</b></li>'
      + '</ul>'
      + '<p><b>5.2 กรณีผู้รับจ้างเป็นผู้ยกเลิก:</b> ผู้รับจ้างต้องคืนเงินมัดจำทั้งหมดและชำระค่าชดเชยเพิ่มเติมไม่น้อยกว่า 20% ของค่าจ้างรวม</p>'
      + '</div>'

      // Clause 6: Force majeure
      + '<div class="ct-section-title">ข้อ 6 — เหตุสุดวิสัย</div>'
      + '<div class="ct-clause">'
      + '<p>หากมีเหตุสุดวิสัยซึ่งอยู่นอกเหนือการควบคุมของคู่สัญญา เช่น ภัยธรรมชาติ โรคระบาด การประกาศภาวะฉุกเฉิน หรือเหตุการณ์ที่ทำให้ไม่สามารถจัดงานได้ คู่สัญญาจะร่วมกันพิจารณาการเลื่อนวันงานหรือยกเลิกสัญญาโดยไม่ถือว่าฝ่ายใดผิดสัญญา และจะทำการคืนเงินตามที่ตกลงกัน</p>'
      + '</div>'

      // Clause 7: Dispute
      + '<div class="ct-section-title">ข้อ 7 — การระงับข้อพิพาท</div>'
      + '<div class="ct-clause">'
      + '<p>ข้อพิพาทที่เกิดขึ้นจากสัญญานี้ คู่สัญญาจะพยายามระงับโดยการเจรจาก่อน หากไม่สามารถตกลงได้ภายใน 30 วัน ให้นำข้อพิพาทเสนอต่อศาลที่มีเขตอำนาจตามกฎหมายไทย</p>'
      + '</div>'

      // Special conditions
      + (v.special ? '<div class="ct-section-title">ข้อ 8 — เงื่อนไขพิเศษ</div><div class="ct-clause">'+escapeHtml(v.special).replace(/\n/g,'<br>')+'</div>' : '')

      + '<p style="margin-top:20px">สัญญาฉบับนี้ทำขึ้นสองฉบับ มีข้อความตรงกัน คู่สัญญาได้อ่านและเข้าใจข้อความในสัญญาโดยตลอดแล้ว จึงได้ลงลายมือชื่อไว้เป็นหลักฐาน</p>'

      // Signatures
      + '<div class="ct-sig-row">'
      + '<div class="ct-sig-box">'
        + '<div class="ct-sig-line"></div>'
        + '<div class="ct-sig-name">('+escapeHtml(v.party1Name)+')</div>'
        + '<div>ฝ่ายที่ 1 — ผู้ว่าจ้าง</div>'
        + '<div class="ct-sig-date">วันที่ ___________________</div>'
      + '</div>'
      + '<div class="ct-sig-box">'
        + '<div class="ct-sig-line"></div>'
        + '<div class="ct-sig-name">('+escapeHtml(v.party2Rep||v.party2Name)+')</div>'
        + '<div>ฝ่ายที่ 2 — ผู้รับจ้าง / หัวหน้าวง '+escapeHtml(v.party2Name)+'</div>'
        + '<div class="ct-sig-date">วันที่ ___________________</div>'
      + '</div>'
      + '</div>'

      // Witnesses
      + '<div style="margin-top:20px;font-size:12px;color:#666;font-weight:700">พยาน</div>'
      + '<div class="ct-witness">'
      + '<div class="ct-witness-box" style="border-top:1px solid #999;padding-top:40px;margin-top:40px"><div>พยานฝ่ายที่ 1</div><div style="font-size:11px;color:#888">วันที่ ___________________</div></div>'
      + '<div class="ct-witness-box" style="border-top:1px solid #999;padding-top:40px;margin-top:40px"><div>พยานฝ่ายที่ 2</div><div style="font-size:11px;color:#888">วันที่ ___________________</div></div>'
      + '</div>'

      + '<div class="ct-footer">สัญญาจ้างวงดนตรี '+escapeHtml(v.party2Name)+' — สร้างด้วย BandThai</div>'
      + '</div>';
  }

  /* ── Render ── */
  function renderContract(){
    var v = getContractValues();
    var html = buildContractHtml(v);
    document.getElementById('ctPreviewWrap').innerHTML = html;
    document.getElementById('ctDoc').innerHTML = html;
    // Auto-calc remaining
    var fee = parseFloat(document.getElementById('ctFee').value) || 0;
    var dep = parseFloat(document.getElementById('ctDeposit').value) || 0;
    var remEl = document.getElementById('ctRemaining');
    if (fee > 0 && dep >= 0) remEl.value = fee - dep;
  }

  /* ── Print ── */
  function doPrint(){
    var v = getContractValues();
    document.getElementById('ctDoc').innerHTML = buildContractHtml(v);
    document.getElementById('ctDoc').style.display = 'block';
    window.print();
    setTimeout(function(){ document.getElementById('ctDoc').style.display = 'none'; }, 1000);
  }

  /* ── Confirm Contract → สร้าง External Job ── */
  function confirmContract(){
    var v = getContractValues();
    if (!v.jobName || v.jobName === '___________') {
      showToast('กรุณากรอกชื่องานก่อนยืนยันสัญญา', 'error'); return;
    }
    if (!v.eventDate || v.eventDate === '___________') {
      showToast('กรุณาระบุวันที่งานก่อนยืนยัน', 'error'); return;
    }

    var btn = document.getElementById('confirmContractBtn');
    btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...';

    // ดึง rawDate จาก input โดยตรง
    var rawDate = document.getElementById('ctEventDate').value;
    var rawTime = document.getElementById('ctEventTime').value || '';

    // แยก start/end จาก eventTime เช่น "18:00-22:00" หรือ "18:00"
    var startTime = '', endTime = '';
    var timeParts = rawTime.split('-');
    if (timeParts.length >= 2) { startTime = timeParts[0].trim(); endTime = timeParts[1].trim(); }
    else if (timeParts.length === 1 && timeParts[0]) { startTime = timeParts[0].trim(); }

    // ดึง calcData จาก contractData ใน localStorage
    var cd = null;
    try { var cRaw = JSON.parse(localStorage.getItem('contractData') || 'null'); if (cRaw) cd = cRaw.calcData; } catch(e){}

    // สร้าง member_fees array จาก calcData.members
    var memberFees = [];
    if (cd && cd.members && cd.members.length) {
      memberFees = cd.members.map(function(m) {
        return {
          memberId:      m.memberId || m.id || '',
          name:          m.name || '',
          instrument:    m.instrument || '',
          fee:           m.fee || 0,
          paid:          false,
          paidDate:      '',
          paymentMethod: ''
        };
      });
    }

    // travel / accommodation / food จาก calcData
    var travelInfo = cd ? {
      origin:      cd.origin      || '',
      destination: cd.destination || '',
      distanceKm:  cd.distanceKm  || 0,
      vehicles:    cd.vehicles    || [],
      travelCost:  cd.travelCost  || 0
    } : {};

    var accommodation = cd ? {
      hasAccom:   !!cd.hasAccommodation,
      hotel:      cd.hotel    || '',
      rooms:      cd.rooms    || 0,
      nights:     cd.nights   || 0,
      accomCost:  cd.accomCost || 0
    } : {};

    var foodInfo = cd ? {
      hasFood:   !!cd.hasFood,
      people:    cd.foodPeople || 0,
      meals:     cd.foodMeals  || 0,
      days:      cd.foodDays   || 0,
      foodCost:  cd.foodCost   || 0
    } : {};

    var otherExpenses = cd ? ((cd.travelCost || 0) + (cd.accomCost || 0) + (cd.foodCost || 0)) : 0;
    var bandFundCut   = cd ? (cd.fundAmount || 0) : 0;

    var payload = {
      job_name:          document.getElementById('ctJobName').value.trim() || v.jobName,
      client_name:       v.party1Name !== '___________' ? v.party1Name : '',
      client_phone:      v.party1Phone !== '___________' ? v.party1Phone : '',
      venue:             v.venue !== '___________' ? v.venue : '',
      venue_address:     document.getElementById('ctParty1Address') ? '' : '',
      event_date:        rawDate,
      start_time:        startTime,
      end_time:          endTime,
      show_duration:     v.showDuration !== '___________' ? v.showDuration : '',
      total_fee:         v.fee || 0,
      band_fund_cut:     bandFundCut,
      other_expenses:    otherExpenses,
      member_fees:       memberFees,
      travel_info:       travelInfo,
      accommodation:     accommodation,
      food_info:         foodInfo,
      status:            'confirmed',
      payout_status:     'pending',
      notes:             v.special || ''
    };

    apiCall('addExternalJob', payload, function(r) {
      btn.disabled = false;
      btn.innerHTML = '✅ ยืนยันสัญญา &amp; สร้างงานนอก';
      if (r && r.success) {
        var jobId = (r.data && r.data.id) || '';
        localStorage.setItem('lastExternalJobId', jobId);
        showToast('✅ สร้างงานนอกสำเร็จ! สมาชิกจะเห็นงานนี้ในหน้าหลัก', 'success');
        setTimeout(function() {
          window.location.href = 'external-payout.html' + (jobId ? '?jobId=' + jobId : '');
        }, 1800);
      } else {
        showToast((r && r.message) || 'เกิดข้อผิดพลาด กรุณาลองใหม่', 'error');
      }
    });
  }