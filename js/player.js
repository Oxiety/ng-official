/* =====================================================================
   ПЛЕЕР (кнопка ♪ в таскбаре + окно с треками)
   ---------------------------------------------------------------------
   Что делает: добавляет в таскбар кнопку ♪. По клику открывается окно
   плеера: список треков (прокручивается), play/pause, назад/вперёд,
   перемотка, громкость.
   Откуда берутся треки: из файла data/music.json (его правит админка,
   вкладка «Музыка»).
   Музыка сама НЕ играет: только после клика пользователя.
   Запоминает (в браузере): последний трек, место в треке и громкость.
   ---------------------------------------------------------------------
   Файл подключён на всех страницах:  <script src="js/player.js" defer>
   ===================================================================== */
(() => {
  "use strict";

  /* ——— 1. Настройки (можно менять) ——— */
  const TRACKS_URL = "data/music.json";   // где лежит список треков
  const SAVE_KEY = "northling-player";    // ключ в localStorage
  const DEFAULT_VOLUME = 0.7;             // громкость по умолчанию (0..1)

  /* ——— 2. Мелкие помощники ——— */
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const fmt = (s) => {                    // 75 -> "1:15"
    if (!isFinite(s) || s < 0) return "0:00";
    return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (_) {}
  const save = () => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ i: index, t: audio.currentTime || 0, v: audio.volume })); } catch (_) {}
  };

  /* ——— 3. Состояние ——— */
  const audio = new Audio();
  audio.preload = "none";
  audio.volume = typeof saved.v === "number" ? saved.v : DEFAULT_VOLUME;
  let tracks = [];
  let index = 0;
  let restoreTime = 0;                    // куда перемотать после загрузки

  /* ——— 4. Каркас окна плеера и кнопки в таскбаре ——— */
  const tray = document.querySelector(".tray");
  if (!tray) return;

  const button = el("button", "theme-toggle player-toggle", "♪");
  button.type = "button";
  button.title = "Плеер";
  button.setAttribute("aria-label", "Открыть плеер");
  button.setAttribute("aria-expanded", "false");
  tray.insertBefore(button, tray.firstChild);

  const win = el("section", "player");
  win.hidden = true;
  win.setAttribute("aria-label", "Плеер");
  win.innerHTML = `
    <header class="player-bar"><span>♪ плеер</span><button type="button" class="player-x" aria-label="Закрыть плеер">✕</button></header>
    <div class="player-now">
      <div class="player-cover"><span>♪</span></div>
      <div class="player-meta"><b class="player-title">—</b><span class="player-artist"></span></div>
    </div>
    <div class="player-seek"><span class="player-cur">0:00</span><input class="player-range" type="range" min="0" max="1000" value="0" aria-label="Перемотка"><span class="player-dur">0:00</span></div>
    <div class="player-ctrl">
      <button type="button" class="player-prev" aria-label="Предыдущий трек">⏮</button>
      <button type="button" class="player-play" aria-label="Играть">▶</button>
      <button type="button" class="player-next" aria-label="Следующий трек">⏭</button>
      <label class="player-vol">🔈<input type="range" min="0" max="100" aria-label="Громкость"></label>
    </div>
    <ul class="player-list" role="list"></ul>`;
  document.body.appendChild(win);

  const q = (s) => win.querySelector(s);
  const ui = {
    cover: q(".player-cover"), title: q(".player-title"), artist: q(".player-artist"),
    cur: q(".player-cur"), dur: q(".player-dur"), seek: q(".player-seek .player-range"),
    play: q(".player-play"), vol: q(".player-vol input"), list: q(".player-list")
  };
  ui.vol.value = Math.round(audio.volume * 100);

  /* ——— 5. Открыть / закрыть окно ——— */
  const setOpen = (open) => {
    win.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (open) ui.play.focus({ preventScroll: true });
  };
  button.addEventListener("click", () => setOpen(win.hidden));
  q(".player-x").addEventListener("click", () => { setOpen(false); button.focus(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !win.hidden) setOpen(false); });

  /* ——— 6. Показ текущего трека ——— */
  const showTrack = () => {
    const t = tracks[index];
    ui.title.textContent = t ? t.title : "Нет треков";
    ui.artist.textContent = t ? (t.artist || "") : "Добавь музыку в админке, вкладка «Музыка»";
    ui.cover.innerHTML = "<span>♪</span>";
    if (t && t.cover) {
      const img = el("img"); img.alt = ""; img.decoding = "async"; img.src = t.cover;
      ui.cover.textContent = ""; ui.cover.appendChild(img);
    }
    ui.list.querySelectorAll("li").forEach((li, i) => {
      const btn = li.querySelector("button");
      if (!btn) return;                  // строка «Пока пусто» без кнопки
      li.classList.toggle("is-current", i === index);
      btn.setAttribute("aria-current", i === index ? "true" : "false");
    });
    if ("mediaSession" in navigator && t) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist || "northling" });
    }
  };
  const showPlayState = () => {
    const playing = !audio.paused;
    ui.play.textContent = playing ? "⏸" : "▶";
    ui.play.setAttribute("aria-label", playing ? "Пауза" : "Играть");
    button.classList.toggle("is-playing", playing);
  };

  /* ——— 7. Управление ——— */
  const load = (i, autoplay) => {
    if (!tracks.length) return;
    index = (i + tracks.length) % tracks.length;
    audio.src = tracks[index].file;
    restoreTime = 0;
    ui.seek.value = 0; ui.cur.textContent = "0:00"; ui.dur.textContent = "0:00";
    showTrack();
    if (autoplay) audio.play().catch(() => {});
    save();
  };
  ui.play.addEventListener("click", () => {
    if (!tracks.length) return;
    if (!audio.src) load(index, true);
    else if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });
  q(".player-prev").addEventListener("click", () => {
    if (audio.currentTime > 3) audio.currentTime = 0; else load(index - 1, true);
  });
  q(".player-next").addEventListener("click", () => load(index + 1, true));
  ui.vol.addEventListener("input", () => { audio.volume = ui.vol.value / 100; save(); });
  ui.seek.addEventListener("input", () => {
    if (audio.duration) audio.currentTime = (ui.seek.value / 1000) * audio.duration;
  });

  /* ——— 8. События самого аудио ——— */
  audio.addEventListener("play", showPlayState);
  audio.addEventListener("pause", () => { showPlayState(); save(); });
  audio.addEventListener("ended", () => load(index + 1, true));   // дальше по списку
  audio.addEventListener("error", () => {                         // битый файл: пропускаем
    if (audio.src && tracks.length > 1) setTimeout(() => load(index + 1, !audio.paused), 600);
  });
  audio.addEventListener("loadedmetadata", () => {
    ui.dur.textContent = fmt(audio.duration);
    if (restoreTime) { audio.currentTime = Math.min(restoreTime, audio.duration || restoreTime); restoreTime = 0; }
  });
  let lastSave = 0;
  audio.addEventListener("timeupdate", () => {
    ui.cur.textContent = fmt(audio.currentTime);
    if (audio.duration) ui.seek.value = Math.round((audio.currentTime / audio.duration) * 1000);
    if (Date.now() - lastSave > 2000) { lastSave = Date.now(); save(); }
  });
  window.addEventListener("pagehide", save);

  if ("mediaSession" in navigator) {        // кнопки на экране блокировки / клавиатуре
    navigator.mediaSession.setActionHandler("previoustrack", () => load(index - 1, true));
    navigator.mediaSession.setActionHandler("nexttrack", () => load(index + 1, true));
  }

  /* ——— 9. Загрузка списка треков ——— */
  const buildList = () => {
    ui.list.textContent = "";
    if (!tracks.length) {
      ui.list.appendChild(el("li", "player-empty", "Пока здесь пусто."));
      return;
    }
    tracks.forEach((t, i) => {
      const li = el("li");
      const b = el("button");
      b.type = "button";
      b.append(el("i", "", String(i + 1)), el("span", "", t.title), el("em", "", t.artist || ""));
      b.addEventListener("click", () => load(i, true));
      li.appendChild(b);
      ui.list.appendChild(li);
    });
  };

  fetch(TRACKS_URL, { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error("music.json"); return r.json(); })
    .then((data) => {
      tracks = (Array.isArray(data.items) ? data.items : [])
        .filter((t) => t && t.file)
        .map((t) => ({ title: t.title || "Без названия", artist: t.artist || "", file: t.file, cover: t.cover || "" }));
      buildList();
      index = Math.min(Math.max(+saved.i || 0, 0), Math.max(tracks.length - 1, 0));
      showTrack();
      if (tracks.length) {                  // подготавливаем трек, но НЕ запускаем
        audio.src = tracks[index].file;
        restoreTime = +saved.t || 0;
        audio.preload = "metadata";
      }
    })
    .catch((e) => { console.error(e); buildList(); showTrack(); });
})();
