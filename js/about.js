/* =====================================================================
   СТРАНИЦА «ОБО МНЕ» (js/about.js)
   Всё берётся из data/about.json (правится в админке, вкладка «Обо мне»).
   Пустые разделы скрываются сами. Показывается всегда, в том числе в деловом режиме.
   ===================================================================== */
(() => {
  "use strict";
  const NL = window.NL;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const safeUrl = (u) => /^(https?:|mailto:|tel:)/i.test(u || "") ? u : "";
  const fill = (box, section, nodes) => { box.replaceChildren(...nodes); section.hidden = !nodes.length; };

  NL.onPage(() => {
    const root = document.getElementById("about");
    if (!root) return;
    NL.loadTx("data/about.json", root).then((C) => {
      const $ = (id) => root.querySelector("#" + id);
      const list = (k) => (Array.isArray(C[k]) ? C[k] : []);
      const has = (v) => typeof v === "string" && v.trim();
      // фото
      const photo = $("abPhoto"), img = photo.querySelector("img");
      const hasPhoto = has(C.photo);
      photo.hidden = !hasPhoto; $("abHero").classList.toggle("no-photo", !hasPhoto);
      if (hasPhoto) NL.applyFit(img, C.photo_fit, C.photo_fit_mobile);
      $("abBio").hidden = !has(C.bio);
      // факты
      fill($("abFactsList"), $("abFacts"), list("facts").filter(f => has(f.label) || has(f.value)).map(f => {
        const li = el("li"); li.append(el("b", "", f.label || ""), el("span", "", f.value || "")); return li; }));
      // навыки
      fill($("abSkillsList"), $("abSkills"), list("skills").filter(has).map(s => el("li", "", s)));
      // опыт
      fill($("abExpList"), $("abExp"), list("experience").filter(e => has(e.title)).map(e => {
        const li = el("li"), body = el("div");
        body.append(el("h3", "", e.title));
        if (has(e.place)) body.append(el("p", "where", e.place));
        if (has(e.text)) body.append(el("p", "", e.text));
        li.append(el("div", "when", e.period || ""), body); return li; }));
      // проекты
      fill($("abProjList"), $("abProj"), list("projects").filter(p => has(p.title)).map(p => {
        const url = safeUrl(p.url), a = el(url ? "a" : "div");
        if (url) { a.href = url; if (/^https?:/i.test(url)) { a.target = "_blank"; a.rel = "noopener noreferrer"; } }
        a.append(el("h3", "", p.title)); if (has(p.text)) a.append(el("p", "", p.text)); return a; }));
      // контакты
      fill($("abContactsList"), $("abContacts"), list("contacts").filter(c => has(c.value)).map(c => {
        const url = safeUrl(c.url), a = el(url ? "a" : "div");
        if (url) { a.href = url; if (/^https?:/i.test(url)) { a.target = "_blank"; a.rel = "noopener noreferrer"; } }
        a.append(el("small", "", c.label || ""), el("span", "v", c.value)); return a; }));
    });
  });
})();
