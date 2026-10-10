(() => {
  'use strict';
  const STEPS_PER_HALF=8, STEPS_PER_PATTERN=64;
  const NOTE_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  function noteNumber(pitch){
    const match=/^([A-G])(#?)([0-7])$/.exec(pitch||'');
    if(!match)return null;
    const number={C:0,D:2,E:4,F:5,G:7,A:9,B:11}[match[1]];
    return Number(match[3])*12+number+(match[2]?1:0);
  }
  function displayPitches(trackId,notes){
    // Two octaves instead of the original three, centered around C2 / C4.
    let bottom=trackId==='bass'?19:43;
    let span=24;
    const used=notes.map(note=>noteNumber(note.pitch)).filter(n=>n!==null);
    // Shift when importing a melody outside the default octave window.
    if(used.length){
      const lowest=Math.min(...used),highest=Math.max(...used);
      if(highest>bottom+span-1)bottom=highest-span+1;
      if(lowest<bottom)bottom=lowest;
      span=Math.max(span,highest-bottom+1);
    }
    return Array.from({length:span},(_,i)=>{
      const number=bottom+span-1-i;
      return NOTE_NAMES[number%12]+Math.floor(number/12);
    });
  }

  function render(options){
    const {container,clip,trackId,noteLength,onChange,onPageChange}=options;
    let page=Math.max(0,Math.min(7,options.page||0));
    const root=document.createElement('div');root.className='halfbar-editor';
    const nav=document.createElement('div');nav.className='halfbar-nav';
    const back=document.createElement('button');back.type='button';back.textContent='←';
    back.setAttribute('aria-label','前の半小節');
    const label=document.createElement('span');label.className='halfbar-label';
    const forward=document.createElement('button');forward.type='button';forward.textContent='→';
    forward.setAttribute('aria-label','次の半小節');
    nav.append(back,label,forward);
    root.append(nav);

    const scroller=document.createElement('div');scroller.className='piano-scroll halfbar-scroll';
    const ruler=document.createElement('div');ruler.className='piano-ruler';
    const corner=document.createElement('div');corner.className='piano-key';corner.textContent='NOTE';
    ruler.append(corner);
    for(let step=0;step<STEPS_PER_PATTERN;step++){
      const cell=document.createElement('div');
      cell.className='piano-cell'+(step%4===0?' beat':'')+(step%8===0?' half-start':'');
      cell.textContent=step%16===0?'1':step%4===0?String(step%16/4+1):'';
      ruler.append(cell);
    }
    scroller.append(ruler);

    const rows=new Map();
    const pitches=displayPitches(trackId,clip.notes);
    for(const pitch of pitches){
      const row=document.createElement('div');row.className='piano-row';
      const key=document.createElement('div');
      key.className='piano-key'+(pitch.includes('#')?' black':'');
      key.textContent=pitch;row.append(key);
      const cells=[];
      for(let step=0;step<STEPS_PER_PATTERN;step++){
        const existing=clip.notes.find(n=>n.pitch===pitch&&step>=n.start&&step<n.start+n.duration);
        const cell=document.createElement('button');cell.type='button';
        cell.className='piano-cell'+(step%4===0?' beat':'')+(step%8===0?' half-start':'')
          +(existing?(existing.start===step?' on':' tail'):'');
        cell.dataset.step=String(step);cell.dataset.pitch=pitch;
        cell.setAttribute('aria-label',pitch+' step '+(step+1));
        cell.title=pitch+' · Step '+(step+1);
        row.append(cell);
        cells.push(cell);
      }
      rows.set(pitch,cells);
      scroller.append(row);
    }
    root.append(scroller);
    container.append(root);

    const cellWidth=Math.max(29,Math.min(60,Math.floor(((scroller.clientWidth||340)-48)/STEPS_PER_HALF)));
    scroller.style.setProperty('--piano-step',cellWidth+'px');

    function setPage(target){
      page=Math.max(0,Math.min(7,target));
      scroller.scrollLeft=page*STEPS_PER_HALF*cellWidth;
      label.textContent='Bar '+(Math.floor(page/2)+1)+' · Beats '+(page%2?'3–4':'1–2');
      back.disabled=page===0;forward.disabled=page===7;
      onPageChange(page);
    }
    back.addEventListener('click',()=>setPage(page-1));
    forward.addEventListener('click',()=>setPage(page+1));
    setPage(page);

    const focus=clip.notes.find(n=>n.start>=page*8&&n.start<(page+1)*8)?.pitch
      ||clip.notes[0]?.pitch||(trackId==='bass'?'C2':'C4');
    const focusIndex=pitches.indexOf(focus);
    scroller.scrollTop=Math.max(0,(Math.max(0,focusIndex)-4)*36);

    function commit(start,pitch,length,oldNote){
      const notes=clip.notes;
      if(oldNote){
        const old=notes.indexOf(oldNote);
        if(old>=0)notes.splice(old,1);
      }
      // Monophonic bass; polyphonic lead but no overlapping notes on one pitch.
      for(let i=notes.length-1;i>=0;i--){
        const n=notes[i];
        if((trackId==='bass'||n.pitch===pitch)
          &&n.start<start+length&&start<n.start+n.duration)notes.splice(i,1);
      }
      notes.push({start,duration:length,pitch});
      notes.sort((a,b)=>a.start-b.start);
      onChange();
    }

    let drag=null;
    function erasePreview(){
      for(const cells of rows.values())for(const cell of cells)cell.classList.remove('preview');
    }
    function paintPreview(){
      if(!drag)return;
      const cells=rows.get(drag.pitch)||[];
      for(let i=0;i<cells.length;i++)
        cells[i].classList.toggle('preview',i>=drag.start&&i<=drag.end);
    }
    function pointerStep(clientX){
      const bounds=scroller.getBoundingClientRect();
      return Math.max(0,Math.min(63,Math.floor((clientX-bounds.left+scroller.scrollLeft-48)/cellWidth)));
    }
    function cancelAdvance(){
      if(drag?.timer){clearTimeout(drag.timer);drag.timer=null;}
    }
    function maybeAdvance(clientX){
      cancelAdvance();
      if(!drag||!drag.moved||page===7)return;
      if(clientX<scroller.getBoundingClientRect().right-27)return;
      // Holding near the right edge continues the same note into the next half-bar.
      drag.timer=setTimeout(()=>{
        if(!drag)return;
        setPage(page+1);
        drag.end=Math.max(drag.end,page*STEPS_PER_HALF);
        paintPreview();
        maybeAdvance(clientX);
      },550);
    }
    scroller.addEventListener('pointerdown',event=>{
      const cell=event.target.closest?.('.piano-cell[data-pitch][data-step]');
      if(!cell||drag||event.isPrimary===false)return;
      const step=Number(cell.dataset.step),pitch=cell.dataset.pitch;
      const existing=clip.notes.find(n=>n.pitch===pitch&&n.start<=step&&step<n.start+n.duration)||null;
      drag={id:event.pointerId,originX:event.clientX,start:existing?.start??step,
        end:existing?.start??step,pitch,existing,moved:false,timer:null};
      scroller.setPointerCapture?.(event.pointerId);
    });
    scroller.addEventListener('pointermove',event=>{
      if(!drag||event.pointerId!==drag.id)return;
      const end=pointerStep(event.clientX);
      if(event.clientX-drag.originX>7||end>drag.start)drag.moved=true;
      if(drag.moved)drag.end=Math.max(drag.start,end);
      paintPreview();
      maybeAdvance(event.clientX);
    });
    function finish(event,cancel=false){
      if(!drag||event.pointerId!==drag.id)return;
      cancelAdvance();
      const operation=drag;drag=null;
      try{
        if(scroller.hasPointerCapture?.(event.pointerId))scroller.releasePointerCapture(event.pointerId);
      }catch{}
      erasePreview();
      if(cancel)return;
      if(!operation.moved&&operation.existing){
        const index=clip.notes.indexOf(operation.existing);
        if(index>=0)clip.notes.splice(index,1);
        onChange();
        return;
      }
      const length=operation.moved?Math.max(1,operation.end-operation.start+1)
        :Math.min(noteLength(),STEPS_PER_PATTERN-operation.start);
      commit(operation.start,operation.pitch,length,operation.existing);
    }
    scroller.addEventListener('pointerup',event=>finish(event));
    scroller.addEventListener('pointercancel',event=>finish(event,true));
    scroller.addEventListener('lostpointercapture',event=>finish(event,true));

    const help=document.createElement('p');help.className='piano-note-help';
    help.textContent=trackId==='bass'?'Bassは同時に1音だけ鳴ります。':'Leadは複数音を同時に重ねられます。';
    container.append(help);
  }
  window.HalfBarPiano={render};
})();