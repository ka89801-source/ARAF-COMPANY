/* ============================================================
   أعراف للأعمال — منطق بوابة المنشآت
   ============================================================ */
function $(id){return document.getElementById(id)}
function toast(m){var t=$('T');t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2400)}
function esc(s){var d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML}

/* ---------- حراسة الجلسة ---------- */
var SESSION=null,ACC=null,PLAN=null;
(function guard(){
  try{SESSION=JSON.parse(localStorage.getItem('araf_biz_session')||'null')}catch(e){}
  if(SESSION&&SESSION.code){
    ACC=(window.ARAF_BIZ_ACCOUNTS||[]).find(function(a){return a.code===SESSION.code})||null;
  }
  if(!ACC){
    localStorage.removeItem('araf_biz_session');
    window.location.replace('login.html');
    return;
  }
  PLAN=window.ARAF_PLANS[ACC.plan];
})();
if(!ACC)throw new Error('no-session');

/* ---------- أدوات مساعدة ---------- */
function greetByTime(){
  var h=new Date().getHours();
  if(h<12)return'صباح الخير';
  if(h<17)return'مساؤكم عمل موفق';
  return'مساء الخير';
}
function entityFull(){return ACC.type+' '+ACC.name.replace(new RegExp('^'+ACC.type+'\\s+'),'')}
function entityShort(){return ACC.name}
function quotaLeft(k){
  var q=PLAN.quotas[k];if(!q)return 0;
  if(q.limit<0)return -1;
  return Math.max(0,q.limit-(ACC.used[k]||0));
}
function cycleDates(){
  var s=new Date(ACC.start+'T00:00:00'),now=new Date();
  var st=new Date(now.getFullYear(),now.getMonth(),s.getDate());
  if(st>now)st.setMonth(st.getMonth()-1);
  var en=new Date(st);en.setMonth(en.getMonth()+1);
  var f=function(d){return d.toLocaleDateString('ar-SA',{day:'numeric',month:'long'})};
  return{from:f(st),to:f(en),daysLeft:Math.max(0,Math.ceil((en-now)/86400000))};
}

/* ---------- شاشة الترحيب ---------- */
(function splash(){
  var fresh=sessionStorage.getItem('araf_biz_fresh_login')==='1';
  sessionStorage.removeItem('araf_biz_fresh_login');
  var sp=$('SPL');
  $('spEntity').textContent=entityShort();
  $('spHello').textContent=fresh?'أهلاً بكم في بوابة الأعمال':greetByTime()+'، وأهلاً بعودتكم';
  $('spSub').textContent='فريق '+ACC.type+'كم القانوني في أعراف جاهز لخدمتكم';
  $('spPlan').textContent=PLAN.name;
  sp.classList.remove('gone','run');sp.classList.add('show');
  void sp.offsetWidth;sp.classList.add('run');
  var dur=fresh?4300:2600;
  setTimeout(function(){
    sp.classList.add('gone');
    setTimeout(function(){sp.classList.remove('show','run');sp.remove()},900);
  },dur);
})();

/* ---------- تعبئة هوية الكيان ---------- */
$('ecType').textContent=ACC.type+' مشتركة — '+ACC.code;
$('ecName').textContent=entityShort();
$('ecPlan').textContent=PLAN.name;
$('tpName').textContent=entityShort();
$('tpAv').textContent=entityShort().replace(/^(شركة|مؤسسة|جمعية)\s+/,'').charAt(0);

/* ---------- الخدمات ---------- */
var SVC=[
  {k:'consult',ic:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>',t:'استشارة قانونية',d:'جلسة هاتفية أو مرئية مع محامٍ مختص في موضوع منشأتكم'},
  {k:'contracts',ic:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',t:'صياغة أو مراجعة عقد',d:'عقود العمل، التوريد، الشراكات، الإيجار التجاري وغيرها'},
  {k:'letters',ic:'<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',t:'خطاب أو إنذار رسمي',d:'خطابات رسمية وإنذارات قانونية باسم منشأتكم'},
  {k:'memos',ic:'<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/>',t:'مذكرة قانونية',d:'مذكرات دفاع أو مطالبة معدة من محامين مختصين'},
  {k:'najiz',ic:'<path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>',t:'خدمات ناجز',d:'تنفيذ إجراءات منشأتكم في منصة ناجز وتوثيق الوكالات'},
  {k:'general',ic:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',t:'طلب قانوني آخر',d:'لوائح داخلية، تحصيل ديون، حوكمة، أو أي احتياج قانوني آخر',free:true}
];
function svcByKey(k){return SVC.find(function(s){return s.k===k})}

/* ---------- سجل الطلبات المحلي ---------- */
function reqKey(){return'araf_biz_requests_'+ACC.code}
function getReqs(){try{return JSON.parse(localStorage.getItem(reqKey())||'[]')}catch(e){return[]}}
function saveReq(r){var l=getReqs();l.unshift(r);localStorage.setItem(reqKey(),JSON.stringify(l.slice(0,60)));syncReqCount()}
function syncReqCount(){$('reqCount').textContent=getReqs().length}
syncReqCount();

/* ---------- ملخص الرصيد المصغر ---------- */
(function mini(){
  var tot=0,used=0;
  Object.keys(PLAN.quotas).forEach(function(k){
    var q=PLAN.quotas[k];
    if(q.limit>0){tot+=q.limit;used+=Math.min(q.limit,ACC.used[k]||0)}
  });
  $('miniPlan').textContent=PLAN.name;
  $('miniUsed').textContent=used;
  $('miniLeft').textContent=Math.max(0,tot-used);
  $('miniFill').style.width=(tot?Math.min(100,Math.round(used/tot*100)):0)+'%';
})();

/* ---------- التنقل ---------- */
var cP='home';
var PN={home:'لوحة المنشأة',services:'طلب خدمة قانونية',requests:'طلبات منشأتي',subscription:'باقة المنشأة'};
function isMobile(){return innerWidth<=720}
function cSB(){if(isMobile()){$('SB').classList.remove('open');$('MO').classList.remove('show')}}
function tSB(){if(isMobile()){$('SB').classList.toggle('open');$('MO').classList.toggle('show')}}
function nav(p){
  cSB();cP=p;
  document.querySelectorAll('.snb').forEach(function(x){x.classList.toggle('on',x.dataset.p===p)});
  $('BC').textContent=PN[p]||PN.home;
  rP();scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.snb').forEach(function(b){b.onclick=function(){nav(this.dataset.p)}});
$('MB').onclick=tSB;$('MO').onclick=cSB;if($('SBC'))$('SBC').onclick=cSB;
$('LOB').onclick=function(){
  localStorage.removeItem('araf_biz_session');
  window.location.href='login.html';
};

/* ---------- بناء الصفحات ---------- */
function rP(){
  if(cP==='home')$('PC').innerHTML=vHome();
  else if(cP==='services')$('PC').innerHTML=vServices();
  else if(cP==='requests')$('PC').innerHTML=vRequests();
  else if(cP==='subscription')$('PC').innerHTML=vPlan();
}

function quotaCard(k){
  var q=PLAN.quotas[k];if(!q)return'';
  if(q.limit===0)return'';
  var used=ACC.used[k]||0;
  if(q.limit<0){
    return'<div class="qcard fu"><div class="qt"><span class="ql">'+q.label+'</span><span class="qn inf">بلا حدود ∞</span></div><div class="qtrack"><div class="qfill" style="width:100%"></div></div><div class="qhint">استهلاك هذا الشهر: '+used+'</div></div>';
  }
  var left=Math.max(0,q.limit-used);
  var pct=Math.min(100,Math.round(used/q.limit*100));
  var cls=left===0?'out':(pct>=75?'warn':'');
  var hint=left===0?'استنفدت الحصة — يمكنكم طلب خدمات إضافية':('المتبقي: '+left+' من '+q.limit);
  return'<div class="qcard fu"><div class="qt"><span class="ql">'+q.label+'</span><span class="qn">'+used+'<small> / '+q.limit+'</small></span></div><div class="qtrack"><div class="qfill '+cls+'" style="width:'+pct+'%"></div></div><div class="qhint">'+hint+'</div></div>';
}

function svcCard(s,i){
  var left=s.free?-2:quotaLeft(s.k),tag;
  if(s.free)tag='<span class="svc-tag free">حسب الطلب</span>';
  else if(left<0)tag='<span class="svc-tag">بلا حدود</span>';
  else if(left===0)tag='<span class="svc-tag out">استُنفدت الحصة</span>';
  else tag='<span class="svc-tag">متبقٍ '+left+'</span>';
  return'<button class="svc-card fu" style="animation-delay:.'+(i%6)+'s" onclick="openReq(\''+s.k+'\')"><div class="svc-ic"><svg viewBox="0 0 24 24">'+s.ic+'</svg></div><h3>'+s.t+'</h3><p>'+s.d+'</p><div class="svc-meta">'+tag+'<span class="svc-go">اطلب الآن <span class="arr">←</span></span></div></button>';
}

function managerCard(){
  var m=ACC.manager;if(!m)return'';
  var initial=m.name.replace(/^أ\.\s*/,'').charAt(0);
  var waMsg='السلام عليكم '+m.name+'، معكم '+entityShort()+' (رمز '+ACC.code+') — لدينا استفسار.';
  var phone=m.phone||window.ARAF_BIZ_WHATSAPP||'';
  return'<div class="mgr-card fu" style="animation-delay:.05s">'
    +'<svg class="mgr-scale" viewBox="0 0 200 220" aria-hidden="true"><line x1="100" y1="18" x2="100" y2="178"/><line x1="34" y1="48" x2="166" y2="48"/><circle cx="100" cy="14" r="5"/><line x1="34" y1="48" x2="16" y2="102"/><line x1="34" y1="48" x2="52" y2="102"/><path d="M10 102 a24 14 0 0 0 48 0"/><line x1="166" y1="48" x2="148" y2="102"/><line x1="166" y1="48" x2="184" y2="102"/><path d="M142 102 a24 14 0 0 0 48 0"/><line x1="64" y1="192" x2="136" y2="192"/></svg>'
    +'<div class="mgr-av-wrap"><div class="mgr-av">'+esc(initial)+'</div><span class="mgr-dot" aria-hidden="true"></span></div>'
    +'<div class="mgr-body"><span class="mgr-eyebrow">الموكّل من أعراف لمنشأتكم</span><div class="mgr-name">'+esc(m.name)+'</div><div class="mgr-title">'+esc(m.title)+'</div><span class="mgr-hours"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>'+esc(m.hours||'خلال ساعات العمل')+'</span></div>'
    +'<div class="mgr-acts"><a class="mgr-btn wa" href="https://wa.me/'+phone+'?text='+encodeURIComponent(waMsg)+'" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>تواصل واتساب</a><a class="mgr-btn call" href="tel:+'+phone+'"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.35 1.79.68 2.64a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.44-1.25a2 2 0 0 1 2.11-.45c.85.33 1.74.56 2.64.68A2 2 0 0 1 22 16.92z"/></svg>اتصال</a></div>'
  +'</div>';
}

function vHome(){
  var c=cycleDates();
  var h='<div class="dw fu"><h1>'+greetByTime()+'، فريق <em>'+esc(entityShort())+'</em></h1><div class="dwsub">هذه لوحة منشأتكم في أعراف — رصيد <b>'+PLAN.name+'</b> يتجدد بعد <b>'+c.daysLeft+' يوماً</b>. كيف يمكن لفريقكم القانوني خدمتكم اليوم؟</div></div>';
  h+=managerCard();
  h+='<div class="sec-title fu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>رصيد الباقة هذا الشهر</div>';
  h+='<div class="qgrid">';
  Object.keys(PLAN.quotas).forEach(function(k){h+=quotaCard(k)});
  h+='</div>';
  h+='<div class="sec-title fu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>اطلبوا خدمة قانونية</div>';
  h+='<div class="svc-grid">';
  SVC.forEach(function(s,i){h+=svcCard(s,i)});
  h+='</div>';
  return h;
}

function vServices(){
  var h='<div class="dw fu"><h1>طلب خدمة <em>قانونية</em></h1><div class="dwsub">اختاروا الخدمة، واملؤوا التفاصيل، وسيتولى فريق '+esc(entityShort())+' القانوني في أعراف التنفيذ ضمن باقتكم.</div></div>';
  h+='<div class="svc-grid">';
  SVC.forEach(function(s,i){h+=svcCard(s,i)});
  h+='</div>';
  return h;
}

function vRequests(){
  var l=getReqs();
  var h='<div class="dw fu"><h1>طلبات <em>'+esc(entityShort())+'</em></h1><div class="dwsub">سجل الطلبات المرسلة من هذا الجهاز — يتواصل معكم فريق أعراف لتأكيد كل طلب وتنفيذه.</div></div>';
  if(!l.length){
    h+='<div class="req-empty fu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></svg><p>لم ترسلوا أي طلب بعد.<br>ابدؤوا بطلب أول خدمة قانونية لمنشأتكم.</p><button onclick="nav(\'services\')">طلب خدمة الآن</button></div>';
    return h;
  }
  l.forEach(function(r,i){
    var s=svcByKey(r.k)||SVC[SVC.length-1];
    h+='<div class="req-item fu" style="animation-delay:.'+(i%5)+'s"><div class="req-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">'+s.ic+'</svg></div><div class="req-body"><h4>'+esc(r.t)+'</h4><span>'+esc(r.subject)+' — '+new Date(r.ts).toLocaleDateString('ar-SA',{day:'numeric',month:'long',hour:'numeric',minute:'2-digit'})+'</span></div><span class="req-st">قيد المتابعة</span></div>';
  });
  return h;
}

function vPlan(){
  var c=cycleDates();
  var h=managerCard();
  h+='<div class="plan-hero fu"><div class="ph-plan">'+PLAN.name+'</div><div class="ph-tag">'+PLAN.tagline+'</div><div class="ph-row"><div class="ph-box"><span>الاشتراك الشهري</span><b>'+PLAN.price.toLocaleString('ar-SA')+' ر.س</b></div><div class="ph-box"><span>الدورة الحالية</span><b>'+c.from+' — '+c.to+'</b></div><div class="ph-box"><span>يتجدد الرصيد بعد</span><b>'+c.daysLeft+' يوماً</b></div><div class="ph-box"><span>رمز المنشأة</span><b style="letter-spacing:1px">'+ACC.code+'</b></div></div></div>';
  h+='<div class="sec-title fu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>رصيد الباقة</div><div class="qgrid">';
  Object.keys(PLAN.quotas).forEach(function(k){h+=quotaCard(k)});
  h+='</div>';
  h+='<div class="sec-title fu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>مزايا باقتكم</div><div class="perk-list fu">';
  PLAN.perks.forEach(function(p){h+='<div class="perk-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>'+p+'</div>'});
  h+='</div>';
  if(ACC.plan!=='diwan'){
    var next=ACC.plan==='sanad'?window.ARAF_PLANS.imad:window.ARAF_PLANS.diwan;
    h+='<div class="upg-note fu">منشأتكم في نمو؟ <b>'+next.name+'</b> تمنحكم '+next.tagline.toLowerCase()+' — تواصلوا مع مدير حسابكم للترقية من الشهر القادم.<br><button onclick="askUpgrade(\''+next.key+'\')">أرغب بالترقية إلى '+next.name+'</button></div>';
  }else{
    h+='<div class="upg-note fu"><b>أنتم في أعلى باقاتنا.</b> شكراً لثقتكم — فريقكم القانوني المخصص رهن إشارتكم في أي وقت.</div>';
  }
  return h;
}

/* ---------- طلب الخدمة ---------- */
var curSvc=null;
function openReq(k){
  var s=svcByKey(k);if(!s)return;
  if(!s.free&&quotaLeft(k)===0){
    toast('استنفدتم حصة هذه الخدمة — سيسرّنا خدمتكم بطلب إضافي، أرسلوا الطلب وسنوضح التفاصيل');
  }
  curSvc=s;
  $('mdlT').textContent=s.t;
  $('mdlB').innerHTML=
    '<div class="mfg"><label>عنوان الطلب</label><input id="rqSub" placeholder="مثال: مراجعة عقد توريد مع مورد جديد"></div>'+
    '<div class="mfg"><label>تفاصيل الطلب</label><textarea id="rqDet" rows="4" placeholder="اشرحوا الموضوع باختصار — وسيتواصل معكم الفريق لطلب أي مستندات"></textarea></div>'+
    '<div class="mfg"><label>الشخص المسؤول للتواصل</label><input id="rqName" placeholder="الاسم وطريقة التواصل المفضلة"></div>'+
    '<div class="mnote">يُرسل الطلب باسم <b>'+esc(entityShort())+'</b> (رمز '+ACC.code+') عبر واتساب فريق أعراف مباشرة، ويُخصم من رصيد باقتكم بعد تأكيد التنفيذ.</div>';
  $('mdlA').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>إرسال الطلب';
  $('mdlA').onclick=sendReq;
  $('MDL').classList.add('show');
  setTimeout(function(){var f=$('rqSub');if(f&&!isMobile())f.focus()},80);
}
function cM(){$('MDL').classList.remove('show')}
$('MDL').addEventListener('click',function(e){if(e.target===this)cM()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')cM()});
function sendReq(){
  var sub=$('rqSub').value.trim(),det=$('rqDet').value.trim(),who=$('rqName').value.trim();
  if(!sub){toast('يرجى كتابة عنوان الطلب');return}
  var msg='طلب خدمة — أعراف للأعمال\n'
    +'المنشأة: '+entityShort()+'\n'
    +'رمز المنشأة: '+ACC.code+'\n'
    +'الباقة: '+PLAN.name+'\n'
    +'الخدمة: '+curSvc.t+'\n'
    +'العنوان: '+sub+'\n'
    +(det?('التفاصيل: '+det+'\n'):'')
    +(who?('المسؤول: '+who):'');
  saveReq({k:curSvc.k,t:curSvc.t,subject:sub,ts:Date.now()});
  cM();
  toast('تم تجهيز طلبكم — جارٍ فتح واتساب فريق أعراف');
  var url='https://wa.me/'+(window.ARAF_BIZ_WHATSAPP||'')+'?text='+encodeURIComponent(msg);
  setTimeout(function(){open(url,'_blank')},600);
  if(cP==='requests')rP();
}
function askUpgrade(k){
  var p=window.ARAF_PLANS[k];
  var msg='طلب ترقية باقة — أعراف للأعمال\n'
    +'المنشأة: '+entityShort()+'\n'
    +'رمز المنشأة: '+ACC.code+'\n'
    +'الباقة الحالية: '+PLAN.name+'\n'
    +'الترقية المطلوبة: '+p.name;
  toast('جارٍ فتح واتساب لطلب الترقية');
  setTimeout(function(){open('https://wa.me/'+(window.ARAF_BIZ_WHATSAPP||'')+'?text='+encodeURIComponent(msg),'_blank')},500);
}

/* ---------- البداية ---------- */
rP();
