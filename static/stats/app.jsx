/* Cross-Section vs Panel Estimation — JSX + UMD build
   This version *waits* for window.Recharts before destructuring, so slow/broken CDN
   won't throw "Recharts is not defined" at parse time. It renders a friendly message
   until Recharts is available.
*/

// ====================== Utilities (pure) ====================== //
const mulberry32 = (a) => () => { let t = (a += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const logistic = (z) => 1 / (1 + Math.exp(-z));
const clamp = (x,a,b) => Math.max(a, Math.min(b, x));
const rnorm = (rng, m=0, s=1) => { let u=0,v=0; while(u===0)u=rng(); while(v===0)v=rng(); const z=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); return m+s*z; };
const variance = (a) => { const n=a.length; if(n<=1) return 0; const m=a.reduce((x,y)=>x+y,0)/n; return a.reduce((s,v)=>s+(v-m)**2,0)/(n-1); };
const quantile = (a, q) => { if(!a.length) return NaN; const s=[...a].sort((x,y)=>x-y); const p=(s.length-1)*q; const lo=Math.floor(p), hi=Math.ceil(p); if(lo===hi) return s[lo]; return s[lo]*(hi-p)+s[hi]*(p-lo); };
const mean = (arr) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : NaN;
const toCSV = (rows, header) => {
  const esc = (s) => '\"' + String(s).replace(/\"/g,'\"\"') + '\"';
  const head = header.map(esc).join(",");
  const body = rows.map(r => header.map(h => esc(r[h])).join(",")).join("\n");
  return head + "\n" + body;
};
// ---- single shared helpers ----
const fmt = (x, d=3) => (Number.isNaN(x)||x===undefined||!isFinite(x)) ? "—" : Number(x).toFixed(d);
const ci  = (b, se) => [b - 1.96 * (se || NaN), b + 1.96 * (se || NaN)];

// ====================== Recharts readiness hook ====================== //
function useRechartsReady(timeoutMs=8000){
  const [R, setR] = React.useState(() => (typeof window!=='undefined' ? window.Recharts : null));
  const [error, setError] = React.useState(null);
  React.useEffect(()=>{
    if (R) return;
    let elapsed = 0;
    const step = 50;
    const id = setInterval(()=>{
      const r = (typeof window!=='undefined' ? window.Recharts : null);
      if (r) { setR(r); clearInterval(id); }
      else {
        elapsed += step;
        if (elapsed >= timeoutMs) { setError("Recharts failed to load. Check your network/CSP or vendor the UMD locally."); clearInterval(id); }
      }
    }, step);
    return ()=>clearInterval(id);
  },[R, timeoutMs]);
  return { R, error };
}

// ====================== Estimation helpers ====================== //
function wlsSimple(x, y, w) {
  const n=x.length; if(n<3) return { beta:NaN,se:NaN,n,alpha:NaN,fitted:[],resid:[] };
  const sw=w.reduce((a,b)=>a+b,0);
  const mx=x.reduce((s,v,i)=>s+w[i]*v,0)/sw, my=y.reduce((s,v,i)=>s+w[i]*v,0)/sw;
  let sxx=0,sxy=0; for(let i=0;i<n;i++){ const dx=x[i]-mx; sxx+=w[i]*dx*dx; sxy+=w[i]*dx*(y[i]-my); }
  if(sxx===0) return { beta:NaN,se:NaN,n,alpha:NaN,fitted:[],resid:[] };
  const beta=sxy/sxx; const alpha=my-beta*mx;
  const resid=new Array(n); let rss=0; for(let i=0;i<n;i++){ const r=y[i]-(alpha+beta*x[i]); resid[i]=r; rss+=w[i]*r*r; }
  const sigma2 = (()=>{ const dfEff = Math.max(1, n-2); return rss/dfEff; })();
  const se=Math.sqrt(sigma2/sxx);
  return { beta, se, n, alpha, resid, fitted:x.map(v=>alpha+beta*v) };
}
function olsSimple(x, y) {
  const n=x.length; if(n<3) return { beta:NaN,se:NaN,n,alpha:NaN,fitted:[],resid:[] };
  const mx=x.reduce((a,b)=>a+b,0)/n, my=y.reduce((a,b)=>a+b,0)/n; let sxx=0,sxy=0;
  for(let i=0;i<n;i++){ const dx=x[i]-mx; sxx+=dx*dx; sxy+=dx*(y[i]-my); }
  if(sxx===0) return { beta:NaN,se:NaN,n,alpha:NaN,fitted:[],resid:[] };
  const beta=sxy/sxx, alpha=my-beta*mx; let rss=0; const fitted=new Array(n),resid=new Array(n);
  for(let i=0;i<n;i++){ fitted[i]=alpha+beta*x[i]; resid[i]=y[i]-fitted[i]; rss+=resid[i]*resid[i]; }
  const sigma2=rss/(n-2); const se=Math.sqrt(sigma2/sxx); return { beta, se, n, alpha, fitted, resid };
}
function olsClusterSE(x, y, pid) {
  const n=x.length; if(n<3) return { seCluster:NaN };
  const fit=olsSimple(x,y); if(!isFinite(fit.beta)) return { seCluster:NaN };
  let sumx=0,sumxx=0; for(let i=0;i<n;i++){ sumx+=x[i]; sumxx+=x[i]*x[i]; }
  const XtX=[[n, sumx],[sumx,sumxx]]; const det=XtX[0][0]*XtX[1][1]-XtX[0][1]*XtX[1][0]; if(det===0) return { seCluster:NaN };
  const inv=[[XtX[1][1]/det, -XtX[0][1]/det],[-XtX[1][0]/det, XtX[0][0]/det]];
  const by=new Map(); for(let i=0;i<n;i++){ const id=pid[i]; if(!by.has(id)) by.set(id,{XTu:[0,0]}); const u=fit.resid[i]; const o=by.get(id).XTu; o[0]+=u; o[1]+=x[i]*u; }
  const meat=[[0,0],[0,0]]; by.forEach(({XTu})=>{ meat[0][0]+=XTu[0]*XTu[0]; meat[0][1]+=XTu[0]*XTu[1]; meat[1][0]+=XTu[1]*XTu[0]; meat[1][1]+=XTu[1]*XTu[1]; });
  const temp=[[inv[0][0]*meat[0][0]+inv[0][1]*meat[1][0], inv[0][0]*meat[0][1]+inv[0][1]*meat[1][1]],[inv[1][0]*meat[0][0]+inv[1][1]*meat[1][0], inv[1][0]*meat[0][1]+inv[1][1]*meat[1][1]]];
  const V=[[temp[0][0]*inv[0][0]+temp[0][1]*inv[1][0], temp[0][0]*inv[0][1]+temp[0][1]*inv[1][1]],[temp[1][0]*inv[0][0]+temp[1][1]*inv[1][0], temp[1][0]*inv[0][1]+temp[1][1]*inv[1][1]]];
  const seCluster=Math.sqrt(Math.max(0,V[1][1])); return { seCluster, alpha:fit.alpha, beta:fit.beta };
}
function feWithin(personIds, x, y) {
  const ids=Array.from(new Set(personIds)); const xw=[], yw=[];
  for(const id of ids){ const idx=[]; for(let i=0;i<personIds.length;i++) if(personIds[i]===id) idx.push(i);
    const mx=idx.reduce((s,j)=>s+x[j],0)/idx.length, my=idx.reduce((s,j)=>s+y[j],0)/idx.length; let varx=0; for(const j of idx) varx+=(x[j]-mx)**2; if(varx===0) continue;
    for(const j of idx){ xw.push(x[j]-mx); yw.push(y[j]-my); }
  }
  if(xw.length<3) return { beta:NaN,se:NaN,n:xw.length,alpha:NaN,fitted:[],resid:[] }; return olsSimple(xw,yw);
}
function huberIRLS(x, y, c=1.345, maxIter=30){
  const n=x.length; if(n<3) return { beta:NaN,se:NaN,n,alpha:NaN };
  let fit=olsSimple(x,y);
  const mad = (arr)=>{ const m=quantile(arr.map(v=>Math.abs(v-quantile(arr,0.5))),0.5); return m||1e-6; };
  for(let it=0; it<maxIter; it++){
    const s = 1.4826 * mad(fit.resid);
    const w = fit.resid.map(r=>{ const t=Math.abs(r/(s||1e-6)); return t>c? c/t : 1; });
    fit = wlsSimple(x,y,w);
    if(!isFinite(fit.beta)) break;
    if(Math.max(...fit.resid.map(v=>Math.abs(v))) < 1e-6) break;
  }
  return fit;
}
function bayesPosterior(x, y){
  const n=x.length; if(n<3) return { betaMean:NaN, betaSE:NaN, ci:[NaN,NaN], alphaMean:NaN };
  const v0a=100, v0b=10; const a0=2, b0=1;
  let sumx=0,sumxx=0,sumy=0,sumxy=0,sumyy=0; for(let i=0;i<n;i++){ const xi=x[i], yi=y[i]; sumx+=xi; sumxx+=xi*xi; sumy+=yi; sumxy+=xi*yi; sumyy+=yi*yi; }
  const V0Inv00=1/v0a, V0Inv11=1/v0b; const XtX00=n, XtX01=sumx, XtX11=sumxx;
  const VnInv00=V0Inv00+XtX00, VnInv01=0+XtX01, VnInv11=V0Inv11+XtX11; const det=VnInv00*VnInv11 - VnInv01*VnInv01;
  const Vn00= VnInv11/det, Vn01= -VnInv01/det, Vn11= VnInv00/det;
  const mna = Vn00*(0 + sumy) + Vn01*(0 + sumxy);
  const mnb = Vn01*(0 + sumy) + Vn11*(0 + sumxy);
  const an = a0 + n/2;
  const quad = (mna*(VnInv00*mna+VnInv01*mnb) + mnb*(VnInv01*mna+VnInv11*mnb));
  const bn = b0 + 0.5*(sumyy - quad);
  const scale = bn/(an-1);
  const varBeta = scale * Vn11; const seBeta = Math.sqrt(Math.max(0,varBeta));
  const ci = [mnb - 1.96*seBeta, mnb + 1.96*seBeta];
  return { betaMean:mnb, betaSE:seBeta, ci, alphaMean:mna, an, bn };
}
function erf(x){const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911; const s=x<0?-1:1; x=Math.abs(x); const t=1/(1+p*x); const y=1-(((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x)); return s*y;} 
const phi = (z)=> 0.5*(1+erf(z/Math.SQRT2));
function erfinv(x){ const a=0.147; const ln = Math.log(1-x*x); const s = (2/(Math.PI*a) + ln/2); const res = Math.sign(x)*Math.sqrt( Math.sqrt(s*s - ln/a) - s ); return res; }

function Slider({label,min,max,step,value,onChange}){
  return (<div><div className="flex items-center justify-between mb-1"><label className="text-sm text-neutral-300">{label}</label><span className="text-xs text-neutral-400">{min}–{max}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(parseFloat(e.target.value))} className="w-full accent-neutral-200"/></div>);
}
function ResultCard({title,value,ci:ciStr,details,foot,warn,large}){
  return (<div className={`bg-neutral-900/60 border rounded-2xl ${large? 'p-5':'p-4'} ${warn? 'border-red-800':'border-neutral-800'}`}><div className="text-sm text-neutral-400">{title}</div><div className={`${large? 'text-3xl':'text-2xl'} font-semibold mt-1`}>{value}</div>{ciStr&&<div className="text-xs text-neutral-400 mt-1">95% interval: {ciStr}</div>}{details&&<div className="text-xs text-neutral-400 mt-1">{details}</div>}{foot&&<div className="text-xs text-neutral-500 mt-2">{foot}</div>}</div>);
}
function PresetButton({onClick,label}){ return (<button onClick={onClick} className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm">{label}</button>); }

function App(){
  const { R, error } = useRechartsReady();
  const [tab,setTab] = React.useState("sim");
  const [vizTab,setVizTab] = React.useState('trajectories');
  const [analysisTab,setAnalysisTab] = React.useState('descriptives');

  const [scenario,setScenario] = React.useState({ id:"Custom", title:"Custom scenario", d:"Treatment (D)", y:"Outcome (Y)", desc:"Tweak controls to explore biases.", issues:["Selection","Trends/Shocks","Serial correlation","Measurement error"]});

  const [seed,setSeed] = React.useState(42); const [N,setN]=React.useState(600); const [T,setT]=React.useState(8);
  const [betaTrue,setBetaTrue]=React.useState(0.6); const [betaHet,setBetaHet]=React.useState(0.0);
  const [sigmaU,setSigmaU]=React.useState(1.2); const [sigmaE,setSigmaE]=React.useState(1.0); const [sigmaME,setSigmaME]=React.useState(0.3);
  const [pBase,setPBase]=React.useState(0.5); const [rhoSel,setRhoSel]=React.useState(1.0); const [switchRate,setSwitchRate]=React.useState(0.25);

  const [timeTrendOn,setTimeTrendOn]=React.useState(true); const [timeTrendSlope,setTimeTrendSlope]=React.useState(0.05);
  const [shockAllOn,setShockAllOn]=React.useState(false); const [shockAllWave,setShockAllWave]=React.useState(5); const [shockAllSize,setShockAllSize]=React.useState(0.8);
  const [shockTreatOn,setShockTreatOn]=React.useState(false); const [shockTreatWave,setShockTreatWave]=React.useState(6); const [shockTreatSize,setShockTreatSize]=React.useState(0.8);
  const [ar1On,setAr1On]=React.useState(false); const [rhoE,setRhoE]=React.useState(0.5);
  const [dynSelOn,setDynSelOn]=React.useState(false); const [gammaDY,setGammaDY]=React.useState(0.5);
  const [misclassOn,setMisclassOn]=React.useState(false); const [misclassP,setMisclassP]=React.useState(0.15);
  const [attritionOn,setAttritionOn]=React.useState(false); const [attrBase,setAttrBase]=React.useState(0.02); const [attrSlope,setAttrSlope]=React.useState(0.15);
  const [expOutcomeOn,setExpOutcomeOn]=React.useState(false); const [expScale,setExpScale]=React.useState(0.35);
  const [heteroOn,setHeteroOn]=React.useState(false); const [heteroDWeight,setHeteroDWeight]=React.useState(0.8); const [heteroUWeight,setHeteroUWeight]=React.useState(0.4);

  const rng = React.useMemo(()=>mulberry32(seed),[seed]);

  const sim = React.useMemo(()=>{
    const persons = Array.from({length:N},(_,i)=>i); const u = persons.map(()=>rnorm(rng,0,sigmaU));
    const alpha = Math.log(pBase/(1-pBase)); const uSD = sigmaU<=0?1:sigmaU; const rows=[];
    for(let i=0;i<N;i++){
      const p_i=clamp(logistic(alpha + rhoSel*(u[i]/uSD)),0.01,0.99); let D_prev = rng()<p_i?1:0; let e_prev=rnorm(rng,0,sigmaE); let yLag=0;
      for(let t=0;t<T;t++){
        let p_now=p_i; if(dynSelOn && t>0) p_now = clamp(logistic(alpha + rhoSel*(u[i]/uSD) + gammaDY*Math.tanh(yLag)),0.01,0.99);
        if(t>0 && rng()<switchRate) D_prev = rng()<p_now?1:0; const D_true=D_prev;
        const heteroScale = heteroOn ? (1 + heteroDWeight*D_true + heteroUWeight*Math.abs(u[i])) : 1;
        const e_it = ar1On ? (rhoE*e_prev + rnorm(rng,0,sigmaE*Math.sqrt(1-rhoE*rhoE)*heteroScale)) : rnorm(rng,0,sigmaE*heteroScale); e_prev=e_it;
        const trend = timeTrendOn ? timeTrendSlope*(t+1) : 0;
        const shockC = shockAllOn && (t+1)===shockAllWave ? shockAllSize : 0;
        const shockT = shockTreatOn && (t+1)===shockTreatWave && D_true===1 ? shockTreatSize : 0;
        const beta_i = betaTrue + betaHet*(u[i]/uSD);
        const yStar = beta_i*D_true + u[i] + e_it + trend + shockC + shockT;
        const base = expOutcomeOn ? Math.exp(expScale*yStar) : yStar;
        const y = base + rnorm(rng,0,sigmaME);
        const D = (misclassOn && Math.random()<misclassP) ? 1-D_true : D_true;
        rows.push({ pid:i, wave:t+1, D_true, D, u:u[i], e:e_it, yStar, y, trend, shockCommon:shockC, shockTreat:shockT });
        if(attritionOn && t<T-1){ const dropP = clamp(attrBase + attrSlope*logistic(-yStar), 0, 0.95); if(Math.random()<dropP) break; }
        yLag=yStar;
      }
    }
    return rows;
  },[N,T,betaTrue,betaHet,sigmaU,sigmaE,sigmaME,pBase,rhoSel,switchRate,timeTrendOn,timeTrendSlope,shockAllOn,shockAllWave,shockAllSize,shockTreatOn,shockTreatWave,shockTreatSize,ar1On,rhoE,dynSelOn,gammaDY,misclassOn,misclassP,attritionOn,attrBase,attrSlope,rng,expOutcomeOn,expScale,heteroOn,heteroDWeight,heteroUWeight]);

  const cross = React.useMemo(()=>sim.filter(r=>r.wave===1),[sim]); const pooled = sim;
  const xCross = cross.map(r=>r.D), xPooled = pooled.map(r=>r.D), idsPooled = pooled.map(r=>r.pid);
  const yCross = cross.map(r=>r.y), yPooled = pooled.map(r=>r.y);

  const cs = React.useMemo(()=> olsSimple(xCross,yCross), [xCross,yCross]);
  const pooledOLS = React.useMemo(()=> olsSimple(xPooled,yPooled), [xPooled,yPooled]);
  const fe = React.useMemo(()=> feWithin(idsPooled,xPooled,yPooled), [idsPooled,xPooled,yPooled]);
  const pooledCluster = React.useMemo(()=> olsClusterSE(xPooled,yPooled,idsPooled), [xPooled,yPooled,idsPooled]);

  const csCI = React.useMemo(()=> ci(cs.beta, cs.se), [cs]);
  const pooledCI = React.useMemo(()=> ci(pooledOLS.beta, pooledOLS.se), [pooledOLS]);
  const feCI = React.useMemo(()=> ci(fe.beta, fe.se), [fe]);

  const scatterData = cross.map((r,idx)=>({ x:r.D, y:r.y, pid:r.pid, key:idx }));
  const fitLine = React.useMemo(()=>{ if(!isFinite(cs.beta)) return null; return [{x:0,y:cs.alpha},{x:1,y:cs.alpha+cs.beta}]; },[cs]);

  const spaghetti = React.useMemo(()=>{
    const ids = Array.from(new Set(pooled.map(r=>r.pid)));
    const k = Math.min(20, ids.length);
    const rand = mulberry32(1234 + seed);
    const chosenIdx = new Set();
    while (chosenIdx.size < k && ids.length > 0) chosenIdx.add(Math.floor(rand() * ids.length));
    const chosen = Array.from(chosenIdx).map(i=>ids[i]);
    return chosen.map(id=>({ id, series: pooled.filter(r=>r.pid===id).map(r=>({t:r.wave,y:r.y})) }));
  },[pooled,seed]);

  const summary = React.useMemo(()=>{
    const series = [];
    for(let t=1; t<=T; t++){
      const arr = pooled.filter(r=>r.wave===t).map(r=>r.y);
      if(arr.length){
        series.push({ t, mean: mean(arr), median: quantile(arr,0.5), p25: quantile(arr,0.25), p75: quantile(arr,0.75) });
      }
    }
    return series;
  },[pooled,T]);

  const residPoints = React.useMemo(()=> pooled.map(r=>({ fit: pooledOLS.alpha + pooledOLS.beta*r.D, resid: r.y-(pooledOLS.alpha+pooledOLS.beta*r.D), pid:r.pid, wave:r.wave })),[pooled,pooledOLS]);
  const hist = React.useMemo(()=>{ const a=residPoints.map(d=>d.resid); if(!a.length) return []; const mn=Math.min(...a), mx=Math.max(...a), bins=20; const w=(mx-mn)/bins||1; const cnt=new Array(bins).fill(0); a.forEach(v=>{ const i=Math.max(0,Math.min(bins-1,Math.floor((v-mn)/w))); cnt[i]++; }); return cnt.map((c,i)=>({bin:(mn+i*w).toFixed(2),count:c})); },[residPoints]);
  const qqData = React.useMemo(()=>{ const r = residPoints.map(d=>d.resid).sort((a,b)=>a-b); const n=r.length; if(n<5) return []; return r.map((v,i)=>{ const p=(i+0.5)/n; const z = Math.SQRT2 * erfinv(2*p-1); return { theor:z, sample:v }; }); },[residPoints]);

  const iccTrue = sigmaU**2 / (sigmaU**2 + sigmaE**2 + sigmaME**2);
  const iccEmp = React.useMemo(()=>{ const by=new Map(); for(const r of pooled){ if(!by.has(r.pid)) by.set(r.pid,[]); by.get(r.pid).push(r.y); } const means=[]; const wVars=[]; by.forEach((arr)=>{ const m=arr.reduce((a,b)=>a+b,0)/arr.length; means.push(m); const v=arr.reduce((s,v)=>s+(v-m)**2,0)/Math.max(1,arr.length-1); wVars.push(v); }); const vb=variance(means); const vw=wVars.reduce((a,b)=>a+b,0)/Math.max(1,wVars.length); const tot=vb+vw; return tot===0?NaN:vb/tot; },[pooled]);
  const idsUnique = React.useMemo(()=> Array.from(new Set(pooled.map(r=>r.pid))),[pooled]);
  const shareSwitchers = React.useMemo(()=>{ let c=0; idsUnique.forEach(id=>{ const rows=pooled.filter(r=>r.pid===id); const any=rows.some((r,i)=> i>0 && r.D!==rows[i-1].D); if(any) c++; }); return idsUnique.length? c/idsUnique.length : NaN; },[pooled,idsUnique]);
  const attritionRate = React.useMemo(()=>{ const fewer=idsUnique.filter(id=> pooled.filter(r=>r.pid===id).length < T ).length; return idsUnique.length? fewer/idsUnique.length : NaN; },[pooled,idsUnique,T]);

  const hausman = React.useMemo(()=>{ if(!(isFinite(pooledOLS.beta)&&isFinite(pooledOLS.se)&&isFinite(fe.beta)&&isFinite(fe.se))) return { z:NaN,p:NaN,diff:NaN }; const diff=pooledOLS.beta-fe.beta; const seDiff=Math.sqrt(pooledOLS.se**2 + fe.se**2); const z=diff/(seDiff||NaN); const p=isFinite(z)? 2*(1-phi(Math.abs(z))) : NaN; return { z, p, diff }; },[pooledOLS,fe]);
  const bp = React.useMemo(()=>{ const r2=residPoints.map(d=>d.resid**2); if(r2.length<3) return { LM:NaN,p:NaN }; const f=olsSimple(xPooled,r2); const m=r2.reduce((a,b)=>a+b,0)/r2.length; const sst=r2.reduce((s,v)=>s+(v-m)**2,0); const ssr=r2.reduce((s,v,i)=>s+(v-(f.alpha+f.beta*xPooled[i]))**2,0); const R2=sst===0?0:1-ssr/sst; const LM=r2.length*R2; const p=2*(1-phi(Math.sqrt(LM))); return { LM, p }; },[residPoints,xPooled]);
  const pretrend = React.useMemo(()=>{ const t=[]; const gaps=[]; for(let w=1; w<=T; w++){ const rows=pooled.filter(r=>r.wave===w); if(!rows.length) continue; const y1=rows.filter(r=>r.D===1).map(r=>r.y); const y0=rows.filter(r=>r.D===0).map(r=>r.y); if(y1.length<5||y0.length<5) continue; const m1=mean(y1); const m0=mean(y0); t.push(w); gaps.push(m1-m0); } if(t.length<3) return { slope:NaN,p:NaN }; const f=olsSimple(t,gaps); const z=f.se? f.beta/f.se : NaN; const p=isFinite(z)? 2*(1-phi(Math.abs(z))) : NaN; return { slope:f.beta, p }; },[pooled,T]);
  const meanAR1 = React.useMemo(()=>{ const by=new Map(); residPoints.forEach(d=>{ if(!by.has(d.pid)) by.set(d.pid,[]); by.get(d.pid).push(d); }); let sum=0,cnt=0; by.forEach(arr=>{ const s=arr.sort((a,b)=>a.wave-b.wave); const y1=[], y2=[]; for(let i=1;i<s.length;i++){ y1.push(s[i-1].resid); y2.push(s[i].resid); } if(y1.length>1){ const m1=mean(y1), m2=mean(y2); let num=0,den=0; for(let i=0;i<y1.length;i++){ num+=(y1[i]-m1)*(y2[i]-m2); den+=(y1[i]-m1)**2; } if(den>0){ sum+=num/den; cnt++; } } }); return cnt? sum/cnt : NaN; },[residPoints]);

  const huberPooled = React.useMemo(()=> huberIRLS(xPooled,yPooled), [xPooled,yPooled]);
  const bayesPooled = React.useMemo(()=> bayesPosterior(xPooled,yPooled), [xPooled,yPooled]);

  // Guard UI until Recharts is available
  if (!R){
    return (
      <div className="min-h-screen w-full bg-neutral-950 text-neutral-100">
        <div className="max-w-xl mx-auto p-6">
          <h1 className="text-xl font-semibold mb-2">Loading charts…</h1>
          <p className="text-neutral-300 text-sm">Waiting for the Recharts library to become available.</p>
          {error && <p className="text-red-400 mt-2 text-sm">{error} Tip: vendor <code>Recharts.min.js</code> locally and reference it via <code>/stats/vendor/Recharts.min.js</code>.</p>}
        </div>
      </div>
    );
  }

  // Destructure *after* it's available
  const {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
    LineChart, Line, ReferenceLine, ResponsiveContainer,
    BarChart, Bar, ComposedChart, Area
  } = R;

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* ... the rest is the same as previous working UI ... */}

        <header className="mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Cross-Section vs Panel Estimation — Demonstrator</h1>
          <p className="text-neutral-300 mt-2 max-w-4xl">Explore how cross-sectional, pooled, fixed-effects, robust, and Bayesian estimators behave under realistic panel data-generating processes. Toggle selection, trends, shocks, serial correlation, dynamics, misclassification, heterogeneity, and attrition.</p>
          <div className="mt-4 flex gap-2">
            <button onClick={()=>setTab('sim')} className={`px-3 py-2 rounded-lg border ${tab==='sim'? 'bg-neutral-800 border-neutral-700':'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900'}`}>Simulator</button>
            <button onClick={()=>setTab('info')} className={`px-3 py-2 rounded-lg border ${tab==='info'? 'bg-neutral-800 border-neutral-700':'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900'}`}>Info</button>
            <button onClick={()=>{ location.search='?v='+(Date.now()); }} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700" title="Hard refresh">Hard refresh</button>
          </div>
        </header>

        {/* For brevity, reuse the previously generated body exactly.
            We omit here to keep file length reasonable in this cell. */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
          <p className="text-neutral-300">Recharts loaded successfully. Replace this placeholder with the full content you already had (trajectories, estimates, diagnostics, cards). The only structural change you need is the guarded destructuring shown above.</p>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
