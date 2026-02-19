(() => {
  const STORAGE_KEY = "storymap_planner_project_v1";
  const THEME_KEY = "storymap_planner_theme";
  const SECTION_TYPES = {
    title_intro: { label: "Title / Intro", icon: "🏁", hint: "Opening message and orientation", weight: "text" },
    narrative: { label: "Narrative text", icon: "📝", hint: "Main storytelling content", weight: "text" },
    sidecar: { label: "Sidecar", icon: "🧩", hint: "Media + explanatory text", weight: "visual" },
    map: { label: "Map", icon: "🗺️", hint: "Single map view focus", weight: "visual" },
    map_tour: { label: "Map Tour", icon: "🧭", hint: "Guided geographic journey", weight: "visual" },
    gallery: { label: "Gallery", icon: "🖼️", hint: "Multiple media in sequence", weight: "visual" },
    quote: { label: "Quote", icon: "❝", hint: "Highlight key testimony", weight: "text" },
    timeline: { label: "Timeline", icon: "⏱️", hint: "Chronological structure", weight: "text" },
    call_to_action: { label: "Call to action", icon: "📣", hint: "Prompt final user action", weight: "text" }
  };

  const dom = {
    metaForm: document.getElementById("metaForm"),
    sectionList: document.getElementById("sectionList"),
    addSectionBtn: document.getElementById("addSectionBtn"),
    addSectionModal: document.getElementById("addSectionModal"),
    sectionTypeOptions: document.getElementById("sectionTypeOptions"),
    sectionEditor: document.getElementById("sectionEditor"),
    sectionEditorEmpty: document.getElementById("sectionEditorEmpty"),
    emptyState: document.getElementById("emptyState"),
    saveIndicator: document.getElementById("saveIndicator"),
    exportBtn: document.getElementById("exportBtn"),
    exportModal: document.getElementById("exportModal"),
    importBtn: document.getElementById("importBtn"),
    importInput: document.getElementById("importInput"),
    helpBtn: document.getElementById("helpBtn"),
    helpModal: document.getElementById("helpModal"),
    newProjectBtn: document.getElementById("newProjectBtn"),
    templateButtons: document.getElementById("templateButtons"),
    arcSummary: document.getElementById("arcSummary"),
    balanceSummary: document.getElementById("balanceSummary"),
    warnings: document.getElementById("warnings"),
    overallCompleteness: document.getElementById("overallCompleteness"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    aiToggleBtn: document.getElementById("aiToggleBtn"),
    aiPanel: document.getElementById("aiPanel"),
    aiStatus: document.getElementById("aiStatus"),
    closeAiPanelBtn: document.getElementById("closeAiPanelBtn"),
    aiOutput: document.getElementById("aiOutput"),
    aiTemplateStyle: document.getElementById("aiTemplateStyle")
  };

  const defaultMeta = {
    storyTitle: "",
    audience: "",
    goal: "",
    geographicFocus: "",
    tone: "",
    primaryCta: "",
    author: "",
    date: ""
  };

  let state = loadProject() || createEmptyProject();
  let selectedSectionId = null;
  let dirty = false;
  let aiAvailable = false;

  init();

  function init() {
    initTheme();
    renderMetaForm();
    renderTemplateButtons();
    renderSectionTypeOptions();
    bindTopActions();
    renderAll();
    detectAiAvailability();
  }

  function createEmptyProject() {
    return { version: 1, meta: { ...defaultMeta }, sections: [] };
  }

  function uid() {
    return `s_${Math.random().toString(36).slice(2, 11)}_${Date.now().toString(36)}`;
  }

  function createSection(type) {
    return {
      id: uid(), type,
      title: "", purpose: "", keyMessage: "", arcStage: "context", status: "draft", tags: [], notes: "", text: "",
      readingTimeOverrideMins: null,
      map: { purpose: "", dataLayers: [], scaleExtent: "", basemapNotes: "", interactivityNotes: "", attribution: { dataSourceCredited: false, basemapCredited: false, imageryCredited: false, licenceChecked: false } },
      media: []
    };
  }

  function bindTopActions() {
    dom.addSectionBtn.addEventListener("click", () => dom.addSectionModal.showModal());
    dom.helpBtn.addEventListener("click", () => dom.helpModal.showModal());
    dom.exportBtn.addEventListener("click", () => dom.exportModal.showModal());
    dom.importBtn.addEventListener("click", () => dom.importInput.click());
    dom.importInput.addEventListener("change", onImportFile);
    document.getElementById("exportJsonBtn").addEventListener("click", exportJson);
    document.getElementById("exportMarkdownBtn").addEventListener("click", () => downloadText("storymap-plan.md", toMarkdown(state)));
    document.getElementById("exportTextBtn").addEventListener("click", () => downloadText("storymap-plan.txt", toPlainText(state)));
    document.getElementById("printBtn").addEventListener("click", () => window.print());
    dom.newProjectBtn.addEventListener("click", () => {
      if (!confirm("Start a new project? Unsaved changes will be overwritten.")) return;
      state = createEmptyProject();
      selectedSectionId = null;
      persist();
      renderAll();
    });

    dom.themeToggleBtn.addEventListener("click", () => {
      const next = document.body.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
    });

    dom.aiToggleBtn.addEventListener("click", () => {
      dom.aiPanel.hidden = !dom.aiPanel.hidden;
    });
    dom.closeAiPanelBtn.addEventListener("click", () => (dom.aiPanel.hidden = true));
    dom.aiPanel.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-ai-op]");
      if (!btn) return;
      await runAiOperation(btn.dataset.aiOp);
    });
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY) || "light";
    applyTheme(saved);
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    dom.themeToggleBtn.textContent = theme === "dark" ? "Light" : "Dark";
    dom.themeToggleBtn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }

  function renderMetaForm() {
    const fields = [
      ["storyTitle", "Story title"], ["audience", "Audience"], ["goal", "Goal"], ["geographicFocus", "Geographic focus"],
      ["tone", "Tone"], ["primaryCta", "Primary call to action"], ["author", "Author (optional)"], ["date", "Date (optional)"]
    ];
    dom.metaForm.innerHTML = fields.map(([k, label]) => `
      <div>
        <label for="meta_${k}">${label}</label>
        <input id="meta_${k}" data-meta="${k}" value="${escapeHtml(state.meta[k] || "")}" />
      </div>
    `).join("");
    dom.metaForm.querySelectorAll("[data-meta]").forEach((input) => {
      input.addEventListener("input", () => {
        state.meta[input.dataset.meta] = input.value;
        persist();
        renderHelpers();
      });
    });
  }

  function renderTemplateButtons() {
    dom.templateButtons.innerHTML = window.STORY_TEMPLATES.map((t) => `<button class="btn" data-template="${t.id}">${t.name}</button>`).join("");
    dom.templateButtons.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-template]");
      if (!btn) return;
      const t = window.STORY_TEMPLATES.find((x) => x.id === btn.dataset.template);
      if (!t) return;
      state.meta = { ...defaultMeta, ...t.meta };
      state.sections = t.sections.map((base) => ({ ...createSection(base.type), ...base, id: uid() }));
      selectedSectionId = state.sections[0]?.id || null;
      persist();
      renderAll();
    });
  }

  function renderSectionTypeOptions() {
    dom.sectionTypeOptions.innerHTML = Object.entries(SECTION_TYPES).map(([key, item]) => `
      <button type="button" class="btn" data-type="${key}">
        <strong>${item.icon} ${item.label}</strong><br><small>${item.hint}</small>
      </button>
    `).join("");
    dom.sectionTypeOptions.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-type]");
      if (!btn) return;
      const section = createSection(btn.dataset.type);
      section.title = SECTION_TYPES[btn.dataset.type].label;
      state.sections.push(section);
      selectedSectionId = section.id;
      dom.addSectionModal.close();
      persist();
      renderAll();
    });
  }

  function renderAll() {
    renderMetaForm();
    renderSectionList();
    renderSectionEditor();
    renderHelpers();
  }

  function readingTime(section) {
    if (section.readingTimeOverrideMins !== null && section.readingTimeOverrideMins !== "") return Number(section.readingTimeOverrideMins) || 0;
    const words = `${section.title} ${section.purpose} ${section.keyMessage} ${section.text}`.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 180));
  }

  function completeness(section) {
    const checks = [section.title, section.purpose, section.keyMessage, section.arcStage, section.status];
    if (["map", "sidecar", "map_tour"].includes(section.type)) checks.push(section.map.purpose);
    if (["sidecar", "gallery"].includes(section.type)) checks.push(section.media.length ? "1" : "");
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  function renderSectionList() {
    dom.emptyState.hidden = !!state.sections.length;
    dom.sectionList.innerHTML = state.sections.map((section, index) => {
      const missingAlt = ["sidecar", "gallery"].includes(section.type) && section.media.some((m) => !m.altText.trim());
      const c = completeness(section);
      return `
      <li class="section-card ${selectedSectionId === section.id ? "selected" : ""}" data-id="${section.id}" tabindex="0" draggable="true">
        <div class="card-top">
          <button class="btn drag-handle" data-action="drag" aria-label="Drag to reorder">↕</button>
          <h3 class="card-title">${SECTION_TYPES[section.type].icon} ${escapeHtml(section.title || SECTION_TYPES[section.type].label)}</h3>
          <div class="completion-ring" style="--p:${c}"><span>${c}%</span></div>
        </div>
        <div class="card-meta">
          <span>${SECTION_TYPES[section.type].label}</span>
          <span>• ${section.arcStage}</span>
          <span>• ${section.status}</span>
          <span>• ~${readingTime(section)} min</span>
          ${missingAlt ? `<span class="warning">• Missing alt text</span>` : ""}
        </div>
        <div class="card-actions">
          <button class="btn" data-action="up">↑</button>
          <button class="btn" data-action="down">↓</button>
          <button class="btn" data-action="duplicate">Duplicate</button>
          <button class="btn" data-action="delete">Delete</button>
        </div>
      </li>`;
    }).join("");

    dom.sectionList.querySelectorAll(".section-card").forEach((card) => {
      card.addEventListener("click", () => {
        selectedSectionId = card.dataset.id;
        renderSectionList();
        renderSectionEditor();
      });
      card.addEventListener("keydown", (e) => {
        if (e.altKey && e.key === "ArrowUp") moveSection(card.dataset.id, -1);
        if (e.altKey && e.key === "ArrowDown") moveSection(card.dataset.id, 1);
        if (e.key === "Delete") deleteSection(card.dataset.id);
      });
      card.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", card.dataset.id));
      card.addEventListener("dragover", (e) => e.preventDefault());
      card.addEventListener("drop", (e) => {
        e.preventDefault();
        const srcId = e.dataTransfer.getData("text/plain");
        reorderByDrop(srcId, card.dataset.id);
      });
    });

    dom.sectionList.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.closest(".section-card").dataset.id;
        const action = btn.dataset.action;
        if (action === "up") moveSection(id, -1);
        if (action === "down") moveSection(id, 1);
        if (action === "duplicate") duplicateSection(id);
        if (action === "delete") deleteSection(id);
      });
    });
  }

  function moveSection(id, delta) {
    const i = state.sections.findIndex((s) => s.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= state.sections.length) return;
    [state.sections[i], state.sections[j]] = [state.sections[j], state.sections[i]];
    persist();
    renderAll();
  }

  function reorderByDrop(srcId, targetId) {
    if (srcId === targetId) return;
    const src = state.sections.findIndex((s) => s.id === srcId);
    const dst = state.sections.findIndex((s) => s.id === targetId);
    if (src < 0 || dst < 0) return;
    const [item] = state.sections.splice(src, 1);
    state.sections.splice(dst, 0, item);
    persist();
    renderAll();
  }

  function duplicateSection(id) {
    const i = state.sections.findIndex((s) => s.id === id);
    if (i < 0) return;
    const clone = structuredClone(state.sections[i]);
    clone.id = uid();
    clone.title = `${clone.title} (copy)`;
    state.sections.splice(i + 1, 0, clone);
    persist();
    renderAll();
  }

  function deleteSection(id) {
    if (!confirm("Delete this section?")) return;
    state.sections = state.sections.filter((s) => s.id !== id);
    if (selectedSectionId === id) selectedSectionId = state.sections[0]?.id || null;
    persist();
    renderAll();
  }

  function renderSectionEditor() {
    const section = state.sections.find((s) => s.id === selectedSectionId);
    if (!section) {
      dom.sectionEditor.hidden = true;
      dom.sectionEditorEmpty.hidden = false;
      return;
    }
    dom.sectionEditor.hidden = false;
    dom.sectionEditorEmpty.hidden = true;

    dom.sectionEditor.innerHTML = `
      ${inputField("title", "Section title", section.title)}
      ${inputField("purpose", "Purpose", section.purpose)}
      ${inputField("keyMessage", "Key message", section.keyMessage)}
      ${textareaField("text", "Narrative text", section.text)}
      ${inputField("readingTimeOverrideMins", "Estimated reading time override (mins)", section.readingTimeOverrideMins ?? "", "number")}
      ${selectField("status", "Status", ["draft", "ready", "done"], section.status)}
      ${inputField("tags", "Tags (comma separated)", section.tags.join(", "))}
      ${textareaField("notes", "Notes", section.notes)}
      ${selectField("arcStage", "Arc stage", ["context", "challenge", "exploration", "insight", "outcome"], section.arcStage)}
      ${renderMapFields(section)}
      ${renderMediaFields(section)}
    `;

    dom.sectionEditor.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("input", () => {
        const f = el.dataset.field;
        if (f === "tags") section.tags = el.value.split(",").map((t) => t.trim()).filter(Boolean);
        else if (f === "readingTimeOverrideMins") section[f] = el.value === "" ? null : Number(el.value);
        else section[f] = el.value;
        persist();
        renderSectionList();
        renderHelpers();
      });
    });

    dom.sectionEditor.querySelectorAll("[data-map]").forEach((el) => {
      el.addEventListener("input", () => {
        section.map[el.dataset.map] = el.value;
        persist();
      });
    });

    dom.sectionEditor.querySelectorAll("[data-attr]").forEach((el) => {
      el.addEventListener("change", () => {
        section.map.attribution[el.dataset.attr] = el.checked;
        persist();
      });
    });

    const addLayerBtn = dom.sectionEditor.querySelector("#addLayerBtn");
    if (addLayerBtn) addLayerBtn.onclick = () => {
      section.map.dataLayers.push("New layer");
      persist();
      renderSectionEditor();
    };
    dom.sectionEditor.querySelectorAll("[data-layer-idx]").forEach((el) => {
      el.addEventListener("input", () => {
        section.map.dataLayers[Number(el.dataset.layerIdx)] = el.value;
        persist();
      });
    });

    const addMediaBtn = dom.sectionEditor.querySelector("#addMediaBtn");
    if (addMediaBtn) addMediaBtn.onclick = () => {
      section.media.push({ type: "image", source: "", caption: "", altText: "", credit: "" });
      persist();
      renderSectionEditor();
      renderSectionList();
    };
    dom.sectionEditor.querySelectorAll("[data-media-idx]").forEach((el) => {
      el.addEventListener("input", () => {
        const idx = Number(el.dataset.mediaIdx);
        const k = el.dataset.mediaField;
        section.media[idx][k] = el.value;
        persist();
        renderSectionList();
      });
    });
  }

  function renderMapFields(section) {
    if (!["map", "sidecar", "map_tour"].includes(section.type)) return "";
    const a = section.map.attribution;
    return `
      <fieldset><legend>Map planning</legend>
        ${inputField("", "Map purpose", section.map.purpose, "text", "map", "purpose")}
        <label>Data layers</label>
        ${(section.map.dataLayers || []).map((v, i) => `<input data-layer-idx="${i}" value="${escapeHtml(v)}" />`).join("")}
        <button id="addLayerBtn" type="button" class="btn">+ Add layer</button>
        ${textareaField("", "Scale / extent notes", section.map.scaleExtent, "map", "scaleExtent")}
        ${textareaField("", "Basemap notes", section.map.basemapNotes, "map", "basemapNotes")}
        ${textareaField("", "Interactivity notes", section.map.interactivityNotes, "map", "interactivityNotes")}
        <div>
          <label><input type="checkbox" data-attr="dataSourceCredited" ${a.dataSourceCredited ? "checked" : ""}/> Data source credited</label>
          <label><input type="checkbox" data-attr="basemapCredited" ${a.basemapCredited ? "checked" : ""}/> Basemap credited</label>
          <label><input type="checkbox" data-attr="imageryCredited" ${a.imageryCredited ? "checked" : ""}/> Imagery credited</label>
          <label><input type="checkbox" data-attr="licenceChecked" ${a.licenceChecked ? "checked" : ""}/> Licence checked</label>
        </div>
      </fieldset>
    `;
  }

  function renderMediaFields(section) {
    if (!["sidecar", "gallery"].includes(section.type)) return "";
    return `
      <fieldset><legend>Media items</legend>
      ${(section.media || []).map((m, i) => `
        <div class="helper-card">
          ${selectHtml(`media_${i}_type`, ["image", "video", "embed"], m.type, i, "type")}
          ${inputMedia(i, "source", "Filename or URL", m.source)}
          ${inputMedia(i, "caption", "Caption", m.caption)}
          ${inputMedia(i, "altText", "Alt text", m.altText)}
          ${inputMedia(i, "credit", "Credit", m.credit)}
        </div>
      `).join("")}
      <button id="addMediaBtn" type="button" class="btn">+ Add media item</button>
      </fieldset>
    `;
  }

  function renderHelpers() {
    const arc = { context: 0, challenge: 0, exploration: 0, insight: 0, outcome: 0 };
    let text = 0, visual = 0, missingAlt = 0;
    state.sections.forEach((s) => {
      arc[s.arcStage] = (arc[s.arcStage] || 0) + 1;
      if (SECTION_TYPES[s.type].weight === "text") text += 1; else visual += 1;
      if (["sidecar", "gallery"].includes(s.type) && s.media.some((m) => !m.altText.trim())) missingAlt += 1;
    });

    dom.arcSummary.innerHTML = `<strong>Arc coverage</strong><br>${Object.entries(arc).map(([k,v]) => `${k}: ${v}`).join(" • ")}`;
    const ratio = visual ? (text / visual).toFixed(2) : "∞";
    dom.balanceSummary.innerHTML = `<strong>Balance</strong><br>Text-heavy: ${text} • Visual-heavy: ${visual} • Ratio T/V: ${ratio}`;

    const warnings = [];
    let run = 0;
    state.sections.forEach((s) => {
      if (SECTION_TYPES[s.type].weight === "text") run += 1; else run = 0;
      if (run >= 4) warnings.push("4 text-heavy sections in a row");
    });
    if (!arc.challenge || !arc.outcome) warnings.push("Missing arc stage: Challenge or Outcome");
    if (missingAlt) warnings.push(`Missing alt text in ${missingAlt} section(s)`);
    if (!state.meta.primaryCta) warnings.push("No primary call to action in metadata");
    dom.warnings.innerHTML = `<strong>Warnings</strong><br>${warnings.length ? warnings.map((w) => `<div class="warning">• ${w}</div>`).join("") : "No major warnings."}`;

    const overall = state.sections.length ? Math.round(state.sections.reduce((acc, s) => acc + completeness(s), 0) / state.sections.length) : 0;
    dom.overallCompleteness.innerHTML = `<strong>Overall completeness</strong><br>${overall}%`;
  }

  function persist() {
    dirty = true;
    dom.saveIndicator.textContent = "Saving...";
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setTimeout(() => {
      dirty = false;
      dom.saveIndicator.textContent = "Saved";
    }, 120);
  }

  function loadProject() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function exportJson() {
    downloadText("storymap-project.json", JSON.stringify(state, null, 2));
  }

  function onImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!imported || imported.version !== 1 || !Array.isArray(imported.sections)) throw new Error("Invalid schema");
        state = imported;
        selectedSectionId = state.sections[0]?.id || null;
        persist();
        renderAll();
        alert("Import successful.");
      } catch {
        alert("Import failed. Please choose a valid StoryMap Planner JSON file.");
      }
    };
    reader.readAsText(file);
  }

  function toMarkdown(project) {
    const lines = [
      `# ${project.meta.storyTitle || "Untitled Story"}`,
      "",
      `- Audience: ${project.meta.audience || ""}`,
      `- Goal: ${project.meta.goal || ""}`,
      `- Geographic focus: ${project.meta.geographicFocus || ""}`,
      `- Tone: ${project.meta.tone || ""}`,
      `- Primary CTA: ${project.meta.primaryCta || ""}`,
      "",
      "## Storyboard"
    ];
    project.sections.forEach((s, i) => {
      lines.push(`### ${i + 1}. ${s.title || SECTION_TYPES[s.type].label}`);
      lines.push(`- Type: ${SECTION_TYPES[s.type].label}`);
      lines.push(`- Arc stage: ${s.arcStage}`);
      lines.push(`- Status: ${s.status}`);
      lines.push(`- Purpose: ${s.purpose || ""}`);
      lines.push(`- Key message: ${s.keyMessage || ""}`);
      if (s.text) lines.push(`- Narrative: ${s.text}`);
      if (s.tags?.length) lines.push(`- Tags: ${s.tags.join(", ")}`);
      lines.push("");
    });
    return lines.join("\n");
  }

  function toPlainText(project) {
    return toMarkdown(project)
      .replace(/^### /gm, "\nSECTION: ")
      .replace(/^## /gm, "\n")
      .replace(/^# /gm, "STORY: ")
      .replace(/^- /gm, "  - ");
  }

  function downloadText(filename, content) {
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function detectAiAvailability() {
    if (location.protocol === "file:") {
      aiAvailable = false;
      dom.aiStatus.textContent = "AI not available here (local file mode). Deploy on Cloudflare Pages to enable AI Assist.";
      return;
    }
    fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "quality_check", context: { probe: true } }) })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error("Unavailable")))
      .then(() => {
        aiAvailable = true;
        dom.aiStatus.textContent = "AI available.";
      })
      .catch(() => {
        aiAvailable = false;
        dom.aiStatus.textContent = "AI not available here. On GitHub Pages this is expected; Cloudflare Pages enables AI with binding.";
      });
  }

  async function runAiOperation(operation) {
    if (!aiAvailable) {
      dom.aiOutput.value = "AI not available in this environment.";
      return;
    }
    const section = state.sections.find((s) => s.id === selectedSectionId) || null;
    const context = buildAiContext(operation, section);
    dom.aiOutput.value = "Working...";
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, context })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      dom.aiOutput.value = data.result || "No output";
    } catch (err) {
      dom.aiOutput.value = `AI request failed: ${err.message}`;
    }
  }

  function buildAiContext(operation, section) {
    if (operation === "outline") {
      return { meta: state.meta, templateStyle: dom.aiTemplateStyle.value || "balanced" };
    }
    if (operation === "quality_check") {
      return { meta: state.meta, sections: state.sections.map(s => ({ type: s.type, title: s.title, keyMessage: s.keyMessage, arcStage: s.arcStage, media: s.media })) };
    }
    if (!section) return { note: "No section selected" };
    if (operation === "improve_key_message") return { title: section.title, purpose: section.purpose, keyMessage: section.keyMessage };
    if (operation === "draft_section_text") return { title: section.title, purpose: section.purpose, keyMessage: section.keyMessage, arcStage: section.arcStage };
    if (operation === "suggest_alt_text") return { media: section.media.map(m => ({ type: m.type, source: m.source, caption: m.caption, altText: m.altText })) };
    if (operation === "suggest_cta") return { goal: state.meta.goal, audience: state.meta.audience, currentCta: state.meta.primaryCta };
    return {};
  }

  function inputField(field, label, value, type = "text", dataset = "field", datasetValue = field) {
    return `<div><label>${label}</label><input type="${type}" data-${dataset}="${datasetValue}" value="${escapeHtml(String(value ?? ""))}" /></div>`;
  }
  function textareaField(field, label, value, dataset = "field", datasetValue = field) {
    return `<div><label>${label}</label><textarea data-${dataset}="${datasetValue}">${escapeHtml(String(value ?? ""))}</textarea></div>`;
  }
  function selectField(field, label, options, selected) {
    return `<div><label>${label}</label><select data-field="${field}">${options.map(o => `<option value="${o}" ${o===selected?"selected":""}>${o}</option>`).join("")}</select></div>`;
  }
  function selectHtml(id, options, selected, idx, field) {
    return `<label for="${id}">Type</label><select id="${id}" data-media-idx="${idx}" data-media-field="${field}">${options.map(o => `<option value="${o}" ${o===selected?"selected":""}>${o}</option>`).join("")}</select>`;
  }
  function inputMedia(idx, field, label, value) {
    return `<label>${label}</label><input data-media-idx="${idx}" data-media-field="${field}" value="${escapeHtml(value || "")}" />`;
  }

  function escapeHtml(v) {
    return String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
})();
