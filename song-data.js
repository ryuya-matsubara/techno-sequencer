(() => {
  'use strict';
  const KEY = 'techno-sequencer-songs-v2';
  const MIGRATION_KEY = 'techno-sequencer-library-migrated-v2';
  const OLD_KEY = 'techno-sequencer-pattern-library-v1';
  const FORMAT = 'techno-sequencer-song';
  const TRACKS = [
    { id:'kick', name:'Kick', color:'#d6ff32', type:'drum', level:.86 },
    { id:'clap', name:'Clap', color:'#e5a45c', type:'drum', level:.57 },
    { id:'closedHat', name:'Closed Hat', color:'#82c9ba', type:'drum', level:.40 },
    { id:'openHat', name:'Open Hat', color:'#61b3a9', type:'drum', level:.40 },
    { id:'perc', name:'Perc', color:'#a697e4', type:'drum', level:.48 },
    { id:'bass', name:'Bass', color:'#e77e73', type:'melody', level:.75 },
    { id:'lead', name:'Lead', color:'#83bbeb', type:'melody', level:.56 },
    { id:'fx', name:'FX', color:'#c88eaf', type:'drum', level:.48 }
  ];
  const PRESETS = {
    kick:['Deep Kick','Hard Kick','Soft Kick'],
    clap:['Classic Clap','Sharp Clap','Wide Clap'],
    closedHat:['Crisp Hat','Soft Hat','Bright Hat'],
    openHat:['Open Hat','Airy Hat','Dark Hat'],
    perc:['Tom Perc','Metal Perc','Wood Perc'],
    bass:['Deep Bass','Acid Bass','Hard Bass','Soft Bass'],
    lead:['Classic Lead','Bright Lead','Soft Lead','Pluck Lead'],
    fx:['Noise Sweep','Dark Sweep','Bright Sweep']
  };
  const PARAMETERS = {
    kick:[['Pitch','音の高さ。上げるほど高いキックになります。'],['Decay','音の響く長さ。上げるほど長く残ります。'],['Punch','音の出だしの強さ。上げるほどアタックが強くなります。']],
    clap:[['Tone','音の明るさ。上げるほどシャープになります。'],['Decay','音が消えるまでの長さです。'],['Punch','音の出だしの強さです。']],
    closedHat:[['Tone','音の明るさ。上げるほど高音が強くなります。'],['Decay','音の長さ。短いほど細かいリズム向きです。'],['Punch','音の出だしの強さです。']],
    openHat:[['Tone','音の明るさ。上げるほど高音が強くなります。'],['Decay','音が消えるまでの長さです。'],['Punch','音の出だしの強さです。']],
    perc:[['Pitch','音の高さを調整します。'],['Decay','音の響く長さを調整します。'],['Punch','音の出だしの強さです。']],
    bass:[['Tone','音の明るさ。上げるほど鋭い音になります。'],['Decay','音が小さくなるまでの長さです。'],['Punch','音の出だしの強さです。']],
    lead:[['Tone','音の明るさ。上げるほど鋭い音になります。'],['Decay','音が小さくなるまでの長さです。'],['Attack','音の立ち上がり。上げるほどゆっくり始まります。']],
    fx:[['Tone','音の明るさ。上げるほど高音が目立ちます。'],['Decay','音が消えるまでの長さです。'],['Punch','音の出だしの強さです。']]
  };
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(Number(n)) ? Number(n) : lo));
  const uid = () => globalThis.crypto?.randomUUID?.() || String(Date.now()) + '-' + Math.random().toString(36).slice(2);
  const copy = x => JSON.parse(JSON.stringify(x));
  function newTrack(meta) {
    return {id:meta.id, volume:100, muted:false, sound:{preset:PRESETS[meta.id][0], params:[50,50,50]}, clips:[]};
  }
  function createSong(name='Untitled Song') {
    return {format:FORMAT, version:2, id:uid(), name:String(name).slice(0,60), bpm:140, bars:32, tracks:TRACKS.map(newTrack), updatedAt:Date.now()};
  }
  function newClip(startBar=0,lengthBars=4,patternBars=1,notes=[]) {
    return {id:uid(),startBar,lengthBars,patternBars,notes:copy(notes)};
  }
  function readRaw() {
    try { const raw=JSON.parse(localStorage.getItem(KEY)); return Array.isArray(raw)?raw:[]; }
    catch { return []; }
  }
  function normalizeSong(obj, makeNewId=false) {
    if (!obj || obj.format!==FORMAT || obj.version!==2 || !Array.isArray(obj.tracks)) throw new Error('対応していない楽曲データです。');
    const song=createSong(typeof obj.name==='string'?obj.name:'Imported Song');
    if (!makeNewId && typeof obj.id==='string' && obj.id.length<150) song.id=obj.id;
    song.bpm=Math.round(clamp(obj.bpm,60,200));
    song.bars=[16,32,64,128].includes(obj.bars)?obj.bars:32;
    song.updatedAt=clamp(obj.updatedAt||Date.now(),0,9e15);
    TRACKS.forEach((meta,i) => {
      const src=obj.tracks.find(t=>t?.id===meta.id);
      if (!src) return;
      const dst=song.tracks[i];
      dst.volume=clamp(src.volume,0,150);
      dst.muted=Boolean(src.muted);
      const preset=src.sound?.preset;
      dst.sound.preset=PRESETS[meta.id].includes(preset)?preset:PRESETS[meta.id][0];
      dst.sound.params=Array.from({length:3},(_,j)=>clamp(src.sound?.params?.[j]??50,0,100));
      dst.clips=Array.isArray(src.clips)?src.clips.slice(0,256).map(c=>{
        if (!c || typeof c!=='object') return null;
        const patternBars=[1,2,4].includes(c.patternBars)?c.patternBars:1;
        const startBar=Math.floor(clamp(c.startBar,0,song.bars-1));
        const lengthBars=Math.floor(clamp(c.lengthBars,1,song.bars-startBar));
        const notes=Array.isArray(c.notes)?c.notes.slice(0,2048).map(n=>{
          if (!n || typeof n!=='object') return null;
          const start=Math.floor(clamp(n.start,0,patternBars*16-1));
          const duration=Math.floor(clamp(n.duration||1,1,patternBars*16-start));
          if (meta.type==='melody') {
            const pitch=typeof n.pitch==='string'?n.pitch:'C3';
            if (!/^[A-G]#?[0-7]$/.test(pitch)) return null;
            return {start,duration,pitch};
          }
          return {start,duration:1};
        }).filter(Boolean):[];
        return {id:makeNewId?uid():String(c.id||uid()),startBar,lengthBars,patternBars,notes};
      }).filter(Boolean):[];
      // Resolve conflicting imported clips deterministically.
      dst.clips.sort((a,b)=>a.startBar-b.startBar);
      dst.clips=dst.clips.filter((c,i,a)=>i===0 || c.startBar>=a[i-1].startBar+a[i-1].lengthBars);
    });
    return song;
  }
  function migrateOld() {
    if (localStorage.getItem(MIGRATION_KEY)) return;
    const songs=readRaw();
    try {
      const items=JSON.parse(localStorage.getItem(OLD_KEY)||'[]');
      if (Array.isArray(items)) for(const item of items) {
        if (!item?.state?.pattern) continue;
        const old=item.state;
        const song=createSong(String(item.name||'Imported Pattern'));
        song.bpm=Math.round(clamp(old.bpm||140,60,200));
        const count=old.stepCount===32?32:16;
        const multiplier=old.resolution===8?2:1;
        const pBars=count*multiplier/16;
        song.bars=16;
        TRACKS.forEach((meta,i)=>{
          const hits=old.pattern?.[meta.id];
          song.tracks[i].muted=Boolean(old.muted?.[meta.id]);
          if (!Array.isArray(hits)) return;
          const notes=[];
          for(let k=0;k<count;k++) if(hits[k]) {
            const start=k*multiplier;
            if(meta.type==='melody') {
              const legacyLead=['C4','D#4','G4','A#4','C5'];
              const pitch=meta.id==='bass'?String(old.bassNotes?.[k]||'C1'):legacyLead[Math.floor(k/2)%5];
              notes.push({start,duration:1,pitch});
            } else notes.push({start,duration:1});
          }
          if(notes.length) song.tracks[i].clips.push(newClip(0,pBars,pBars,notes));
        });
        songs.push(song);
      }
      localStorage.setItem(KEY,JSON.stringify(songs));
      localStorage.setItem(MIGRATION_KEY,'1');
    } catch(err) { console.warn('Legacy migration skipped',err); }
  }
  function getSongs() { migrateOld(); return readRaw(); }
  function getSong(id) { return getSongs().find(s=>s.id===id)||null; }
  function saveSong(song) {
    const clean=normalizeSong(song);
    clean.updatedAt=Date.now();
    const all=getSongs();
    const i=all.findIndex(x=>x.id===clean.id);
    if(i>=0) all[i]=clean; else all.push(clean);
    localStorage.setItem(KEY,JSON.stringify(all));
    return clean;
  }
  function removeSong(id) { localStorage.setItem(KEY,JSON.stringify(getSongs().filter(s=>s.id!==id))); }
  function exportSong(song) {
    const out=normalizeSong(song);
    const json=JSON.stringify(out,null,2);
    const blob=new Blob([json],{type:'application/json'});
    const a=document.createElement('a'); const url=URL.createObjectURL(blob);
    a.href=url; a.download=(out.name.replace(/[^a-zA-Z0-9_\-\u3040-\u30ff\u3400-\u9fff ]/g,'').trim()||'song')+'.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function importSong(file) {
    if(!file || file.size>2*1024*1024) throw new Error('JSONファイルは2MB以下にしてください。');
    let data;
    try { data=JSON.parse(await file.text()); }
    catch { throw new Error('JSONファイルを読み込めませんでした。'); }
    const song=normalizeSong(data,true);
    song.name=(song.name||'Imported Song').slice(0,60);
    return saveSong(song);
  }
  window.TechnoData={KEY,TRACKS,PRESETS,PARAMETERS,createSong,newClip,getSongs,getSong,saveSong,removeSong,exportSong,importSong,copy,clamp,uid};
})();