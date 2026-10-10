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
      this.position=0; this.nextTime=0;
    }
    init() {
      if(this.ctx) return;
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
      this.ctx=ctx; this.noise=noise;
    }
    updateMix() {
      if(!this.ctx||!this.song)return;
      this.song.tracks.forEach(t=>{
        const meta=D.TRACKS.find(m=>m.id===t.id);
        const out=this.outputs[t.id];
        if(out)out.gain.setTargetAtTime(t.muted?0:(t.volume/100)*(meta?.level||.5),this.ctx.currentTime,.013);
      });
    }
    async play(song,onStep) {
      this.stop();
      this.song=song; this.onStep=onStep; this.init();
      if(this.ctx.state==='suspended')await this.ctx.resume();
      this.position=0;this.nextTime=this.ctx.currentTime+.08;
      this.playing=true;this.updateMix();this.tick();
    }
    stop() {
      this.playing=false;
      clearTimeout(this.timer);this.timer=null;
      this.drawTimers.forEach(t=>clearTimeout(t));this.drawTimers.clear();
      this.onStep?.(-1);
    }
    tick() {
      if(!this.playing||!this.song)return;
      const duration=60/this.song.bpm/4;
      while(this.nextTime<this.ctx.currentTime+.13) {
        if(this.position>=this.song.bars*16) {
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
      this.song.tracks.forEach(t=>{
        if(t.muted||t.volume<=0)return;
        const clip=t.clips.find(c=>globalStep>=c.startBar*16&&globalStep<(c.startBar+c.lengthBars)*16);
        if(!clip)return;
        const inner=(globalStep-clip.startBar*16)%(clip.patternBars*16);
        clip.notes.forEach(note=>{
          if(note.start===inner)this.trigger(t,time,stepSeconds,note);
        });
      });
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
    trigger(track,time,stepSeconds,note) {
      const ctx=this.ctx, out=this.outputs[track.id], params=track.sound.params;
      const tone=params[0]/100,decay=params[1]/100,punch=params[2]/100;
      const preset=track.sound.preset;
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