
(() => {
  const DATA = window.CONFERENCE_DATA;
  const STORAGE_KEY = "memristorCalendarStateV1";
  const PHOTO_DB = "memrisysPhotoDB";
  const PHOTO_STORE = "photos";
  const defaultState = {
    favorites: [],
    posterFavorites: [],
    theme: "system",
    compact: false,
    timeMode: "conference",
    room: "all",
    day: 1,
    posterCategory: "all",
    view: "program",
    notes: {}
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const byId = new Map(DATA.schedule.map(x => [x.id, x]));
  const posterById = new Map(DATA.posters.map(x => [x.id, x]));
  let currentModal = null;
  let deferredInstallPrompt = null;
  let pendingPhotoImports = [];
  let galleryObjectUrls = [];
  let modalPhotoObjectUrls = [];

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


  function noteKey(type, id) {
    return `${type}:${id}`;
  }

  function getNote(type, id) {
    return String(state.notes?.[noteKey(type,id)] || "");
  }

  function saveNote(type, id, value) {
    if (!state.notes || typeof state.notes !== "object" || Array.isArray(state.notes)) {
      state.notes = {};
    }
    const key = noteKey(type,id);
    const text = String(value || "");
    if (text.trim()) state.notes[key] = text;
    else delete state.notes[key];
    saveState();
  }

  function noteSectionHtml(type, id) {
    return `<section class="notes-section">
      <div class="notes-section-head">
        <h3>Notes</h3>
        <span id="noteSaveStatus" class="note-save-status">Saved automatically</span>
      </div>
      <textarea
        id="modalNote"
        class="presentation-note"
        rows="5"
        placeholder="Write notes about this presentation…"
        spellcheck="true"
        data-note-type="${esc(type)}"
        data-note-id="${esc(id)}"
      >${esc(getNote(type,id))}</textarea>
    </section>`;
  }

  function openPhotoDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(PHOTO_DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PHOTO_STORE)) {
          const store = db.createObjectStore(PHOTO_STORE, {keyPath:"id", autoIncrement:true});
          store.createIndex("ownerKey", "ownerKey", {unique:false});
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function photoOwnerKey(type, id) {
    return `${type}:${id}`;
  }

  async function getPhotos(type, id) {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readonly");
      const req = tx.objectStore(PHOTO_STORE).index("ownerKey").getAll(photoOwnerKey(type,id));
      req.onsuccess = () => resolve((req.result || []).sort((a,b)=>(a.addedAt||0)-(b.addedAt||0)));
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }

  async function getAllPhotos() {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readonly");
      const req = tx.objectStore(PHOTO_STORE).getAll();
      req.onsuccess = () => resolve((req.result || []).sort((x,y)=>(x.addedAt||0)-(y.addedAt||0)));
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }

  async function storePhoto(type, id, file, metadata={}) {
    const blob = await prepareImageBlob(file);
    const thumbnailBlob = await prepareThumbnailBlob(blob);
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readwrite");
      const req = tx.objectStore(PHOTO_STORE).add({
        ownerKey: photoOwnerKey(type,id),
        ownerType: type,
        ownerId: id,
        name: file.name || "photo.jpg",
        originalType: file.type || blob.type || "image/jpeg",
        originalLastModified: file.lastModified || null,
        captureDate: metadata.captureDate || null,
        captureTime: metadata.captureTime || null,
        timestampSource: metadata.timestampSource || null,
        addedAt: Date.now(),
        thumbnailBlob,
        blob
      });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }

  async function deletePhoto(photoId) {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readwrite");
      tx.objectStore(PHOTO_STORE).delete(Number(photoId));
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function getPhoto(photoId) {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readonly");
      const req = tx.objectStore(PHOTO_STORE).get(Number(photoId));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }

  async function prepareImageBlob(file) {
    // Keep small images as-is; compress larger photos to save browser storage.
    if (file.size <= 1200000) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const maxSide = 1800;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();
      return await new Promise((resolve, reject) => canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error("Image conversion failed")),
        "image/jpeg", 0.82
      ));
    } catch {
      return file;
    }
  }

  async function prepareThumbnailBlob(blob) {
    try {
      const bitmap = await createImageBitmap(blob);
      const maxSide = 360;
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();
      return await new Promise((resolve, reject) => canvas.toBlob(
        out => out ? resolve(out) : reject(new Error("Thumbnail conversion failed")),
        "image/jpeg", 0.72
      ));
    } catch {
      return blob;
    }
  }

  async function persistPhotoThumbnail(photoId, thumbnailBlob) {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readwrite");
      const store = tx.objectStore(PHOTO_STORE);
      const req = store.get(Number(photoId));
      req.onsuccess = () => {
        const photo = req.result;
        if (photo && !photo.thumbnailBlob) {
          photo.thumbnailBlob = thumbnailBlob;
          store.put(photo);
        }
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }

  async function ensurePhotoThumbnail(photo) {
    if (photo.thumbnailBlob) return photo.thumbnailBlob;
    const thumbnailBlob = await prepareThumbnailBlob(photo.blob);
    photo.thumbnailBlob = thumbnailBlob;
    try { await persistPhotoThumbnail(photo.id, thumbnailBlob); } catch {}
    return thumbnailBlob;
  }

  function readAscii(view, offset, length) {
    if (offset < 0 || offset + length > view.byteLength) return "";
    let out = "";
    for (let i=0; i<length; i++) {
      const code = view.getUint8(offset+i);
      if (!code) break;
      out += String.fromCharCode(code);
    }
    return out;
  }

  function parseExifWallClock(raw) {
    const m = String(raw || "").match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    return {date:`${m[1]}-${m[2]}-${m[3]}`, time:`${m[4]}:${m[5]}`, seconds:Number(m[6]||0)};
  }

  async function readExifCaptureTime(file) {
    if (!/jpe?g/i.test(file.type || file.name || "")) return null;
    try {
      const buffer = await file.slice(0, 1024 * 1024).arrayBuffer();
      const view = new DataView(buffer);
      if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) return null;
      let pos = 2;
      while (pos + 4 <= view.byteLength) {
        if (view.getUint8(pos) !== 0xFF) { pos++; continue; }
        const marker = view.getUint8(pos + 1);
        pos += 2;
        if (marker === 0xDA || marker === 0xD9) break;
        if (pos + 2 > view.byteLength) break;
        const length = view.getUint16(pos, false);
        if (length < 2 || pos + length > view.byteLength) break;
        if (marker === 0xE1) {
          const payload = pos + 2;
          if (readAscii(view, payload, 4) === "Exif") {
            const tiff = payload + 6;
            if (tiff + 8 > view.byteLength) return null;
            const order = view.getUint16(tiff, false);
            const little = order === 0x4949;
            if (!little && order !== 0x4D4D) return null;
            const get16 = off => view.getUint16(off, little);
            const get32 = off => view.getUint32(off, little);
            const valueString = entry => {
              const type = get16(entry + 2);
              const count = get32(entry + 4);
              if (type !== 2 || !count) return "";
              const valuePos = count <= 4 ? entry + 8 : tiff + get32(entry + 8);
              return readAscii(view, valuePos, Math.min(count, 64));
            };
            const findTag = (ifdPos, wanted) => {
              if (ifdPos < 0 || ifdPos + 2 > view.byteLength) return null;
              const count = get16(ifdPos);
              for (let i=0; i<count; i++) {
                const entry = ifdPos + 2 + i*12;
                if (entry + 12 > view.byteLength) break;
                if (get16(entry) === wanted) return entry;
              }
              return null;
            };
            const ifd0 = tiff + get32(tiff + 4);
            const exifPtrEntry = findTag(ifd0, 0x8769);
            if (exifPtrEntry) {
              const exifIfd = tiff + get32(exifPtrEntry + 8);
              for (const tag of [0x9003, 0x9004]) {
                const entry = findTag(exifIfd, tag);
                const parsed = entry ? parseExifWallClock(valueString(entry)) : null;
                if (parsed) return parsed;
              }
            }
            const dateEntry = findTag(ifd0, 0x0132);
            const parsed = dateEntry ? parseExifWallClock(valueString(dateEntry)) : null;
            if (parsed) return parsed;
          }
        }
        pos += length;
      }
    } catch (err) {
      console.warn("Could not read EXIF timestamp", err);
    }
    return null;
  }

  function berlinPartsFromDate(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(date);
    const get = t => parts.find(p => p.type === t)?.value || "";
    return {date:`${get("year")}-${get("month")}-${get("day")}`, time:`${get("hour")}:${get("minute")}`};
  }

  async function captureInfoForFile(file) {
    const exif = await readExifCaptureTime(file);
    if (exif) return {...exif, source:"camera metadata"};
    if (file.lastModified) {
      const p = berlinPartsFromDate(new Date(file.lastModified));
      return {...p, seconds:0, source:"file date"};
    }
    return {date:null, time:null, seconds:0, source:"unknown"};
  }

  function minuteDistanceToEvent(minute, event) {
    const start = timeValue(event.start);
    const end = timeValue(event.end);
    if (minute < start) return start - minute;
    if (minute > end) return minute - end;
    return 0;
  }

  function assignmentKey(type, id) {
    return `${type}:${id}`;
  }

  function assignmentFromKey(key) {
    const [type, ...rest] = String(key || "").split(":");
    return {type, id:rest.join(":")};
  }

  function assignmentLabel(type, id) {
    if (type === "poster") {
      const p = posterById.get(id);
      return p ? `Poster #${p.number} · ${p.title}` : "Poster";
    }
    const e = byId.get(id);
    if (!e) return "Programme item";
    const session = e.session ? `${e.session} · ` : "";
    const room = e.room ? ` · ${e.room[0].toUpperCase()+e.room.slice(1)}` : "";
    return `${e.start} · ${session}${e.title}${room}`;
  }

  function photoSuggestions(capture) {
    if (!capture?.date || !capture?.time) return [];
    const minute = timeValue(capture.time);
    const dateEvents = DATA.schedule.filter(e => e.date === capture.date && !["break","meal"].includes(e.kind));
    const posterSession = dateEvents.find(e => e.kind === "poster-session" && minute >= timeValue(e.start)-5 && minute <= timeValue(e.end)+5);
    const ranked = [];

    if (posterSession) {
      for (const id of state.posterFavorites) {
        const p = posterById.get(id);
        if (p) ranked.push({type:"poster", id:p.id, score:1600, reason:"Starred poster during poster session"});
      }
      ranked.push({type:"event", id:posterSession.id, score:1000, reason:"Poster session at this time"});
    }

    for (const e of dateEvents) {
      if (e.kind === "poster-session") continue;
      const distance = minuteDistanceToEvent(minute, e);
      if (distance > 20) continue;
      const inside = distance === 0;
      let score = inside ? 1000 : 700 - distance * 18;
      if (state.favorites.includes(e.id)) score += 350;
      if (["talk","plenary","special"].includes(e.kind)) score += 40;
      ranked.push({
        type:"event", id:e.id, score,
        reason: state.favorites.includes(e.id)
          ? (inside ? "Starred item happening at this time" : "Starred item near this time")
          : (inside ? "Happening at this time" : `${distance} min from capture time`)
      });
    }

    const seen = new Set();
    return ranked
      .sort((a,b)=>b.score-a.score)
      .filter(x => {
        const key = assignmentKey(x.type,x.id);
        if (seen.has(key)) return false;
        seen.add(key); return true;
      })
      .slice(0,8);
  }

  function importSelectOptions(item) {
    const suggestedKeys = new Set(item.suggestions.map(x=>assignmentKey(x.type,x.id)));
    let html = `<option value="unclassified:unclassified" ${item.selectedKey==="unclassified:unclassified"?"selected":""}>Unclassified</option>`;
    html += `<option value="">Do not import this photo</option>`;
    if (item.suggestions.length) {
      html += `<optgroup label="Suggested">` + item.suggestions.map(x => {
        const key = assignmentKey(x.type,x.id);
        return `<option value="${esc(key)}" ${key===item.selectedKey?"selected":""}>${esc(assignmentLabel(x.type,x.id))}</option>`;
      }).join("") + `</optgroup>`;
    }
    if (item.capture.date) {
      const others = DATA.schedule
        .filter(e => e.date===item.capture.date && !["break","meal","poster-session"].includes(e.kind))
        .filter(e => !suggestedKeys.has(assignmentKey("event",e.id)))
        .sort((a,b)=>timeValue(a.start)-timeValue(b.start) || a.track-b.track);
      if (others.length) {
        html += `<optgroup label="Other programme items that day">` + others.map(e =>
          `<option value="event:${esc(e.id)}">${esc(assignmentLabel("event",e.id))}</option>`
        ).join("") + `</optgroup>`;
      }
      if (item.capture.date === "2026-10-06" && state.posterFavorites.length) {
        const posters = state.posterFavorites.map(id=>posterById.get(id)).filter(Boolean)
          .filter(p => !suggestedKeys.has(assignmentKey("poster",p.id)));
        if (posters.length) {
          html += `<optgroup label="Other starred posters">` + posters.map(p =>
            `<option value="poster:${esc(p.id)}">${esc(assignmentLabel("poster",p.id))}</option>`
          ).join("") + `</optgroup>`;
        }
      }
    }
    return html;
  }

  function clearPendingPhotoImports() {
    for (const item of pendingPhotoImports) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    }
    pendingPhotoImports = [];
    const list = $("#photoImportList");
    if (list) list.innerHTML = "";
  }

  function closePhotoImportDialog() {
    const dlg = $("#photoImportDialog");
    if (dlg?.open) dlg.close();
    clearPendingPhotoImports();
  }

  function renderPhotoImportReview() {
    const list = $("#photoImportList");
    if (!list) return;
    if (!pendingPhotoImports.length) {
      list.innerHTML = `<div class="photo-empty">No image files selected.</div>`;
      return;
    }
    list.innerHTML = pendingPhotoImports.map((item,index) => {
      const stamp = item.capture.date && item.capture.time
        ? `${item.capture.date} · ${item.capture.time}`
        : "No usable timestamp";
      const top = item.suggestions[0];
      const reason = top ? top.reason : "No session match — will import as Unclassified";
      return `<article class="photo-import-item" data-import-index="${index}">
        <img src="${item.previewUrl}" alt="Selected conference photo">
        <div class="photo-import-copy">
          <strong>${esc(item.file.name || `Photo ${index+1}`)}</strong>
          <div class="photo-import-time">${esc(stamp)} · ${esc(item.capture.source)}</div>
          <div class="photo-import-reason">${esc(reason)}</div>
          <label>
            <span>Assign to</span>
            <select class="photo-assignment-select" data-import-select="${index}">${importSelectOptions(item)}</select>
          </label>
        </div>
      </article>`;
    }).join("");
  }

  async function beginSmartPhotoImport(files) {
    clearPendingPhotoImports();
    const images = [...(files || [])].filter(f => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name || ""));
    if (!images.length) return toast("Choose image files");
    toast(images.length === 1 ? "Reading photo time…" : `Reading ${images.length} photo times…`);
    for (const file of images) {
      const capture = await captureInfoForFile(file);
      const suggestions = photoSuggestions(capture);
      pendingPhotoImports.push({
        file,
        capture,
        suggestions,
        selectedKey: suggestions[0]
          ? assignmentKey(suggestions[0].type,suggestions[0].id)
          : assignmentKey("unclassified","unclassified"),
        previewUrl: URL.createObjectURL(file)
      });
    }
    renderPhotoImportReview();
    $("#photoImportDialog").showModal();
  }

  async function saveSmartPhotoAssignments() {
    if (!pendingPhotoImports.length) return;
    const saveItems = pendingPhotoImports.map((item,index) => {
      const select = $(`[data-import-select="${index}"]`);
      return {...item, selectedKey:select?.value || ""};
    }).filter(x=>x.selectedKey);
    if (!saveItems.length) return toast("Choose at least one assignment");
    $("#photoImportSave").disabled = true;
    toast(saveItems.length === 1 ? "Saving photo…" : `Saving ${saveItems.length} photos…`);
    try {
      for (const item of saveItems) {
        const target = assignmentFromKey(item.selectedKey);
        await storePhoto(target.type, target.id, item.file, {
          captureDate:item.capture.date,
          captureTime:item.capture.time,
          timestampSource:item.capture.source
        });
      }
      const skipped = pendingPhotoImports.length - saveItems.length;
      const unclassified = saveItems.filter(item => item.selectedKey === "unclassified:unclassified").length;
      closePhotoImportDialog();
      await renderGallery();
      if (skipped) {
        toast(`${saveItems.length} saved · ${skipped} skipped`);
      } else if (unclassified) {
        toast(`${saveItems.length} saved · ${unclassified} unclassified`);
      } else {
        toast(`${saveItems.length} photo${saveItems.length===1?"":"s"} assigned`);
      }
    } catch (err) {
      console.error(err);
      toast("Could not save all photos");
    } finally {
      const btn = $("#photoImportSave");
      if (btn) btn.disabled = false;
    }
  }

  function galleryOwnerDetails(photo) {
    if (photo.ownerType === "unclassified") {
      return {
        title: "Unclassified",
        meta: "Photos without a matching conference session",
        sortKey: "9999|unclassified"
      };
    }
    if (photo.ownerType === "poster") {
      const p = posterById.get(photo.ownerId);
      return {
        title: p ? `Poster #${p.number} · ${p.title}` : "Poster",
        meta: "Tuesday 6 October · 18:00–20:00 · Staatsarchiv",
        sortKey: `2026-10-06|18:00|${String(p?.number || 999).padStart(3,"0")}`
      };
    }
    const e = byId.get(photo.ownerId);
    if (!e) return {title:"Programme item", meta:"", sortKey:"9999"};
    const room = e.room ? ` · ${e.room}` : "";
    return {
      title: e.title,
      meta: `${e.weekday} ${e.dateLabel} · ${e.start}–${e.end}${room}`,
      sortKey: `${e.date}|${e.start}|${e.track || 0}`
    };
  }

  function clearGalleryObjectUrls() {
    galleryObjectUrls.forEach(url => URL.revokeObjectURL(url));
    galleryObjectUrls = [];
  }

  function clearModalPhotoObjectUrls() {
    modalPhotoObjectUrls.forEach(url => URL.revokeObjectURL(url));
    modalPhotoObjectUrls = [];
  }

  async function renderGallery() {
    const target = $("#galleryContent");
    const count = $("#galleryCount");
    const meta = $("#galleryMeta");
    if (!target || !count || !meta) return;
    clearGalleryObjectUrls();
    target.innerHTML = `<div class="photo-loading">Loading gallery…</div>`;
    try {
      const photos = await getAllPhotos();
      for (const photo of photos) {
        if (!photo.thumbnailBlob) await ensurePhotoThumbnail(photo);
      }
      count.textContent = photos.length;
      meta.innerHTML = `<span>${photos.length} photo${photos.length===1?"":"s"}</span><span>Stored locally on this device</span>`;
      if (!photos.length) {
        target.innerHTML = `<div class="empty-state"><strong>No photos yet</strong>Import conference photos by time, or add them from an individual talk or poster.</div>`;
        return;
      }
      const groups = new Map();
      for (const photo of photos) {
        if (!groups.has(photo.ownerKey)) groups.set(photo.ownerKey, []);
        groups.get(photo.ownerKey).push(photo);
      }
      const ordered = [...groups.values()].sort((x,y) => galleryOwnerDetails(x[0]).sortKey.localeCompare(galleryOwnerDetails(y[0]).sortKey));
      target.innerHTML = ordered.map(group => {
        const first = group[0];
        const info = galleryOwnerDetails(first);
        const thumbs = group.map(photo => {
          const url = URL.createObjectURL(photo.thumbnailBlob || photo.blob);
          galleryObjectUrls.push(url);
          const stamp = photo.captureTime || "";
          return `<div class="gallery-thumb-item">
            <button class="gallery-thumb" type="button" data-gallery-photo="${photo.id}" aria-label="Open photo">
              <img src="${url}" alt="Conference photo thumbnail" loading="lazy">
              ${stamp ? `<span class="gallery-thumb-time">${esc(stamp)}</span>` : ""}
            </button>
            <button class="gallery-delete" type="button" data-gallery-delete="${photo.id}" aria-label="Delete photo">×</button>
          </div>`;
        }).join("");
        return `<section class="gallery-group">
          <button class="gallery-group-head" type="button" data-gallery-owner-type="${esc(first.ownerType)}" data-gallery-owner-id="${esc(first.ownerId)}">
            <span class="gallery-group-copy"><strong>${esc(info.title)}</strong><small>${esc(info.meta)}</small></span>
            <span class="gallery-group-count">${group.length}</span>
          </button>
          <div class="gallery-thumb-grid">${thumbs}</div>
        </section>`;
      }).join("");
    } catch (err) {
      console.error(err);
      count.textContent = "0";
      target.innerHTML = `<div class="photo-empty">Could not load the gallery on this device.</div>`;
    }
  }

  function photoSectionHtml() {
    return `<section class="photo-section">
      <div class="photo-section-head">
        <h3>Photos</h3>
        <button id="modalAddPhotos" class="secondary-btn" type="button">Add photos</button>
      </div>
      <p class="photo-section-note">Choose existing pictures from your phone. They are stored locally under this presentation.</p>
      <div id="modalPhotos" class="photo-grid"><div class="photo-loading">Loading…</div></div>
    </section>`;
  }

  async function renderModalPhotos() {
    const target = $("#modalPhotos");
    if (!target || !currentModal) return;
    clearModalPhotoObjectUrls();
    target.innerHTML = `<div class="photo-loading">Loading…</div>`;
    try {
      const photos = await getPhotos(currentModal.type, currentModal.id);
      if (!photos.length) {
        target.innerHTML = `<div class="photo-empty">No photos attached yet.</div>`;
        return;
      }
      for (const photo of photos) {
        if (!photo.thumbnailBlob) await ensurePhotoThumbnail(photo);
      }
      target.innerHTML = photos.map(p => {
        const url = URL.createObjectURL(p.thumbnailBlob || p.blob);
        modalPhotoObjectUrls.push(url);
        return `<div class="photo-item">
          <button class="photo-thumb" type="button" data-photo-id="${p.id}" aria-label="Open photo">
            <img src="${url}" alt="Presentation photo thumbnail" loading="lazy">
          </button>
          <button class="photo-delete" type="button" data-photo-delete="${p.id}" aria-label="Delete photo">×</button>
        </div>`;
      }).join("");
    } catch {
      target.innerHTML = `<div class="photo-empty">Could not load photos on this device.</div>`;
    }
  }

  async function addSelectedPhotos(files) {
    if (!currentModal || !files?.length) return;
    const images = [...files].filter(f => f.type.startsWith("image/"));
    if (!images.length) return toast("Choose image files");
    toast(images.length === 1 ? "Adding photo…" : `Adding ${images.length} photos…`);
    try {
      for (const file of images) {
        const capture = await captureInfoForFile(file);
        await storePhoto(currentModal.type, currentModal.id, file, {
          captureDate:capture.date,
          captureTime:capture.time,
          timestampSource:capture.source
        });
      }
      await renderModalPhotos();
      renderGallery();
      toast(images.length === 1 ? "Photo added" : `${images.length} photos added`);
    } catch (err) {
      console.error(err);
      toast("Could not save photo");
    }
  }

  async function openStoredPhoto(photoId) {
    try {
      const photo = await getPhoto(photoId);
      if (!photo) return;
      const img = $("#photoViewerImage");
      const old = img.dataset.objectUrl;
      if (old) URL.revokeObjectURL(old);
      const url = URL.createObjectURL(photo.blob);
      img.src = url;
      img.dataset.objectUrl = url;
      $("#photoViewer").showModal();
    } catch {
      toast("Could not open photo");
    }
  }

  function closePhotoViewer() {
    const dlg = $("#photoViewer");
    if (dlg.open) dlg.close();
    const img = $("#photoViewerImage");
    const url = img.dataset.objectUrl;
    if (url) URL.revokeObjectURL(url);
    img.removeAttribute("src");
    delete img.dataset.objectUrl;
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
      ${noteSectionHtml("event", e.id)}
      ${photoSectionHtml()}
      <a class="pdf-link" href="./program.pdf#page=${e.sourcePage}" target="_blank" rel="noopener">Open this page in the PDF ↗</a>`;
    refreshModalStar();
    $("#detailModal").showModal();
    renderModalPhotos();
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
      ${noteSectionHtml("poster", p.id)}
      ${photoSectionHtml()}
      ${p.abstract ? `<section class="abstract-section"><h3>Abstract</h3><div class="abstract-text">${abstractHtml}</div></section>` : ""}
      <a class="pdf-link" href="./program.pdf#page=${p.sourcePage}" target="_blank" rel="noopener">Open this poster in the program PDF ↗</a>`;
    refreshModalStar();
    $("#detailModal").showModal();
    renderModalPhotos();
  }

  function showView(name) {
    state.view = name; saveState();
    $$(".view").forEach(v => v.classList.toggle("active",v.dataset.view===name));
    $$(".nav-btn").forEach(b => b.classList.toggle("active",b.dataset.target===name));
    if (name==="my") renderMySchedule();
    if (name==="gallery") renderGallery();
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
      theme:state.theme, compact:state.compact, timeMode:state.timeMode,
      notes:state.notes || {}
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
      if (!state.notes || typeof state.notes !== "object" || Array.isArray(state.notes)) state.notes = {};
      state.notes = Object.fromEntries(Object.entries(state.notes).filter(([key,value]) => {
        const [type,id] = String(key).split(":");
        return typeof value === "string" &&
          ((type === "event" && byId.has(id)) || (type === "poster" && posterById.has(id)));
      }));
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

    $("#smartPhotoImportBtn").addEventListener("click",()=>$("#smartPhotoInput").click());
    $("#smartPhotoInput").addEventListener("change",async e=>{
      await beginSmartPhotoImport(e.target.files);
      e.target.value="";
    });
    $("#photoImportList").addEventListener("change",e=>{
      const select=e.target.closest("[data-import-select]");
      if (!select) return;
      const item=pendingPhotoImports[Number(select.dataset.importSelect)];
      if (item) item.selectedKey=select.value;
    });
    $("#photoImportSave").addEventListener("click",saveSmartPhotoAssignments);
    $("#photoImportCancel").addEventListener("click",closePhotoImportDialog);
    $("#photoImportClose").addEventListener("click",closePhotoImportDialog);
    $("#photoImportDialog").addEventListener("click",e=>{ if(e.target===$("#photoImportDialog")) closePhotoImportDialog(); });

    $("#galleryContent").addEventListener("click", async e => {
      const del = e.target.closest("[data-gallery-delete]");
      if (del) {
        e.stopPropagation();
        if (confirm("Delete this photo from the presentation?")) {
          await deletePhoto(del.dataset.galleryDelete);
          await renderGallery();
          toast("Photo deleted");
        }
        return;
      }
      const thumb = e.target.closest("[data-gallery-photo]");
      if (thumb) { openStoredPhoto(thumb.dataset.galleryPhoto); return; }
      const owner = e.target.closest("[data-gallery-owner-type]");
      if (owner) {
        const type = owner.dataset.galleryOwnerType;
        if (type === "unclassified") return;
        type === "poster" ? openPoster(owner.dataset.galleryOwnerId) : openEvent(owner.dataset.galleryOwnerId);
      }
    });

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

    let noteSaveTimer = null;
    $("#modalContent").addEventListener("input", e => {
      const note = e.target.closest("#modalNote");
      if (!note) return;
      const status = $("#noteSaveStatus");
      if (status) status.textContent = "Saving…";
      clearTimeout(noteSaveTimer);
      noteSaveTimer = setTimeout(() => {
        saveNote(note.dataset.noteType, note.dataset.noteId, note.value);
        const currentStatus = $("#noteSaveStatus");
        if (currentStatus) currentStatus.textContent = "Saved";
      }, 250);
    });

    $("#modalContent").addEventListener("change", e => {
      const note = e.target.closest("#modalNote");
      if (!note) return;
      clearTimeout(noteSaveTimer);
      saveNote(note.dataset.noteType, note.dataset.noteId, note.value);
      const status = $("#noteSaveStatus");
      if (status) status.textContent = "Saved";
    });

    $("#modalContent").addEventListener("click", async e => {
      const addBtn = e.target.closest("#modalAddPhotos");
      if (addBtn) {
        $("#photoInput").click();
        return;
      }
      const delBtn = e.target.closest("[data-photo-delete]");
      if (delBtn) {
        e.stopPropagation();
        if (confirm("Delete this photo from the presentation?")) {
          await deletePhoto(delBtn.dataset.photoDelete);
          await renderModalPhotos();
          renderGallery();
          toast("Photo deleted");
        }
        return;
      }
      const thumb = e.target.closest("[data-photo-id]");
      if (thumb) openStoredPhoto(thumb.dataset.photoId);
    });
    $("#photoInput").addEventListener("change", async e => {
      const files = e.target.files;
      await addSelectedPhotos(files);
      e.target.value = "";
    });
    $("#photoViewerClose").addEventListener("click", closePhotoViewer);
    $("#photoViewer").addEventListener("click", e => {
      if (e.target === $("#photoViewer")) closePhotoViewer();
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
    renderGallery();
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
