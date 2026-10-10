(() => {
  'use strict';
  // Playback/JSON stay at 16 steps per bar. The editing grid snaps to half-beats.
  const STEP=2, TOTAL=64, COLUMNS=TOTAL/STEP;
  const NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  function pitchNumber(p){
    const m=/^([A-G])(#?)([0-7])$/.exec(p||'');
    if(!m)return null;
    return Number(m[3])*12+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]?1:0);
  }
  function pitches(trackId,notes){
    let bottom=trackId==='bass'?19:43, count=24;
    const used=notes.map(n=>pitchNumber(n.pitch)).filter(n=>n!==null);
    // Preserve the ability to see/edit previously saved out-of-range notes.
    if(used.length){
      const min=Math.min(...used),max=Math.max(...used);
      if(max>bottom+count-1)bottom=max-count+1;
      if(min<bottom)bottom=min;
      count=Math.max(count,max-bottom+1);
    }
    return Array.from({length:count},(_,i)=>{
      const n=bottom+count-1-i;
      return NAMES[n%12]+Math.floor(n/12);
    });
  }
  function render({container,clip,trackId,noteLength,onChange}){
    const editor=document.createElement('div');
    editor.className='halfbar-editor';
    const scroll=document.createElement('div');
    scroll.className='piano-scroll halfbar-scroll';
    scroll.setAttribute('aria-label',trackId+' piano roll, scroll horizontally using beat ruler');
    const ruler=document.createElement('div');
    ruler.className='piano-ruler';
    ruler.setAttribute('aria-label','横方向にスワイプしてスクロール');
    const heading=document.createElement('div');
    heading.className='piano-key';heading.textContent='NOTE';ruler.append(heading);
    for(let col=0;col<COLUMNS;col++){
      const cell=document.createElement('div');
      cell.className='piano-cell'+(col%2===0?' beat':'')+(col%8===0?' bar-start':'');
      cell.textContent=col%2===0?String(Math.floor(col%8/2)+1):'&';
      ruler.append(cell);
    }
    scroll.append(ruler);
    const rows=new Map();
    const visiblePitches=pitches(trackId,clip.notes);
    for(const pitch of visiblePitches){
      const row=document.createElement('div');row.className='piano-row';
      const label=document.createElement('div');
      label.className='piano-key'+(pitch.includes('#')?' black':'');label.textContent=pitch;
      row.append(label);
      const cells=[];
      for(let col=0;col<COLUMNS;col++){
        const start=col*STEP;
        // An older 1/16-note start still appears in its half-beat cell.
        const note=clip.notes.find(n=>n.pitch===pitch && n.start<start+STEP
          && n.start+n.duration>start);
        const cell=document.createElement('button');cell.type='button';
        cell.className='piano-cell'+(col%2===0?' beat':'')+(col%8===0?' bar-start':'')
          +(note?(note.start>=start?' on':' tail'):'');
        cell.dataset.step=String(start);cell.dataset.pitch=pitch;
        cell.setAttribute('aria-label',pitch+' at bar '+(Math.floor(col/8)+1)
          +', beat '+(Math.floor(col%8/2)+1)+(col%2?' and':''));
        cell.title=pitch+' · half-beat '+(col+1);
        row.append(cell);cells.push(cell);
      }
      rows.set(pitch,cells);
      scroll.append(row);
    }
    editor.append(scroll);container.append(editor);
    const description=document.createElement('p');description.className='piano-note-help';
    description.textContent=trackId==='bass'?'Bassは同時に1音だけ鳴ります。':'Leadは複数音を同時に重ねられます。';
    container.append(description);
    const width=Math.max(36,Math.min(54,Math.floor(((scroll.clientWidth||340)-48)/8)));
    scroll.style.setProperty('--piano-step',width+'px');
    const focus=clip.notes[0]?.pitch||(trackId==='bass'?'C2':'C4');
    scroll.scrollTop=Math.max(0,(Math.max(0,visiblePitches.indexOf(focus))-4)*36);

    function commit(start,pitch,duration,oldNote){
      const notes=clip.notes;
      if(oldNote){
        const pos=notes.indexOf(oldNote);
        if(pos>=0)notes.splice(pos,1);
      }
      // Preserve original monophonic Bass and polyphonic Lead.
      for(let i=notes.length-1;i>=0;i--){
        const n=notes[i];
        if((trackId==='bass'||n.pitch===pitch)
            &&n.start<start+duration && start<n.start+n.duration)notes.splice(i,1);
      }
      notes.push({start,duration,pitch});
      notes.sort((a,b)=>a.start-b.start);
      onChange();
    }

    // Mobile gesture rule: a quick horizontal swipe pans in BOTH directions.
    // Hold a note for 280ms before moving right to extend its duration.
    // This avoids interpreting a normal right swipe as a note edit.
    const HOLD_MS=280, MOVE_THRESHOLD=9;
    let drag=null;
    const pointerCol=clientX=>{
      const bounds=scroll.getBoundingClientRect();
      return Math.max(0,Math.min(COLUMNS-1,Math.floor(
        (clientX-bounds.left+scroll.scrollLeft-48)/width)));
    };
    function clearPreview(){
      for(const cells of rows.values())for(const cell of cells)cell.classList.remove('preview');
    }
    function preview(){
      if(!drag)return;
      const cells=rows.get(drag.pitch)||[];
      for(let col=0;col<cells.length;col++){
        const begin=col*STEP;
        cells[col].classList.toggle('preview',begin<drag.end&&begin+STEP>drag.start);
      }
    }
    function cancelHold(){
      if(drag?.holdTimer!==null&&drag?.holdTimer!==undefined){
        clearTimeout(drag.holdTimer);
        drag.holdTimer=null;
      }
    }
    function cancelEdge(){
      if(drag?.timer){clearTimeout(drag.timer);drag.timer=null;}
    }
    function maxScrollLeft(){
      return Math.max(0,(scroll.scrollWidth||COLUMNS*width+48)-(scroll.clientWidth||340));
    }
    function edgeScroll(clientX){
      cancelEdge();
      if(!drag||drag.mode!=='extend'||drag.end>=TOTAL)return;
      if(clientX<scroll.getBoundingClientRect().right-28)return;
      // Holding at the right edge keeps scrolling and lengthening the note.
      drag.timer=setTimeout(()=>{
        if(!drag||drag.mode!=='extend')return;
        const before=scroll.scrollLeft;
        scroll.scrollLeft=Math.min(maxScrollLeft(),before+width);
        if(scroll.scrollLeft<=before)return;
        drag.end=Math.min(TOTAL,Math.max(drag.end+STEP,(pointerCol(clientX)+1)*STEP));
        preview();
        edgeScroll(clientX);
      },300);
    }

    scroll.addEventListener('contextmenu',event=>{
      if(event.target.closest?.('.piano-cell[data-pitch][data-step]')){
        event.preventDefault();
      }
    });
    scroll.addEventListener('pointerdown',e=>{
      const cell=e.target.closest?.('.piano-cell[data-pitch][data-step]');
      if(!cell||drag||e.isPrimary===false)return;
      if(e.button!==undefined&&e.button!==0)return;
      const coarseStart=Number(cell.dataset.step),pitch=cell.dataset.pitch;
      const existing=clip.notes.find(n=>n.pitch===pitch&&n.start<coarseStart+STEP
        &&n.start+n.duration>coarseStart)||null;
      const start=existing?.start??coarseStart;
      drag={id:e.pointerId,originX:e.clientX,originY:e.clientY||0,
        scrollLeft:scroll.scrollLeft,start,end:Math.max(start+STEP,(existing?.start||start)+(existing?.duration||STEP)),
        pitch,existing,mode:'pending',timer:null,holdTimer:null};
      // Mouse users can drag notes directly, as before. Touch users must
      // hold before dragging; otherwise a swipe pans the timeline.
      if(e.pointerType==='mouse'){
        drag.mode='mouse-pending';
      } else {
        const pointerId=e.pointerId;
        drag.holdTimer=setTimeout(()=>{
          if(!drag||drag.id!==pointerId||drag.mode!=='pending')return;
          drag.holdTimer=null;
          drag.mode='extend';
          preview();
        },HOLD_MS);
      }
      scroll.setPointerCapture?.(e.pointerId);
    });
    scroll.addEventListener('pointermove',e=>{
      if(!drag||e.pointerId!==drag.id)return;
      const dx=e.clientX-drag.originX;
      const dy=(e.clientY||0)-drag.originY;
      if(drag.mode==='pending'||drag.mode==='mouse-pending'){
        if(Math.abs(dx)>MOVE_THRESHOLD||Math.abs(dy)>MOVE_THRESHOLD){
          const isMouse=drag.mode==='mouse-pending';
          cancelHold();
          if(Math.abs(dy)>Math.abs(dx)){
            drag.mode='vertical';
          } else if(isMouse&&dx>0){
            drag.mode='extend';
          } else {
            drag.mode='scroll';
          }
        }
      }
      if(drag.mode==='scroll'){
        cancelEdge();
        // Works for both left and right finger swipes, on any note cell.
        scroll.scrollLeft=Math.max(0,Math.min(maxScrollLeft(),drag.scrollLeft-dx));
        return;
      }
      if(drag.mode==='extend'){
        // Ends snap to half-beat boundaries, preserving older odd note starts.
        drag.end=Math.max(drag.end,drag.start+STEP,(pointerCol(e.clientX)+1)*STEP);
        preview();
        edgeScroll(e.clientX);
      }
    });
    function finish(e,canceled=false){
      if(!drag||e.pointerId!==drag.id)return;
      cancelHold();
      cancelEdge();
      const action=drag;drag=null;
      try{
        if(scroll.hasPointerCapture?.(e.pointerId))scroll.releasePointerCapture(e.pointerId);
      }catch{}
      clearPreview();
      if(canceled||action.mode==='scroll'||action.mode==='vertical')return;
      if((action.mode==='pending'||action.mode==='mouse-pending')&&action.existing){
        const pos=clip.notes.indexOf(action.existing);
        if(pos>=0)clip.notes.splice(pos,1);
        onChange();return;
      }
      const duration=action.mode==='extend'
        ?Math.min(TOTAL-action.start,Math.max(1,action.end-action.start))
        :Math.min(TOTAL-action.start,Math.max(STEP,Math.ceil(noteLength()/STEP)*STEP));
      commit(action.start,action.pitch,duration,action.existing);
    }
    scroll.addEventListener('pointerup',e=>finish(e));
    scroll.addEventListener('pointercancel',e=>finish(e,true));
    scroll.addEventListener('lostpointercapture',e=>finish(e,true));
  }
  window.HalfBarPiano={render};
})();