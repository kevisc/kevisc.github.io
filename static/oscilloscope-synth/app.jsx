/* @jsx React.createElement */
/* @jsxFrag React.Fragment */

const { useEffect, useRef, useState } = React;

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-semibold uppercase tracking-widest text-gray-300 mb-2">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Slider({ label, min, max, step=0.01, value, onChange, format=(v)=>v, disabled=false }){
  return (
    <div className={disabled?"opacity-50 pointer-events-none":""}>
      <div className="flex justify-between text-xs text-gray-300">
        <span>{label}</span>
        <span className="tabular-nums">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e)=>onChange(parseFloat(e.target.value))} className="w-full"/>
    </div>
  );
}
function Select({ label, value, onChange, options, disabled=false }){
  return (
    <div className={disabled?"opacity-50 pointer-events-none":""}>
      <div className="text-xs text-gray-300 mb-1">{label}</div>
      <select value={value} onChange={(e)=>onChange(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none">
        {options.map(o=> <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function Toggle({ label, checked, onChange }){
  return (
    <label className="flex items-center justify-between text-xs text-gray-300">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)} />
    </label>
  );
}

const RINGS_WORKLET_SRC = `
class RingsResonator extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'frequency', defaultValue: 220, minValue: 10, maxValue: 4000, automationRate: 'k-rate' },
      { name: 'structure', defaultValue: 0.25, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'brightness', defaultValue: 0.6, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'damping', defaultValue: 0.7, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'position', defaultValue: 0.3, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'model', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
    ];
  }
  constructor() {
    super();
    this.sr = sampleRate;
    this.M = 12;
    this.s1 = new Float32Array(this.M);
    this.s2 = new Float32Array(this.M);
    this._strike = 0;
    this._strikeAmp = 1.0;
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === 'strike') {
        this._strike = Math.max(this._strike, Math.floor(this.sr * 0.01));
        this._strikeAmp = e.data.amp || 1.0;
      }
    };
  }
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const out = outputs[0];
    const outL = out[0];
    const outR = out[1] || out[0];
    const N = outL.length;
    const f0 = Math.min(4000, Math.max(10, parameters.frequency[0]));
    const structure = parameters.structure[0];
    const brightness = parameters.brightness[0];
    const damping = parameters.damping[0];
    const position = parameters.position[0];
    const stiffness = structure * 0.35;
    const decaySec = 0.05 + (1.0 - damping) * 4.0;
    const rBase = Math.exp(-1.0 / (decaySec * this.sr));
    const alpha = 0.5 + (1.0 - brightness) * 3.0;
    if (!this._w || this._w_f0 !== f0 || this._w_stiff !== stiffness || this._w_alpha !== alpha || this._w_pos !== position || this._w_rbase !== rBase) {
      this._w = new Float32Array(this.M);
      this._a1 = new Float32Array(this.M);
      this._r2 = new Float32Array(this.M);
      this._amp = new Float32Array(this.M);
      for (let m = 0; m < this.M; m++) {
        const n = m + 1;
        const ratio = n * Math.sqrt(1.0 + stiffness * n * n);
        const w = 2 * Math.PI * (f0 * ratio) / this.sr;
        const r = Math.pow(rBase, 1 + m * 0.15);
        this._w[m] = w;
        this._a1[m] = 2.0 * r * Math.cos(w);
        this._r2[m] = r * r;
        const posWeight = Math.pow(Math.sin(Math.PI * n * Math.min(0.999, Math.max(0.001, position))), 2.0);
        this._amp[m] = posWeight / Math.pow(n, alpha);
      }
      this._w_f0 = f0; this._w_stiff = stiffness; this._w_alpha = alpha; this._w_pos = position; this._w_rbase = rBase;
    }
    for (let i = 0; i < N; i++) {
      let x = 0.0;
      if (input.length > 0 && input[0].length > 0) x = input[0][i] || 0.0;
      if (this._strike > 0) {
        const env = this._strike / (this.sr * 0.01);
        x += (Math.random() * 2 - 1) * this._strikeAmp * env * 0.7;
        this._strike--;
      }
      let y = 0.0, y2 = 0.0;
      const a0 = 0.0025;
      for (let m = 0; m < this.M; m++) {
        const yk = a0 * x + this._a1[m] * this.s1[m] - this._r2[m] * this.s2[m];
        this.s2[m] = this.s1[m];
        this.s1[m] = yk;
        if ((m & 1) === 0) y += yk * this._amp[m]; else y2 += yk * this._amp[m];
      }
      outL[i] = Math.tanh(y * 2.5);
      outR[i] = Math.tanh(y2 * 2.5);
    }
    return true;
  }
}
registerProcessor('rings-resonator', RingsResonator);
`;

async function ensureRingsWorklet(ctx) {
  if (ctx.audioWorklet && !ctx._ringsModuleLoaded) {
    const blob = new Blob([RINGS_WORKLET_SRC], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);
    ctx._ringsModuleLoaded = true;
  }
}

function useSynthEngine() {
  const ref = useRef(null);
  if (!ref.current) ref.current = { started: false, ctx: null, nodes: null };
  const start = async () => {
    if (ref.current.started) return ref.current;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext({ latencyHint: "interactive" });
    const masterGain = ctx.createGain(); masterGain.gain.value = 0.5; masterGain.connect(ctx.destination);
    const mix = ctx.createGain(); mix.gain.value = 1.0;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 12000; filter.Q.value = 0.8;
    const vcaEnv = ctx.createGain(); vcaEnv.gain.value = 1.0;
    const vcaAM  = ctx.createGain(); vcaAM.gain.value = 1.0;
    const panner = ctx.createStereoPanner(); panner.pan.value = 0;
    const split  = ctx.createChannelSplitter(2);
    const leftGain  = ctx.createGain(); leftGain.gain.value = 1;
    const rightGain = ctx.createGain(); rightGain.gain.value = 1;
    const merge = ctx.createChannelMerger(2);
    mix.connect(filter);
    filter.connect(vcaEnv);
    vcaEnv.connect(vcaAM);
    vcaAM.connect(panner);
    panner.connect(split);
    split.connect(leftGain, 0);
    split.connect(rightGain, 1);
    leftGain.connect(merge, 0, 0);
    rightGain.connect(merge, 0, 1);
    const sumBus = ctx.createGain(); sumBus.gain.value = 1;
    merge.connect(sumBus);
    sumBus.connect(masterGain);
    const osc1 = ctx.createOscillator(); osc1.type = "sine"; osc1.frequency.value = 220;
    const osc2 = ctx.createOscillator(); osc2.type = "sine"; osc2.frequency.value = 330;
    const osc1Gain = ctx.createGain(); osc1Gain.gain.value = 1.0;
    const osc2Gain = ctx.createGain(); osc2Gain.gain.value = 0.0;
    osc1.connect(osc1Gain).connect(mix);
    osc2.connect(osc2Gain).connect(mix);
    const modOsc = ctx.createOscillator(); modOsc.type = "sine"; modOsc.frequency.value = 110;
    const fm1Gain = ctx.createGain(); fm1Gain.gain.value = 0;
    const fm2Gain = ctx.createGain(); fm2Gain.gain.value = 0;
    modOsc.connect(fm1Gain).connect(osc1.frequency);
    modOsc.connect(fm2Gain).connect(osc2.frequency);
    const amDepth = ctx.createGain(); amDepth.gain.value = 0;
    const amOffset = ctx.createConstantSource(); amOffset.offset.value = 1.0;
    modOsc.connect(amDepth).connect(vcaAM.gain);
    amOffset.connect(vcaAM.gain);
    const lfo = ctx.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 4;
    const lfoToVCA = ctx.createGain(); lfoToVCA.gain.value = 0;
    const lfoToCutoff = ctx.createGain(); lfoToCutoff.gain.value = 0;
    lfo.connect(lfoToVCA).connect(vcaAM.gain);
    lfo.connect(lfoToCutoff).connect(filter.frequency);
    const env = { a: 0.01, d: 0.08, s: 0.7, r: 0.2, enabled: true };
    const noteOn = () => {
      const now = ctx.currentTime;
      vcaEnv.gain.cancelScheduledValues(now);
      vcaEnv.gain.setValueAtTime(0, now);
      vcaEnv.gain.linearRampToValueAtTime(1, now + Math.max(0.001, env.a));
      vcaEnv.gain.linearRampToValueAtTime(env.s, now + Math.max(0.001, env.a) + env.d);
    };
    const noteOff = () => {
      const now = ctx.currentTime;
      vcaEnv.gain.cancelScheduledValues(now);
      const current = vcaEnv.gain.value;
      vcaEnv.gain.setValueAtTime(current, now);
      vcaEnv.gain.linearRampToValueAtTime(0, now + env.r);
    };
    const analyserScope = ctx.createAnalyser();
    analyserScope.fftSize = 2048; analyserScope.minDecibels = -100; analyserScope.maxDecibels = -20; analyserScope.smoothingTimeConstant = 0.06;
    const analyserFFT   = ctx.createAnalyser();
    analyserFFT.fftSize = 4096; analyserFFT.minDecibels = -100; analyserFFT.maxDecibels = 0; analyserFFT.smoothingTimeConstant = 0.6;
    sumBus.connect(analyserScope);
    sumBus.connect(analyserFFT);
    await ensureRingsWorklet(ctx);
    const ringsIn = ctx.createGain();
    const ringsWetGain = ctx.createGain(); ringsWetGain.gain.value = 0.0;
    const rings = new AudioWorkletNode(ctx, 'rings-resonator', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] });
    ringsIn.connect(rings);
    rings.connect(ringsWetGain);
    ringsWetGain.connect(sumBus);
    osc1.start(); osc2.start(); modOsc.start(); lfo.start(); amOffset.start();
    ref.current.started = true;
    ref.current.ctx = ctx;
    ref.current.nodes = {
      masterGain, mix, filter, vcaEnv, vcaAM, panner, split, leftGain, rightGain, merge, sumBus,
      osc1, osc2, osc1Gain, osc2Gain,
      modOsc, fm1Gain, fm2Gain, amDepth, amOffset,
      lfo, lfoToVCA, lfoToCutoff,
      env, noteOn, noteOff,
      analyserScope, analyserFFT,
      rings, ringsIn, ringsWetGain
    };
    try { if (ctx.state !== 'running') { await ctx.resume(); } } catch (e) {}
    return ref.current;
  };
  return { engine: ref.current, start };
}

function useTimeScope(analyserRef, canvasEl, cfg) {
  const rafRef = useRef(0);
  useEffect(() => {
    const canvas = canvasEl; if (!canvas) return; const ctx2d = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    function resize(){ const r = canvas.getBoundingClientRect(); canvas.width = Math.floor(r.width*dpr); canvas.height=Math.floor(r.height*dpr); ctx2d.setTransform(dpr,0,0,dpr,0,0);} resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    let lastFrame = null;
    const draw = () => {
      const an = analyserRef.current; const w = canvas.clientWidth, h = canvas.clientHeight;
      ctx2d.clearRect(0,0,w,h);
      const g=ctx2d.createLinearGradient(0,0,0,h); g.addColorStop(0,"#0b1220"); g.addColorStop(1,"#0a0f1a"); ctx2d.fillStyle=g; ctx2d.fillRect(0,0,w,h);
      if(!an){ rafRef.current=requestAnimationFrame(draw); return; }
      const N = an.fftSize; const buf = new Float32Array(N); an.getFloatTimeDomainData(buf);
      let s2=0; for(let i=0;i<N;i++){ const v=buf[i]; s2+=v*v; }
      const rms = Math.sqrt(s2/N);
      if (rms < 1e-4) { ctx2d.fillStyle="#9aa7bd"; ctx2d.font="12px system-ui, sans-serif"; ctx2d.fillText("No signal — press Start Audio and ensure Osc 1 level > 0", 10, 18); }
      if(cfg?.ac){ let s=0; for(let i=0;i<N;i++) s+=buf[i]; const m=s/N; for(let i=0;i<N;i++) buf[i]-=m; }
      const gain = cfg?.gain || 1; const lw = cfg?.lineWidth || 2; ctx2d.strokeStyle="#6ef1a6"; ctx2d.lineWidth=lw; ctx2d.globalCompositeOperation="lighter";
      const drawRolling = () => { ctx2d.beginPath(); for(let x=0;x<w;x++){ const idx=Math.floor((x/(w-1))*(N-1)); const v=buf[idx]*gain; const y=h/2 - v*(h*0.45); if(x===0) ctx2d.moveTo(0,y); else ctx2d.lineTo(x,y);} ctx2d.stroke(); };
      const drawSingle = () => {
        const rising = (cfg?.slope||"+")==="+"; const level = cfg?.triggerLevel ?? 0; let start=-1; const startSearch=Math.floor(N*0.1);
        for(let i=startSearch;i<N-1;i++){ const a=buf[i], b=buf[i+1]; if(rising? (a<level && b>=level):(a>level && b<=level)){ start=i; break; }}
        if(start<0){ if(cfg?.autoTrigger){ drawRolling(); } else if(lastFrame){ try{ctx2d.putImageData(lastFrame,0,0);}catch(e){} } return; }
        let end=-1; for(let i=start+2;i<N-1;i++){ const a=buf[i], b=buf[i+1]; if(rising? (a<level && b>=level):(a>level && b<=level)){ end=i; break; }}
        if(end<0){ const sr=48000; const f=cfg?.hintHz||220; end=Math.min(N-1, start + Math.max(32, Math.floor(sr/Math.max(1,f)))); }
        const len=Math.max(32, end-start); ctx2d.beginPath(); for(let x=0;x<w;x++){ const t=x/(w-1); const idx=start+Math.floor(t*len); const v=(buf[idx]||0)*gain; const y=h/2 - v*(h*0.45); if(x===0) ctx2d.moveTo(0,y); else ctx2d.lineTo(x,y);} ctx2d.stroke(); try{ lastFrame=ctx2d.getImageData(0,0,w, h);}catch(e){}\n      };\n      if(cfg?.mode==='rolling') drawRolling(); else drawSingle();\n      ctx2d.strokeStyle="#213047"; ctx2d.lineWidth=1; ctx2d.globalAlpha=0.6; ctx2d.beginPath(); ctx2d.moveTo(0,h/2); ctx2d.lineTo(w,h/2); ctx2d.stroke(); ctx2d.globalAlpha=1;\n      rafRef.current=requestAnimationFrame(draw);\n    };\n    rafRef.current=requestAnimationFrame(draw);\n    return ()=>{ cancelAnimationFrame(rafRef.current); ro.disconnect(); };\n  }, [analyserRef, canvasEl, cfg]);\n}\n\nfunction useSpectrum(analyserRef, canvasEl) {\n  const rafRef = useRef(0);\n  useEffect(() => {\n    const canvas = canvasEl; if (!canvas) return; const ctx = canvas.getContext(\"2d\"); const dpr=window.devicePixelRatio||1;\n    function resize(){ const r=canvas.getBoundingClientRect(); canvas.width=Math.floor(r.width*dpr); canvas.height=Math.floor(r.height*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);} resize(); const ro=new ResizeObserver(resize); ro.observe(canvas);\n    let dispMax = 0.25;\n    const draw = () => {\n      const an = analyserRef.current; const w=canvas.clientWidth, h=canvas.clientHeight; ctx.clearRect(0,0,w,h); const g=ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,\"#0b1220\"); g.addColorStop(1,\"#0a0f1a\"); ctx.fillStyle=g; ctx.fillRect(0,0,w,h);\n      if(!an){ rafRef.current=requestAnimationFrame(draw); return; }\n      const N = an.frequencyBinCount; const data = new Uint8Array(N); an.getByteFrequencyData(data);\n      const cols = Math.max(48, Math.min(N, Math.floor(w/2)));\n      const step = Math.ceil(N / cols);\n      const barW = Math.max(1, Math.floor(w / cols) - 1);\n      const bands = new Float32Array(cols);\n      let frameMax = 0;\n      for(let i=0, c=0; i<N; i+=step, c++){\n        let acc=0, n=0; for(let k=0;k<step && i+k<N;k++){ acc+=data[i+k]; n++; }\n        const v = (acc / (n*255));\n        bands[c] = v;\n        if (v > frameMax) frameMax = v;\n      }\n      if (frameMax > dispMax) dispMax = dispMax*0.85 + frameMax*0.15; else dispMax = dispMax*0.98 + frameMax*0.02;\n      const normDen = Math.max(0.05, dispMax*1.05);\n      ctx.fillStyle = \"#6ef1a6\";\n      for(let c=0, x=0; c<bands.length; c++, x+=barW+1){\n        let v = bands[c] / normDen; if (v > 1) v = 1;\n        const y = h * (1 - v);\n        ctx.fillRect(x, y, barW, h - y);\n      }\n      rafRef.current=requestAnimationFrame(draw);\n    };\n    rafRef.current=requestAnimationFrame(draw);\n    return ()=>{ cancelAnimationFrame(rafRef.current); ro.disconnect(); };\n  }, [analyserRef, canvasEl]);\n}\n\nfunction App(){\n  const [audioReady, setAudioReady] = useState(false);\n  const [tab, setTab] = useState(\"synth\");\n  const [osc1, setOsc1] = useState({ on: true, type: \"sine\", freq: 220, gain: 0.8 });\n  const [osc2, setOsc2] = useState({ on: false, type: \"sine\", freq: 330, gain: 0.8 });\n  const [mod, setMod]   = useState({ type: \"sine\", freq: 110, fm1: 0, fm2: 0, am: 0 });\n  const [lfo, setLfo]   = useState({ type: \"sine\", rate: 4, toVCA: 0, toCutoff: 0 });\n  const [filter, setFilter] = useState({ enabled: true, type: \"lowpass\", cutoff: 12000, Q: 0.8 });\n  const [env, setEnv]       = useState({ enabled: true, a: 0.01, d: 0.08, s: 0.7, r: 0.2 });\n  const [master, setMaster] = useState(0.5);\n  const [scopeCfg, setScopeCfg] = useState({ mode: \"rolling\", gain: 2.2, ac: true, triggerLevel: 0.0, slope: \"+\", autoTrigger: true, smoothing: 0.06, lineWidth: 2 });\n  const [ringsCfg, setRingsCfg] = useState({ enabled:false, external:true, mix:0.5, pitch:48, structure:0.25, brightness:0.7, damping:0.7, position:0.3, model:'modal' });\n  const { engine, start } = useSynthEngine();\n  const analyserScopeRef = useRef(null);\n  const analyserFFTRef = useRef(null);\n  const [scopeEl, setScopeEl] = useState(null);\n  const [specEl, setSpecEl] = useState(null);\n  useEffect(() => { if (!audioReady || !engine?.nodes) return; analyserScopeRef.current = engine.nodes.analyserScope; analyserFFTRef.current = engine.nodes.analyserFFT; }, [audioReady, engine]);\n  useTimeScope(analyserScopeRef, scopeEl, { ...scopeCfg, hintHz: (osc1.on?osc1.freq:(osc2.on?osc2.freq:osc1.freq)) });\n  useSpectrum(analyserFFTRef, specEl);\n  useEffect(() => {\n    if (!engine?.nodes) return; const { nodes } = engine;\n    nodes.masterGain.gain.value = master;\n    nodes.osc1.type = osc1.type; nodes.osc1.frequency.setTargetAtTime(Math.max(1, osc1.freq), nodes.osc1.context.currentTime, 0.01);\n    nodes.osc2.type = osc2.type; nodes.osc2.frequency.setTargetAtTime(Math.max(1, osc2.freq), nodes.osc2.context.currentTime, 0.01);\n    nodes.osc1Gain.gain.value = osc1.on ? osc1.gain : 0; nodes.osc2Gain.gain.value = osc2.on ? osc2.gain : 0;\n    nodes.modOsc.type = mod.type; nodes.modOsc.frequency.setTargetAtTime(Math.max(0.1, mod.freq), nodes.modOsc.context.currentTime, 0.01);\n    nodes.fm1Gain.gain.value = mod.fm1; nodes.fm2Gain.gain.value = mod.fm2; nodes.amDepth.gain.value = mod.am;\n    nodes.lfo.type = lfo.type; nodes.lfo.frequency.setTargetAtTime(Math.max(0.01, lfo.rate), nodes.lfo.context.currentTime, 0.01);\n    nodes.lfoToVCA.gain.value = lfo.toVCA; nodes.lfoToCutoff.gain.value = lfo.toCutoff;\n    if (filter.enabled) { nodes.filter.type = filter.type; nodes.filter.frequency.setTargetAtTime(Math.max(20, filter.cutoff), nodes.filter.context.currentTime, 0.02); nodes.filter.Q.setTargetAtTime(Math.max(0.0001, filter.Q), nodes.filter.context.currentTime, 0.02); }\n    else { nodes.filter.type = \"lowpass\"; nodes.filter.frequency.setTargetAtTime(20000, nodes.filter.context.currentTime, 0.02); nodes.filter.Q.setTargetAtTime(0.0001, nodes.filter.context.currentTime, 0.02); }\n    nodes.env.a = env.a; nodes.env.d = env.d; nodes.env.s = env.s; nodes.env.r = env.r; nodes.env.enabled = env.enabled; if(!env.enabled){ const now=nodes.vcaEnv.context.currentTime; nodes.vcaEnv.gain.cancelScheduledValues(now); nodes.vcaEnv.gain.setTargetAtTime(1, now, 0.01); }\n    nodes.analyserScope.smoothingTimeConstant = scopeCfg.smoothing;\n  }, [engine, master, osc1, osc2, mod, lfo, filter, env, scopeCfg.smoothing]);\n  useEffect(() => {\n    if (!engine?.nodes) return; const ns = engine.nodes; const ctx = ns.masterGain.context; const freq = 440 * Math.pow(2, (ringsCfg.pitch - 69) / 12);\n    try {\n      ns.rings.parameters.get('frequency').setTargetAtTime(freq, ctx.currentTime, 0.01);\n      ns.rings.parameters.get('structure').setValueAtTime(ringsCfg.structure, ctx.currentTime);\n      ns.rings.parameters.get('brightness').setValueAtTime(ringsCfg.brightness, ctx.currentTime);\n      ns.rings.parameters.get('damping').setValueAtTime(ringsCfg.damping, ctx.currentTime);\n      ns.rings.parameters.get('position').setValueAtTime(ringsCfg.position, ctx.currentTime);\n      ns.ringsWetGain.gain.setTargetAtTime(ringsCfg.enabled ? ringsCfg.mix : 0, ctx.currentTime, 0.02);\n      try { ns.mix.disconnect(ns.ringsIn); } catch(e) {}\n      if (ringsCfg.enabled && ringsCfg.external) { ns.mix.connect(ns.ringsIn); }\n    } catch (e) {}\n  }, [engine, ringsCfg]);\n  const strikeRings = () => { try { engine?.nodes?.rings?.port?.postMessage({ type: 'strike', amp: 1.0 }); } catch (e) {} };\n  const handleStartAudio = async () => { const e = await start(); try { if (e.ctx && e.ctx.state !== 'running') { await e.ctx.resume(); } } catch (err) {} if (e.nodes) { analyserScopeRef.current = e.nodes.analyserScope; analyserFFTRef.current = e.nodes.analyserFFT; } setAudioReady(true); if (e.nodes && env.enabled) e.nodes.noteOn(); };\n  const noteOn = () => engine?.nodes?.noteOn && engine.nodes.noteOn();\n  const noteOff = () => engine?.nodes?.noteOff && engine.nodes.noteOff();\n  return (\n    <div className=\"h-screen w-full bg-[#0a0f1a] text-gray-100 grid grid-cols-1 md:grid-cols-2\">\n      <aside className=\"h-screen overflow-y-auto border-r border-gray-800 p-4 space-y-4\">\n        <div className=\"flex items-center justify-between\">\n          <div>\n            <h1 className=\"text-lg font-semibold\">Modular Oscilloscope Synth</h1>\n            <p className=\"text-xs text-gray-400\">WebAudio · Time Scope · Spectrum · Rings</p>\n          </div>\n          {!audioReady ? (\n            <button onClick={handleStartAudio} className=\"text-xs px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600\">Start Audio</button>\n          ) : (\n            <div className=\"text-[10px] text-emerald-400\">running</div>\n          )}\n        </div>\n        <div className=\"flex gap-2 text-xs\">\n          <button onClick={()=>setTab(\"synth\")} className={`px-3 py-1 rounded border ${tab==='synth'? 'bg-gray-800 border-gray-600' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>Synth</button>\n          <button onClick={()=>setTab(\"scope\")} className={`px-3 py-1 rounded border ${tab==='scope'? 'bg-gray-800 border-gray-600' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>Scope</button>\n          <button onClick={()=>setTab(\"rings\")} className={`px-3 py-1 rounded border ${tab==='rings'? 'bg-gray-800 border-gray-600' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>Rings</button>\n        </div>\n        {tab === 'synth' && (\n          <>\n            <Section title=\"Master\">\n              <Slider label=\"Volume\" min={0} max={1} step={0.01} value={master} onChange={setMaster} format={(v)=>v.toFixed(2)} />\n              <div className=\"flex gap-2\">\n                <button onClick={noteOn} className=\"px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 hover:bg-gray-700\">Note On</button>\n                <button onClick={noteOff} className=\"px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 hover:bg-gray-700\">Note Off</button>\n              </div>\n            </Section>\n            <Section title=\"Oscillator 1\">\n              <Toggle label=\"Enabled\" checked={osc1.on} onChange={(c)=>setOsc1({...osc1, on:c})} />\n              <Select label=\"Wave\" value={osc1.type} onChange={(v)=>setOsc1({...osc1, type:v})} options={[\"sine\",\"sawtooth\",\"square\",\"triangle\"].map(w=>({value:w, label:w}))} />\n              <Slider label=\"Frequency (Hz)\" min={10} max={2000} step={0.1} value={osc1.freq} onChange={(v)=>setOsc1({...osc1, freq:v})} format={(v)=>v.toFixed(1)} />\n              <Slider label=\"Level\" min={0} max={1} step={0.01} value={osc1.gain} onChange={(v)=>setOsc1({...osc1, gain:v})} format={(v)=>v.toFixed(2)} />\n            </Section>\n            <Section title=\"Oscillator 2\">\n              <Toggle label=\"Enabled\" checked={osc2.on} onChange={(c)=>setOsc2({...osc2, on:c})} />\n              <Select label=\"Wave\" value={osc2.type} onChange={(v)=>setOsc2({...osc2, type:v})} options={[\"sine\",\"sawtooth\",\"square\",\"triangle\"].map(w=>({value:w, label:w}))} />\n              <Slider label=\"Frequency (Hz)\" min={10} max={2000} step={0.1} value={osc2.freq} onChange={(v)=>setOsc2({...osc2, freq:v})} format={(v)=>v.toFixed(1)} />\n              <Slider label=\"Level\" min={0} max={1} step={0.01} value={osc2.gain} onChange={(v)=>setOsc2({...osc2, gain:v})} format={(v)=>v.toFixed(2)} />\n            </Section>\n            <Section title=\"Modulator (audio‑rate)\">\n              <Select label=\"Wave\" value={mod.type} onChange={(v)=>setMod({...mod, type:v})} options={[\"sine\",\"sawtooth\",\"square\",\"triangle\"].map(w=>({value:w, label:w}))} />\n              <Slider label=\"Frequency (Hz)\" min={0.1} max={2000} step={0.1} value={mod.freq} onChange={(v)=>setMod({...mod, freq:v})} format={(v)=>v.toFixed(1)} />\n              <Slider label=\"FM → OSC1 (Hz)\" min={0} max={800} step={1} value={mod.fm1} onChange={(v)=>setMod({...mod, fm1:v})} />\n              <Slider label=\"FM → OSC2 (Hz)\" min={0} max={800} step={1} value={mod.fm2} onChange={(v)=>setMod({...mod, fm2:v})} />\n              <Slider label=\"AM → VCA (depth)\" min={0} max={1.5} step={0.01} value={mod.am} onChange={(v)=>setMod({...mod, am:v})} />\n            </Section>\n            <Section title=\"LFO (patchable)\">\n              <Select label=\"Wave\" value={lfo.type} onChange={(v)=>setLfo({...lfo, type:v})} options={[\"sine\",\"triangle\",\"square\"].map(w=>({value:w, label:w}))} />\n              <Slider label=\"Rate (Hz)\" min={0.05} max={20} step={0.01} value={lfo.rate} onChange={(v)=>setLfo({...lfo, rate:v})} format={(v)=>v.toFixed(2)} />\n              <Slider label=\"→ VCA (tremolo depth)\" min={0} max={1} step={0.01} value={lfo.toVCA} onChange={(v)=>setLfo({...lfo, toVCA:v})} />\n              <Slider label=\"→ Filter cutoff (Hz)\" min={0} max={4000} step={1} value={lfo.toCutoff} onChange={(v)=>setLfo({...lfo, toCutoff:v})} />\n            </Section>\n            <Section title=\"Filter\">\n              <Toggle label=\"Enabled\" checked={filter.enabled} onChange={(c)=>setFilter({...filter, enabled:c})} />\n              <Select label=\"Type\" value={filter.type} onChange={(v)=>setFilter({...filter, type:v})} options={[{value:\"lowpass\",label:\"Low‑pass\"},{value:\"highpass\",label:\"High‑pass\"},{value:\"bandpass\",label:\"Band‑pass\"}]} />\n              <Slider label=\"Cutoff (Hz)\" min={20} max={20000} step={1} value={filter.cutoff} onChange={(v)=>setFilter({...filter, cutoff:v})} format={(v)=>Math.round(v)} />\n              <Slider label=\"Q\" min={0.1} max={20} step={0.01} value={filter.Q} onChange={(v)=>setFilter({...filter, Q:v})} format={(v)=>v.toFixed(2)} />\n            </Section>\n            <Section title=\"Envelope (ADSR)\">\n              <Toggle label=\"Enabled\" checked={env.enabled} onChange={(c)=>setEnv({...env, enabled:c})} />\n              <div className=\"grid grid-cols-2 gap-2\">\n                <Slider label=\"Attack (s)\" min={0.001} max={2} step={0.001} value={env.a} onChange={(v)=>setEnv({...env, a:v})} format={(v)=>v.toFixed(3)} />\n                <Slider label=\"Decay (s)\" min={0} max={2} step={0.001} value={env.d} onChange={(v)=>setEnv({...env, d:v})} format={(v)=>v.toFixed(3)} />\n                <Slider label=\"Sustain\" min={0} max={1} step={0.01} value={env.s} onChange={(v)=>setEnv({...env, s:v})} format={(v)=>v.toFixed(2)} />\n                <Slider label=\"Release (s)\" min={0} max={3} step={0.001} value={env.r} onChange={(v)=>setEnv({...env, r:v})} format={(v)=>v.toFixed(3)} />\n              </div>\n            </Section>\n            <div className=\"text-[10px] text-gray-500\">Created by Kevin Schoenholzer with the help of ChatGPT, 2025 · For educational use only.</div>\n          </>\n        )}\n        {tab === 'scope' && (\n          <>\n            <Section title=\"Scope Display\">\n              <Select label=\"Mode\" value={scopeCfg.mode} onChange={(v)=>setScopeCfg({...scopeCfg, mode:v})} options={[{value:'single', label:'Single‑cycle'},{value:'rolling', label:'Rolling'}]} />\n              <Slider label=\"Gain (vertical)\" min={0.2} max={6} step={0.01} value={scopeCfg.gain} onChange={(v)=>setScopeCfg({...scopeCfg, gain:v})} format={(v)=>v.toFixed(2)} />\n              <Toggle label=\"AC coupling (remove DC)\" checked={scopeCfg.ac} onChange={(c)=>setScopeCfg({...scopeCfg, ac:c})} />\n            </Section>\n            <Section title=\"Trigger\">\n              <Slider label=\"Level\" min={-1} max={1} step={0.01} value={scopeCfg.triggerLevel} onChange={(v)=>setScopeCfg({...scopeCfg, triggerLevel:v})} format={(v)=>v.toFixed(2)} />\n              <Select label=\"Slope\" value={scopeCfg.slope} onChange={(v)=>setScopeCfg({...scopeCfg, slope:v})} options={[{value:'+', label:'Rising'},{value:'-', label:'Falling'}]} />\n              <Toggle label=\"Auto trigger fallback\" checked={scopeCfg.autoTrigger} onChange={(c)=>setScopeCfg({...scopeCfg, autoTrigger:c})} />\n            </Section>\n            <Section title=\"Rendering\">\n              <Slider label=\"Smoothing\" min={0} max={0.9} step={0.01} value={scopeCfg.smoothing} onChange={(v)=>setScopeCfg({...scopeCfg, smoothing:v})} format={(v)=>v.toFixed(2)} />\n              <Slider label=\"Line width\" min={1} max={4} step={0.1} value={scopeCfg.lineWidth} onChange={(v)=>setScopeCfg({...scopeCfg, lineWidth:v})} format={(v)=>v.toFixed(1)} />\n            </Section>\n            <div className=\"text-xs text-gray-400\">Tip: If the trace looks flat or jittery, increase Gain, enable AC coupling, or switch to Rolling mode.</div>\n            <div className=\"text-[10px] text-gray-500\">Created by Kevin Schoenholzer with the help of ChatGPT, 2025 · For educational use only.</div>\n          </>\n        )}\n        {tab === 'rings' && (\n          <>\n            <Section title=\"Rings (modal resonator)\">\n              <Toggle label=\"Enabled\" checked={ringsCfg.enabled} onChange={(c)=>setRingsCfg({...ringsCfg, enabled:c})} />\n              <Toggle label=\"Use external exciter (from VCO mix)\" checked={ringsCfg.external} onChange={(c)=>setRingsCfg({...ringsCfg, external:c})} />\n              <div className=\"flex gap-2\">\n                <button onClick={strikeRings} className=\"px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 hover:bg-gray-700\">Strike</button>\n              </div>\n            </Section>\n            <Section title=\"Pitch & Mix\">\n              <Slider label=\"Pitch (MIDI)\" min={24} max={96} step={1} value={ringsCfg.pitch} onChange={(v)=>setRingsCfg({...ringsCfg, pitch:v})} format={(v)=>v.toFixed(0)} />\n              <Slider label=\"Wet mix\" min={0} max={1} step={0.01} value={ringsCfg.mix} onChange={(v)=>setRingsCfg({...ringsCfg, mix:v})} format={(v)=>v.toFixed(2)} />\n            </Section>\n            <Section title=\"Resonator\">\n              <Select label=\"Model\" value={ringsCfg.model} onChange={(v)=>setRingsCfg({...ringsCfg, model:v})} options={[{value:'modal',label:'Modal (partials bank)'}]} />\n              <Slider label=\"Structure (inharmonicity)\" min={0} max={1} step={0.001} value={ringsCfg.structure} onChange={(v)=>setRingsCfg({...ringsCfg, structure:v})} format={(v)=>v.toFixed(3)} />\n              <Slider label=\"Brightness (spectral tilt)\" min={0} max={1} step={0.001} value={ringsCfg.brightness} onChange={(v)=>setRingsCfg({...ringsCfg, brightness:v})} format={(v)=>v.toFixed(3)} />\n              <Slider label=\"Damping (decay)\" min={0} max={1} step={0.001} value={ringsCfg.damping} onChange={(v)=>setRingsCfg({...ringsCfg, damping:v})} format={(v)=>v.toFixed(3)} />\n              <Slider label=\"Position (mode weighting)\" min={0} max={1} step={0.001} value={ringsCfg.position} onChange={(v)=>setRingsCfg({...ringsCfg, position:v})} format={(v)=>v.toFixed(3)} />\n            </Section>\n            <div className=\"text-[10px] text-gray-500\">Rings-inspired JS resonator (educational; not a code port).</div>\n          </>\n        )}\n      </aside>\n      <main className=\"h-screen overflow-y-auto\">\n        <div className=\"p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-[minmax(0,1fr)]\">\n          <div className=\"rounded-2xl border border-gray-800 shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden h-[30vh] md:h-[26vh] flex flex-col\">\n            <div className=\"px-3 py-2 text-xs text-gray-300 border-b border-gray-800 bg-gray-900/40\">Time Scope</div>\n            <div className=\"flex-1\"><canvas id=\"scope\" ref={setScopeEl} className=\"w-full h-full block\"/></div>\n          </div>\n          <div className=\"rounded-2xl border border-gray-800 shadow-[0_0_30px_rgba(0,0,0,0.5)] overflow-hidden h-[30vh] md:h-[26vh] flex flex-col\">\n            <div className=\"px-3 py-2 text-xs text-gray-300 border-b border-gray-800 bg-gray-900/40\">Spectrum</div>\n            <div className=\"flex-1\"><canvas id=\"spectrum\" ref={setSpecEl} className=\"w-full h-full block\"/></div>\n          </div>\n        </div>\n      </main>\n    </div>\n  );\n}\n\nReactDOM.createRoot(document.getElementById(\"root\")).render(<App/>);\n