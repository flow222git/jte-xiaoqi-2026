// ═══════════════════════════════════════════
// Breeeeeathe~ 呼吸覺察 · 核心引擎
// ═══════════════════════════════════════════

var CLIENT_ID='1052529942242-jvr7ik3f7r987l5lq889nrfkjheoovg7.apps.googleusercontent.com';
var SEGMENT_SECONDS=15;
var HIST_KEY='jte_breathe_history';

// ── 呼吸法設定 ──
var MODES={
  natural:{label:'自然偵測',guided:false},
  resonance:{label:'諧振呼吸',guided:true,inhale:5.5,holdIn:0,exhale:5.5,holdOut:0,text:'跟著節奏，吸 5.5 秒、吐 5.5 秒'},
  box:{label:'箱式呼吸',guided:true,inhale:4,holdIn:4,exhale:4,holdOut:4,text:'吸 4 秒、屏 4 秒、吐 4 秒、屏 4 秒'},
  counting:{label:'數息法',guided:true,inhale:4,holdIn:0,exhale:6,holdOut:0,text:'吸 4 秒、吐 6 秒，吐氣比吸氣長'}
};

// ── 狀態 ──
var session={
  mode:'natural',
  active:false,
  startAt:0,
  currentSide:null,   // 'inhale' | 'exhale' | null(hold)
  phaseStart:0,
  events:[],          // BreathEvent[]
  // 暫存當前呼吸週期
  cur:{inhaleStartAt:0,inhaleEndAt:0,exhaleStartAt:0,exhaleEndAt:0},
  timerInt:null,
  audioCtx:null,
  currentOsc:null
};

// ═══════════════════════════════════════════
// 音效
// ═══════════════════════════════════════════
function initAudio(){
  if(!session.audioCtx){
    try{ session.audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){}
  }
  if(session.audioCtx&&session.audioCtx.state==='suspended') session.audioCtx.resume();
}

function playTone(freq){
  if(!session.audioCtx) return;
  stopTone();
  var ctx=session.audioCtx;
  var now=ctx.currentTime;
  var master=ctx.createGain();
  master.gain.setValueAtTime(0,now);
  master.gain.linearRampToValueAtTime(0.18,now+0.08);
  master.connect(ctx.destination);
  // 基頻 + 泛音（管風琴感）
  var harmonics=[1,2,3,4];
  var gains=[1,0.5,0.25,0.12];
  var oscs=[];
  harmonics.forEach(function(h,i){
    var osc=ctx.createOscillator();
    var g=ctx.createGain();
    osc.type='sine';
    osc.frequency.value=freq*h;
    g.gain.value=gains[i];
    osc.connect(g);g.connect(master);
    osc.start(now);
    oscs.push(osc);
  });
  session.currentOsc={oscs:oscs,master:master};
}

function stopTone(){
  if(session.currentOsc){
    var ctx=session.audioCtx;
    var now=ctx.currentTime;
    try{
      session.currentOsc.master.gain.linearRampToValueAtTime(0,now+0.12);
      var oscs=session.currentOsc.oscs;
      setTimeout(function(){oscs.forEach(function(o){try{o.stop()}catch(e){}})},150);
    }catch(e){}
    session.currentOsc=null;
  }
}

var FREQ_G=196.00; // G3
var FREQ_C=130.81; // C3

// ═══════════════════════════════════════════
// Session 控制
// ═══════════════════════════════════════════
function startSession(mode){
  session.mode=mode;
  session.active=true;
  session.startAt=Date.now();
  session.events=[];
  session.currentSide=null;
  session.cur={inhaleStartAt:0,inhaleEndAt:0,exhaleStartAt:0,exhaleEndAt:0};

  initAudio();

  var m=MODES[mode];
  document.getElementById('breath-mode-label').textContent=m.label;
  document.getElementById('breath-guide-text').textContent=m.guided?m.text:'';
  document.getElementById('breath-phase').textContent='開始';
  document.getElementById('breath-hint').textContent='';
  document.getElementById('breath-orb').className='breath-orb';

  document.getElementById('breath-screen').classList.add('active');

  // timer
  session.timerInt=setInterval(updateTimer,200);

  bindTouchZones();
}

function updateTimer(){
  var sec=Math.floor((Date.now()-session.startAt)/1000);
  var m=Math.floor(sec/60),s=sec%60;
  document.getElementById('breath-timer').textContent=m+':'+String(s).padStart(2,'0');
}

// ── 觸控綁定 ──
function bindTouchZones(){
  var zi=document.getElementById('zone-inhale');
  var ze=document.getElementById('zone-exhale');

  var startInhale=function(e){e.preventDefault();onInhaleStart();zi.classList.add('pressing');};
  var endInhale=function(e){e.preventDefault();onInhaleEnd();zi.classList.remove('pressing');};
  var startExhale=function(e){e.preventDefault();onExhaleStart();ze.classList.add('pressing');};
  var endExhale=function(e){e.preventDefault();onExhaleEnd();ze.classList.remove('pressing');};

  zi.ontouchstart=startInhale;zi.ontouchend=endInhale;zi.ontouchcancel=endInhale;
  zi.onmousedown=startInhale;zi.onmouseup=endInhale;zi.onmouseleave=function(e){if(session.currentSide==='inhale')endInhale(e);};

  ze.ontouchstart=startExhale;ze.ontouchend=endExhale;ze.ontouchcancel=endExhale;
  ze.onmousedown=startExhale;ze.onmouseup=endExhale;ze.onmouseleave=function(e){if(session.currentSide==='exhale')endExhale(e);};
}

// ═══════════════════════════════════════════
// 呼吸相位偵測（四相）
// ═══════════════════════════════════════════
function onInhaleStart(){
  var now=Date.now();
  // 新一輪吸氣開始 → 收尾上一輪
  if(session.cur.inhaleStartAt&&session.cur.exhaleEndAt){
    finalizeCycle(now);
  }
  session.currentSide='inhale';
  session.cur.inhaleStartAt=now;
  playTone(FREQ_G);
  setPhase('吸氣','inhaling');
}

function onInhaleEnd(){
  var now=Date.now();
  session.currentSide=null;
  session.cur.inhaleEndAt=now;
  stopTone();
  setPhase('屏息','');
}

function onExhaleStart(){
  var now=Date.now();
  session.currentSide='exhale';
  session.cur.exhaleStartAt=now;
  playTone(FREQ_C);
  setPhase('吐氣','exhaling');
}

function onExhaleEnd(){
  var now=Date.now();
  session.currentSide=null;
  session.cur.exhaleEndAt=now;
  stopTone();
  setPhase('屏息','');
}

function finalizeCycle(cycleEndAt){
  var c=session.cur;
  if(!c.inhaleStartAt||!c.inhaleEndAt||!c.exhaleStartAt||!c.exhaleEndAt){
    // 不完整，重置
    session.cur={inhaleStartAt:cycleEndAt,inhaleEndAt:0,exhaleStartAt:0,exhaleEndAt:0};
    return;
  }
  var inhaleDuration=(c.inhaleEndAt-c.inhaleStartAt)/1000;
  var holdAfterInhaleDuration=(c.exhaleStartAt-c.inhaleEndAt)/1000;
  var exhaleDuration=(c.exhaleEndAt-c.exhaleStartAt)/1000;
  var holdAfterExhaleDuration=(cycleEndAt-c.exhaleEndAt)/1000;
  var holdDuration=holdAfterInhaleDuration+holdAfterExhaleDuration;
  var cycleDuration=inhaleDuration+holdAfterInhaleDuration+exhaleDuration+holdAfterExhaleDuration;

  var ev={
    inhaleStartAt:c.inhaleStartAt,inhaleEndAt:c.inhaleEndAt,
    exhaleStartAt:c.exhaleStartAt,exhaleEndAt:c.exhaleEndAt,cycleEndAt:cycleEndAt,
    inhaleDuration:inhaleDuration,holdAfterInhaleDuration:holdAfterInhaleDuration,
    exhaleDuration:exhaleDuration,holdAfterExhaleDuration:holdAfterExhaleDuration,
    holdDuration:holdDuration,cycleDuration:cycleDuration,
    relStart:(c.inhaleStartAt-session.startAt)/1000,
    isValid:(inhaleDuration>=0.4&&exhaleDuration>=0.4)
  };
  session.events.push(ev);

  // 新週期起點
  session.cur={inhaleStartAt:cycleEndAt,inhaleEndAt:0,exhaleStartAt:0,exhaleEndAt:0};
}

function setPhase(text,orbClass){
  document.getElementById('breath-phase').textContent=text;
  document.getElementById('breath-orb').className='breath-orb'+(orbClass?' '+orbClass:'');
  // 指定呼吸法提示
  if(MODES[session.mode].guided&&session.currentSide){
    showGuidedHint();
  } else {
    document.getElementById('breath-hint').textContent='';
  }
}

function showGuidedHint(){
  var m=MODES[session.mode];
  var target=session.currentSide==='inhale'?m.inhale:m.exhale;
  var hint=document.getElementById('breath-hint');
  var checkInt=setInterval(function(){
    if(session.currentSide===null){clearInterval(checkInt);hint.textContent='';return;}
    var elapsed=(Date.now()-getPhaseStart())/1000;
    if(elapsed<target-1) hint.textContent='保持… '+Math.ceil(target-elapsed)+' 秒';
    else if(elapsed<=target+0.8) hint.textContent='✓ 剛好';
    else hint.textContent='可以換邊了';
  },200);
}
function getPhaseStart(){
  if(session.currentSide==='inhale') return session.cur.inhaleStartAt;
  if(session.currentSide==='exhale') return session.cur.exhaleStartAt;
  return Date.now();
}

// ═══════════════════════════════════════════
// 結束 → 分析
// ═══════════════════════════════════════════
function endSession(){
  session.active=false;
  clearInterval(session.timerInt);
  stopTone();

  // 收尾最後一輪
  if(session.cur.inhaleStartAt&&session.cur.exhaleEndAt){
    finalizeCycle(Date.now());
  }

  document.getElementById('breath-screen').classList.remove('active');

  var analysis=analyze(session.events,(Date.now()-session.startAt)/1000);
  renderReport(analysis);
  showPage('report');
}

// ═══════════════════════════════════════════
// 分析引擎
// ═══════════════════════════════════════════
function avg(arr){return arr.length?arr.reduce(function(a,b){return a+b},0)/arr.length:0;}
function std(arr){if(arr.length<2)return 0;var m=avg(arr);return Math.sqrt(avg(arr.map(function(x){return (x-m)*(x-m)})));}
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}

function analyze(events,totalSec){
  var valid=events.filter(function(e){return e.isValid;});

  var inhales=valid.map(function(e){return e.inhaleDuration;});
  var exhales=valid.map(function(e){return e.exhaleDuration;});
  var holds=valid.map(function(e){return e.holdAfterInhaleDuration+e.holdAfterExhaleDuration;});
  var cycles=valid.map(function(e){return e.cycleDuration;});

  var avgInhale=avg(inhales),avgExhale=avg(exhales),avgHold=avg(holds),avgCycle=avg(cycles);
  var breathRate=avgCycle>0?60/avgCycle:0;
  var holdFraction=avgCycle>0?avgHold/avgCycle:0;
  var cv=avgCycle>0?std(cycles)/avgCycle:0;
  var stabilityScore=clamp(100-cv*100,0,100);
  var exhaleInhaleRatio=avgInhale>0?avgExhale/avgInhale:0;

  // 吸屏吐比例
  var ihe='—';
  if(avgInhale>0){
    ihe='1 : '+(avgHold/avgInhale).toFixed(2)+' : '+(avgExhale/avgInhale).toFixed(2);
  }

  // Segment 時間序列
  var segments=buildSegments(valid,totalSec);

  // 模式判讀
  var hasDiscomfort=false; // 不適在報告頁勾選後才有，分析時先 false
  var pattern=judgePattern({breathRate,avgInhale,avgExhale,stabilityScore,exhaleInhaleRatio,hasDiscomfort});

  // 轉變判讀
  var transition=judgeTransition(segments,valid,inhales,exhales);

  return {
    validCount:valid.length,totalCount:events.length,totalSec:totalSec,
    avgInhale,avgExhale,avgHold,avgCycle,breathRate,holdFraction,
    stabilityScore,exhaleInhaleRatio,ihe,segments,pattern,transition
  };
}

function buildSegments(valid,totalSec){
  var segs=[];
  var nSeg=Math.max(1,Math.ceil(totalSec/SEGMENT_SECONDS));
  for(var i=0;i<nSeg;i++){
    var lo=i*SEGMENT_SECONDS,hi=(i+1)*SEGMENT_SECONDS;
    var inSeg=valid.filter(function(e){return e.relStart>=lo&&e.relStart<hi;});
    if(!inSeg.length){continue;}
    var cyc=inSeg.map(function(e){return e.cycleDuration;});
    var inh=inSeg.map(function(e){return e.inhaleDuration;});
    var exh=inSeg.map(function(e){return e.exhaleDuration;});
    var hld=inSeg.map(function(e){return e.holdAfterInhaleDuration+e.holdAfterExhaleDuration;});
    var ac=avg(cyc);
    var cvSeg=ac>0?std(cyc)/ac:0;
    segs.push({
      idx:i,breathCount:inSeg.length,
      breathRate:ac>0?60/ac:0,
      avgInhale:avg(inh),avgHold:avg(hld),avgExhale:avg(exh),
      stabilityScore:clamp(100-cvSeg*100,0,100)
    });
  }
  return segs;
}

function judgePattern(m){
  if(m.hasDiscomfort||m.breathRate<5)
    return {key:'overcontrol',label:'過度控制型',text:'你可能正在過度控制呼吸。請先停止練習，回到自然呼吸。',tone:'warn'};
  if(m.breathRate>18&&m.avgInhale<1.5&&m.avgExhale<2&&m.stabilityScore<70)
    return {key:'shallow',label:'疑似淺快節奏',text:'呼吸呈現短而快的時序型態，建議先放慢吐氣。',tone:'warn'};
  if(m.breathRate>16)
    return {key:'fast',label:'偏急促型',text:'呼吸偏快，可能處於較高警覺或緊繃狀態。',tone:'warn'};
  if(m.exhaleInhaleRatio<1.05&&m.breathRate>12)
    return {key:'shortexhale',label:'吐氣偏短型',text:'吐氣時間偏短，建議讓吐氣比吸氣多 1 到 2 秒。',tone:''};
  if(m.avgInhale>m.avgExhale*1.2)
    return {key:'inhaledom',label:'吸氣主導型',text:'吸氣相對較長，建議不要刻意吸太滿，把重點放在自然吐氣。',tone:''};
  if(m.stabilityScore<60)
    return {key:'unstable',label:'節奏不穩型',text:'呼吸節奏忽快忽慢，建議先建立固定節奏。',tone:''};
  if(m.breathRate>=5&&m.breathRate<=7&&m.stabilityScore>=75)
    return {key:'resonance',label:'慢速共振型',text:'呼吸接近慢速穩定區間，可作為共振呼吸入門。',tone:'good'};
  if(m.breathRate>=8&&m.breathRate<=12&&m.stabilityScore>=70)
    return {key:'stable',label:'穩定自然型',text:'呼吸節奏相對穩定，可進一步練習吐氣延長。',tone:'good'};
  return {key:'observe',label:'自然觀察型',text:'目前呼吸沒有明顯單一特徵，建議持續觀察並建立個人基準。',tone:''};
}

function judgeTransition(segments,valid,inhales,exhales){
  if(segments.length<2||valid.length<4)
    return {key:'insufficient',text:'本次有效呼吸次數較少，暫不判斷呼吸狀態轉變。'};
  var first=segments[0],last=segments[segments.length-1];
  var rateDelta=last.breathRate-first.breathRate;
  var stabDelta=last.stabilityScore-first.stabilityScore;
  var inhaleCv=avg(inhales)>0?std(inhales)/avg(inhales):0;
  var exhaleCv=avg(exhales)>0?std(exhales)/avg(exhales):0;

  if(rateDelta<=-3) return {key:'slowing',text:'你一開始的呼吸較快，後段有逐漸放慢，代表練習中出現調節效果。',tone:'good'};
  if(rateDelta>=3) return {key:'speeding',text:'你的呼吸在後段變快，可能是用力、分心或身體不適的訊號。',tone:'warn'};
  if(stabDelta>=15) return {key:'stabilizing',text:'前段呼吸起伏較明顯，後段穩定度提升，代表節奏逐漸被身體接住。',tone:'good'};
  if(stabDelta<=-15) return {key:'destabilizing',text:'後段呼吸穩定度下降，可能代表練習時間過長、注意力轉移或節奏設定不太適合。',tone:'warn'};
  if(inhaleCv>0.3||exhaleCv>0.3) return {key:'varied',text:'你的吸氣或吐氣長短變化較大，呈現有時較深、有時較淺的時序型態。',tone:''};
  return {key:'consistent',text:'本次練習中呼吸頻率、吸吐時間與穩定度沒有明顯大幅轉變，整體節奏相對一致。',tone:''};
}

// app2.js 接續報告渲染、圖表、儲存、登入

// ═══════════════════════════════════════════
// 報告渲染
// ═══════════════════════════════════════════
var _lastAnalysis=null;
var _reportState={moodBefore:null,moodAfter:null,feelings:[],discomforts:[],note:''};

function renderReport(a){
  _lastAnalysis=a;
  _reportState={moodBefore:null,moodAfter:null,feelings:[],discomforts:[],note:''};

  var m=MODES[session.mode];
  var el=document.getElementById('report-content');

  var html='';

  // Hero
  html+='<div class="report-hero">'+
    '<div class="report-mode">'+m.label+' · '+Math.floor(a.totalSec/60)+'分'+Math.round(a.totalSec%60)+'秒</div>'+
    '<div class="report-mode-title">'+a.pattern.label+'</div>'+
    '<div class="report-mode-desc">'+a.pattern.text+'</div>'+
    '</div>';

  // 核心指標
  html+='<div class="metrics">'+
    metric(a.breathRate.toFixed(1),'次/分','呼吸頻率')+
    metric(Math.round(a.stabilityScore),'分','穩定度')+
    metric(a.avgInhale.toFixed(1),'秒','平均吸氣')+
    metric(a.avgExhale.toFixed(1),'秒','平均吐氣')+
    '</div>';

  // 屏息安全提示
  if(a.holdFraction>0.4){
    html+='<div class="insight warn" style="margin-bottom:14px"><i class="ti ti-alert-triangle"></i> 本次屏息占整個呼吸週期的比例較高（'+Math.round(a.holdFraction*100)+'%）。若有頭暈、胸悶、麻或呼吸困難，請停止練習並回到自然呼吸。</div>';
  }

  // 呼吸狀態轉變
  html+='<div class="card"><div class="card-title"><i class="ti ti-trending-up"></i>呼吸狀態轉變</div>'+
    '<div class="insight '+(a.transition.tone||'')+'">'+a.transition.text+'</div></div>';

  // 圖表（可展開）
  if(a.segments.length>=2){
    html+='<div class="card">'+
      '<div class="collapse-head" onclick="toggleCollapse(this)"><span class="ch-title">📊 練習過程趨勢</span><i class="ti ti-chevron-down collapse-chevron"></i></div>'+
      '<div class="collapse-body">'+
        '<div class="chart-wrap"><div style="font-size:10px;color:var(--t3);margin:10px 0 4px">呼吸頻率（次/分）</div>'+renderChartRate(a.segments)+'</div>'+
        '<div class="chart-wrap"><div style="font-size:10px;color:var(--t3);margin:14px 0 4px">吸氣 / 屏息 / 吐氣（秒）</div>'+renderChartIHE(a.segments)+'</div>'+
        '<div class="chart-wrap"><div style="font-size:10px;color:var(--t3);margin:14px 0 4px">穩定度</div>'+renderChartStability(a.segments)+'</div>'+
      '</div></div>';
  }

  // 詳細數據（可展開）
  html+='<div class="card">'+
    '<div class="collapse-head" onclick="toggleCollapse(this)"><span class="ch-title">🔍 詳細數據</span><i class="ti ti-chevron-down collapse-chevron"></i></div>'+
    '<div class="collapse-body"><div style="padding-top:12px">'+
      detailRow('有效呼吸次數',a.validCount+' / '+a.totalCount+' 次')+
      detailRow('平均週期',a.avgCycle.toFixed(1)+' 秒')+
      detailRow('平均屏息',a.avgHold.toFixed(1)+' 秒')+
      detailRow('吸:屏:吐 比例',a.ihe)+
      detailRow('屏息占比',Math.round(a.holdFraction*100)+'%')+
      detailRow('吐吸比',a.exhaleInhaleRatio.toFixed(2))+
    '</div></div></div>';

  // 主觀紀錄
  html+='<div class="card"><div class="card-title"><i class="ti ti-mood-smile"></i>練習後感受</div>'+
    '<div style="font-size:11px;color:var(--t3);margin-bottom:8px">這次練習帶來什麼變化？</div>'+
    '<div class="feeling-grid" id="feeling-grid">'+
      ['輕鬆很多','稍微放鬆','沒什麼變化','還是緊繃','有點疲倦','更清醒了','心跳變慢','頭腦清晰'].map(function(f){
        return '<div class="feeling-opt" onclick="toggleFeeling(this)">'+f+'</div>';
      }).join('')+
    '</div></div>';

  // 不適狀況
  html+='<div class="card"><div class="card-title"><i class="ti ti-alert-circle"></i>有沒有不適？</div>'+
    '<div class="feeling-grid">'+
      ['頭暈','胸悶','麻','呼吸困難','恐慌'].map(function(d){
        return '<div class="feeling-opt discomfort-opt" onclick="toggleDiscomfort(this)">'+d+'</div>';
      }).join('')+
    '</div></div>';

  // 備註
  html+='<div class="card"><div class="card-title"><i class="ti ti-note"></i>備註</div>'+
    '<textarea class="report-ta" id="report-note" rows="2" placeholder="想記下什麼嗎？"></textarea></div>';

  // 儲存
  html+='<button class="save-btn" onclick="trySaveSession()">儲存這次練習</button>';
  html+='<button class="ghost-btn" onclick="showPage(\'home\')">不儲存，回首頁</button>';

  el.innerHTML=html;
}

function metric(val,unit,lbl){
  return '<div class="metric"><div class="metric-val">'+val+' <span class="unit">'+unit+'</span></div><div class="metric-lbl">'+lbl+'</div></div>';
}
function detailRow(k,v){
  return '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="color:var(--t3)">'+k+'</span><span style="color:var(--p);font-weight:500">'+v+'</span></div>';
}

function toggleCollapse(head){
  var body=head.nextElementSibling;
  var chevron=head.querySelector('.collapse-chevron');
  body.classList.toggle('open');
  chevron.classList.toggle('open');
}

function toggleFeeling(el){
  el.classList.toggle('selected');
  var f=el.textContent.trim();
  var i=_reportState.feelings.indexOf(f);
  if(i>-1)_reportState.feelings.splice(i,1);else _reportState.feelings.push(f);
}
function toggleDiscomfort(el){
  el.classList.toggle('selected');
  var d=el.textContent.trim();
  var i=_reportState.discomforts.indexOf(d);
  if(i>-1)_reportState.discomforts.splice(i,1);else _reportState.discomforts.push(d);
}

// ═══════════════════════════════════════════
// SVG 圖表
// ═══════════════════════════════════════════
function chartBase(W,H){return {W:W,H:H,pad:{l:28,r:10,t:10,b:18}};}

function renderChartRate(segs){
  var W=300,H=120,pad={l:30,r:10,t:10,b:20};
  var vals=segs.map(function(s){return s.breathRate;});
  var maxV=Math.max(20,Math.ceil(Math.max.apply(null,vals)));
  return lineChart(segs,vals,maxV,'#003D7C',W,H,pad,'次/分');
}
function renderChartStability(segs){
  var W=300,H=120,pad={l:30,r:10,t:10,b:20};
  var vals=segs.map(function(s){return s.stabilityScore;});
  return lineChart(segs,vals,100,'#4CAF19',W,H,pad,'分');
}

function lineChart(segs,vals,maxV,color,W,H,pad,unit){
  var n=vals.length;
  var iw=W-pad.l-pad.r,ih=H-pad.t-pad.b;
  var x=function(i){return pad.l+(n<=1?iw/2:iw*i/(n-1));};
  var y=function(v){return pad.t+ih*(1-v/maxV);};

  var svg='<svg class="chart-svg" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">';
  // grid
  for(var g=0;g<=2;g++){
    var gy=pad.t+ih*g/2;
    svg+='<line x1="'+pad.l+'" y1="'+gy+'" x2="'+(W-pad.r)+'" y2="'+gy+'" stroke="#EEF3F9" stroke-width="1"/>';
    svg+='<text x="'+(pad.l-4)+'" y="'+(gy+3)+'" text-anchor="end" font-size="8" fill="#8A95A5">'+Math.round(maxV*(1-g/2))+'</text>';
  }
  // line
  var pts=vals.map(function(v,i){return x(i)+','+y(v);}).join(' ');
  svg+='<polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  // dots
  vals.forEach(function(v,i){
    svg+='<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3" fill="'+color+'"/>';
  });
  // x labels
  segs.forEach(function(s,i){
    svg+='<text x="'+x(i)+'" y="'+(H-4)+'" text-anchor="middle" font-size="8" fill="#8A95A5">'+(i*SEGMENT_SECONDS)+'s</text>';
  });
  svg+='</svg>';
  return svg;
}

function renderChartIHE(segs){
  var W=300,H=130,pad={l:30,r:10,t:10,b:20};
  var n=segs.length;
  var iw=W-pad.l-pad.r,ih=H-pad.t-pad.b;
  var maxV=Math.max(8,Math.ceil(Math.max.apply(null,segs.map(function(s){return Math.max(s.avgInhale,s.avgExhale,s.avgHold);}))));
  var x=function(i){return pad.l+(n<=1?iw/2:iw*i/(n-1));};
  var y=function(v){return pad.t+ih*(1-v/maxV);};

  var svg='<svg class="chart-svg" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">';
  for(var g=0;g<=2;g++){
    var gy=pad.t+ih*g/2;
    svg+='<line x1="'+pad.l+'" y1="'+gy+'" x2="'+(W-pad.r)+'" y2="'+gy+'" stroke="#EEF3F9" stroke-width="1"/>';
    svg+='<text x="'+(pad.l-4)+'" y="'+(gy+3)+'" text-anchor="end" font-size="8" fill="#8A95A5">'+Math.round(maxV*(1-g/2))+'</text>';
  }
  var series=[{k:'avgInhale',c:'#4CAF19'},{k:'avgHold',c:'#A8C9EE'},{k:'avgExhale',c:'#003D7C'}];
  series.forEach(function(ser){
    var pts=segs.map(function(s,i){return x(i)+','+y(s[ser.k]);}).join(' ');
    svg+='<polyline points="'+pts+'" fill="none" stroke="'+ser.c+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    segs.forEach(function(s,i){svg+='<circle cx="'+x(i)+'" cy="'+y(s[ser.k])+'" r="2.5" fill="'+ser.c+'"/>';});
  });
  segs.forEach(function(s,i){svg+='<text x="'+x(i)+'" y="'+(H-4)+'" text-anchor="middle" font-size="8" fill="#8A95A5">'+(i*SEGMENT_SECONDS)+'s</text>';});
  svg+='</svg>';
  svg+='<div class="chart-legend"><span class="chart-leg"><span class="dot" style="background:#4CAF19"></span>吸氣</span><span class="chart-leg"><span class="dot" style="background:#A8C9EE"></span>屏息</span><span class="chart-leg"><span class="dot" style="background:#003D7C"></span>吐氣</span></div>';
  return svg;
}

// ═══════════════════════════════════════════
// 儲存 + 登入 + Writeback
// ═══════════════════════════════════════════
var _db=null;
function initFirebase(){
  if(typeof firebase==='undefined'){setTimeout(initFirebase,200);return;}
  try{
    if(firebase.apps.length===0){
      firebase.initializeApp({
        apiKey:"AIzaSyBRZ1TNVMxOeJfyvGz4HhdlBzlKL0GIAfg",
        authDomain:"jointoenjoy.firebaseapp.com",
        projectId:"jointoenjoy",
        storageBucket:"jointoenjoy.firebasestorage.app",
        messagingSenderId:"978242729427",
        appId:"1:978242729427:web:ab31364f21c67c2ab56b26"
      });
    }
    _db=firebase.firestore();
  }catch(e){console.warn('Firebase init failed',e);}
}

// Google Login
var _googleReady=false;
function handleCredential(resp){
  var p=JSON.parse(atob(resp.credential.split('.')[1]));
  localStorage.setItem('jte_user_email',p.email);
  localStorage.setItem('jte_user_name',p.name||p.email);
  localStorage.setItem('jte_user_picture',p.picture||'');
  google.accounts.id.disableAutoSelect();
  renderNavUser();
  document.getElementById('login-modal').classList.remove('active');
  if(_pendingSave){_pendingSave();_pendingSave=null;}
}

function renderNavUser(){
  var el=document.getElementById('nav-user');
  var email=localStorage.getItem('jte_user_email');
  var pic=localStorage.getItem('jte_user_picture');
  if(email){
    el.innerHTML=pic?'<img src="'+pic+'" alt="">':'<span style="font-size:11px;color:var(--p)">'+email.split('@')[0]+'</span>';
  }else{
    el.innerHTML='';
  }
}

var _pendingSave=null;
function trySaveSession(){
  // 收集主觀資料
  _reportState.note=document.getElementById('report-note').value;

  if(localStorage.getItem('jte_user_email')){
    doSave();
  }else{
    _pendingSave=doSave;
    document.getElementById('login-modal').classList.add('active');
    setTimeout(function(){
      if(window.google&&google.accounts){
        var btn=document.getElementById('login-gsi-btn');
        if(btn&&!btn.hasChildNodes()){
          google.accounts.id.renderButton(btn,{theme:'filled_blue',size:'large',width:300,text:'signin_with',locale:'zh-TW'});
        }
      }
    },100);
  }
}

function skipLogin(){
  document.getElementById('login-modal').classList.remove('active');
  if(_pendingSave){_pendingSave();_pendingSave=null;}
}

function doSave(){
  var a=_lastAnalysis;
  var now=new Date();
  var record={
    id:'breathe-'+Date.now(),
    timestamp:now.toISOString(),
    mode:session.mode,
    modeLabel:MODES[session.mode].label,
    durationSec:Math.round(a.totalSec),
    breathRate:parseFloat(a.breathRate.toFixed(1)),
    avgInhale:parseFloat(a.avgInhale.toFixed(1)),
    avgExhale:parseFloat(a.avgExhale.toFixed(1)),
    avgHold:parseFloat(a.avgHold.toFixed(1)),
    stabilityScore:Math.round(a.stabilityScore),
    ihe:a.ihe,
    holdFraction:parseFloat(a.holdFraction.toFixed(2)),
    patternKey:a.pattern.key,
    patternLabel:a.pattern.label,
    transitionKey:a.transition.key,
    feelings:_reportState.feelings,
    discomforts:_reportState.discomforts,
    note:_reportState.note,
    validCount:a.validCount
  };

  // 1. 存歷史
  var hist=[];
  try{hist=JSON.parse(localStorage.getItem(HIST_KEY)||'[]');}catch(e){}
  hist.unshift(record);
  localStorage.setItem(HIST_KEY,JSON.stringify(hist.slice(0,100)));

  // 2. writeback 到主平台 Daily Check
  try{
    var email=localStorage.getItem('jte_user_email');
    var jteKey=email?'jte_daily_'+email.replace(/[^a-zA-Z0-9]/g,'_'):'jte_daily_v1';
    var todayKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    var all=JSON.parse(localStorage.getItem(jteKey)||'{}');
    var rec=all[todayKey]||{moods:[],energy:5,note:'',tags:[],linked:[],createdAt:new Date().toISOString()};
    if(!rec.linked)rec.linked=[];
    rec.linked.push({
      source:'BreatheAware',
      recordId:record.id,
      measureDate:todayKey,
      mode:session.mode,
      modeLabel:record.modeLabel,
      durationSec:record.durationSec,
      breathRate:record.breathRate,
      avgInhale:record.avgInhale,
      avgExhale:record.avgExhale,
      stabilityScore:record.stabilityScore,
      ihe:record.ihe,
      patternLabel:record.patternLabel,
      feelings:record.feelings,
      note:record.note
    });
    rec.updatedAt=new Date().toISOString();
    all[todayKey]=rec;
    localStorage.setItem(jteKey,JSON.stringify(all));

    // 3. Firestore 同步
    if(_db&&email){
      _db.collection('users').doc(email.toLowerCase()).collection('daily').doc(todayKey).set(rec,{merge:true})
        .catch(function(e){console.warn('Firestore sync failed',e);});
    }
  }catch(e){console.warn('writeback failed',e);}

  toast('已儲存並同步 ✓');
  setTimeout(function(){showPage('history');},1000);
}

// ═══════════════════════════════════════════
// 歷史頁
// ═══════════════════════════════════════════
function renderHistory(){
  var hist=[];
  try{hist=JSON.parse(localStorage.getItem(HIST_KEY)||'[]');}catch(e){}

  var listEl=document.getElementById('hist-list');
  var cmpEl=document.getElementById('hist-compare');

  if(!hist.length){
    listEl.innerHTML='<div style="text-align:center;padding:32px;color:var(--t3);font-size:12px">還沒有練習紀錄<br>從首頁開始你的第一次呼吸覺察吧</div>';
    cmpEl.innerHTML='';
    return;
  }

  // 最近 7 次比較
  var recent=hist.slice(0,7);
  var avgRate=avg(recent.map(function(r){return r.breathRate;}));
  var avgStab=avg(recent.map(function(r){return r.stabilityScore;}));
  cmpEl.innerHTML='<div class="card"><div class="card-title"><i class="ti ti-chart-bar"></i>最近 '+recent.length+' 次平均</div>'+
    '<div class="metrics" style="margin-bottom:0">'+
    metric(avgRate.toFixed(1),'次/分','平均頻率')+
    metric(Math.round(avgStab),'分','平均穩定度')+
    '</div></div>';

  // 歷史清單
  var html='';
  hist.forEach(function(r){
    var d=new Date(r.timestamp);
    var dateStr=(d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    html+='<div class="hist-item">'+
      '<div class="hist-top"><span class="hist-date">'+dateStr+' · '+r.modeLabel+'</span><span class="hist-tag">'+r.patternLabel+'</span></div>'+
      '<div class="hist-stats">'+
        '<div class="hist-stat"><strong>'+r.breathRate+'</strong> 次/分</div>'+
        '<div class="hist-stat"><strong>'+r.stabilityScore+'</strong> 穩定度</div>'+
        (r.feelings&&r.feelings.length?'<div class="hist-stat" style="color:var(--g)">'+r.feelings[0]+'</div>':'')+
      '</div></div>';
  });
  listEl.innerHTML=html;
}

// ═══════════════════════════════════════════
// 頁面切換
// ═══════════════════════════════════════════
function showPage(p){
  document.querySelectorAll('.page').forEach(function(el){el.classList.remove('active');});
  document.getElementById('page-'+p).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(function(t){t.classList.remove('active');});
  if(p==='home')document.querySelectorAll('.nav-tab')[0].classList.add('active');
  if(p==='history'){document.querySelectorAll('.nav-tab')[1].classList.add('active');renderHistory();}
  window.scrollTo(0,0);
}

function toast(msg){
  var t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},2200);
}

// ═══════════════════════════════════════════
// 初始化
// ═══════════════════════════════════════════
window.addEventListener('load',function(){
  initFirebase();
  renderNavUser();
  var t=setInterval(function(){
    if(window.google&&google.accounts){
      clearInterval(t);
      _googleReady=true;
      google.accounts.id.initialize({client_id:CLIENT_ID,callback:handleCredential,auto_select:false});
      // 已登入不 prompt
    }
  },300);
});
