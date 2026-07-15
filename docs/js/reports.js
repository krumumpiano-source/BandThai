(function() {
    'use strict';
    var activeTab='work', workPeriod='month', workOffset=0, slPeriod='day', slOffset=0;
    var scheduleData={}, bandMembers=[], weekStart=1, weekEnd=0;
    var myId='', myRole='', bandId='', wSelectedMember='__self';
    var _allCheckIns=[], _allLeaves=[], _currentRange=null, _loadReqId=0;
    var _slHistory=[], _slHistoryLoaded=false, _slDateInput='';
    var _songMeta={}, _songMetaLoaded=false;
    var DN=['\u0e2d\u0e32.','\u0e08.','\u0e2d.','\u0e1e.','\u0e1e\u0e24.','\u0e28.','\u0e2a.'];

    document.addEventListener('DOMContentLoaded', function() {
      requireAuth(); checkAdGate(); renderMainNav('mainNav'); applyTranslations();
      bandId=localStorage.getItem('bandId')||'';
      myRole=localStorage.getItem('userRole')||'';
      try { var a=JSON.parse(localStorage.getItem(('sb-' + (window._SB_CONFIG?.url?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'wsorngsyowgxikiepice') + '-auth-token'))||'null'); if(a&&a.user)myId=a.user.id||''; } catch(e){}
      if(!myId)myId=localStorage.getItem('odooMemberId')||localStorage.getItem('memberId')||'';

      document.querySelectorAll('[data-work-period]').forEach(function(btn){
        btn.addEventListener('click',function(){
          document.querySelectorAll('[data-work-period]').forEach(function(b){b.classList.remove('active');});
          btn.classList.add('active'); workPeriod=btn.dataset.workPeriod; workOffset=0; loadWork();
        });
      });
      document.getElementById('wPrev').onclick=function(){workOffset--;loadWork();};
      document.getElementById('wNext').onclick=function(){workOffset++;loadWork();};
      document.getElementById('wMemberPicker').onchange=function(){wSelectedMember=this.value;renderWork();};

      document.querySelectorAll('[data-sl-period]').forEach(function(btn){
        btn.addEventListener('click',function(){
          document.querySelectorAll('[data-sl-period]').forEach(function(b){b.classList.remove('active');});
          btn.classList.add('active'); slPeriod=btn.dataset.slPeriod; slOffset=0; updateSlUI();
          if(activeTab==='setlist')loadSetlist();
        });
      });
      document.getElementById('slPrev').onclick=function(){slOffset--;loadSetlist();};
      document.getElementById('slNext').onclick=function(){slOffset++;loadSetlist();};

      var today=new Date();
      var ts=today.getFullYear()+'-'+p2(today.getMonth()+1)+'-'+p2(today.getDate());
      var dp=document.getElementById('slDateInput'); dp.value=ts; _slDateInput=ts;
      dp.onchange=function(){_slDateInput=this.value;loadSetlist();};
      loadBandSettings(function(){loadWork();});
    });

    function loadSongMeta(cb){
      if(_songMetaLoaded){if(cb)cb();return;}
      if(!bandId){_songMetaLoaded=true;if(cb)cb();return;}
      apiCall('getSongs',{bandId:bandId,source:'band'},function(r){
        if(r&&r.success&&r.data){
          (r.data||[]).forEach(function(s){
            var k=(s.name||'').trim().toLowerCase();
            if(k)_songMeta[k]={genre:s.tags||'',era:s.era||'',mood:s.mood||''};
          });
        }
        _songMetaLoaded=true;if(cb)cb();
      });
    }
    function getSongMeta(name){
      return _songMeta[(name||'').trim().toLowerCase()]||{genre:'',era:'',mood:''};
    }
    function calcDist(songs){
      var genreMap={},eraMap={},reqSongs=0,totalG=0,totalE=0;
      (songs||[]).forEach(function(s){
        var m=getSongMeta(s.name);
        var g=m.genre||s.genre||'';
        var e=m.era||s.era||'';
        if(s._isRequest)reqSongs++;
        if(g){genreMap[g]=(genreMap[g]||0)+1;totalG++;}
        if(e){eraMap[e]=(eraMap[e]||0)+1;totalE++;}
      });
      return{genreMap:genreMap,eraMap:eraMap,reqSongs:reqSongs,total:(songs||[]).length,totalG:totalG,totalE:totalE};
    }
    function distBarRows(map,total,cls){
      return Object.keys(map).sort(function(a,b){return map[b]-map[a];}).map(function(k){
        var pct=total?Math.round(map[k]/total*100):0;
        return'<div class="dist-row"><div class="dist-label">'+esc(k)+'</div>'+
          '<div class="dist-bar-wrap"><div class="dist-bar '+cls+'" style="width:'+pct+'%"></div></div>'+
          '<div class="dist-count">'+map[k]+'</div><div class="dist-pct">'+pct+'%</div></div>';
      }).join('');
    }
    function breakDistHtml(songs){
      if(!songs||!songs.length)return'';
      var d=calcDist(songs);
      if(d.totalG===0&&d.totalE===0&&d.reqSongs===0)return'';
      var reqPct=d.total?Math.round(d.reqSongs/d.total*100):0;
      var h='<div class="sl-break-dist">';
      if(d.totalG>0)h+='<div class="dist-section"><div class="dist-section-title">🎸 แนวเพลง</div>'+distBarRows(d.genreMap,d.totalG,'genre')+'</div>';
      if(d.totalE>0)h+='<div class="dist-section"><div class="dist-section-title">📅 ยุค</div>'+distBarRows(d.eraMap,d.totalE,'era')+'</div>';
      if(d.reqSongs>0)h+='<div class="dist-section"><div class="dist-section-title">🙏 ลูกค้าขอ '+d.reqSongs+'/'+d.total+' ('+reqPct+'%)</div>'+
        '<div class="dist-row"><div class="dist-label">เพลงขอ</div><div class="dist-bar-wrap"><div class="dist-bar req" style="width:'+reqPct+'%"></div></div><div class="dist-count">'+d.reqSongs+'</div><div class="dist-pct">'+reqPct+'%</div></div>'+
        '<div class="dist-row"><div class="dist-label">วงเลือกเอง</div><div class="dist-bar-wrap"><div class="dist-bar" style="width:'+(100-reqPct)+'%;background:#6b7280"></div></div><div class="dist-count">'+(d.total-d.reqSongs)+'</div><div class="dist-pct">'+(100-reqPct)+'%</div></div></div>';
      h+='</div>';
      return h;
    }
    function renderDistribution(history){
      var dc=document.getElementById('slDistCard');
      if(!dc)return;
      var allSongs=[];
      history.forEach(function(brk){(brk.songs||[]).forEach(function(s){allSongs.push(s);});});
      if(!allSongs.length){dc.style.display='none';return;}
      var d=calcDist(allSongs);
      var noMeta=(d.totalG===0&&d.totalE===0);
      var reqPct=d.total?Math.round(d.reqSongs/d.total*100):0;
      var shieldMsg='';
      if(reqPct>=30)shieldMsg='<div class="dist-shield ok">🛡️  '+reqPct+'% เป็นเพลงที่ลูกค้าขอ — วงตอบสนองดีเยี่ยม</div>';
      else if(d.reqSongs>0)shieldMsg='<div class="dist-shield warn">🙏  มีเพลงขอ '+d.reqSongs+' เพลง ('+reqPct+'%) — ลูกค้ามีส่วนร่วมกับวง</div>';
      var html=shieldMsg+'<h3>📊 สัดส่วนรวมช่วงนี้</h3>';
      if(noMeta){
        html+='<div class="dist-no-meta">ℹ️ ยังไม่มีข้อมูล genre/ยุค — ไปที่ <strong>คลังเพลง</strong> แล้วกดแก้ไขเพลงเพื่อระบุแนวเพลงและยุค</div>';
      } else {
        if(d.totalG>0)html+='<div class="dist-section"><div class="dist-section-title">🎸 แนวเพลง (genre)</div>'+distBarRows(d.genreMap,d.totalG,'genre')+'</div>';
        if(d.totalE>0)html+='<div class="dist-section"><div class="dist-section-title">📅 ยุค (era)</div>'+distBarRows(d.eraMap,d.totalE,'era')+'</div>';
      }
      if(d.reqSongs>0){
        html+='<div class="dist-section"><div class="dist-section-title">🙏 เพลงขอจากลูกค้า</div>'+
          '<div class="dist-row"><div class="dist-label">เพลงขอ</div>'+
          '<div class="dist-bar-wrap"><div class="dist-bar req" style="width:'+reqPct+'%"></div></div>'+
          '<div class="dist-count">'+d.reqSongs+' เพลง</div><div class="dist-pct">'+reqPct+'%</div></div>'+
          '<div class="dist-row"><div class="dist-label">วงเลือกเอง</div>'+
          '<div class="dist-bar-wrap"><div class="dist-bar" style="width:'+(100-reqPct)+'%;background:#6b7280"></div></div>'+
          '<div class="dist-count">'+(d.total-d.reqSongs)+' เพลง</div><div class="dist-pct">'+(100-reqPct)+'%</div></div></div>';
      }
      dc.innerHTML=html;
      dc.style.display='';
    }

    window.switchMainTab=function(tab){
      activeTab=tab;
      document.getElementById('mainTabWork').classList.toggle('active',tab==='work');
      document.getElementById('mainTabSetlist').classList.toggle('active',tab==='setlist');
      document.getElementById('tabWork').style.display=tab==='work'?'':'none';
      document.getElementById('tabSetlist').style.display=tab==='setlist'?'':'none';
      if(tab==='setlist'&&!_slHistoryLoaded)loadSetlist();
    };

    function loadBandSettings(cb){
      var stored=null; try{stored=JSON.parse(localStorage.getItem('bandSettings')||'null');}catch(e){}
      function apply(s){
        scheduleData=s.scheduleData||s.schedule||{}; bandMembers=s.members||[];
        if(s.payroll){
          if(s.payroll.weekStart!==undefined)weekStart=parseInt(s.payroll.weekStart,10);
          if(s.payroll.weekEnd!==undefined)weekEnd=parseInt(s.payroll.weekEnd,10);
        }
        setupWMemberSelector();
      }
      if(stored&&(stored.schedule||stored.scheduleData)&&stored.members){
        apply(stored); if(cb)cb();
        if(bandId&&typeof apiCall==='function')apiCall('getBandSettings',{bandId:bandId},function(r){if(r&&r.success&&r.data){try{localStorage.setItem('bandSettings',JSON.stringify(r.data));}catch(e){} apply(r.data);}});
        return;
      }
      if(bandId&&typeof apiCall==='function')apiCall('getBandSettings',{bandId:bandId},function(r){if(r&&r.success&&r.data){try{localStorage.setItem('bandSettings',JSON.stringify(r.data));}catch(e){} apply(r.data);}if(cb)cb();});
      else{if(cb)cb();}
    }

    function setupWMemberSelector(){
      var isMgr=(myRole==='admin'||myRole==='manager');
      var sel=document.getElementById('wMemberSelector'), picker=document.getElementById('wMemberPicker');
      if(!isMgr||!bandMembers.length){sel.style.display='none';wSelectedMember='__self';return;}
      sel.style.display='flex';
      picker.innerHTML='<option value="__all">\u{1F4CA} \u0e17\u0e38\u0e01\u0e04\u0e19\u0e23\u0e27\u0e21</option><option value="__self">\u{1F464} \u0e02\u0e2d\u0e07\u0e09\u0e31\u0e19</option>';
      bandMembers.forEach(function(m){var o=document.createElement('option');o.value=m.memberId||m.id;o.textContent='\u{1F464} '+(m.name||'\u0e44\u0e21\u0e48\u0e23\u0e30\u0e1a\u0e38');picker.appendChild(o);});
      wSelectedMember='__all'; picker.value='__all';
    }

    function getWorkRange(){
      var today=new Date(),start,end,label;
      if(workPeriod==='week'){
        var ref=new Date(today);ref.setDate(ref.getDate()+workOffset*7);
        var dow=ref.getDay(),diff=(dow-weekStart+7)%7;
        start=new Date(ref);start.setDate(ref.getDate()-diff);
        var span=(weekEnd-weekStart+7)%7;if(span===0)span=6;
        end=new Date(start);end.setDate(start.getDate()+span);
        label=formatThaiDateFull(start,{year:false})+' \u2013 '+formatThaiDateFull(end);
      } else if(workPeriod==='month'){
        var mRef=new Date(today.getFullYear(),today.getMonth()+workOffset,1);
        start=new Date(mRef.getFullYear(),mRef.getMonth(),1);
        end=new Date(mRef.getFullYear(),mRef.getMonth()+1,0);
        label=THAI_MONTHS_LONG[mRef.getMonth()]+' '+(mRef.getFullYear()+543);
      } else {
        var yRef=today.getFullYear()+workOffset;
        start=new Date(yRef,0,1);end=new Date(yRef,11,31);
        label='\u0e1b\u0e35 '+(yRef+543);
      }
      var dates=[];
      for(var dd=new Date(start);dd<=end;dd.setDate(dd.getDate()+1)){
        var _d=new Date(dd);
        dates.push(_d.getFullYear()+'-'+p2(_d.getMonth()+1)+'-'+p2(_d.getDate()));
      }
      return {start:start,end:end,dates:dates,label:label};
    }

    function p2(n){return String(n).padStart(2,'0');}
    function parseMin(t){if(!t)return 0;var pp=t.split(':').map(Number);return pp[0]*60+(pp[1]||0);}
    function calcH(s,e){var d=e-s;if(d<0)d+=1440;return d/60;}
    function getSlotsForDow(dow){var dd=scheduleData[dow]||scheduleData[String(dow)];if(Array.isArray(dd))return dd;if(dd&&dd.timeSlots)return dd.timeSlots;return[];}
    function getMemberRate(slot,mid){var ms=slot.members||[];for(var i=0;i<ms.length;i++){if(ms[i].memberId===mid)return{rate:ms[i].rate||0,type:ms[i].rateType||'shift',assigned:true};}return{rate:0,type:'shift',assigned:false};}
    function slotPay(slot,mid){var r=getMemberRate(slot,mid);if(r.rate<=0)return 0;if(r.type==='hourly')return calcH(parseMin(slot.startTime),parseMin(slot.endTime))*r.rate;return r.rate;}
    function slotHours(slot){return calcH(parseMin(slot.startTime),parseMin(slot.endTime));}
    function fmt(n){return Number(n).toLocaleString('th-TH');}
    function fmtH(h){return Number(h).toFixed(1);}
    function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

    function loadWork(){
      var range=getWorkRange();_currentRange=range;
      document.getElementById('wPeriodLabel').textContent=range.label;
      document.getElementById('wCards').innerHTML='<div class="ov-card"><div class="ico" style="display:inline-block;animation:spin 1s linear infinite">\u23f3</div><div class="lbl">\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...</div></div>';
      document.getElementById('shieldBanner').innerHTML='';
      _allCheckIns=[];_allLeaves=[];
      if(!range.dates.length){renderWork();return;}
      var dateFrom=range.dates[0],dateTo=range.dates[range.dates.length-1];
      var rid=++_loadReqId,ciDone=false,lvDone=false;
      var isMgr=(myRole==='admin'||myRole==='manager'),mf=isMgr?undefined:myId;
      apiCall('getCheckInsForRange',{bandId:bandId,dateFrom:dateFrom,dateTo:dateTo,memberId:mf},function(r){
        if(rid!==_loadReqId)return;if(r&&r.success&&r.data)_allCheckIns=r.data;ciDone=true;if(lvDone)renderWork();
      });
      apiCall('getLeaveRequestsForRange',{bandId:bandId,dateFrom:dateFrom,dateTo:dateTo,memberId:mf},function(r){
        if(rid!==_loadReqId)return;if(r&&r.success&&r.data)_allLeaves=r.data;lvDone=true;if(ciDone)renderWork();
      });
    }

    function computeMember(mid){
      var range=_currentRange;if(!range)return null;
      var myCI={};
      _allCheckIns.forEach(function(ci){
        if(ci.memberId!==mid)return;
        if(!myCI[ci.date])myCI[ci.date]={slots:[],status:'',substitute:null};
        (ci.slots||[]).forEach(function(s){if(myCI[ci.date].slots.indexOf(s)<0)myCI[ci.date].slots.push(s);});
        if(ci.status)myCI[ci.date].status=ci.status;
        if(ci.substitute)myCI[ci.date].substitute=ci.substitute;
      });
      var myLV=_allLeaves.filter(function(lv){return lv.memberId===mid;});
      var totalBreaks=0,totalHours=0,totalEarnings=0,leaveSub=0,leaveNoSub=0,scheduledDays=0,attendedDays=0,daily=[];
      range.dates.forEach(function(ds){
        var dtObj=new Date(ds),dow=dtObj.getDay(),daySlots=getSlotsForDow(dow);
        if(!daySlots.length)return;scheduledDays++;
        var ci=myCI[ds],ciSlots=ci?ci.slots:[],isLeave=ci&&ci.status==='leave';
        var hasSub=false,subName='';
        if(isLeave)myLV.forEach(function(lv){if(lv.date===ds&&lv.substituteName){hasSub=true;subName=lv.substituteName;}});
        var dayBreaks=0,dayHours=0,dayAmt=0,status='none';
        if(isLeave){
          if(hasSub){leaveSub++;status='leave_sub';daySlots.forEach(function(slot){var mr=getMemberRate(slot,mid);if(!mr.assigned)return;dayBreaks++;dayHours+=slotHours(slot);dayAmt+=slotPay(slot,mid);});}
          else{leaveNoSub++;status='leave_nosub';}
        } else {
          daySlots.forEach(function(slot){
            var sk=(slot.startTime||'')+'-'+(slot.endTime||'');
            var mr=getMemberRate(slot,mid);if(!mr.assigned)return;
            if(ciSlots.indexOf(sk)>=0){status='ok';dayBreaks++;dayHours+=slotHours(slot);dayAmt+=slotPay(slot,mid);}
          });
          if(status==='ok')attendedDays++;
        }
        totalBreaks+=dayBreaks;totalHours+=dayHours;totalEarnings+=dayAmt;
        daily.push({date:ds,dow:dow,dayBreaks:dayBreaks,dayHours:dayHours,dayAmt:dayAmt,status:status,subName:subName});
      });
      var attendRate=scheduledDays>0?Math.round((attendedDays+leaveSub)/scheduledDays*100):0;
      return{totalBreaks:totalBreaks,totalHours:totalHours,totalEarnings:totalEarnings,leaveSub:leaveSub,leaveNoSub:leaveNoSub,scheduledDays:scheduledDays,attendedDays:attendedDays,attendRate:attendRate,daily:daily};
    }

    function renderWork(){
      var isMgr=(myRole==='admin'||myRole==='manager'),showAll=isMgr&&wSelectedMember==='__all';
      document.getElementById('wAllMembersCard').style.display=showAll?'':'none';
      document.getElementById('wDetailCard').style.display=showAll?'none':'';
      if(showAll)renderAllMembers();
      else{var mid=(wSelectedMember==='__self'||!wSelectedMember)?myId:wSelectedMember;renderSelfWork(mid);}
    }

    function renderSelfWork(mid){
      var stats=computeMember(mid),range=_currentRange,banner=document.getElementById('shieldBanner');
      if(!stats||stats.scheduledDays===0){
        banner.innerHTML='<div class="shield-banner neutral"><div class="shield-icon">\u{1F4CB}</div><div class="shield-text"><div class="shield-title">\u0e44\u0e21\u0e48\u0e21\u0e35\u0e27\u0e31\u0e19\u0e17\u0e33\u0e07\u0e32\u0e19\u0e43\u0e19\u0e0a\u0e48\u0e27\u0e07\u0e19\u0e35\u0e49</div><div class="shield-subtitle">\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e2d\u0e1a\u0e15\u0e32\u0e23\u0e32\u0e07 schedule \u0e43\u0e19\u0e01\u0e32\u0e23\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32\u0e27\u0e07</div></div></div>';
        document.getElementById('wCards').innerHTML='';
        document.getElementById('wDetailTbody').innerHTML='<tr><td colspan="7" style="text-align:center;color:var(--premium-text-muted)">\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25</td></tr>';
        return;
      }
      var rate=stats.attendRate,cls=rate>=90?'green':rate>=75?'yellow':'red';
      var icon=rate>=90?'\u{1F6E1}\uFE0F':rate>=75?'\u26A0\uFE0F':'\u{1F6A8}';
      var msg=rate>=90?'\u0e01\u0e32\u0e23\u0e40\u0e02\u0e49\u0e32\u0e07\u0e32\u0e19\u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19\u0e40\u0e01\u0e13\u0e11\u0e4c\u0e14\u0e35\u0e40\u0e22\u0e35\u0e48\u0e22\u0e21':rate>=75?'\u0e01\u0e32\u0e23\u0e40\u0e02\u0e49\u0e32\u0e07\u0e32\u0e19\u0e2d\u0e22\u0e39\u0e48\u0e43\u0e19\u0e40\u0e01\u0e13\u0e11\u0e4c\u0e1b\u0e32\u0e19\u0e01\u0e25\u0e32\u0e07':'\u0e01\u0e32\u0e23\u0e40\u0e02\u0e49\u0e32\u0e07\u0e32\u0e19\u0e15\u0e48\u0e33 \u2014 \u0e15\u0e49\u0e2d\u0e07\u0e1b\u0e23\u0e31\u0e1a\u0e1b\u0e23\u0e38\u0e07';
      var bandN=localStorage.getItem('bandName')||'\u0e27\u0e07';
      banner.innerHTML='<div class="shield-banner '+cls+'"><div class="shield-icon">'+icon+'</div><div class="shield-text"><div class="shield-title">'+msg+'</div><div class="shield-subtitle">'+esc(bandN)+' \u00b7 '+esc(range?range.label:'')+'</div><div class="shield-stats"><div class="shield-stat">\u0e40\u0e02\u0e49\u0e32\u0e07\u0e32\u0e19 <span>'+stats.attendedDays+'/'+stats.scheduledDays+' \u0e27\u0e31\u0e19</span></div><div class="shield-stat">\u0e40\u0e1a\u0e23\u0e04\u0e23\u0e27\u0e21 <span>'+stats.totalBreaks+' \u0e40\u0e1a\u0e23\u0e04</span></div><div class="shield-stat">\u0e0a\u0e31\u0e48\u0e27\u0e42\u0e21\u0e07\u0e23\u0e27\u0e21 <span>'+fmtH(stats.totalHours)+' \u0e0a\u0e21.</span></div>'+(stats.totalEarnings>0?'<div class="shield-stat">\u0e23\u0e32\u0e22\u0e44\u0e14\u0e49 <span>\u0e3f'+fmt(stats.totalEarnings)+'</span></div>':'')+'</div><div class="print-note">\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a BandThai \u00b7 '+new Date().toLocaleDateString('th-TH')+'</div></div></div>';

      var htmlCards = '<div class="bolder-summary">';
      htmlCards += '<div class="bs-primary">';
      htmlCards += '  <div class="bs-stat bs-rate"><div class="bs-val ' + (rate>=90?'text-green':rate>=75?'text-yellow':'text-red') + '">'+rate+'%</div><div class="bs-lbl">\u0e2d\u0e31\u0e15\u0e23\u0e32\u0e40\u0e02\u0e49\u0e32\u0e07\u0e32\u0e19 ('+stats.attendedDays+' \u0e27\u0e31\u0e19)</div></div>';
      if (stats.totalEarnings > 0) {
        htmlCards += '  <div class="bs-stat bs-earn"><div class="bs-val text-gold">\u0e3f'+fmt(stats.totalEarnings)+'</div><div class="bs-lbl">\u0e23\u0e32\u0e22\u0e44\u0e14\u0e49\u0e23\u0e27\u0e21</div></div>';
      }
      htmlCards += '</div>';
      htmlCards += '<div class="bs-secondary">';
      htmlCards += '  <div class="bs-item"><span class="bs-ico">\u23f1\uFE0F</span> <strong>'+fmtH(stats.totalHours)+' \u0e0a\u0e21.</strong> \u0e0a\u0e31\u0e48\u0e27\u0e42\u0e21\u0e07\u0e23\u0e27\u0e21</div>';
      if (stats.leaveNoSub > 0) {
        htmlCards += '  <div class="bs-item bs-warn"><span class="bs-ico">\u26A0\uFE0F</span> <strong>'+stats.leaveNoSub+' \u0e27\u0e31\u0e19</strong> \u0e25\u0e32\u0e44\u0e21\u0e48\u0e21\u0e35\u0e04\u0e19\u0e41\u0e17\u0e19</div>';
      }
      htmlCards += '</div>';
      htmlCards += '</div>';
      document.getElementById('wCards').innerHTML = htmlCards;

      var rows='';
      stats.daily.forEach(function(d){
        var dtObj=new Date(d.date),dayLabel=DN[d.dow],dd2=p2(dtObj.getDate()),mm2=p2(dtObj.getMonth()+1);
        var sb=d.status==='ok'?'<span class="badge-ok">\u2705 \u0e40\u0e02\u0e49\u0e32\u0e07\u0e32\u0e19</span>':
          d.status==='leave_sub'?'<span class="badge-leave">\u{1F504} \u0e25\u0e32/\u0e21\u0e35\u0e41\u0e17\u0e19</span>':
          d.status==='leave_nosub'?'<span class="badge-absent">\u274C \u0e25\u0e32/\u0e44\u0e21\u0e48\u0e21\u0e35\u0e41\u0e17\u0e19</span>':
          '<span style="color:var(--premium-text-muted);font-size:var(--text-xs)">\u2014</span>';
        rows+='<tr><td data-label="วันที่">'+dd2+'/'+mm2+'</td><td data-label="วัน">'+dayLabel+'</td><td data-label="สถานะ">'+sb+'</td>'+
          '<td class="ctr" data-label="เบรค">'+(d.dayBreaks||'\u2014')+'</td>'+
          '<td class="num" data-label="ชั่วโมง">'+(d.dayHours>0?fmtH(d.dayHours):'\u2014')+'</td>'+
          '<td class="num" data-label="รายได้">'+(d.dayAmt>0?'\u0e3f'+fmt(d.dayAmt):'\u2014')+'</td>'+
          '<td style="font-size:var(--text-xs);color:var(--premium-text-muted)" data-label="หมายเหตุ">'+(d.subName?'\u0e04\u0e19\u0e41\u0e17\u0e19: '+esc(d.subName):'')+'</td></tr>';
      });
      document.getElementById('wDetailTbody').innerHTML=rows||'<tr><td colspan="7" style="text-align:center;color:var(--premium-text-muted)">\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25</td></tr>';
    }

    function renderAllMembers(){
      document.getElementById('shieldBanner').innerHTML='';document.getElementById('wCards').innerHTML='';
      var ids=[];
      _allCheckIns.forEach(function(ci){if(ci.memberId&&ids.indexOf(ci.memberId)<0)ids.push(ci.memberId);});
      bandMembers.forEach(function(m){var mid=m.memberId||m.id;if(mid&&ids.indexOf(mid)<0)ids.push(mid);});
      var allStats=ids.map(function(mid){
        var s=computeMember(mid);if(!s||s.scheduledDays===0)return null;
        var mInfo=bandMembers.find(function(m){return(m.memberId||m.id)===mid;});
        return{mid:mid,name:mInfo?(mInfo.name||'\u0e44\u0e21\u0e48\u0e23\u0e30\u0e1a\u0e38'):(mid.substring(0,8)+'\u2026'),stats:s};
      }).filter(Boolean);
      if(allStats.length>0){
        var avgRate=Math.round(allStats.reduce(function(s,m){return s+m.stats.attendRate;},0)/allStats.length);
        var totalH=allStats.reduce(function(s,m){return s+m.stats.totalHours;},0);
        var cls2=avgRate>=90?'green':avgRate>=75?'yellow':'red';
        var icon2=avgRate>=90?'\u{1F6E1}\uFE0F':avgRate>=75?'\u26A0\uFE0F':'\u{1F6A8}';
        document.getElementById('shieldBanner').innerHTML='<div class="shield-banner '+cls2+'"><div class="shield-icon">'+icon2+'</div><div class="shield-text"><div class="shield-title">\u0e2a\u0e23\u0e38\u0e1b\u0e17\u0e31\u0e49\u0e07\u0e27\u0e07 \u2014 \u0e2d\u0e31\u0e15\u0e23\u0e32\u0e40\u0e02\u0e49\u0e32\u0e07\u0e32\u0e19\u0e40\u0e09\u0e25\u0e35\u0e48\u0e22 '+avgRate+'%</div><div class="shield-subtitle">'+esc(document.getElementById('wPeriodLabel').textContent)+'</div><div class="shield-stats"><div class="shield-stat">\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01 <span>'+allStats.length+' \u0e04\u0e19</span></div><div class="shield-stat">\u0e0a\u0e31\u0e48\u0e27\u0e42\u0e21\u0e07\u0e23\u0e27\u0e21 <span>'+fmtH(totalH)+' \u0e0a\u0e21.</span></div></div><div class="print-note">\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a BandThai \u00b7 '+new Date().toLocaleDateString('th-TH')+'</div></div></div>';
      }
      var rows='';
      allStats.forEach(function(item){
        var s=item.stats,rc=s.attendRate>=90?'color:#276749;font-weight:700':s.attendRate>=75?'color:#92400e;font-weight:700':'color:#c53030;font-weight:700';
        rows+='<tr><td data-label="ชื่อ">'+esc(item.name)+'</td><td class="ctr" data-label="เบรค">'+s.totalBreaks+'</td><td class="num" data-label="ชั่วโมง">'+fmtH(s.totalHours)+'</td>'+
          '<td class="num" data-label="รายได้">'+(s.totalEarnings>0?'\u0e3f'+fmt(s.totalEarnings):'\u2014')+'</td>'+
          '<td class="ctr" data-label="ลา(มีแทน)">'+(s.leaveSub||'\u2014')+'</td>'+
          '<td class="ctr" data-label="ลา(ไม่มี)">'+(s.leaveNoSub>0?'<span style="color:#c53030;font-weight:700">'+s.leaveNoSub+'</span>':'\u2014')+'</td>'+
          '<td class="num" data-label="อัตราเข้างาน"><span style="'+rc+'">'+s.attendRate+'%</span></td></tr>';
      });
      document.getElementById('wAllTbody').innerHTML=rows||'<tr><td colspan="7" style="text-align:center;color:var(--premium-text-muted)">\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25</td></tr>';
    }

    function updateSlUI(){
      var isDay=slPeriod==='day';
      document.getElementById('slDatePickerRow').style.display=isDay?'':'none';
      document.getElementById('slPeriodNav').style.display=isDay?'none':'';
    }

    function getSlRange(){
      var today=new Date(),start,end,label;
      if(slPeriod==='week'){
        var ref=new Date(today);ref.setDate(ref.getDate()+slOffset*7);
        var dow=ref.getDay(),diff=(dow-weekStart+7)%7;
        start=new Date(ref);start.setDate(ref.getDate()-diff);
        var span=(weekEnd-weekStart+7)%7;if(span===0)span=6;
        end=new Date(start);end.setDate(start.getDate()+span);
        label=formatThaiDateFull(start,{year:false})+' \u2013 '+formatThaiDateFull(end);
      } else {
        var mRef=new Date(today.getFullYear(),today.getMonth()+slOffset,1);
        start=new Date(mRef.getFullYear(),mRef.getMonth(),1);
        end=new Date(mRef.getFullYear(),mRef.getMonth()+1,0);
        label=THAI_MONTHS_LONG[mRef.getMonth()]+' '+(mRef.getFullYear()+543);
      }
      var dates=[];
      for(var dd=new Date(start);dd<=end;dd.setDate(dd.getDate()+1)){
        var _d=new Date(dd);
        dates.push(_d.getFullYear()+'-'+p2(_d.getMonth()+1)+'-'+p2(_d.getDate()));
      }
      return{dates:dates,label:label};
    }

    function loadSetlist(){
      document.getElementById('slContent').innerHTML='<div class="loading-state">\u23f3 \u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...</div>';
      document.getElementById('slStatCards').style.display='none';
      loadSongMeta(function(){
      if(slPeriod==='day'){
        var d=_slDateInput;if(!d)return;
        apiCall('getPlaylistHistoryByDate',{date:d},function(r){
          renderSetlist([d],(r&&r.success&&r.data)?r.data:[]);
        });
      } else {
        var range=getSlRange();document.getElementById('slPeriodLabel').textContent=range.label;
        if(!_slHistoryLoaded){
          apiCall('getPlaylistHistory',{},function(r){
            _slHistory=(r&&r.success&&r.data)?r.data:[];_slHistoryLoaded=true;
            renderSetlist(range.dates,_slHistory.filter(function(h){return range.dates.indexOf(h.date)>=0;}));
          });
        } else {
          var r2=getSlRange();
          renderSetlist(r2.dates,_slHistory.filter(function(h){return r2.dates.indexOf(h.date)>=0;}));
        }
      }
      });
    }

    function renderSetlist(dates,history){
      if(!history.length){
        document.getElementById('slContent').innerHTML='<div class="sl-empty">\u{1F4ED} \u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e25\u0e34\u0e2a\u0e40\u0e1e\u0e25\u0e07\u0e43\u0e19\u0e0a\u0e48\u0e27\u0e07\u0e19\u0e35\u0e49<br><span style="font-size:var(--text-xs);color:var(--premium-text-muted)">\u0e25\u0e34\u0e2a\u0e40\u0e1e\u0e25\u0e07\u0e08\u0e30\u0e16\u0e39\u0e01\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e08\u0e1a\u0e40\u0e1a\u0e23\u0e04\u0e43\u0e19 Live Mode</span></div>';
        document.getElementById('slStatCards').style.display='none';return;
      }
      var byDate={};history.forEach(function(h){if(!byDate[h.date])byDate[h.date]=[];byDate[h.date].push(h);});
      var sortedDates=Object.keys(byDate).sort().reverse();
      var totalSongs=0,totalBreaks=0,totalDurSec=0,songsPerBreak=[];
      var html='';
      sortedDates.forEach(function(dt){
        var breaks=byDate[dt];
        breaks.sort(function(a,b){return(a.timeSlot||'').localeCompare(b.timeSlot||'');});
        var dtObj=new Date(dt+'T00:00:00');
        var dayLabel=DN[dtObj.getDay()]+' '+p2(dtObj.getDate())+'/'+p2(dtObj.getMonth()+1)+'/'+(dtObj.getFullYear()+543);
        var daySongs=0;breaks.forEach(function(b){daySongs+=(b.songs||[]).length;});
        totalSongs+=daySongs;totalBreaks+=breaks.length;
        songsPerBreak=songsPerBreak.concat(breaks.map(function(b){return(b.songs||[]).length;}));
        var dayBadgeClass=daySongs>=breaks.length*10?'ok':'warn';
        html+='<div class="sl-day"><div class="sl-day-header" onclick="var b=this.nextElementSibling;b.style.display=b.style.display===\'none\'?\'\':\' none\'"><div><div class="sl-day-title">\u{1F4C5} '+dayLabel+'</div></div><span class="sl-day-badge '+dayBadgeClass+'">'+daySongs+' \u0e40\u0e1e\u0e25\u0e07 \u00b7 '+breaks.length+' \u0e40\u0e1a\u0e23\u0e04</span></div><div class="sl-day-body">';
        breaks.forEach(function(brk){
          var songs=brk.songs||[],brkDurSec=0,brkId=bt(brk.id||dt+(brk.timeSlot||''));
          var actualSec = songs.length > 0 && songs[0]._actualBreakSec ? parseInt(songs[0]._actualBreakSec, 10) : 0;
          var warnBrk=songs.length<10;
          html+='<div class="sl-break"><div class="sl-break-header"><div><span class="sl-break-time">'+esc(brk.timeSlot||'\u2014')+'</span>'+
            (brk.venue?'<span style="margin-left:8px;font-size:var(--text-xs);color:var(--premium-text-muted)">\u{1F4CD} '+esc(brk.venue)+'</span>':'')+
            '</div><div class="sl-break-stats'+(warnBrk?' sl-break-warn':'')+'">'+songs.length+' \u0e40\u0e1e\u0e25\u0e07'+(warnBrk?' \u26A0\uFE0F &lt;10':'')+' </div></div><div class="sl-songs">';
          songs.forEach(function(s,i){
            var sec=getSongDurCached(s.name,s.artist);
            if (!actualSec) brkDurSec+=sec+GAP_SEC;
            html+='<div class="sl-song"><div class="sl-song-num">'+(i+1)+'</div>'+
              '<div class="sl-song-name">'+esc(s.name||'\u2014')+(s._isRequest?'<span class="sl-song-req">\u0e02\u0e2d'+(s._isRequestTime?' '+esc(s._isRequestTime):'')+'</span>':'')+'</div>'+
              '<div class="sl-song-artist">'+esc(s.artist||'')+'</div>'+
              '<div class="sl-song-dur'+(mbHasExact(s.name,s.artist)?'':' approx')+'" id="sldur_'+brkId+'_'+i+'">'+fmtDur(sec)+'</div></div>';
          });
          if (actualSec) brkDurSec = actualSec;
          totalDurSec+=brkDurSec;
          var brkDistH=breakDistHtml(songs);
          var isActual = actualSec > 0;
          var durLabel = isActual ? '\u0e40\u0e27\u0e25\u0e32\u0e40\u0e1a\u0e23\u0e04\u0e08\u0e23\u0e34\u0e07' : '\u0e40\u0e27\u0e25\u0e32\u0e40\u0e1a\u0e23\u0e04\u0e19\u0e35\u0e49 (\u0e23\u0e27\u0e21 gap)';
          html+='</div><div class="sl-break-total"><span>'+durLabel+'</span><span class="sl-time-badge'+(isActual?' actual':'')+'" id="slbt_'+brkId+'">'+ fmtDurLong(brkDurSec)+'</span></div>'+brkDistH+'</div>';
        });
        html+='</div></div>';
      });
      document.getElementById('slContent').innerHTML=html;
      var avgSPB=songsPerBreak.length?(songsPerBreak.reduce(function(a,b){return a+b;},0)/songsPerBreak.length).toFixed(1):'0';
      var avgBadge=parseFloat(avgSPB)>=10?'<span style="color:#276749">&#x2705;</span> ':'<span style="color:#d97706">&#x26A0;&#xFE0F;</span> ';
      document.getElementById('slStatCards').innerHTML=
        '<div class="sl-stat-card"><div class="sv">'+totalSongs+'</div><div class="sl">\u0e40\u0e1e\u0e25\u0e07\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14</div></div>'+
        '<div class="sl-stat-card"><div class="sv">'+totalBreaks+'</div><div class="sl">\u0e08\u0e33\u0e19\u0e27\u0e19\u0e40\u0e1a\u0e23\u0e04</div></div>'+
        '<div class="sl-stat-card"><div class="sv">'+avgBadge+avgSPB+'</div><div class="sl">\u0e40\u0e1e\u0e25\u0e07\u0e40\u0e09\u0e25\u0e35\u0e48\u0e22/\u0e40\u0e1a\u0e23\u0e04</div></div>'+
        '<div class="sl-stat-card"><div class="sv" style="font-size:1rem">'+fmtDurLong(totalDurSec)+'</div><div class="sl">\u0e40\u0e27\u0e25\u0e32\u0e40\u0e25\u0e48\u0e19\u0e23\u0e27\u0e21 (\u0e1b\u0e23\u0e30\u0e21\u0e32\u0e13)</div></div>';
      document.getElementById('slStatCards').style.display='';
      renderDistribution(history);
      var toFetch=[];
      history.forEach(function(brk){
        var brkId=bt(brk.id||brk.date+(brk.timeSlot||''));
        (brk.songs||[]).forEach(function(s,i){if(!mbHasExact(s.name,s.artist))toFetch.push({name:s.name,artist:s.artist,brkId:brkId,idx:i});});
      });
      if(toFetch.length)fetchMbBatch(toFetch,history);
    }

    function bt(s){return(s||'').replace(/[^a-zA-Z0-9]/g,'_').substring(0,28);}
    function fmtDur(sec){var m=Math.floor(sec/60),s=sec%60;return m+':'+p2(s);}
    function fmtDurLong(sec){
      if(sec<=0)return'\u2014';
      var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
      if(h>0)return h+' \u0e0a\u0e21. '+m+' \u0e19\u0e32\u0e17\u0e35';
      if(m>0)return m+' \u0e19\u0e32\u0e17\u0e35 '+s+' \u0e27\u0e34\u0e19\u0e32\u0e17\u0e35';
      return s+' \u0e27\u0e34\u0e19\u0e32\u0e17\u0e35';
    }

    var _mbCache={},_mbExact={},_mbQueue=[],_mbRunning=false,MB_FALLBACK=240,GAP_SEC=20;
    function mbKey(n,a){return((n||'')+'|||'+(a||'')).toLowerCase();}
    function mbHasExact(n,a){return!!_mbExact[mbKey(n,a)];}
    function getSongDurCached(n,a){
      var k=mbKey(n,a);if(_mbCache[k]!==undefined)return _mbCache[k];
      try{var lv=localStorage.getItem('mb_dur_'+k.substring(0,60));if(lv!==null){var pl=JSON.parse(lv);_mbCache[k]=pl.sec;if(pl.exact)_mbExact[k]=true;return pl.sec;}}catch(e){}
      try{var sv=sessionStorage.getItem('mb_dur_'+k.substring(0,60));if(sv!==null){var p=JSON.parse(sv);_mbCache[k]=p.sec;if(p.exact)_mbExact[k]=true;return p.sec;}}catch(e){}
      return MB_FALLBACK;
    }
    function fetchMbBatch(infos,history){
      var seen={};
      infos.forEach(function(s){var k=mbKey(s.name,s.artist);if(!seen[k]&&!_mbExact[k]){seen[k]=true;_mbQueue.push(s);}});
      if(!_mbRunning)processMbQueue(history);
    }
    function processMbQueue(history){
      if(!_mbQueue.length){_mbRunning=false;return;}
      _mbRunning=true;
      var item=_mbQueue.shift();
      fetchDuration(item.name,item.artist,function(sec,exact){
        var k=mbKey(item.name,item.artist);_mbCache[k]=sec;if(exact)_mbExact[k]=true;
        try{localStorage.setItem('mb_dur_'+k.substring(0,60),JSON.stringify({sec:sec,exact:exact}));}catch(e){}
        updateDurInDom(history);
        setTimeout(function(){processMbQueue(history);},1500);
      });
    }
    function fetchDuration(name,artist,cb){
      var term=encodeURIComponent((name||'')+(artist?' '+artist:''));
      fetch('https://itunes.apple.com/search?term='+term+'&media=music&entity=song&limit=5&country=TH')
        .then(function(r){return r.json();})
        .then(function(data){
          var results=(data&&data.results)||[];
          var nm=(name||'').toLowerCase();
          var match=results.find(function(r){
            return r.trackTimeMillis>0&&r.trackName&&r.trackName.toLowerCase().indexOf(nm.substring(0,Math.min(nm.length,5)))>=0;
          })||results.find(function(r){return r.trackTimeMillis>0;});
          if(match&&match.trackTimeMillis>0){cb(Math.round(match.trackTimeMillis/1000),true);}
          else{fetchMb(name,artist,cb);}
        })
        .catch(function(){fetchMb(name,artist,cb);});
    }
    function fetchMb(name,artist,cb){
      var q='recording:'+encodeURIComponent('"'+(name||'')+'"');
      if(artist)q+='+AND+artist:'+encodeURIComponent('"'+artist+'"');
      fetch('https://musicbrainz.org/ws/2/recording/?query='+q+'&fmt=json&limit=1',{
        headers:{'User-Agent':'BandThai/1.0','Accept':'application/json'}
      }).then(function(r){return r.json();})
        .then(function(data){var r=data&&data.recordings;if(r&&r.length&&r[0].length>0){cb(Math.round(r[0].length/1000),true);}else cb(MB_FALLBACK,false);})
        .catch(function(){cb(MB_FALLBACK,false);});
    }
    function updateDurInDom(history){
      history.forEach(function(brk){
        var brkId=bt(brk.id||brk.date+(brk.timeSlot||'')),brkSec=0;
        var actualSec = brk.songs && brk.songs.length > 0 && brk.songs[0]._actualBreakSec ? parseInt(brk.songs[0]._actualBreakSec, 10) : 0;
        (brk.songs||[]).forEach(function(s,i){
          var sec=getSongDurCached(s.name,s.artist);
          if(!actualSec) brkSec+=sec+GAP_SEC;
          var el=document.getElementById('sldur_'+brkId+'_'+i);
          if(el){el.textContent=fmtDur(sec);el.className='sl-song-dur'+(mbHasExact(s.name,s.artist)?'':' approx');}
        });
        if(actualSec) brkSec = actualSec;
        var te=document.getElementById('slbt_'+brkId);if(te)te.textContent=fmtDurLong(brkSec);
      });
    }

    window.printReport=function(){
      var tab=activeTab==='work'?'\u{1F454} \u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e01\u0e32\u0e23\u0e17\u0e33\u0e07\u0e32\u0e19':'\u{1F3B5} \u0e23\u0e32\u0e22\u0e07\u0e32\u0e19\u0e25\u0e34\u0e2a\u0e40\u0e1e\u0e25\u0e07';
      var period=activeTab==='work'?document.getElementById('wPeriodLabel').textContent:
        (slPeriod==='day'?_slDateInput:document.getElementById('slPeriodLabel').textContent);
      document.getElementById('printSubtitle').textContent=tab+' \u00b7 '+period+' \u00b7 \u0e1e\u0e34\u0e21\u0e1e\u0e4c\u0e40\u0e21\u0e37\u0e48\u0e2d '+new Date().toLocaleDateString('th-TH');
      window.print();
    };
  })();