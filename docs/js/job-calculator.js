/* ── State ── */
  var allMembers = [];
  var vehicles = [];
  var expenses = [];
  var memberMode = 'equal';
  var accomOn = false;
  var foodOn = false;

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', function(){
    requireAuth();
      checkAdGate();
    renderMainNav('mainNav');
    if (typeof applyTranslations === 'function') applyTranslations();
    document.getElementById('eventDate').value = new Date().toISOString().substring(0,10);

    var draft = null;
    try { draft = JSON.parse(localStorage.getItem('jobCalcDraft') || 'null'); } catch(e){}

    apiCall('getAllBandMembers', {}, function(r){
      allMembers = (r && r.data) || [];
      renderMembersGrid();
      if (draft) applyDraft(draft);
      else recalc();
    });

    addVehicle();
    if (draft) applyDraft(draft);
    recalc();
  });

  /* ── Members ── */
  function renderMembersGrid(){
    var grid = document.getElementById('membersGrid');
    var msg  = document.getElementById('membersLoadMsg');
    if (!allMembers.length) {
      msg.textContent = '⚠️ ไม่พบสมาชิก (โปรดเพิ่มสมาชิกในหน้าจัดการวง)';
      return;
    }
    msg.style.display = 'none';
    grid.style.display = 'grid';
    var defaultRate = parseFloat(document.getElementById('defaultRate').value) || 1500;
    grid.innerHTML = allMembers.map(function(m, i){
      return '<div class="member-card selected" id="mcard_'+i+'" onclick="toggleMember('+i+')">'
        +'<input type="checkbox" id="mchk_'+i+'" checked onclick="event.stopPropagation();recalc()">'
        +'<div class="member-meta">'
        +'<div class="member-name">'+escapeHtml(m.name||m.displayName||'-')+'</div>'
        +'<div class="member-role">'+escapeHtml(m.instrument||m.role||'สมาชิก')+'</div>'
        +'</div>'
        +'<div class="member-rate-wrap">'
        +'<input type="number" class="member-rate-input" id="mrate_'+i+'" value="'+defaultRate+'" min="0" step="100" onclick="event.stopPropagation()" oninput="recalc()">'
        +'<span class="member-rate-label">บาท</span>'
        +'</div>'
        +'</div>';
    }).join('');
    recalc();
  }

  function toggleMember(i){
    var chk  = document.getElementById('mchk_'+i);
    var card = document.getElementById('mcard_'+i);
    chk.checked = !chk.checked;
    card.className = 'member-card' + (chk.checked ? ' selected' : '');
    recalc();
  }

  function setMemberMode(mode){
    memberMode = mode;
    document.getElementById('modeEqual').className  = mode==='equal'  ? 'active' : '';
    document.getElementById('modeCustom').className = mode==='custom' ? 'active' : '';
    document.getElementById('defaultRateWrap').style.display = mode==='equal' ? 'block' : 'none';
    recalc();
  }

  function updateDefaultRates(){
    if (memberMode !== 'equal') return;
    var defaultRate = parseFloat(document.getElementById('defaultRate').value) || 0;
    allMembers.forEach(function(_, i){
      var inp = document.getElementById('mrate_'+i);
      if (inp) inp.value = defaultRate;
    });
    recalc();
  }

  /* ── Vehicles ── */
  function addVehicle(v){
    var idx  = vehicles.length;
    var fuel = (v && v.fuel) || 'benzine';
    vehicles.push({ fuel: fuel });
    var list = document.getElementById('vehicleList');
    var row  = document.createElement('div');
    row.className = 'vehicle-row';
    row.id = 'vrow_'+idx;
    row.innerHTML =
      '<div><label>คันที่</label><b style="font-size:1.1rem">'+(idx+1)+'</b></div>'
      +'<div><label>ประเภทเชื้อเพลิง</label>'
        +'<div class="fuel-pills" id="vfuel_'+idx+'">'
        +'<button class="fuel-pill'+(fuel==='benzine'?' active':'')+'" onclick="setFuel('+idx+',\'benzine\',this)">⛽ เบนซิน</button>'
        +'<button class="fuel-pill'+(fuel==='diesel'?' active':'')+'" onclick="setFuel('+idx+',\'diesel\',this)">🛢️ ดีเซล</button>'
        +'<button class="fuel-pill'+(fuel==='electric'?' active':'')+'" onclick="setFuel('+idx+',\'electric\',this)">⚡ ไฟฟ้า</button>'
        +'</div></div>'
      +'<div><label>ชื่อ/ทะเบียน</label>'
        +'<input type="text" id="vcars_'+idx+'" value="'+(v&&v.carName||'')+'" placeholder="เช่น กข-1234" oninput="recalc()"></div>'
      +'<div><label id="vconsLabel_'+idx+'">'+(fuel==='electric'?'อัตรา (กม./kWh)':'อัตราสิ้นเปลือง (กม./ล.)')+'</label>'
        +'<input type="number" id="vcons_'+idx+'" value="'+(v&&v.consumption||(fuel==='electric'?6:12))+'" min="0.1" step="0.1" oninput="recalc()"></div>'
      +'<div><label>ค่าทางด่วน/ที่จอด (บาท)</label>'
        +'<input type="number" id="vtoll_'+idx+'" value="'+(v&&v.toll||0)+'" min="0" step="10" oninput="recalc()"></div>'
      +'<button class="btn btn-danger btn-sm" onclick="removeVehicle('+idx+')" style="height:36px;align-self:end">×</button>';
    list.appendChild(row);
  }

  function setFuel(idx, fuel, btn){
    vehicles[idx].fuel = fuel;
    var label = document.getElementById('vconsLabel_'+idx);
    if (fuel === 'electric') {
      label.textContent = 'อัตรา (กม./kWh)';
      document.getElementById('vcons_'+idx).value = 6;
    } else {
      label.textContent = 'อัตราสิ้นเปลือง (กม./ล.)';
      document.getElementById('vcons_'+idx).value = fuel==='diesel' ? 14 : 12;
    }
    document.getElementById('vfuel_'+idx).querySelectorAll('.fuel-pill').forEach(function(p){ p.classList.remove('active'); });
    btn.classList.add('active');
    recalc();
  }

  function removeVehicle(idx){
    var row = document.getElementById('vrow_'+idx);
    if (row) row.remove();
    vehicles[idx] = null;
    recalc();
  }

  /* ── Expenses ── */
  function addExpense(desc, amt){
    var idx  = expenses.length;
    expenses.push({});
    var list = document.getElementById('expenseList');
    var row  = document.createElement('div');
    row.className = 'expense-row';
    row.id = 'erow_'+idx;
    row.innerHTML =
      '<input type="text" id="edesc_'+idx+'" placeholder="เช่น ค่า PA ค่าอุปกรณ์ ค่าชุด" value="'+(desc?escapeHtml(String(desc)):'')+'" oninput="recalc()">'
      +'<input type="number" id="eamt_'+idx+'" placeholder="บาท" value="'+(amt||0)+'" min="0" step="100" oninput="recalc()">'
      +'<button class="btn btn-danger btn-sm" onclick="removeExpense('+idx+')">×</button>';
    list.appendChild(row);
  }

  function removeExpense(idx){
    var row = document.getElementById('erow_'+idx);
    if (row) row.remove();
    expenses[idx] = null;
    recalc();
  }

  /* ── Accommodation / Food toggles ── */
  function toggleSection(key, on){
    if (key === 'accom') {
      accomOn = on;
      document.getElementById('accomNo').className  = on ? '' : 'active';
      document.getElementById('accomYes').className = on ? 'active' : '';
      document.getElementById('accomSection').className = 'cond-section' + (on ? ' show' : '');
    } else {
      foodOn = on;
      document.getElementById('foodNo').className  = on ? '' : 'active';
      document.getElementById('foodYes').className = on ? 'active' : '';
      document.getElementById('foodSection').className = 'cond-section' + (on ? ' show' : '');
    }
    recalc();
  }

  /* ── Google Maps ── */
  function updateMapUrl(){
    var origin = (document.getElementById('origin').value || '').trim();
    var dest   = (document.getElementById('destination').value || '').trim();
    var wrap   = document.getElementById('mapWrap');
    if (!origin || !dest) {
      wrap.innerHTML = '<div class="map-placeholder">🗺️ ใส่ต้นทางและปลายทางเพื่อดูแผนที่</div>';
      return;
    }
    var src = 'https://maps.google.com/maps?saddr='
      + encodeURIComponent(origin)
      + '&daddr='
      + encodeURIComponent(dest)
      + '&output=embed&hl=th';
    wrap.innerHTML = '<iframe src="'+src+'" allowfullscreen loading="lazy"></iframe>';
  }

  function openGoogleMaps(){
    var origin = (document.getElementById('origin').value || '').trim();
    var dest   = (document.getElementById('destination').value || '').trim();
    var url = 'https://www.google.com/maps/dir/'+encodeURIComponent(origin||'ต้นทาง')+'/'+encodeURIComponent(dest||'ปลายทาง');
    window.open(url, '_blank');
  }

  function openDistanceCalc(){
    openGoogleMaps();
    if (typeof showToast === 'function') showToast('ดูระยะทางใน Google Maps แล้วกรอกกลับในช่อง "ระยะทาง 1 เที่ยว"', 'info');
  }

  /* ── Recalculate ── */
  function recalc(){
    // Members
    var memberCost = 0;
    var selectedNames = [];
    allMembers.forEach(function(m, i){
      var chk     = document.getElementById('mchk_'+i);
      var rateInp = document.getElementById('mrate_'+i);
      if (chk && chk.checked) {
        var rate = parseFloat(rateInp && rateInp.value) || 0;
        memberCost += rate;
        selectedNames.push((m.name || m.displayName || '-') + ' ฿'+formatN(rate));
      }
    });
    document.getElementById('selectedCount').textContent     = selectedNames.length;
    document.getElementById('totalMemberCost').textContent   = formatCurrency(memberCost);

    // Travel
    var dist          = parseFloat(document.getElementById('distanceKm').value) || 0;
    var fuelUnitPrice = parseFloat(document.getElementById('fuelUnitPrice').value) || 40;
    var roundTrip     = dist * 2;
    document.getElementById('roundTripKm').textContent = roundTrip.toFixed(0);
    var travelCost = 0;
    vehicles.forEach(function(v, idx){
      if (!v) return;
      var row = document.getElementById('vrow_'+idx);
      if (!row) return;
      var cons     = parseFloat((document.getElementById('vcons_'+idx)||{}).value) || 1;
      var toll     = parseFloat((document.getElementById('vtoll_'+idx)||{}).value) || 0;
      var fuelCost = (roundTrip / cons) * fuelUnitPrice;
      travelCost  += fuelCost + (toll * 2);
    });
    document.getElementById('totalTravelCost').textContent = formatCurrency(travelCost);

    // Accommodation
    var accomCost = 0;
    if (accomOn) {
      var rooms  = parseInt(document.getElementById('accomRooms').value)  || 0;
      var nights = parseInt(document.getElementById('accomNights').value) || 0;
      var rPrice = parseFloat(document.getElementById('accomPrice').value) || 0;
      accomCost  = rooms * nights * rPrice;
      document.getElementById('totalAccomCost').textContent = formatCurrency(accomCost);
    }

    // Food
    var foodCost = 0;
    if (foodOn) {
      var fp = parseInt(document.getElementById('foodPeople').value)       || 0;
      var fm = parseInt(document.getElementById('foodMeals').value)        || 0;
      var fd = parseInt(document.getElementById('foodDays').value)         || 1;
      var ff = parseFloat(document.getElementById('foodPricePerMeal').value) || 0;
      foodCost = fp * fm * fd * ff;
      document.getElementById('totalFoodCost').textContent  = formatCurrency(foodCost);
      document.getElementById('foodSummaryText').textContent = fp+' คน × '+fm+' มื้อ × '+fd+' วัน';
    }

    // Other
    var otherCost = 0;
    expenses.forEach(function(_, idx){
      otherCost += parseFloat((document.getElementById('eamt_'+idx)||{}).value) || 0;
    });
    document.getElementById('totalOtherCost').textContent = formatCurrency(otherCost);

    // Totals
    var totalCost  = memberCost + travelCost + accomCost + foodCost + otherCost;
    var fundPct    = parseFloat(document.getElementById('fundPct').value)   || 0;
    var profitPct  = parseFloat(document.getElementById('profitPct').value) || 0;
    var bufferPct  = parseFloat(document.getElementById('bufferPct').value) || 0;
    var fund       = Math.round(totalCost * fundPct / 100);
    var profit     = Math.round(totalCost * profitPct / 100);
    var minPrice   = totalCost + fund + profit;
    var suggestPrice = Math.round(minPrice * (1 + bufferPct / 100));

    // Summary panel
    document.getElementById('s_member').textContent   = formatCurrency(memberCost);
    document.getElementById('s_travel').textContent   = formatCurrency(travelCost);
    document.getElementById('s_accom_row').style.display = accomOn ? 'flex' : 'none';
    document.getElementById('s_accom').textContent    = formatCurrency(accomCost);
    document.getElementById('s_food_row').style.display  = foodOn ? 'flex' : 'none';
    document.getElementById('s_food').textContent     = formatCurrency(foodCost);
    document.getElementById('s_other_row').style.display = otherCost > 0 ? 'flex' : 'none';
    document.getElementById('s_other').textContent    = formatCurrency(otherCost);
    document.getElementById('s_totalCost').textContent   = formatCurrency(totalCost);
    document.getElementById('s_fundPct').textContent  = fundPct;
    document.getElementById('s_fund').textContent     = '+'+formatCurrency(fund);
    document.getElementById('s_profitPct').textContent   = profitPct;
    document.getElementById('s_profit').textContent   = '+'+formatCurrency(profit);
    document.getElementById('s_minPrice').textContent    = formatCurrency(minPrice);
    document.getElementById('s_suggestPrice').textContent = formatCurrency(suggestPrice);
    document.getElementById('s_bufferBadge').textContent  = 'เผื่อต่อรอง +'+bufferPct+'% = ฿'+formatN(suggestPrice - minPrice);

    // Auto-set proposed price if zero
    var proposedEl = document.getElementById('proposedPrice');
    var proposed   = parseFloat(proposedEl.value) || 0;
    if (proposed === 0) proposedEl.value = suggestPrice;
    else document.getElementById('priceWarning').style.display = proposed < minPrice ? 'block' : 'none';

    // Member detail
    if (selectedNames.length) {
      document.getElementById('s_member_detail').style.display = 'flex';
      document.getElementById('s_member_d').textContent = selectedNames.slice(0,3).join(', ')
        + (selectedNames.length > 3 ? ' …+อีก '+(selectedNames.length-3)+' คน' : '');
    } else {
      document.getElementById('s_member_detail').style.display = 'none';
    }
  }

  function formatN(n){ return Math.round(n).toLocaleString('th-TH'); }

  /* ── Collect & navigate ── */
  function collectData(){
    var selectedMembers = [];
    allMembers.forEach(function(m, i){
      var chk     = document.getElementById('mchk_'+i);
      var rateInp = document.getElementById('mrate_'+i);
      if (chk && chk.checked) {
        selectedMembers.push({
          id:         m.memberId || m.id || '',
          name:       m.name || m.displayName || '-',
          instrument: m.instrument || m.role || 'สมาชิก',
          rate:       parseFloat(rateInp ? rateInp.value : 0) || 0
        });
      }
    });

    var vehiclesData = [];
    vehicles.forEach(function(v, idx){
      if (!v || !document.getElementById('vrow_'+idx)) return;
      vehiclesData.push({
        fuel:        v.fuel || 'benzine',
        carName:     (document.getElementById('vcars_'+idx)||{}).value || '',
        consumption: parseFloat((document.getElementById('vcons_'+idx)||{}).value) || 0,
        toll:        parseFloat((document.getElementById('vtoll_'+idx)||{}).value) || 0
      });
    });

    var expensesData = [];
    expenses.forEach(function(_, idx){
      var d = document.getElementById('edesc_'+idx);
      var a = document.getElementById('eamt_'+idx);
      if (d && a && (d.value || parseFloat(a.value)))
        expensesData.push({ desc: d.value, amount: parseFloat(a.value)||0 });
    });

    var dist         = parseFloat(document.getElementById('distanceKm').value) || 0;
    var fuelUnitPrice = parseFloat(document.getElementById('fuelUnitPrice').value) || 40;
    var travelCost   = 0;
    vehiclesData.forEach(function(v){
      travelCost += ((dist*2) / (v.consumption||1)) * fuelUnitPrice + (v.toll * 2);
    });

    var accomCost = 0, accomRooms = 0, accomNights = 0, accomPrice = 0, accomName = '';
    if (accomOn) {
      accomRooms  = parseInt(document.getElementById('accomRooms').value)  || 0;
      accomNights = parseInt(document.getElementById('accomNights').value) || 0;
      accomPrice  = parseFloat(document.getElementById('accomPrice').value) || 0;
      accomName   = document.getElementById('accomName').value;
      accomCost   = accomRooms * accomNights * accomPrice;
    }

    var foodCost = 0, foodPeople = 0, foodMeals = 0, foodDays = 1, foodPricePerMeal = 0;
    if (foodOn) {
      foodPeople       = parseInt(document.getElementById('foodPeople').value)       || 0;
      foodMeals        = parseInt(document.getElementById('foodMeals').value)        || 0;
      foodDays         = parseInt(document.getElementById('foodDays').value)         || 1;
      foodPricePerMeal = parseFloat(document.getElementById('foodPricePerMeal').value) || 0;
      foodCost         = foodPeople * foodMeals * foodDays * foodPricePerMeal;
    }

    var memberCost   = selectedMembers.reduce(function(s, m){ return s + m.rate; }, 0);
    var otherCost    = expensesData.reduce(function(s, e){ return s + e.amount; }, 0);
    var totalCost    = memberCost + travelCost + accomCost + foodCost + otherCost;
    var fundPct      = parseFloat(document.getElementById('fundPct').value)   || 0;
    var profitPct    = parseFloat(document.getElementById('profitPct').value) || 0;
    var bufferPct    = parseFloat(document.getElementById('bufferPct').value) || 0;
    var fund         = Math.round(totalCost * fundPct / 100);
    var profit       = Math.round(totalCost * profitPct / 100);
    var minPrice     = totalCost + fund + profit;
    var suggestPrice = Math.round(minPrice * (1 + bufferPct / 100));
    var proposedPrice = parseFloat(document.getElementById('proposedPrice').value) || suggestPrice;

    return {
      jobName:       document.getElementById('jobName').value.trim(),
      clientName:    document.getElementById('clientName').value.trim(),
      clientPhone:   document.getElementById('clientPhone').value.trim(),
      clientContact: document.getElementById('clientContact').value.trim(),
      eventDate:     document.getElementById('eventDate').value,
      eventTime:     document.getElementById('eventTime').value,
      venueName:     document.getElementById('venueName').value.trim(),
      showHours:     parseFloat(document.getElementById('showHours').value) || 0,
      showSessions:  parseInt(document.getElementById('showSessions').value) || 1,
      breakMins:     parseInt(document.getElementById('breakMins').value) || 0,
      showNote:      document.getElementById('showNote').value.trim(),
      members:       selectedMembers,
      memberMode:    memberMode,
      memberCost:    Math.round(memberCost),
      origin:        document.getElementById('origin').value.trim(),
      destination:   document.getElementById('destination').value.trim(),
      distanceKm:    dist,
      roundTripKm:   dist * 2,
      fuelUnitPrice: fuelUnitPrice,
      vehicles:      vehiclesData,
      travelCost:    Math.round(travelCost),
      hasAccommodation: accomOn,
      accomRooms:    accomRooms,
      accomNights:   accomNights,
      accomPrice:    accomPrice,
      accomName:     accomName,
      accomCost:     Math.round(accomCost),
      hasFood:       foodOn,
      foodPeople:    foodPeople,
      foodMeals:     foodMeals,
      foodDays:      foodDays,
      foodPricePerMeal: foodPricePerMeal,
      foodCost:      Math.round(foodCost),
      otherExpenses: expensesData,
      otherCost:     Math.round(otherCost),
      totalCost:     Math.round(totalCost),
      fundPct:       fundPct,
      fundAmount:    fund,
      profitPct:     profitPct,
      profitAmount:  profit,
      bufferPct:     bufferPct,
      minPrice:      Math.round(minPrice),
      suggestPrice:  suggestPrice,
      proposedPrice: Math.round(proposedPrice),
      calcNotes:     document.getElementById('calcNotes').value.trim(),
      savedAt:       new Date().toISOString()
    };
  }

  function saveToLocal(){
    localStorage.setItem('jobCalcDraft', JSON.stringify(collectData()));
    if (typeof showToast === 'function') showToast('บันทึกร่างเรียบร้อย', 'success');
  }

  function goToQuotation(){
    if (!document.getElementById('clientName').value.trim()) {
      if (typeof showToast === 'function') showToast('กรุณาใส่ชื่อลูกค้า/เจ้าภาพ', 'error');
      return;
    }
    if (!document.getElementById('eventDate').value) {
      if (typeof showToast === 'function') showToast('กรุณาเลือกวันที่แสดง', 'error');
      return;
    }
    var data = collectData();
    localStorage.setItem('jobCalcData', JSON.stringify(data));
    localStorage.setItem('jobCalcDraft', JSON.stringify(data));
    window.location.href = 'quotation.html?from=calc';
  }

  function resetForm(){
    if (!confirm('รีเซ็ตข้อมูลทั้งหมด?')) return;
    localStorage.removeItem('jobCalcDraft');
    location.reload();
  }

  function applyDraft(d){
    if (!d) return;
    var fields = ['jobName','clientName','clientPhone','clientContact','eventDate','eventTime',
                  'venueName','showHours','showSessions','breakMins','showNote','origin',
                  'destination','distanceKm','fuelUnitPrice','fundPct','profitPct','bufferPct',
                  'proposedPrice','calcNotes','accomRooms','accomNights','accomPrice','accomName',
                  'foodPeople','foodMeals','foodDays','foodPricePerMeal'];
    fields.forEach(function(f){
      var el = document.getElementById(f);
      if (el && d[f] != null && d[f] !== '') el.value = d[f];
    });
    if (d.hasAccommodation) toggleSection('accom', true);
    if (d.hasFood) toggleSection('food', true);
    if (d.memberMode) setMemberMode(d.memberMode);
    if (d.origin || d.destination) updateMapUrl();
    if (d.otherExpenses && d.otherExpenses.length) {
      d.otherExpenses.forEach(function(e){ addExpense(e.desc, e.amount); });
    }
    recalc();
  }