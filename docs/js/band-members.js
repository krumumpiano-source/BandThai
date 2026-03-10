var _allMembers = [];
var _filteredMembers = [];

function loadBandMembers() {
  apiCall('getAllBandMembers', {}, function(r) {
    _allMembers = (r && r.success && r.data) ? r.data : [];
    _filteredMembers = _allMembers;
    renderMemberCards(_allMembers);
  });
}

function filterMembers() {
  var q = (document.getElementById('memberSearch') ? document.getElementById('memberSearch').value : '').toLowerCase();
  var status = document.getElementById('statusFilter') ? document.getElementById('statusFilter').value : '';
  _filteredMembers = _allMembers.filter(function(m) {
    return (!q || (m.name||'').toLowerCase().includes(q) || (m.position||'').toLowerCase().includes(q))
      && (!status || m.status === status);
  });
  renderMemberCards(_filteredMembers);
}

function renderMemberCards(members) {
  var container = document.getElementById('memberCards');
  if (!container) return;
  if (!members.length) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>' + t('noData') + '</p></div>'; return;
  }
  container.innerHTML = members.map(function(m) {
    return '<div class="member-card">'
      + '<div class="card-actions">'
      + '<button class="btn btn-ghost btn-sm" onclick="openMemberModal(\'' + escapeHtml(m.id||'') + '\')">✏️</button>'
      + '</div>'
      + '<div class="member-avatar">🎵</div>'
      + '<h4>' + escapeHtml(m.name||'') + '</h4>'
      + '<div class="role-badge">' + escapeHtml(m.position||m.role||'สมาชิก') + '</div>'
      + '<div class="contact">'
      + (m.phone ? '📞 ' + escapeHtml(m.phone) + '<br>' : '')
      + (m.email ? '✉️ ' + escapeHtml(m.email) : '')
      + '</div>'
      + '<div style="margin-top:var(--spacing-sm);font-size:var(--text-xs)">'
      + '<span class="status-dot ' + (m.status==='active'?'active':'inactive') + '"></span>'
      + (m.status === 'active' ? 'ใช้งาน' : 'ไม่ใช้งาน')
      + '</div>'
      + '</div>';
  }).join('');
}

function openMemberModal(id) {
  var modal = document.getElementById('memberModal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('memberForm').reset();
  document.getElementById('memberId').value = '';
  document.getElementById('deleteMemberBtn').style.display = 'none';
  document.getElementById('memberModalTitle').textContent = id ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิก';
  if (id) {
    var m = _allMembers.find(function(x) { return x.id === id; });
    if (m) {
      document.getElementById('memberId').value = m.id || '';
      document.getElementById('mName').value = m.name || '';
      document.getElementById('mPosition').value = m.position || '';
      document.getElementById('mPhone').value = m.phone || '';
      document.getElementById('mEmail').value = m.email || '';
      document.getElementById('mRate').value = m.defaultHourlyRate || '';
      document.getElementById('mStatus').value = m.status || 'active';
      document.getElementById('mNotes').value = m.notes || '';
      document.getElementById('deleteMemberBtn').style.display = 'inline-flex';
    }
  }
}

function closeMemberModal() {
  var modal = document.getElementById('memberModal');
  if (modal) modal.style.display = 'none';
}

if (document.getElementById('memberForm')) {
  document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('memberForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var btn = document.getElementById('saveMemberBtn');
      btn.disabled = true; btn.textContent = t('loading');
      var id = document.getElementById('memberId').value;
      var action = id ? 'updateBandMember' : 'addBandMember';
      apiCall(action, {
        memberId: id,
        name: document.getElementById('mName').value.trim(),
        position: document.getElementById('mPosition').value.trim(),
        phone: document.getElementById('mPhone').value.trim(),
        email: document.getElementById('mEmail').value.trim(),
        defaultHourlyRate: document.getElementById('mRate').value,
        status: document.getElementById('mStatus').value,
        notes: document.getElementById('mNotes').value.trim()
      }, function(r) {
        btn.disabled = false; btn.textContent = t('save');
        if (r && r.success) {
          showToast(t('msg_saved'), 'success');
          closeMemberModal();
          loadBandMembers();
        } else {
          showToast((r && r.message) || t('msg_error'), 'error');
        }
      });
    });
  });
}

function deleteCurrentMember() {
  var id = document.getElementById('memberId').value;
  showConfirm(t('confirmDeleteTitle'), t('confirmDeleteMsg'), {danger:true, confirmText:t('delete')}).then(function(ok) {
    if (!ok) return;
    apiCall('deleteBandMember', { memberId: id }, function(r) {
      if (r && r.success) {
        showToast(t('msg_deleted'), 'success');
        closeMemberModal();
        loadBandMembers();
      } else {
        showToast((r && r.message) || t('msg_error'), 'error');
      }
    });
  });
}
