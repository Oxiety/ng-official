/* =====================================================================
   МЕЛКИЕ ЭФФЕКТЫ (js/fx.js)
   1. Плавное появление карточек при прокрутке (не работает при «без анимаций»)
   2. Konami-код ↑ ↑ ↓ ↓ ← → ← → B A: пасхалка, +1000 монет в кошелёк Интерактивчика
   ===================================================================== */
(() => {
  "use strict";
  const NL = window.NL;
  /* Подстановка текстов из json в страницу.
       data-tx="ключ"       -> текст элемента
       data-tx-img="ключ"   -> src картинки;  data-tx-alt="ключ" -> её alt
     Страница пока скрыта (.tx-wait), чтобы старый текст не мелькал; показываем после загрузки. */
  NL.loadTx = async (file, root) => {
    let data = {};
    try { const r = await fetch(file, { cache: "no-cache" }); if (r.ok) data = await r.json(); } catch (_) {}
    if (root) {
      root.querySelectorAll("[data-tx]").forEach((n) => { const v = data[n.dataset.tx]; if (typeof v === "string") n.textContent = v; });
      root.querySelectorAll("[data-tx-img]").forEach((n) => { const v = data[n.dataset.txImg]; if (typeof v === "string" && v.trim()) n.src = v; const a = data[n.dataset.txAlt]; if (typeof a === "string") n.alt = a; });
      root.classList.remove("tx-wait"); root.classList.add("tx-ready");
    }
    return data;
  };
  /* 1. Появление при прокрутке */
  NL.onPage(() => {
    const root = document.documentElement;
    if (!("IntersectionObserver" in window) || root.classList.contains("no-anim") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = [...document.querySelectorAll("main .card, main .apps > *, main .shot, main .section-head, main .arc-win, main .pick-card")];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
    items.forEach((el, i) => { if (el.getBoundingClientRect().top < innerHeight) return; el.classList.add("reveal"); el.style.setProperty("--rd", (i % 4) * 70 + "ms"); io.observe(el); });
    NL.onCleanup(() => io.disconnect());
  });

  /* 2. Konami */
  const SEQ = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let pos = 0;
  document.addEventListener("keydown", (e) => {
    if (/^(input|textarea|select)$/i.test((e.target.tagName || ""))) { pos = 0; return; }
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    pos = k === SEQ[pos] ? pos + 1 : (k === SEQ[0] ? 1 : 0);
    if (pos < SEQ.length) return;
    pos = 0;
    try {
      const w = JSON.parse(localStorage.getItem("northling-wallet")) || { coins: 1000, best: 1000 };
      w.coins += 1000; w.best = Math.max(w.best || 0, w.coins); localStorage.setItem("northling-wallet", JSON.stringify(w));
    } catch (_) {}
    document.documentElement.classList.add("konami"); setTimeout(() => document.documentElement.classList.remove("konami"), 2600);
    if (NL.toast) NL.toast((NL.arcadeCfg && NL.arcadeCfg.m_konami) || "Konami! +1000 монет в Интерактивчик");
  });
})();
