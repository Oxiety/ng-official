/* =====================================================================
   АНИМЕ-УГОЛОК (js/anime.js): страница anime.html, пиксельный стиль
   ---------------------------------------------------------------------
   Разделы:  1. Шрифты   2. Пиксельная сцена в шапке (ночной город, поезд)
             3. Цитаты с эффектом печати   4. Погода (частицы)
             5. «Что посмотреть?»: список из data/anime.json, жанры, гача
   Список тайтлов правится в data/anime.json (t: название, y: год,
   tags: жанры, d: описание). Цитаты лежат в массиве QUOTES ниже.
   ===================================================================== */
NL.onPage(() => {
  "use strict";
  if (!document.querySelector("#anime")) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const signal = NL.signal;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (n) => Math.floor(Math.random() * n);
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("no-anim");
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  NL.onCleanup(() => { timers.forEach(clearTimeout); timers.clear(); });

  /* ===== 1. Шрифты (при переходе по сайту <head> не меняется, поэтому подключаем сами) ===== */
  if (!document.querySelector('link[href*="DotGothic16"]')) {
    const l = document.createElement("link"); l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=DotGothic16&family=Press+Start+2P&family=VT323&display=swap"; document.head.append(l);
  }

  /* ===== 2. Пиксельная сцена в шапке ===== */
  const hero = $("#pxScene");
  if (hero) {
    const W = 320, H = 180; hero.width = W; hero.height = H;
    const g = hero.getContext("2d"); g.imageSmoothingEnabled = false;
    let seed = 20261114; const rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.imageSmoothingEnabled = false; return [c, x]; };
    /* небо: полосы цвета с шахматной растушёвкой на границах */
    const BANDS = ["#0b0826", "#120c38", "#1b1050", "#2a1568", "#411a7a", "#64228a", "#9a3a92", "#d0618f", "#f29a8c"];
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const [sky, sg] = mk(W, H);
    const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    const img = sg.createImageData(W, H), horizon = H * 0.78;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = Math.min(0.9999, y / horizon) * (BANDS.length - 1), i = Math.floor(t), f = t - i;
      const use = f > 0.5 && (f - 0.5) * 2 > BAYER[(y & 3) * 4 + (x & 3)] / 16 ? i + 1 : i, c = hex(BANDS[Math.min(use, BANDS.length - 1)]), o = (y * W + x) * 4;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    sg.putImageData(img, 0, 0);
    /* луна */
    const mx = 248, my = 40, mr = 19;
    for (let y = -mr; y <= mr; y++) for (let x = -mr; x <= mr; x++) if (x * x + y * y <= mr * mr) { sg.fillStyle = (x * x + y * y > (mr - 3) * (mr - 3)) ? "#e9defc" : "#fff6e4"; sg.fillRect(mx + x, my + y, 1, 1); }
    sg.fillStyle = "#e2d3f5"; [[-6, -4, 4, 3], [4, 2, 5, 4], [-3, 8, 3, 2], [8, -8, 2, 2]].forEach(([a, b, w, h]) => sg.fillRect(mx + a, my + b, w, h));
    /* город тремя слоями */
    const LAYERS = [{ col: "#2a1a5e", base: 120, hmin: 16, hmax: 40, wmin: 10, wmax: 24, k: 2, win: "#8a6fd0" }, { col: "#1b1043", base: 140, hmin: 20, hmax: 56, wmin: 12, wmax: 28, k: 5, win: "#ffd98a" }, { col: "#0f0830", base: 168, hmin: 24, hmax: 66, wmin: 14, wmax: 32, k: 9, win: "#ff9fe5" }];
    LAYERS.forEach((L) => {
      const [c, x] = mk(W + 24, H); L.canvas = c; L.wins = [];
      for (let px = -4; px < W + 24;) {
        const w = Math.floor(rnd(L.wmin, L.wmax)), h = Math.floor(rnd(L.hmin, L.hmax)), top = L.base - h + 20;
        x.fillStyle = L.col; x.fillRect(px, top, w, H - top);
        if (rand() > 0.6) x.fillRect(px + 2, top - 3, 2, 3);                       // антенна
        for (let wy = top + 4; wy < H - 6; wy += 6) for (let wx = px + 3; wx < px + w - 3; wx += 5) if (rand() > 0.55) L.wins.push([wx, wy, rand()]);
        px += w + Math.floor(rnd(0, 3));
      }
    });
    const stars = Array.from({ length: 56 }, () => [Math.floor(rand() * W), Math.floor(rand() * H * 0.55), rand() * 6.28]);
    const petals = Array.from({ length: 26 }, () => ({ x: rand() * W, y: rand() * H, v: rnd(0.15, 0.45), s: rnd(0, 6.28) }));
    let train = null, nextTrain = 1500, shoot = null, pxo = 0, tx = 0, last = 0, raf = 0, run = true, tm = 0;
    const lamp = (t) => 0.5 + 0.5 * Math.sin(t);
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (!run || now - last < 42) return;                                          // около 24 кадров в секунду
      const dt = now - last; last = now; tm += dt; pxo += (tx - pxo) * 0.08;
      g.drawImage(sky, 0, 0);
      stars.forEach(([x, y, p]) => { if (lamp(tm / 600 + p) > 0.35) { g.fillStyle = lamp(tm / 400 + p) > 0.8 ? "#fff" : "#b9a8ff"; g.fillRect(x - Math.round(pxo * 0.4), y, 1, 1); } });
      if (!shoot && Math.random() < 0.0035) shoot = { x: rnd(80, 260), y: rnd(8, 40), life: 0 };
      if (shoot) { shoot.life += dt; const p = shoot.life / 700; g.fillStyle = "#fff"; for (let i = 0; i < 9; i++) g.fillRect(Math.round(shoot.x - p * 90 + i * 2), Math.round(shoot.y + p * 40 - i), 1, 1); if (p >= 1) shoot = null; }
      LAYERS.forEach((L, li) => {
        const off = -12 + Math.round(pxo * L.k / 5); g.drawImage(L.canvas, off, 0);
        L.wins.forEach(([wx, wy, ph]) => { if (lamp(tm / (1800 + ph * 5200) + ph * 9) > 0.18) { g.fillStyle = L.win; g.fillRect(wx + off, wy, 2, 3); } });
        if (li === 1) {                                                              // поезд идёт перед средним слоем
          nextTrain -= dt;
          if (!train && nextTrain <= 0) train = { x: -140, cars: 5 + ri(3) };
          if (train) {
            train.x += dt * 0.055; const ty = 150;
            for (let c = 0; c < train.cars; c++) { const x = train.x + c * 25; g.fillStyle = "#3b2a85"; g.fillRect(x, ty, 23, 9); g.fillStyle = "#6a54c8"; g.fillRect(x, ty, 23, 1);
              g.fillStyle = "#ffe9a8"; for (let w = 0; w < 4; w++) g.fillRect(x + 2 + w * 5, ty + 3, 3, 3); g.fillStyle = "#14093a"; g.fillRect(x + 3, ty + 9, 3, 2); g.fillRect(x + 17, ty + 9, 3, 2); }
            if (train.x > W + 10) { train = null; nextTrain = 9000 + rnd(0, 9000); }
          }
          g.fillStyle = "#1b1043"; g.fillRect(0, 160, W, 1);                          // рельсы
        }
      });
      petals.forEach((p) => { p.s += 0.03; p.y += p.v; p.x += Math.sin(p.s) * 0.35 + 0.18; if (p.y > H) { p.y = -2; p.x = rand() * W; } if (p.x > W) p.x = 0; g.fillStyle = "#ffb6ee"; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); });
    };
    hero.parentElement.addEventListener("pointermove", (e) => { const r = hero.getBoundingClientRect(); tx = ((e.clientX - r.left) / r.width - 0.5) * 14; }, { signal });
    const io = new IntersectionObserver((en) => { run = en[0].isIntersecting && !calm(); }, { threshold: 0.02 }); io.observe(hero);
    if (calm()) { run = true; last = -100; frame(1000); run = false; }                  // без анимаций: один кадр
    raf = requestAnimationFrame(frame); NL.onCleanup(() => { cancelAnimationFrame(raf); io.disconnect(); });
  }

  /* ===== 3. Цитаты ===== */
  const QUOTES = [
    ["逃げちゃだめだ。", "Нельзя убегать.", "Neon Genesis Evangelion"],
    ["笑えばいいと思うよ。", "Думаю, нужно просто улыбнуться.", "Neon Genesis Evangelion"],
    ["俺を信じろ。お前を信じる俺を信じろ。", "Верь в меня. Верь в меня, который верит в тебя.", "Tengen Toppa Gurren Lagann"],
    ["諦めたらそこで試合終了ですよ。", "Если сдашься, на этом игра закончится.", "Slam Dunk"],
    ["一度あったことは忘れないものさ。思い出せないだけで。", "Случившееся не забывается. Ты просто не можешь вспомнить.", "Spirited Away"],
    ["俺は海賊王になる！", "Я стану Королём пиратов!", "One Piece"],
    ["等価交換。", "Равноценный обмен.", "Fullmetal Alchemist"]
  ];
  const qJp = $("#qJp"), qRu = $("#qRu"), qSrc = $("#qSrc"); let qi = ri(QUOTES.length), typing = 0, auto = 0;
  const showQuote = (i) => {
    qi = (i + QUOTES.length) % QUOTES.length; const [jp, ru, src] = QUOTES[qi];
    clearInterval(typing); qRu.classList.remove("on"); qSrc.classList.remove("on"); qRu.textContent = ru; qSrc.textContent = "— " + src;
    if (calm()) { qJp.textContent = jp; qRu.classList.add("on"); qSrc.classList.add("on"); return; }
    qJp.textContent = ""; let n = 0;
    typing = setInterval(() => { qJp.textContent = jp.slice(0, ++n); if (n >= jp.length) { clearInterval(typing); qRu.classList.add("on"); qSrc.classList.add("on"); } }, 90);
  };
  const cycle = () => { clearTimeout(auto); auto = later(() => { showQuote(qi + 1); cycle(); }, 11000); };
  $("#qNext").addEventListener("click", () => { showQuote(qi + 1); cycle(); }, { signal });
  $("#qPrev").addEventListener("click", () => { showQuote(qi - 1); cycle(); }, { signal });
  NL.onCleanup(() => clearInterval(typing)); showQuote(qi); cycle();

  /* ===== 4. Погода: частицы-пиксели ===== */
  const cv = $("#scene");
  if (cv) {
    const g = cv.getContext("2d"); g.imageSmoothingEnabled = false;
    const PX = 3; let W = 0, H = 0, mode = "sakura", parts = [], run = true, raf = 0, last = 0;
    const wind = { x: 0, tx: 0 }, ptr = { x: -999, y: -999, on: false };
    const lite = () => document.documentElement.classList.contains("lite");
    const THEMES = { sakura: { sky: ["#2a1268", "#5a2a88", "#9a3a92", "#d0618f"], n: 70 }, rain: { sky: ["#070d26", "#0f1d44", "#1c3566", "#2c4d80"], n: 150 }, fireflies: { sky: ["#05101c", "#0a1e26", "#0f2e2c", "#143a30"], n: 50 }, snow: { sky: ["#141f4a", "#2a3a78", "#4a5f9a", "#7a8cc0"], n: 100 } };
    const make = (m, fresh) => {
      const p = { x: rnd(0, W), y: fresh ? rnd(0, H) : -3, v: rnd(0.2, 0.7), a: rnd(0, 6.28), s: rnd(0.6, 1.5) };
      if (m === "rain") { p.y = fresh ? rnd(0, H) : rnd(-H * 0.2, 0); p.v = rnd(2.4, 4.4); }
      if (m === "fireflies") { p.y = rnd(0, H); p.vx = rnd(-0.2, 0.2); p.vy = rnd(-0.2, 0.2); }
      return p;
    };
    const fill = () => { parts = Array.from({ length: Math.round(THEMES[mode].n * (lite() ? 0.5 : 1) * Math.min(1, W * H / 12000 + 0.3)) }, () => make(mode, true)); };
    const size = () => { const r = cv.getBoundingClientRect(); W = Math.max(60, Math.round(r.width / PX)); H = Math.max(40, Math.round(r.height / PX)); cv.width = W; cv.height = H; g.imageSmoothingEnabled = false; fill(); };
    const step = (t) => {
      raf = requestAnimationFrame(step); if (!run || t - last < 40) return; const dt = Math.min(2.5, (t - last) / 16.7); last = t;
      wind.x += (wind.tx - wind.x) * 0.06; wind.tx *= 0.95;
      const sk = THEMES[mode].sky, bh = Math.ceil(H / sk.length); sk.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * bh, W, bh + 1); });
      if (mode === "sakura" || mode === "fireflies") { g.fillStyle = "#f4ead8"; g.fillRect(W - 24, 8, 10, 10); g.fillStyle = "#d9c9ec"; g.fillRect(W - 21, 11, 3, 3); }
      for (const p of parts) {
        if (mode === "sakura") { p.a += 0.04 * dt; p.y += p.v * dt; p.x += (Math.sin(p.a) * 0.3 + 0.1 + wind.x) * dt; g.fillStyle = "#ffb6ee"; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); g.fillStyle = "#ff8fd6"; g.fillRect(Math.round(p.x) + 1, Math.round(p.y) + 1, 1, 1); }
        else if (mode === "rain") { p.y += p.v * dt; p.x += (wind.x - 0.4) * dt; g.fillStyle = "#9ebfff"; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 3); }
        else if (mode === "snow") { p.a += 0.03 * dt; p.y += p.v * 0.7 * dt; p.x += (Math.sin(p.a) * 0.25 + wind.x * 0.8) * dt; g.fillStyle = "#fff"; g.fillRect(Math.round(p.x), Math.round(p.y), p.s > 1.1 ? 2 : 1, p.s > 1.1 ? 2 : 1); }
        else {
          p.a += 0.05 * dt; p.vx += rnd(-0.02, 0.02); p.vy += rnd(-0.02, 0.02);
          if (ptr.on) { const dx = ptr.x - p.x, dy = ptr.y - p.y, d = Math.hypot(dx, dy) || 1; if (d < 70) { p.vx += dx / d * 0.03; p.vy += dy / d * 0.03; } }
          p.vx *= 0.96; p.vy *= 0.96; p.x += p.vx * dt; p.y += p.vy * dt;
          const on = Math.sin(p.a) > -0.2; if (on) { g.fillStyle = Math.sin(p.a) > 0.6 ? "#f4ffb0" : "#b9e86a"; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); g.fillStyle = "rgba(190,240,110,.25)"; g.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1); g.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3); }
        }
        if (p.y > H + 4 || p.x < -4 || p.x > W + 4) { if (mode === "fireflies") { p.x = (p.x + W) % W; p.y = (p.y + H) % H; } else Object.assign(p, make(mode, false), { x: rnd(-2, W + 2) }); }
      }
    };
    cv.addEventListener("pointermove", (e) => { const r = cv.getBoundingClientRect(), nx = (e.clientX - r.left) / PX; wind.tx = Math.max(-2, Math.min(2, (nx - ptr.x) * 0.08)); ptr.x = nx; ptr.y = (e.clientY - r.top) / PX; ptr.on = true; }, { signal });
    cv.addEventListener("pointerleave", () => { ptr.on = false; }, { signal });
    $("#sceneModes").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; mode = b.dataset.m; $$("#sceneModes button").forEach((x) => x.classList.toggle("on", x === b)); fill(); }, { signal });
    const io = new IntersectionObserver((en) => { run = en[0].isIntersecting && !calm(); }, { threshold: 0.05 }); io.observe(cv);
    addEventListener("resize", size, { signal }); size(); raf = requestAnimationFrame(step);
    if (calm()) { run = true; last = -100; step(1000); run = false; }
    NL.onCleanup(() => { cancelAnimationFrame(raf); io.disconnect(); });
  }

  /* ===== 5. «Что посмотреть?» ===== */
  const KEY = "northling-anime";
  let mine = { want: [], seen: [] };
  try { const m = JSON.parse(localStorage.getItem(KEY)); if (m) mine = { want: m.want || [], seen: m.seen || [] }; } catch (_) {}
  const saveMine = () => { try { localStorage.setItem(KEY, JSON.stringify(mine)); } catch (_) {} };
  const gCard = $("#gCard"), gAll = $("#gAll"), gTags = $("#gTags"), gWant = $("#gWant"), gSeen = $("#gSeen"), wantList = $("#gWantList");
  let list = [], tag = "все", cur = null;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const filtered = () => list.filter((a) => tag === "все" || a.tags.includes(tag));
  const paintAll = () => {
    const f = filtered(); $("#allN").textContent = "(" + f.length + ")";
    gAll.innerHTML = f.map((a) => `<button type="button" role="listitem" class="g-item${mine.seen.includes(a.t) ? " seen" : ""}${cur && cur.t === a.t ? " on" : ""}" data-t="${esc(a.t)}"><b>${esc(a.t)}</b><i>${a.y}</i></button>`).join("");
  };
  const paintMine = () => {
    $("#wantN").textContent = "(" + mine.want.length + ")";
    wantList.innerHTML = mine.want.length ? mine.want.map((t) => `<span class="px-chip">${esc(t)}<button type="button" data-rm="${esc(t)}" aria-label="Убрать">x</button></span>`).join("") : '<em class="px-note">пока пусто</em>';
    gWant.textContent = cur && mine.want.includes(cur.t) ? "убрать из «хочу»" : "хочу"; gSeen.textContent = cur && mine.seen.includes(cur.t) ? "не смотрел" : "смотрел";
  };
  const show = (a) => {
    cur = a; gCard.classList.remove("pop"); void gCard.offsetWidth; gCard.classList.add("pop");
    gCard.innerHTML = `<small>${a.tags.map(esc).join(" / ")}</small><b>${esc(a.t)}</b><span>${a.y}</span><p>${esc(a.d)}</p>`;
    gWant.disabled = gSeen.disabled = false; paintAll(); paintMine();
  };
  const roll = () => {
    let pool = filtered(); if ($("#gSkipSeen").checked) { const fresh = pool.filter((a) => !mine.seen.includes(a.t)); if (fresh.length) pool = fresh; }
    if (!pool.length) { gCard.innerHTML = "<small>пусто</small><b>Ничего не нашлось</b><p>Смени жанр.</p>"; return; }
    let a; do { a = pool[ri(pool.length)]; } while (pool.length > 1 && cur && a.t === cur.t); show(a);
  };
  $("#gRoll").addEventListener("click", roll, { signal });
  gAll.addEventListener("click", (e) => { const b = e.target.closest(".g-item"); if (b) show(list.find((a) => a.t === b.dataset.t)); }, { signal });
  gTags.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; tag = b.dataset.g; $$("button", gTags).forEach((x) => x.classList.toggle("on", x === b)); paintAll(); }, { signal });
  gWant.addEventListener("click", () => { if (!cur) return; const i = mine.want.indexOf(cur.t); if (i >= 0) mine.want.splice(i, 1); else mine.want.push(cur.t); saveMine(); paintMine(); }, { signal });
  gSeen.addEventListener("click", () => { if (!cur) return; const i = mine.seen.indexOf(cur.t); if (i >= 0) mine.seen.splice(i, 1); else { mine.seen.push(cur.t); const w = mine.want.indexOf(cur.t); if (w >= 0) mine.want.splice(w, 1); } saveMine(); paintAll(); paintMine(); }, { signal });
  wantList.addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (!b) return; mine.want = mine.want.filter((t) => t !== b.dataset.rm); saveMine(); paintMine(); }, { signal });
  fetch("data/anime.json", { signal }).then((r) => r.json()).then((d) => {
    list = d; const count = {}; d.forEach((a) => a.tags.forEach((t) => { count[t] = (count[t] || 0) + 1; }));
    const tags = Object.keys(count).sort((a, b) => count[b] - count[a] || a.localeCompare(b, "ru")).slice(0, 18);
    gTags.innerHTML = ["все", ...tags].map((t) => `<button type="button" class="px-chip${t === "все" ? " on" : ""}" data-g="${esc(t)}">${esc(t)}</button>`).join("");
    paintAll(); paintMine();
  }).catch(() => { gAll.textContent = "Не получилось загрузить список."; });
  paintMine();
});
