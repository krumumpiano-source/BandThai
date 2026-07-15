var quotations = [];
  var calcData   = null;
  var _qIsManager = (function(){ var r=localStorage.getItem('userRole')||'member'; return r==='admin'||r==='manager'; })();

  document.addEventListener('DOMContentLoaded', function(){
    requireAuth();
      checkAdGate();
    renderMainNav('mainNav');
    if (typeof applyTranslations === 'function') applyTranslations();

    // Check for calc data
    try { calcData = JSON.parse(localStorage.getItem('jobCalcData') || 'null'); } catch(e){}
    var fromCalc = window.location.search.indexOf('from=calc') !== -1;

    if (calcData) {
      document.getElementById('calcBanner').style.display = 'flex';
      if (fromCalc) openFromCalc();
    }

    loadQuotations();

    // Hide write buttons for members
    if (!_qIsManager) {
      document.querySelectorAll('.page-header .btn-primary, #calcBanner .btn-primary').forEach(function(b){ b.style.display='none'; });
    }

    // Auto-refresh when user comes back from another page
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) loadQuotations();
    });
  });

  function loadQuotations(){
    apiCall('getAllQuotations', {}, function(r){
      quotations = (r && r.data) || [];
      renderTable();
    });
  }

  var statusMap = { draft:'ร่าง', sent:'ส่งแล้ว', approved:'อนุมัติ', cancelled:'ยกเลิก' };
  var badgeMap  = { draft:'badge-draft', sent:'badge-sent', approved:'badge-approved', cancelled:'badge-cancelled' };

  function renderTable(){
    var tbody = document.getElementById('quotBody');
    if (!quotations.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="color:var(--premium-text-muted)">ยังไม่มีใบเสนอราคา — กด "+ ใบเสนอราคาใหม่" หรือใช้ข้อมูลจากหน้าคำนวณ</td></tr>';
      return;
    }
    tbody.innerHTML = quotations.map(function(q){
      var approved = q.status === 'approved';
      return '<tr>'
        +'<td style="font-weight:600">'+escapeHtml(q.quotNo||q.quotationId||'')+'</td>'
        +'<td>'+escapeHtml(q.client||'')+'</td>'
        +'<td>'+escapeHtml(q.jobName||'-')+'</td>'
        +'<td>'+formatDate(q.date)+'</td>'
        +'<td>'+formatDate(q.eventDate)+'</td>'
        +'<td style="font-weight:700;color:var(--premium-gold)">'+formatCurrency(q.total||0)+'</td>'
        +'<td><span class="badge '+(badgeMap[q.status]||'badge-draft')+'">'+escapeHtml(statusMap[q.status]||q.status||'ร่าง')+'</span></td>'
        +'<td style="display:flex;gap:4px;flex-wrap:wrap">'
        +(_qIsManager ? '<button class="btn btn-ghost btn-sm" onclick="openModal(\''+escapeHtml(q.quotationId||'')+'\')">✏️</button>' : '')
        +'<button class="btn btn-secondary btn-sm" onclick="printQuot(\''+escapeHtml(q.quotationId||'')+'\')">🖨️</button>'
        +'<button class="btn btn-secondary btn-sm" onclick="savePdf(\''+escapeHtml(q.quotationId||'')+'\')">📄 PDF</button>'
        +(approved ? '<button class="btn btn-primary btn-sm" onclick="goToContract(\''+escapeHtml(q.quotationId||'')+'\')">📜 สัญญา</button>' : '')
        +(_qIsManager ? '<button class="btn btn-danger btn-sm" onclick="deleteQuot(\''+escapeHtml(q.quotationId||'')+'\')">🗑️</button>' : '')
        +'</td></tr>';
    }).join('');
  }

  /* ── Modal open/close ── */
  function openModal(id){
    document.getElementById('quotModal').style.display = 'flex';
    document.getElementById('quotForm').reset();
    document.getElementById('quotId').value = '';
    document.getElementById('qDate').value = new Date().toISOString().substring(0,10);
    document.getElementById('qItems').innerHTML = '';
    calcTotal();
    document.getElementById('quotModalTitle').textContent = id ? 'แก้ไขใบเสนอราคา' : 'ใบเสนอราคาใหม่';

    if (id) {
      var q = quotations.find(function(x){ return x.quotationId === id; });
      if (q) fillForm(q);
    }
  }

  function openFromCalc(){
    if (!calcData) return;
    document.getElementById('quotModal').style.display = 'flex';
    document.getElementById('quotForm').reset();
    document.getElementById('quotId').value = '';
    document.getElementById('quotModalTitle').textContent = 'ใบเสนอราคา (จากการคำนวณ)';
    document.getElementById('qDate').value = new Date().toISOString().substring(0,10);
    document.getElementById('qItems').innerHTML = '';

    // Fill from calc data
    document.getElementById('qClient').value     = calcData.clientName || '';
    document.getElementById('qClientPhone').value = calcData.clientPhone || '';
    document.getElementById('qEventDate').value  = calcData.eventDate || '';
    document.getElementById('qEventTime').value  = calcData.eventTime || '';
    document.getElementById('qJobName').value    = calcData.jobName || '';
    document.getElementById('qVenue').value      = calcData.venueName || '';
    document.getElementById('qNotes').value      = calcData.calcNotes || '';
    if (calcData.members && calcData.members.length) {
      document.getElementById('qMembers').value = calcData.members.map(function(m){ return m.name + (m.instrument ? ' ('+m.instrument+')' : ''); }).join(', ');
    }

    // Build items from calc breakdown
    var items = buildItemsFromCalc(calcData);
    items.forEach(function(it){ addItem(it.desc, it.qty, it.price); });
    if (!items.length) { addItem('ค่าจ้างวงดนตรี', 1, calcData.proposedPrice || 0); }
    calcTotal();
  }

  function buildItemsFromCalc(d){
    var items = [];
    // Musician fee
    if (d.memberCost > 0) {
      var memberNames = (d.members||[]).map(function(m){ return m.name; }).join(', ');
      items.push({ desc: 'ค่าตัวนักดนตรี' + (memberNames ? ' ('+memberNames+')' : '') + ' — แสดง '+d.showHours+'ชม. '+d.showSessions+'รอบ', qty: 1, price: d.memberCost });
    }
    if (d.travelCost > 0) {
      items.push({ desc: 'ค่าเดินทาง (ไป-กลับ '+d.roundTripKm+'กม.)' + (d.vehicles&&d.vehicles.length ? ' '+d.vehicles.length+'คัน' : ''), qty: 1, price: d.travelCost });
    }
    if (d.accomCost > 0) {
      items.push({ desc: 'ค่าที่พัก '+d.accomRooms+'ห้อง × '+d.accomNights+'คืน' + (d.accomName ? ' ('+d.accomName+')' : ''), qty: 1, price: d.accomCost });
    }
    if (d.foodCost > 0) {
      items.push({ desc: 'ค่าอาหาร '+d.foodPeople+'คน × '+d.foodMeals+'มื้อ × '+d.foodDays+'วัน', qty: 1, price: d.foodCost });
    }
    (d.otherExpenses||[]).forEach(function(e){
      if (e.amount > 0) items.push({ desc: e.desc||'รายการพิเศษ', qty: 1, price: e.amount });
    });
    // If total differs from sum (due to fund/profit buffer)
    var sumItems = items.reduce(function(s,i){ return s+i.price; }, 0);
    var proposed = d.proposedPrice || d.suggestPrice || 0;
    var diff = proposed - sumItems;
    if (diff > 100) items.push({ desc: 'ค่าบริหารจัดการ / กำไร', qty: 1, price: diff });
    return items;
  }

  function fillForm(q){
    document.getElementById('quotId').value       = q.quotationId || '';
    document.getElementById('qClient').value      = q.client || '';
    document.getElementById('qClientPhone').value = q.clientPhone || '';
    document.getElementById('qDate').value        = (q.date||'').substring(0,10);
    document.getElementById('qEventDate').value   = (q.eventDate||'').substring(0,10);
    document.getElementById('qEventTime').value   = q.eventTime || '';
    document.getElementById('qJobName').value     = q.jobName || '';
    document.getElementById('qVenue').value       = q.venue || '';
    document.getElementById('qMembers').value     = q.members || '';
    document.getElementById('qDiscount').value    = q.discount || 0;
    document.getElementById('qVat').value         = q.vatRate || 0;
    document.getElementById('qNotes').value       = q.notes || '';
    document.getElementById('qStatus').value      = q.status || 'draft';
    document.getElementById('qPaymentTerm').value = q.paymentTerm || 'ชำระเต็มจำนวนก่อนแสดง';
    document.getElementById('qItems').innerHTML   = '';
    var items = [];
    try { items = typeof q.items === 'string' ? JSON.parse(q.items) : q.items || []; } catch(e){ items = []; }
    items.forEach(function(it){ addItem(it.desc, it.qty, it.price); });
    if (!items.length) { addItem(); addItem(); }
    calcTotal();
  }

  function closeModal(){ document.getElementById('quotModal').style.display = 'none'; }

  function addItem(desc, qty, price){
    var row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = '<input type="text" placeholder="รายการ" class="item-desc" value="'+(desc?escapeHtml(String(desc)):'')+'" oninput="calcTotal()">'
      +'<input type="number" placeholder="จำนวน" class="item-qty" value="'+(qty||1)+'" min="0" oninput="calcTotal()">'
      +'<input type="number" placeholder="ราคา/หน่วย" class="item-price" value="'+(price||0)+'" min="0" oninput="calcTotal()">'
      +'<button type="button" class="btn btn-danger btn-sm" onclick="this.parentNode.remove();calcTotal()">×</button>';
    document.getElementById('qItems').appendChild(row);
  }

  function calcTotal(){
    var items    = Array.from(document.querySelectorAll('.item-row'));
    var rawTotal = items.reduce(function(s, r){
      return s + (parseFloat(r.querySelector('.item-qty').value)||0) * (parseFloat(r.querySelector('.item-price').value)||0);
    }, 0);
    var discount  = parseFloat(document.getElementById('qDiscount').value) || 0;
    var vatRate   = parseFloat(document.getElementById('qVat').value) || 0;
    var afterDisc = rawTotal - discount;
    var vat       = Math.round(afterDisc * (vatRate / 100));
    var total     = afterDisc + vat;
    document.getElementById('qSubtotalRaw').textContent = formatCurrency(rawTotal);
    document.getElementById('qSubtotal').textContent    = formatCurrency(afterDisc);
    document.getElementById('qVatAmt').textContent      = formatCurrency(vat) + (vatRate ? ' ('+vatRate+'%)' : '');
    document.getElementById('qTotal').textContent       = formatCurrency(total);
  }

  /* ── Form submit ── */
  document.getElementById('quotForm').addEventListener('submit', function(e){
    e.preventDefault();
    var btn = document.getElementById('saveQuotBtn');
    btn.disabled = true; btn.textContent = 'กำลังบันทึก...';

    var items = Array.from(document.querySelectorAll('.item-row')).map(function(r){
      return { desc: r.querySelector('.item-desc').value, qty: r.querySelector('.item-qty').value, price: r.querySelector('.item-price').value };
    }).filter(function(i){ return i.desc || i.price; });

    var discount  = parseFloat(document.getElementById('qDiscount').value) || 0;
    var vatRate   = parseFloat(document.getElementById('qVat').value) || 0;
    var rawTotal  = items.reduce(function(s,i){ return s + (parseFloat(i.qty)||0)*(parseFloat(i.price)||0); }, 0);
    var afterDisc = rawTotal - discount;
    var total     = afterDisc + Math.round(afterDisc * vatRate / 100);

    var id     = document.getElementById('quotId').value;
    var action = id ? 'updateQuotation' : 'addQuotation';
    apiCall(action, {
      quotationId:  id,
      client:       document.getElementById('qClient').value.trim(),
      clientPhone:  document.getElementById('qClientPhone').value.trim(),
      date:         document.getElementById('qDate').value,
      eventDate:    document.getElementById('qEventDate').value,
      eventTime:    document.getElementById('qEventTime').value,
      jobName:      document.getElementById('qJobName').value.trim(),
      venue:        document.getElementById('qVenue').value.trim(),
      members:      document.getElementById('qMembers').value.trim(),
      items:        JSON.stringify(items),
      discount:     discount,
      vatRate:      vatRate,
      total:        total,
      status:       document.getElementById('qStatus').value,
      paymentTerm:  document.getElementById('qPaymentTerm').value,
      notes:        document.getElementById('qNotes').value,
      calcData:     calcData ? JSON.stringify(calcData) : null
    }, function(r){
      btn.disabled = false; btn.textContent = 'บันทึก';
      if (r && r.success) {
        if (typeof showToast === 'function') showToast('บันทึกเรียบร้อย', 'success');
        closeModal();
        loadQuotations();
        if (document.getElementById('qStatus').value === 'approved') {
          if (confirm('ใบเสนอราคาอนุมัติแล้ว — ต้องการสร้างสัญญาว่าจ้างเลยไหม?')) {
            var newId = (r.data && r.data.quotationId) || id;
            goToContract(newId);
          }
        }
      } else {
        if (typeof showToast === 'function') showToast((r && r.message) || 'เกิดข้อผิดพลาด', 'error');
      }
    });
  });

  /* ── Preview / Print / PDF ── */
  function previewQuot(){
    var html = buildQuotHtml(getFormData());
    document.getElementById('quotPreview').innerHTML = html;
    window.print();
  }

  function printQuot(id){
    var q = quotations.find(function(x){ return x.quotationId === id; });
    if (!q) return;
    var items = [];
    try { items = typeof q.items === 'string' ? JSON.parse(q.items) : q.items || []; } catch(e){ items = []; }
    var html = buildQuotHtml({
      quotNo: q.quotNo || q.quotationId,
      client: q.client, clientPhone: q.clientPhone, date: q.date,
      eventDate: q.eventDate, eventTime: q.eventTime,
      jobName: q.jobName, venue: q.venue, members: q.members,
      items: items, discount: q.discount||0, vatRate: q.vatRate||0,
      total: q.total||0, paymentTerm: q.paymentTerm, notes: q.notes, status: q.status
    });
    document.getElementById('quotPreview').innerHTML = html;
    window.print();
  }

  function savePdf(id){ printQuot(id); }

  function getFormData(){
    var items = Array.from(document.querySelectorAll('.item-row')).map(function(r){
      return { desc: r.querySelector('.item-desc').value, qty: parseFloat(r.querySelector('.item-qty').value)||0, price: parseFloat(r.querySelector('.item-price').value)||0 };
    }).filter(function(i){ return i.desc; });
    var discount  = parseFloat(document.getElementById('qDiscount').value) || 0;
    var vatRate   = parseFloat(document.getElementById('qVat').value) || 0;
    var rawTotal  = items.reduce(function(s,i){ return s + i.qty*i.price; }, 0);
    var afterDisc = rawTotal - discount;
    var total     = afterDisc + Math.round(afterDisc * vatRate / 100);
    return {
      quotNo: 'QT-' + new Date().toISOString().replace(/\D/g,'').substring(0,12),
      client: document.getElementById('qClient').value,
      clientPhone: document.getElementById('qClientPhone').value,
      date: document.getElementById('qDate').value,
      eventDate: document.getElementById('qEventDate').value,
      eventTime: document.getElementById('qEventTime').value,
      jobName: document.getElementById('qJobName').value,
      venue: document.getElementById('qVenue').value,
      members: document.getElementById('qMembers').value,
      items: items, discount: discount, vatRate: vatRate, total: total,
      paymentTerm: document.getElementById('qPaymentTerm').value,
      notes: document.getElementById('qNotes').value,
      status: document.getElementById('qStatus').value
    };
  }

  function buildQuotHtml(d){
    var bandName    = localStorage.getItem('bandName') || 'วงดนตรี';
    var bandPhone   = localStorage.getItem('bandPhone') || '';
    var items       = d.items || [];
    var rawTotal    = items.reduce(function(s,i){ return s + (parseFloat(i.qty)||0)*(parseFloat(i.price)||0); }, 0);
    var discount    = parseFloat(d.discount) || 0;
    var vatRate     = parseFloat(d.vatRate) || 0;
    var afterDisc   = rawTotal - discount;
    var vat         = Math.round(afterDisc * vatRate / 100);
    var total       = afterDisc + vat;
    var paymentTerm = d.paymentTerm || 'ชำระเต็มจำนวนก่อนแสดง';
    var notes       = d.notes || '';
    var thDate      = d.date ? new Date(d.date).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}) : '';
    var thEventDate = d.eventDate ? new Date(d.eventDate).toLocaleDateString('th-TH',{year:'numeric',month:'long',day:'numeric'}) : '';

    var itemsHtml = items.map(function(it, i){
      var amt = (parseFloat(it.qty)||0) * (parseFloat(it.price)||0);
      return '<tr>'
        +'<td class="text-center">'+(i+1)+'</td>'
        +'<td>'+escapeHtml(it.desc||'')+'</td>'
        +'<td class="text-center">'+escapeHtml(String(it.qty||1))+'</td>'
        +'<td class="text-right">'+formatCurrency(parseFloat(it.price)||0)+'</td>'
        +'<td class="text-right" style="font-weight:600">'+formatCurrency(amt)+'</td>'
        +'</tr>';
    }).join('');

    var membersHtml = '';
    if (d.members) {
      membersHtml = '<div class="quot-section-title">นักดนตรีที่ร่วมงาน</div>'
        +'<div class="quot-members-list">'+d.members.split(',').map(function(m){
          return '<span class="quot-member-chip">'+escapeHtml(m.trim())+'</span>';
        }).join('')+'</div>';
    }

    return '<div class="quot-doc">'
      +'<div class="quot-doc-header">'
        +'<div><div class="quot-band-name">🎵 '+escapeHtml(bandName)+'</div>'
        +(bandPhone ? '<div class="quot-band-sub">📞 '+escapeHtml(bandPhone)+'</div>' : '')+'</div>'
        +'<div class="quot-title-block"><div class="quot-title">ใบเสนอราคา</div>'
        +'<div class="quot-no">เลขที่: '+escapeHtml(d.quotNo||'')+'</div>'
        +'<div class="quot-no">วันที่: '+thDate+'</div></div>'
      +'</div>'
      +'<div class="quot-info-grid">'
        +'<div class="quot-info-box"><div class="quot-info-label">ลูกค้า / เจ้าภาพ</div>'
          +'<div class="quot-info-val">'+escapeHtml(d.client||'')+'</div>'
          +(d.clientPhone ? '<div class="quot-info-val-sm">📞 '+escapeHtml(d.clientPhone)+'</div>' : '')+'</div>'
        +'<div class="quot-info-box"><div class="quot-info-label">รายละเอียดงาน</div>'
          +'<div class="quot-info-val">'+escapeHtml(d.jobName||'')+'</div>'
          +'<div class="quot-info-val-sm">📅 '+thEventDate+(d.eventTime ? ' เวลา '+escapeHtml(d.eventTime)+' น.' : '')+'</div>'
          +(d.venue ? '<div class="quot-info-val-sm">📍 '+escapeHtml(d.venue)+'</div>' : '')+'</div>'
      +'</div>'
      + membersHtml
      +'<div class="quot-section-title">รายการบริการ</div>'
      +'<table class="quot-table"><thead><tr><th class="text-center">#</th><th>รายการ</th><th class="text-center">จำนวน</th><th class="text-right">ราคา/หน่วย</th><th class="text-right">รวม</th></tr></thead>'
      +'<tbody>'+itemsHtml+'</tbody></table>'
      +'<div class="quot-total-box">'
        +(discount > 0 ? '<div class="quot-total-row"><span>ยอดก่อนส่วนลด</span><span>'+formatCurrency(rawTotal)+'</span></div><div class="quot-total-row"><span>ส่วนลด</span><span>-'+formatCurrency(discount)+'</span></div>' : '')
        +(vatRate > 0 ? '<div class="quot-total-row"><span>ภาษีมูลค่าเพิ่ม ('+vatRate+'%)</span><span>'+formatCurrency(vat)+'</span></div>' : '')
        +'<div class="quot-total-row main"><span>ยอดรวมทั้งสิ้น</span><span>'+formatCurrency(total)+'</span></div>'
      +'</div>'
      +'<div class="quot-terms">'
        +'<div style="font-weight:700;margin-bottom:4px">เงื่อนไขการชำระเงิน</div>'
        +'<div>'+escapeHtml(paymentTerm)+'</div>'
        +(notes ? '<div style="margin-top:8px"><b>หมายเหตุ:</b> '+escapeHtml(notes)+'</div>' : '')
        +'<div style="margin-top:8px">• ใบเสนอราคานี้มีอายุ 30 วันนับจากวันที่ออก</div>'
        +'<div>• ราคาดังกล่าวรวมค่าอุปกรณ์ดนตรีและระบบเสียงของวงแล้ว</div>'
        +'<div>• หากมีการยกเลิกหลังจากชำระมัดจำแล้ว จะไม่คืนเงินมัดจำ</div>'
      +'</div>'
      +'<div class="quot-sig">'
        +'<div class="quot-sig-box">ผู้เสนอราคา<br><b>'+escapeHtml(bandName)+'</b></div>'
        +'<div class="quot-sig-box">ผู้ว่าจ้าง / เจ้าภาพ<br><b>'+escapeHtml(d.client||'')+'</b></div>'
      +'</div>'
      +'<div class="quot-footer">'+escapeHtml(bandName)+' — ใบเสนอราคาเลขที่ '+escapeHtml(d.quotNo||'')+' — สร้างด้วย BandThai</div>'
    +'</div>';
  }

  /* ── Delete ── */
  function deleteQuot(id){
    if (typeof showConfirm === 'function') {
      showConfirm('ลบใบเสนอราคา', 'ต้องการลบใบเสนอราคานี้?', {danger:true, confirmText:'ลบ'}).then(function(ok){
        if (!ok) return;
        doDelete(id);
      });
    } else if (confirm('ลบใบเสนอราคานี้?')) {
      doDelete(id);
    }
  }

  function doDelete(id){
    apiCall('deleteQuotation', { quotationId: id }, function(r){
      if (r && r.success) {
        if (typeof showToast === 'function') showToast('ลบแล้ว', 'success');
        loadQuotations();
      } else {
        if (typeof showToast === 'function') showToast((r && r.message) || 'เกิดข้อผิดพลาด', 'error');
      }
    });
  }

  /* ── Go to Contract ── */
  function goToContract(id){
    var q = quotations.find(function(x){ return x.quotationId === id; }) || {};
    var contractData = {
      quotationId: id,
      quotNo:      q.quotNo || id,
      client:      q.client || '',
      clientPhone: q.clientPhone || '',
      eventDate:   q.eventDate || '',
      eventTime:   q.eventTime || '',
      jobName:     q.jobName || '',
      venue:       q.venue || '',
      members:     q.members || '',
      total:       q.total || 0,
      paymentTerm: q.paymentTerm || '',
      notes:       q.notes || '',
      calcData:    null
    };
    // Also attach calc data if available
    try { contractData.calcData = JSON.parse(localStorage.getItem('jobCalcData') || 'null'); } catch(e){}
    localStorage.setItem('contractData', JSON.stringify(contractData));
    window.location.href = 'contract.html?from=quot&id=' + encodeURIComponent(id);
  }