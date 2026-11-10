/* Запускается при загрузке страницы и при каждом бесшовном переходе (см. js/core.js) */
NL.onPage(() => {
  "use strict";
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[ch]));
  // Кадрирование из админки: {x,y,z} для компьютера (fit) и для телефона (fit_mobile) -> атрибуты картинки.
  // Правила показа лежат в css/style.css (раздел «кадрирование»); тот же расчёт делает NL.applyFit в js/core.js.
  const fitAttrs = (fit, fitMobile) => {
    const read = (f) => {
      if (!f || typeof f !== "object") return null;
      const x = Number(f.x), y = Number(f.y), z = Number(f.z);
      return [x, y, z].every(Number.isFinite) ? { x, y, z } : null;
    };
    const d = read(fit), m = read(fitMobile);
    if (!d && !m) return "";
    const classes = [d ? "fit" : "", m ? "fit-m" : ""].filter(Boolean).join(" ");
    const vars = (d ? `--z:${d.z};--ox:${d.x}%;--oy:${d.y}%;` : "") + (m ? `--zm:${m.z};--oxm:${m.x}%;--oym:${m.y}%;` : "");
    return ` class="${classes}" style="${vars}"`;
  };
  document.querySelectorAll("[data-gallery]").forEach(async (gallery) => {
    const type = gallery.dataset.gallery;
    try {
      const response = await fetch(`data/${type}.json`, { cache: "no-cache" });
      if (!response.ok) throw new Error("Не удалось загрузить галерею");
      const data = await response.json();
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) {
        gallery.innerHTML = '<p class="gallery-empty">Пока здесь пусто. Добавь изображения через <a href="admin/">админку</a>.</p>';
        return;
      }
      gallery.innerHTML = items.map((item) => {
        const image = esc(item.image || "");
        const title = esc(item.title || "Без названия");
        const alt = esc(item.alt || item.title || "");
        const details = [];
        const dateLabel = type === "arts" ? "Дата создания" : "Дата съёмки";
        const placeLabel = type === "arts" ? "Место / контекст" : "Место съёмки";
        if (item.date) details.push(`<span><b>${dateLabel}</b>${esc(item.date)}</span>`);
        if (item.location) details.push(`<span><b>${placeLabel}</b>${esc(item.location)}</span>`);
        const meta = [item.date ? `${dateLabel}: ${item.date}` : "", item.location ? `${placeLabel}: ${item.location}` : ""].filter(Boolean).join(" · ");
        // В лайтбоксе показываем подпись, описание (поле alt) и дату/место; точные дубликаты убираем.
        const captionParts = [item.caption, item.alt, meta].filter(Boolean);
        const caption = esc([...new Set(captionParts)].join(" — ") || item.title || "");
        return `<figure class="shot rv"><button type="button" data-full="${image}" data-alt="${alt}" data-caption="${caption}" aria-label="Открыть: ${title}"><img src="${image}" alt="${alt}" loading="lazy" decoding="async"${fitAttrs(item.fit, item.fit_mobile)}><span class="cap">${title}</span></button>${details.length ? `<figcaption class="shot-meta">${details.join("")}</figcaption>` : ""}</figure>`;
      }).join("");
      gallery.dispatchEvent(new CustomEvent("gallery:updated", { bubbles: true }));
      gallery.querySelectorAll(".rv").forEach((el, index) => {
        el.classList.add("in");
        el.style.setProperty("--d", `${Math.min(index, 5) * .08}s`);
      });
    } catch (error) {
      gallery.innerHTML = '<p class="gallery-empty">Не получилось загрузить галерею. Проверь файл данных в <code>data/</code>.</p>';
      console.error(error);
    }
  });
});
