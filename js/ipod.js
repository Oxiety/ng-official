/* =====================================================================
   РЕТРО-ПЛЕЕР С КОЛЕСОМ (js/ipod.js)
   ---------------------------------------------------------------------
   Что это: второй вид плеера в стиле нулевых: корпус, экранчик с меню и
   «колесо». Включается в настройках: «Плеер» → «Ретро».
   Музыку, очередь, шаффл и повтор он берёт из движка в js/player.js
   (объект NL.player). Здесь только внешний вид и управление.

   Как им пользоваться:
     • вести пальцем / мышкой по кругу колеса: прокрутка списка
       (на экране «Сейчас играет»: громкость или перемотка)
     • центральная кнопка: выбрать. Если удерживать:
       трек → «добавить в очередь», в очереди → «убрать»
     • MENU: назад (на главном меню закрывает плеер)
     • ⏮ ⏭ ⏯ по краям колеса: предыдущий, следующий, плей/пауза
     • с клавиатуры: стрелки, Enter, Esc
   Звук клика колеса включается и выключается в настройках.
   ---------------------------------------------------------------------
   Разделы файла:  1. Иконки и помощники   2. Каркас окна
                   3. Экраны (меню)         4. Отрисовка
                   5. Колесо и кнопки       6. Открыть / закрыть
   ===================================================================== */
(() => {
  "use strict";
  const NL = window.NL;
  const P = NL && NL.player;
  if (!P) return;                                   // плеер не запустился: ретро не нужен

  /* ===== 1. Иконки и помощники ===== */
  const ICONS = {
    play: ["fill", "M8 5.5v13l11-6.5z"],
    pause: ["fill", "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"],
    prev: ["fill", "M6 5h2.2v14H6zM19 5v14L9.5 12z"],
    next: ["fill", "M15.8 5H18v14h-2.2zM5 5v14l9.5-7z"],
    chevron: ["line", "M9 5l7 7-7 7"],
    close: ["line", "M6 6l12 12M18 6 6 18"],
    vol: ["line", "M4 9.5v5h3.5L13 19V5L7.5 9.5zM16.5 9a4 4 0 0 1 0 6"],
    note: ["line", "M9 18V5l11-2v13M6.5 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"]
  };
  const icon = (name) => {
    const [kind, path] = ICONS[name];
    const style = kind === "fill" ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
    return `<svg class="pi" viewBox="0 0 24 24" aria-hidden="true" ${style}><path d="${path}"/></svg>`;
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const fmt = (s) => { if (!isFinite(s) || s < 0) s = 0; return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0"); };
  const plural = (n, one, few, many) => {
    const a = n % 10, b = n % 100;
    return n + " " + (a === 1 && b !== 11 ? one : (a >= 2 && a <= 4 && (b < 10 || b >= 20)) ? few : many);
  };
  const ROW_H = 24;                                   // высота строки меню на экране (px), должна совпадать с css (.irow)
  const STEP_DEG = 26;                                // сколько градусов поворота колеса = одна строка

  /* Тихий «клик» колеса: короткий звук из браузерного аудио (без файлов) и лёгкая вибрация на телефоне */
  let actx = null;
  const tick = () => {
    if (!(NL.settings && NL.settings.clickSound)) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === "suspended") actx.resume();
      const t = actx.currentTime, osc = actx.createOscillator(), gain = actx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(2400, t);
      osc.frequency.exponentialRampToValueAtTime(900, t + 0.012);
      gain.gain.setValueAtTime(0.03, t);                   // громкость клика (0..1), сделана тихой
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
      osc.connect(gain); gain.connect(actx.destination);
      osc.start(t); osc.stop(t + 0.03);
    } catch (_) {}
    try { if (navigator.vibrate) navigator.vibrate(3); } catch (_) {}
  };

  /* ===== 2. Каркас окна ===== */
  const dev = el("section", "ipod");
  dev.hidden = true;
  dev.tabIndex = -1;
  dev.setAttribute("aria-label", "Ретро-плеер");
  dev.innerHTML = `
    <button type="button" class="ipod-x" aria-label="Закрыть плеер">${icon("close")}</button>
    <div class="ipod-screen"><div class="ipod-lcd">
      <div class="ipod-head"><span class="ipod-title"></span><span class="ipod-ind"></span></div>
      <div class="ipod-view"></div>
      <div class="ipod-hint"></div>
      <div class="ipod-toast"></div>
    </div></div>
    <div class="ipod-wheel" aria-label="Колесо: проведи по кругу для прокрутки">
      <span class="wl wl-menu">MENU</span>
      <span class="wl wl-prev">${icon("prev")}</span>
      <span class="wl wl-next">${icon("next")}</span>
      <span class="wl wl-play">${icon("play")}${icon("pause")}</span>
      <button type="button" class="ipod-center" aria-label="Выбрать"></button>
    </div>`;
  document.body.appendChild(dev);
  const q = (s) => dev.querySelector(s);
  const ui = { title: q(".ipod-title"), ind: q(".ipod-ind"), view: q(".ipod-view"), hint: q(".ipod-hint"), toast: q(".ipod-toast"), wheel: q(".ipod-wheel"), center: q(".ipod-center") };

  /* ===== 3. Экраны (меню) =====
     Экран = { type, title, sel, scroll, ... }. Экраны лежат в стопке stack: последний на виду.
     Список строк экрана собирает функция rowsOf(screen). Строка:
       { label, sub?, go? (показать стрелку ›), value? (текст справа), cur? (играет сейчас),
         onSelect(), onHold()? }   */
  let stack = [{ type: "root", title: "northling", sel: 0, scroll: 0 }];
  const top = () => stack[stack.length - 1];

  const push = (screen) => { screen.sel = screen.sel || 0; screen.scroll = 0; stack.push(screen); render("push"); };
  const pop = () => { if (stack.length > 1) { stack.pop(); render("pop"); return true; } return false; };
  const toast = (text) => {
    ui.toast.textContent = text; ui.toast.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => ui.toast.classList.remove("show"), 1500);
  };
  const openNowPlaying = () => { if (top().type !== "now") push({ type: "now", title: "Сейчас играет", mode: "volume" }); };

  const rowsOf = (s) => {
    const lib = P.library;
    if (s.type === "root") {                                       // главное меню
      const rows = [];
      if (P.current) rows.push({ label: "Сейчас играет", go: true, onSelect: openNowPlaying });
      rows.push(
        { label: "Музыка", go: true, onSelect: () => push({ type: "artists", title: "Музыка" }) },
        { label: "Очередь", value: P.queue.length ? String(P.queue.length) : "", go: true, onSelect: () => push({ type: "queue", title: "Очередь" }) },
        { label: "Шаффл", value: P.shuffle ? "Вкл" : "Выкл", onSelect: () => P.toggleShuffle() },
        { label: "Повтор", value: P.repeat === "all" ? "Все" : P.repeat === "one" ? "Один" : "Выкл", onSelect: () => P.cycleRepeat() },
        { label: "Предложить трек", onSelect: () => { window.open("https://t.me/" + P.telegram + "?text=" + encodeURIComponent("Хочу предложить трек или альбом для плеера northling.space: "), "_blank", "noopener"); } },
        { label: "Классический вид", onSelect: () => { NL.settings.playerStyle = "classic"; try { localStorage.setItem("northling-settings", JSON.stringify(NL.settings)); } catch (_) {} document.dispatchEvent(new CustomEvent("nl:settings")); } }
      );
      return rows;
    }
    if (s.type === "artists") {                                    // исполнители
      if (!lib.length) return [{ label: "Пока пусто", onSelect() {} }];
      return lib.map((a) => ({
        label: a.name, go: true,
        onSelect: () => push({ type: "albums", title: a.name, artist: a })
      }));
    }
    if (s.type === "albums") {                                     // альбомы исполнителя
      return s.artist.albums.map((al) => ({
        label: al.title, value: al.year || "", go: true,
        onSelect: () => push({ type: "album", title: al.title, album: al })
      }));
    }
    if (s.type === "album") {                                      // треки альбома
      const al = s.album, curId = P.current && P.current.id;
      const rows = [
        { label: "Играть альбом", onSelect: () => { P.playList(al.tracks, 0); openNowPlaying(); } },
        { label: "Весь альбом в очередь", onSelect: () => { P.addToQueue(al.tracks); toast("Добавлено в очередь"); } }
      ];
      al.tracks.forEach((t, i) => rows.push({
        label: (i + 1) + ". " + t.title, cur: t.id === curId,
        onSelect: () => { P.playList(al.tracks, i); openNowPlaying(); },          // альбом играет по кругу
        onHold: () => { P.addToQueue(t); toast("Добавлено в очередь"); }
      }));
      return rows;
    }
    if (s.type === "queue") {                                      // очередь
      if (!P.queue.length) return [{ label: "Очередь пуста", onSelect() {} }];
      const rows = [{ label: "Очистить очередь", onSelect: () => { P.clearQueue(); toast("Очередь очищена"); } }];
      P.queue.forEach((t, i) => rows.push({
        label: t.title, cur: i === P.index,
        onSelect: () => { P.jumpTo(i); openNowPlaying(); },
        onHold: () => { P.removeFromQueue(i); toast("Убрано из очереди"); }
      }));
      return rows;
    }
    return [];
  };
  const hintOf = (s) => s.type === "album" ? "● удерживай: в очередь" : s.type === "queue" ? "● удерживай: убрать" : "";

  /* ===== 4. Отрисовка ===== */
  let nowRefs = null;                                   // ссылки на элементы экрана «Сейчас играет»
  let rows = [];                                        // строки текущего списка
  let volTimer;

  const visibleRows = () => Math.max(1, Math.floor(ui.view.clientHeight / ROW_H));
  const ensureVisible = (s) => {                         // прокрутка, чтобы выбранная строка была на виду
    const n = visibleRows();
    if (s.sel < s.scroll) s.scroll = s.sel;
    if (s.sel >= s.scroll + n) s.scroll = s.sel - n + 1;
  };

  const render = (anim) => {
    const s = top();
    ui.title.textContent = s.title;
    ui.hint.textContent = hintOf(s);
    dev.classList.toggle("has-hint", !!hintOf(s));
    ui.view.textContent = "";
    ui.view.className = "ipod-view" + (anim ? " slide-" + anim : "");
    nowRefs = null;
    if (s.type === "now") { renderNow(s); }
    else {
      rows = rowsOf(s);
      s.sel = Math.min(s.sel, rows.length - 1);
      ensureVisible(s);
      const list = el("div", "ilist");
      rows.forEach((r, i) => {
        const row = el("div", "irow" + (i === s.sel ? " sel" : "") + (r.cur ? " cur" : ""));
        row.append(el("span", "irow-l", r.label));
        const right = el("span", "irow-r");
        if (r.value) right.append(el("em", "", r.value));
        if (r.go) right.insertAdjacentHTML("beforeend", icon("chevron"));
        row.append(right);
        row.addEventListener("click", () => { s.sel = i; select(); });   // нажатие пальцем по строке тоже работает
        list.append(row);
      });
      list.style.transform = `translateY(${-s.scroll * ROW_H}px)`;
      ui.view.append(list);
    }
    paintIndicator();
    lastSig = signature();
  };

  const renderNow = (s) => {
    const box = el("div", "np");
    box.innerHTML = `
      <div class="np-top">
        <div class="np-art"></div>
        <div class="np-meta"><b></b><span class="np-artist"></span><span class="np-album"></span><small class="np-n"></small></div>
      </div>
      <div class="np-bar"><span class="np-t1">0:00</span><div class="np-track"><i></i></div><span class="np-t2">-0:00</span></div>
      <div class="np-foot"><span class="np-mode"></span>
        <span class="np-vol">${icon("vol")}<div class="np-volbar"><i></i></div></span></div>`;
    ui.view.append(box);
    nowRefs = {
      art: box.querySelector(".np-art"), title: box.querySelector(".np-meta b"), artist: box.querySelector(".np-artist"),
      album: box.querySelector(".np-album"), n: box.querySelector(".np-n"), t1: box.querySelector(".np-t1"), t2: box.querySelector(".np-t2"),
      fill: box.querySelector(".np-track i"), mode: box.querySelector(".np-mode"), vol: box.querySelector(".np-vol"), volFill: box.querySelector(".np-volbar i"), artId: null
    };
    updateNow(s);
  };
  const updateNow = (s) => {
    const r = nowRefs, t = P.current;
    if (!r) return;
    if (!t) { r.title.textContent = "Ничего не играет"; r.artist.textContent = r.album.textContent = r.n.textContent = ""; r.art.textContent = ""; return; }
    r.title.textContent = t.title; r.artist.textContent = t.artist; r.album.textContent = t.album;
    r.n.textContent = (P.index + 1) + " из " + P.queue.length;
    if (r.artId !== t.id) {                              // обложку перерисовываем только при смене трека
      r.artId = t.id; r.art.textContent = "";
      if (t.cover) { const img = el("img"); img.alt = ""; img.src = t.cover; r.art.append(img); } else r.art.innerHTML = icon("note");
    }
    const d = P.duration, c = P.time;
    r.t1.textContent = fmt(c); r.t2.textContent = "-" + fmt(d - c);
    r.fill.style.width = (d ? (c / d) * 100 : 0) + "%";
    r.mode.textContent = s.mode === "scrub" ? "перемотка колесом" : "громкость колесом";
    r.volFill.style.width = Math.round(P.volume * 100) + "%";
  };
  const paintIndicator = () => { ui.ind.innerHTML = icon(P.playing ? "play" : "pause"); dev.classList.toggle("is-playing", P.playing); };

  /* Следим за движком: перерисовываем список только если что-то поменялось, прогресс обновляем всегда */
  const signature = () => [P.current && P.current.id, P.playing, P.shuffle, P.repeat, P.queue.length, P.index, P.library.length].join("|");
  let lastSig = "";
  P.subscribe(() => {
    if (dev.hidden) return;
    const s = top();
    paintIndicator();
    if (s.type === "now") { if (nowRefs) updateNow(s); else render(); }
    if (signature() !== lastSig && s.type !== "now") render();
    lastSig = signature();
  });

  /* ===== 5. Колесо и кнопки ===== */
  const select = () => { const r = rows[top().sel]; if (top().type !== "now" && r) { tick(); r.onSelect(); } };
  const rotate = (dir) => {                              // dir: +1 по часовой (вниз), -1 против
    const s = top();
    if (s.type === "now") {
      if (s.mode === "scrub") { if (P.duration) P.seek((P.time + dir * 5) / P.duration); }
      else { P.volume = P.volume + dir * 0.04; }
      if (s.mode !== "scrub" && nowRefs) { nowRefs.vol.classList.add("show"); clearTimeout(volTimer); volTimer = setTimeout(() => nowRefs && nowRefs.vol.classList.remove("show"), 1400); }
      tick(); updateNow(s); return;
    }
    const next = Math.max(0, Math.min(rows.length - 1, s.sel + dir));
    if (next === s.sel) return;
    s.sel = next; ensureVisible(s); tick();
    ui.view.querySelectorAll(".irow").forEach((n, i) => n.classList.toggle("sel", i === next));
    const list = ui.view.querySelector(".ilist");
    if (list) list.style.transform = `translateY(${-s.scroll * ROW_H}px)`;
  };
  const back = () => { tick(); if (!pop()) setOpen(false); };       // MENU: назад, а на главном экране закрыть

  /* Вращение: считаем угол пальца вокруг центра колеса */
  let down = false, last = 0, acc = 0, moved = 0, startAng = 0, t0 = 0;
  const angle = (e) => {
    const r = ui.wheel.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  };
  ui.wheel.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".ipod-center")) return;
    down = true; ui.wheel.setPointerCapture(e.pointerId);
    last = startAng = angle(e); acc = moved = 0; t0 = performance.now();
    if (NL.settings && NL.settings.clickSound && actx && actx.state === "suspended") actx.resume();
  });
  ui.wheel.addEventListener("pointermove", (e) => {
    if (!down) return;
    const a = angle(e);
    let d = a - last; if (d > 180) d -= 360; if (d < -180) d += 360;
    last = a; moved += Math.abs(d); acc += d;
    while (acc >= STEP_DEG) { acc -= STEP_DEG; rotate(1); }
    while (acc <= -STEP_DEG) { acc += STEP_DEG; rotate(-1); }
  });
  const endDrag = () => {
    if (!down) return;
    down = false;
    if (moved < 9 && performance.now() - t0 < 600) {      // это не вращение, а нажатие на край колеса
      const a = startAng;
      if (a >= -135 && a < -45) back();                    // верх: MENU
      else if (a >= -45 && a < 45) { tick(); P.next(); }   // право: следующий
      else if (a >= 45 && a < 135) { tick(); P.toggle(); } // низ: плей/пауза
      else { tick(); P.prev(); }                           // лево: предыдущий
    }
  };
  ui.wheel.addEventListener("pointerup", endDrag);
  ui.wheel.addEventListener("pointercancel", () => { down = false; });
  dev.addEventListener("wheel", (e) => { e.preventDefault(); rotate(e.deltaY > 0 ? 1 : -1); }, { passive: false });   // колесо мыши тоже крутит

  /* Центральная кнопка: нажатие = выбрать, удержание = действие «в очередь / убрать» */
  let holdTimer = 0, held = false;
  ui.center.addEventListener("pointerdown", () => {
    held = false;
    holdTimer = setTimeout(() => {
      held = true;
      const r = rows[top().sel];
      if (top().type !== "now" && r && r.onHold) { tick(); r.onHold(); }
    }, 550);
  });
  const cancelHold = () => clearTimeout(holdTimer);
  ui.center.addEventListener("pointerup", cancelHold);
  ui.center.addEventListener("pointerleave", cancelHold);
  ui.center.addEventListener("click", () => {
    if (held) { held = false; return; }
    const s = top();
    if (s.type === "now") { s.mode = s.mode === "scrub" ? "volume" : "scrub"; tick(); updateNow(s); }   // переключить: громкость / перемотка
    else select();
  });

  /* Клавиатура */
  dev.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); rotate(1); }
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); rotate(-1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ui.center.click(); }
    else if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); back(); }
  });
  q(".ipod-x").addEventListener("click", () => { setOpen(false); P.button.focus(); });

  /* ===== 6. Открыть / закрыть ===== */
  // Поместить корпус в экран: на низких экранах телефона плеер немного уменьшается (css-свойство scale)
  const fit = () => dev.style.setProperty("--ipod-s", String(Math.min(1, Math.max(0.6, (window.innerHeight - 84) / 486))));
  window.addEventListener("resize", fit);
  const setOpen = (open) => {
    if (open) { fit(); }
    NL.showPop(dev, open);
    P.button.setAttribute("aria-expanded", String(open));
    if (open) { document.dispatchEvent(new CustomEvent("nl:popover", { detail: "ipod" })); render(); dev.focus({ preventScroll: true }); }
  };
  document.addEventListener("nl:popover", (e) => { if (e.detail !== "ipod" && NL.isPopOpen(dev)) NL.showPop(dev, false); });
  NL.retro = { setOpen, isOpen: () => NL.isPopOpen(dev) };
})();
