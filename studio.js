(() => {
  'use strict';
  const D=window.TechnoData, tracks=D.TRACKS, $=s=>document.querySelector(s), BAR=38;
  const id=new URLSearchParams(location.search).get('id');
  let song=D.getSong(id);
  if(!song){location.replace('./');return;}
  const audio=new window.TechnoAudio();
  let selected=null, menuSelection=null, noteDuration=2, tab='song', currentBar=-1;
  const el={
    back:$('#backLink'),editTabs:$('#editTabs'),rename:$('#renameSong'),save:$('#saveBtn'),play:$('#playBtn'),stop:$('#stopBtn'),
    bpm:$('#bpm'),position:$('#position'),status:$('#status'),bars:$('#songBars'),
    timeline:$('#timeline'),tabs:[...document.querySelectorAll('.tabs button')],
    patternTitle:$('#patternTitle'),patternSub:$('#patternSub'),patternGrid:$('#patternGrid'),
    noteLength:$('#noteLength'),noteLengthLabel:$('#noteLengthLabel'),
    volume:$('#patternVolume'),volumeValue:$('#patternVolumeValue'),instrument:$('#patternInstrument'),
    soundTitle:$('#soundTitle'),soundEditor:$('#soundEditor'),
    menu:$('#clipMenu'),menuTitle:$('#clipMenuTitle'),menuLength:$('#menuLength')
  };
  function message(txt){el.status.textContent=txt;}
  function save(){
    try{D.saveSong(song);if(audio.playing){audio.song=song;audio.updateMix();}}
    catch(e){message('保存失敗: '+e.message);}
  }
  function findSelection(ref=selected){
    if(!ref)return null;
    const track=song.tracks.find(t=>t.id===ref.track);
    const clip=track?.clips.find(c=>c.id===ref.clip);
    return clip?{track,clip,meta:tracks.find(m=>m.id===ref.track)}:null;
  }
  function playbackSelection(){
    if(tab==='song')return null;
    return selected?{trackId:selected.track,clipId:selected.clip}:null;
  }
  function startPlayback(){
    if(tab!=='song'&&!findSelection()){
      message('SONG画面からクリップを選択してください。');return;
    }
    return audio.play(song,onProgress,playbackSelection())
      .then(()=>{if(audio.playing)message(tab==='song'?'Playing song':'Looping 4-bar pattern');})
      .catch(e=>message('再生エラー: '+e.message));
  }
  function switchTab(target){
    const wasSong=tab==='song';
    tab=target;
    const nowSong=target==='song';
    el.editTabs.hidden=nowSong;
    el.back.setAttribute('aria-label',nowSong?'楽曲一覧に戻る':'SONGに戻る');
    el.back.setAttribute('title',nowSong?'My Songs':'Back to Song');
    el.tabs.forEach(b=>b.classList.toggle('selected',b.dataset.tab===target));
    ['song','pattern','sound'].forEach(t=>{
      $('#'+t+'Panel').hidden=t!==target;
    });
    if(target==='pattern')renderPattern();
    if(target==='sound')renderSound();
    if(wasSong!==nowSong && audio.playing)startPlayback();
    else if(wasSong!==nowSong && !nowSong)onProgress(-1);
    updateHeader();
  }
  function updateHeader(){
    el.rename.firstChild.textContent=song.name+' ';
    el.bpm.value=song.bpm;
    el.bars.value=song.bars;
    el.position.textContent=(currentBar<0?1:currentBar+1)+' / '+(tab==='song'?song.bars:D.PATTERN_BARS);
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
        const bar=Math.floor((e.clientX-rect.left)/(BAR*D.PATTERN_BARS))*D.PATTERN_BARS;
        if(bar>=0&&bar<song.bars)addClip(meta.id,bar);
      });
      t.clips.forEach(clip=>{
        const btn=document.createElement('button');btn.type='button';
        btn.className='clip';btn.style.background=meta.color;
        btn.style.left=(clip.startBar*BAR+1)+'px';
        btn.style.width=(clip.lengthBars*BAR-3)+'px';
        btn.textContent=meta.name+' · 4B';
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
    const length=D.PATTERN_BARS;
    if(start%length!==0||start+length>song.bars||collision(track,start,length)){
      message('4小節分の空きスペースに追加してください。');return;
    }
    const clip=D.newClip(start,length,D.PATTERN_BARS,[]);
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
    for(let b=Math.ceil((r.clip.startBar+len)/4)*4;b+len<=song.bars;b+=4)if(!collision(r.track,b,len)){start=b;break;}
    if(start<0)for(let b=0;b+len<=song.bars;b+=4)if(!collision(r.track,b,len)){start=b;break;}
    if(start<0){message('複製するための空きがありません。');return;}
    const clone=D.newClip(start,len,D.PATTERN_BARS,r.clip.notes);
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
    el.patternSub.textContent='Bars '+(r.clip.startBar+1)+'–'+(r.clip.startBar+r.clip.lengthBars)+' · 4小節の演奏を繰り返します';
    el.instrument.textContent=r.meta.name;
    el.volume.value=String(r.track.volume);
    el.volumeValue.textContent=r.track.volume+'%';
    el.noteLengthLabel.style.display=r.meta.type==='melody'?'grid':'none';
    if(r.meta.type==='drum')renderDrums(r);
    else renderPiano(r);
    const newScroll=el.patternGrid.querySelector('.piano-scroll');
    if(newScroll&&preserveScroll){newScroll.scrollLeft=left;newScroll.scrollTop=top;}
    $('#patternHint').textContent=r.meta.type==='melody'
      ?'半ビート（8分音符）刻み。横スクロールは上の拍目盛り、右ドラッグで音を伸ばせます。タップで追加・削除。'
      :'黄色のステップで音が鳴ります。タップしてON/OFFを切り替えます。';
  }
  function toggleDrum(step){
    const r=findSelection();if(!r)return;
    const idx=r.clip.notes.findIndex(n=>n.start===step);
    if(idx>=0)r.clip.notes.splice(idx,1);
    else r.clip.notes.push({start:step,duration:1});
    save();renderPattern();
  }
  function renderDrums(r){
    const grid=document.createElement('div');grid.className='drum-grid';
    for(let step=0;step<D.PATTERN_BARS*16;step++){
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
  function renderPiano(r){
    window.HalfBarPiano.render({
      container:el.patternGrid,
      clip:r.clip,
      trackId:r.track.id,
      noteLength:()=>noteDuration,
      onChange:()=>{save();renderPattern(true);}
    });
  }
  function renderSound(){
    const r=findSelection();
    el.soundEditor.replaceChildren();
    if(!r){
      el.soundTitle.textContent='Sound';
      return;
    }
    el.soundTitle.textContent=r.meta.name+' — Sound';
    renderSoundSettings();
  }
  const profile={
    'Deep Bass':[35,65,35],'Acid Bass':[85,40,80],'Hard Bass':[90,30,85],'Soft Bass':[25,75,20],
    'Deep Kick':[30,75,65],'Hard Kick':[65,35,90],'Soft Kick':[30,45,25],
    'Classic Lead':[60,40,20],'Bright Lead':[90,45,15],'Soft Lead':[30,75,65],'Pluck Lead':[75,25,5]
  };
  function renderSoundSettings(){
    const r=findSelection();
    el.soundEditor.replaceChildren();
    if(!r)return;
    const meta=r.meta;
    const track=r.track;
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
  function onProgress(step){
    currentBar=step<0?-1:Math.floor(step/16);
    el.position.textContent=(currentBar<0?1:currentBar+1)+' / '+(tab==='song'?song.bars:D.PATTERN_BARS);
    document.querySelectorAll('.clip').forEach(c=>c.classList.toggle(
      'is-now',tab==='song'&&currentBar>=Number(c.dataset.start)&&currentBar<Number(c.dataset.end)
    ));
    document.querySelectorAll('.drum-cell.playing,.piano-cell.playing').forEach(c=>c.classList.remove('playing'));
    if(step<0 || tab==='song')return;
    const index=step%(D.PATTERN_BARS*16);
    document.querySelectorAll('[data-step="'+index+'"],.piano-cell[data-step="'+(index-index%2)+'"]').forEach(c=>c.classList.add('playing'));
  }
  el.tabs.forEach(button=>button.addEventListener('click',()=>switchTab(button.dataset.tab)));
  el.back.addEventListener('click',event=>{
    if(tab==='song')return;
    event.preventDefault();
    switchTab('song');
  });
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
  el.play.addEventListener('click',startPlayback);
  el.stop.addEventListener('click',()=>{audio.stop();message('Stopped');});
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
  $('#moveLeft').addEventListener('click',()=>changeClipPosition(-D.PATTERN_BARS));
  $('#moveRight').addEventListener('click',()=>changeClipPosition(D.PATTERN_BARS));
  $('#menuDelete').addEventListener('click',()=>{
    const r=findSelection(menuSelection);if(!r||!confirm('このクリップを削除しますか？'))return;
    r.track.clips=r.track.clips.filter(c=>c.id!==r.clip.id);
    if(selected?.clip===r.clip.id)selected=null;
    save();renderTimeline();closeMenu();message('クリップを削除しました。');
  });
  el.volume.addEventListener('input',()=>{
    const r=findSelection();
    if(!r)return;
    r.track.volume=Number(el.volume.value);
    el.volumeValue.textContent=r.track.volume+'%';
    save();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&audio.playing)audio.stop();});
  updateHeader();renderTimeline();switchTab('song');
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
})();