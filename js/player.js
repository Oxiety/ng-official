/* =====================================================================
   ПЛЕЕР (js/player.js)
   ---------------------------------------------------------------------
   Что это: мини-стриминг в таскбаре. Кнопка ♪ открывает окно с тремя
   вкладками:
     • «Музыка»   — исполнитель → альбом → трек
     • «Очередь»  — что играет сейчас и дальше; треки можно добавлять и убирать
     • «Предложить» — форма, чтобы предложить трек или альбом (уходит в Telegram)
   Поведение по умолчанию: выбрал трек в альбоме, и альбом играет по кругу.
   Кнопки «шаффл» и «повтор» меняют это. Музыка сама не включается.
   Откуда данные: data/music.json (правится в админке, вкладка «Музыка»).
   Что запоминается в браузере: очередь, трек, место в треке, громкость,
   шаффл и повтор.
   ---------------------------------------------------------------------
   Файл разбит на разделы (ищи по заголовкам «1.», «2.» ...):
     1. Настройки и иконки      5. Очередь и управление
     2. Данные (библиотека)     6. Вкладка «Музыка»
     3. Каркас окна             7. Вкладка «Очередь»
     4. Состояние               8. Вкладка «Предложить»
                                9. События аудио и запуск
                               10. Интерфейс для ретро-плеера (NL.player)
   Этот файл — «движок» плеера (очередь, шаффл, повтор, звук). Классическое окно
   рисуется здесь же, а ретро-плеер с колесом (js/ipod.js) берёт тот же движок
   через объект NL.player (раздел 10).
   Файл подключён на всех страницах: <script src="js/player.js" defer>
   ===================================================================== */
(() => {
  "use strict";
  const NL = window.NL;

  /* ===== 1. Настройки и иконки ===== */
  const DATA_URL = "data/music.json";        // где лежит библиотека
  const SAVE_KEY = "northling-player-v2";    // ключ в localStorage
  const DEFAULT_VOLUME = 0.7;                // громкость по умолчанию (0..1)
  const DEFAULT_TELEGRAM = "m0rning_glory";  // куда слать предложения, если в админке не задано

  // Иконки (все рисуются линиями, цвет берут от текста). "fill" — залитые.
  const ICONS = {
    play: ["fill", "M8 5.5v13l11-6.5z"],
    pause: ["fill", "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"],
    prev: ["fill", "M6 5h2.2v14H6zM19 5v14L9.5 12z"],
    next: ["fill", "M15.8 5H18v14h-2.2zM5 5v14l9.5-7z"],
    shuffle: ["line", "M3 7h3.5c2 0 3.2 1 4.3 2.8l2.4 4.4c1.1 1.8 2.3 2.8 4.3 2.8H21M3 17h3.5c1.4 0 2.4-.5 3.2-1.4M21 7h-3.5c-1.4 0-2.4.5-3.2 1.4M18.5 4.5 21 7l-2.5 2.5M18.5 14.5 21 17l-2.5 2.5"],
    repeat: ["line", "M17 3l3 3-3 3M4 11V9.5A3.5 3.5 0 0 1 7.5 6H20M7 21l-3-3 3-3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4"],
    repeat1: ["line", "M17 3l3 3-3 3M4 11V9.5A3.5 3.5 0 0 1 7.5 6H20M7 21l-3-3 3-3M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4M11.2 10.4l1.5-1v5.2"],
    queue: ["line", "M4 6h13M4 11h13M4 16h7M15.5 15.2l5 2.8-5 2.8z"],
    qadd: ["line", "M4 6h11M4 11h11M4 16h6M18 13v8M14 17h8"],
    note: ["line", "M9 18V5l11-2v13M6.5 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
    back: ["line", "M15 5l-7 7 7 7"],
    close: ["line", "M6 6l12 12M18 6 6 18"],
    vol: ["line", "M4 9.5v5h3.5L13 19V5L7.5 9.5zM16.5 9a4 4 0 0 1 0 6"],
    send: ["line", "M21 4 3 11l6 2.2L11 20l3-4 5 3.5zM9 13.2l7-5"],
    trash: ["line", "M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"],
    chevron: ["line", "M9 5l7 7-7 7"]
  };
  const icon = (name) => {
    const [kind, path] = ICONS[name];
    const style = kind === "fill" ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    return `<svg class="pi" viewBox="0 0 24 24" aria-hidden="true" ${style}><path d="${path}"/></svg>`;
  };

  /* Мелкие помощники */
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const iconButton = (name, label, cls) => {          // компактная кнопка-иконка
    const b = el("button", cls || "pbtn");
    b.type = "button"; b.title = label; b.setAttribute("aria-label", label);
    b.innerHTML = icon(name);
    return b;
  };
  const fmt = (s) => {                                // 75 -> "1:15"
    if (!isFinite(s) || s < 0) return "0:00";
    return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  };
  const plural = (n, one, few, many) => {             // 1 трек, 2 трека, 5 треков
    const m10 = n % 10, m100 = n % 100;
    return n + " " + (m10 === 1 && m100 !== 11 ? one : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? few : many);
  };

  /* ===== 2. Данные (библиотека) ===== */
  // Формат data/music.json:
  //   { "telegram": "ник", "artists": [ { "name", "image", "albums": [ { "title", "year", "cover",
  //       "tracks": [ { "title", "file" } ] } ] } ] }
  // Старый плоский формат ({ "items": [ {title, artist, file, cover} ] }) тоже понимаем.
  let library = [];                                   // исполнители
  const trackById = new Map();                        // file -> трек (для восстановления очереди)
  let telegram = DEFAULT_TELEGRAM;

  const buildLibrary = (data) => {
    let artists = Array.isArray(data.artists) ? data.artists : [];
    if (!artists.length && Array.isArray(data.items)) {   // старый формат: группируем по исполнителю
      const map = new Map();
      data.items.forEach((t) => {
        const name = t.artist || "Без исполнителя";
        if (!map.has(name)) map.set(name, { name, albums: [{ title: "Все треки", cover: t.cover || "", tracks: [] }] });
        map.get(name).albums[0].tracks.push({ title: t.title, file: t.file });
      });
      artists = [...map.values()];
    }
    library = artists.map((a) => {
      const artist = { name: a.name || "Без названия", image: a.image || "", albums: [] };
      (a.albums || []).forEach((al) => {
        const album = { title: al.title || "Без названия", year: al.year || "", cover: al.cover || "", artist: artist, tracks: [] };
        (al.tracks || []).filter((t) => t && t.file).forEach((t) => {
          const track = {
            id: t.file, file: t.file, title: t.title || "Без названия",
            artist: artist.name, album: album.title, cover: t.cover || album.cover || artist.image || ""
          };
          album.tracks.push(track); trackById.set(track.id, track);
        });
        if (album.tracks.length) artist.albums.push(album);
      });
      return artist;
    }).filter((a) => a.albums.length);
    telegram = String(data.telegram || DEFAULT_TELEGRAM).replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "");
  };

  /* ===== 3. Каркас окна ===== */
  const tray = document.querySelector(".tray");
  if (!tray) return;

  const button = el("button", "theme-toggle player-toggle");
  button.type = "button"; button.title = "Плеер";
  button.setAttribute("aria-label", "Открыть плеер"); button.setAttribute("aria-expanded", "false");
  button.innerHTML = icon("note");
  tray.insertBefore(button, tray.firstChild);

  const win = el("section", "player");
  win.hidden = true;
  win.setAttribute("aria-label", "Плеер");
  win.innerHTML = `
    <header class="pop-bar"><span class="pop-title">${icon("note")} плеер</span><button type="button" class="pop-x" aria-label="Закрыть плеер">${icon("close")}</button></header>
    <div class="player-now">
      <div class="player-cover"><span>${icon("note")}</span></div>
      <div class="player-meta"><b class="player-title">Ничего не играет</b><span class="player-artist">выбери трек во вкладке «Музыка»</span></div>
    </div>
    <div class="player-seek"><span class="player-cur">0:00</span><input class="player-range" type="range" min="0" max="1000" value="0" aria-label="Перемотка"><span class="player-dur">0:00</span></div>
    <div class="player-ctrl">
      <span class="player-btns"></span>
      <label class="player-vol" title="Громкость">${icon("vol")}<input type="range" min="0" max="100" aria-label="Громкость"></label>
    </div>
    <div class="player-tabs" role="tablist"></div>
    <div class="player-body" role="tabpanel"></div>`;
  document.body.appendChild(win);

  const q = (s) => win.querySelector(s);
  const ui = {
    cover: q(".player-cover"), title: q(".player-title"), artist: q(".player-artist"),
    cur: q(".player-cur"), dur: q(".player-dur"), seek: q(".player-seek .player-range"),
    vol: q(".player-vol input"), btns: q(".player-btns"), tabs: q(".player-tabs"), body: q(".player-body")
  };
  const btnShuffle = iconButton("shuffle", "Перемешать", "pbtn pbtn-toggle");
  const btnPrev = iconButton("prev", "Предыдущий трек");
  const btnPlay = iconButton("play", "Играть", "pbtn pbtn-main");
  const btnNext = iconButton("next", "Следующий трек");
  const btnRepeat = iconButton("repeat", "Повтор", "pbtn pbtn-toggle");
  ui.btns.append(btnShuffle, btnPrev, btnPlay, btnNext, btnRepeat);

  /* ===== 4. Состояние ===== */
  const audio = new Audio();
  audio.preload = "none";
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (_) {}
  audio.volume = typeof saved.v === "number" ? saved.v : DEFAULT_VOLUME;
  ui.vol.value = Math.round(audio.volume * 100);

  let queue = [];                 // очередь: массив треков
  let qi = -1;                    // номер текущего трека в очереди
  let shuffle = !!saved.sh;       // перемешивание
  let repeat = ["all", "one", "off"].includes(saved.rp) ? saved.rp : "all";   // all = по кругу (по умолчанию)
  let history = [];               // для кнопки «назад» при шаффле
  let restoreTime = 0;            // куда перемотать после загрузки
  let tab = "library";            // активная вкладка
  let view = { level: "artists", a: 0, b: 0 };   // где мы во вкладке «Музыка»
  const listeners = new Set();    // подписчики на изменения (ретро-плеер)
  const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

  const current = () => queue[qi] || null;
  const save = () => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        q: queue.map((t) => t.id), i: qi, t: audio.currentTime || 0, v: audio.volume, sh: shuffle, rp: repeat
      }));
    } catch (_) {}
  };

  /* ===== 5. Очередь и управление ===== */
  const loadCurrent = (autoplay) => {
    const t = current();
    if (!t) return;
    audio.src = t.file;
    restoreTime = 0;
    ui.seek.value = 0; ui.cur.textContent = "0:00"; ui.dur.textContent = "0:00";
    if (autoplay) audio.play().catch(() => {});
    renderNow(); markCurrent(); save();
  };
  // Играть список (например, альбом) начиная с трека start. Очередь заменяется этим списком.
  const playList = (list, start) => {
    queue = list.slice(); qi = start; history = [];
    loadCurrent(true); renderQueueBadge(); if (tab === "queue") renderTab();
  };
  const addToQueue = (tracks) => {
    const list = [].concat(tracks);
    if (!list.length) return;
    queue.push(...list);
    if (qi < 0) { qi = 0; loadCurrent(false); }
    renderQueueBadge(); if (tab === "queue") renderTab(); save();
    flash(list.length === 1 ? "Добавлено в очередь" : "Добавлено: " + plural(list.length, "трек", "трека", "треков"));
  };
  const randomOther = () => {
    if (queue.length < 2) return qi;
    let n; do { n = Math.floor(Math.random() * queue.length); } while (n === qi);
    return n;
  };
  const next = (auto) => {
    if (!queue.length) return;
    if (shuffle && queue.length > 1) { history.push(qi); qi = randomOther(); }
    else if (qi + 1 >= queue.length) {
      if (auto && repeat === "off") { audio.pause(); audio.currentTime = 0; showPlayState(); return; }
      qi = 0;
    } else qi++;
    loadCurrent(true);
  };
  const prev = () => {
    if (!queue.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    if (shuffle && history.length) qi = history.pop(); else qi = (qi - 1 + queue.length) % queue.length;
    loadCurrent(true);
  };
  const removeFromQueue = (i) => {
    const wasCurrent = i === qi;
    queue.splice(i, 1);
    if (i < qi) qi--;
    if (!queue.length) { qi = -1; audio.pause(); audio.removeAttribute("src"); audio.load(); renderNow(); }
    else if (wasCurrent) { qi = Math.min(qi, queue.length - 1); loadCurrent(!audio.paused); }
    renderQueueBadge(); renderTab(); save();
  };
  const clearQueue = () => {
    queue = []; qi = -1; history = [];
    audio.pause(); audio.removeAttribute("src"); audio.load();
    renderNow(); showPlayState(); renderQueueBadge(); renderTab(); save();
  };

  const togglePlay = () => {
    if (!current()) { flash("Выбери трек во вкладке «Музыка»"); return false; }
    if (!audio.src) loadCurrent(true);
    else if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
    return true;
  };
  btnPlay.addEventListener("click", togglePlay);
  btnPrev.addEventListener("click", prev);
  btnNext.addEventListener("click", () => next(false));
  const toggleShuffle = () => { shuffle = !shuffle; history = []; showModes(); save(); };
  const cycleRepeat = () => { repeat = repeat === "all" ? "one" : repeat === "one" ? "off" : "all"; showModes(); save(); };
  btnShuffle.addEventListener("click", toggleShuffle);
  btnRepeat.addEventListener("click", cycleRepeat);
  ui.vol.addEventListener("input", () => { audio.volume = ui.vol.value / 100; save(); });
  ui.seek.addEventListener("input", () => { if (audio.duration) audio.currentTime = (ui.seek.value / 1000) * audio.duration; });

  /* Отображение состояния (верхняя часть окна) */
  const renderNow = () => {
    const t = current();
    ui.title.textContent = t ? t.title : "Ничего не играет";
    ui.artist.textContent = t ? `${t.artist} · ${t.album}` : "выбери трек во вкладке «Музыка»";
    ui.cover.textContent = "";
    if (t && t.cover) { const img = el("img"); img.alt = ""; img.decoding = "async"; img.src = t.cover; ui.cover.appendChild(img); }
    else ui.cover.innerHTML = `<span>${icon("note")}</span>`;
    if ("mediaSession" in navigator && t) navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.album });
    emit();
  };
  const showPlayState = () => {
    const playing = !audio.paused;
    btnPlay.innerHTML = icon(playing ? "pause" : "play");
    btnPlay.title = btnPlay.ariaLabel = playing ? "Пауза" : "Играть";
    button.classList.toggle("is-playing", playing);
    emit();
  };
  const showModes = () => {
    btnShuffle.classList.toggle("on", shuffle);
    btnShuffle.title = shuffle ? "Перемешивание включено" : "Перемешать";
    btnRepeat.classList.toggle("on", repeat !== "off");
    btnRepeat.innerHTML = icon(repeat === "one" ? "repeat1" : "repeat");
    btnRepeat.title = repeat === "all" ? "Повтор: по кругу" : repeat === "one" ? "Повтор: один трек" : "Повтор выключен";
    emit();
  };
  const markCurrent = () => {                            // подсветить играющий трек в списках
    const id = current() && current().id;
    ui.body.querySelectorAll("[data-id]").forEach((row) => row.classList.toggle("is-current", row.dataset.id === id && row.dataset.cur !== "no"));
    ui.body.querySelectorAll("[data-qi]").forEach((row) => row.classList.toggle("is-current", +row.dataset.qi === qi));
  };
  let flashTimer;
  const flash = (text) => {                              // короткое сообщение в окне плеера
    let n = win.querySelector(".player-flash");
    if (!n) { n = el("div", "player-flash"); win.appendChild(n); }
    n.textContent = text; n.classList.add("show");
    clearTimeout(flashTimer); flashTimer = setTimeout(() => n.classList.remove("show"), 1800);
  };

  /* Вкладки */
  const TABS = [["library", "note", "Музыка"], ["queue", "queue", "Очередь"], ["suggest", "send", "Предложить"]];
  TABS.forEach(([id, ic, label]) => {
    const b = el("button", "player-tab");
    b.type = "button"; b.dataset.tab = id; b.setAttribute("role", "tab");
    b.innerHTML = `${icon(ic)}<span>${label}</span>${id === "queue" ? '<em class="player-badge" hidden>0</em>' : ""}`;
    b.addEventListener("click", () => { tab = id; renderTab(); });
    ui.tabs.appendChild(b);
  });
  const renderQueueBadge = () => {
    const badge = ui.tabs.querySelector(".player-badge");
    badge.hidden = !queue.length; badge.textContent = queue.length;
    emit();
  };
  const renderTab = () => {
    ui.tabs.querySelectorAll(".player-tab").forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on));
    });
    ui.body.textContent = "";
    ui.body.scrollTop = 0;
    if (tab === "library") renderLibrary(); else if (tab === "queue") renderQueue(); else renderSuggest();
    markCurrent();
  };

  /* ===== 6. Вкладка «Музыка» ===== */
  const thumb = (src, fallbackIcon) => {
    const box = el("span", "pthumb");
    if (src) { const img = el("img"); img.alt = ""; img.loading = "lazy"; img.decoding = "async"; img.src = src; box.appendChild(img); }
    else box.innerHTML = icon(fallbackIcon || "note");
    return box;
  };
  const row = (parts) => {                               // строка-кнопка списка
    const b = el("button", "prow");
    b.type = "button";
    b.append(...parts);
    return b;
  };
  const backBar = (title, onBack) => {
    const bar = el("div", "pback");
    const b = iconButton("back", "Назад", "pbtn pbtn-small");
    b.addEventListener("click", onBack);
    bar.append(b, el("b", "", title));
    return bar;
  };
  const renderLibrary = () => {
    const root = ui.body;
    if (!library.length) { root.appendChild(el("p", "player-empty", "Пока здесь пусто. Музыку добавляют в админке, вкладка «Музыка».")); return; }

    if (view.level === "artists") {                                  // 1) исполнители
      library.forEach((artist, a) => {
        const tracks = artist.albums.reduce((n, al) => n + al.tracks.length, 0);
        const arrow = el("span", "pgo"); arrow.innerHTML = icon("chevron");
        const r = row([thumb(artist.image, "note"), el("span", "pcol"), arrow]);
        r.children[1].append(el("b", "", artist.name), el("small", "", `${plural(artist.albums.length, "альбом", "альбома", "альбомов")} · ${plural(tracks, "трек", "трека", "треков")}`));
        r.addEventListener("click", () => { view = { level: "artist", a, b: 0 }; renderTab(); });
        root.appendChild(r);
      });
    } else if (view.level === "artist") {                            // 2) альбомы исполнителя
      const artist = library[view.a];
      root.appendChild(backBar(artist.name, () => { view = { level: "artists", a: 0, b: 0 }; renderTab(); }));
      artist.albums.forEach((album, b) => {
        const arrow2 = el("span", "pgo"); arrow2.innerHTML = icon("chevron");
        const r = row([thumb(album.cover, "note"), el("span", "pcol"), arrow2]);
        r.children[1].append(el("b", "", album.title), el("small", "", [album.year, plural(album.tracks.length, "трек", "трека", "треков")].filter(Boolean).join(" · ")));
        r.addEventListener("click", () => { view = { level: "album", a: view.a, b }; renderTab(); });
        root.appendChild(r);
      });
    } else {                                                         // 3) треки альбома
      const artist = library[view.a], album = artist.albums[view.b];
      root.appendChild(backBar(artist.name, () => { view = { level: "artist", a: view.a, b: 0 }; renderTab(); }));
      const head = el("div", "palbum");
      const info = el("div", "pcol");
      info.append(el("b", "", album.title), el("small", "", [album.year, plural(album.tracks.length, "трек", "трека", "треков")].filter(Boolean).join(" · ")));
      const playAll = iconButton("play", "Играть альбом", "pbtn pbtn-main pbtn-small");
      const queueAll = iconButton("qadd", "Весь альбом в очередь", "pbtn pbtn-small");
      playAll.addEventListener("click", () => playList(album.tracks, 0));
      queueAll.addEventListener("click", () => addToQueue(album.tracks));
      head.append(thumb(album.cover, "note"), info, playAll, queueAll);
      root.appendChild(head);
      album.tracks.forEach((t, i) => {
        const line = el("div", "ptrack");
        line.dataset.id = t.id;
        const play = el("button", "ptrack-main");
        play.type = "button";
        play.append(el("i", "", String(i + 1)), el("span", "", t.title));
        play.addEventListener("click", () => playList(album.tracks, i));   // альбом играет по кругу
        const add = iconButton("qadd", "Добавить в очередь", "pbtn pbtn-small");
        add.addEventListener("click", () => addToQueue(t));
        line.append(play, add);
        root.appendChild(line);
      });
    }
  };

  /* ===== 7. Вкладка «Очередь» ===== */
  const renderQueue = () => {
    const root = ui.body;
    if (!queue.length) {
      root.appendChild(el("p", "player-empty", "Очередь пуста. Во вкладке «Музыка» нажми на значок очереди рядом с треком."));
      return;
    }
    const head = el("div", "pqhead");
    head.append(el("span", "", plural(queue.length, "трек", "трека", "треков")));
    const clear = iconButton("trash", "Очистить очередь", "pbtn pbtn-small");
    clear.addEventListener("click", clearQueue);
    head.appendChild(clear);
    root.appendChild(head);
    queue.forEach((t, i) => {
      const line = el("div", "ptrack");
      line.dataset.qi = i;
      const play = el("button", "ptrack-main");
      play.type = "button";
      const label = el("span", "pcol");
      label.append(el("b", "", t.title), el("small", "", `${t.artist} · ${t.album}`));
      play.append(el("i", "", String(i + 1)), label);
      play.addEventListener("click", () => { qi = i; history = []; loadCurrent(true); });
      const del = iconButton("close", "Убрать из очереди", "pbtn pbtn-small");
      del.addEventListener("click", () => removeFromQueue(i));
      line.append(play, del);
      root.appendChild(line);
    });
  };

  /* ===== 8. Вкладка «Предложить» ===== */
  // Сайт статичный (сервера нет), поэтому предложение собирается в текст,
  // копируется в буфер и открывается чат в Telegram: остаётся вставить и отправить.
  let suggestKind = "track";
  const renderSuggest = () => {
    const root = ui.body;
    const form = el("form", "psuggest");
    form.innerHTML = `
      <p class="pnote">Нет любимой песни или альбома? Напиши, и я добавлю.</p>
      <div class="pseg" role="group" aria-label="Что предлагаешь">
        <button type="button" data-kind="track">Трек</button><button type="button" data-kind="album">Альбом</button>
      </div>
      <label>Исполнитель<input name="artist" type="text" autocomplete="off" maxlength="80"></label>
      <label class="pname">Название трека<input name="title" type="text" autocomplete="off" maxlength="120" required></label>
      <label>Ссылка (необязательно)<input name="link" type="url" inputmode="url" autocomplete="off" placeholder="https://"></label>
      <button type="submit" class="psend">${icon("send")}<span>Отправить в Telegram</span></button>`;
    const seg = form.querySelectorAll(".pseg button");
    const paint = () => {
      seg.forEach((b) => b.classList.toggle("on", b.dataset.kind === suggestKind));
      form.querySelector(".pname").firstChild.textContent = suggestKind === "track" ? "Название трека" : "Название альбома";
    };
    seg.forEach((b) => b.addEventListener("click", () => { suggestKind = b.dataset.kind; paint(); }));
    paint();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const text = [
        "Предложение для плеера northling.space",
        "Что: " + (suggestKind === "track" ? "трек" : "альбом"),
        "Исполнитель: " + (f.get("artist") || "—"),
        "Название: " + f.get("title"),
        f.get("link") ? "Ссылка: " + f.get("link") : ""
      ].filter(Boolean).join("\n");
      try { await navigator.clipboard.writeText(text); flash("Текст скопирован, вставь его в чат"); } catch (_) { flash("Открываю Telegram"); }
      window.open("https://t.me/" + telegram + "?text=" + encodeURIComponent(text), "_blank", "noopener");
    });
    root.appendChild(form);
  };

  /* ===== 9. События аудио и запуск ===== */
  // Открыть / закрыть окно. Одновременно открыто только одно окно из таскбара (плеер, ретро-плеер или настройки).
  // Анимацию даёт NL.showPop (js/core.js).
  const isOpen = () => NL.isPopOpen(win);
  const setOpen = (open) => {
    NL.showPop(win, open);
    button.setAttribute("aria-expanded", String(open));
    if (open) document.dispatchEvent(new CustomEvent("nl:popover", { detail: "player" }));
  };
  // Какой плеер сейчас выбран в настройках: классический (это окно) или ретро (js/ipod.js)
  const retroOn = () => !!(NL.settings && NL.settings.playerStyle === "retro" && NL.retro);
  const anyOpen = () => isOpen() || (NL.retro && NL.retro.isOpen());
  const openPlayer = (open) => {
    if (retroOn()) { setOpen(false); NL.retro.setOpen(open); button.setAttribute("aria-expanded", String(open)); }
    else { if (NL.retro) NL.retro.setOpen(false); setOpen(open); }
  };
  button.addEventListener("click", () => openPlayer(!anyOpen()));
  q(".pop-x").addEventListener("click", () => { setOpen(false); button.focus(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) setOpen(false); });
  document.addEventListener("nl:popover", (e) => { if (e.detail !== "player" && isOpen()) setOpen(false); });
  document.addEventListener("nl:settings", () => {      // сменили стиль плеера, пока он открыт: переключаем окно
    if (anyOpen()) openPlayer(true);
  });
  // Любая кнопка с data-open-player (например «Послушать сейчас» на странице Oasis) открывает плеер
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest && e.target.closest("[data-open-player]");
    if (!trigger) return;
    e.preventDefault();
    openPlayer(true);
  });

  audio.addEventListener("play", showPlayState);
  audio.addEventListener("pause", () => { showPlayState(); save(); });
  audio.addEventListener("ended", () => {
    if (repeat === "one") { audio.currentTime = 0; audio.play().catch(() => {}); } else next(true);
  });
  audio.addEventListener("error", () => {                // битая ссылка: пропускаем
    if (audio.src && queue.length > 1) setTimeout(() => next(true), 600);
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
    emit();
  });
  window.addEventListener("pagehide", save);
  if ("mediaSession" in navigator) {                     // кнопки на экране блокировки / клавиатуре
    navigator.mediaSession.setActionHandler("previoustrack", prev);
    navigator.mediaSession.setActionHandler("nexttrack", () => next(false));
  }

  showModes(); showPlayState(); renderQueueBadge(); renderTab();

  fetch(DATA_URL, { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error("music.json"); return r.json(); })
    .then((data) => {
      buildLibrary(data);
      // восстановить очередь с прошлого раза (без автозапуска)
      queue = (Array.isArray(saved.q) ? saved.q : []).map((id) => trackById.get(id)).filter(Boolean);
      qi = queue.length ? Math.min(Math.max(+saved.i || 0, 0), queue.length - 1) : -1;
      if (queue.length && saved.q[saved.i] && trackById.get(saved.q[saved.i]) !== queue[qi]) qi = 0;
      if (qi >= 0) { audio.src = queue[qi].file; audio.preload = "metadata"; restoreTime = +saved.t || 0; }
      renderNow(); renderQueueBadge(); renderTab(); emit();
    })
    .catch((e) => { console.error(e); renderTab(); });

  /* ===== 10. Интерфейс для ретро-плеера (NL.player) =====
     Всё, что нужно ретро-плееру (js/ipod.js): данные библиотеки, очередь, управление
     и подписка на изменения. Логику второй раз он не пишет. */
  NL.player = {
    button,                                                  // кнопка в таскбаре
    get library() { return library; },                       // исполнители -> альбомы -> треки
    get queue() { return queue; },
    get index() { return qi; },
    get current() { return current(); },
    get playing() { return !audio.paused; },
    get time() { return audio.currentTime || 0; },
    get duration() { return audio.duration || 0; },
    get shuffle() { return shuffle; },
    get repeat() { return repeat; },
    get telegram() { return telegram; },
    get volume() { return audio.volume; },
    set volume(v) { audio.volume = Math.min(1, Math.max(0, v)); ui.vol.value = Math.round(audio.volume * 100); save(); emit(); },
    seek(fraction) { if (audio.duration) audio.currentTime = Math.min(1, Math.max(0, fraction)) * audio.duration; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    playList, addToQueue, removeFromQueue, clearQueue, toggle: togglePlay,
    next: () => next(false), prev, toggleShuffle, cycleRepeat,
    jumpTo(i) { qi = i; history = []; loadCurrent(true); },
    flash
  };
})();
