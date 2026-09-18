/* ================= Zuvo — script.js ================= */

/* ---------- IndexedDB helper ---------- */
const DB_NAME = 'zuvoDB', DB_VERSION = 1;
let db;
function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e=>{
      const d = e.target.result;
      if(!d.objectStoreNames.contains('songs')) d.createObjectStore('songs',{keyPath:'id',autoIncrement:true});
      if(!d.objectStoreNames.contains('playlists')) d.createObjectStore('playlists',{keyPath:'id',autoIncrement:true});
      if(!d.objectStoreNames.contains('settings')) d.createObjectStore('settings',{keyPath:'key'});
    };
    req.onsuccess = e=>resolve(e.target.result);
    req.onerror = e=>reject(e.target.error);
  });
}
function tx(store, mode='readonly'){ return db.transaction(store, mode).objectStore(store); }
function reqP(r){ return new Promise((res,rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
function dbGetAll(store){ return reqP(tx(store).getAll()); }
function dbPut(store, val){ return reqP(tx(store,'readwrite').put(val)); }
function dbDelete(store, key){ return reqP(tx(store,'readwrite').delete(key)); }
function dbClear(store){ return reqP(tx(store,'readwrite').clear()); }
function dbGet(store, key){ return reqP(tx(store).get(key)); }

/* ---------- State ---------- */
let songs = [];          // {id,title,artist,album,blob,mime,duration,dateAdded,favorite}
let playlists = [];      // {id,name,songIds:[]}
let settings = { autoplay:true, rememberPosition:true, lastPositions:{} };
let searchTerm = '';
let activePlaylistId = null;
let currentMenuSongId = null;

let queue = [];          // array of song ids
let queueIndex = -1;
let shuffle = false;
let repeatMode = 'off';  // off | all | one
let isPlaying = false;
let isSeeking = false;
let skipLock = false;

const urlCache = new Map();   // songId -> object URL
const coverCache = new Map(); // songId -> data URL

const audio = new Audio();
audio.preload = 'metadata';

/* ---------- DOM ---------- */
const $ = s=>document.querySelector(s);
const $$ = s=>document.querySelectorAll(s);

const els = {
  fileInput: $('#fileInput'),
  searchBar: $('#searchBar'), searchInput: $('#searchInput'),
  statSongs: $('#statSongs'), statFavorites: $('#statFavorites'), statPlaylists: $('#statPlaylists'),
  recentList: $('#recentList'), homeEmpty: $('#homeEmpty'),
  playlistGrid: $('#playlistGrid'), playlistsEmpty: $('#playlistsEmpty'),
  playlistDetailName: $('#playlistDetailName'), playlistDetailList: $('#playlistDetailList'), playlistDetailEmpty: $('#playlistDetailEmpty'),
  favoritesList: $('#favoritesList'), favoritesEmpty: $('#favoritesEmpty'),
  storageInfo: $('#storageInfo'),
  miniPlayer: $('#miniPlayer'), miniCover: $('#miniCover'), miniTitle: $('#miniTitle'), miniArtist: $('#miniArtist'),
  miniPlayBtn: $('#miniPlayBtn'), miniProgressFill: $('#miniProgressFill'),
  fullPlayer: $('#fullPlayer'), fullCover: $('#fullCover'), fullTitle: $('#fullTitle'), fullArtist: $('#fullArtist'),
  fullFavoriteBtn: $('#fullFavoriteBtn'),
  seekBar: $('#seekBar'), currentTime: $('#currentTime'), duration: $('#duration'),
  playBtn: $('#playBtn'), prevBtn: $('#prevBtn'), nextBtn: $('#nextBtn'), shuffleBtn: $('#shuffleBtn'), repeatBtn: $('#repeatBtn'),
  volumeBar: $('#volumeBar'),
  toast: $('#toast')
};

/* ---------- Icons ---------- */
const ICON_PLAY = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M7 5v14l12-7L7 5z" fill="currentColor"/></svg>';
const ICON_PAUSE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>';
const ICON_HEART_O = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.4-9.5-9A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 5c-2.5 4.6-9.5 9-9.5 9z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const ICON_HEART_F = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.4-9.5-9A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 5c-2.5 4.6-9.5 9-9.5 9z" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const ICON_DOTS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/></svg>';

/* ---------- Utilities ---------- */
function toast(msg){
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>els.toast.classList.remove('show'), 1800);
}
function fmtTime(sec){
  if(!isFinite(sec) || sec<0) sec=0;
  const m = Math.floor(sec/60), s = Math.floor(sec%60);
  return `${m}:${s.toString().padStart(2,'0')}`;
}
function stripExt(name){ return name.replace(/\.[^/.]+$/, ''); }

function coverFor(song){
  if(coverCache.has(song.id)) return coverCache.get(song.id);
  const c = document.createElement('canvas'); c.width=200; c.height=200;
  const ctx = c.getContext('2d');
  let hash=0; for(const ch of song.title) hash = (hash*31 + ch.charCodeAt(0)) >>> 0;
  const hue1 = hash % 360, hue2 = (hue1+55) % 360;
  const g = ctx.createLinearGradient(0,0,200,200);
  g.addColorStop(0, `hsl(${hue1},65%,32%)`);
  g.addColorStop(1, `hsl(${hue2},60%,20%)`);
  ctx.fillStyle=g; ctx.fillRect(0,0,200,200);
  ctx.fillStyle='rgba(255,255,255,0.85)';
  ctx.font='700 84px -apple-system,sans-serif';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText((song.title[0]||'?').toUpperCase(), 100, 110);
  const url = c.toDataURL('image/png');
  coverCache.set(song.id, url);
  return url;
}
function urlFor(song){
  if(urlCache.has(song.id)) return urlCache.get(song.id);
  const url = URL.createObjectURL(song.blob);
  urlCache.set(song.id, url);
  return url;
}
function revokeAllUrls(){
  urlCache.forEach(u=>URL.revokeObjectURL(u));
  urlCache.clear(); coverCache.clear();
}

/* ---------- Init ---------- */
(async function init(){
  db = await openDB();
  const [s, p, set] = await Promise.all([dbGetAll('songs'), dbGetAll('playlists'), dbGetAll('settings')]);
  songs = s; playlists = p;
  set.forEach(row=>{ if(row.key==='autoplay') settings.autoplay = row.value;
    if(row.key==='rememberPosition') settings.rememberPosition = row.value;
    if(row.key==='lastPositions') settings.lastPositions = row.value || {}; });
  $('#autoplayToggle').checked = settings.autoplay;
  $('#rememberPosToggle').checked = settings.rememberPosition;
  renderAll();
  updateStorageInfo();
})();

function renderAll(){
  renderStats();
  renderHome();
  renderPlaylists();
  renderFavorites();
  if(activePlaylistId!==null) renderPlaylistDetail();
}
function renderStats(){
  els.statSongs.textContent = songs.length;
  els.statFavorites.textContent = songs.filter(s=>s.favorite).length;
  els.statPlaylists.textContent = playlists.length;
}

/* ---------- Filtering ---------- */
function matchesSearch(song){
  if(!searchTerm) return true;
  const t = searchTerm.toLowerCase();
  return song.title.toLowerCase().includes(t) || song.artist.toLowerCase().includes(t) || song.album.toLowerCase().includes(t);
}

/* ---------- Song row rendering ---------- */
function songRowHTML(song){
  const playingClass = (queue[queueIndex]===song.id && isPlaying) ? 'playing' : '';
  return `<div class="song-row ${playingClass}" data-id="${song.id}">
    <img class="song-cover" src="${coverFor(song)}" alt="">
    <div class="song-meta">
      <span class="song-title">${escapeHtml(song.title)}</span>
      <span class="song-sub">${escapeHtml(song.artist)} · ${escapeHtml(song.album)}</span>
    </div>
    <div class="song-actions">
      <button class="icon-btn fav-btn ${song.favorite?'active':''}" data-fav="${song.id}">${song.favorite?ICON_HEART_F:ICON_HEART_O}</button>
      <button class="icon-btn" data-menu="${song.id}">${ICON_DOTS}</button>
    </div>
  </div>`;
}
function escapeHtml(str){
  return (str||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function renderList(container, list){
  container.innerHTML = list.map(songRowHTML).join('');
}

/* ---------- HOME ---------- */
function renderHome(){
  const list = songs.filter(matchesSearch).slice().sort((a,b)=>b.dateAdded-a.dateAdded).slice(0, searchTerm?100:15);
  renderList(els.recentList, list);
  els.homeEmpty.hidden = songs.length !== 0;
  $('#view-home .stats-row').hidden = songs.length===0;
  $('#view-home .hero-card').hidden = songs.length===0 && !searchTerm;
  $('.section-head', $('#view-home')).querySelector('h2').textContent = searchTerm ? 'Search Results' : 'Recently Added';
}

/* ---------- PLAYLISTS ---------- */
function renderPlaylists(){
  els.playlistGrid.innerHTML = playlists.map(pl=>`
    <div class="playlist-card" data-pl="${pl.id}">
      <span class="pl-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 18V5l12-2v13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.8"/><circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="1.8"/></svg>
      </span>
      <div>
        <div class="pl-name">${escapeHtml(pl.name)}</div>
        <div class="pl-count">${pl.songIds.length} song${pl.songIds.length===1?'':'s'}</div>
      </div>
    </div>`).join('');
  els.playlistsEmpty.hidden = playlists.length !== 0;
}
function renderPlaylistDetail(){
  const pl = playlists.find(p=>p.id===activePlaylistId);
  if(!pl){ showView('playlists'); return; }
  els.playlistDetailName.textContent = pl.name;
  const list = pl.songIds.map(id=>songs.find(s=>s.id===id)).filter(Boolean).filter(matchesSearch);
  renderList(els.playlistDetailList, list);
  els.playlistDetailEmpty.hidden = pl.songIds.length !== 0;
}

/* ---------- FAVORITES ---------- */
function renderFavorites(){
  const list = songs.filter(s=>s.favorite).filter(matchesSearch);
  renderList(els.favoritesList, list);
  els.favoritesEmpty.hidden = songs.some(s=>s.favorite);
}

/* ---------- Navigation ---------- */
function showView(name){
  $$('.view').forEach(v=>v.classList.remove('active'));
  $$('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===name));
  const map = { home:'#view-home', playlists:'#view-playlists', favorites:'#view-favorites', settings:'#view-settings', 'playlist-detail':'#view-playlist-detail' };
  $(map[name]).classList.add('active');
  $('#bottomNav').hidden = (name==='playlist-detail');
}
$$('.nav-btn').forEach(btn=>btn.addEventListener('click', ()=>{
  activePlaylistId = null;
  showView(btn.dataset.view);
}));

/* ---------- Search ---------- */
function toggleSearch(force){
  const open = force !== undefined ? force : !els.searchBar.classList.contains('open');
  els.searchBar.classList.toggle('open', open);
  if(open) els.searchInput.focus(); else { els.searchInput.value=''; searchTerm=''; renderAll(); }
}
$('#searchBtn').addEventListener('click', ()=>toggleSearch());
els.searchInput.addEventListener('input', ()=>{
  searchTerm = els.searchInput.value.trim();
  renderAll();
});
$('#clearSearchBtn').addEventListener('click', ()=>{ els.searchInput.value=''; searchTerm=''; renderAll(); els.searchInput.focus(); });

/* ---------- Import music ---------- */
$('#addMusicBtnTop').addEventListener('click', ()=>els.fileInput.click());
$('#addMusicBtnEmpty').addEventListener('click', ()=>els.fileInput.click());
els.fileInput.addEventListener('change', async e=>{
  const files = Array.from(e.target.files || []);
  els.fileInput.value = '';
  if(!files.length) return;
  toast(`Importing ${files.length} song${files.length===1?'':'s'}...`);
  for(const file of files) await importFile(file);
  renderAll(); updateStorageInfo();
  toast('Import complete');
});
function importFile(file){
  return new Promise(resolve=>{
    const record = {
      title: stripExt(file.name),
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      blob: file,
      mime: file.type,
      duration: 0,
      dateAdded: Date.now(),
      favorite: false
    };
    dbPut('songs', record).then(async id=>{
      record.id = id;
      songs.push(record);
      const tmp = document.createElement('audio');
      tmp.preload = 'metadata';
      const url = URL.createObjectURL(file);
      tmp.src = url;
      tmp.addEventListener('loadedmetadata', async ()=>{
        record.duration = isFinite(tmp.duration) ? tmp.duration : 0;
        await dbPut('songs', record);
        URL.revokeObjectURL(url);
        resolve();
      });
      tmp.addEventListener('error', async ()=>{ URL.revokeObjectURL(url); resolve(); });
    });
  });
}

/* ---------- Song list delegated events ---------- */
document.addEventListener('click', e=>{
  const row = e.target.closest('.song-row');
  const favBtn = e.target.closest('[data-fav]');
  const menuBtn = e.target.closest('[data-menu]');
  const plCard = e.target.closest('[data-pl]');

  if(favBtn){ e.stopPropagation(); toggleFavorite(Number(favBtn.dataset.fav)); return; }
  if(menuBtn){ e.stopPropagation(); openSongMenu(Number(menuBtn.dataset.menu)); return; }
  if(row){ playFromContext(Number(row.dataset.id)); return; }
  if(plCard){ openPlaylistDetail(Number(plCard.dataset.pl)); return; }
});

function currentListFor(id){
  // Determine which visible list the song belongs to, to build the queue
  if($('#view-favorites').classList.contains('active')) return songs.filter(s=>s.favorite).filter(matchesSearch);
  if($('#view-playlist-detail').classList.contains('active')){
    const pl = playlists.find(p=>p.id===activePlaylistId);
    return pl.songIds.map(sid=>songs.find(s=>s.id===sid)).filter(Boolean).filter(matchesSearch);
  }
  return songs.filter(matchesSearch).slice().sort((a,b)=>b.dateAdded-a.dateAdded);
}
function playFromContext(id){
  const list = currentListFor(id);
  queue = list.map(s=>s.id);
  queueIndex = queue.indexOf(id);
  loadAndPlay(queue[queueIndex]);
}

/* ---------- Favorites ---------- */
async function toggleFavorite(id){
  const song = songs.find(s=>s.id===id);
  if(!song) return;
  song.favorite = !song.favorite;
  await dbPut('songs', song);
  renderAll();
  updateNowPlayingUI();
}

/* ---------- Song menu (sheet) ---------- */
function openSongMenu(id){
  currentMenuSongId = id;
  const inPlaylist = $('#view-playlist-detail').classList.contains('active');
  $('#menuRemovePlaylist').hidden = !inPlaylist;
  $('#songMenuModal').hidden = false;
}
$('#menuCancel').addEventListener('click', ()=>$('#songMenuModal').hidden = true);
$('#songMenuModal').addEventListener('click', e=>{ if(e.target.id==='songMenuModal') e.target.hidden = true; });
$('#menuFavorite').addEventListener('click', ()=>{ toggleFavorite(currentMenuSongId); $('#songMenuModal').hidden = true; });
$('#menuDelete').addEventListener('click', async ()=>{
  const id = currentMenuSongId;
  $('#songMenuModal').hidden = true;
  await deleteSong(id);
});
$('#menuRemovePlaylist').addEventListener('click', async ()=>{
  const pl = playlists.find(p=>p.id===activePlaylistId);
  if(pl){ pl.songIds = pl.songIds.filter(sid=>sid!==currentMenuSongId); await dbPut('playlists', pl); renderAll(); }
  $('#songMenuModal').hidden = true;
});
$('#menuAddPlaylist').addEventListener('click', ()=>{
  $('#songMenuModal').hidden = true;
  openAddToPlaylist(currentMenuSongId);
});

async function deleteSong(id){
  await dbDelete('songs', id);
  songs = songs.filter(s=>s.id!==id);
  playlists.forEach(pl=>{ pl.songIds = pl.songIds.filter(sid=>sid!==id); });
  await Promise.all(playlists.map(pl=>dbPut('playlists', pl)));
  if(urlCache.has(id)){ URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
  coverCache.delete(id);
  if(queue[queueIndex]===id) stopPlayback();
  renderAll(); updateStorageInfo();
  toast('Song deleted');
}

/* ---------- Add to playlist modal ---------- */
function openAddToPlaylist(songId){
  const list = $('#addToPlaylistList');
  if(!playlists.length){
    list.innerHTML = `<p style="color:var(--text-dim);font-size:13.5px;padding:8px 2px;">No playlists yet — create one first.</p>`;
  } else {
    list.innerHTML = playlists.map(pl=>{
      const checked = pl.songIds.includes(songId);
      return `<div class="pl-pick" data-pick="${pl.id}">
        <span>${escapeHtml(pl.name)}<small>${pl.songIds.length} songs</small></span>
        <span class="add-check ${checked?'checked':''}">${checked?'✓':''}</span>
      </div>`;
    }).join('');
  }
  $('#addToPlaylistModal').hidden = false;
  $('#addToPlaylistModal').dataset.songId = songId;
}
$('#cancelAddToPlaylistBtn').addEventListener('click', ()=>$('#addToPlaylistModal').hidden = true);
$('#addToPlaylistModal').addEventListener('click', async e=>{
  if(e.target.id==='addToPlaylistModal'){ e.target.hidden = true; return; }
  const pick = e.target.closest('[data-pick]');
  if(!pick) return;
  const plId = Number(pick.dataset.pick);
  const songId = Number($('#addToPlaylistModal').dataset.songId);
  const pl = playlists.find(p=>p.id===plId);
  const idx = pl.songIds.indexOf(songId);
  if(idx>-1) pl.songIds.splice(idx,1); else pl.songIds.push(songId);
  await dbPut('playlists', pl);
  renderAll();
  openAddToPlaylist(songId);
});

/* ---------- Playlists CRUD ---------- */
function openPlaylistModal(){ $('#playlistNameInput').value=''; $('#playlistModal').hidden=false; $('#playlistNameInput').focus(); }
$('#createPlaylistBtn').addEventListener('click', openPlaylistModal);
$('#createPlaylistBtnEmpty').addEventListener('click', openPlaylistModal);
$('#cancelPlaylistBtn').addEventListener('click', ()=>$('#playlistModal').hidden=true);
$('#playlistModal').addEventListener('click', e=>{ if(e.target.id==='playlistModal') e.target.hidden=true; });
$('#confirmPlaylistBtn').addEventListener('click', async ()=>{
  const name = $('#playlistNameInput').value.trim();
  if(!name) return;
  const pl = { name, songIds: [] };
  const id = await dbPut('playlists', pl);
  pl.id = id;
  playlists.push(pl);
  $('#playlistModal').hidden = true;
  renderAll();
  toast('Playlist created');
});
function openPlaylistDetail(id){
  activePlaylistId = id;
  showView('playlist-detail');
  renderPlaylistDetail();
}
$('#backFromPlaylist').addEventListener('click', ()=>{ activePlaylistId=null; showView('playlists'); });
$('#deletePlaylistBtn').addEventListener('click', async ()=>{
  if(activePlaylistId===null) return;
  await dbDelete('playlists', activePlaylistId);
  playlists = playlists.filter(p=>p.id!==activePlaylistId);
  activePlaylistId = null;
  showView('playlists');
  renderAll();
  toast('Playlist deleted');
});

/* ---------- Player core ---------- */
function loadAndPlay(id){
  const song = songs.find(s=>s.id===id);
  if(!song) return;
  audio.src = urlFor(song);
  const resume = settings.rememberPosition ? (settings.lastPositions[id] || 0) : 0;
  audio.currentTime = resume || 0;
  audio.play().then(()=>{ isPlaying = true; updatePlayIcons(); }).catch(()=>{});
  updateNowPlayingUI();
  showMiniPlayer(true);
  setMediaSession(song);
  renderAll();
}
function togglePlay(){
  if(!audio.src) return;
  if(audio.paused){ audio.play().then(()=>{isPlaying=true; updatePlayIcons();}); }
  else { audio.pause(); isPlaying=false; updatePlayIcons(); }
}
function stopPlayback(){
  audio.pause(); audio.removeAttribute('src'); isPlaying=false; queue=[]; queueIndex=-1;
  showMiniPlayer(false);
  els.fullPlayer.hidden = true;
}
function playNext(manual){
  if(!queue.length) return;
  if(skipLock) return; skipLock = true; setTimeout(()=>skipLock=false, 250);
  if(repeatMode==='one' && !manual){ audio.currentTime=0; audio.play(); return; }
  let idx = queueIndex;
  if(shuffle){ idx = Math.floor(Math.random()*queue.length); }
  else { idx = idx+1; if(idx>=queue.length){ if(repeatMode==='all'){ idx=0; } else { stopPlaybackAtEnd(); return; } } }
  queueIndex = idx;
  loadAndPlay(queue[queueIndex]);
}
function playPrev(){
  if(!queue.length) return;
  if(skipLock) return; skipLock = true; setTimeout(()=>skipLock=false, 250);
  if(audio.currentTime > 4){ audio.currentTime = 0; return; }
  let idx = queueIndex-1; if(idx<0) idx = queue.length-1;
  queueIndex = idx;
  loadAndPlay(queue[queueIndex]);
}
function stopPlaybackAtEnd(){
  isPlaying=false; updatePlayIcons();
}

audio.addEventListener('ended', ()=>{ if(settings.rememberPosition) savePosition(0); playNext(false); });
audio.addEventListener('timeupdate', ()=>{
  if(isSeeking) return;
  const d = audio.duration || 0;
  const pct = d ? (audio.currentTime/d*100) : 0;
  els.seekBar.value = pct;
  els.miniProgressFill.style.width = pct+'%';
  els.currentTime.textContent = fmtTime(audio.currentTime);
  els.duration.textContent = fmtTime(d);
  throttleSavePosition();
});
audio.addEventListener('loadedmetadata', ()=>{ els.duration.textContent = fmtTime(audio.duration); });
audio.addEventListener('play', ()=>{ isPlaying=true; updatePlayIcons(); });
audio.addEventListener('pause', ()=>{ isPlaying=false; updatePlayIcons(); });

let savePosTimer=null;
function throttleSavePosition(){
  if(savePosTimer) return;
  savePosTimer = setTimeout(()=>{ savePosTimer=null; if(settings.rememberPosition) savePosition(audio.currentTime); }, 2000);
}
async function savePosition(t){
  const id = queue[queueIndex];
  if(id==null) return;
  settings.lastPositions[id] = t;
  await dbPut('settings', {key:'lastPositions', value:settings.lastPositions});
}

function updatePlayIcons(){
  els.miniPlayBtn.innerHTML = isPlaying ? ICON_PAUSE : ICON_PLAY;
  els.playBtn.innerHTML = isPlaying ? ICON_PAUSE : ICON_PLAY;
  renderAll();
}
function updateNowPlayingUI(){
  const song = songs.find(s=>s.id===queue[queueIndex]);
  if(!song) return;
  const cover = coverFor(song);
  els.miniCover.src = cover; els.fullCover.src = cover;
  els.miniTitle.textContent = song.title; els.miniArtist.textContent = song.artist;
  els.fullTitle.textContent = song.title; els.fullArtist.textContent = song.artist;
  els.fullFavoriteBtn.innerHTML = song.favorite ? ICON_HEART_F : ICON_HEART_O;
  els.fullFavoriteBtn.classList.toggle('active', song.favorite);
}
function showMiniPlayer(show){ els.miniPlayer.hidden = !show; }

function setMediaSession(song){
  if(!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.title, artist: song.artist, album: song.album,
    artwork: [{src: coverFor(song), sizes:'200x200', type:'image/png'}]
  });
  navigator.mediaSession.setActionHandler('play', ()=>togglePlay());
  navigator.mediaSession.setActionHandler('pause', ()=>togglePlay());
  navigator.mediaSession.setActionHandler('previoustrack', ()=>playPrev());
  navigator.mediaSession.setActionHandler('nexttrack', ()=>playNext(true));
  navigator.mediaSession.setActionHandler('seekto', d=>{ if(d.seekTime!=null){ audio.currentTime = d.seekTime; } });
}

/* ---------- Player controls ---------- */
els.miniPlayBtn.addEventListener('click', e=>{ e.stopPropagation(); togglePlay(); });
$('#miniNextBtn').addEventListener('click', e=>{ e.stopPropagation(); playNext(true); });
els.miniPlayer.addEventListener('click', ()=>{ if(queue.length){ els.fullPlayer.hidden=false; } });
$('#collapsePlayerBtn').addEventListener('click', ()=>els.fullPlayer.hidden=true);
els.playBtn.addEventListener('click', togglePlay);
els.prevBtn.addEventListener('click', playPrev);
els.nextBtn.addEventListener('click', ()=>playNext(true));
els.fullFavoriteBtn.addEventListener('click', ()=>{ const id=queue[queueIndex]; if(id!=null) toggleFavorite(id); updateNowPlayingUI(); });

els.shuffleBtn.addEventListener('click', ()=>{ shuffle=!shuffle; els.shuffleBtn.classList.toggle('active', shuffle); });
els.repeatBtn.addEventListener('click', ()=>{
  repeatMode = repeatMode==='off' ? 'all' : repeatMode==='all' ? 'one' : 'off';
  els.repeatBtn.classList.toggle('active', repeatMode!=='off');
  els.repeatBtn.title = repeatMode;
});

els.seekBar.addEventListener('input', ()=>{ isSeeking = true; });
els.seekBar.addEventListener('change', ()=>{
  const d = audio.duration || 0;
  audio.currentTime = (els.seekBar.value/100) * d;
  isSeeking = false;
});
els.volumeBar.addEventListener('input', ()=>{ audio.volume = els.volumeBar.value/100; });

/* ---------- Settings ---------- */
$('#autoplayToggle').addEventListener('change', async e=>{
  settings.autoplay = e.target.checked;
  await dbPut('settings', {key:'autoplay', value:settings.autoplay});
});
$('#rememberPosToggle').addEventListener('change', async e=>{
  settings.rememberPosition = e.target.checked;
  await dbPut('settings', {key:'rememberPosition', value:settings.rememberPosition});
});
$('#clearLibraryBtn').addEventListener('click', async ()=>{
  if(!confirm('This will permanently delete all songs, playlists and favorites. Continue?')) return;
  stopPlayback();
  await Promise.all([dbClear('songs'), dbClear('playlists'), dbClear('settings')]);
  revokeAllUrls();
  songs = []; playlists = []; settings = {autoplay:true, rememberPosition:true, lastPositions:{}};
  $('#autoplayToggle').checked = true; $('#rememberPosToggle').checked = true;
  activePlaylistId = null;
  showView('home');
  renderAll(); updateStorageInfo();
  toast('Library cleared');
});
async function updateStorageInfo(){
  if(navigator.storage && navigator.storage.estimate){
    try{
      const est = await navigator.storage.estimate();
      const mb = (est.usage/1048576).toFixed(1);
      els.storageInfo.textContent = `${mb} MB used · ${songs.length} songs`;
    }catch(_){ els.storageInfo.textContent = `${songs.length} songs stored`; }
  } else {
    els.storageInfo.textContent = `${songs.length} songs stored`;
  }
}

/* Respect autoplay setting: only auto-advance queue when enabled, otherwise stop after track ends */
const _origPlayNext = playNext;
playNext = function(manual){
  if(!manual && !settings.autoplay && repeatMode==='off'){ isPlaying=false; updatePlayIcons(); return; }
  _origPlayNext(manual);
};
