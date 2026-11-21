const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w342";
const IMG_BIG = "https://image.tmdb.org/t/p/w1280";
const $ = id => document.getElementById(id);
const fallback = [
  {id:1,title:"فيلم تجريبي 1",release_date:"2024-01-01",vote_average:8.1,overview:"أضف مفتاح TMDB في config.js لعرض أفلام حقيقية.",genre_ids:[],poster_path:null},
  {id:2,title:"فيلم تجريبي 2",release_date:"2023-01-01",vote_average:7.4,overview:"أضف مفتاح TMDB في config.js لعرض أفلام حقيقية.",genre_ids:[],poster_path:null}
];
let genres = [], movies = [], genre = 0, query = "", timer;

const get = (path, params = {}) => {
  const qs = new URLSearchParams({api_key: TMDB_API_KEY, language: "ar", ...params});
  return fetch(`${API}${path}?${qs}`).then(r => { if(!r.ok) throw new Error(r.status); return r.json(); });
};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const year = m => (m.release_date || "").slice(0,4) || "—";
const poster = m => m.poster_path
  ? `<img class="poster" loading="lazy" src="${IMG+m.poster_path}" alt="${esc(m.title)}">`
  : `<div class="poster">${esc(m.title)}</div>`;

function renderFilters(){
  const all = [{id:0,name:"الكل"}, ...genres];
  $("filters").innerHTML = all.map(x =>
    `<button class="chip ${x.id===genre?"on":""}" data-g="${x.id}">${esc(x.name)}</button>`).join("");
}
function renderGrid(){
  $("empty").hidden = movies.length > 0;
  $("grid").innerHTML = movies.map(m => `
    <article class="card" data-id="${m.id}">${poster(m)}
      <div class="info"><b>${esc(m.title)}</b><span>${year(m)} · <span class="rate">★ ${(m.vote_average||0).toFixed(1)}</span></span></div>
    </article>`).join("");
}
function renderHero(m){
  if(!m) return;
  if(m.backdrop_path) $("hero").style.setProperty("--hero", `url(${IMG_BIG+m.backdrop_path}) center/cover`);
  $("hero").innerHTML = `<h2>${esc(m.title)}</h2><p>${esc((m.overview||"").slice(0,220))}</p>
    <button class="btn" data-id="${m.id}">التفاصيل</button>`;
}
async function load(){
  if(!TMDB_API_KEY){ movies = fallback; renderHero(movies[0]); renderFilters(); renderGrid(); return; }
  try{
    $("sectionTitle").textContent = query ? `نتائج: ${query}` : (genre ? (genres.find(x=>x.id===genre)||{}).name : "الأكثر شعبية");
    const data = query ? await get("/search/movie",{query})
      : genre ? await get("/discover/movie",{with_genres:genre,sort_by:"popularity.desc"})
      : await get("/movie/popular");
    movies = data.results;
    if(!query && !genre) renderHero(movies[0]);
    renderGrid();
  }catch(e){ $("grid").innerHTML = ""; $("empty").hidden = false; $("empty").textContent = "تعذّر التحميل، تأكد من المفتاح والاتصال."; }
}
async function openMovie(id){
  let m = movies.find(x => x.id == id) || {};
  if(TMDB_API_KEY){
    try{ m = await get(`/movie/${id}`,{append_to_response:"videos"}); }catch(e){}
  }
  const vids = (m.videos && m.videos.results) || [];
  const t = vids.find(v => v.site==="YouTube" && v.type==="Trailer") || vids.find(v => v.site==="YouTube");
  const q = encodeURIComponent(m.title + " " + year(m) + " trailer");
  const trailer = t ? `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${t.key}" allowfullscreen style="border:0;border-radius:8px"></iframe>`
    : `<a class="btn" style="display:inline-block;text-decoration:none" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${q}">▶ شاهد الإعلان</a>`;
  $("details").innerHTML = `<h2>${esc(m.title)}</h2>
    <p class="meta">${year(m)}${m.runtime?` · ${m.runtime} دقيقة`:""}${m.genres?` · ${m.genres.map(x=>esc(x.name)).join("، ")}`:""} · <span class="rate">★ ${(m.vote_average||0).toFixed(1)}</span></p>
    <p>${esc(m.overview) || "لا يوجد وصف بالعربية."}</p><br>${trailer}`;
  $("modal").hidden = false;
}
function closeModal(){ $("modal").hidden = true; $("details").innerHTML = ""; }

$("filters").onclick = e => { const b = e.target.closest("[data-g]"); if(b){ genre=+b.dataset.g; query=""; $("search").value=""; renderFilters(); load(); } };
$("search").oninput = e => { clearTimeout(timer); timer = setTimeout(() => { query = e.target.value.trim(); load(); }, 400); };
document.addEventListener("click", e => { const t = e.target.closest("[data-id]"); if(t) openMovie(t.dataset.id); });
$("close").onclick = closeModal;
$("modal").onclick = e => { if(e.target.id==="modal") closeModal(); };
document.addEventListener("keydown", e => { if(e.key==="Escape") closeModal(); });

(async () => {
  if(TMDB_API_KEY){ try{ genres = (await get("/genre/movie/list")).genres; }catch(e){} }
  renderFilters(); load();
})();
