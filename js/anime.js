/* =====================================================================
   АНИМЕ-УГОЛОК (js/anime.js) — страница anime.html
   ---------------------------------------------------------------------
   1. «Комната»: картинка в тёмной комнате, мышка/палец = фонарик, лёгкий наклон
   2. «Сцена»: холст с частицами (сакура / дождь / светлячки / снег), реагирует на курсор
   3. «Что посмотреть?»: гача-кнопка со случайной рекомендацией
   Список для гачи лежит ниже в массиве PICKS: меняй свободно.
   ===================================================================== */
NL.onPage(() => {
  "use strict";
  if (!document.querySelector("#anime")) return;
  const $ = (s, r = document) => r.querySelector(s);
  const signal = NL.signal;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("no-anim");

  /* ===== 1. Комната с фонариком ===== */
  const room = $("#room");
  if (room) {
    const set = (x, y) => { room.style.setProperty("--mx", x + "%"); room.style.setProperty("--my", y + "%"); };
    let tx = 50, ty = 62, cx = 50, cy = 62, raf = 0;
    const loop = () => {                                    // свет плавно догоняет курсор
      cx += (tx - cx) * 0.14; cy += (ty - cy) * 0.14; set(cx.toFixed(1), cy.toFixed(1));
      room.style.setProperty("--rx", ((cy - 50) / -9).toFixed(2) + "deg");
      room.style.setProperty("--ry", ((cx - 50) / 9).toFixed(2) + "deg");
      raf = (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) ? requestAnimationFrame(loop) : 0;
    };
    const aim = (e) => {
      const r = room.getBoundingClientRect();
      tx = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100));
      ty = Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100));
      if (!raf) raf = requestAnimationFrame(loop);
    };
    room.addEventListener("pointermove", aim, { signal });
    room.addEventListener("pointerdown", (e) => { aim(e); room.classList.add("flick"); setTimeout(() => room.classList.remove("flick"), 380); }, { signal });
    room.addEventListener("pointerleave", () => { tx = 50; ty = 62; if (!raf) raf = requestAnimationFrame(loop); }, { signal });
    set(cx, cy);
    NL.onCleanup(() => cancelAnimationFrame(raf));
  }

  /* ===== 2. Сцена с частицами ===== */
  const cv = $("#scene");
  if (cv) {
    const g = cv.getContext("2d");
    let W = 0, H = 0, dpr = 1, mode = "sakura", parts = [], run = true, raf = 0, last = 0;
    const wind = { x: 0, tx: 0 }, ptr = { x: -999, y: -999, on: false };
    const lite = () => document.documentElement.classList.contains("lite");
    const THEMES = {
      sakura: { sky: ["#3a1f6b", "#a2508f"], n: 70 }, rain: { sky: ["#0b1330", "#1f3a63"], n: 160 },
      fireflies: { sky: ["#07101f", "#0f2a2a"], n: 55 }, snow: { sky: ["#16224a", "#4a5f9a"], n: 110 }
    };
    const make = (m, fresh) => {
      const p = { x: rnd(0, W), y: fresh ? rnd(0, H) : -20, r: rnd(2, 5), v: rnd(0.4, 1.4), a: rnd(0, 6.28), s: rnd(0.5, 1.5) };
      if (m === "rain") { p.y = fresh ? rnd(0, H) : rnd(-H * 0.2, 0); p.v = rnd(7, 13); p.r = rnd(8, 18); }
      if (m === "snow") { p.r = rnd(1.4, 3.6); p.v = rnd(0.3, 1); }
      if (m === "fireflies") { p.y = rnd(0, H); p.v = rnd(0.2, 0.6); p.r = rnd(1.6, 3.6); p.vx = rnd(-0.4, 0.4); p.vy = rnd(-0.4, 0.4); }
      return p;
    };
    const fill = () => { const n = Math.round(THEMES[mode].n * (lite() ? 0.5 : 1) * Math.min(1, (W * H) / 360000 + 0.35)); parts = Array.from({ length: n }, () => make(mode, true)); };
    const size = () => {
      const r = cv.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1);
      W = Math.max(200, Math.round(r.width)); H = Math.max(160, Math.round(r.height));
      cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); fill();
    };
    const step = (t) => {
      raf = requestAnimationFrame(step);
      if (!run) return;
      const dt = Math.min(2.2, (t - last) / 16.7 || 1); last = t;
      wind.x += (wind.tx - wind.x) * 0.05; wind.tx *= 0.96;
      const th = THEMES[mode], sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]); g.fillStyle = sky; g.fillRect(0, 0, W, H);
      if (mode === "sakura" || mode === "fireflies") { g.fillStyle = "rgba(255,255,255,.06)"; g.beginPath(); g.arc(W * 0.8, H * 0.22, Math.min(W, H) * 0.11, 0, 7); g.fill(); }
      for (const p of parts) {
        if (mode === "sakura") {
          p.a += 0.03 * p.s * dt; p.y += p.v * dt; p.x += (Math.sin(p.a) * 0.7 + wind.x) * dt;
          g.save(); g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = "rgba(255,190,225,.9)"; g.beginPath(); g.ellipse(0, 0, p.r * 1.6, p.r, 0, 0, 7); g.fill(); g.restore();
        } else if (mode === "rain") {
          p.y += p.v * dt; p.x += (wind.x * 2 - 1.5) * dt;
          g.strokeStyle = "rgba(190,215,255,.55)"; g.lineWidth = 1.1; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + 1.5 - wind.x * 2, p.y - p.r); g.stroke();
        } else if (mode === "snow") {
          p.a += 0.02 * dt; p.y += p.v * dt; p.x += (Math.sin(p.a) * 0.4 + wind.x * 0.8) * dt;
          g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
        } else {
          p.a += 0.03 * dt; p.vx += rnd(-0.03, 0.03); p.vy += rnd(-0.03, 0.03);
          if (ptr.on) { const dx = ptr.x - p.x, dy = ptr.y - p.y, d = Math.hypot(dx, dy) || 1; if (d < 220) { p.vx += dx / d * 0.04; p.vy += dy / d * 0.04; } }
          p.vx *= 0.97; p.vy *= 0.97; p.x += p.vx * dt * 1.6; p.y += p.vy * dt * 1.6;
          const glow = 0.5 + Math.sin(p.a * 2) * 0.4, rad = p.r * 6, gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
          gr.addColorStop(0, "rgba(220,255,140," + glow + ")"); gr.addColorStop(1, "rgba(220,255,140,0)"); g.fillStyle = gr; g.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
        }
        if (p.y > H + 20 || p.x < -40 || p.x > W + 40) { if (mode === "fireflies") { p.x = (p.x + W) % W; p.y = (p.y + H) % H; } else Object.assign(p, make(mode, false), { x: rnd(-20, W + 20) }); }
      }
    };
    cv.addEventListener("pointermove", (e) => {
      const r = cv.getBoundingClientRect(); const nx = e.clientX - r.left;
      wind.tx = Math.max(-3, Math.min(3, (nx - ptr.x) * 0.12)); ptr.x = nx; ptr.y = e.clientY - r.top; ptr.on = true;
    }, { signal });
    cv.addEventListener("pointerleave", () => { ptr.on = false; }, { signal });
    $("#sceneModes").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return; mode = b.dataset.m;
      document.querySelectorAll("#sceneModes button").forEach((x) => x.classList.toggle("on", x === b)); fill();
    }, { signal });
    if (calm()) { run = false; }
    const io = new IntersectionObserver((en) => { run = en[0].isIntersecting && !calm(); }, { threshold: 0.05 });
    io.observe(cv);
    addEventListener("resize", size, { signal });
    size(); raf = requestAnimationFrame(step);
    if (calm()) { run = true; step(0); run = false; }       // для «без анимаций»: один неподвижный кадр
    NL.onCleanup(() => { cancelAnimationFrame(raf); io.disconnect(); });
  }

  /* ===== 3. «Что посмотреть?» ===== */
  const PICKS = [
    { t: "Cowboy Bebop", y: 1998, tags: "космо-нуар · джаз", d: "Охотники за головами, джаз и усталая грусть. Идеально под вечер." },
    { t: "Serial Experiments Lain", y: 1998, tags: "киберпанк · психология", d: "Девочка, сеть и стирающаяся граница реальности. Тяжело, странно, незабываемо." },
    { t: "FLCL", y: 2000, tags: "безумие · рок", d: "Короткий взрыв энергии, гитар и метафор. Не пытайся понять с первого раза." },
    { t: "Ghost in the Shell", y: 1995, tags: "киберпанк · кино", d: "Что делает человека человеком, если тело можно заменить." },
    { t: "Mushishi", y: 2005, tags: "уют · мистика", d: "Спокойные истории про странников и невидимых существ. Лечит нервы." },
    { t: "Haibane Renmei", y: 2002, tags: "тихая загадка", d: "Крылатые существа в замкнутом городе. Медленно и очень красиво." },
    { t: "Paranoia Agent", y: 2004, tags: "триллер · сатира", d: "Мальчик с битой и город, который боится сам себя." },
    { t: "Perfect Blue", y: 1997, tags: "психо-триллер · кино", d: "Поп-звезда, сцена и размытые границы «кто я». Не для слабонервных." },
    { t: "Welcome to the NHK", y: 2006, tags: "чёрная комедия", d: "Затворник, заговоры и очень честный разговор о жизни." },
    { t: "Texhnolyze", y: 2003, tags: "мрачный киберпанк", d: "Подземный город, тишина и руки из железа. Только для вайбовых." },
    { t: "Kaiba", y: 2008, tags: "арт · фантастика", d: "Мир, где память можно хранить на носителе. Визуал как детская книга про грустное." },
    { t: "Neon Genesis Evangelion", y: 1995, tags: "классика · драма", d: "Роботы снаружи, терапия внутри. Если ещё нет, то самое время." }
  ];
  const card = $("#pickCard"), histEl = $("#pickHist"); let lastIdx = -1;
  const roll = () => {
    let i; do { i = Math.floor(Math.random() * PICKS.length); } while (i === lastIdx && PICKS.length > 1); lastIdx = i;
    const p = PICKS[i]; card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
    card.innerHTML = `<small>${p.tags}</small><b>${p.t}</b><span>${p.y}</span><p>${p.d}</p>`;
    const chip = document.createElement("li"); chip.textContent = p.t; histEl.prepend(chip); while (histEl.children.length > 6) histEl.lastChild.remove();
  };
  $("#pickRoll").addEventListener("click", roll, { signal });
});
