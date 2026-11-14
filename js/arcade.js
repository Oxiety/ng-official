/* =====================================================================
   ИНТЕРАКТИВЧИК (js/arcade.js) — страница interactive.html
   ---------------------------------------------------------------------
   Апофеоз лудомании, но понарошку: ни денег, ни настоящих ставок. Монетки
   лежат в localStorage (ключ northling-wallet) и нигде больше не живут.
   Разделы:  1. Кошелёк и статистика   2. Эффекты   3. Слоты   4. Рулетка
             5. Ракета (crash)   6. Скретч-карта   7. Микрозайм
             8. Лента «выигрышей»   9. Всплывающая реклама
   ===================================================================== */
NL.onPage(() => {
  "use strict";
  const rootEl = document.querySelector("#arcade");
  if (!rootEl) return;
  /* Все тексты и числа лежат в data/arcade.json (правятся в админке, вкладка «Интерактивчик») */
  NL.loadTx("data/arcade.json", rootEl).then((C) => { if (NL.signal.aborted) return; NL.arcadeCfg = C; start(C); });
  function start(C) {
  const num = (k, d) => { const v = parseFloat(C[k]); return Number.isFinite(v) ? v : d; };
  const list = (k) => Array.isArray(C[k]) ? C[k] : [];
  const T = (k, v = {}) => String(C[k] ?? "").replace(/\{(\w+)\}/g, (m, n) => (n in v ? v[n] : m));
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const signal = NL.signal;
  const rnd = (n) => Math.floor(Math.random() * n);
  const fmt = (n) => Math.round(n).toLocaleString("ru-RU");
  const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("no-anim");
  const COIN = '<svg class="coin" aria-hidden="true"><use href="#i-coin"/></svg>';
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  NL.onCleanup(() => { timers.forEach(clearTimeout); timers.clear(); });

  /* ===== 1. Кошелёк и статистика ===== */
  const START = num("start_coins", 1000);
  const fresh = () => ({ coins: START, best: START, spins: 0, wagered: 0, won: 0, big: 0, debt: 0 });
  let wallet = fresh();
  try { const w = JSON.parse(localStorage.getItem("northling-wallet")); if (w && Number.isFinite(w.coins)) wallet = Object.assign(fresh(), w); } catch (_) {}
  const save = () => { try { localStorage.setItem("northling-wallet", JSON.stringify(wallet)); } catch (_) {} };
  const RANKS = list("ranks").map((r) => [parseFloat(r.spins) || 0, String(r.name || "")]).sort((x, y) => x[0] - y[0]);
  if (!RANKS.length) RANKS.push([0, "Турист"]);
  const rankOf = (n) => { let r = RANKS[0], next = null; for (let i = 0; i < RANKS.length; i++) if (n >= RANKS[i][0]) { r = RANKS[i]; next = RANKS[i + 1] || null; } return { name: r[1], from: r[0], next }; };
  const paint = () => {
    $("#coins").textContent = fmt(wallet.coins);
    $("#st-spins").textContent = fmt(wallet.spins); $("#st-wagered").textContent = fmt(wallet.wagered);
    $("#st-won").textContent = fmt(wallet.won); $("#st-big").textContent = fmt(wallet.big);
    $("#st-best").textContent = fmt(wallet.best);
    const r = rankOf(wallet.spins);
    $("#rankName").textContent = r.name;
    const pct = r.next ? (wallet.spins - r.from) / (r.next[0] - r.from) : 1;
    $("#rankFill").style.width = Math.round(Math.min(1, pct) * 100) + "%";
    $("#rankNext").textContent = r.next ? T("m_rank_next", { name: r.next[1], n: r.next[0] - wallet.spins }) : T("m_rank_max");
    $("#debt").textContent = fmt(wallet.debt);
    $("#loan").disabled = wallet.debt > num("loan_limit", 3000); $("#repay").disabled = !wallet.debt || !wallet.coins;
    $("#dole").hidden = wallet.coins >= 10;
    $("#bankNote").textContent = wallet.debt ? T("m_bank_debt") : T("m_bank_clean");
  };
  const add = (d) => { wallet.coins = Math.max(0, wallet.coins + d); wallet.best = Math.max(wallet.best, wallet.coins); save(); paint(); };
  const record = (bet, win) => { wallet.spins++; wallet.wagered += bet; wallet.won += win; wallet.big = Math.max(wallet.big, win); save(); paint(); };
  $("#walletReset").addEventListener("click", () => { if (!confirm("Обнулить кошелёк и всю статистику?")) return; wallet = fresh(); save(); paint(); }, { signal });
  $("#dole").addEventListener("click", () => add(num("dole", 500)), { signal });
  $("#loan").addEventListener("click", () => { wallet.debt += num("loan_owe", 750); add(num("loan_get", 500)); toast(T("m_loan", { debt: fmt(wallet.debt) })); }, { signal });
  $("#repay").addEventListener("click", () => { const p = Math.min(wallet.coins, wallet.debt); wallet.debt -= p; add(-p); toast(T("m_repay", { n: fmt(p) })); }, { signal });
  const toast = (t) => NL.toast && NL.toast(t);
  $("#loan").textContent = T("btn_loan", { get: num("loan_get", 500), owe: num("loan_owe", 750) });
  $("#dole").textContent = T("btn_dole", { n: num("dole", 500) });
  $(".jackpot-banner").setAttribute("aria-hidden", "true");

  /* Ставки: у каждой игры свои кнопки (data-bet-group) */
  const betOpts = String(C.bet_options || "10|50|100|MAX").split("|").map((x) => x.trim()).filter(Boolean);
  const firstBet = betOpts.map((x) => parseFloat(x)).find((x) => x > 0) || 10;
  const bets = { slots: firstBet, roulette: firstBet, crash: firstBet };
  $$("[data-bet-group]").forEach((group) => {
    const key = group.dataset.betGroup;
    group.innerHTML = betOpts.map((v) => /^max$/i.test(v) ? `<button type="button" data-v="max">${esc(v)}</button>` : `<button type="button" data-v="${parseFloat(v) || 0}">${esc(v)}</button>`).join("");
    const mark = () => $$("button", group).forEach((b) => b.classList.toggle("on", b.dataset.v === String(bets[key])));
    group.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; bets[key] = b.dataset.v === "max" ? "max" : +b.dataset.v; mark(); }, { signal });
    mark();
  });
  const betOf = (k) => bets[k] === "max" ? Math.min(wallet.coins, num("max_bet", 500)) : bets[k];

  /* ===== 2. Эффекты: дождь из монет, тряска ===== */
  const fx = $("#fx");
  const burst = (n = 24) => {
    if (calm()) return;
    for (let i = 0; i < n; i++) {
      const c = document.createElement("span"); c.className = "cf"; c.innerHTML = COIN;
      c.style.cssText = `left:${rnd(100)}%;--dx:${rnd(160) - 80}px;--r:${rnd(720) - 360}deg;animation-delay:${rnd(400)}ms;animation-duration:${1100 + rnd(900)}ms`;
      fx.append(c); later(() => c.remove(), 2600);
    }
  };
  const shake = (el) => { if (calm()) return; el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); };

  /* ===== 3. Слоты ===== */
  const SYMS = ["cherry", "lemon", "bell", "star", "diamond", "seven"];
  let SYM = list("slot_symbols").filter((x) => SYMS.includes(x.id)).map((x) => ({ id: x.id, w: Math.max(0, parseFloat(x.weight) || 0), m: parseFloat(x.mult) || 0 })).filter((x) => x.w > 0);
  if (!SYM.length) SYM = [{ id: "cherry", w: 1, m: 5 }];
  $(".pays").innerHTML = SYM.map((x) => `<span><svg viewBox="0 0 48 48" aria-hidden="true"><use href="#s-${x.id}"/></svg>x${x.m}</span>`).join("");
  const TW = SYM.reduce((a, x) => a + x.w, 0);
  const pick = () => { let r = rnd(TW); for (const x of SYM) if ((r -= x.w) < 0) return x; return SYM[0]; };
  const cellHtml = (x) => `<i><svg viewBox="0 0 48 48" aria-hidden="true"><use href="#s-${x.id}"/></svg></i>`;
  const strips = $$("#slots .strip"), slotMsg = $("#slotMsg"), slotBtn = $("#slotSpin"), REEL_H = 84;
  const setStrip = (s, x) => { s.style.transition = "none"; s.style.transform = "translateY(0)"; s.innerHTML = cellHtml(x); };
  strips.forEach((s) => setStrip(s, pick())); slotMsg.textContent = T("m_slot_idle");
  let spinning = false;
  const spin = async () => {
    if (spinning) return;
    const bet = betOf("slots");
    if (!bet || wallet.coins < bet) { slotMsg.textContent = T("m_slot_nocoins"); return; }
    spinning = true; slotBtn.disabled = true; slotMsg.textContent = T("m_slot_spin");
    $("#slots").classList.remove("win", "jackpot"); add(-bet);
    const res = strips.map(pick), quick = calm();
    await Promise.all(strips.map((s, i) => new Promise((done) => {
      const n = 14 + i * 8, items = Array.from({ length: n }, pick); items.push(res[i]);
      s.style.transition = "none"; s.style.transform = "translateY(0)"; s.innerHTML = items.map(cellHtml).join("");
      if (quick) { setStrip(s, res[i]); return done(); }
      void s.offsetWidth; const t = 1.1 + i * 0.5;
      s.style.transition = `transform ${t}s cubic-bezier(.2,.8,.2,1)`; s.style.transform = `translateY(${-n * REEL_H}px)`;
      later(() => { setStrip(s, res[i]); done(); }, t * 1000 + 40);
    })));
    const [a, b, c] = res; let win = 0, text = T("m_slot_lose");
    if (a === b && b === c) { win = bet * a.m; text = T("m_slot_triple", { n: fmt(win) }); }
    else if (a === b || b === c || a === c) { const p = a === b || a === c ? a : b; win = Math.round(bet * (p.id === "cherry" ? num("slot_pair_cherry_mult", 2) : num("slot_pair_mult", 1))); text = win > bet ? T("m_slot_pair_win", { n: fmt(win - bet) }) : T("m_slot_pair_back"); }
    if (win) add(win); record(bet, win);
    if (win > bet) { const big = win >= bet * Math.max(...SYM.map((x) => x.m)) * 0.5; $("#slots").classList.add(big ? "jackpot" : "win"); burst(big ? 60 : 22); shake($("#slotsWin")); if (big) $("#jackpotBanner").classList.add("show"), later(() => $("#jackpotBanner").classList.remove("show"), 2600); }
    slotMsg.textContent = text; spinning = false; slotBtn.disabled = false;
  };
  slotBtn.addEventListener("click", spin, { signal });

  /* ===== 4. Рулетка (европейская, 37 ячеек) ===== */
  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = (n) => n === 0 ? "green" : REDS.has(n) ? "red" : "black";
  const STEP = 360 / 37, canvas = $("#wheel"), wheelBox = $(".wheel-rot"), ballRing = $(".ball-ring");
  (() => {
    const size = 280, dpr = Math.min(2, devicePixelRatio || 1); canvas.width = canvas.height = size * dpr; canvas.style.width = canvas.style.height = size + "px";
    const g = canvas.getContext("2d"); g.scale(dpr, dpr); const c = size / 2, R = c - 4;
    ORDER.forEach((n, i) => {
      const a0 = (i - 0.5) * STEP * Math.PI / 180 - Math.PI / 2, a1 = (i + 0.5) * STEP * Math.PI / 180 - Math.PI / 2;
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, a0, a1); g.closePath(); g.fillStyle = { green: "#1c9a52", red: "#c8283d", black: "#16132e" }[colorOf(n)]; g.fill();
      g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1; g.stroke();
      g.save(); g.translate(c, c); g.rotate(i * STEP * Math.PI / 180); g.fillStyle = "#fff"; g.font = "700 11px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(n), 0, -R + 16); g.restore();
    });
    g.beginPath(); g.arc(c, c, R * 0.62, 0, 7); g.fillStyle = "#241468"; g.fill(); g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.arc(c, c, R * 0.2, 0, 7); g.fillStyle = "#b7a5ff"; g.fill();
  })();
  const BETS = {
    red: ["Красное", (n) => colorOf(n) === "red", 2], black: ["Чёрное", (n) => colorOf(n) === "black", 2],
    even: ["Чёт", (n) => n > 0 && n % 2 === 0, 2], odd: ["Нечёт", (n) => n % 2 === 1, 2],
    low: ["1–18", (n) => n >= 1 && n <= 18, 2], high: ["19–36", (n) => n >= 19, 2],
    d1: ["1-я дюжина", (n) => n >= 1 && n <= 12, 3], d2: ["2-я дюжина", (n) => n >= 13 && n <= 24, 3], d3: ["3-я дюжина", (n) => n >= 25, 3]
  };
  let choice = "red"; const grid = $("#numGrid"), rouMsg = $("#rouMsg"), rouBtn = $("#rouSpin"), hist = $("#rouHist");
  grid.innerHTML = Array.from({ length: 37 }, (_, n) => `<button type="button" class="num ${colorOf(n)}" data-n="${n}">${n}</button>`).join("");
  const markChoice = () => {
    $$("#rouChoices button").forEach((b) => b.classList.toggle("on", b.dataset.k === choice));
    $$(".num", grid).forEach((b) => b.classList.toggle("on", choice === "n" + b.dataset.n));
    $("#rouPick").textContent = choice.startsWith("n") ? "число " + choice.slice(1) + " (x36)" : BETS[choice][0].toLowerCase() + " (x" + BETS[choice][2] + ")";
  };
  $("#rouChoices").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { choice = b.dataset.k; markChoice(); } }, { signal });
  grid.addEventListener("click", (e) => { const b = e.target.closest(".num"); if (b) { choice = "n" + b.dataset.n; markChoice(); } }, { signal });
  markChoice();
  let wheelRot = 0, ballRot = 0, rouBusy = false; rouMsg.textContent = T("m_rou_idle");
  const spinRoulette = () => {
    if (rouBusy) return; const bet = betOf("roulette");
    if (!bet || wallet.coins < bet) { rouMsg.textContent = T("m_rou_nocoins"); return; }
    rouBusy = true; rouBtn.disabled = true; rouMsg.textContent = T("m_rou_spin"); add(-bet);
    const k = rnd(37), number = ORDER[k], dur = calm() ? 0 : 4.6, want = (360 - k * STEP) % 360, cur = ((wheelRot % 360) + 360) % 360;
    wheelRot += (want - cur + 360) % 360 + 360 * 5; ballRot -= 360 * 7 + (((ballRot % 360) + 360) % 360 ? 360 - (((ballRot % 360) + 360) % 360) : 0);
    wheelBox.style.transition = `transform ${dur}s cubic-bezier(.12,.62,.12,1)`; wheelBox.style.transform = `rotate(${wheelRot}deg)`;
    ballRing.style.transition = `transform ${Math.max(0, dur - 0.4)}s cubic-bezier(.2,.6,.15,1)`; ballRing.style.transform = `rotate(${ballRot}deg)`;
    later(() => {
      const mult = choice.startsWith("n") ? (+choice.slice(1) === number ? 36 : 0) : (BETS[choice][1](number) ? BETS[choice][2] : 0);
      if (mult) add(bet * mult); record(bet, bet * mult);
      rouMsg.textContent = T("m_rou_result", { n: number, color: { green: "зеро", red: "красное", black: "чёрное" }[colorOf(number)], res: mult ? T("m_rou_win", { n: fmt(bet * mult - bet) }) : T("m_rou_lose") });
      if (mult > 1) { burst(mult >= 36 ? 60 : 20); shake($("#rouWin")); }
      const chip = document.createElement("span"); chip.className = "num " + colorOf(number); chip.textContent = number; hist.prepend(chip); while (hist.children.length > 12) hist.lastChild.remove();
      rouBusy = false; rouBtn.disabled = false;
    }, dur * 1000 + 60);
  };
  rouBtn.addEventListener("click", spinRoulette, { signal });

  /* ===== 5. Ракета (crash): забери до взрыва ===== */
  const crashBtn = $("#crashGo"), crashNum = $("#crashNum"), crashMsg = $("#crashMsg"), rocket = $("#rocket"), crashHist = $("#crashHist"), crashBox = $("#crashBox");
  let crash = null, raf = 0;
  const stopCrash = () => { cancelAnimationFrame(raf); raf = 0; };
  NL.onCleanup(stopCrash);
  const endCrash = (cashed) => {
    stopCrash(); const c = crash; crash = null;
    crashBtn.textContent = T("btn_crash_start"); crashBtn.classList.add("primary"); crashBtn.classList.remove("hot");
    const chip = document.createElement("span"); chip.className = "num " + (c.point >= 2 ? "green" : "red"); chip.textContent = c.point.toFixed(2) + "x"; crashHist.prepend(chip); while (crashHist.children.length > 10) crashHist.lastChild.remove();
    if (cashed) return;
    crashBox.classList.add("boom"); later(() => crashBox.classList.remove("boom"), 900);
    crashNum.textContent = "ВЗРЫВ x" + c.point.toFixed(2); crashMsg.textContent = T("m_crash_boom"); record(c.bet, 0);
  };
  const startCrash = () => {
    if (crash) { // кнопка превратилась в «Забрать»
      const m = crash.mult, win = Math.floor(crash.bet * m); add(win); record(crash.bet, win);
      crashMsg.textContent = T("m_crash_cash", { m: m.toFixed(2), n: fmt(win - crash.bet) }); if (win > crash.bet) burst(16); endCrash(true); return;
    }
    const bet = betOf("crash");
    if (!bet || wallet.coins < bet) { crashMsg.textContent = T("m_crash_nocoins"); return; }
    add(-bet); const u = Math.random(), point = Math.min(num("crash_max", 200), Math.max(1, (1 - num("crash_house_edge", 3) / 100) / (1 - u)));
    crash = { bet, point, mult: 1, t0: performance.now() }; crashMsg.textContent = T("m_crash_run");
    crashBtn.textContent = T("btn_crash_cash"); crashBtn.classList.remove("primary"); crashBtn.classList.add("hot");
    const loop = (now) => {
      if (!crash) return;
      const t = (now - crash.t0) / 1000; crash.mult = Math.exp(0.1 * t * (1 + t / 12));
      if (crash.mult >= crash.point) { crash.mult = crash.point; return endCrash(false); }
      crashNum.textContent = "x" + crash.mult.toFixed(2);
      rocket.style.transform = `translate(${Math.min(70, t * 6)}%, ${-Math.min(80, Math.log(crash.mult) * 38)}%) rotate(${Math.min(40, 8 + t * 3)}deg)`;
      raf = requestAnimationFrame(loop);
    };
    crashNum.textContent = "x1.00"; rocket.style.transform = "translate(0,0) rotate(8deg)"; raf = requestAnimationFrame(loop);
  };
  crashBtn.addEventListener("click", startCrash, { signal }); crashMsg.textContent = T("m_crash_idle"); crashBtn.textContent = T("btn_crash_start");

  /* ===== 6. Скретч-карта ===== */
  const PRIZES = String(C.scratch_prizes || "10|20|50|100|500|2000").split("|").map((x) => parseFloat(x)).filter((x) => x > 0); if (!PRIZES.length) PRIZES.push(10);
  const COST = num("scratch_cost", 50);
  const under = $("#scUnder"), foil = $("#scFoil"), scMsg = $("#scMsg"), scBuy = $("#scBuy"), SW = 300, SH = 130;
  let ticket = null, drawing = false;
  const prep = (cv) => { const d = Math.min(2, devicePixelRatio || 1); cv.width = SW * d; cv.height = SH * d; cv.style.aspectRatio = SW + "/" + SH; const g = cv.getContext("2d"); g.setTransform(d, 0, 0, d, 0, 0); return g; };
  const gu = prep(under), gf = prep(foil);
  const drawUnder = (cells) => {
    gu.clearRect(0, 0, SW, SH); gu.fillStyle = "#f6f0ff"; gu.fillRect(0, 0, SW, SH);
    cells.forEach((v, i) => {
      const x = (i % 3) * 100 + 50, y = (i < 3 ? 33 : 97);
      gu.fillStyle = "#e9defc"; gu.fillRect(x - 44, y - 28, 88, 56); gu.fillStyle = "#3a1d9a"; gu.font = "800 22px sans-serif"; gu.textAlign = "center"; gu.textBaseline = "middle"; gu.fillText(String(v), x, y);
    });
  };
  const paintFoil = () => {
    const g = gf; g.globalCompositeOperation = "source-over"; const gr = g.createLinearGradient(0, 0, SW, SH);
    gr.addColorStop(0, "#9aa0b8"); gr.addColorStop(.5, "#d4d8e8"); gr.addColorStop(1, "#8c93ad"); g.fillStyle = gr; g.fillRect(0, 0, SW, SH);
    g.fillStyle = "rgba(255,255,255,.5)"; g.font = "800 14px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; for (let y = 20; y < SH; y += 40) for (let x = 40; x < SW; x += 80) g.fillText("СТЕРЕТЬ", x, y);
  };
  paintFoil(); drawUnder([0, 0, 0, 0, 0, 0]); foil.classList.add("idle"); scMsg.textContent = T("m_scratch_idle", { cost: COST }); scBuy.textContent = T("btn_scratch_buy", { cost: COST });
  const scratchAt = (e) => {
    if (!ticket || ticket.done) return; const r = foil.getBoundingClientRect(), x = (e.clientX - r.left) * SW / r.width, y = (e.clientY - r.top) * SH / r.height;
    gf.globalCompositeOperation = "destination-out"; gf.fillStyle = "#000"; gf.beginPath(); gf.arc(x, y, 15, 0, 7); gf.fill();
  };
  const finish = () => {
    if (!ticket || ticket.done) return; ticket.done = true; gf.clearRect(0, 0, SW, SH);
    if (ticket.win) { add(ticket.win); record(ticket.cost, ticket.win); const net = ticket.win - ticket.cost; scMsg.textContent = net >= 0 ? T("m_scratch_win", { prize: fmt(ticket.win), n: fmt(net) }) : T("m_scratch_win_minus", { prize: fmt(ticket.win), cost: ticket.cost, n: fmt(-net) }); if (net > 0) { burst(ticket.win >= 500 ? 50 : 18); shake($("#scWin")); } }
    else { record(ticket.cost, 0); scMsg.textContent = T("m_scratch_loss"); }
    scBuy.disabled = false;
  };
  const cleared = () => { const d = gf.getImageData(0, 0, foil.width, foil.height).data; let n = 0, tot = 0; for (let i = 3; i < d.length; i += 64) { tot++; if (d[i] < 20) n++; } return n / tot; };
  foil.addEventListener("pointerdown", (e) => { drawing = true; foil.setPointerCapture(e.pointerId); scratchAt(e); }, { signal });
  foil.addEventListener("pointermove", (e) => { if (drawing) scratchAt(e); }, { signal });
  const up = () => { if (!drawing) return; drawing = false; if (ticket && !ticket.done && cleared() > 0.55) finish(); };
  foil.addEventListener("pointerup", up, { signal }); foil.addEventListener("pointercancel", () => { drawing = false; }, { signal });
  $("#scAll").addEventListener("click", finish, { signal });
  scBuy.addEventListener("click", () => {
    const cost = COST; if (wallet.coins < cost) { scMsg.textContent = T("m_scratch_nocoins"); return; }
    add(-cost); const cells = Array.from({ length: 6 }, () => 0); let win = 0;
    if (Math.random() * 100 < num("scratch_win_chance", 20)) { win = PRIZES[Math.min(PRIZES.length - 1, Math.floor(Math.pow(Math.random(), 2.2) * PRIZES.length))]; const pos = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - .5).slice(0, 3); pos.forEach((p) => { cells[p] = win; }); }
    for (let i = 0; i < 6; i++) if (!cells[i]) { let v, tries = 0; do { v = PRIZES[rnd(PRIZES.length)]; tries++; } while (tries < 20 && (v === win || cells.filter((x) => x === v).length >= 2)); cells[i] = v; }
    ticket = { cost, win, done: false }; drawUnder(cells); gf.globalCompositeOperation = "source-over"; paintFoil(); foil.classList.remove("idle");
    scMsg.textContent = T("m_scratch_hint"); scBuy.disabled = true;
  }, { signal });

  /* ===== 8. Лента «выигрышей» (всё придумано) ===== */
  const NAMES = list("names").length ? list("names") : ["Аноним"], GAMES = list("games").length ? list("games") : ["в слотах"];
  const items = Array.from({ length: 14 }, () => `<span>${esc(String(C.ticker_template || "{name} выиграл {coin} {amount} {game}")).replace("{name}", "<b>" + esc(NAMES[rnd(NAMES.length)]) + "</b>").replace("{coin}", COIN).replace("{amount}", fmt((1 + rnd(99)) * [10, 100, 1000, 10000][rnd(4)])).replace("{game}", esc(GAMES[rnd(GAMES.length)]))}</span>`).join("");
  $("#ticker").innerHTML = `<div class="tk">${items}</div><div class="tk" aria-hidden="true">${items}</div>`;

  /* ===== 9. Всплывающая реклама (можно выключить) ===== */
  const ADS = list("ads").filter((x) => x && (x.title || x.text));
  const adsOn = () => { try { return localStorage.getItem("northling-ads") !== "off"; } catch (_) { return true; } };
  const adsBox = $("#adsToggle"); adsBox.checked = adsOn();
  adsBox.addEventListener("change", () => { try { localStorage.setItem("northling-ads", adsBox.checked ? "on" : "off"); } catch (_) {} if (!adsBox.checked) $$(".ad").forEach((a) => a.remove()); }, { signal });
  const spawnAd = () => {
    if (ADS.length && adsOn() && $$(".ad").length < num("ad_max_on_screen", 2)) {
      const A = ADS[rnd(ADS.length)], h = esc(A.title || ""), t = esc(A.text || ""), ad = document.createElement("div"); ad.className = "ad"; ad.setAttribute("role", "dialog");
      ad.style.cssText = `left:${6 + rnd(55)}%;top:${14 + rnd(50)}%`;
      ad.innerHTML = `<div class="ad-bar"><span>${esc(C.ad_label || "РЕКЛАМА")}</span><button type="button" class="ad-x" aria-label="Закрыть">×</button></div><div class="ad-body"><b>${h}</b><p>${t}</p><button type="button" class="btn primary sm ad-go">${esc(A.button || "Нажать")}</button></div>`;
      let dodged = Math.random() * 100 < num("ad_dodge_percent", 40);
      const x = ad.querySelector(".ad-x");
      x.addEventListener("pointerenter", () => { if (dodged) { dodged = false; ad.style.left = (4 + rnd(60)) + "%"; ad.style.top = (12 + rnd(55)) + "%"; } });
      x.addEventListener("click", () => ad.remove());
      ad.querySelector(".ad-go").addEventListener("click", () => { add(num("ad_reward", 5)); toast(T("m_ad_click", { n: num("ad_reward", 5) })); ad.remove(); });
      document.body.append(ad); later(() => ad.remove(), 30000);
    }
    later(spawnAd, num("ad_interval_min", 18) * 1000 + rnd(Math.max(0, num("ad_interval_max", 35) - num("ad_interval_min", 18)) * 1000));
  };
  later(spawnAd, num("ad_first_delay", 9) * 1000);
  NL.onCleanup(() => $$(".ad").forEach((a) => a.remove()));

  paint();
  }
});
