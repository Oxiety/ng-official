/* =====================================================================
   НАСТРОЙКИ (js/settings.js)
   ---------------------------------------------------------------------
   Что делает: кнопка-шестерёнка в таскбаре открывает окно настроек:
     • Тема: светлая / тёмная
     • Оптимизация: авто / включена / выключена. «Лёгкий режим» убирает
       самые тяжёлые эффекты (размытие стекла, дрожание окон, фон),
       нужен, если сайт лагает.
     • Отключить анимации совсем.
   Что запоминается: localStorage, ключ northling-settings
     { perf: "auto" | "on" | "off", noAnim: true | false }
   Применяются настройки двумя способами:
     1) сразу при загрузке: маленький скрипт в <head> каждой страницы
        (чтобы не было «моргания»);
     2) при переключении в окне: функция apply() ниже.
   Сами эффекты описаны в css/style.css (классы html.lite и html.no-anim).
   ===================================================================== */
(() => {
  "use strict";
  const KEY = "northling-settings";
  const root = document.documentElement;
  const toggle = document.querySelector(".settings-toggle");
  if (!toggle) return;

  /* ——— Сохранённые настройки ——— */
  let settings = { perf: "auto", noAnim: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (_) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) {} };

  /* ——— Слабое ли устройство (для режима «авто»), та же проверка, что в <head> ——— */
  const isWeak = () => {
    const n = navigator, m = n.deviceMemory, c = n.hardwareConcurrency, d = n.connection;
    return (m && m <= 2) || (c && c <= 2) || (d && d.saveData) || (c && c <= 4 && m && m <= 4);
  };
  const apply = () => {
    root.classList.toggle("lite", settings.perf === "on" || (settings.perf === "auto" && !!isWeak()));
    root.classList.toggle("no-anim", !!settings.noAnim);
  };

  /* ——— Окно настроек ——— */
  const win = document.createElement("section");
  win.className = "settings";
  win.hidden = true;
  win.setAttribute("aria-label", "Настройки");
  win.innerHTML = `
    <header class="pop-bar"><span class="pop-title"><svg class="i" aria-hidden="true"><use href="#i-gear"/></svg> настройки</span>
      <button type="button" class="pop-x" aria-label="Закрыть настройки"><svg class="pi" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>
    <div class="settings-body">
      <section><h3>Тема</h3>
        <div class="pseg" data-group="theme"><button type="button" data-value="light">☼ Светлая</button><button type="button" data-value="dark">☾ Тёмная</button></div>
      </section>
      <section><h3>Оптимизация</h3>
        <div class="pseg" data-group="perf"><button type="button" data-value="auto">Авто</button><button type="button" data-value="on">Включена</button><button type="button" data-value="off">Выключена</button></div>
        <p class="hint">Если сайт лагает, включи. Уберутся размытие стекла, дрожание окон и анимированный фон. «Авто» включает сама на слабых устройствах.</p>
      </section>
      <section><h3>Анимации</h3>
        <label class="switch"><input type="checkbox" data-group="noAnim"><span class="knob" aria-hidden="true"></span><span>Отключить все анимации</span></label>
      </section>
    </div>`;
  document.body.appendChild(win);

  const paint = () => {                          // подсветить выбранное
    const theme = root.dataset.theme === "light" ? "light" : "dark";
    win.querySelectorAll('[data-group="theme"] button').forEach(b => b.classList.toggle("on", b.dataset.value === theme));
    win.querySelectorAll('[data-group="perf"] button').forEach(b => b.classList.toggle("on", b.dataset.value === settings.perf));
    win.querySelector('input[data-group="noAnim"]').checked = !!settings.noAnim;
  };
  win.querySelector('[data-group="theme"]').addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    window.NL.setTheme(b.dataset.value); paint();
  });
  win.querySelector('[data-group="perf"]').addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    settings.perf = b.dataset.value; save(); apply(); paint();
  });
  win.querySelector('input[data-group="noAnim"]').addEventListener("change", (e) => {
    settings.noAnim = e.target.checked; save(); apply();
  });

  /* ——— Открыть / закрыть (одновременно открыто одно окно: плеер или настройки) ——— */
  const setOpen = (open) => {
    win.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) { paint(); document.dispatchEvent(new CustomEvent("nl:popover", { detail: "settings" })); }
  };
  toggle.addEventListener("click", (e) => { e.stopPropagation(); setOpen(win.hidden); });
  win.querySelector(".pop-x").addEventListener("click", () => { setOpen(false); toggle.focus(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !win.hidden) { setOpen(false); toggle.focus(); } });
  document.addEventListener("nl:popover", (e) => { if (e.detail !== "settings" && !win.hidden) setOpen(false); });
  document.addEventListener("click", (e) => {    // клик мимо окна закрывает его
    if (!win.hidden && !win.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
  });

  apply();
})();
