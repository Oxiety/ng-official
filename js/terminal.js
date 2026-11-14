/* =====================================================================
   ТЕРМИНАЛ nlsh (js/terminal.js) — живёт на странице webdev
   ---------------------------------------------------------------------
   Придуманная командная строка: help, about, ls, cat, goto, theme, play,
   neofetch и так далее. Ничего настоящего не выполняет. Tab дополняет
   команду, стрелки вверх/вниз листают историю.
   ===================================================================== */
NL.onPage(() => {
  "use strict";
  if (!document.querySelector("#termScreen")) return;
  /* Тексты, файлы, предсказания и свои команды лежат в data/terminal.json (админка, вкладка «Терминал») */
  NL.loadTx("data/terminal.json", document.querySelector("#termSection")).then((C) => { if (NL.signal.aborted) return; start(C); });
  function start(C) {
  const L = (k, d = "") => (typeof C[k] === "string" && C[k] !== "" ? C[k] : d);
  const $ = (s, r = document) => r.querySelector(s);
  const signal = NL.signal;
  const rnd = (n) => Math.floor(Math.random() * n);
  const readWallet = () => { try { const w = JSON.parse(localStorage.getItem("northling-wallet")); if (w && Number.isFinite(w.coins)) return w; } catch (_) {} return { coins: 1000, best: 1000 }; };
  const out = $("#termOut"), form = $("#termForm"), input = $("#termInput"), screen = $("#termScreen");
  const startedAt = Date.now();
  const hist2 = []; let hpos = 0;
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const print = (text = "", cls = "") => { const d = document.createElement("div"); d.className = "tl " + cls; d.innerHTML = text === "" ? "&nbsp;" : text; out.append(d); screen.scrollTop = screen.scrollHeight; return d; };
  const lib = () => (NL.player && NL.player.library) || [];
  const PAGES = { home: "index.html", main: "index.html", arts: "arts.html", photos: "photos.html", oasis: "oasis.html", webdev: "webdev.html", interactive: "interactive.html", anime: "anime.html" };
  const ver = () => (document.querySelector(".mono")?.textContent.match(/v[\d.]+/) || ["?"])[0];
  const subst = (s) => String(s).replace(/\{version\}/g, ver()).replace(/\{coins\}/g, readWallet().coins).replace(/\{theme\}/g, document.documentElement.dataset.theme || "dark");
  const FILES = {};
  (Array.isArray(C.files) ? C.files : []).forEach((f) => { if (f && f.name) FILES[f.name] = () => subst(f.content || "").split("\n"); });
  FILES["music.txt"] = () => { const l = []; lib().forEach((a) => a.albums.forEach((al) => l.push(a.name + " — " + al.title + " (" + al.tracks.length + ")"))); return l.length ? l : ["пока пусто"]; };
  const go = (page) => { const a = document.createElement("a"); a.href = PAGES[page]; a.style.display = "none"; document.body.append(a); a.click(); a.remove(); };
  const need = (cond, msg) => { if (!cond) { print(msg, "err"); return false; } return true; };

  const COMMANDS = {
    help: { d: "список команд", f: () => { print(esc(L("help_title", "Команды:"))); Object.keys(COMMANDS).filter((k) => !COMMANDS[k].hide).sort().forEach((k) => print("  <b>" + k + "</b> — " + COMMANDS[k].d)); print(esc(L("help_footer")), "dim"); } },
    about: { d: "что это за сайт", f: () => (FILES["about.txt"] ? FILES["about.txt"]() : ["northling"]).forEach((t) => print(esc(t))) },
    ls: { d: "файлы", f: () => print(Object.keys(FILES).join("   ")) },
    cat: { d: "прочитать файл: cat about.txt", f: (a) => { const f = FILES[a[0]]; if (!f) return print("cat: " + esc(a[0] || "") + ": нет такого файла", "err"); f().forEach((t) => print(esc(t))); } },
    whoami: { d: "кто ты", f: () => print(esc(L("whoami", "guest"))) },
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
    balance: { d: "сколько монет", f: () => print("Монет: " + readWallet().coins.toLocaleString("ru-RU") + " (рекорд " + readWallet().best.toLocaleString("ru-RU") + "). ненастоящие, если что.") },
    slots: { d: "к слотам", f: () => { print("слоты в Интерактивчике, лечу…"); setTimeout(() => go("interactive"), 300); } },
    roulette: { d: "к рулетке", f: () => { print("рулетка в Интерактивчике, лечу…"); setTimeout(() => go("interactive"), 300); } },
    coin: { d: "подбросить монетку", f: () => print(rnd(2) ? "орёл" : "решка") },
    roll: { d: "кубик: roll 20 (по умолчанию d6)", f: (a) => { const n = Math.max(2, Math.min(1000, parseInt(a[0]) || 6)); print("d" + n + ": <b>" + (1 + rnd(n)) + "</b>"); } },
    fortune: { d: "предсказание", f: () => { const f = Array.isArray(C.fortunes) && C.fortunes.length ? C.fortunes : ["..."]; print(esc(f[rnd(f.length)])); } },
    cowsay: { d: "корова говорит", f: (a) => { const t = esc(a.join(" ") || "муу"); const line = "-".repeat(t.length + 2); print("<pre> " + line + "\n< " + t + " >\n " + line + "\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||</pre>"); } },
    neofetch: { d: "инфа о системе", f: () => {
      print("<pre class=\"nf\"><b>   ┌──┐</b>      guest@northling\n<b>   │ n│.</b>      ─────────────\n<b>   └──┘</b>      OS: " + esc(L("neofetch_os", "Windows 11")) + "\n             Ядро: " + esc(L("neofetch_kernel", "не Linux")) + "\n             Сайт: northling.space " + ver() + "\n             Оболочка: " + esc(L("neofetch_shell", "nlsh")) + "\n             Тема: " + (document.documentElement.dataset.theme || "dark") + "\n             Монет: " + readWallet().coins + "</pre>");
      if (L("neofetch_warning")) print(esc(L("neofetch_warning")), "err");
    } },
    matrix: { d: "…", hide: true, f: () => runMatrix() },
    sudo: { d: "", hide: true, f: () => print(esc(L("sudo", "sudo: нет")), "err") },
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

  (Array.isArray(C.commands) ? C.commands : []).forEach((c) => {                // команды из админки
    const n = String(c && c.name || "").trim().toLowerCase().split(/\s+/)[0];
    if (n && !COMMANDS[n]) COMMANDS[n] = { d: String(c.description || ""), hide: !c.description, f: () => subst(c.output || "").split("\n").forEach((l) => print(esc(l))) };
  });
  const run = (line) => {
    const clean = line.trim(); if (!clean) return;
    print('<span class="pr">' + esc(L("prompt", "guest@northling:~$")) + "</span> " + esc(clean), "cmd");
    hist2.push(clean); hpos = hist2.length;
    const [name, ...args] = clean.split(/\s+/);
    const c = COMMANDS[name.toLowerCase()];
    if (c) c.f(args); else print("nlsh: " + esc(name) + ": " + esc(L("unknown", "команда не найдена")), "err");
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
  print(esc(L("welcome_1", "nlsh")), "dim");
  print(esc(L("welcome_2", "Напиши help.")), "dim");
  }
});
