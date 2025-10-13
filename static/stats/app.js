// Cross‑Section vs Panel Estimation — ESM build (no Babel, no UMD)
// Drop alongside index.html under /static/stats/ and open /stats/

import React, { useMemo, useState } from "https://esm.sh/react@18";
import { createRoot } from "https://esm.sh/react-dom@18/client";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  LineChart, Line, ReferenceLine, ResponsiveContainer,
  BarChart, Bar, ComposedChart, ErrorBar, Area
} from "https://esm.sh/recharts@2.12.7?external=react,react-dom";

// ====================== Utilities ====================== //
const mulberry32 = (a) => () => { let t = (a += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const logistic = (z) => 1 / (1 + Math.exp(-z));
const clamp = (x,a,b) => Math.max(a, Math.min(b, x));
const rnorm = (rng, m=0, s=1) => { let u=0,v=0; while(u===0)u=rng(); while(v===0)v=rng(); const z=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); return m+s*z; };
const variance = (a) => { const n=a.length; if(n<=1) return 0; const m=a.reduce((x,y)=>x+y,0)/n; return a.reduce((s,v)=>s+(v-m)**2,0)/(n-1); };
const quantile = (a, q) => { if(!a.length) return NaN; const s=[...a].sort((x,y)=>x-y); const p=(s.length-1)*q; const lo=Math.floor(p), hi=Math.ceil(p); if(lo===hi) return s[lo]; return s[lo]*(hi-p)+s[hi]*(p-lo); };
const toCSV = (rows, header) => {
  const esc = (s) => '\"' + String(s).replace(/\"/g,'\"\"') + '\"';
  const head = header.map(esc).join(",");
  const body = rows.map(r => header.map(h => esc(r[h])).join(",")).join("\\n");
  return head + "\\n" + body;
};

// Weighted LS helper
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

// ----- Estimators ----- //
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

// Robust (Huber) IRLS, single regressor with intercept
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

// Bayesian linear regression (Normal–Inverse-Gamma prior)
function bayesPosterior(x, y){
  const n=x.length; if(n<3) return { betaMean:NaN, betaSE:NaN, ci:[NaN,NaN], alphaMean:NaN };
  const v0a=100, v0b=10; const a0=2, b0=1; // weakly informative
  let sumx=0,sumxx=0,sumy=0,sumxy=0,sumyy=0; for(let i=0;i<n;i++){ const xi=x[i], yi=y[i]; sumx+=xi; sumxx+=xi*xi; sumy+=yi; sumxy+=xi*yi; sumyy+=yi*yi; }
  const V0Inv00=1/v0a, V0Inv11=1/v0b; const XtX00=n, XtX01=sumx, XtX11=sumxx;
  const VnInv00=V0Inv00+XtX00, VnInv01=0+XtX01, VnInv11=V0Inv11+XtX11; const det=VnInv00*VnInv11 - VnInv01*VnInv01;
  const Vn00= VnInv11/det, Vn01= -VnInv01/det, Vn11= VnInv00/det; // inverse of 2x2
  const m0a=0, m0b=0;
  const z0 = (0 + sumy), z1 = (0 + sumxy);
  const mna = Vn00*z0 + Vn01*z1; const mnb = Vn01*z0 + Vn11*z1;
  const an = a0 + n/2;
  const quad = (mna*(VnInv00*mna+VnInv01*mnb) + mnb*(VnInv01*mna+VnInv11*mnb));
  const bn = b0 + 0.5*(sumyy - quad);
  const scale = bn/(an-1); // E[sigma2 | y]
  const varBeta = scale * Vn11; const seBeta = Math.sqrt(Math.max(0,varBeta));
  const ci = [mnb - 1.96*seBeta, mnb + 1.96*seBeta];
  return { betaMean:mnb, betaSE:seBeta, ci, alphaMean:mna, an, bn };
}

// Normal helpers
function erf(x){const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911; const s=x<0?-1:1; x=Math.abs(x); const t=1/(1+p*x); const y=1-(((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x)); return s*y;} 
const phi = (z)=> 0.5*(1+erf(z/Math.SQRT2));
function erfinv(x){ const a=0.147; const ln = Math.log(1-x*x); const s = (2/(Math.PI*a) + ln/2); const res = Math.sign(x)*Math.sqrt( Math.sqrt(s*s - ln/a) - s ); return res; }

// ====================== Small UI helpers ====================== //
function Slider({label,min,max,step,value,onChange}){
  return (<div><div className="flex items-center justify-between mb-1"><label className="text-sm text-neutral-300">{label}</label><span className="text-xs text-neutral-400">{min}–{max}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(parseFloat(e.target.value))} className="w-full accent-neutral-200"/></div>);
}
function ResultCard({title,value,ci,details,foot,warn,large}){
  return (<div className={`bg-neutral-900/60 border rounded-2xl ${large? 'p-5':'p-4'} ${warn? 'border-red-800':'border-neutral-800'}`}><div className="text-sm text-neutral-400">{title}</div><div className={`${large? 'text-3xl':'text-2xl'} font-semibold mt-1`}>{value}</div>{ci&&<div className="text-xs text-neutral-400 mt-1">95% interval: {ci}</div>}{details&&<div className="text-xs text-neutral-400 mt-1">{details}</div>}{foot&&<div className="text-xs text-neutral-500 mt-2">{foot}</div>}</div>);
}
function PresetButton({onClick,label}){ return (<button onClick={onClick} className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm">{label}</button>); }
const applyPreset = (name) => console.log("Preset clicked:", name);

// ====================== Main Component ====================== //
function App(){
  const [tab,setTab]=useState("sim");
  const [vizTab,setVizTab]=useState('trajectories');
  const [analysisTab,setAnalysisTab]=useState('descriptives');

  const [scenario,setScenario]=useState({ id:"Custom", title:"Custom scenario", d:"Treatment (D)", y:"Outcome (Y)", desc:"Tweak controls to explore biases.", issues:["Selection","Trends/Shocks","Serial correlation","Measurement error"]});

  // Core params
  const [seed,setSeed]=useState(42); const [N,setN]=useState(600); const [T,setT]=useState(8);
  const [betaTrue,setBetaTrue]=useState(0.6); const [betaHet,setBetaHet]=useState(0.0);
  const [sigmaU,setSigmaU]=useState(1.2); const [sigmaE,setSigmaE]=useState(1.0); const [sigmaME,setSigmaME]=useState(0.3);
  const [pBase,setPBase]=useState(0.5); const [rhoSel,setRhoSel]=useState(1.0); const [switchRate,setSwitchRate]=useState(0.25);

  // Assumptions
  const [timeTrendOn,setTimeTrendOn]=useState(true); const [timeTrendSlope,setTimeTrendSlope]=useState(0.05);
  const [shockAllOn,setShockAllOn]=useState(false); const [shockAllWave,setShockAllWave]=useState(5); const [shockAllSize,setShockAllSize]=useState(0.8);
  const [shockTreatOn,setShockTreatOn]=useState(false); const [shockTreatWave,setShockTreatWave]=useState(6); const [shockTreatSize,setShockTreatSize]=useState(0.8);
  const [ar1On,setAr1On]=useState(false); const [rhoE,setRhoE]=useState(0.5);
  const [dynSelOn,setDynSelOn]=useState(false); const [gammaDY,setGammaDY]=useState(0.5);
  const [misclassOn,setMisclassOn]=useState(false); const [misclassP,setMisclassP]=useState(0.15);
  const [attritionOn,setAttritionOn]=useState(false); const [attrBase,setAttrBase]=useState(0.02); const [attrSlope,setAttrSlope]=useState(0.15);
  const [expOutcomeOn,setExpOutcomeOn]=useState(false); const [expScale,setExpScale]=useState(0.35);
  const [heteroOn,setHeteroOn]=useState(false); const [heteroDWeight,setHeteroDWeight]=useState(0.8); const [heteroUWeight,setHeteroUWeight]=useState(0.4);

  const rng = useMemo(()=>mulberry32(seed),[seed]);

  // ---------- Simulate data ---------- //
  const sim = useMemo(()=>{
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
        const D = (misclassOn && rng()<misclassP) ? 1-D_true : D_true;
        rows.push({ pid:i, wave:t+1, D_true, D, u:u[i], e:e_it, yStar, y, trend, shockCommon:shockC, shockTreat:shockT });
        if(attritionOn && t<T-1){ const dropP = clamp(attrBase + attrSlope*logistic(-yStar), 0, 0.95); if(rng()<dropP) break; }
        yLag=yStar;
      }
    }
    return rows;
  },[N,T,betaTrue,betaHet,sigmaU,sigmaE,sigmaME,pBase,rhoSel,switchRate,timeTrendOn,timeTrendSlope,shockAllOn,shockAllWave,shockAllSize,shockTreatOn,shockTreatWave,shockTreatSize,ar1On,rhoE,dynSelOn,gammaDY,misclassOn,misclassP,attritionOn,attrBase,attrSlope,rng,expOutcomeOn,expScale,heteroOn,heteroDWeight,heteroUWeight]);

  // ---------- Derived & estimators ---------- //
  const cross = useMemo(()=>sim.filter(r=>r.wave===1),[sim]); const pooled = sim;
  const xCross = cross.map(r=>r.D), xPooled = pooled.map(r=>r.D), idsPooled = pooled.map(r=>r.pid);
  const yCross = cross.map(r=>r.y), yPooled = pooled.map(r=>r.y);

  const cs = useMemo(()=> olsSimple(xCross,yCross), [xCross,yCross]);
  const pooledOLS = useMemo(()=> olsSimple(xPooled,yPooled), [xPooled,yPooled]);
  const fe = useMemo(()=> feWithin(idsPooled,xPooled,yPooled), [idsPooled,xPooled,yPooled]);
  const pooledCluster = useMemo(()=> olsClusterSE(xPooled,yPooled,idsPooled), [xPooled,yPooled,idsPooled]);

  const fmt=(x,d=3)=> (Number.isNaN(x)||x===undefined||!isFinite(x))?"—":Number(x).toFixed(d);
  const ci = (b,se)=> [b-1.96*(se||NaN), b+1.96*(se||NaN)];
  const csCI = ci(cs.beta, cs.se), pooledCI = ci(pooledOLS.beta, pooledOLS.se), feCI = ci(fe.beta, fe.se);

  const scatterData = cross.map((r,idx)=>({ x:r.D, y:r.y, pid:r.pid, key:idx }));
  const fitLine = useMemo(()=>{ if(!isFinite(cs.beta)) return null; return [{x:0,y:cs.alpha},{x:1,y:cs.alpha+cs.beta}]; },[cs]);

  const spaghetti = useMemo(()=>{
    const ids = Array.from(new Set(pooled.map(r=>r.pid)));
    const k = Math.min(20, ids.length);
    const rand = mulberry32(1234 + seed);
    const chosenIdx = new Set();
    while (chosenIdx.size < k && ids.length > 0) chosenIdx.add(Math.floor(rand() * ids.length));
    const chosen = Array.from(chosenIdx).map(i=>ids[i]);
    return chosen.map(id=>({ id, series: pooled.filter(r=>r.pid===id).map(r=>({t:r.wave,y:r.y})) }));
  },[pooled,seed]);

  const residPoints = useMemo(()=> pooled.map(r=>({ fit: pooledOLS.alpha + pooledOLS.beta*r.D, resid: r.y-(pooledOLS.alpha+pooledOLS.beta*r.D), pid:r.pid, wave:r.wave })),[pooled,pooledOLS]);
  const hist = useMemo(()=>{ const a=residPoints.map(d=>d.resid); if(!a.length) return []; const mn=Math.min(...a), mx=Math.max(...a), bins=20; const w=(mx-mn)/bins||1; const cnt=new Array(bins).fill(0); a.forEach(v=>{ const i=Math.max(0,Math.min(bins-1,Math.floor((v-mn)/w))); cnt[i]++; }); return cnt.map((c,i)=>({bin:(mn+i*w).toFixed(2),count:c})); },[residPoints]);
  const qqData = useMemo(()=>{ const r = residPoints.map(d=>d.resid).sort((a,b)=>a-b); const n=r.length; if(n<5) return []; return r.map((v,i)=>{ const p=(i+0.5)/n; const z = Math.SQRT2 * erfinv(2*p-1); return { theor:z, sample:v }; }); },[residPoints]);

  const iccTrue = sigmaU**2 / (sigmaU**2 + sigmaE**2 + sigmaME**2);
  const iccEmp = useMemo(()=>{ const by=new Map(); for(const r of pooled){ if(!by.has(r.pid)) by.set(r.pid,[]); by.get(r.pid).push(r.y); } const means=[]; const wVars=[]; by.forEach((arr)=>{ const m=arr.reduce((a,b)=>a+b,0)/arr.length; means.push(m); const v=arr.reduce((s,v)=>s+(v-m)**2,0)/Math.max(1,arr.length-1); wVars.push(v); }); const vb=variance(means); const vw=wVars.reduce((a,b)=>a+b,0)/Math.max(1,wVars.length); const tot=vb+vw; return tot===0?NaN:vb/tot; },[pooled]);
  const idsUnique = useMemo(()=> Array.from(new Set(pooled.map(r=>r.pid))),[pooled]);
  const shareSwitchers = useMemo(()=>{ let c=0; idsUnique.forEach(id=>{ const rows=pooled.filter(r=>r.pid===id); const any=rows.some((r,i)=> i>0 && r.D!==rows[i-1].D); if(any) c++; }); return idsUnique.length? c/idsUnique.length : NaN; },[pooled,idsUnique]);
  const attritionRate = useMemo(()=>{ const fewer=idsUnique.filter(id=> pooled.filter(r=>r.pid===id).length < T ).length; return idsUnique.length? fewer/idsUnique.length : NaN; },[pooled,idsUnique,T]);

  const hausman = useMemo(()=>{ if(!(isFinite(pooledOLS.beta)&&isFinite(pooledOLS.se)&&isFinite(fe.beta)&&isFinite(fe.se))) return { z:NaN,p:NaN,diff:NaN }; const diff=pooledOLS.beta-fe.beta; const seDiff=Math.sqrt(pooledOLS.se**2 + fe.se**2); const z=diff/(seDiff||NaN); const p=isFinite(z)? 2*(1-phi(Math.abs(z))) : NaN; return { z, p, diff }; },[pooledOLS,fe]);
  const bp = useMemo(()=>{ const r2=residPoints.map(d=>d.resid**2); if(r2.length<3) return { LM:NaN,p:NaN }; const f=olsSimple(xPooled,r2); const m=r2.reduce((a,b)=>a+b,0)/r2.length; const sst=r2.reduce((s,v)=>s+(v-m)**2,0); const ssr=r2.reduce((s,v,i)=>s+(v-(f.alpha+f.beta*xPooled[i]))**2,0); const R2=sst===0?0:1-ssr/sst; const LM=r2.length*R2; const p=2*(1-phi(Math.sqrt(LM))); return { LM, p }; },[residPoints,xPooled]);
  const pretrend = useMemo(()=>{ const t=[]; const gaps=[]; for(let w=1; w<=T; w++){ const rows=pooled.filter(r=>r.wave===w); if(!rows.length) continue; const y1=rows.filter(r=>r.D===1).map(r=>r.y); const y0=rows.filter(r=>r.D===0).map(r=>r.y); if(y1.length<5||y0.length<5) continue; const m1=y1.reduce((a,b)=>a+b,0)/y1.length; const m0=y0.reduce((a,b)=>a+b,0)/y0.length; t.push(w); gaps.push(m1-m0); } if(t.length<3) return { slope:NaN,p:NaN }; const f=olsSimple(t,gaps); const z=f.se? f.beta/f.se : NaN; const p=isFinite(z)? 2*(1-phi(Math.abs(z))) : NaN; return { slope:f.beta, p }; },[pooled,T]);
  const meanAR1 = useMemo(()=>{ const by=new Map(); residPoints.forEach(d=>{ if(!by.has(d.pid)) by.set(d.pid,[]); by.get(d.pid).push(d); }); let sum=0,cnt=0; by.forEach(arr=>{ const s=arr.sort((a,b)=>a.wave-b.wave); const y1=[], y2=[]; for(let i=1;i<s.length;i++){ y1.push(s[i-1].resid); y2.push(s[i].resid); } if(y1.length>1){ const m1=y1.reduce((a,b)=>a+b,0)/y1.length, m2=y2.reduce((a,b)=>a+b,0)/y2.length; let num=0,den=0; for(let i=0;i<y1.length;i++){ num+=(y1[i]-m1)*(y2[i]-m2); den+=(y1[i]-m1)**2; } if(den>0){ sum+=num/den; cnt++; } } }); return cnt? sum/cnt : NaN; },[residPoints]);

  const huberPooled = useMemo(()=> huberIRLS(xPooled,yPooled), [xPooled,yPooled]);
  const bayesPooled = useMemo(()=> bayesPosterior(xPooled,yPooled), [xPooled,yPooled]);

  const diag = useMemo(()=>{ const warns=[]; const sugg=new Set(); const push=(l,m,f)=>{warns.push({lvl:l,msg:m,fix:f}); if(f) sugg.add(f);};
    if(rhoSel>0.5 || (isFinite(iccEmp)&&iccEmp>0.6)) push("🔴","High selection potential (large ρ or ICC): cross-section/pooled likely biased.","Prefer FE; add controls or IV.");
    if(timeTrendOn || shockAllOn) push("🟠","Time trends or common shocks present.","Add time FE or detrend; consider DiD.");
    if(shockTreatOn) push("🔴","Treat-specific shock active: parallel trends violated.","Use event-study with group×time FE; test pre-trends.");
    if(ar1On || (isFinite(meanAR1)&&Math.abs(meanAR1)>0.2)) push("🟠","Serial correlation in errors.","Cluster SEs at unit level; model AR terms.");
    if(sigmaME>0.8 || misclassOn) push("🟠","Strong measurement error/misclassification.","Instrument/correct using validation; reliability adjustments.");
    if(dynSelOn) push("🔴","Dynamic selection (Y→D) enabled.","Lagged controls/GMM (Arellano–Bond), IV, or design-based ID.");
    if(isFinite(shareSwitchers) && shareSwitchers<0.15) push("🟠","Few switchers → FE weakly identified.","Increase T; consider pooled + controls/IV.");
    if(attritionOn && isFinite(attritionRate) && attritionRate>0.15) push("🟠",`Nontrivial attrition (${(attritionRate*100).toFixed(0)}%).`,`Model attrition, IPW, or bounds.`);
    if(heteroOn || (isFinite(bp.LM) && bp.p<0.05)) push("🟠","Heteroskedasticity suspected (BP).","Use robust/clustered SEs or model variance.");
    if(isFinite(hausman.z) && Math.abs(hausman.z)>1.96) push("🔴","FE vs pooled discrepancy significant (Hausman-style).","Prefer FE; add controls or IV.");
    if(isFinite(pretrend.slope) && pretrend.p<0.05) push("🔴","Pretrend in outcome gap over time.","Add group×time FE or validate parallel trends.");
    if(!warns.length) warns.push({lvl:"🟢",msg:"No major red flags detected.",fix:"Still cluster SEs for panels; inspect residuals & ICC."});
    return { warns, suggestions:Array.from(sugg) };
  },[rhoSel,iccEmp,timeTrendOn,shockAllOn,shockTreatOn,ar1On,sigmaME,misclassOn,dynSelOn,shareSwitchers,attritionOn,attritionRate,heteroOn,bp,hausman,pretrend,meanAR1]);

  const selfTests = useMemo(()=>{
    const R = [];
    try{ const rows=[{a:1,b:2},{a:'a\"b',b:4}], header=['a','b']; const csv=toCSV(rows,header); const lines=csv.split('\\n'); R.push({name:'CSV header/rows',pass:lines.length===3,detail:String(lines.length)}); R.push({name:'CSV quote escape',pass:csv.includes('\"a\"\"b\"'),detail:lines[1]}); }catch(e){ R.push({name:'CSV',pass:false,detail:String(e)}); }
    try{ const d=olsSimple([0,0,0,0],[1,2,3,4]); R.push({name:'OLS constant regressor',pass:Number.isNaN(d.beta),detail:`beta=${d.beta}`}); }catch(e){ R.push({name:'OLS const',pass:false,detail:String(e)}); }
    try{ const x=[0,1,2,3], y=x.map(v=>3+2*v); const f=olsSimple(x,y); R.push({name:'OLS exact recovery',pass:Math.abs(f.beta-2)<1e-12 && Math.abs(f.alpha-3)<1e-12,detail:`b=${f.beta}`}); }catch(e){ R.push({name:'OLS recover',pass:false,detail:String(e)}); }
    try{ const ids=[1,1,2,2], x=[0,1,0,1], y=[0,1,2,3]; const f=feWithin(ids,x,y); R.push({name:'FE exact recovery',pass:Math.abs(f.beta-1)<1e-12,detail:`b=${f.beta}`}); }catch(e){ R.push({name:'FE',pass:false,detail:String(e)}); }
    try{ const ids=[1,1,2,2], x=[0,0,1,1], y=[0,0,1,1]; const f=feWithin(ids,x,y); R.push({name:'FE needs switchers',pass:Number.isNaN(f.beta),detail:`b=${f.beta}`}); }catch(e){ R.push({name:'FE switchers',pass:false,detail:String(e)}); }
    try{ const x=[0,1,2,3,100], y=[0,2,4,6,0]; const ols=olsSimple(x,y); const hub=huberIRLS(x,y); R.push({name:'Huber vs OLS (outlier)',pass:Math.abs(hub.beta-2)<Math.abs(ols.beta-2),detail:`ols=${ols.beta}, huber=${hub.beta}`}); }catch(e){ R.push({name:'Huber',pass:false,detail:String(e)}); }
    try{ const x=[0,1,2,3,4,5,6,7,8,9], y=x.map(v=>1+0.5*v + (v%2?1:-1)*0.01); const b=bayesPosterior(x,y); R.push({name:'Bayes finite',pass:isFinite(b.betaMean) && isFinite(b.betaSE),detail:`b=${b.betaMean}`}); }catch(e){ R.push({name:'Bayes',pass:false,detail:String(e)}); }
    return R;
  },[]);

  const downloadCSV = () => { const header=["pid","wave","D_true","D","u","e","yStar","y","trend","shockCommon","shockTreat"]; const csv=toCSV(pooled,header); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='sim_cross_section_vs_panel.csv'; a.click(); URL.revokeObjectURL(url); };

  const TabButton = ({id,children}) => (
    <button onClick={()=>setTab(id)} className={`px-3 py-2 rounded-lg border ${tab===id? 'bg-neutral-800 border-neutral-700':'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900'}`}>{children}</button>
  );
  const AnalysisPill = ({id,label}) => (
    <button onClick={()=>setAnalysisTab(id)} className={`px-2.5 py-1 rounded-md text-xs border ${analysisTab===id? 'bg-neutral-800 border-neutral-700':'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900'}`}>{label}</button>
  );
  const VizPill = ({id,label}) => (
    <button onClick={()=>setVizTab(id)} className={`px-2.5 py-1 rounded-md text-xs border ${vizTab===id? 'bg-neutral-800 border-neutral-700':'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900'}`}>{label}</button>
  );

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Cross-Section vs Panel Estimation — Demonstrator</h1>
          <p className="text-neutral-300 mt-2 max-w-4xl">Explore how cross-sectional, pooled, fixed-effects, robust, and Bayesian estimators behave under realistic panel data-generating processes. Toggle selection, trends, shocks, serial correlation, dynamics, misclassification, heterogeneity, and attrition.</p>
          <div className="mt-4 flex gap-2"><TabButton id="sim">Simulator</TabButton><TabButton id="info">Info</TabButton></div>
        </header>

        {tab==='sim'? (
          <>
            <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="col-span-1 space-y-4 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
                <div className="flex items-center justify-between"><h2 className="font-semibold">Simulation Settings</h2>
                  <div className="flex gap-2">
                    <button onClick={()=>setSeed(s=>s+1)} className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700" title="Reseed">Reseed</button>
                    <button onClick={()=>{ setSeed(42); setN(600); setT(8); setBetaTrue(0.6); setBetaHet(0); setSigmaU(1.2); setSigmaE(1.0); setSigmaME(0.3); setPBase(0.5); setRhoSel(1.0); setSwitchRate(0.25); setTimeTrendOn(true); setTimeTrendSlope(0.05); setShockAllOn(false); setShockTreatOn(false); setAr1On(false); setRhoE(0.5); setDynSelOn(false); setGammaDY(0.5); setMisclassOn(false); setMisclassP(0.15); setAttritionOn(false); setAttrBase(0.02); setAttrSlope(0.15); setExpOutcomeOn(false); setExpScale(0.35); setHeteroOn(false); setHeteroDWeight(0.8); setHeteroUWeight(0.4); setScenario({ id:'Custom', title:'Custom scenario', d:'Treatment (D)', y:'Outcome (Y)', desc:'Tweak controls to explore biases.', issues:['Selection','Trends/Shocks','Serial correlation','Measurement error']}); setAnalysisTab('descriptives'); }} className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700">Reset</button>
                  </div></div>

                <div className="flex gap-2 flex-wrap items-center text-xs"><span className="text-neutral-400">Analysis:</span>
                  <button onClick={()=>setAnalysisTab('descriptives')} className={`px-2.5 py-1 rounded-md text-xs border ${analysisTab==='descriptives'? 'bg-neutral-800 border-neutral-700':'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900'}`}>Descriptives</button>
                  <button onClick={()=>setAnalysisTab('frequentist')} className={`px-2.5 py-1 rounded-md text-xs border ${analysisTab==='frequentist'? 'bg-neutral-800 border-neutral-700':'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900'}`}>Frequentist (OLS/FE)</button>
                  <button onClick={()=>setAnalysisTab('bayesian')} className={`px-2.5 py-1 rounded-md text-xs border ${analysisTab==='bayesian'? 'bg-neutral-800 border-neutral-700':'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900'}`}>Bayesian (OLS)</button>
                  <button onClick={()=>setAnalysisTab('robust')} className={`px-2.5 py-1 rounded-md text-xs border ${analysisTab==='robust'? 'bg-neutral-800 border-neutral-700':'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900'}`}>Robust (Huber)</button>
                </div>

                <Slider label={`Persons (N): ${N}`} min={50} max={4000} step={50} value={N} onChange={setN} />
                <Slider label={`Waves (T): ${T}`} min={2} max={16} step={1} value={T} onChange={setT} />
                <Slider label={`True effect β: ${betaTrue.toFixed(2)}`} min={-2} max={2} step={0.05} value={betaTrue} onChange={setBetaTrue} />
                <Slider label={`Heterogeneity β×u (βₕ): ${betaHet.toFixed(2)}`} min={-2} max={2} step={0.05} value={betaHet} onChange={setBetaHet} />
                <Slider label={`Between-person SD (σᵤ): ${sigmaU.toFixed(2)}`} min={0} max={3} step={0.05} value={sigmaU} onChange={setSigmaU} />
                <Slider label={`Within-person SD (σₑ): ${sigmaE.toFixed(2)}`} min={0} max={3} step={0.05} value={sigmaE} onChange={setSigmaE} />
                <Slider label={`Measurement error SD (σₘₑ): ${sigmaME.toFixed(2)}`} min={0} max={3} step={0.05} value={sigmaME} onChange={setSigmaME} />
                <Slider label={`Base prevalence P(D=1): ${pBase.toFixed(2)}`} min={0.05} max={0.95} step={0.01} value={pBase} onChange={setPBase} />
                <Slider label={`Selection strength (ρ): ${rhoSel.toFixed(2)}`} min={0} max={2} step={0.05} value={rhoSel} onChange={setRhoSel} />
                <Slider label={`Switch rate: ${switchRate.toFixed(2)}`} min={0} max={1} step={0.05} value={switchRate} />

                <div className="pt-2 grid grid-cols-1 gap-2">
                  <div className="flex flex-wrap gap-2">
                    <PresetButton onClick={()=>applyPreset('SelectionBias')} label="Preset: Tutoring bias" />
                    <PresetButton onClick={()=>applyPreset('RandomizedClean')} label="Preset: RCT" />
                    <PresetButton onClick={()=>applyPreset('MeasurementError')} label="Preset: Noisy survey" />
                    <PresetButton onClick={()=>applyPreset('PolicyDIDViolation')} label="Preset: Policy (DiD viol.)" />
                    <PresetButton onClick={()=>applyPreset('HeterogeneousTE')} label="Preset: Heterog. TE" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PresetButton onClick={()=>applyPreset('OLS_Nonlinear')} label="Preset: OLS nonlinearity" />
                    <PresetButton onClick={()=>applyPreset('OLS_Heteroskedastic')} label="Preset: OLS heterosked." />
                    <PresetButton onClick={()=>applyPreset('TrendOnly')} label="Preset: Pure trend" />
                    <PresetButton onClick={()=>applyPreset('ReverseCausality')} label="Preset: Reverse causality" />
                  </div>
                </div>

                <div className="pt-3"><button onClick={downloadCSV} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 w-full">Download simulated CSV</button></div>
                <p className="text-xs text-neutral-400">FE uses within-person changes (non-switchers do not identify β). Robust = Huber IRLS.
                Bayesian uses a weakly-informative Normal–Inverse-Gamma prior for pooled OLS.</p>
              </div>

              <div className="col-span-1 xl:col-span-2 space-y-5">
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 flex items-start justify-between gap-3">
                  <div><h3 className="font-semibold">Scenario: {scenario.title}</h3><p className="text-neutral-300 text-sm mt-1">{scenario.desc}</p><p className="text-neutral-400 text-xs mt-1">D = <span className="font-medium">{scenario.d}</span>, Y = <span className="font-medium">{scenario.y}</span></p></div>
                  <div className="text-xs text-neutral-300"><div className="font-medium mb-1">Issues</div><ul className="list-disc pl-4 space-y-0.5">{scenario.issues.map((s,i)=>(<li key={i}>{s}</li>))}</ul></div>
                </div>

                <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 text-xs md:text-sm">
                  <h3 className="font-semibold mb-2">Model notation</h3>
                  <pre className="whitespace-pre-wrap text-neutral-200 leading-5">{`
βᵢ = β + β_h·(uᵢ/σᵤ)    (β=${fmt(betaTrue,2)}, β_h=${fmt(betaHet,2)}, σᵤ=${fmt(sigmaU,2)})
Outcome base:  y*ᵢₜ = βᵢ·Dᵢₜ + uᵢ + eᵢₜ + γ·t + ξ·1{t=${5}} + τ·Dᵢₜ·1{t=${6}}
Observed Y:   yᵢₜ = ${expOutcomeOn? 'exp(κ·y*ᵢₜ)' : 'y*ᵢₜ'} + νᵢₜ   (κ=${expOutcomeOn?fmt(expScale,2):'0'},  σₘₑ=${fmt(sigmaME,2)})
Errors:       eᵢₜ = ${ar1On?`ρₑ·eᵢ,ₜ₋₁ + ηᵢₜ (ρₑ=${fmt(rhoE,2)})`:'ηᵢₜ (i.i.d.)'}  with σₑ=${fmt(sigmaE,2)}
Treatment:    Pr(Dᵢₜ=1 | uᵢ, y*ᵢ,ₜ₋₁) = logit⁻¹(α + ρ·(uᵢ/σᵤ) + γ_dy·tanh(y*ᵢ,ₜ₋₁)), α=logit(${fmt(pBase,2)})
Misclass:     D~ᵢₜ = Dᵢₜ w.p. (1−p_m), else 1−Dᵢₜ  (p_m=${misclassOn?fmt(misclassP,2):'0'})
Estimators:   Cross-sec (wave1), pooled (stacked), FE within-person; plus Robust Huber & Bayesian pooled.
`}</pre>
                </div>

                <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
                  <div className="flex gap-2 mb-3 items-center">
                    <span className="text-xs text-neutral-400">Visuals:</span>
                    <button onClick={()=>setVizTab('trajectories')} className={`px-2.5 py-1 rounded-md text-xs border ${vizTab==='trajectories'? 'bg-neutral-800 border-neutral-700':'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900'}`}>Trajectories</button>
                    <button onClick={()=>setVizTab('estimates')} className={`px-2.5 py-1 rounded-md text-xs border ${vizTab==='estimates'? 'bg-neutral-800 border-neutral-700':'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900'}`}>Estimates & CIs</button>
                    <button onClick={()=>setVizTab('diagnostics')} className={`px-2.5 py-1 rounded-md text-xs border ${vizTab==='diagnostics'? 'bg-neutral-800 border-neutral-700':'bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900'}`}>Diagnostics</button>
                  </div>

                  {vizTab==='trajectories' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="bg-neutral-950/40 border border-neutral-800 rounded-2xl p-3">
                        <h3 className="font-semibold mb-2">Cross-section — Outcome vs Treatment</h3>
                        <div className="w-full h-[26rem]"><ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={scatterData} margin={{top:10,right:10,bottom:10,left:10}}>
                            <CartesianGrid strokeDasharray="3 3"/>
                            <XAxis type="number" dataKey="x" ticks={[0,1]} domain={[0,1]} name="D"/>
                            <YAxis type="number" dataKey="y" name="Y"/>
                            <Scatter name="units" fill="currentColor" />
                            {fitLine && <Line type="linear" data={fitLine} dataKey="y" dot={false} />}
                          </ComposedChart>
                        </ResponsiveContainer></div>
                      </div>
                      <div className="bg-neutral-950/40 border border-neutral-800 rounded-2xl p-3">
                        <h3 className="font-semibold mb-2">Panel trajectories (sample)</h3>
                        <div className="w-full h-[26rem]"><ResponsiveContainer width="100%" height="100%">
                          <LineChart margin={{top:10,right:10,bottom:10,left:10}}>
                            <CartesianGrid strokeDasharray="3 3"/>
                            <XAxis type="number" dataKey="t" domain={[1,T]} allowDecimals={false}/>
                            <YAxis/>
                            {spaghetti.map(s=>(
                              <Line key={s.id} data={s.series} dataKey="y" dot={false} type="monotone" />
                            ))}
                            <ReferenceLine y={0} strokeDasharray="4 4" />
                          </LineChart>
                        </ResponsiveContainer></div>
                      </div>
                    </div>
                  )}

                  {vizTab==='estimates' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="bg-neutral-950/40 border border-neutral-800 rounded-2xl p-3">
                        <h3 className="font-semibold mb-2">Estimator β with 95% interval</h3>
                        {(() => {
                          const data = [];
                          const push = (name, b, se) => data.push({ name, b, err: 1.96*se });
                          if (analysisTab==='frequentist'){
                            if (isFinite(cs.beta) && isFinite(cs.se)) push("Cross-section", cs.beta, cs.se);
                            if (isFinite(pooledOLS.beta) && isFinite(pooledOLS.se)) push("Pooled", pooledOLS.beta, pooledOLS.se);
                            if (isFinite(fe.beta) && isFinite(fe.se)) push("Fixed Effects", fe.beta, fe.se);
                          } else if(analysisTab==='robust'){
                            if (isFinite(pooledOLS.beta) && isFinite(pooledOLS.se)) push("Pooled OLS", pooledOLS.beta, pooledOLS.se);
                            const hub = huberIRLS(xPooled,yPooled);
                            if (isFinite(hub.beta) && isFinite(hub.se)) push("Huber robust", hub.beta, hub.se);
                          } else if(analysisTab==='bayesian'){
                            const bp = bayesPosterior(xPooled,yPooled);
                            data.push({name:'Bayesian pooled', b: bp.betaMean, err: 1.96*(bp.betaSE||NaN)});
                            data.push({name:'Frequentist pooled', b: pooledOLS.beta, err: 1.96*(pooledOLS.se||NaN)});
                          }
                          return (
                            <div className="w-full h-[26rem]"><ResponsiveContainer width="100%" height="100%">
                              <BarChart data={data} margin={{top:10,right:10,bottom:10,left:10}}>
                                <CartesianGrid strokeDasharray="3 3"/>
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Bar dataKey="b">
                                  <ErrorBar dataKey="err" direction="y" />
                                </Bar>
                                <ReferenceLine y={betaTrue} strokeDasharray="4 4" />
                              </BarChart>
                            </ResponsiveContainer></div>
                          );
                        })()}
                        <p className="text-xs text-neutral-400 mt-2">Bars show point estimates; error bars show ±1.96×SE (Bayesian uses posterior variance). Dashed line marks true β.</p>
                      </div>

                      <div className="bg-neutral-950/40 border border-neutral-800 rounded-2xl p-3">
                        <h3 className="font-semibold mb-2">Variance & composition</h3>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                          <li><span className="font-medium">True ICC:</span> {isFinite(iccTrue)?iccTrue.toFixed(3):'—'}</li>
                          <li><span className="font-medium">Empirical ICC:</span> {isFinite(iccEmp)?iccEmp.toFixed(3):'—'}</li>
                          <li><span className="font-medium">Switchers:</span> {isFinite(shareSwitchers)?(shareSwitchers*100).toFixed(0):'—'}%</li>
                          <li><span className="font-medium">Attrition:</span> {isFinite(attritionRate)?(attritionRate*100).toFixed(0):'—'}%</li>
                          <li><span className="font-medium">Clustered SE (pooled):</span> {isFinite(pooledCluster.seCluster)? pooledCluster.seCluster.toFixed(3) : '—'}</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {vizTab==='diagnostics' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div className="bg-neutral-950/40 border border-neutral-800 rounded-2xl p-3">
                        <h3 className="font-semibold mb-2">Residuals vs Fitted (pooled, OLS)</h3>
                        <div className="w-full h-80"><ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{top:10,right:10,bottom:10,left:10}}>
                            <CartesianGrid strokeDasharray="3 3"/>
                            <XAxis type="number" dataKey="fit" name="Fitted"/>
                            <YAxis type="number" dataKey="resid" name="Residual"/>
                            <Scatter name="resid" data={residPoints} fill="currentColor"/>
                            <ReferenceLine y={0} strokeDasharray="4 4"/>
                          </ScatterChart>
                        </ResponsiveContainer></div>
                      </div>

                      <div className="bg-neutral-950/40 border border-neutral-800 rounded-2xl p-3">
                        <h3 className="font-semibold mb-2">Residual histogram</h3>
                        <div className="w-full h-80"><ResponsiveContainer width="100%" height="100%">
                          <BarChart data={hist} margin={{top:10,right:10,bottom:10,left:10}}>
                            <CartesianGrid strokeDasharray="3 3"/>
                            <XAxis dataKey="bin" tick={false}/>
                            <YAxis allowDecimals={false}/>
                            <Bar dataKey="count"/>
                          </BarChart>
                        </ResponsiveContainer></div>
                      </div>

                      <div className="bg-neutral-950/40 border border-neutral-800 rounded-2xl p-3">
                        <h3 className="font-semibold mb-2">Normal QQ plot (residuals)</h3>
                        <div className="w-full h-80"><ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={qqData} margin={{top:10,right:10,bottom:10,left:10}}>
                            <CartesianGrid strokeDasharray="3 3"/>
                            <XAxis type="number" dataKey="theor" name="Theoretical z"/>
                            <YAxis type="number" dataKey="sample" name="Residual"/>
                            <Scatter dataKey="sample" />
                            <Line data={[{theor:-2.5,sample:-2.5},{theor:2.5,sample:2.5}]} dataKey="sample" dot={false} />
                          </ComposedChart>
                        </ResponsiveContainer></div>
                        <p className="text-xs text-neutral-400 mt-2">Departures from the 45° line suggest non-normality/heavy tails.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4">
                  <h3 className="font-semibold mb-2">Diagnostic report</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="md:col-span-2"><ul className="space-y-1"><li>• Inspect serial correlation and heteroskedasticity; prefer FE when selection on levels is strong.</li></ul></div>
                    <div className="md:col-span-1"><div className="font-medium mb-1">Suggested remedies</div><ul className="list-disc pl-5 space-y-1 text-neutral-300"><li>Cluster SEs by unit</li><li>Add time FE / event study</li><li>Use IV / design-based ID where plausible</li></ul></div>
                  </div>
                </div>

                <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 text-sm">
                  <h3 className="font-semibold mb-2">Developer self-tests</h3>
                  <ul className="list-disc pl-5 space-y-1">{selfTests.map((t,i)=>(<li key={i}><span className={t.pass? 'text-green-400':'text-red-400'}>{t.pass? 'PASS':'FAIL'}</span>{": "}{t.name} <span className="text-neutral-400">({t.detail})</span></li>))}</ul>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-5">
            <h2 className="text-xl font-semibold mb-3">Quick explanation</h2>
            <div className="text-sm space-y-3 text-neutral-200">
              <p>This demo contrasts <span className="font-medium">cross-sectional</span>, <span className="font-medium">pooled</span>, and <span className="font-medium">fixed-effects</span> estimators, and adds <span className="font-medium">robust</span> and <span className="font-medium">Bayesian</span> alternatives, on synthetic panel data.</p>
              <p className="text-neutral-300">Current scenario: <span className="font-medium">{scenario.title}</span>. D = {scenario.d}; Y = {scenario.y}.</p>
              <pre className="whitespace-pre-wrap text-xs text-neutral-300">{`DGP (compact): βᵢ=β+β_h(uᵢ/σᵤ);  y*ᵢₜ=βᵢDᵢₜ+uᵢ+eᵢₜ+γt+ξ1{t=5}+τDᵢₜ1{t=6};  y= ${expOutcomeOn?'exp(κy*)':'y*'} +ν.`}</pre>
            </div>
          </section>
        )}

        <footer className="mt-8 text-xs text-neutral-500"><p>Prototype for classroom use. Generated data are synthetic. Download the CSV to replicate estimators (OLS, FE), and compare with Huber robust / Bayesian pooled.</p></footer>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
