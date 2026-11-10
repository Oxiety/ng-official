/* =====================================================================
   БЕСШОВНЫЕ ПЕРЕХОДЫ МЕЖДУ СТРАНИЦАМИ (js/router.js) — подключается ПОСЛЕДНИМ
   ---------------------------------------------------------------------
   Что делает: когда нажимаешь на ссылку на другую страницу сайта, страница
   не перезагружается целиком. Скрипт подгружает новую, подменяет только
   <main>, <footer>, заголовок и цвета, а таскбар с плеером остаётся на
   месте. Поэтому музыка не прерывается.
   Если что-то пошло не так, делается обычный переход (запасной вариант).
   Также этот файл запускает код первой страницы: NL.runPage().
   ===================================================================== */
(() => {
  "use strict";
  const NL = window.NL;
  const PAGES = ["index", "arts", "photos", "oasis", "webdev"];
  const pageKey = (path) => {                       // "/arts.html" -> "arts", "/" -> "index"
    const name = path.replace(/^\/+/, "").replace(/\.html$/, "") || "index";
    return PAGES.includes(name) ? name : null;
  };
  let currentPath = location.pathname;
  let navToken = 0;                                  // чтобы устаревший переход не перебил новый

  /* ——— Сам переход: скачать страницу, подменить содержимое, запустить код ——— */
  const go = async (url, { push, y = 0 } = {}) => {
    const token = ++navToken;
    try {
      const [response] = await Promise.all([
        fetch(url, { credentials: "same-origin" }),
        NL.loadSite().catch(() => {})                // свежие тексты из админки к моменту показа
      ]);
      if (!response.ok) throw new Error("HTTP " + response.status);
      const doc = new DOMParser().parseFromString(await response.text(), "text/html");
      const newMain = doc.querySelector("main"), newFooter = doc.querySelector("footer");
      if (!newMain || !newFooter) throw new Error("Нет <main> на странице");
      if (token !== navToken) return;                // за это время нажали другую ссылку

      const finalUrl = new URL(response.url, location.href);
      if (push) {
        history.replaceState({ y: scrollY }, "");    // запомнить, где были на старой странице
        history.pushState({ y: 0 }, "", finalUrl.pathname + finalUrl.search + finalUrl.hash);
      }
      currentPath = finalUrl.pathname;

      /* Подмена. Всё идёт в одном «тике», поэтому пользователь не видит промежуточных кадров. */
      document.title = doc.title;
      document.body.className = doc.body.className;  // классы страницы (oasis-page, webdev-page)
      const desc = doc.querySelector('meta[name="description"]');
      if (desc) document.querySelector('meta[name="description"]')?.setAttribute("content", desc.content);
      document.querySelector("main").replaceWith(document.importNode(newMain, true));
      document.querySelector("footer.footer").replaceWith(document.importNode(newFooter, true));
      const key = pageKey(currentPath);
      document.querySelectorAll("header nav a").forEach(a => {
        if (pageKey(new URL(a.href, location.href).pathname) === key) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
      NL.closeMenu();
      document.documentElement.classList.remove("menu-open");
      NL.applyTheme();
      NL.runPage();                                  // запускаем код новой страницы
      const anchor = finalUrl.hash && document.getElementById(decodeURIComponent(finalUrl.hash.slice(1)));
      if (anchor) anchor.scrollIntoView(); else scrollTo(0, y);
    } catch (error) {
      console.warn("Бесшовный переход не удался, обычный переход:", error);
      location.href = url;                           // запасной вариант
    }
  };

  /* ——— Перехват кликов по внутренним ссылкам ——— */
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target || a.hasAttribute("download")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;      // внешние ссылки как обычно
    if (!pageKey(url.pathname)) return;              // не страница сайта (например /admin/)
    if (url.pathname === currentPath) return;        // та же страница или якорь (#gallery): браузер сам
    e.preventDefault();
    go(url.href, { push: true });
  });

  /* ——— Кнопки «назад / вперёд» ——— */
  history.scrollRestoration = "manual";
  window.addEventListener("popstate", (e) => {
    if (location.pathname === currentPath) return;   // поменялся только якорь
    go(location.href, { push: false, y: (e.state && e.state.y) || 0 });
  });

  /* ——— Первая страница ——— */
  NL.runPage();
})();
