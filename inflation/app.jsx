(function(){
'use strict';

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }

function __ready(fn){ if(document.readyState!=='loading'){ fn(); } else { document.addEventListener('DOMContentLoaded', fn); } }
__ready(function(){
  // Tabs
  var tabs=$all('.tab'), panes=$all('.tabpane');
  function showTab(id){
    panes.forEach(function(p){ p.classList.toggle('hidden', p.id!==id); });
    tabs.forEach(function(b){ var on=b.getAttribute('data-tab')===id; b.classList.toggle('active', on); b.setAttribute('aria-selected', on?'true':'false'); });
  }
  tabs.forEach(function(b){ b.addEventListener('click', function(){ showTab(b.getAttribute('data-tab')); }); });
  showTab('tab-intro');

  var state={ money:10, goods:[] };
  var EX=[{name:'Bread',prod:2,weight:0.12},{name:'Smartphones',prod:20,weight:0.08},{name:'Electricity',prod:3,weight:0.07},{name:'Healthcare',prod:-1,weight:0.17},{name:'Education',prod:0.5,weight:0.10},{name:'Housing',prod:1,weight:0.30},{name:'Restaurants',prod:1.5,weight:0.16}];
  var moneyEl=$('#money'), moneyVal=$('#moneyVal'), goodsC=$('#goods'), tbody=$('#table tbody'), aggEl=$('#agg');

  function normalize(){
    var s=0,i; for(i=0;i<state.goods.length;i++){ s+=(+state.goods[i].weight||0); } if(!s)s=1;
    for(i=0;i<state.goods.length;i++){ state.goods[i].weight=+(state.goods[i].weight/s).toFixed(3); }
  }

  function makeRow(g,i){
    var d=document.createElement('div');
    d.className='good-row';
    d.innerHTML=''
      + '<div class="row" style="align-items:center;justify-content:space-between">'
      + '  <div class="row" style="align-items:center;gap:12px;flex-wrap:wrap">'
      + '    <input data-k="name" type="text" style="min-width:160px" value="'+g.name+'">'
      + '    <div style="min-width:180px"><label>Productivity ΔA (%)</label><input data-k="prod" type="range" min="-10" max="30" step="0.1" value="'+g.prod+'"><div class="small">Current: <span class="accent" data-k="prodVal">'+g.prod.toFixed(1)+'%</span></div></div>'
      + '    <div style="min-width:180px"><label>Weight</label><input data-k="weight" type="range" min="0" max="1" step="0.01" value="'+g.weight+'"><div class="small">Current: <span class="accent" data-k="weightVal">'+g.weight.toFixed(2)+'</span></div></div>'
      + '  </div>'
      + '  <div class="row"><button class="btn" data-act="up">▲</button><button class="btn" data-act="down">▼</button><button class="btn" data-act="del">Delete</button></div>'
      + '</div>';
    Array.prototype.forEach.call(d.querySelectorAll('input'), function(inp){
      inp.addEventListener('input', function(){
        var k=inp.getAttribute('data-k');
        if(k==='name') state.goods[i].name=inp.value;
        if(k==='prod'){ state.goods[i].prod=+inp.value; d.querySelector('[data-k="prodVal"]').textContent=(+inp.value).toFixed(1)+'%'; }
        if(k==='weight'){ state.goods[i].weight=+inp.value; d.querySelector('[data-k="weightVal"]').textContent=(+inp.value).toFixed(2); normalize(); render(); }
        recompute();
      });
    });
    Array.prototype.forEach.call(d.querySelectorAll('button'), function(b){
      b.addEventListener('click', function(){
        var a=b.getAttribute('data-act');
        if(a==='del'){ state.goods.splice(i,1); render(); recompute(); return; }
        if(a==='up'&&i>0){ var t=state.goods[i-1]; state.goods[i-1]=state.goods[i]; state.goods[i]=t; render(); recompute(); }
        if(a==='down'&&i<state.goods.length-1){ var t2=state.goods[i+1]; state.goods[i+1]=state.goods[i]; state.goods[i]=t2; render(); recompute(); }
      });
    });
    return d;
  }

  function render(){ goodsC.innerHTML=''; state.goods.forEach(function(g,i){ goodsC.appendChild(makeRow(g,i)); }); }

  function reset(){ state.goods=JSON.parse(JSON.stringify(EX)); normalize(); render(); recompute(); }
  $('#addGood').addEventListener('click', function(){ state.goods.push({name:'New good',prod:0,weight:0.1}); normalize(); render(); recompute(); });
  $('#resetGoods').addEventListener('click', reset); reset();
  moneyEl.addEventListener('input', function(){ state.money=+moneyEl.value; moneyVal.textContent=state.money.toFixed(1)+'%'; recompute(); });

  // ---------- SVG helpers ----------
  function empty(svg){ while(svg.firstChild) svg.removeChild(svg.firstChild); }
  function rect(svg,x,y,w,h,cls,fill){
    var r=document.createElementNS('http://www.w3.org/2000/svg','rect');
    r.setAttribute('x',x); r.setAttribute('y',y); r.setAttribute('width',w); r.setAttribute('height',h);
    if(cls) r.setAttribute('class',cls); if(fill) r.setAttribute('fill',fill);
    svg.appendChild(r); return r;
  }
  function text(svg,x,y,str,anc,cls){
    var t=document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',x); t.setAttribute('y',y); t.setAttribute('font-size','12'); t.setAttribute('fill','#c9d2e3');
    if(anc) t.setAttribute('text-anchor',anc); if(cls) t.setAttribute('class',cls);
    t.textContent=str; svg.appendChild(t); return t;
  }
  function line(svg,x1,y1,x2,y2,stroke,w){
    var l=document.createElementNS('http://www.w3.org/2000/svg','line');
    l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2);
    l.setAttribute('stroke',stroke||'#32435f'); l.setAttribute('stroke-width',w||1);
    svg.appendChild(l); return l;
  }
  function polyline(svg,points,stroke){
    var p=document.createElementNS('http://www.w3.org/2000/svg','polyline');
    p.setAttribute('fill','none'); p.setAttribute('stroke',stroke||'#ff7a00'); p.setAttribute('stroke-width','2');
    p.setAttribute('points', points.map(function(pt){return pt[0]+','+pt[1]}).join(' '));
    svg.appendChild(p); return p;
  }

  var tooltip = $('#tooltip');
  function showTip(x,y,html){
    tooltip.style.left=x+'px'; tooltip.style.top=y+'px'; tooltip.innerHTML=html; tooltip.style.opacity='1';
  }
  function hideTip(){ tooltip.style.opacity='0'; }

  // Number formatter for y-axis (compact notation)
  function compactMoney(n){
    n = +n;
    var a = Math.abs(n);
    if (a >= 1e12) return (n/1e12).toFixed(2)+'T';
    if (a >= 1e9)  return (n/1e9).toFixed(2)+'B';
    if (a >= 1e6)  return (n/1e6).toFixed(2)+'M';
    if (a >= 1e3)  return (n/1e3).toFixed(2)+'K';
    return (Math.round(n*100)/100).toString();
  }

  // Axis with ticks & gridlines; yLabelFmt optional
  function drawAxes(svg, W, H, pad, yMin, yMax, yTicks, xTicks, xLabeler, yLabelFmt){
    // Axes
    line(svg, pad, H-pad, W-pad, H-pad, '#c9d2e3',1); // X
    line(svg, pad, pad, pad, H-pad, '#c9d2e3',1);     // Y
    // Horizontal grid & y tick labels
    var i;
    for(i=0;i<=yTicks;i++){
      var y = H - pad - (H-2*pad)*(i/yTicks);
      line(svg, pad, y, W-pad, y, '#263042',1);
      var v = yMin + (yMax-yMin)*(i/yTicks);
      var lab = yLabelFmt ? yLabelFmt(v) : (Math.round(v*10)/10)+'';
      text(svg, pad-8, y+4, lab, 'end');
    }
    // X ticks (optional)
    if(xTicks && xTicks.length){
      for(i=0;i<xTicks.length;i++){
        var t=xTicks[i].t;
        var x = pad + (W-2*pad) * t;
        line(svg, x, H-pad, x, H-pad+4, '#c9d2e3',1);
        var lbl = xLabeler ? xLabeler(xTicks[i]) : String(xTicks[i].v);
        text(svg, x, H-pad+16, lbl, 'middle');
      }
    }
  }

  // ---------- Charts ----------
  function drawBars(rows, agg){
    var svg = $('#barsSvg'); empty(svg);
    var W=800,H=300, pad=48; // wider left pad for labels
    var min=0,max=0,i; for(i=0;i<rows.length;i++){ if(rows[i].net<min)min=rows[i].net; if(rows[i].net>max)max=rows[i].net; }
    if(agg<min)min=agg; if(agg>max)max=agg;
    if(min===max){ min-=1; max+=1; }
    drawAxes(svg,W,H,pad,min,max,5,[],null,function(v){ return (Math.round(v*10)/10)+'%'; });
    var labels = rows.map(function(r){return r.name}).concat(['Aggregate']);
    var values = rows.map(function(r){return r.net}).concat([agg]);
    var n=labels.length, bw=Math.max(14, (W-2*pad)/n - 8), gap=((W-2*pad)-n*bw)/(n-1>0?(n-1):1);
    var zero = H - pad - (0 - min) * (H-2*pad) / (max - min || 1);
    var x=pad, idx;
    for(idx=0;idx<labels.length;idx++){
      var v=values[idx];
      var y = H - pad - (v - min) * (H-2*pad) / (max - min || 1);
      var top = Math.min(y, zero);
      var h = Math.max(1, Math.abs(y-zero));
      var color = idx===labels.length-1 ? '#ff7a00' : '#5aa9ff';
      var r = rect(svg, x, top, bw, h, null, color);
      text(svg, x+bw/2, H-8, labels[idx], 'middle');
      (function(lbl,val){
        r.addEventListener('mousemove', function(ev){ showTip(ev.clientX+8, ev.clientY-10, lbl+': '+val.toFixed(2)+'%'); });
        r.addEventListener('mouseleave', hideTip);
      })(labels[idx], v);
      x += bw + gap;
    }
    line(svg, pad, zero, W-pad, zero, '#c9d2e3',1);
  }

  function drawCash(ratePct, years){
    var svg=$('#cashSvg'); empty(svg);
    var W=800,H=300,pad=64;
    var T=years, r=ratePct/100;
    var vals=[], t;
    for(t=0;t<=T;t++) vals.push(+(100*Math.pow(1+r,t)).toFixed(2));
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if(min===max){ min-=1; max+=1; }
    var xTicks=[]; for(t=0;t<=T;t+=(T>=20?5:1)){ xTicks.push({t:(T? t/T : 0), v:t}); }
    drawAxes(svg,W,H,pad,min,max,5,xTicks,function(it){ return 't'+it.v; }, function(v){ return '$'+compactMoney(v); });
    var pts=[];
    for(t=0;t<=T;t++){
      var x=pad + (W-2*pad)*(T? t/T : 0);
      var y=H-pad - (vals[t]-min)*(H-2*pad)/(max-min);
      pts.push([x,y]);
    }
    polyline(svg, pts, '#ff7a00');
    svg.addEventListener('mousemove', function(ev){
      var rectB=svg.getBoundingClientRect();
      var mx=ev.clientX-rectB.left, best=0, bestd=1e9;
      var i; for(i=0;i<pts.length;i++){ var dx=Math.abs(pts[i][0]-mx); if(dx<bestd){bestd=dx; best=i;} }
      $('#cashHover').textContent='$'+(Math.round(vals[best]*100)/100).toFixed(2)+' at t='+best;
    });
    svg.addEventListener('mouseleave', function(){ $('#cashHover').textContent='—'; });
    $('#cashVal').textContent='$'+(Math.round(vals[vals.length-1]*100)/100).toFixed(2);
  }

  function drawAff(pmt, rateSel, years, downPct){
    var svg=$('#affSvg'); empty(svg);
    var W=800,H=300,pad=64;
    function loanPV(p,apr,yrs){ var n=yrs*12, r=(apr/100)/12; return r<=0? p*n : p*(1-Math.pow(1+r,-n))/r; }
    function priceAtRate(r){ return loanPV(pmt,r,years)/(1-downPct/100); }
    var labels=[], rates=[], vals=[], r;
    for(r=1;r<=12.0001;r+=0.25){ rates.push(+r.toFixed(2)); vals.push(priceAtRate(r)); labels.push(r.toFixed(2)+'%'); }
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var xTicks=[], i;
    for(i=0;i<rates.length;i+=8){ xTicks.push({t:i/(rates.length-1), v:labels[i]}); }
    drawAxes(svg,W,H,pad,min,max,5,xTicks,function(it){ return it.v; }, function(v){ return '$'+compactMoney(v); });
    var pts=[]; for(i=0;i<vals.length;i++){ var x=pad+(W-2*pad)*(i/(vals.length-1)); var y=H-pad - (vals[i]-min)*(H-2*pad)/(max-min || 1); pts.push([x,y]); }
    polyline(svg, pts, '#5aa9ff');
    var selPrice=priceAtRate(rateSel);
    $('#affPriceVal').textContent='$'+Math.round(selPrice).toLocaleString();
    svg.addEventListener('mousemove', function(ev){
      var rectB=svg.getBoundingClientRect();
      var mx=ev.clientX-rectB.left, best=0, bestd=1e9;
      for(var i=0;i<pts.length;i++){ var dx=Math.abs(pts[i][0]-mx); if(dx<bestd){bestd=dx; best=i;} }
      $('#affHover').textContent=labels[best]+': $'+Math.round(vals[best]).toLocaleString();
    });
    svg.addEventListener('mouseleave', function(){ $('#affHover').textContent='—'; });
  }

  function recompute(){
    var M=+state.money;
    var rows=state.goods.map(function(g){ var net=M-(+g.prod); return {name:g.name, weight:+g.weight, M:M, A:+g.prod, net:net, idx:100*(1+net/100)}; });
    var wsum=rows.reduce(function(a,r){return a+r.weight;},0)||1;
    var agg=rows.reduce(function(a,r){return a+r.net*(r.weight/wsum);},0);
    aggEl.textContent=(Math.round(agg*100)/100).toFixed(2)+'%';
    tbody.innerHTML=rows.map(function(r){
      return '<tr><td>'+r.name+'</td><td>'+r.weight.toFixed(2)+'</td><td>'+r.M.toFixed(1)+'</td><td>'+r.A.toFixed(1)+'</td><td>'+r.net.toFixed(2)+'</td><td>'+r.idx.toFixed(2)+'</td></tr>';
    }).join('');
    drawBars(rows, agg);
    var tread=$('#treadmill'), tval=$('#treadVal'), cat=$('#tcat'), tip=$('#treadTip');
    tval.textContent=(Math.round(agg*100)/100).toFixed(2)+'%';
    var rate=Math.abs(agg); var beltDur=Math.max(0.6, Math.min(12, 8/(rate+0.5))); var catDur=Math.max(0.4, Math.min(2.2, 1.6/(rate+0.3)));
    tread.style.setProperty('--belt-duration', beltDur+'s'); cat.style.setProperty('--cat-duration', catDur+'s');
    if(agg<0) tread.classList.add('deflate'); else tread.classList.remove('deflate');
    tip.textContent='Aggregate: '+(Math.round(agg*100)/100).toFixed(2)+'%';
  }
  recompute();

  (function(){ var tread=$('#treadmill'), tip=$('#treadTip'); tread.addEventListener('mousemove', function(e){ var r=tread.getBoundingClientRect(); tip.style.left=(e.clientX-r.left+12)+'px'; tip.style.top=(e.clientY-r.top-12)+'px'; tip.style.opacity='1';}); tread.addEventListener('mouseleave', function(){ tip.style.opacity='0';}); })();

  // Bias $100
  var biasRate=$('#biasRate'), biasYears=$('#biasYears'), yearsVal=$('#yearsVal'), rateVal=$('#rateVal');
  function recCash(){ var r=+biasRate.value; var y=+biasYears.value; yearsVal.textContent=String(y); rateVal.textContent=r.toFixed(1)+'%'; drawCash(r,y); }
  biasRate && biasRate.addEventListener('input', recCash);
  biasYears && biasYears.addEventListener('input', recCash);
  recCash();

  // Affordability
  var affBudget=$('#affBudget'), affRate=$('#affRate'), affTerm=$('#affTerm'), affDown=$('#affDown');
  var affRateVal=$('#affRateVal'), affBudVal=$('#affBudVal'), affTermVal=$('#affTermVal'), affDownVal=$('#affDownVal');
  function fmt(x){ return '$'+x.toLocaleString(); }
  function recAff(){
    if(!affBudget) return;
    var p=+affBudget.value, r=+affRate.value, y=+affTerm.value, d=+affDown.value;
    affRateVal.textContent=r.toFixed(1)+'%'; affBudVal.textContent=fmt(Math.round(p)); affTermVal.textContent=String(y); affDownVal.textContent=Math.round(d)+'%';
    drawAff(p,r,y,d);
  }
  if(affBudget){ ['input','change'].forEach(function(ev){ affBudget.addEventListener(ev,recAff); affRate.addEventListener(ev,recAff); affTerm.addEventListener(ev,recAff); affDown.addEventListener(ev,recAff); }); recAff(); }
});
})();