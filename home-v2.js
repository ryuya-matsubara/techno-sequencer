(() => {
  'use strict';
  const D=window.TechnoData;
  const list=document.querySelector('#songList');
  const count=document.querySelector('#savedCount');
  const empty=document.querySelector('#emptyState');
  const status=document.querySelector('#message');
  const chooser=document.querySelector('#jsonFile');
  const edit=id=>{location.href='./studio.html?id='+encodeURIComponent(id);};
  const say=text=>{status.textContent=text;};
  function render(){
    const songs=D.getSongs().slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    list.replaceChildren();
    count.textContent=String(songs.length);
    empty.hidden=songs.length>0;
    songs.forEach(song=>{
      const card=document.createElement('article');card.className='song-card';
      const open=document.createElement('button');open.type='button';open.className='open-song';
      const name=document.createElement('span');name.className='song-name';name.textContent=song.name||'Untitled Song';
      const meta=document.createElement('span');meta.className='song-meta';
      const clips=song.tracks.reduce((n,t)=>n+(t.clips?.length||0),0);
      meta.textContent=(song.bpm||140)+' BPM · '+(song.bars||32)+' bars · '+clips+' clips';
      open.append(name,meta);open.addEventListener('click',()=>edit(song.id));
      const actions=document.createElement('div');actions.className='song-actions';
      const dl=document.createElement('button');dl.type='button';dl.className='download';dl.textContent='↓ Download JSON';
      dl.addEventListener('click',()=>{
        try{D.exportSong(song);say('楽曲データをダウンロードしました。');}
        catch(e){say('ダウンロードできません: '+e.message);}
      });
      const del=document.createElement('button');del.type='button';del.className='delete';del.textContent='Delete';
      del.addEventListener('click',()=>{
        if(!confirm('「'+song.name+'」を削除しますか？'))return;
        D.removeSong(song.id);render();say('削除しました。');
      });
      actions.append(dl,del);card.append(open,actions);list.append(card);
    });
  }
  document.querySelector('#newSong').addEventListener('click',()=>{
    const name=prompt('新しい曲の名前','Song '+(D.getSongs().length+1));
    if(name===null)return;
    try{
      const song=D.saveSong(D.createSong(name.trim()||'Untitled Song'));
      edit(song.id);
    }catch(e){say('曲を作成できません: '+e.message);}
  });
  document.querySelector('#importSong').addEventListener('click',()=>chooser.click());
  chooser.addEventListener('change',async()=>{
    const file=chooser.files?.[0];
    if(!file)return;
    try{
      const song=await D.importSong(file);
      render();say('「'+song.name+'」を追加しました。既存の曲は上書きしていません。');
    }catch(e){say('インポートできません: '+e.message);}
    finally{chooser.value='';}
  });
  render();
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
})();