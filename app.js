const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w342";
const IMG_BIG = "https://image.tmdb.org/t/p/w1280";
const $ = id => document.getElementById(id);

// الأقسام: النوع (movie/tv) + مسار التحميل + فلتر اللغة
const SECTIONS = {
  home:    {title:"الأكثر شعبية",  kind:"movie", path:"/movie/popular"},
  foreign: {title:"أفلام أجنبي",   kind:"movie", path:"/discover/movie", params:{with_original_language:"en", sort_by:"popularity.desc"}},
  arabic:  {title:"أفلام عربي",    kind:"movie", path:"/discover/movie", params:{with_original_language:"ar", sort_by:"popularity.desc"}},
  series:  {title:"مسلسلات",       kind:"tv",    path:"/tv/popular"},
  mine:    {title:"أفلامنا",        kind:"movie", local:true}
};
const fallback = [
  {id:1,title:"فيلم تجريبي 1",release_date:"2024-01-01",vote_average:8.1,overview:"أضف مفتاح TMDB في config.js لعرض أفلام حقيقية.",poster_path:null},
  {id:2,title:"فيلم تجريبي 2",release_date:"2023-01-01",vote_average:7.4,overview:"أضف مفتاح TMDB في config.js لعرض أفلام حقيقية.",poster_path:null}
];
let genresByKind = {movie:[], tv:[]}, items = [], section = "home", genre = 0, query = "", timer;

const get = (path, params = {}) => {
  const qs = new URLSearchParams({api_key: TMDB_API_KEY, language: "ar", ...params});
  return fetch(`${API}${path}?${qs}`).then(r => { if(!r.ok) throw new Error(r.status); return r.json(); });
};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const name = m => m.title || m.name || "";
const year = m => (m.release_date || m.first_air_date || "").slice(0,4) || "—";
const kind = () => SECTIONS[section].kind;
const mine = () => (typeof MY_MOVIES !== "undefined" ? MY_MOVIES : []).map((m,i) => ({
  id:"my"+i, title:m.title, release_date:String(m.year||""), overview:m.desc||"", poster_path:null,
  poster_url:m.poster||"", video:m.video||"", vote_average:0, own:true
}));
function playerHtml(url){
  url = (url||"").trim();
  let m;
  if((m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)))
    return `<iframe src="https://www.youtube.com/embed/${m[1]}" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  if((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)))
    return `<iframe src="https://player.vimeo.com/video/${m[1]}" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  if((m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/)))
    return `<iframe src="https://drive.google.com/file/d/${m[1]}/preview" allow="fullscreen" allowfullscreen></iframe>`;
  if(/\.(mp4|webm|ogg)(\?|$)/i.test(url))
    return `<video src="${esc(url)}" controls playsinline></video>`;
  if(/^https:\/\//.test(url)) return `<iframe src="${esc(url)}" allow="fullscreen" allowfullscreen></iframe>`;
  return `<p class="empty">لا يوجد رابط فيديو لهذا الفيلم.</p>`;
}
const poster = m => m.poster_url
  ? `<img class="poster" loading="lazy" src="${esc(m.poster_url)}" alt="${esc(name(m))}">`
  : m.poster_path
  ? `<img class="poster" loading="lazy" src="${IMG+m.poster_path}" alt="${esc(name(m))}">`
  : `<div class="poster">${esc(name(m))}</div>`;

function renderFilters(){
  $("filters").hidden = !!SECTIONS[section].local;
  if(SECTIONS[section].local){ $("filters").innerHTML = ""; return; }
  const all = [{id:0,name:"الكل"}, ...genresByKind[kind()]];
  $("filters").innerHTML = all.map(x =>
    `<button class="chip ${x.id===genre?"on":""}" data-g="${x.id}">${esc(x.name)}</button>`).join("");
}
function renderTabs(){
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.s === section));
}
function renderGrid(){
  $("empty").hidden = items.length > 0;
  $("grid").innerHTML = items.map(m => `
    <article class="card" data-id="${m.id}" data-k="${m.media_type || kind()}">${poster(m)}
      <div class="info"><b>${esc(name(m))}</b><span>${year(m)} · <span class="rate">★ ${(m.vote_average||0).toFixed(1)}</span></span></div>
    </article>`).join("");
}
function renderHero(m){
  if(!m) return;
  if(m.backdrop_path) $("hero").style.setProperty("--hero", `url(${IMG_BIG+m.backdrop_path}) center/cover`);
  $("hero").innerHTML = `<h2>${esc(name(m))}</h2><p>${esc((m.overview||"").slice(0,220))}</p>
    <button class="btn" data-id="${m.id}" data-k="${m.media_type || kind()}">التفاصيل</button>`;
}
async function load(){
  if(SECTIONS[section].local){
    items = mine(); query = ""; $("sectionTitle").textContent = SECTIONS[section].title;
    $("hero").innerHTML = ""; $("hero").style.removeProperty("--hero");
    renderGrid();
    $("empty").textContent = "لا توجد أفلام بعد. أضف أفلامك في ملف movies.js.";
    return;
  }
  if(!TMDB_API_KEY){ items = fallback; renderHero(items[0]); renderGrid(); return; }
  const s = SECTIONS[section];
  try{
    $("sectionTitle").textContent = query ? `نتائج: ${query}` : s.title;
    let data;
    if(query) data = await get("/search/multi",{query});
    else if(genre) data = await get(`/discover/${s.kind}`,{...(s.params||{}), with_genres:genre, sort_by:"popularity.desc"});
    else data = await get(s.path, s.params||{});
    items = data.results.filter(m => !m.media_type || m.media_type !== "person");
    if(!query && !genre) renderHero(items[0]);
    renderGrid();
  }catch(e){ $("grid").innerHTML = ""; $("empty").hidden = false; $("empty").textContent = "تعذّر التحميل، تأكد من المفتاح والاتصال."; }
}
async function openItem(id, k){
  let m = items.find(x => x.id == id) || {};
  if(m.own){
    $("details").innerHTML = `<h2>${esc(name(m))}</h2>
      <p class="meta">${esc(year(m))}</p>
      <div class="player">${playerHtml(m.video)}</div>
      <p>${esc(m.overview)}</p>`;
    $("modal").hidden = false;
    return;
  }
  if(TMDB_API_KEY){
    try{ m = await get(`/${k}/${id}`,{append_to_response:"videos"}); }catch(e){}
  }
  const vids = (m.videos && m.videos.results) || [];
  const t = vids.find(v => v.site==="YouTube" && v.type==="Trailer") || vids.find(v => v.site==="YouTube");
  const q = encodeURIComponent(name(m) + " " + year(m) + " trailer");
  const trailer = t ? `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${t.key}" allowfullscreen style="border:0;border-radius:8px"></iframe>`
    : `<a class="btn" style="display:inline-block;text-decoration:none" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${q}">▶ شاهد الإعلان</a>`;
  const len = m.runtime ? ` · ${m.runtime} دقيقة` : (m.number_of_seasons ? ` · ${m.number_of_seasons} مواسم` : "");
  $("details").innerHTML = `<h2>${esc(name(m))}</h2>
    <p class="meta">${year(m)}${len}${m.genres?` · ${m.genres.map(x=>esc(x.name)).join("، ")}`:""} · <span class="rate">★ ${(m.vote_average||0).toFixed(1)}</span></p>
    <p>${esc(m.overview) || "لا يوجد وصف بالعربية."}</p><br>${trailer}`;
  $("modal").hidden = false;
}
function closeModal(){ $("modal").hidden = true; $("details").innerHTML = ""; }

$("menu").onclick = e => { const b = e.target.closest("[data-s]"); if(b){ section=b.dataset.s; genre=0; query=""; $("search").value=""; renderTabs(); renderFilters(); load(); } };
$("filters").onclick = e => { const b = e.target.closest("[data-g]"); if(b){ genre=+b.dataset.g; query=""; $("search").value=""; renderFilters(); load(); } };
$("search").oninput = e => { clearTimeout(timer); timer = setTimeout(() => { query = e.target.value.trim(); load(); }, 400); };
document.addEventListener("click", e => { const t = e.target.closest("[data-id]"); if(t) openItem(t.dataset.id, t.dataset.k || "movie"); });
$("close").onclick = closeModal;
$("modal").onclick = e => { if(e.target.id==="modal") closeModal(); };
document.addEventListener("keydown", e => { if(e.key==="Escape") closeModal(); });

(async () => {
  if(TMDB_API_KEY){
    try{ genresByKind.movie = (await get("/genre/movie/list")).genres; }catch(e){}
    try{ genresByKind.tv = (await get("/genre/tv/list")).genres; }catch(e){}
  }
  renderFilters(); load();
})();
