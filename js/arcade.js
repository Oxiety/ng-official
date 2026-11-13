/* =====================================================================
   ИНТЕРАКТИВЧИК (js/arcade.js) — страница interactive.html
   ---------------------------------------------------------------------
   Тут живут: общий кошелёк с НЕНАСТОЯЩИМИ монетками, слоты, рулетка и
   терминал. Никаких настоящих денег, ставок и серверов: всё прикола ради.
   Монетки хранятся в localStorage (ключ northling-wallet).
   Разделы файла:  1. Кошелёк   2. Слоты   3. Рулетка   4. Терминал
   ===================================================================== */
NL.onPage(() => {
  "use strict";
  if (!document.querySelector("#arcade")) return;
  const $ = (s, r = document) => r.querySelector(s);
  const signal = NL.signal;
  const rnd = (n) => Math.floor(Math.random() * n);

  /* ===== 1. Кошелёк ===== */
  const START = 1000;
  let wallet = { coins: START, best: START };
  try { const w = JSON.parse(localStorage.getItem("northling-wallet")); if (w && Number.isFinite(w.coins)) wallet = { coins: w.coins, best: w.best || w.coins }; } catch (_) {}
  const coinsEl = $("#coins"), bestEl = $("#coinsBest"), dole = $("#dole");
  const saveWallet = () => { try { localStorage.setItem("northling-wallet", JSON.stringify(wallet)); } catch (_) {} };
  const paintWallet = () => {
    coinsEl.textContent = wallet.coins.toLocaleString("ru-RU");
    bestEl.textContent = wallet.best.toLocaleString("ru-RU");
    dole.hidden = wallet.coins >= 10;
    document.dispatchEvent(new CustomEvent("nl:wallet"));
  };
  const change = (d) => { wallet.coins = Math.max(0, wallet.coins + d); wallet.best = Math.max(wallet.best, wallet.coins); saveWallet(); paintWallet(); };
  $("#walletReset").addEventListener("click", () => { wallet = { coins: START, best: START }; saveWallet(); paintWallet(); NL.toast && NL.toast("Кошелёк сброшен: " + START + " монет"); }, { signal });
  dole.addEventListener("click", () => { change(500); }, { signal });
  document.addEventListener("storage", () => {}, { signal });
  paintWallet();

  /* Кнопки выбора ставки (общие для слотов и рулетки): data-bet-group → какая ставка выбрана */
  const bets = { slots: 10, roulette: 10 };
  document.querySelectorAll("[data-bet-group]").forEach((group) => {
    const key = group.dataset.betGroup;
    const paint = () => group.querySelectorAll("button").forEach((b) => b.classList.toggle("on", +b.dataset.v === bets[key] || (b.dataset.v === "max" && bets[key] === "max")));
    group.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      bets[key] = b.dataset.v === "max" ? "max" : +b.dataset.v; paint();
    }, { signal });
    paint();
  });
  const betOf = (key) => bets[key] === "max" ? Math.min(wallet.coins, 500) : bets[key];

  /* ===== 2. Слоты ===== */
  const SYM = [ // символ, вес выпадения, множитель за три одинаковых
    { s: "🍒", w: 30, m: 5 }, { s: "🍋", w: 26, m: 8 }, { s: "🔔", w: 20, m: 12 },
    { s: "⭐", w: 14, m: 20 }, { s: "💎", w: 7, m: 50 }, { s: "7️⃣", w: 3, m: 100 }
  ];
  const TOTAL_W = SYM.reduce((a, x) => a + x.w, 0);
  const pick = () => { let r = rnd(TOTAL_W); for (const x of SYM) { if ((r -= x.w) < 0) return x; } return SYM[0]; };
  const reels = [...document.querySelectorAll("#slots .reel .strip")];
  const slotMsg = $("#slotMsg"), slotBtn = $("#slotSpin");
  const REEL_H = 84;
  let spinning = false;
  const setStrip = (strip, sym) => { strip.style.transition = "none"; strip.style.transform = "translateY(0)"; strip.innerHTML = `<i>${sym.s}</i>`; };
  reels.forEach((r) => setStrip(r, SYM[rnd(SYM.length)]));
  const instant = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("no-anim");

  const spinSlots = async () => {
    if (spinning) return;
    const bet = betOf("slots");
    if (!bet || wallet.coins < bet) { slotMsg.textContent = "Не хватает монет. Нажми «Пособие» или сбрось кошелёк."; return; }
    spinning = true; slotBtn.disabled = true; slotMsg.textContent = "…"; $("#slots").classList.remove("win", "jackpot");
    change(-bet);
    const result = reels.map(pick);
    const fast = instant();
    await Promise.all(reels.map((strip, i) => new Promise((done) => {
      const n = 14 + i * 7;
      const items = Array.from({ length: n }, () => pick()); items.push(result[i]);
      strip.style.transition = "none"; strip.style.transform = "translateY(0)";
      strip.innerHTML = items.map((x) => `<i>${x.s}</i>`).join("");
      if (fast) { setStrip(strip, result[i]); return done(); }
      void strip.offsetWidth;
      strip.style.transition = `transform ${1.1 + i * 0.45}s cubic-bezier(.2,.8,.2,1)`;
      strip.style.transform = `translateY(${-n * REEL_H}px)`;
      setTimeout(() => { setStrip(strip, result[i]); done(); }, (1.1 + i * 0.45) * 1000 + 40);
    })));
    const [a, b, c] = result;
    let win = 0, text = "Мимо. Пробуй ещё.";
    if (a === b && b === c) { win = bet * a.m; text = `ТРИ ${a.s}! +${win} монет`; }
    else if (a === b || b === c || a === c) {
      const p = a === b || a === c ? a : b;
      win = p.s === "🍒" ? bet * 2 : bet; text = win > bet ? `Пара вишен: +${win - bet}` : "Пара: ставка вернулась.";
    }
    if (win) { change(win); if (win > bet) { $("#slots").classList.add(win >= bet * 50 ? "jackpot" : "win"); } }
    slotMsg.textContent = text;
    spinning = false; slotBtn.disabled = false;
  };
  slotBtn.addEventListener("click", spinSlots, { signal });

  /* ===== 3. Рулетка (европейская, 37 ячеек) ===== */
  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const colorOf = (n) => n === 0 ? "green" : REDS.has(n) ? "red" : "black";
  const STEP = 360 / 37;
  const canvas = $("#wheel"), wheelBox = $(".wheel-rot"), ballRing = $(".ball-ring");
  const drawWheel = () => {
    const size = 280, dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = canvas.height = size * dpr; canvas.style.width = canvas.style.height = size + "px";
    const g = canvas.getContext("2d"); g.scale(dpr, dpr);
    const c = size / 2, R = c - 4;
    ORDER.forEach((n, i) => {
      const a0 = (i - 0.5) * STEP * Math.PI / 180 - Math.PI / 2, a1 = (i + 0.5) * STEP * Math.PI / 180 - Math.PI / 2;
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, a0, a1); g.closePath();
      g.fillStyle = { green: "#1c9a52", red: "#c8283d", black: "#16132e" }[colorOf(n)]; g.fill();
      g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1; g.stroke();
      g.save(); g.translate(c, c); g.rotate(i * STEP * Math.PI / 180);
      g.fillStyle = "#fff"; g.font = "700 11px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(String(n), 0, -R + 16); g.restore();
    });
    g.beginPath(); g.arc(c, c, R * 0.62, 0, 7); g.fillStyle = "#241468"; g.fill();
    g.strokeStyle = "rgba(255,255,255,.6)"; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.arc(c, c, R * 0.2, 0, 7); g.fillStyle = "#b7a5ff"; g.fill();
  };
  drawWheel();

  /* Какие ставки есть: ключ → [название, проверка выигрыша, во сколько раз растёт ставка с учётом самой ставки] */
  const BETS = {
    red: ["Красное", (n) => colorOf(n) === "red", 2], black: ["Чёрное", (n) => colorOf(n) === "black", 2],
    even: ["Чёт", (n) => n > 0 && n % 2 === 0, 2], odd: ["Нечёт", (n) => n % 2 === 1, 2],
    low: ["1–18", (n) => n >= 1 && n <= 18, 2], high: ["19–36", (n) => n >= 19, 2],
    d1: ["1-я дюжина", (n) => n >= 1 && n <= 12, 3], d2: ["2-я дюжина", (n) => n >= 13 && n <= 24, 3], d3: ["3-я дюжина", (n) => n >= 25, 3]
  };
  let choice = "red";
  const grid = $("#numGrid"), rouMsg = $("#rouMsg"), rouBtn = $("#rouSpin"), hist = $("#rouHist");
  grid.innerHTML = Array.from({ length: 37 }, (_, n) => `<button type="button" class="num ${colorOf(n)}" data-n="${n}">${n}</button>`).join("");
  const paintChoice = () => {
    document.querySelectorAll("#rouChoices button").forEach((b) => b.classList.toggle("on", b.dataset.k === choice));
    grid.querySelectorAll(".num").forEach((b) => b.classList.toggle("on", choice === "n" + b.dataset.n));
    $("#rouPick").textContent = choice.startsWith("n") ? "Число " + choice.slice(1) + " (×36)" : BETS[choice][0] + " (×" + BETS[choice][2] + ")";
  };
  $("#rouChoices").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { choice = b.dataset.k; paintChoice(); } }, { signal });
  grid.addEventListener("click", (e) => { const b = e.target.closest(".num"); if (b) { choice = "n" + b.dataset.n; paintChoice(); } }, { signal });
  paintChoice();

  let wheelRot = 0, ballRot = 0, rouBusy = false;
  const spinRoulette = () => {
    if (rouBusy) return;
    const bet = betOf("roulette");
    if (!bet || wallet.coins < bet) { rouMsg.textContent = "Не хватает монет. Нажми «Пособие» или сбрось кошелёк."; return; }
    rouBusy = true; rouBtn.disabled = true; rouMsg.textContent = "Крутится…";
    change(-bet);
    const k = rnd(37), number = ORDER[k];
    const fast = instant(), dur = fast ? 0 : 4.6;
    const want = (360 - k * STEP) % 360, cur = ((wheelRot % 360) + 360) % 360;
    wheelRot += (want - cur + 360) % 360 + 360 * 5;
    ballRot -= 360 * 7 + (ballRot % 360 === 0 ? 0 : (360 + (ballRot % 360)) % 360);
    wheelBox.style.transition = `transform ${dur}s cubic-bezier(.12,.62,.12,1)`; wheelBox.style.transform = `rotate(${wheelRot}deg)`;
    ballRing.style.transition = `transform ${dur - 0.4}s cubic-bezier(.2,.6,.15,1)`; ballRing.style.transform = `rotate(${ballRot}deg)`;
    setTimeout(() => {
      const win = choice.startsWith("n") ? (+choice.slice(1) === number ? 36 : 0) : (BETS[choice][1](number) ? BETS[choice][2] : 0);
      if (win) change(bet * win);
      const col = { green: "зеро", red: "красное", black: "чёрное" }[colorOf(number)];
      rouMsg.textContent = `Выпало ${number} (${col}). ` + (win ? `Выигрыш: +${bet * win - bet}!` : "Не повезло.");
      const chip = document.createElement("span"); chip.className = "num " + colorOf(number); chip.textContent = number;
      hist.prepend(chip); while (hist.children.length > 12) hist.lastChild.remove();
      rouBusy = false; rouBtn.disabled = false;
    }, dur * 1000 + 60);
  };
  rouBtn.addEventListener("click", spinRoulette, { signal });

  /* ===== 4. Терминал ===== */
  const out = $("#termOut"), form = $("#termForm"), input = $("#termInput"), screen = $("#termScreen");
  const startedAt = Date.now();
  const hist2 = []; let hpos = 0;
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const print = (text = "", cls = "") => { const d = document.createElement("div"); d.className = "tl " + cls; d.innerHTML = text === "" ? "&nbsp;" : text; out.append(d); screen.scrollTop = screen.scrollHeight; return d; };
  const lib = () => (NL.player && NL.player.library) || [];
  const PAGES = { home: "index.html", main: "index.html", arts: "arts.html", photos: "photos.html", oasis: "oasis.html", webdev: "webdev.html", interactive: "interactive.html", anime: "anime.html" };
  const FILES = {
    "about.txt": () => ["northling: личный сайт. арты, oasis, webdev, фотки и вот это всё.", "собрано руками и вайб-кодингом, версия " + (document.querySelector(".mono")?.textContent.match(/v[\d.]+/) || ["?"])[0] + "."],
    "music.txt": () => { const l = []; lib().forEach((a) => a.albums.forEach((al) => l.push(a.name + " — " + al.title + " (" + al.tracks.length + ")"))); return l.length ? l : ["пока пусто"]; },
    "secret.txt": () => ["молодец, что нашёл. подсказка: ↑ ↑ ↓ ↓ ← → ← → B A (нажми где угодно на сайте)"]
  };
  const go = (page) => { const a = document.createElement("a"); a.href = PAGES[page]; a.style.display = "none"; document.body.append(a); a.click(); a.remove(); };
  const need = (cond, msg) => { if (!cond) { print(msg, "err"); return false; } return true; };

  const COMMANDS = {
    help: { d: "список команд", f: () => { print("Команды:"); Object.keys(COMMANDS).filter((k) => !COMMANDS[k].hide).sort().forEach((k) => print("  <b>" + k + "</b> — " + COMMANDS[k].d)); print("Tab дополняет, ↑/↓ листают историю.", "dim"); } },
    about: { d: "что это за сайт", f: () => FILES["about.txt"]().forEach((t) => print(esc(t))) },
    ls: { d: "файлы", f: () => print(Object.keys(FILES).join("   ")) },
    cat: { d: "прочитать файл: cat about.txt", f: (a) => { const f = FILES[a[0]]; if (!f) return print("cat: " + esc(a[0] || "") + ": нет такого файла", "err"); f().forEach((t) => print(esc(t))); } },
    whoami: { d: "кто ты", f: () => print("guest. но с хорошим вкусом.") },
    date: { d: "дата и время", f: () => print(new Date().toLocaleString("ru-RU")) },
    uptime: { d: "сколько ты тут сидишь", f: () => { const s = Math.floor((Date.now() - startedAt) / 1000); print("на этой странице: " + Math.floor(s / 60) + " мин " + (s % 60) + " сек"); } },
    echo: { d: "повторить текст", f: (a) => print(esc(a.join(" "))) },
    clear: { d: "очистить экран", f: () => { out.innerHTML = ""; } },
    history: { d: "прошлые команды", f: () => hist2.forEach((h, i) => print((i + 1) + "  " + esc(h))) },
    goto: { d: "перейти на страницу: goto oasis", f: (a) => { if (!PAGES[a[0]]) return print("страницы: " + Object.keys(PAGES).join(", "), "err"); print("перехожу…"); setTimeout(() => go(a[0]), 250); } },
    theme: { d: "тема: theme light | dark", f: (a) => { if (!need(a[0] === "light" || a[0] === "dark", "theme light или theme dark")) return; NL.setTheme(a[0]); print("тема: " + a[0]); } },
    play: { d: "включить музыку", f: () => { if (!need(NL.player, "плеер не готов")) return; if (!NL.player.playing) NL.player.toggle(); print("играю: " + esc(NL.player.current ? NL.player.current.title : "…")); } },
    pause: { d: "пауза", f: () => { if (NL.player && NL.player.playing) NL.player.toggle(); print("пауза"); } },
    next: { d: "следующий трек", f: () => { NL.player && NL.player.next(); print("дальше"); } },
    prev: { d: "предыдущий трек", f: () => { NL.player && NL.player.prev(); print("назад"); } },
    track: { d: "что играет", f: () => { const t = NL.player && NL.player.current; print(t ? esc(t.artist + " — " + t.title) : "ничего не играет"); } },
    player: { d: "открыть плеер", f: () => { document.querySelector(".player-toggle")?.click(); } },
    balance: { d: "сколько монет", f: () => print("🪙 " + wallet.coins.toLocaleString("ru-RU") + " (рекорд " + wallet.best.toLocaleString("ru-RU") + "). ненастоящие, если что.") },
    slots: { d: "к слотам", f: () => { $("#slotsWin").scrollIntoView({ behavior: "smooth", block: "center" }); print("слоты тут: 🎰"); } },
    roulette: { d: "к рулетке", f: () => { $("#rouWin").scrollIntoView({ behavior: "smooth", block: "center" }); print("рулетка тут: 🎡"); } },
    coin: { d: "подбросить монетку", f: () => print(rnd(2) ? "орёл 🦅" : "решка 🪙") },
    roll: { d: "кубик: roll 20 (по умолчанию d6)", f: (a) => { const n = Math.max(2, Math.min(1000, parseInt(a[0]) || 6)); print("🎲 d" + n + ": <b>" + (1 + rnd(n)) + "</b>"); } },
    fortune: { d: "предсказание", f: () => print(["Сегодня ты найдёшь классный трек.", "Не трогай прод в пятницу.", "Кто-то уже думает о тебе. Скорее всего, кот.", "Ctrl+S спасает жизни.", "Твоя удача сейчас на кулдауне, но недолго."][rnd(5)]) },
    cowsay: { d: "корова говорит", f: (a) => { const t = esc(a.join(" ") || "муу"); const line = "-".repeat(t.length + 2); print("<pre> " + line + "\n< " + t + " >\n " + line + "\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||</pre>"); } },
    neofetch: { d: "инфа о системе", f: () => print("<pre class=\"nf\"><b>   ┌──┐</b>      guest@northling\n<b>   │ n│.</b>      ─────────────\n<b>   └──┘</b>      OS: northling.space\n             Версия: " + ((document.querySelector(".mono")?.textContent.match(/v[\d.]+/) || ["?"])[0]) + "\n             Оболочка: nlsh 1.0\n             Тема: " + (document.documentElement.dataset.theme || "dark") + "\n             Монет: " + wallet.coins + "</pre>") },
    matrix: { d: "…", hide: true, f: () => runMatrix() },
    sudo: { d: "", hide: true, f: () => print("guest не в файле sudoers. Этот инцидент будет отправлен… никому, у сайта нет сервера.", "err") },
    rm: { d: "", hide: true, f: (a) => { if (a.join(" ").includes("-rf")) { print("удаляю всё…", "err"); setTimeout(() => print("шутка. ничего не тронуто. но руку убери от клавиатуры."), 900); } else print("rm: что удалять?", "err"); } },
    exit: { d: "", hide: true, f: () => print("отсюда не выходят. ну ладно: goto main") }
  };
  let matrixTimer = 0;
  const runMatrix = () => {
    const cv = $("#termMatrix"); if (!cv) return;
    const g = cv.getContext("2d"), w = cv.width = screen.clientWidth, h = cv.height = screen.clientHeight;
    const cols = Math.floor(w / 14), drops = Array(cols).fill(0).map(() => rnd(h / 14));
    cv.hidden = false; const t0 = Date.now(); clearInterval(matrixTimer);
    matrixTimer = setInterval(() => {
      g.fillStyle = "rgba(0,12,4,.12)"; g.fillRect(0, 0, w, h); g.fillStyle = "#4dff8a"; g.font = "14px monospace";
      drops.forEach((y, i) => { g.fillText(String.fromCharCode(0x30A0 + rnd(96)), i * 14, y * 14); drops[i] = y * 14 > h && Math.random() > 0.96 ? 0 : y + 1; });
      if (Date.now() - t0 > 7000) { clearInterval(matrixTimer); cv.hidden = true; }
    }, 55);
  };
  NL.onCleanup(() => clearInterval(matrixTimer));

  const run = (line) => {
    const clean = line.trim(); if (!clean) return;
    print('<span class="pr">guest@northling:~$</span> ' + esc(clean), "cmd");
    hist2.push(clean); hpos = hist2.length;
    const [name, ...args] = clean.split(/\s+/);
    const c = COMMANDS[name.toLowerCase()];
    if (c) c.f(args); else print("nlsh: " + esc(name) + ": команда не найдена. Попробуй <b>help</b>.", "err");
  };
  form.addEventListener("submit", (e) => { e.preventDefault(); const v = input.value; input.value = ""; run(v); }, { signal });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") { e.preventDefault(); if (hpos > 0) input.value = hist2[--hpos]; }
    else if (e.key === "ArrowDown") { e.preventDefault(); hpos = Math.min(hist2.length, hpos + 1); input.value = hist2[hpos] || ""; }
    else if (e.key === "Tab") {
      e.preventDefault(); const v = input.value.trim().toLowerCase(); if (!v) return;
      const m = Object.keys(COMMANDS).filter((k) => !COMMANDS[k].hide && k.startsWith(v));
      if (m.length === 1) input.value = m[0] + " "; else if (m.length > 1) print(m.join("   "), "dim");
    }
  }, { signal });
  screen.addEventListener("click", () => { if (!getSelection().toString()) input.focus({ preventScroll: true }); }, { signal });
  print("northling shell (nlsh) v1.0", "dim");
  print("Напиши <b>help</b>, чтобы увидеть команды. Есть секреты.", "dim");
});
