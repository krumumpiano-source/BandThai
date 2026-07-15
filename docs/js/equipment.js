/* ════════════════════════════════════════════════════
     Equipment — BandThai
  ════════════════════════════════════════════════════ */
  var allEquip = [];
  var filterType = 'all';
  var pendingImageFile = null;

  var TYPE_CONFIG = {
    instrument: { label: 'เครื่องดนตรี', icon: '🎸' },
    audio:      { label: 'เสียง/PA',     icon: '🔊' },
    lighting:   { label: 'แสง',           icon: '💡' },
    accessory:  { label: 'อุปกรณ์เสริม',  icon: '🎒' },
    other:      { label: 'อื่นๆ',          icon: '📦' },
  };
  var STATUS_CONFIG = {
    normal: { cls: 'normal', label: '✅ ปกติ' },
    repair: { cls: 'repair', label: '🔧 ซ่อม' },
    broken: { cls: 'broken', label: '❌ เสียหาย' },
  };

  document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
      checkAdGate();
    renderMainNav('mainNav');
    applyTranslations();
    loadEquipment();

    // Auto-refresh when user comes back from another page
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) loadEquipment();
    });
  });

  /* ── Load & Render ── */
  function loadEquipment() {
    apiCall('getAllEquipment', {}, function(r) {
      allEquip = (r && r.success && r.data) ? r.data : [];
      renderSummary();
      renderEquip();
    });
  }

  function renderSummary() {
    if (!allEquip.length) { document.getElementById('summaryBar').style.display = 'none'; return; }
    document.getElementById('summaryBar').style.display = 'flex';
    document.getElementById('sumTotal').textContent = allEquip.length;
    var totalVal = allEquip.reduce(function(s, e) { return s + (parseFloat(e.price) || 0); }, 0);
    document.getElementById('sumValue').textContent = formatCurrency(totalVal);
    document.getElementById('sumRepair').textContent = allEquip.filter(function(e) { return e.status === 'repair'; }).length;
    document.getElementById('sumFund').textContent = allEquip.filter(function(e) { return e.fundSource === 'กองกลาง'; }).length;
  }

  function setFilter(type, el) {
    filterType = type;
    document.querySelectorAll('.type-tab').forEach(function(c) { c.classList.remove('active'); });
    el.classList.add('active');
    renderEquip();
  }

  function renderEquip() {
    var q = (document.getElementById('equipSearch').value || '').toLowerCase();
    var st = document.getElementById('statusFilterEq').value;
    var filtered = allEquip.filter(function(e) {
      return (filterType === 'all' || e.type === filterType)
        && (!q || (e.name||'').toLowerCase().includes(q)
                || (e.owner||'').toLowerCase().includes(q)
                || (e.purchaseSource||'').toLowerCase().includes(q))
        && (!st || e.status === st);
    });

    var grid = document.getElementById('equipGrid');
    if (!filtered.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px 0;color:var(--premium-text-muted)">ไม่พบรายการ</div>';
      return;
    }
    grid.innerHTML = filtered.map(function(e) { return buildCard(e); }).join('');
  }

  function buildCard(e) {
    var eid = escapeHtml(e.equipmentId || e.id || '');
    var tc = TYPE_CONFIG[e.type] || { label: e.type || '', icon: '📦' };
    var sc = STATUS_CONFIG[e.status] || STATUS_CONFIG.normal;
    var imgHtml = e.imageUrl
      ? '<div class="equip-card-img"><img src="' + escapeHtml(e.imageUrl) + '" alt="" loading="lazy" onerror="this.parentElement.innerHTML=\'<span>' + tc.icon + '</span>\'"></div>'
      : '<div class="equip-card-img">' + tc.icon + '</div>';
    var priceHtml = e.price ? '<div class="equip-card-price">฿' + formatCurrency(parseFloat(e.price)) + '</div>' : '';
    var metaParts = [];
    if (e.purchaseSource) metaParts.push('🏪 ' + escapeHtml(e.purchaseSource));
    if (e.purchaseDate)   metaParts.push('📅 ' + formatDateTH(e.purchaseDate));
    var fundHtml = e.fundSource ? '<span class="fund-' + escapeHtml(e.fundSource) + '">' + escapeHtml(e.fundSource) + '</span>' : '';
    var sourceHtml = (metaParts.length || fundHtml)
      ? '<div class="equip-card-source">' + metaParts.join(' · ') + (metaParts.length && fundHtml ? ' · ' : '') + fundHtml + '</div>'
      : '';
    return '<div class="equip-card" onclick="openEquipModal(\'' + eid + '\')">'
      + imgHtml
      + '<div class="equip-card-body">'
        + '<div class="equip-card-name">' + escapeHtml(e.name || '') + '</div>'
        + (e.owner ? '<div class="equip-card-sub">👤 ' + escapeHtml(e.owner) + '</div>' : '')
        + priceHtml
        + '<div class="equip-card-meta">'
          + '<span class="type-badge">' + tc.icon + ' ' + tc.label + '</span>'
          + '<span class="status-chip ' + sc.cls + '">' + sc.label + '</span>'
        + '</div>'
        + sourceHtml
      + '</div>'
      + '</div>';
  }

  function formatDateTH(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    var m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return d.getDate() + ' ' + m[d.getMonth()] + ' ' + (d.getFullYear() + 543);
  }

  /* ── Modal open/close ── */
  function openEquipModal(id) {
    document.getElementById('equipModal').style.display = 'flex';
    document.getElementById('equipForm').reset();
    document.getElementById('equipId').value = '';
    document.getElementById('eExistingImageUrl').value = '';
    document.getElementById('deleteEquipBtn').style.display = 'none';
    document.getElementById('equipModalTitle').textContent = id ? 'แก้ไขอุปกรณ์' : 'เพิ่มอุปกรณ์';
    document.querySelector('input[name="eStatus"][value="normal"]').checked = true;
    clearImagePreview();

    if (id) {
      var e = allEquip.find(function(x) { return (x.equipmentId || x.id) === id; });
      if (e) {
        document.getElementById('equipId').value = e.equipmentId || e.id || '';
        document.getElementById('eName').value = e.name || '';
        document.getElementById('eType').value = e.type || 'instrument';
        document.getElementById('ePurchaseSource').value = e.purchaseSource || '';
        document.getElementById('ePurchaseDate').value = (e.purchaseDate || '').substring(0, 10);
        document.getElementById('ePrice').value = e.price || '';
        document.getElementById('eFundSource').value = e.fundSource || '';
        document.getElementById('eOwner').value = e.owner || '';
        document.getElementById('eSerial').value = e.serialNo || '';
        document.getElementById('eNotes').value = e.notes || '';
        var radio = document.querySelector('input[name="eStatus"][value="' + (e.status || 'normal') + '"]');
        if (radio) radio.checked = true;
        document.getElementById('deleteEquipBtn').style.display = 'inline-flex';
        if (e.imageUrl) {
          document.getElementById('eExistingImageUrl').value = e.imageUrl;
          showImagePreview(e.imageUrl);
        }
      }
    }
  }

  function closeEquipModal() {
    document.getElementById('equipModal').style.display = 'none';
    clearImagePreview();
  }

  /* ── Image upload ── */
  function onImageSelect(evt) {
    var file = evt.target.files && evt.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('รูปต้องไม่เกิน 5 MB', 'error'); return; }
    pendingImageFile = file;
    var reader = new FileReader();
    reader.onload = function(e) { showImagePreview(e.target.result); };
    reader.readAsDataURL(file);
  }

  function onDragOver(e) {
    e.preventDefault();
    document.getElementById('uploadZone').classList.add('drag');
  }
  function onDragLeave() {
    document.getElementById('uploadZone').classList.remove('drag');
  }
  function onDrop(e) {
    e.preventDefault();
    document.getElementById('uploadZone').classList.remove('drag');
    var file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) { showToast('กรุณาลากไฟล์รูปภาพเท่านั้น', 'error'); return; }
    pendingImageFile = file;
    var reader = new FileReader();
    reader.onload = function(ev) { showImagePreview(ev.target.result); };
    reader.readAsDataURL(file);
  }

  function showImagePreview(src) {
    document.getElementById('uploadPlaceholder').style.display = 'none';
    var img = document.getElementById('imgPreview');
    img.src = src;
    img.style.display = 'block';
    document.getElementById('imgRemoveBtn').style.display = 'flex';
  }

  function clearImagePreview() {
    pendingImageFile = null;
    document.getElementById('uploadPlaceholder').style.display = 'flex';
    document.getElementById('imgPreview').style.display = 'none';
    document.getElementById('imgPreview').src = '';
    document.getElementById('imgRemoveBtn').style.display = 'none';
    document.getElementById('eImageFile').value = '';
    document.getElementById('uploadZone').classList.remove('drag');
  }

  function removeImage(e) {
    e.stopPropagation();
    clearImagePreview();
    document.getElementById('eExistingImageUrl').value = '';
  }

  /* ── Save ── */
  document.getElementById('equipForm').addEventListener('submit', function(ev) {
    ev.preventDefault();
    var saveBtn = document.getElementById('saveEquipBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'กำลังบันทึก...';

    var id = document.getElementById('equipId').value;
    var statusRadio = document.querySelector('input[name="eStatus"]:checked');
    var payload = {
      equipmentId:    id,
      name:           document.getElementById('eName').value.trim(),
      type:           document.getElementById('eType').value,
      purchaseSource: document.getElementById('ePurchaseSource').value.trim(),
      purchaseDate:   document.getElementById('ePurchaseDate').value,
      price:          document.getElementById('ePrice').value || 0,
      fundSource:     document.getElementById('eFundSource').value,
      owner:          document.getElementById('eOwner').value.trim(),
      serialNo:       document.getElementById('eSerial').value.trim(),
      status:         statusRadio ? statusRadio.value : 'normal',
      notes:          document.getElementById('eNotes').value.trim(),
      imageUrl:       document.getElementById('eExistingImageUrl').value,
    };

    function doSave(imgUrl) {
      if (imgUrl) payload.imageUrl = imgUrl;
      apiCall(id ? 'updateEquipment' : 'addEquipment', payload, function(r) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 บันทึก';
        if (r && r.success) {
          showToast('บันทึกสำเร็จ', 'success');
          closeEquipModal();
          loadEquipment();
        } else {
          showToast((r && r.message) || 'เกิดข้อผิดพลาด', 'error');
        }
      });
    }

    if (pendingImageFile) {
      var tempId = id || ('tmp_' + Date.now());
      apiCall('uploadEquipmentImage', { file: pendingImageFile, equipmentId: tempId }, function(r) {
        if (r && r.success && r.imageUrl) {
          doSave(r.imageUrl);
        } else {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 บันทึก';
          showToast('อัพโหลดรูปไม่สำเร็จ: ' + ((r && r.message) || ''), 'error');
        }
      });
    } else {
      doSave(null);
    }
  });

  /* ── Delete ── */
  function deleteCurrentEquip() {
    var id = document.getElementById('equipId').value;
    showConfirm('ยืนยันการลบ', 'ต้องการลบอุปกรณ์นี้ออกจากระบบ?', {danger:true, confirmText:'ลบ'}).then(function(ok) {
      if (!ok) return;
      apiCall('deleteEquipment', { equipmentId: id }, function(r) {
        if (r && r.success) {
          showToast('ลบแล้ว', 'success');
          closeEquipModal();
          loadEquipment();
        } else {
          showToast((r && r.message) || 'เกิดข้อผิดพลาด', 'error');
        }
      });
    });
  }