function switchTab(tab) {
    document.querySelectorAll('.ep-tab').forEach(function(b, i) {
      b.classList.toggle('active', (i===0&&tab==='jobs')||(i===1&&tab==='external'));
    });
    document.getElementById('panel-jobs').classList.toggle('active', tab==='jobs');
    document.getElementById('panel-external').classList.toggle('active', tab==='external');
    if (tab === 'external') loadPayouts();
  }

  var _payTarget = null;

  function loadJobs() {
    document.getElementById('jobsLoading').style.display = 'block';
    document.getElementById('jobsList').innerHTML = '';
    apiCall('getExternalJobs', {}, function(r) {
      document.getElementById('jobsLoading').style.display = 'none';
      var jobs = (r && r.data) || [];
      if (!jobs.length) {
        document.getElementById('jobsList').innerHTML =
          '<div class="ep-empty"><div class="icon">🎤</div><p>ยังไม่มีงานนอก</p>'
          + '<p style="font-size:var(--text-sm)">เมื่อยืนยันสัญญาจ้าง งานจะปรากฏที่นี่</p>'
          + '<a href="job-calculator.html" class="btn btn-primary" style="margin-top:var(--spacing-md)">➕ คำนวณงานใหม่</a></div>';
        return;
      }
      document.getElementById('jobsList').innerHTML = jobs.map(buildJobCard).join('');
      var params = new URLSearchParams(window.location.search);
      var targetId = params.get('jobId');
      if (targetId) {
        var el = document.getElementById('job-' + targetId);
        if (el) { setTimeout(function(){ el.scrollIntoView({ behavior:'smooth', block:'start' }); }, 300); el.style.outline = '3px solid var(--premium-gold)'; }
      }
    });
  }

  function buildJobCard(job) {
    var ds = job.eventDate || '';
    var d = ds ? new Date(ds + 'T00:00:00') : null;
    var dd = d ? String(d.getDate()).padStart(2,'0') : '--';
    var mm = d ? d.toLocaleString('th-TH',{month:'short'}) : '--';
    var fees   = Array.isArray(job.memberFees) ? job.memberFees : [];
    var total  = fees.reduce(function(s,m){ return s+(m.fee||0); }, 0);
    var paid   = fees.reduce(function(s,m){ return s+(m.paid?(m.fee||0):0); }, 0);
    var paidCt = fees.filter(function(m){ return m.paid; }).length;

    var sBadge = job.payoutStatus==='paid' ? '<span class="badge badge-green">✅ จ่ายครบ</span>'
      : job.payoutStatus==='partial' ? '<span class="badge badge-gold">⏳ จ่ายบางส่วน</span>'
      : '<span class="badge badge-gray">⏸ รอเบิกจ่าย</span>';
    var jBadge = job.status==='completed' ? '<span class="badge badge-blue">🎉 งานเสร็จ</span>'
      : job.status==='cancelled' ? '<span class="badge badge-red">❌ ยกเลิก</span>'
      : '<span class="badge badge-gold">📅 ยืนยันแล้ว</span>';

    var travel = (job.travelInfo && typeof job.travelInfo === 'object') ? job.travelInfo : {};
    var accom  = (job.accommodation && typeof job.accommodation === 'object') ? job.accommodation : {};
    var food   = (job.foodInfo && typeof job.foodInfo === 'object') ? job.foodInfo : {};

    var membHtml = fees.length ? fees.map(function(mf) {
      var isPaid = !!mf.paid;
      var jId = esc(job.id||''), mId = esc(mf.memberId||''), mNm = esc(mf.name||'ไม่ระบุ');
      return '<div class="member-fee-row">'
        +'<div class="mf-avatar">🎵</div>'
        +'<div class="mf-info"><div class="name">'+esc(mf.name||'ไม่ระบุ')+'</div><div class="instrument">'+esc(mf.instrument||'')+'</div></div>'
        +'<div class="mf-fee">'+fmt(mf.fee||0)+'</div>'
        +'<div class="mf-status">'+(isPaid
          ? '<span style="color:#065f46;font-size:11px;font-weight:700">✅ จ่ายแล้ว<br><span style="font-weight:400;color:var(--premium-text-muted)">'+esc(mf.paidDate||'')+'</span></span>'
          : '<span style="color:#c53030;font-size:11px;font-weight:700">⏸ รอจ่าย</span>')+'</div>'
        +'<div class="mf-action">'
        +(isPaid ? '<button class="btn-pay paid" disabled>จ่ายแล้ว ✅</button>'
          : (_epIsManager ? '<button class="btn-pay" onclick="openPayModal(\''+jId+'\',\''+mId+'\',\''+mNm+'\','+(mf.fee||0)+')">💰 เบิกจ่าย</button>' : '<span style="color:#c53030;font-size:11px">⏸ รอจ่าย</span>'))
        +'</div></div>';
    }).join('') : '<p style="color:var(--premium-text-muted);font-size:var(--text-sm);padding:8px 0">ไม่มีข้อมูลสมาชิก</p>';

    var detHtml =
      '<div class="detail-grid">'
      +'<div class="detail-section"><h4>🚗 การเดินทาง</h4>'
      +(travel.origin?'<div class="detail-row"><span class="detail-label">จุดเริ่มต้น</span><span class="detail-val">'+esc(travel.origin)+'</span></div>':'')
      +(travel.destination?'<div class="detail-row"><span class="detail-label">ปลายทาง</span><span class="detail-val">'+esc(travel.destination)+'</span></div>':'')
      +(travel.distanceKm?'<div class="detail-row"><span class="detail-label">ระยะทาง</span><span class="detail-val">'+travel.distanceKm+' กม. (ไป-กลับ)</span></div>':'')
      +(travel.travelCost?'<div class="detail-row"><span class="detail-label">ค่าเดินทาง</span><span class="detail-val">'+fmt(travel.travelCost)+'</span></div>':'')
      +(!travel.origin&&!travel.destination?'<span style="color:var(--premium-text-muted);font-size:11px">ไม่มีข้อมูล</span>':'')
      +'</div>'
      +'<div class="detail-section"><h4>🏨 ที่พัก</h4>'
      +(accom.hasAccom
        ?'<div class="detail-row"><span class="detail-label">โรงแรม</span><span class="detail-val">'+esc(accom.hotel||'—')+'</span></div>'
        +'<div class="detail-row"><span class="detail-label">ห้อง/คืน</span><span class="detail-val">'+(accom.rooms||0)+' ห้อง × '+(accom.nights||0)+' คืน</span></div>'
        +(accom.accomCost?'<div class="detail-row"><span class="detail-label">ค่าที่พัก</span><span class="detail-val">'+fmt(accom.accomCost)+'</span></div>':'')
        :'<span style="color:var(--premium-text-muted);font-size:11px">ไม่มีที่พัก</span>')
      +'</div>'
      +'<div class="detail-section"><h4>🍱 อาหาร</h4>'
      +(food.hasFood
        ?'<div class="detail-row"><span class="detail-label">คน/มื้อ/วัน</span><span class="detail-val">'+(food.people||0)+' คน × '+(food.meals||0)+' มื้อ × '+(food.days||0)+' วัน</span></div>'
        +(food.foodCost?'<div class="detail-row"><span class="detail-label">ค่าอาหาร</span><span class="detail-val">'+fmt(food.foodCost)+'</span></div>':'')
        :'<span style="color:var(--premium-text-muted);font-size:11px">ไม่มีค่าอาหาร</span>')
      +'</div>'
      +'<div class="detail-section"><h4>💰 สรุปการเงิน</h4>'
      +'<div class="detail-row"><span class="detail-label">รับจากลูกค้า</span><span class="detail-val" style="color:#b7791f">'+fmt(job.totalFee||0)+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">ค่าใช้จ่ายอื่น</span><span class="detail-val">'+fmt(job.otherExpenses||0)+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">หักกองกลาง</span><span class="detail-val">'+fmt(job.bandFundCut||0)+'</span></div>'
      +'<div class="detail-row"><span class="detail-label">ค่าตัวสมาชิก</span><span class="detail-val" style="color:#276749;font-weight:700">'+fmt(total)+'</span></div>'
      +'</div></div>';

    return '<div id="job-'+esc(job.id||'')+'" class="job-card">'
      +'<div class="job-card-header">'
        +'<div class="job-date-badge"><div class="dd">'+dd+'</div><div class="mm">'+mm+'</div></div>'
        +'<div class="job-head-info">'
          +'<h3>'+esc(job.jobName||'งานนอก')+'</h3>'
          +'<div class="meta">📍 <strong>'+esc(job.venue||'ไม่ระบุ')+'</strong>'
            +(job.clientName?' | 👤 <strong>'+esc(job.clientName)+'</strong>':'')
            +(job.startTime?' | ⏰ <strong>'+esc(job.startTime)+(job.endTime?' – '+esc(job.endTime):'')+' น.</strong>':'')
            +'<br>รับจากลูกค้า: <strong>'+fmt(job.totalFee||0)+'</strong> | จ่ายแล้ว: <strong>'+fmt(paid)+'</strong>/'+fmt(total)+' ('+paidCt+'/'+fees.length+' คน)</div>'
          +'<div class="job-badge-row">'+jBadge+' '+sBadge+'</div>'
        +'</div>'
      +'</div>'
      +'<div class="job-body">'
        +'<div class="job-fee-summary">'
          +'<div class="fee-stat"><div class="val gold">'+fmt(job.totalFee||0)+'</div><div class="lbl">รับจากลูกค้า</div></div>'
          +'<div class="fee-stat"><div class="val green">'+fmt(paid)+'</div><div class="lbl">จ่ายแล้ว</div></div>'
          +'<div class="fee-stat"><div class="val red">'+fmt(total-paid)+'</div><div class="lbl">ค้างจ่าย</div></div>'
          +'<div class="fee-stat"><div class="val">'+paidCt+'/'+fees.length+'</div><div class="lbl">สมาชิก</div></div>'
        +'</div>'
        +membHtml
        +'<div style="margin-top:var(--spacing-md)">'
          +'<button class="job-detail-toggle" onclick="toggleDetail(this)">▶ รายละเอียดเดินทาง / ที่พัก / ค่าใช้จ่าย</button>'
          +'<div class="job-detail-panel">'+detHtml+'</div>'
        +'</div>'
      +'</div>'
      +'<div class="job-actions">'
        +(_epIsManager && job.status!=='completed'?'<button class="btn btn-ghost btn-sm" onclick="markJobComplete(\''+esc(job.id||'')+'\')">🎉 งานเสร็จสิ้น</button>':'')
        +(_epIsManager?'<button class="btn btn-ghost btn-sm" onclick="deleteJob(\''+esc(job.id||'')+'\')">🗑️ ลบ</button>':'')
      +'</div></div>';
  }

  function toggleDetail(btn) {
    var p = btn.nextElementSibling;
    var open = p.classList.toggle('open');
    btn.textContent = (open?'▼ ':'▶ ') + 'รายละเอียดเดินทาง / ที่พัก / ค่าใช้จ่าย';
  }

  function markJobComplete(jobId) {
    showConfirm('ยืนยันงานเสร็จสิ้น','ยืนยันว่างานนี้เสร็จสิ้นแล้ว?').then(function(ok){
      if (!ok) return;
      apiCall('updateExternalJob',{jobId:jobId,status:'completed'},function(r){
        if(r&&r.success){showToast('อัปเดตสำเร็จ','success');loadJobs();}
        else showToast((r&&r.message)||'เกิดข้อผิดพลาด','error');
      });
    });
  }

  function deleteJob(jobId) {
    showConfirm('ลบงานนอก','ยืนยันลบงานนี้? ข้อมูลจะหายถาวร', {danger:true, confirmText:'ลบ'}).then(function(ok){
      if (!ok) return;
      apiCall('deleteExternalJob',{jobId:jobId},function(r){
        if(r&&r.success){showToast('ลบแล้ว','success');loadJobs();}
        else showToast((r&&r.message)||'เกิดข้อผิดพลาด','error');
      });
    });
  }

  function openPayModal(jobId, memberId, name, fee) {
    _payTarget = { jobId: jobId, memberId: memberId };
    document.getElementById('payModalName').textContent = name;
    document.getElementById('payModalFee').textContent  = (fee||0).toLocaleString('th-TH') + ' บาท';
    document.getElementById('payModalDate').value = (function(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })(new Date());
    document.getElementById('payModal').style.display = 'flex';
  }
  function closePayModal() { document.getElementById('payModal').style.display='none'; _payTarget=null; }

  function doPayMember() {
    if (!_payTarget) return;
    var btn = document.getElementById('payModalConfirmBtn');
    btn.disabled = true; btn.textContent = '⏳ กำลังบันทึก...';
    apiCall('payMemberForJob',{
      jobId:         _payTarget.jobId,
      memberId:      _payTarget.memberId,
      paidDate:      document.getElementById('payModalDate').value,
      paymentMethod: document.getElementById('payModalMethod').value
    }, function(r){
      btn.disabled=false; btn.textContent='✅ ยืนยันจ่าย';
      closePayModal();
      if(r&&r.success){showToast('บันทึกการจ่ายเงินสำเร็จ ✅','success');loadJobs();}
      else showToast((r&&r.message)||'เกิดข้อผิดพลาด','error');
    });
  }

  document.getElementById('payoutForm').addEventListener('submit', function(e){
    e.preventDefault();
    var btn=document.getElementById('epSaveBtn'); btn.disabled=true; btn.textContent='⏳';
    apiCall('addExternalPayout',{
      payeeName: document.getElementById('payeeName').value.trim(),
      payeeType: document.getElementById('payeeType').value,
      amount:    document.getElementById('epAmount').value,
      date:      document.getElementById('epDate').value,
      notes:     document.getElementById('epNotes').value
    }, function(r){
      btn.disabled=false; btn.textContent='บันทึก';
      if(r&&r.success){showToast('บันทึกสำเร็จ','success');document.getElementById('payoutForm').reset();document.getElementById('epDate').value=(function(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })(new Date());loadPayouts();}
      else showToast((r&&r.message)||'เกิดข้อผิดพลาด','error');
    });
  });

  function loadPayouts(){
    apiCall('getAllExternalPayouts',{},function(r){
      var rows=(r&&r.data)||[];
      var tbody=document.getElementById('payoutBody');
      if(!rows.length){tbody.innerHTML='<tr><td colspan="6" class="text-center">ไม่มีข้อมูล</td></tr>';return;}
      tbody.innerHTML=rows.map(function(row){
        return '<tr><td>'+esc(row.payeeName||'')+'</td><td>'+esc(row.payeeType||'')+'</td>'
          +'<td>'+fmt(row.amount||0)+'</td><td>'+esc(row.date||'')+'</td>'
          +'<td>'+esc(row.notes||'')+'</td>'
          +'<td>'+(_epIsManager?'<button class="btn btn-danger btn-sm" onclick="delPayout(\''+esc(row.id||'')+'\')">🗑️</button>':'')+'</td></tr>';
      }).join('');
    });
  }

  function delPayout(id){
    showConfirm('ลบรายการ','ยืนยันลบ?', {danger:true, confirmText:'ลบ'}).then(function(ok){
      if(!ok) return;
      apiCall('deleteExternalPayout',{payoutId:id},function(r){
        if(r&&r.success){showToast('ลบแล้ว','success');loadPayouts();}
        else showToast((r&&r.message)||'เกิดข้อผิดพลาด','error');
      });
    });
  }

  var _epIsManager = (function(){ var r=localStorage.getItem('userRole')||'member'; return r==='admin'||r==='manager'; })();
  function esc(s){ var d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
  function fmt(n){ return (n||0).toLocaleString('th-TH')+' ฿'; }

  document.addEventListener('DOMContentLoaded', function(){
    requireAuth();
      checkAdGate(); renderMainNav('mainNav');
    if(typeof applyTranslations==='function') applyTranslations();
    document.getElementById('epDate').value = (function(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })(new Date());
    loadJobs();
    // Hide write features for members
    if (!_epIsManager) {
      document.querySelectorAll('.page-header .btn-primary, #epExtForm, #payModalConfirmBtn').forEach(function(b){ b.style.display='none'; });
      var hdr = document.querySelector('.page-header');
      if (hdr) { var info = document.createElement('span'); info.style.cssText = 'background:#f59e0b;color:#fff;padding:6px 14px;border-radius:8px;font-size:var(--text-sm)'; info.textContent = '👁️ ดูอย่างเดียว'; hdr.appendChild(info); }
    }

    // Auto-refresh when user comes back from another page
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) loadJobs();
    });
  });