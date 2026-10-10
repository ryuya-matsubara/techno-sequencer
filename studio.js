(() => {
  'use strict';
  const D=window.TechnoData, tracks=D.TRACKS, $=s=>document.querySelector(s), BAR=38;
  const id=new URLSearchParams(location.search).get('id');
  let song=D.getSong(id);
  if(!song){location.replace('./');return;}
  const audio=new window.TechnoAudio();
  let selected=null, menuSelection=null, noteDuration=1, tab='song', currentBar=-1;
  const el={
    rename:$('#renameSong'),save:$('#saveBtn'),play:$('#playBtn'),stop:$('#stopBtn'),
    bpm:$('#bpm'),position:$('#position'),status:$('#status'),bars:$('#songBars'),
    timeline:$('#timeline'),tabs:[...document.querySelectorAll('.tabs button')],
    patternTitle:$('#patternTitle'),patternSub:$('#patternSub'),patternGrid:$('#patternGrid'),
    patternBars:$('#patternBars'),noteLength:$('#noteLength'),noteLengthLabel:$('#noteLengthLabel'),
    mixer:$('#mixerRows'),soundTrack:$('#soundTrack'),soundEditor:$('#soundEditor'),
    menu:$('#clipMenu'),menuTitle:$('#clipMenuTitle'),menuLength:$('#menuLength')
  };
  function message(txt){el.status.textContent=txt;}
  function save(){
    try{song=D.saveSong(song);if(audio.playing){audio.song=song;audio.updateMix();}}
    catch(e){message('保存失敗: '+e.message);}
  }
  function findSelection(ref=selected){
    if(!ref)return null;
    const track=song.tracks.find(t=>t.id===ref.track);
    const clip=track?.clips.find(c=>c.id===ref.clip);
    return clip?{track,clip,meta:tracks.find(m=>m.id===ref.track)}:null;
  }
  function switchTab(target){
    tab=target;
    el.tabs.forEach(b=>b.classList.toggle('selected',b.dataset.tab===target));
    ['song','pattern','mixer','sound'].forEach(t=>{
      $('#'+t+'Panel').hidden=t!==target;
    });
    if(target==='pattern')renderPattern();
    if(target==='mixer')renderMixer();
    if(target==='sound')renderSound();
  }
  function updateHeader(){
    el.rename.firstChild.textContent=song.name+' ';
    el.bpm.value=song.bpm;
    el.bars.value=song.bars;
    el.position.textContent=(currentBar<0?1:currentBar+1)+' / '+song.bars;
  }
  function renderTimeline(){
    el.timeline.replaceChildren();
    el.timeline.style.setProperty('--bar',BAR+'px');
    const row=document.createElement('div');row.className='timeline-header';
    const corner=document.createElement('div');corner.className='timeline-corner';corner.textContent='TRACK / BAR';
    const ruler=document.createElement('div');ruler.className='timeline-ruler';ruler.style.width=(song.bars*BAR)+'px';
    for(let b=0;b<song.bars;b+=4){
      const m=document.createElement('span');m.className='bar-marker';m.style.left=(b*BAR)+'px';m.textContent=String(b+1);
      ruler.append(m);
    }
    row.append(corner,ruler);el.timeline.append(row);
    tracks.forEach(meta=>{
      const t=song.tracks.find(s=>s.id===meta.id);
      const wrapper=document.createElement('div');wrapper.className='timeline-row';wrapper.dataset.track=meta.id;
      const label=document.createElement('div');label.className='track-label';
      label.style.borderLeft='3px solid '+meta.color;label.textContent=meta.name;
      const lane=document.createElement('div');lane.className='lane';lane.style.width=(song.bars*BAR)+'px';
      lane.setAttribute('aria-label',meta.name+' 空白部分をタップするとクリップを追加');
      lane.addEventListener('click',e=>{
        if(e.target!==lane)return;
        const rect=lane.getBoundingClientRect();
        const bar=Math.floor((e.clientX-rect.left)/BAR);
        if(bar>=0&&bar<song.bars)addClip(meta.id,bar);
      });
      t.clips.forEach(clip=>{
        const btn=document.createElement('button');btn.type='button';
        btn.className='clip';btn.style.background=meta.color;
        btn.style.left=(clip.startBar*BAR+1)+'px';
        btn.style.width=(clip.lengthBars*BAR-3)+'px';
        btn.textContent=meta.name+' · '+clip.patternBars+'B';
        btn.title=meta.name+' '+(clip.startBar+1)+'〜'+(clip.startBar+clip.lengthBars)+'小節';
        btn.dataset.start=clip.startBar;btn.dataset.end=clip.startBar+clip.lengthBars;
        btn.dataset.track=meta.id;btn.dataset.clip=clip.id;
        btn.classList.toggle('is-now',currentBar>=clip.startBar&&currentBar<clip.startBar+clip.lengthBars);
        let timer=null,pressed=false,x=0,y=0;
        const cancel=()=>{clearTimeout(timer);timer=null;};
        btn.addEventListener('pointerdown',e=>{
          x=e.clientX;y=e.clientY;pressed=false;
          cancel();
          timer=setTimeout(()=>{pressed=true;openMenu(meta.id,clip.id);},520);
        });
        btn.addEventListener('pointermove',e=>{if(Math.hypot(e.clientX-x,e.clientY-y)>12)cancel();});
        btn.addEventListener('pointercancel',cancel);
        btn.addEventListener('pointerup',cancel);
        btn.addEventListener('pointerleave',cancel);
        btn.addEventListener('contextmenu',e=>{e.preventDefault();cancel();pressed=true;openMenu(meta.id,clip.id);});
        btn.addEventListener('click',e=>{
          e.stopPropagation();if(pressed){pressed=false;return;}openEditor(meta.id,clip.id);
        });
        lane.append(btn);
      });
      wrapper.append(label,lane);el.timeline.append(wrapper);
    });
  }
  function collision(track,start,length,excludeId){
    return track.clips.some(c=>c.id!==excludeId&&start<c.startBar+c.lengthBars&&start+length>c.startBar);
  }
  function addClip(trackId,start){
    const track=song.tracks.find(t=>t.id===trackId);
    if(collision(track,start,1)){message('既存クリップと重なります。');return;}
    let length=Math.min(4,song.bars-start);
    while(length>1&&collision(track,start,length))length--;
    const clip=D.newClip(start,length,1,[]);
    track.clips.push(clip);save();renderTimeline();openEditor(trackId,clip.id);
    message('クリップを追加しました。');
  }
  function openEditor(trackId,clipId){
    selected={track:trackId,clip:clipId};
    switchTab('pattern');
  }
  function openMenu(trackId,clipId){
    menuSelection={track:trackId,clip:clipId};
    const r=findSelection(menuSelection);if(!r)return;
    el.menuTitle.textContent=r.meta.name+' · Bars '+(r.clip.startBar+1)+'–'+(r.clip.startBar+r.clip.lengthBars);
    el.menuLength.value=String(r.clip.lengthBars);
    if(![...el.menuLength.options].some(o=>o.value===el.menuLength.value)){
      const option=document.createElement('option');option.value=String(r.clip.lengthBars);option.textContent=r.clip.lengthBars+' bars';el.menuLength.append(option);el.menuLength.value=option.value;
    }
    if(!el.menu.open)el.menu.showModal();
  }
  function closeMenu(){if(el.menu.open)el.menu.close();}
  function changeClipPosition(delta){
    const r=findSelection(menuSelection);if(!r)return;
    const start=r.clip.startBar+delta;
    if(start<0||start+r.clip.lengthBars>song.bars||collision(r.track,start,r.clip.lengthBars,r.clip.id)){
      message('移動できません。ほかのクリップとの重なりを確認してください。');return;
    }
    r.clip.startBar=start;save();renderTimeline();openMenu(r.track.id,r.clip.id);
    message('クリップを移動しました。');
  }
  function duplicateClip(){
    const r=findSelection(menuSelection);if(!r)return;
    const len=r.clip.lengthBars;
    let start=-1;
    for(let b=r.clip.startBar+len;b+len<=song.bars;b++)if(!collision(r.track,b,len)){start=b;break;}
    if(start<0)for(let b=0;b+len<=song.bars;b++)if(!collision(r.track,b,len)){start=b;break;}
    if(start<0){message('複製するための空きがありません。');return;}
    const clone=D.newClip(start,len,r.clip.patternBars,r.clip.notes);
    r.track.clips.push(clone);save();renderTimeline();closeMenu();message('独立したクリップを複製しました。');
  }
  function changeClipLength(value){
    const r=findSelection(menuSelection);if(!r)return;
    const length=Number(value);
    if(r.clip.startBar+length>song.bars||collision(r.track,r.clip.startBar,length,r.clip.id)){
      message('この長さには変更できません。');el.menuLength.value=String(r.clip.lengthBars);return;
    }
    r.clip.lengthBars=length;save();renderTimeline();closeMenu();message('クリップの長さを変更しました。');
  }
  function renderPattern(preserveScroll=false){
    const oldScroll=el.patternGrid.querySelector('.piano-scroll');
    const left=preserveScroll?(oldScroll?.scrollLeft||0):0,top=preserveScroll?(oldScroll?.scrollTop||0):0;
    el.patternGrid.replaceChildren();
    const r=findSelection();
    if(!r){
      el.patternTitle.textContent='Pattern Editor';el.patternSub.textContent='SONGでクリップをタップして選択してください。';
      $('#patternControls').hidden=true;return;
    }
    $('#patternControls').hidden=false;
    el.patternTitle.textContent=r.meta.name+' — Pattern';
    el.patternSub.textContent='Bars '+(r.clip.startBar+1)+'–'+(r.clip.startBar+r.clip.lengthBars)+' · '+r.clip.patternBars+'小節の演奏を繰り返します';
    el.patternBars.value=String(r.clip.patternBars);
    el.noteLengthLabel.style.display=r.meta.type==='melody'?'grid':'none';
    if(r.meta.type==='drum')renderDrums(r);
    else renderPiano(r);
    const newScroll=el.patternGrid.querySelector('.piano-scroll');
    if(newScroll){newScroll.scrollLeft=left;newScroll.scrollTop=top;}
    $('#patternHint').textContent=r.meta.type==='melody'
      ?'音の高さは縦、時間は横。音の長さを選んでマスをタップすると追加、同じマスを再タップすると削除できます。'
      :'黄色のステップで音が鳴ります。タップしてON/OFFを切り替えます。';
  }
  function toggleDrum(step){
    const r=findSelection();if(!r)return;
    const idx=r.clip.notes.findIndex(n=>n.start===step);
    if(idx>=0)r.clip.notes.splice(idx,1);
    else r.clip.notes.push({start,duration:1});
    save();renderPattern();
  }
  function renderDrums(r){
    const grid=document.createElement('div');grid.className='drum-grid';
    for(let step=0;step<r.clip.patternBars*16;step++){
      if(step%16===0){
        const label=document.createElement('div');label.className='bar-divider';label.textContent='BAR '+(Math.floor(step/16)+1);grid.append(label);
      }
      const active=r.clip.notes.some(n=>n.start===step);
      const b=document.createElement('button');b.type='button';
      b.className='drum-cell'+(step%4===0?' beat':'')+(active?' on':'');
      b.dataset.step=step;b.textContent=String(step%16+1);
      b.setAttribute('aria-pressed',String(active));
      b.addEventListener('click',()=>toggleDrum(step));
      grid.append(b);
    }
    el.patternGrid.append(grid);
  }
  function pitches(trackId){
    const min=trackId==='bass'?1:3,max=trackId==='bass'?3:5;
    const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const all=[];
    for(let o=min;o<=max;o++)names.forEach(n=>all.push(n+o));
    return all.reverse();
  }
  function toggleNote(step,pitch){
    const r=findSelection();if(!r)return;
    const notes=r.clip.notes;
    const exact=notes.findIndex(n=>n.start===step&&n.pitch===pitch);
    if(exact>=0)notes.splice(exact,1);
    else {
      const duration=Math.min(noteDuration,r.clip.patternBars*16-step);
      if(r.track.id==='bass'){
        // Bass plays only one note at a time.
        for(let i=notes.length-1;i>=0;i--){
          const n=notes[i];if(n.start<step+duration&&step<n.start+n.duration)notes.splice(i,1);
        }
      } else {
        for(let i=notes.length-1;i>=0;i--){
          const n=notes[i];if(n.pitch===pitch&&n.start<step+duration&&step<n.start+n.duration)notes.splice(i,1);
        }
      }
      notes.push({start:step,duration,pitch});
    }
    notes.sort((a,b)=>a.start-b.start);
    save();renderPattern(true);
  }
  function renderPiano(r){
    const scroll=document.createElement('div');scroll.className='piano-scroll';
    const total=r.clip.patternBars*16;
    const ruler=document.createElement('div');ruler.className='piano-ruler';
    const corner=document.createElement('div');corner.className='piano-key';corner.textContent='NOTE';ruler.append(corner);
    for(let step=0;step<total;step++){
      const cell=document.createElement('div');cell.className='piano-cell';
      if(step%4===0)cell.classList.add('beat');
      cell.textContent=step%16===0?'B'+(Math.floor(step/16)+1):step%4===0?String(step%16/4+1):'';
      ruler.append(cell);
    }
    scroll.append(ruler);
    pitches(r.track.id).forEach(pitch=>{
      const row=document.createElement('div');row.className='piano-row';
      const key=document.createElement('div');key.className='piano-key'+(pitch.includes('#')?' black':'');
      key.textContent=pitch;row.append(key);
      for(let step=0;step<total;step++){
        const matching=r.clip.notes.find(n=>n.pitch===pitch&&step>=n.start&&step<n.start+n.duration);
        const cell=document.createElement('button');cell.type='button';
        cell.className='piano-cell'+(step%4===0?' beat':'')+(matching?(matching.start===step?' on':' tail'):'');
        cell.dataset.step=step;
        cell.title=pitch+' · Step '+(step+1);
        cell.setAttribute('aria-label',pitch+' step '+(step+1));
        cell.addEventListener('click',()=>toggleNote(matching?matching.start:step,pitch));
        row.append(cell);
      }
      scroll.append(row);
    });
    el.patternGrid.append(scroll);
    const hint=document.createElement('p');hint.className='piano-note-help';
    hint.textContent=r.track.id==='bass'?'Bassは同時に1音だけ鳴ります。':'Leadは複数音を同時に重ねられます。';
    el.patternGrid.append(hint);
  }
  function renderMixer(){
    el.mixer.replaceChildren();
    tracks.forEach(meta=>{
      const t=song.tracks.find(x=>x.id===meta.id);
      const card=document.createElement('div');card.className='mixer-card';
      const top=document.createElement('div');top.className='mixer-title';
      const title=document.createElement('span');title.className='mixer-name';
      const dot=document.createElement('span');dot.className='track-dot';dot.style.background=meta.color;
      title.append(dot,document.createTextNode(meta.name));
      const mute=document.createElement('button');mute.type='button';mute.className='mute-btn'+(t.muted?' active':'');
      mute.textContent=t.muted?'Muted':'Mute';
      mute.addEventListener('click',()=>{t.muted=!t.muted;save();renderMixer();});
      top.append(title,mute);
      const range=document.createElement('input');range.type='range';range.min=0;range.max=150;range.step=1;range.value=t.volume;
      range.setAttribute('aria-label',meta.name+' 音量');
      const value=document.createElement('span');value.textContent=t.volume+'%';
      const bottom=document.createElement('div');bottom.className='slider-title';bottom.append(range,value);
      range.addEventListener('input',()=>{t.volume=Number(range.value);value.textContent=range.value+'%';save();});
      card.append(top,bottom);el.mixer.append(card);
    });
  }
  function renderSound(){
    const previous=el.soundTrack.value || 'bass';
    el.soundTrack.replaceChildren();
    tracks.forEach(meta=>{
      const option=document.createElement('option');option.value=meta.id;option.textContent=meta.name;el.soundTrack.append(option);
    });
    el.soundTrack.value=tracks.some(m=>m.id===previous)?previous:'bass';
    renderSoundSettings();
  }
  const profile={
    'Deep Bass':[35,65,35],'Acid Bass':[85,40,80],'Hard Bass':[90,30,85],'Soft Bass':[25,75,20],
    'Deep Kick':[30,75,65],'Hard Kick':[65,35,90],'Soft Kick':[30,45,25],
    'Classic Lead':[60,40,20],'Bright Lead':[90,45,15],'Soft Lead':[30,75,65],'Pluck Lead':[75,25,5]
  };
  function renderSoundSettings(){
    const meta=tracks.find(t=>t.id===el.soundTrack.value)||tracks[0];
    const track=song.tracks.find(t=>t.id===meta.id);
    el.soundEditor.replaceChildren();
    const presetBox=document.createElement('div');presetBox.className='sound-box';
    const heading=document.createElement('label');heading.textContent='Sound Preset';
    const select=document.createElement('select');
    D.PRESETS[meta.id].forEach(name=>{
      const option=document.createElement('option');option.value=name;option.textContent=name;select.append(option);
    });
    select.value=track.sound.preset;
    select.addEventListener('change',()=>{
      track.sound.preset=select.value;
      track.sound.params=[...(profile[select.value]||[50,50,50])];
      save();renderSoundSettings();
    });
    presetBox.append(heading,select);el.soundEditor.append(presetBox);
    const paramBox=document.createElement('div');paramBox.className='sound-box';
    D.PARAMETERS[meta.id].forEach(([name,description],i)=>{
      const wrap=document.createElement('div');wrap.className='sound-param';
      const top=document.createElement('div');top.className='slider-title';
      const nameNode=document.createElement('span');nameNode.textContent=name;
      const val=document.createElement('span');val.textContent=track.sound.params[i]+'%';
      top.append(nameNode,val);
      const desc=document.createElement('p');desc.textContent=description;
      const slider=document.createElement('input');slider.type='range';slider.min=0;slider.max=100;slider.step=1;
      slider.value=track.sound.params[i];slider.setAttribute('aria-label',meta.name+' '+name);
      slider.addEventListener('input',()=>{track.sound.params[i]=Number(slider.value);val.textContent=slider.value+'%';save();});
      wrap.append(top,desc,slider);paramBox.append(wrap);
    });
    el.soundEditor.append(paramBox);
    const audition=document.createElement('button');audition.type='button';audition.textContent='▶ Preview Sound';
    audition.addEventListener('click',async()=>{
      try{
        audio.song=song;audio.init();
        if(audio.ctx.state==='suspended')await audio.ctx.resume();
        audio.updateMix();
        audio.trigger(track,audio.ctx.currentTime+.03,60/song.bpm/4,meta.type==='melody'?{pitch:meta.id==='bass'?'C2':'C4',duration:4}:{duration:1});
      }catch(e){message('再生エラー: '+e.message);}
    });
    el.soundEditor.append(audition);
  }
  function starter(){
    if(song.tracks.some(t=>t.clips.length)&&!confirm('現在のクリップをサンプルビートに置き換えますか？'))return;
    song.tracks.forEach(t=>t.clips=[]);
    const add=(id,start,len,notes)=>song.tracks.find(t=>t.id===id).clips.push(D.newClip(start,len,1,notes));
    const hits=a=>a.map(start=>({start,duration:1}));
    add('kick',0,song.bars,hits([0,4,8,12]));
    add('closedHat',0,song.bars,hits([2,6,10,14]));
    if(song.bars>8){
      add('clap',8,song.bars-8,hits([4,12]));
      add('bass',8,song.bars-8,[{start:0,duration:2,pitch:'C2'},{start:3,duration:1,pitch:'C2'},{start:6,duration:2,pitch:'D#2'},{start:10,duration:2,pitch:'G2'},{start:14,duration:2,pitch:'D#2'}]);
    }
    if(song.bars>16){
      add('lead',16,song.bars-16,[{start:0,duration:2,pitch:'C4'},{start:4,duration:2,pitch:'D#4'},{start:8,duration:2,pitch:'G4'},{start:12,duration:2,pitch:'A#4'}]);
    }
    save();renderTimeline();message('スタータービートを追加しました。');
  }
  function onProgress(step){
    currentBar=step<0?-1:Math.floor(step/16);
    el.position.textContent=(currentBar<0?1:currentBar+1)+' / '+song.bars;
    document.querySelectorAll('.clip').forEach(c=>c.classList.toggle('is-now',currentBar>=Number(c.dataset.start)&&currentBar<Number(c.dataset.end)));
    document.querySelectorAll('.drum-cell.playing,.piano-cell.playing').forEach(c=>c.classList.remove('playing'));
    if(step<0)return;
    const r=findSelection();
    if(r&&step>=r.clip.startBar*16&&step<(r.clip.startBar+r.clip.lengthBars)*16){
      const s=(step-r.clip.startBar*16)%(r.clip.patternBars*16);
      document.querySelectorAll('[data-step="'+s+'"]').forEach(c=>c.classList.add('playing'));
    }
  }
  el.tabs.forEach(button=>button.addEventListener('click',()=>switchTab(button.dataset.tab)));
  $('#backToSong').addEventListener('click',()=>switchTab('song'));
  el.rename.addEventListener('click',()=>{
    const name=prompt('曲名',song.name);
    if(name?.trim()){song.name=name.trim().slice(0,60);save();updateHeader();}
  });
  el.save.addEventListener('click',()=>{save();message('保存しました。');});
  el.bpm.addEventListener('change',()=>{
    song.bpm=Math.round(D.clamp(el.bpm.value,60,200));save();updateHeader();
  });
  el.bars.addEventListener('change',()=>{
    const next=Number(el.bars.value);
    if(song.tracks.some(t=>t.clips.some(c=>c.startBar+c.lengthBars>next))){
      message('範囲外のクリップがあります。先に移動・削除してください。');
      el.bars.value=String(song.bars);return;
    }
    song.bars=next;save();renderTimeline();updateHeader();
  });
  $('#starterBtn').addEventListener('click',starter);
  el.play.addEventListener('click',()=>{
    audio.play(song,onProgress).then(()=>message('Playing')).catch(e=>message('再生エラー: '+e.message));
  });
  el.stop.addEventListener('click',()=>{audio.stop();message('Stopped');});
  el.patternBars.addEventListener('change',()=>{
    const r=findSelection();if(!r)return;
    const next=Number(el.patternBars.value);
    const trimmed=r.clip.notes.filter(n=>n.start>=next*16);
    if(trimmed.length&&!confirm('縮めた範囲の音符は削除されます。続けますか？')){
      el.patternBars.value=r.clip.patternBars;return;
    }
    r.clip.notes=r.clip.notes.filter(n=>n.start<next*16).map(n=>({...n,duration:Math.min(n.duration,next*16-n.start)}));
    r.clip.patternBars=next;save();renderPattern();
  });
  el.noteLength.addEventListener('change',()=>{noteDuration=Number(el.noteLength.value);});
  $('#clearPattern').addEventListener('click',()=>{
    const r=findSelection();if(!r||!confirm('このクリップの音符をすべて削除しますか？'))return;
    r.clip.notes=[];save();renderPattern();
  });
  $('#closeMenu').addEventListener('click',closeMenu);
  $('#menuEdit').addEventListener('click',()=>{
    const x=menuSelection;closeMenu();if(x)openEditor(x.track,x.clip);
  });
  $('#menuDuplicate').addEventListener('click',duplicateClip);
  el.menuLength.addEventListener('change',()=>changeClipLength(el.menuLength.value));
  $('#moveLeft').addEventListener('click',()=>changeClipPosition(-1));
  $('#moveRight').addEventListener('click',()=>changeClipPosition(1));
  $('#menuDelete').addEventListener('click',()=>{
    const r=findSelection(menuSelection);if(!r||!confirm('このクリップを削除しますか？'))return;
    r.track.clips=r.track.clips.filter(c=>c.id!==r.clip.id);
    if(selected?.clip===r.clip.id)selected=null;
    save();renderTimeline();closeMenu();message('クリップを削除しました。');
  });
  el.soundTrack.addEventListener('change',renderSoundSettings);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&audio.playing)audio.stop();});
  updateHeader();renderTimeline();renderSound();
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
})();