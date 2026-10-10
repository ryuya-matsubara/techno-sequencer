(() => {
  'use strict';
  const D=window.TechnoData;
  const midiFreq=note=>{
    const m=/^([A-G])(#?)([0-7])$/.exec(note||'');
    if(!m) return 130.81;
    const semis={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
    return 440*Math.pow(2,((Number(m[3])+1)*12+semis[m[1]]+(m[2]?1:0)-69)/12);
  };
  class TechnoAudio {
    constructor() {
      this.ctx=null; this.outputs={}; this.song=null; this.playing=false;
      this.timer=null; this.drawTimers=new Set(); this.onStep=null;
      this.position=0; this.nextTime=0; this.preview=null; this.generation=0;
      this.needsRecovery=false; this.clockWatch=null; this.onFailure=null;
      this.guitarCache=new Map();
    }
    init() {
      if(this.ctx&&this.ctx.state!=='closed') return;
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(!Ctx) throw new Error('このブラウザは音声再生に対応していません。');
      const ctx=new Ctx();
      const master=ctx.createGain(); master.gain.value=.68;
      const limiter=ctx.createDynamicsCompressor();
      limiter.threshold.value=-12; limiter.knee.value=9; limiter.ratio.value=5; limiter.attack.value=.003; limiter.release.value=.15;
      master.connect(limiter).connect(ctx.destination);
      D.TRACKS.forEach(meta=>{ const gain=ctx.createGain(); gain.connect(master);this.outputs[meta.id]=gain; });
      const noise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
      const samples=noise.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
      this.ctx=ctx; this.noise=noise; this.guitarCache.clear();
    }
    // iOS may leave a previously used AudioContext interrupted or silent
    // after the app loses focus. Rebuild on the next user-initiated Play.
    markForRecovery() {
      this.needsRecovery=true;
    }
    rebuildContext() {
      const old=this.ctx;
      this.ctx=null;this.outputs={};this.noise=null;
      if(old&&old.state!=='closed') {
        try {
          const closing=old.close();
          closing?.catch?.(()=>{});
        } catch(error) { console.warn('Unable to close previous AudioContext',error); }
      }
      this.init();
    }
    updateMix() {
      if(!this.ctx||!this.song)return;
      this.song.tracks.forEach(t=>{
        const meta=D.TRACKS.find(m=>m.id===t.id);
        const out=this.outputs[t.id];
        if(out)out.gain.setTargetAtTime(t.muted?0:(t.volume/100)*(meta?.level||.5),this.ctx.currentTime,.013);
      });
    }
    async play(song,onStep,preview=null,startStep=0) {
      this.stop();
      const generation=this.generation;
      this.song=song;this.onStep=onStep;this.preview=preview;
      // Rebuild after visibility loss or interruption; reusing an apparently
      // "running" but frozen iOS context can result in a silent Play.
      if(this.needsRecovery||this.ctx?.state==='interrupted'||this.ctx?.state==='closed')
        this.rebuildContext();
      else this.init();
      this.needsRecovery=false;

      // The resume call starts synchronously within the actual tap handler.
      // Safari also reports "interrupted", not only "suspended".
      async function resumeWithDeadline(ctx) {
        let timeout;
        try {
          await Promise.race([
            ctx.resume(),
            new Promise((_,reject)=>{
              timeout=setTimeout(()=>reject(new Error('音声を再開できません。もう一度Playを押してください。')),1800);
            })
          ]);
        } finally {
          clearTimeout(timeout);
        }
      }
      try {
        if(this.ctx.state!=='running')await resumeWithDeadline(this.ctx);
        if(generation!==this.generation)return;
        if(this.ctx.state!=='running'){
          // Safari can resolve resume() while remaining interrupted.
          this.rebuildContext();
          if(this.ctx.state!=='running')await resumeWithDeadline(this.ctx);
          if(generation!==this.generation)return;
        }
        if(this.ctx.state!=='running')
          throw new Error('音声が開始できません。もう一度Playを押してください。');
      } catch(err) {
        this.needsRecovery=true;
        throw err;
      }

      const steps=(preview?D.PATTERN_BARS:song.bars)*16;
      this.position=Math.max(0,Math.min(steps-1,Math.floor(Number(startStep)||0)));
      this.nextTime=this.ctx.currentTime+.06;
      this.playing=true;this.updateMix();this.tick();
      // Some iOS Web Audio contexts report "running" while their clock is
      // frozen after an interruption. Detect that rather than showing Play
      // indefinitely with no sound; rebuild on the user's next tap.
      const ctx=this.ctx, startedAt=ctx.currentTime;
      this.clockWatch=setTimeout(()=>{
        this.clockWatch=null;
        if(generation!==this.generation||!this.playing||this.ctx!==ctx)return;
        if(ctx.currentTime-startedAt<0.08){
          this.stop();
          this.needsRecovery=true;
          this.onFailure?.('音声が中断されました。もう一度Playを押してください。');
        }
      },900);
    }
    stop() {
      this.generation++;
      this.playing=false;
      clearTimeout(this.timer);this.timer=null;
      clearTimeout(this.clockWatch);this.clockWatch=null;
      this.drawTimers.forEach(t=>clearTimeout(t));this.drawTimers.clear();
      this.onStep?.(-1);
    }
    tick() {
      if(!this.playing||!this.song)return;
      const duration=60/this.song.bpm/4;
      while(this.nextTime<this.ctx.currentTime+.13) {
        if(this.position>=(this.preview?D.PATTERN_BARS:this.song.bars)*16) {
          this.position=0;
        }
        const step=this.position;
        this.schedule(step,this.nextTime,duration);
        this.position++;
        this.nextTime+=duration;
      }
      this.timer=setTimeout(()=>this.tick(),24);
    }
    schedule(globalStep,time,stepSeconds) {
      if(this.preview){
        // Pattern mode auditions only the selected clip for exactly four bars.
        const track=this.song.tracks.find(t=>t.id===this.preview.trackId);
        const clip=track?.clips.find(c=>c.id===this.preview.clipId);
        if(track&&clip&&!track.muted&&track.volume>0){
          clip.notes.forEach(note=>{
            if(note.start===globalStep)this.trigger(track,time,stepSeconds,note);
          });
        }
      } else {
        this.song.tracks.forEach(t=>{
          if(t.muted||t.volume<=0)return;
          const clip=t.clips.find(c=>globalStep>=c.startBar*16&&globalStep<(c.startBar+c.lengthBars)*16);
          if(!clip)return;
          const inner=(globalStep-clip.startBar*16)%(D.PATTERN_BARS*16);
          clip.notes.forEach(note=>{
            if(note.start===inner)this.trigger(t,time,stepSeconds,note);
          });
        });
      }
      const timer=setTimeout(()=>{
        this.drawTimers.delete(timer);
        if(this.playing)this.onStep?.(globalStep);
      },Math.max(0,(time-this.ctx.currentTime)*1000));
      this.drawTimers.add(timer);
    }
    env(gain,time,level,length,attack=.003) {
      const peak=Math.max(.0001,level),end=time+Math.max(attack+.014,length);
      gain.gain.setValueAtTime(.0001,time);
      gain.gain.exponentialRampToValueAtTime(peak,time+Math.max(.002,attack));
      gain.gain.exponentialRampToValueAtTime(.0001,end);
    }
    osc(type,freq,start,end,gain,target,level,filter) {
      const o=this.ctx.createOscillator();
      o.type=type;o.frequency.setValueAtTime(Math.max(1,freq),start);
      if(filter)o.connect(filter).connect(gain);else o.connect(gain);
      gain.connect(target);o.start(start);o.stop(end);
      return o;
    }
    noiseHit(time,length,volume,cutoff,kind,target) {
      const ctx=this.ctx, src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
      src.buffer=this.noise; f.type=kind;f.frequency.value=cutoff;
      this.env(g,time,Math.max(.0001,volume),length);
      src.connect(f).connect(g).connect(target);
      src.start(time);src.stop(time+length+.03);
    }
    // A lightweight, offline plucked-string model (Karplus–Strong).
    // All waveforms are generated locally; no external samples or APIs.
    guitarWave(pitch,params) {
      const ctx=this.ctx;
      const sampleRate=ctx.sampleRate;
      const frequency=Math.max(30,Math.min(2400,midiFreq(pitch)));
      const [brightness,decay,pick]=params;
      const key=[sampleRate,pitch,brightness,decay,pick].join(':');
      if(this.guitarCache.has(key))return this.guitarCache.get(key);

      const buffer=ctx.createBuffer(1,Math.ceil(sampleRate*3),sampleRate);
      const values=buffer.getChannelData(0);
      const period=Math.max(12,Math.round(sampleRate/frequency));
      const string=new Float32Array(period);
      // A reproducible, gently smoothed pluck excitation prevents clicks.
      let seed=2166136261;
      for(const ch of key)seed=Math.imul(seed^ch.charCodeAt(0),16777619)>>>0;
      let average=0;
      const pickSmooth=.16+(1-brightness/100)*.55;
      let prior=0;
      for(let i=0;i<period;i++){
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        const noise=seed/2147483648-1;
        const excited=noise*(1-pickSmooth)+prior*pickSmooth;
        string[i]=excited;
        average+=excited;
        prior=excited;
      }
      average/=period;
      for(let i=0;i<period;i++)string[i]-=average;
      // Higher decay setting means a longer sustain. Feedback is frequency
      // compensated so bass strings do not disappear prematurely.
      const sustain=1.0+decay/100*3.3;
      const feedback=Math.exp(-4/(frequency*sustain));
      const damping=.47+(1-brightness/100)*.20;
      let cursor=0;
      for(let i=0;i<values.length;i++){
        const current=string[cursor];
        const next=string[cursor+1===period?0:cursor+1];
        values[i]=current;
        string[cursor]=(current*(1-damping)+next*damping)*feedback;
        cursor=cursor+1===period?0:cursor+1;
      }
      // At most 30 cached pitch/tone buffers (around 16 MB on iPhone).
      if(this.guitarCache.size>=30)
        this.guitarCache.delete(this.guitarCache.keys().next().value);
      this.guitarCache.set(key,buffer);
      return buffer;
    }
    pluckGuitar(track,time,stepSeconds,note){
      const ctx=this.ctx, tone=track.sound.params[0]/100;
      const pick=track.sound.params[2]/100;
      const buffer=this.guitarWave(note.pitch,track.sound.params);
      const source=ctx.createBufferSource();
      source.buffer=buffer;

      const lowpass=ctx.createBiquadFilter();
      lowpass.type='lowpass';
      lowpass.frequency.setValueAtTime(1600+tone*9300,time);
      const body=ctx.createBiquadFilter();
      body.type='peaking';body.frequency.value=205;
      body.Q.value=.8;body.gain.value=3;
      const amplitude=ctx.createGain();
      const duration=Math.max(.11,Math.min(2.65,(note.duration||1)*stepSeconds));
      const release=Math.min(2.95,duration+.20+track.sound.params[1]/100*.22);
      const peak=(track.id==='bass'?.87:.69)*(.75+.45*pick);
      amplitude.gain.setValueAtTime(.0001,time);
      amplitude.gain.exponentialRampToValueAtTime(Math.max(.01,peak),time+.003);
      amplitude.gain.exponentialRampToValueAtTime(.0001,time+release);
      source.connect(lowpass).connect(body).connect(amplitude).connect(this.outputs[track.id]);
      source.start(time);
      source.stop(time+release+.015);
    }
    trigger(track,time,stepSeconds,note) {
      const ctx=this.ctx, out=this.outputs[track.id], params=track.sound.params;
      const tone=params[0]/100,decay=params[1]/100,punch=params[2]/100;
      const preset=track.sound.preset;
      if(preset==='Acoustic Guitar'&&(track.id==='bass'||track.id==='lead')){
        this.pluckGuitar(track,time,stepSeconds,note);
        return;
      }
      const lengthSteps=Math.max(1,note.duration||1);
      const noteSeconds=lengthSteps*stepSeconds;
      const gain=ctx.createGain(),filter=ctx.createBiquadFilter();
      switch(track.id) {
        case 'kick': {
          const end=.18+decay*.48;
          const osc=this.osc('sine',110+tone*100,time,time+end+.03,gain,out,.8);
          osc.frequency.exponentialRampToValueAtTime(preset==='Hard Kick'?37:45,time+.07);
          this.env(gain,time,.7+punch*.36,end,.002);
          if(punch>.15){
            const click=ctx.createGain(),o=this.osc('triangle',580+punch*630,time,time+.035,click,out,.1);
            o.frequency.exponentialRampToValueAtTime(95,time+.02);
            this.env(click,time,punch*.24,.025,.002);
          }
          return;
        }
        case 'clap': {
          const sharp=preset==='Sharp Clap',wide=preset==='Wide Clap';
          const len=(.06+decay*.24)*(sharp?.62:wide?1.3:1);
          const bursts=sharp?[0,.01]:wide?[0,.014,.028,.055]:[0,.013,.027];
          bursts.forEach((offset,i)=>this.noiseHit(time+offset,len*(i? .7:1),(.35+punch*.26)*(1-i*.14),700+tone*4800+(sharp?1400:wide?-250:0),'bandpass',out));
          return;
        }
        case 'closedHat':
        case 'openHat': {
          const opened=track.id==='openHat';
          const soft=preset==='Soft Hat'||preset==='Dark Hat';
          const bright=preset==='Bright Hat'||preset==='Airy Hat';
          const len=(opened ? (.12+decay*.65) : (.025+decay*.16))*(soft?1.18:bright?.85:1);
          const cutoff=(2400+tone*8500)*(soft?.65:bright?1.25:1);
          this.noiseHit(time,len,.25+punch*.21,Math.min(14000,cutoff),'highpass',out);
          return;
        }
        case 'perc': {
          const end=.05+decay*.28;
          const osc=this.osc(preset==='Metal Perc'?'square':preset==='Wood Perc'?'sine':'triangle',130+tone*380,time,time+end+.02,gain,out,.7);
          osc.frequency.exponentialRampToValueAtTime(75+tone*90,time+.09);
          this.env(gain,time,.4+punch*.32,end);
          return;
        }
        case 'bass': {
          const len=Math.max(.07,Math.min(noteSeconds*.96,.12+decay*Math.max(.15,noteSeconds)));
          const wave=preset==='Deep Bass'||preset==='Soft Bass'?'triangle':preset==='Hard Bass'?'square':'sawtooth';
          filter.type='lowpass';filter.Q.value=preset==='Acid Bass'?9:2;
          const cutoff=140+tone*4000;
          filter.frequency.setValueAtTime(Math.min(12000,cutoff*1.6),time);
          filter.frequency.exponentialRampToValueAtTime(Math.max(80,cutoff*.45),time+Math.min(len,.22));
          this.osc(wave,midiFreq(note.pitch),time,time+len+.03,gain,out,.6,filter);
          this.env(gain,time,.28+punch*.26,len,.006);
          return;
        }
        case 'lead': {
          const len=Math.max(.08,Math.min(noteSeconds*.97,.10+decay*Math.max(.15,noteSeconds)));
          const wave=preset==='Soft Lead'?'sine':preset==='Bright Lead'?'sawtooth':preset==='Pluck Lead'?'triangle':'square';
          filter.type='lowpass';filter.Q.value=2;filter.frequency.value=350+tone*6800;
          this.osc(wave,midiFreq(note.pitch),time,time+len+.03,gain,out,.6,filter);
          const attack=.003+punch*.09;
          this.env(gain,time,.14+tone*.12,len,Math.min(attack,len*.5));
          return;
        }
        case 'fx': {
          const len=.2+decay*.9;
          const src=ctx.createBufferSource();
          filter.type='bandpass';filter.Q.value=1.6;
          const startF=preset==='Dark Sweep'?90:preset==='Bright Sweep'?600:220+tone*400;
          filter.frequency.setValueAtTime(startF,time);
          filter.frequency.exponentialRampToValueAtTime((preset==='Bright Sweep'?3500:1300)+tone*8500,time+len*.9);
          src.buffer=this.noise;
          this.env(gain,time,.09+punch*.17,len,Math.min(.02+decay*.09,len*.4));
          src.connect(filter).connect(gain).connect(out);
          src.start(time);src.stop(time+len+.03);
        }
      }
    }
  }
  window.TechnoAudio=TechnoAudio;
})();