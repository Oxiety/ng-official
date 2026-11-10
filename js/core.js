/* =====================================================================
   ЯДРО (js/core.js) — подключается ПЕРВЫМ на всех страницах
   ---------------------------------------------------------------------
   Что делает: даёт всем остальным скриптам общий объект NL.
   Зачем: сайт переключает страницы без перезагрузки (чтобы не обрывалась
   музыка), поэтому код каждой страницы должен уметь запускаться заново.

   Как пользоваться в своём скрипте:
     NL.onPage(() => { ...код, который работает с текущей страницей... });
   Эта функция вызовется при первой загрузке и при каждом переходе.
   Слушатели на document вешай с { signal: NL.signal }, тогда они
   сами снимутся при уходе со страницы.
   Если нужно что-то убрать вручную: NL.onCleanup(() => { ... }).
   ===================================================================== */
window.NL = (() => {
  const pageInits = [];
  const cleanups = [];
  let controller = null;

  return {
    site: null,                                   // сюда кладётся data/site.json
    onPage(fn) { pageInits.push(fn); },           // зарегистрировать код страницы
    onCleanup(fn) { cleanups.push(fn); },         // что сделать при уходе со страницы
    get signal() { return controller.signal; },   // для addEventListener(..., { signal })

    /* Запустить код страницы: сначала убираем старое, потом запускаем всё заново */
    runPage() {
      cleanups.splice(0).forEach(fn => { try { fn(); } catch (_) {} });
      if (controller) controller.abort();
      controller = new AbortController();
      pageInits.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    },

    /* Кадрирование картинки (приближение и сдвиг), настраивается в админке ОТДЕЛЬНО для компьютера и телефона.
       fit, fitMobile = { x: 0..100, y: 0..100, z: 1..4 } (любой из них можно не задавать).
       Без fit картинка стоит как раньше; без fitMobile на телефоне действует fit компьютера.
       Сами правила (какое когда включается) лежат в css/style.css, раздел «кадрирование». */
    applyFit(img, fit, fitMobile) {
      const read = (f) => {
        if (!f || typeof f !== "object") return null;
        const x = Number(f.x), y = Number(f.y), z = Number(f.z);
        return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
      };
      const d = read(fit), m = read(fitMobile);
      if (d) {                                       // компьютер (и телефон, если для него не задано отдельно)
        img.classList.add("fit");
        img.style.setProperty("--z", d.z);
        img.style.setProperty("--ox", `${d.x}%`);
        img.style.setProperty("--oy", `${d.y}%`);
      }
      if (m) {                                       // только телефон (экран до 760px)
        img.classList.add("fit-m");
        img.style.setProperty("--zm", m.z);
        img.style.setProperty("--oxm", `${m.x}%`);
        img.style.setProperty("--oym", `${m.y}%`);
      }
    }
  };
})();
