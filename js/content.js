/* =====================================================================
   ТЕКСТЫ И ОБЛОЖКИ ИЗ АДМИНКИ (js/content.js)
   ---------------------------------------------------------------------
   Что делает: берёт data/site.json (его правит админка) и подставляет
   тексты, обложки и бегущие строки в элементы страницы:
     data-site-content="ключ"      -> текст элемента
     data-site-image="ключ"        -> картинка (src)
     data-site-image-alt="ключ"    -> alt картинки
     data-site-image-fit="ключ"    -> кадрирование (для телефона берётся ключ + _mobile)
     data-site-marquee="ключ"      -> слова бегущей строки (через |)
   Чтобы не мелькал старый текст: пока данные не пришли, эти элементы
   скрыты (css: html.js:not(.site-ready) ...), а запрос начинается ещё
   в <head> (window.__nlSite).
   ===================================================================== */
(() => {
  "use strict";
  const NL = window.NL;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const marqueeNodes = [];                        // бегущие строки текущей страницы
  let firstRequest = window.__nlSite || null;     // запрос, начатый в <head>

  /* ——— Загрузка data/site.json (каждый раз проверяем свежесть) ——— */
  NL.loadSite = () => fetch("data/site.json", { cache: "no-cache" })
    .then(response => {
      if (!response.ok) throw new Error("Не удалось загрузить тексты сайта");
      return response.json();
    })
    .then(data => (NL.site = data));

  /* ——— Бегущая строка ———
     Сдвигается ровно на половину трека, поэтому каждая половина должна быть шире
     экрана, иначе в конце цикла справа появится пустота. */
  const renderMarquee = (node, words) => {
    const group = `<div class="marquee-group">${words.map(word => `<span>${escapeHtml(word)}</span>`).join("")}</div>`;
    let copies = 1;
    const build = () => { const half = group.repeat(copies); node.innerHTML = half + half; };
    build();
    while (node.offsetWidth / 2 < window.innerWidth && copies < 50) { copies++; build(); }
    if (!reduceMotion) {
      // Скорость примерно постоянная (≈30 px/с), сколько бы ни было копий.
      node.style.animationDuration = `${Math.max(20, (node.offsetWidth / 2) / 30)}s`;
    }
  };
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => marqueeNodes.forEach(({ node, words }) => renderMarquee(node, words)), 200);
  });

  /* ——— Подстановка данных в страницу ——— */
  const apply = (data) => {
    // 1. Тексты
    document.querySelectorAll("[data-site-content]").forEach(node => {
      const value = data[node.dataset.siteContent];
      if (typeof value === "string") node.textContent = value;
    });
    // 2. Бегущие строки
    marqueeNodes.length = 0;
    document.querySelectorAll(".marquee-track").forEach(node => {
      let words = null;
      const value = node.dataset.siteMarquee ? data[node.dataset.siteMarquee] : null;
      if (typeof value === "string" && value.trim()) {
        words = value.split("|").map(word => word.trim()).filter(Boolean);
      } else {
        // Нет ключа в data/site.json: берём слова из HTML (первая группа).
        const first = node.querySelector(".marquee-group");
        if (first) words = [...first.querySelectorAll("span")].map(span => span.textContent.trim()).filter(Boolean);
      }
      if (words && words.length) { renderMarquee(node, words); marqueeNodes.push({ node, words }); }
    });
    // 3. Обложки: src, alt и кадрирование
    document.querySelectorAll("[data-site-image]").forEach(node => {
      const value = data[node.dataset.siteImage];
      if (typeof value === "string" && value.trim()) node.src = value;
      const altKey = node.dataset.siteImageAlt;
      if (altKey && typeof data[altKey] === "string") node.alt = data[altKey];
      const fitKey = node.dataset.siteImageFit;
      if (fitKey) NL.applyFit(node, data[fitKey], data[fitKey + "_mobile"]);
    });
  };

  /* Обложка стартует скрытой и пустой; показываем, когда нужная картинка загрузилась.
     Так старая картинка не мелькает и не накладывается на новую. */
  const revealImages = () => {
    document.querySelectorAll("[data-site-image]").forEach(node => {
      if (!node.getAttribute("src")) return;
      const show = () => { node.style.visibility = "visible"; };
      if (node.complete && node.naturalWidth) show();
      else { node.addEventListener("load", show, { once: true }); node.addEventListener("error", show, { once: true }); }
    });
  };
  const ready = () => document.documentElement.classList.add("site-ready");

  /* ——— Запуск на странице ——— */
  NL.onPage(() => {
    if (NL.site) {                                // данные уже есть (переход между страницами): сразу, без задержки
      apply(NL.site); revealImages(); ready();
      return;
    }
    const safety = setTimeout(ready, 3000);       // если сервер завис, показываем как есть
    (firstRequest || NL.loadSite())
      .then(data => { NL.site = data; apply(data); })
      .catch(error => console.error(error))
      .finally(() => { clearTimeout(safety); revealImages(); ready(); });
    firstRequest = null;
  });
})();
