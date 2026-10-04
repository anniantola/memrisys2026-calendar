
(() => {
  const DATA = window.CONFERENCE_DATA;
  const STORAGE_KEY = "memristorCalendarStateV1";
  const defaultState = {
    favorites: [],
    posterFavorites: [],
    theme: "system",
    compact: false,
    timeMode: "conference",
    room: "all",
    day: 1,
    posterCategory: "all",
    view: "program"
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const byId = new Map(DATA.schedule.map(x => [x.id, x]));
  const posterById = new Map(DATA.posters.map(x => [x.id, x]));
  let currentModal = null;
  let deferredInstallPrompt = null;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {...defaultState, ...saved};
    } catch {
      return {...defaultState};
    }
  }
  let state = loadState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function esc(v="") {
    return String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  }

  function conferenceNowParts() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date());
    const get = t => parts.find(p => p.type === t)?.value || "";
    return {date:`${get("year")}-${get("month")}-${get("day")}`, time:`${get("hour")}:${get("minute")}`};
  }

  function detectConferenceDay() {
    const n = conferenceNowParts();
    const d = DATA.days.find(x => x.date === n.date);
    return d ? d.day : 1;
  }

  function applyTheme() {
    const dark = state.theme === "dark" ||
      (state.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.classList.toggle("compact", !!state.compact);
    document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#000000" : "#f3f4f6");
  }

  function timeValue(t) {
    const [h,m] = t.split(":").map(Number);
    return h*60+m;
  }

  function fmtTime(event, which="start") {
    const raw = event[which];
    if (state.timeMode === "conference" || !raw) return raw;
    const iso = `${event.date}T${raw}:00+02:00`;
    return new Intl.DateTimeFormat(undefined, {hour:"2-digit", minute:"2-digit"}).format(new Date(iso));
  }

  function eventTimeLabel(event) {
    return `${fmtTime(event,"start")}–${fmtTime(event,"end")}`;
  }

  function renderDays() {
    $("#dayTabs").innerHTML = DATA.days.map(d => `
      <button class="day-tab ${state.day===d.day?"active":""}" data-day="${d.day}">
        <strong>${esc(d.weekday.slice(0,3))}</strong>
        <span>${esc(d.dateLabel)}</span>
      </button>`).join("");
    $$(".day-tab").forEach(btn => btn.addEventListener("click", () => {
      state.day = Number(btn.dataset.day);
      saveState();
      renderDays();
      renderProgram();
      window.scrollTo({top:0, behavior:"smooth"});
    }));
  }

  function searchTextEvent(e) {
    return [e.title,e.speaker,e.affiliation,e.session,e.chair,e.room].join(" ").toLowerCase();
  }

  function statusForSelectedDay() {
    const now = conferenceNowParts();
    const day = DATA.days.find(d => d.day === state.day);
    const events = DATA.schedule.filter(e => e.day===state.day).sort((a,b)=>timeValue(a.start)-timeValue(b.start));
    const first = events[0];
    const last = events.reduce((a,b)=>timeValue(a.end)>timeValue(b.end)?a:b, events[0]);

    if (now.date < DATA.days[0].date) {
      return {title:`Conference starts ${DATA.days[0].weekday}`, sub:`First item ${DATA.days[0].dateLabel} at ${first.start} · Darmstadt time`};
    }
    if (now.date > DATA.days.at(-1).date) {
      return {title:"Conference finished", sub:"Your starred talks and posters remain saved on this device."};
    }
    if (day.date !== now.date) {
      return {title:`${day.weekday}, ${day.dateLabel}`, sub:`${events.length} program items · ${first.start}–${last.end} · Darmstadt`};
    }
    const minute = timeValue(now.time);
    const current = events.filter(e => timeValue(e.start) <= minute && minute < timeValue(e.end));
    if (current.length) {
      const names = current.map(e => e.title).join(" · ");
      return {title:"Happening now", sub:names};
    }
    const next = events.find(e => timeValue(e.start) > minute);
    if (next) return {title:`Next at ${fmtTime(next,"start")}`, sub:next.title};
    return {title:"Program finished for today", sub:`Last scheduled item ended at ${last.end}.`};
  }

  function renderStatus() {
    const s = statusForSelectedDay();
    $("#statusCard").innerHTML = `<div class="status-line"><span class="status-dot"></span><div><div class="status-title">${esc(s.title)}</div><div class="status-sub">${esc(s.sub)}</div></div></div>`;
  }

  function roomPill(room) {
    if (!room) return "";
    return `<span class="pill ${esc(room.toLowerCase())}">${esc(room)}</span>`;
  }

  function eventCard(e, conflict=false) {
    const fav = state.favorites.includes(e.id);
    const session = e.session ? `<span class="pill">${esc(e.session)}</span>` : "";
    const person = e.speaker ? `${esc(e.speaker)}${e.affiliation ? ` · ${esc(e.affiliation)}` : ""}` : "";
    return `
      <article class="event-card track-${e.track} kind-${esc(e.kind)}" data-event="${e.id}" tabindex="0">
        <button class="star-btn ${fav?"on":""}" data-star-event="${e.id}" aria-label="${fav?"Remove from":"Add to"} my schedule">${fav?"★":"☆"}</button>
        <div class="card-kicker">${roomPill(e.room)}${session}</div>
        <div class="event-title">${esc(e.title)}</div>
        ${person?`<div class="event-person">${person}</div>`:""}
        ${conflict?`<div class="conflict-note">Overlaps another starred item</div>`:""}
      </article>`;
  }

  function bindEventCards(scope=document) {
    scope.querySelectorAll("[data-event]").forEach(card => {
      const open = () => openEvent(card.dataset.event);
      card.addEventListener("click", (ev) => {
        if (ev.target.closest("[data-star-event]")) return;
        open();
      });
      card.addEventListener("keydown", (ev) => {
        if ((ev.key==="Enter" || ev.key===" ") && !ev.target.closest("button")) { ev.preventDefault(); open(); }
      });
    });
    scope.querySelectorAll("[data-star-event]").forEach(btn => {
      btn.addEventListener("click", ev => {
        ev.stopPropagation();
        toggleEventFavorite(btn.dataset.starEvent);
      });
    });
  }

  function renderProgram() {
    renderStatus();
    const q = $("#programSearch").value.trim().toLowerCase();
    let events = DATA.schedule.filter(e => q ? searchTextEvent(e).includes(q) : e.day===state.day);
    if (state.room !== "all") events = events.filter(e => !e.room || e.room.toLowerCase()===state.room);
    events.sort((a,b) => a.date.localeCompare(b.date) || timeValue(a.start)-timeValue(b.start) || a.track-b.track);

    $("#programMeta").innerHTML = `<span>${q ? `${events.length} search results` : `${events.length} program items`}</span><span>${state.timeMode==="conference"?"Darmstadt time":"Device time"}</span>`;

    if (!events.length) {
      $("#programList").innerHTML = `<div class="empty-state"><strong>No matches</strong>Try another search or room filter.</div>`;
      return;
    }

    const groups = new Map();
    events.forEach(e => {
      const key = q ? `${e.date}|${e.start}` : e.start;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    });

    $("#programList").innerHTML = [...groups.entries()].map(([key,items]) => {
      const first = items[0];
      const dayPrefix = q ? `<small>${esc(first.weekday.slice(0,3))} ${esc(first.dateLabel)}</small>` : "";
      const endTimes = [...new Set(items.map(x => fmtTime(x,"end")))];
      const span = endTimes.length===1 ? endTimes[0] : "";
      const common = items.some(x => x.track===0);
      return `<div class="time-group">
        <div class="time-label">${esc(fmtTime(first,"start"))}${span?`<small>to ${esc(span)}</small>`:""}${dayPrefix}</div>
        <div class="event-grid ${common||items.length===1?"single":""}">
          ${items.map(e=>eventCard(e)).join("")}
        </div>
      </div>`;
    }).join("");
    bindEventCards($("#programList"));
  }

  function intervalsOverlap(a,b) {
    return a.day===b.day && timeValue(a.start) < timeValue(b.end) && timeValue(b.start) < timeValue(a.end);
  }

  function renderMySchedule() {
    const favEvents = state.favorites.map(id=>byId.get(id)).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date)||timeValue(a.start)-timeValue(b.start));
    const favPosters = state.posterFavorites.map(id=>posterById.get(id)).filter(Boolean).sort((a,b)=>a.number-b.number);
    $("#favoriteCount").textContent = favEvents.length + favPosters.length;

    if (!favEvents.length && !favPosters.length) {
      $("#mySchedule").innerHTML = `<div class="empty-state"><strong>Nothing starred yet</strong>Tap ☆ on talks or posters to build a personal agenda.</div>`;
      return;
    }

    const conflictIds = new Set();
    for (let i=0;i<favEvents.length;i++) for (let j=i+1;j<favEvents.length;j++) {
      if (intervalsOverlap(favEvents[i],favEvents[j])) { conflictIds.add(favEvents[i].id); conflictIds.add(favEvents[j].id); }
    }

    const byDay = new Map();
    favEvents.forEach(e => {
      if (!byDay.has(e.day)) byDay.set(e.day,[]);
      byDay.get(e.day).push(e);
    });

    let html = [...byDay.entries()].map(([day,items]) => {
      const meta = DATA.days.find(d=>d.day===day);
      return `<section class="my-day">
        <div class="my-day-head">${esc(meta.weekday)} · ${esc(meta.dateLabel)}</div>
        <div class="timeline">
          ${items.map(e=>`<div class="time-group"><div class="time-label">${esc(fmtTime(e,"start"))}<small>to ${esc(fmtTime(e,"end"))}</small></div><div class="event-grid single">${eventCard(e,conflictIds.has(e.id))}</div></div>`).join("")}
        </div>
      </section>`;
    }).join("");

    if (favPosters.length) {
      html += `<section class="my-day"><div class="my-day-head">Starred posters · Tuesday 18:00–20:00</div><div class="poster-list">
        ${favPosters.map(p=>posterCard(p)).join("")}
      </div></section>`;
    }
    $("#mySchedule").innerHTML = html;
    bindEventCards($("#mySchedule"));
    bindPosterCards($("#mySchedule"));
  }

  function posterSearchText(p) {
    return [p.number,p.title,p.author,p.affiliation,p.category,p.presentingAuthor,p.correspondingAuthor,p.abstract].filter(Boolean).join(" ").toLowerCase();
  }

  function posterCard(p) {
    const fav = state.posterFavorites.includes(p.id);
    return `<article class="poster-card" data-poster="${p.id}" tabindex="0">
      <button class="star-btn ${fav?"on":""}" data-star-poster="${p.id}" aria-label="${fav?"Remove from":"Add to"} starred posters">${fav?"★":"☆"}</button>
      <div class="poster-top"><span class="poster-number">#${p.number}</span><span class="pill">${esc(p.category)}</span></div>
      <div class="poster-title">${esc(p.title)}</div>
      <div class="poster-author">${esc(p.author)}${p.affiliation?` · ${esc(p.affiliation)}`:""}</div>
    </article>`;
  }

  function bindPosterCards(scope=document) {
    scope.querySelectorAll("[data-poster]").forEach(card => {
      const open = () => openPoster(card.dataset.poster);
      card.addEventListener("click", ev => {
        if (ev.target.closest("[data-star-poster]")) return;
        open();
      });
      card.addEventListener("keydown", ev => {
        if ((ev.key==="Enter"||ev.key===" ") && !ev.target.closest("button")) { ev.preventDefault(); open(); }
      });
    });
    scope.querySelectorAll("[data-star-poster]").forEach(btn => {
      btn.addEventListener("click", ev => {
        ev.stopPropagation();
        togglePosterFavorite(btn.dataset.starPoster);
      });
    });
  }

  function renderPosters() {
    const q = $("#posterSearch").value.trim().toLowerCase();
    let posters = DATA.posters.filter(p => !q || posterSearchText(p).includes(q));
    if (state.posterCategory !== "all") posters = posters.filter(p => p.category===state.posterCategory);
    $("#posterMeta").innerHTML = `<span>${posters.length} posters</span><span>${state.posterFavorites.length} starred</span>`;
    $("#posterList").innerHTML = posters.length ? posters.map(p=>posterCard(p)).join("") :
      `<div class="empty-state"><strong>No matches</strong>Try another search or category.</div>`;
    bindPosterCards($("#posterList"));
  }

  function toggleEventFavorite(id) {
    state.favorites = state.favorites.includes(id) ? state.favorites.filter(x=>x!==id) : [...state.favorites,id];
    saveState(); renderProgram(); renderMySchedule();
    if (currentModal?.type==="event" && currentModal.id===id) refreshModalStar();
  }

  function togglePosterFavorite(id) {
    state.posterFavorites = state.posterFavorites.includes(id) ? state.posterFavorites.filter(x=>x!==id) : [...state.posterFavorites,id];
    saveState(); renderPosters(); renderMySchedule();
    if (currentModal?.type==="poster" && currentModal.id===id) refreshModalStar();
  }

  function refreshModalStar() {
    const on = currentModal?.type==="event"
      ? state.favorites.includes(currentModal.id)
      : state.posterFavorites.includes(currentModal.id);
    $("#modalStar").classList.toggle("on",on);
    $("#modalStar").textContent = on ? "★" : "☆";
  }

  function openEvent(id) {
    const e = byId.get(id); if (!e) return;
    currentModal = {type:"event",id};
    $("#modalContent").innerHTML = `
      <div class="modal-kicker">${roomPill(e.room)}${e.session?`<span class="pill">${esc(e.session)}</span>`:""}<span class="pill">${esc(e.weekday)} ${esc(e.dateLabel)}</span></div>
      <div class="modal-title">${esc(e.title)}</div>
      ${e.speaker?`<div class="modal-person">${esc(e.speaker)}</div>`:""}
      ${e.affiliation?`<div class="modal-aff">${esc(e.affiliation)}</div>`:""}
      <div class="modal-details">
        <div class="detail-box"><span>Time</span><strong>${esc(eventTimeLabel(e))}</strong></div>
        <div class="detail-box"><span>Room</span><strong>${esc(e.room || "—")}</strong></div>
        ${e.chair?`<div class="detail-box"><span>Session chair</span><strong>${esc(e.chair)}</strong></div>`:""}
        <div class="detail-box"><span>Program</span><strong>PDF page ${e.sourcePage}</strong></div>
      </div>
      <a class="pdf-link" href="./program.pdf#page=${e.sourcePage}" target="_blank" rel="noopener">Open this page in the PDF ↗</a>`;
    refreshModalStar();
    $("#detailModal").showModal();
  }

  function openPoster(id) {
    const p = posterById.get(id); if (!p) return;
    currentModal = {type:"poster",id};
    const abstractHtml = (p.abstract || "").split(/\n\s*\n/).filter(Boolean).map(x=>`<p>${esc(x)}</p>`).join("");
    $("#modalContent").innerHTML = `
      <div class="modal-kicker"><span class="pill">Poster #${p.number}</span><span class="pill">${esc(p.category)}</span><span class="pill">Abstract p. ${p.abstractBookPage}</span></div>
      <div class="modal-title">${esc(p.title)}</div>
      <div class="modal-person">${esc(p.author)}</div>
      <div class="modal-aff">${esc(p.affiliation)}</div>
      <div class="modal-details">
        <div class="detail-box"><span>Session</span><strong>Tuesday 6 October · 18:00–20:00</strong></div>
        <div class="detail-box"><span>Venue</span><strong>Staatsarchiv</strong></div>
        <div class="detail-box"><span>Presenting author</span><strong>${esc(p.presentingAuthor || p.author || "—")}</strong></div>
        <div class="detail-box"><span>Corresponding author</span><strong>${esc(p.correspondingAuthor || "—")}</strong></div>
        <div class="detail-box"><span>Program</span><strong>PDF page ${p.sourcePage}</strong></div>
        <div class="detail-box"><span>Book of Abstracts</span><strong>Page ${p.abstractBookPage}</strong></div>
      </div>
      ${p.abstract ? `<section class="abstract-section"><h3>Abstract</h3><div class="abstract-text">${abstractHtml}</div></section>` : ""}
      <a class="pdf-link" href="./program.pdf#page=${p.sourcePage}" target="_blank" rel="noopener">Open this poster in the program PDF ↗</a>`;
    refreshModalStar();
    $("#detailModal").showModal();
  }

  function showView(name) {
    state.view = name; saveState();
    $$(".view").forEach(v => v.classList.toggle("active",v.dataset.view===name));
    $$(".nav-btn").forEach(b => b.classList.toggle("active",b.dataset.target===name));
    if (name==="my") renderMySchedule();
    if (name==="posters") renderPosters();
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function toast(msg) {
    const t=$("#toast"); t.textContent=msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("show"),1800);
  }

  function exportState() {
    const payload = {version:1, exportedAt:new Date().toISOString(), state:{
      favorites:state.favorites, posterFavorites:state.posterFavorites,
      theme:state.theme, compact:state.compact, timeMode:state.timeMode
    }};
    const blob = new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download="memristor-calendar-backup.json"; a.click(); URL.revokeObjectURL(a.href);
  }

  async function importState(file) {
    try {
      const payload=JSON.parse(await file.text());
      const incoming=payload.state||payload;
      state={...state,...incoming};
      state.favorites=(state.favorites||[]).filter(id=>byId.has(id));
      state.posterFavorites=(state.posterFavorites||[]).filter(id=>posterById.has(id));
      saveState(); applyTheme(); syncSettings(); renderProgram(); renderPosters(); renderMySchedule();
      toast("Backup imported");
    } catch { toast("Could not import that file"); }
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function updateInstallUI() {
    const btn = $("#installBtn");
    const help = $("#installHelp");
    if (!btn || !help) return;

    if (isStandalone()) {
      btn.textContent = "Installed";
      btn.disabled = true;
      help.textContent = "This planner is already running as an installed app.";
      return;
    }

    btn.disabled = false;
    btn.textContent = "Install";

    if (deferredInstallPrompt) {
      help.textContent = "Install this planner on your home screen for app-like access.";
    } else {
      help.textContent = "If no prompt opens, use your browser menu and choose Install app or Add to Home screen.";
    }
  }

  async function installApp() {
    if (isStandalone()) {
      updateInstallUI();
      return;
    }

    if (deferredInstallPrompt) {
      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      await promptEvent.prompt();
      try { await promptEvent.userChoice; } catch {}
      updateInstallUI();
      return;
    }

    toast("Use browser menu → Install app / Add to Home screen");
    updateInstallUI();
  }

  function syncSettings() {
    $("#themeSelect").value=state.theme;
    $("#timeModeSelect").value=state.timeMode;
    $("#compactToggle").setAttribute("aria-checked",state.compact?"true":"false");
    $$("#roomFilters .chip").forEach(x=>x.classList.toggle("active",x.dataset.room===state.room));
    $$("#posterFilters .chip").forEach(x=>x.classList.toggle("active",x.dataset.category===state.posterCategory));
  }

  function wire() {
    $("#programSearch").addEventListener("input",renderProgram);
    $("#posterSearch").addEventListener("input",renderPosters);

    $$("#roomFilters .chip").forEach(btn => btn.addEventListener("click",()=>{
      state.room=btn.dataset.room; saveState(); syncSettings(); renderProgram();
    }));
    $$("#posterFilters .chip").forEach(btn => btn.addEventListener("click",()=>{
      state.posterCategory=btn.dataset.category; saveState(); syncSettings(); renderPosters();
    }));
    $$(".nav-btn").forEach(btn=>btn.addEventListener("click",()=>showView(btn.dataset.target)));

    $("#nowBtn").addEventListener("click",()=>{
      state.day=detectConferenceDay(); saveState(); renderDays(); renderProgram(); showView("program");
    });

    $("#themeSelect").addEventListener("change",e=>{state.theme=e.target.value;saveState();applyTheme();});
    $("#timeModeSelect").addEventListener("change",e=>{state.timeMode=e.target.value;saveState();renderProgram();renderMySchedule();});
    $("#compactToggle").addEventListener("click",()=>{
      state.compact=!state.compact;saveState();applyTheme();syncSettings();
    });
    $("#exportBtn").addEventListener("click",exportState);
    $("#importBtn").addEventListener("click",()=>$("#importInput").click());
    $("#importInput").addEventListener("change",e=>{if(e.target.files[0])importState(e.target.files[0]);e.target.value="";});
    $("#installBtn").addEventListener("click", installApp);

    $("#clearBtn").addEventListener("click",()=>{
      if (!state.favorites.length && !state.posterFavorites.length) return toast("No favorites to clear");
      if (confirm("Clear all starred talks and posters?")) {
        state.favorites=[];state.posterFavorites=[];saveState();renderProgram();renderPosters();renderMySchedule();toast("Favorites cleared");
      }
    });

    $("#modalClose").addEventListener("click",()=>$("#detailModal").close());
    $("#detailModal").addEventListener("click",e=>{ if(e.target===$("#detailModal")) $("#detailModal").close(); });
    $("#modalStar").addEventListener("click",()=>{
      if (!currentModal) return;
      currentModal.type==="event" ? toggleEventFavorite(currentModal.id) : togglePosterFavorite(currentModal.id);
    });

    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{if(state.theme==="system")applyTheme();});
  }

  function init() {
    state.day = state.day || detectConferenceDay();
    applyTheme();
    renderDays();
    syncSettings();
    wire();
    renderProgram();
    renderPosters();
    renderMySchedule();
    showView(state.view || "program");
    updateInstallUI();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js", { scope: "./", updateViaCache: "none" }).catch(()=>{});
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallUI();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    updateInstallUI();
    toast("App installed");
  });

  init();
})();
