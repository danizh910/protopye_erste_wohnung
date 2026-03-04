import { calculateBudgetTotal, canCompleteDeposit, calculateProgress } from "./utils.mjs";

const STORAGE_KEY = "first-apartment-prototype-v2";

const defaultState = {
  tasks: [
    { id: "lease", title: "Mietvertrag hochladen", status: "open", description: "Lade den unterschriebenen Mietvertrag hoch.", educationTopics: [] },
    { id: "deposit", title: "Kaution organisieren", status: "open", description: "Trage Betrag ein und dokumentiere die Unterschriftenlage.", educationTopics: ["kaution", "wg-kaution"] },
    { id: "budget", title: "Budget planen", status: "open", description: "Plane monatliche und einmalige Wohnkosten.", educationTopics: ["nebenkosten"] },
    { id: "standing-order", title: "Daueraufträge einrichten", status: "open", description: "Erfasse einen oder mehrere Daueraufträge für wiederkehrende Zahlungen.", educationTopics: [] },
    { id: "insurance", title: "Versicherungen prüfen", status: "open", description: "Vergleiche relevante Policen und dokumentiere deine Auswahl.", educationTopics: ["versicherungen"] },
    { id: "documents", title: "Dokumente speichern", status: "open", description: "Lege wichtige Nachweise zentral im Upload-Bereich ab.", educationTopics: [] }
  ],
  deposit: {
    amount: 2550,
    amountConfirmed: false,
    roommates: [
      { name: "Ich", email: "", phone: "", status: "open", signatureType: "none", signedAt: "", signatureDataUrl: "" },
      { name: "Beispiel Person", email: "", phone: "", status: "open", signatureType: "none", signedAt: "", signatureDataUrl: "" }
    ]
  },
  budget: {
    rent: 850,
    internet: 35,
    power: 60,
    insurance: 18,
    transport: 65,
    groceries: 280,
    customItems: [{ id: "reserve", label: "Rücklage", amount: 60 }],
    oneTimeItems: [{ id: "move", label: "Umzugskosten", amount: 420 }]
  },
  standingOrders: {
    items: [],
    draft: {
      id: "",
      iban: "",
      recipient: "",
      monthlyAmount: 0,
      executionDay: 1,
      startDate: "",
      purpose: "Miete",
      confirmed: false
    }
  },
  insurance: {
    options: [
      { id: "liability", title: "Privathaftpflicht", selected: true, priority: "hoch", note: "Wichtig bei Schäden gegenüber Dritten.", annualPremium: 130, deductible: 200, coverage: 5 },
      { id: "household", title: "Hausrat", selected: false, priority: "mittel", note: "Schützt Möbel und Technik in der Wohnung.", annualPremium: 180, deductible: 250, coverage: 4 },
      { id: "legal", title: "Rechtsschutz Wohnen", selected: false, priority: "niedrig", note: "Hilft bei mietrechtlichen Streitigkeiten.", annualPremium: 160, deductible: 300, coverage: 3 }
    ],
    compareBy: "",
    priorityCriterion: "",
    recommendation: ""
  },
  documents: {
    leaseUploaded: false,
    depositConfirmationUploaded: false,
    uploads: []
  },
  ui: { toast: "", lastError: "", language: "de" }
};

const app = document.getElementById("app");
let state = loadState();

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function normalizeRoommate(r) {
  return {
    name: r.name || "Unbekannt",
    email: r.email || "",
    phone: r.phone || "",
    status: r.status || "open",
    signatureType: r.signatureType || "none",
    signedAt: r.signedAt || "",
    signatureDataUrl: r.signatureDataUrl || ""
  };
}

function roommateHasContactData(roommate) {
  return Boolean(roommate?.email?.trim() && roommate?.phone?.trim());
}

function getDepositIssues() {
  const issues = [];
  if (!(Number(state.deposit.amount) > 0)) issues.push("Kautionsbetrag fehlt");
  if (!state.deposit.amountConfirmed) issues.push("Betrag nicht bestätigt");
  if (!state.deposit.roommates.length) issues.push("Mindestens eine Person fehlt");

  state.deposit.roommates.forEach((roommate) => {
    if (!roommateHasContactData(roommate)) issues.push(`Kontaktdaten fehlen bei ${roommate.name}`);
    if (roommate.status !== "signed") issues.push(`QES-Unterschrift fehlt bei ${roommate.name}`);
  });

  return issues;
}

function normalizeState(rawState) {
  const merged = {
    ...clone(defaultState),
    ...rawState,
    deposit: { ...clone(defaultState.deposit), ...(rawState?.deposit || {}) },
    budget: { ...clone(defaultState.budget), ...(rawState?.budget || {}) },
    insurance: { ...clone(defaultState.insurance), ...(rawState?.insurance || {}) },
    documents: { ...clone(defaultState.documents), ...(rawState?.documents || {}) },
    ui: { ...clone(defaultState.ui), ...(rawState?.ui || {}) }
  };

  const oldStandingOrder = rawState?.standingOrder;
  const newStandingOrders = rawState?.standingOrders;
  merged.standingOrders = {
    ...clone(defaultState.standingOrders),
    ...(newStandingOrders || {})
  };

  if (!newStandingOrders && oldStandingOrder) {
    if (oldStandingOrder.iban || oldStandingOrder.recipient || Number(oldStandingOrder.monthlyAmount) > 0) {
      merged.standingOrders.items = [{ ...clone(defaultState.standingOrders.draft), ...oldStandingOrder, id: String(Date.now()) }];
    }
  }

  if (!Array.isArray(merged.budget.customItems)) merged.budget.customItems = [];
  if (!Array.isArray(merged.budget.oneTimeItems)) merged.budget.oneTimeItems = [];
  if (!Array.isArray(merged.documents.uploads)) merged.documents.uploads = [];
  if (!Array.isArray(merged.deposit.roommates)) merged.deposit.roommates = clone(defaultState.deposit.roommates);
  merged.deposit.roommates = merged.deposit.roommates.map(normalizeRoommate);
  if (!Array.isArray(merged.insurance.options)) merged.insurance.options = clone(defaultState.insurance.options);
  if (!Array.isArray(merged.standingOrders.items)) merged.standingOrders.items = [];
  merged.standingOrders.draft = { ...clone(defaultState.standingOrders.draft), ...(merged.standingOrders.draft || {}) };

  return merged;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return clone(defaultState);
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return clone(defaultState);
  }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }


function getLanguage() {
  return state.ui.language === "en" ? "en" : "de";
}

function t(de, en) {
  return getLanguage() === "en" ? en : de;
}

function toggleLanguage() {
  state.ui.language = getLanguage() === "de" ? "en" : "de";
  saveState();
  render();
}

function setToast(msg) {
  state.ui.toast = msg;
  saveState();
  render();
  setTimeout(() => {
    if (state.ui.toast === msg) {
      state.ui.toast = "";
      saveState();
      render();
    }
  }, 1800);
}

function go(path) { window.location.hash = `#${path}`; }
function taskById(id) { return state.tasks.find((task) => task.id === id); }
function markTask(id, done) { const t = taskById(id); if (t) t.status = done ? "done" : "open"; }

function isStandingOrderItemComplete(item) {
  return Boolean(item.iban && item.recipient && Number(item.monthlyAmount) > 0 && Number(item.executionDay) >= 1 && Number(item.executionDay) <= 28 && item.startDate && item.confirmed);
}

function isStandingOrderDraftReady(item) {
  return Boolean(item.iban && item.recipient && Number(item.monthlyAmount) > 0 && Number(item.executionDay) >= 1 && Number(item.executionDay) <= 28 && item.startDate);
}

function isStandingOrderComplete() {
  return state.standingOrders.items.length > 0 && state.standingOrders.items.every((item) => isStandingOrderItemComplete(item));
}
function isInsuranceComplete() {
  return state.insurance.options.some((o) => o.selected) && Boolean(state.insurance.compareBy) && Boolean(state.insurance.priorityCriterion) && Boolean(state.insurance.recommendation);
}

function updateTaskFromRules() {
  markTask("deposit", canCompleteDeposit(state.deposit));
  markTask("lease", state.documents.leaseUploaded);
  markTask("standing-order", isStandingOrderComplete());
  markTask("insurance", isInsuranceComplete());
  markTask("documents", state.documents.leaseUploaded && state.documents.depositConfirmationUploaded);
  markTask("budget", Number(calculateBudgetTotal(state.budget).monthlyTotal) > 0);
  saveState();
}

function ensureCompletionNavigation() {
  const progress = calculateProgress(state.tasks);
  if (progress.done === progress.total && route().path !== "/done") go("/done");
}

function route() {
  const hash = window.location.hash.replace("#", "") || "/";
  const [path, queryString] = hash.split("?");
  const query = new URLSearchParams(queryString || "");
  if (path.startsWith("/task/")) return { path: "/task/:taskId", taskId: path.replace("/task/", ""), query };
  return { path, query };
}

function taskSubAction(task) {
  if (task.id === "deposit") return `<button class="secondary" data-nav="/deposit">Kaution öffnen</button>`;
  if (task.id === "budget") return `<button class="secondary" data-nav="/budget">Budget öffnen</button>`;
  if (task.id === "standing-order") return `<button class="secondary" data-nav="/standing-order">Daueraufträge öffnen</button>`;
  if (task.id === "insurance") return `<button class="secondary" data-nav="/insurance">Versicherungen öffnen</button>`;
  if (task.id === "documents" || task.id === "lease") return `<button class="secondary" data-nav="/documents">Dokumente öffnen</button>`;
  return "";
}

function getNextOpenTaskId(excludeTaskId = "") {
  return state.tasks.find((task) => task.status === "open" && task.id !== excludeTaskId)?.id;
}

function layout(title, content, { showBack = true } = {}) {
  const progress = calculateProgress(state.tasks);
  const percent = Math.round((progress.done / progress.total) * 100);
  return `<div class="app-shell">
    <header>
      ${showBack
        ? `<button class="back-btn ghost" data-back="1" aria-label="${t("Zurück", "Back")}">
            <svg width="10" height="16" viewBox="0 0 10 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.5 1.5L1.5 8L8.5 14.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
           </button>`
        : ""}
      <div class="brand">
        <img src="firsthome-logo.svg" class="brand-logo" alt="FirstHome by UBS" />
        <span class="brand-title">${title}</span>
      </div>
      <button class="ghost lang-toggle" data-action="toggle-language">${getLanguage().toUpperCase()}</button>
    </header>
    <div class="global-progress" aria-label="${t("Fortschritt", "Progress")}">
      <div class="global-progress-head">
        <span>${t("Fortschritt", "Progress")}</span>
        <strong>${progress.done}/${progress.total} · ${percent}%</strong>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
    </div>
    <main class="fade-up">${content}${state.ui.toast ? `<div class="toast" role="status">${state.ui.toast}</div>` : ""}</main>
    <footer>
      <button class="ghost" data-nav="/checklist/first-apartment" style="font-size:14px;padding:8px 14px;">${t("Übersicht", "Overview")}</button>
      <button class="ghost" data-action="reset" style="font-size:14px;padding:8px 14px;color:var(--text-tertiary)">${t("Reset", "Reset")}</button>
    </footer>
  </div>`;
}

function nextTaskButton(label = "Nächster Schritt") {
  const next = getNextOpenTaskId();
  if (!next) return `<button class="primary" data-nav="/done">Zur Zusammenfassung →</button>`;
  return `<button class="secondary" data-nav="/task/${next}">${label}: ${taskById(next).title}</button>`;
}

function completionIssues(taskId) {
  if (taskId === "deposit") {
    return getDepositIssues();
  }
  if (taskId === "lease" && !state.documents.leaseUploaded) return ["Mietvertrag fehlt"];
  if (taskId === "documents") {
    const issues = [];
    if (!state.documents.leaseUploaded) issues.push("Mietvertrag fehlt");
    if (!state.documents.depositConfirmationUploaded) issues.push("Kautionsbestätigung fehlt");
    return issues;
  }
  if (taskId === "standing-order") {
    if (!state.standingOrders.items.length) return ["Mindestens ein Dauerauftrag fehlt"];
    return state.standingOrders.items.flatMap((item, i) => isStandingOrderItemComplete(item) ? [] : [`Dauerauftrag ${i + 1} unvollständig oder nicht bestätigt`]);
  }
  if (taskId === "insurance") return isInsuranceComplete() ? [] : ["Vergleichsdatum, Prioritätskriterium und eine Empfehlung fehlen"];
  return [];
}

function screenHome() {
  return layout("firsthome by UBS", `
    <div class="card-hero stack" style="margin-top:8px;">
      <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(145deg,#e0091b,#b90414);display:grid;place-items:center;font-size:24px;">🏠</div>
      <div>
        <h2 style="margin-bottom:6px;">Willkommen bei firsthome</h2>
        <p class="subtext">Dein persönlicher Begleiter für den Einzug in die erste eigene Wohnung – von UBS.</p>
      </div>
    </div>
    <div class="tile" data-nav="/onboarding/first-apartment">
      <div class="split" style="margin-bottom:10px;">
        <span style="font-size:26px;">🏠</span>
        <span class="badge badge-open">Jetzt starten</span>
      </div>
      <h3 style="margin-bottom:6px;">Erste eigene Wohnung</h3>
      <p class="subtext">Kaution, Budget, Zahlungen, Versicherungen und Dokumente – alles in einem geführten Ablauf.</p>
      <button class="primary" data-nav="/onboarding/first-apartment" style="margin-top:10px;">Prozess starten</button>
    </div>
  `, { showBack: false });
}

function screenOnboarding() {
  const steps = [
    { num: "1", title: "Vorbereitung", desc: "Mietvertrag & Kaution organisieren." },
    { num: "2", title: "Struktur", desc: "Budget planen und Daueraufträge einrichten." },
    { num: "3", title: "Absicherung", desc: "Versicherungen vergleichen und Dokumente ablegen." }
  ];
  const nextTask = getNextOpenTaskId() || "lease";
  return layout("Los geht's", `
    <div class="card-hero stack">
      <h2>Bereit für dein neues Zuhause?</h2>
      <p class="subtext">Wir führen dich Schritt für Schritt durch alles Wichtige – ohne Fachjargon, ohne unnötige Komplexität.</p>
      <div class="quick-start-panel">
        <p class="caption">Schnellstart</p>
        <button class="primary primary-red" data-nav="/task/${nextTask}" style="width:100%;">Prozess jetzt starten →</button>
        <p class="subtext" style="font-size:13px;">Du landest direkt beim nächsten offenen Schritt statt lange zu klicken.</p>
      </div>
    </div>
    <div class="card stack">
      <h4 style="margin-bottom:4px;">In 3 Phasen zum Ziel</h4>
      ${steps.map((s) => `
        <div class="journey-step interactive-step">
          <div class="journey-step-num">${s.num}</div>
          <div>
            <p style="font-weight:600;margin-bottom:2px;">${s.title}</p>
            <p class="subtext" style="margin:0;">${s.desc}</p>
          </div>
        </div>`).join("")}
      <button class="primary" data-nav="/task/${nextTask}" style="margin-top:4px;">Jetzt starten</button>
      <button class="secondary" data-nav="/checklist/first-apartment">Alle Schritte ansehen</button>
    </div>
  `);
}

function screenChecklist() {
  const progress = calculateProgress(state.tasks);
  const next = getNextOpenTaskId();
  const percent = Math.round((progress.done / progress.total) * 100);
  const icons = { lease: "📄", deposit: "💰", budget: "📊", "standing-order": "🔄", insurance: "🛡️", documents: "📁" };
  const rows = state.tasks.map((t, idx) => `
    <div class="card" style="cursor:pointer;" data-nav="/task/${t.id}">
      <div class="task-row">
        <div class="inline" style="gap:14px;flex:1;">
          <div class="task-icon ${t.status === "done" ? "task-icon-done" : "task-icon-open"}">${t.status === "done" ? "✓" : (icons[t.id] || (idx + 1))}</div>
          <div>
            <p class="task-title">${t.title}</p>
            <p class="subtext" style="margin:2px 0 0;">${t.description}</p>
          </div>
        </div>
        <span class="badge ${t.status === "done" ? "badge-done" : "badge-open"}">${t.status === "done" ? "Erledigt" : "Offen"}</span>
      </div>
    </div>`).join("");
  return layout("Übersicht", `
    <div class="card stack">
      <div class="split">
        <div>
          <h2 style="margin-bottom:4px;">Dein Fortschritt</h2>
          <p class="subtext">${progress.done} von ${progress.total} Schritten erledigt</p>
        </div>
        <span style="font-size:28px;font-weight:700;letter-spacing:-1px;color:var(--blue)">${percent}%</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
      ${next
        ? `<button class="primary" data-nav="/task/${next}">Weiter: ${taskById(next).title}</button>`
        : `<button class="primary" data-nav="/done">Zur Zusammenfassung 🎉</button>`}
    </div>
    ${rows}
    <a href="#/education" style="display:block;text-align:center;padding:12px;color:var(--text-secondary);font-size:14px;">📚 Wohnen verstehen</a>
  `, { showBack: false });
}

function taskCanBeDone(taskId) {
  if (taskId === "deposit") return canCompleteDeposit(state.deposit);
  if (taskId === "lease") return state.documents.leaseUploaded;
  if (taskId === "documents") return state.documents.leaseUploaded && state.documents.depositConfirmationUploaded;
  if (taskId === "standing-order") return isStandingOrderComplete();
  if (taskId === "insurance") return isInsuranceComplete();
  if (taskId === "budget") return Number(calculateBudgetTotal(state.budget).monthlyTotal) > 0;
  return true;
}

function taskHints(taskId) {
  return completionIssues(taskId).join(" · ");
}

function screenTask(taskId) {
  const task = taskById(taskId);
  if (!task) return layout("Schritt", `<div class="card"><p class="subtext">Schritt nicht gefunden.</p></div>`);
  const canDone = taskCanBeDone(taskId);
  const issues = completionIssues(taskId);
  const taskIndex = state.tasks.findIndex((t) => t.id === taskId);
  const stepIndicator = `<p class="caption" style="text-align:center;letter-spacing:0.3px;margin-bottom:-4px;">SCHRITT ${taskIndex + 1} VON ${state.tasks.length}</p>`;
  return layout(task.title, `
    <div class="card-hero stack">
      ${stepIndicator}
      <h2>${task.title}</h2>
      <p class="subtext">${task.description}</p>
      ${task.educationTopics.slice(0, 2).map((topic) =>
        `<a href="#/education?topic=${topic}" class="learn-link">📖 Mehr erfahren: ${topic}</a>`
      ).join("")}
    </div>
    <div class="card stack">
      ${taskSubAction(task)}
      <button class="primary" data-action="toggle-task" data-task-id="${task.id}" ${canDone ? "" : "disabled"}>
        Schritt abschliessen
      </button>
      ${!canDone && issues.length ? `
        <div style="padding:14px;background:var(--warning-soft);border-radius:var(--radius-md);">
          <p style="font-size:13px;font-weight:600;color:#8a5500;margin-bottom:6px;">Noch offen:</p>
          ${issues.map((i) => `<p class="subtext" style="font-size:13px;margin:2px 0;">• ${i}</p>`).join("")}
        </div>` : ""}
      ${canDone ? nextTaskButton() : ""}
      <button class="ghost" data-action="skip-task" data-task-id="${task.id}" style="font-size:14px;color:var(--text-tertiary);">Überspringen</button>
    </div>
  `);
}

function screenEducation(query) {
  const focus = query.get("topic");
  const articles = [
    { id: "kaution", icon: "💰", title: "Kaution", text: "Die Kaution beträgt meist bis zu drei Nettokaltmieten. Immer Quittung sichern und als Nachweis ablegen." },
    { id: "nebenkosten", icon: "📊", title: "Nebenkosten", text: "Plane zusätzlich zur Miete: Heizung, Wasser, Müll, Internet, Strom und eine Rücklage. Eine realistische Reserve reduziert Stress." },
    { id: "versicherungen", icon: "🛡️", title: "Versicherungen", text: "Vergleiche Preis, Selbstbehalt und Deckung. Entscheide nicht nur nach dem günstigsten Preis – passe es deiner Lebenssituation an." },
    { id: "wg-kaution", icon: "🤝", title: "WG & Kaution", text: "In WGs: Aufteilung schriftlich dokumentieren – wer zahlt wie viel, und wie die Rückzahlung beim Auszug geregelt wird." }
  ];
  return layout("Wohnen verstehen", `
    <div class="card-hero">
      <h2>Wohnen verstehen</h2>
      <p class="subtext" style="margin-top:6px;">Kurze Erklärungen zu den wichtigsten Themen rund um deine erste Wohnung.</p>
    </div>
    ${articles.map((a) => `
      <div class="card stack" id="${a.id}" style="${focus === a.id ? "border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-soft);" : ""}">
        <div class="inline"><span style="font-size:22px;">${a.icon}</span><h3>${a.title}</h3></div>
        <p class="subtext">${a.text}</p>
      </div>`).join("")}
    <a href="#/checklist/first-apartment" style="display:block;text-align:center;padding:12px;font-size:14px;">← Zurück zur Übersicht</a>
  `);
}

function screenDeposit() {
  const signed = state.deposit.roommates.filter((r) => r.status === "signed").length;
  const total = state.deposit.roommates.length;
  const amount = Number(state.deposit.amount || 0);
  const allSigned = signed === total && total > 0;
  return layout("Kaution", `
    <div class="card-hero stack">
      <div class="split">
        <div>
          <h2>Kaution organisieren</h2>
          <p class="subtext">Betrag festlegen und alle Personen digital unterschreiben lassen.</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:28px;font-weight:700;color:var(--blue)">${amount > 0 ? `${amount} €` : "—"}</div>
          <p class="caption">${state.deposit.amountConfirmed ? "✓ bestätigt" : "unbestätigt"}</p>
        </div>
      </div>
    </div>
    <div class="card stack">
      <h3>Kautionsbetrag</h3>
      <label>Betrag in €
        <input type="number" min="0" id="deposit-amount" value="${amount}" placeholder="z.B. 2550" />
      </label>
      <div class="inline">
        <button class="secondary" data-action="save-deposit-amount">Speichern</button>
        <button class="${state.deposit.amountConfirmed ? "ghost" : "primary"}" data-action="confirm-amount" ${amount <= 0 ? "disabled" : ""}>
          ${state.deposit.amountConfirmed ? "✓ Betrag bestätigt" : "Betrag bestätigen"}
        </button>
      </div>
    </div>
    <div class="card stack">
      <div class="split">
        <h3>Unterschriften</h3>
        <span class="badge ${allSigned ? "badge-done" : "badge-warning"}">${signed}/${total} unterschrieben</span>
      </div>
      <button class="secondary" data-nav="/deposit/invite">Mitbewohner verwalten →</button>
      ${allSigned ? `<div class="completion-note">✅ Alle haben unterschrieben. Du kannst jetzt in den echten Prozess zurück und den Schritt direkt abschliessen.</div>` : ""}
      <button class="primary" data-action="toggle-task" data-task-id="deposit" ${canCompleteDeposit(state.deposit) ? "" : "disabled"}>
        Kaution abschliessen
      </button>
    </div>
  `);
}

function screenInvite() {
  const signed = state.deposit.roommates.filter((r) => r.status === "signed").length;
  const items = state.deposit.roommates.map((r, idx) => `
    <div class="card stack" style="border-color:${r.status === "signed" ? "var(--green)" : "var(--border)"};">
      <div class="split">
        <div>
          <p class="task-title">${r.name}</p>
          <span class="badge ${r.status === "signed" ? "badge-done" : "badge-open"}">${r.status === "signed" ? "✓ Unterschrieben" : "Ausstehend"}</span>
        </div>
        <button class="ghost" data-action="remove-roommate" data-index="${idx}" style="font-size:13px;padding:6px 10px;">Entfernen</button>
      </div>
      <div class="inline">
        <label style="flex:1;">E-Mail
          <input id="roommate-email-${idx}" type="email" value="${r.email}" placeholder="name@mail.com" />
        </label>
        <label style="flex:1;">Telefon
          <input id="roommate-phone-${idx}" value="${r.phone}" placeholder="+41 ..." />
        </label>
      </div>
      <button class="secondary" data-action="save-roommate-contact" data-index="${idx}" style="align-self:flex-start;">Kontakt speichern</button>
      <div>
        <p class="caption" style="margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px;">QES-Signatur (mit Maus unterschreiben)</p>
        <canvas class="signature-pad" data-signature-pad="${idx}"></canvas>
      </div>
      <div class="inline">
        <button class="ghost" data-action="clear-signature" data-index="${idx}" style="font-size:13px;">Löschen</button>
        <button class="${r.status === "signed" ? "ghost" : "primary"}" data-action="sign" data-index="${idx}" ${r.status === "signed" ? "disabled" : ""}>
          ${r.status === "signed" ? "✓ Unterschrieben" : "Digital unterschreiben"}
        </button>
      </div>
    </div>`).join("");
  return layout("Mitbewohner", `
    <div class="card stack">
      <div class="split">
        <h2>Mitbewohner</h2>
        <span class="badge badge-${signed === state.deposit.roommates.length && state.deposit.roommates.length > 0 ? "done" : "warning"}">${signed}/${state.deposit.roommates.length} signiert</span>
      </div>
      <div class="inline">
        <input id="roommate-name" placeholder="Name eingeben" style="flex:1;" aria-label="Name eingeben" />
        <button class="secondary" data-action="add-roommate">+ Hinzufügen</button>
      </div>
    </div>
    ${items || `<div class="card"><p class="subtext" style="text-align:center;padding:8px;">Noch keine Personen erfasst.</p></div>`}
    ${signed === state.deposit.roommates.length && state.deposit.roommates.length > 0 ? `<div class="card completion-note"><strong>Alle Unterschriften sind da.</strong><p class="subtext" style="margin-top:4px;">Zurück zum Kautions-Schritt und dann wieder in den Hauptprozess wechseln.</p></div>` : ""}
    <button class="secondary" data-nav="/deposit" style="align-self:flex-start;">← Zur Kaution</button>
  `);
}

function numberInput(id, value, label) { return `<label>${label}<input type="number" id="${id}" value="${value}" min="0" /></label>`; }
function itemRows(items, type) {
  return items.map((item, idx) =>
    `<div class="inline item-row">
       <input data-item-label="${type}-${idx}" value="${item.label}" placeholder="Bezeichnung" style="font-size:15px;" aria-label="Bezeichnung ${idx + 1}" />
       <input type="number" min="0" data-item-amount="${type}-${idx}" value="${item.amount}" style="font-size:15px;" aria-label="Betrag ${idx + 1}" />
       <button class="ghost" data-action="remove-item" data-type="${type}" data-index="${idx}" style="font-size:13px;padding:8px 12px;">✕</button>
     </div>`
  ).join("");
}

function screenBudget() {
  const totals = calculateBudgetTotal(state.budget);
  const max = Math.max(totals.monthlyTotal, totals.oneTimeTotal, 1);
  const categories = [
    { id: "rent", label: "Miete", value: state.budget.rent },
    { id: "internet", label: "Internet", value: state.budget.internet },
    { id: "power", label: "Strom", value: state.budget.power },
    { id: "insurance", label: "Versicherungen", value: state.budget.insurance },
    { id: "transport", label: "Mobilität", value: state.budget.transport },
    { id: "groceries", label: "Lebensmittel", value: state.budget.groceries }
  ];
  return layout("Budget", `
    <div class="card-hero">
      <div class="summary-grid">
        <div class="summary-card"><p class="label">Monatlich</p><p class="value">${totals.monthlyTotal} €</p></div>
        <div class="summary-card"><p class="label">Einmalig</p><p class="value">${totals.oneTimeTotal} €</p></div>
      </div>
    </div>
    <div class="card stack">
      <h3>Monatliche Kosten</h3>
      ${categories.map((c) => `<label>${c.label}<input type="number" id="${c.id}" value="${c.value}" min="0" /></label>`).join("")}
      <h3 style="margin-top:4px;">Eigene Posten</h3>
      ${itemRows(state.budget.customItems, "custom") || `<p class="subtext">Noch keine eigenen Posten.</p>`}
      <button class="secondary" data-action="add-item" data-type="custom" style="align-self:flex-start;">+ Posten hinzufügen</button>
      <h3 style="margin-top:4px;">Einmalige Kosten</h3>
      ${itemRows(state.budget.oneTimeItems, "oneTime") || `<p class="subtext">Noch keine einmaligen Kosten.</p>`}
      <button class="secondary" data-action="add-item" data-type="oneTime" style="align-self:flex-start;">+ Einmalkosten</button>
    </div>
    <div class="card stack">
      <h3>Übersicht</h3>
      <div class="budget-chart">
        <div class="budget-bar-row"><span class="budget-bar-label">Monatlich</span><div class="budget-bar-track"><div class="budget-bar-fill" style="width:${Math.round((totals.monthlyTotal / max) * 100)}%"></div></div><span class="budget-bar-value">${totals.monthlyTotal} €</span></div>
        <div class="budget-bar-row"><span class="budget-bar-label">Einmalig</span><div class="budget-bar-track"><div class="budget-bar-fill" style="width:${Math.round((totals.oneTimeTotal / max) * 100)}%"></div></div><span class="budget-bar-value">${totals.oneTimeTotal} €</span></div>
      </div>
      <button class="primary" data-action="save-budget">Budget speichern</button>
      <a href="#/education?topic=nebenkosten" style="font-size:14px;">📖 Mehr zu Nebenkosten</a>
    </div>
  `);
}

function screenStandingOrder() {
  const d = state.standingOrders.draft;
  const items = state.standingOrders.items.map((item, idx) =>
    `<div class="card stack" style="border-color:${item.confirmed ? "var(--green)" : "var(--border)"};">
       <div class="split">
         <div>
           <p style="font-weight:600;">${item.recipient}</p>
           <p class="subtext">${item.monthlyAmount} € · Tag ${item.executionDay} · ${item.purpose}</p>
         </div>
         <div class="inline">
           <span class="badge ${item.confirmed ? "badge-done" : "badge-warning"}">${item.confirmed ? "Bestätigt" : "Offen"}</span>
           <button class="ghost" data-action="delete-standing-order" data-id="${item.id}" style="font-size:12px;padding:5px 8px;">✕</button>
         </div>
       </div>
     </div>`
  ).join("");
  return layout("Daueraufträge", `
    <div class="card-hero stack">
      <h2>Dauerauftrag einrichten</h2>
      <p class="subtext">Erfasse einen oder mehrere wiederkehrende Zahlungen.</p>
    </div>
    <div class="card stack">
      <div class="inline">
        <label style="flex:1;">Betrag (€)<input type="number" id="so-amount" value="${d.monthlyAmount || ""}" placeholder="850" /></label>
        <label style="flex:1;">Ausführungstag (1–28)<input type="number" min="1" max="28" id="so-day" value="${d.executionDay || 1}" /></label>
      </div>
      <label>Empfänger<input id="so-recipient" value="${d.recipient}" placeholder="z.B. Vermietung Muster AG" /></label>
      <label>IBAN<input id="so-iban" value="${d.iban}" placeholder="CH93 ..." /></label>
      <div class="inline">
        <label style="flex:1;">Startdatum<input type="date" id="so-start" value="${d.startDate}" /></label>
        <label style="flex:1;">Zweck<input id="so-purpose" value="${d.purpose}" placeholder="Miete" /></label>
      </div>
      <div class="inline">
        <button class="secondary" data-action="save-standing-order">Entwurf speichern</button>
        <button class="primary" data-action="confirm-standing-order" ${isStandingOrderDraftReady(d) ? "" : "disabled"}>Bestätigen</button>
      </div>
      <button class="secondary" data-action="add-standing-order" ${isStandingOrderItemComplete(d) ? "" : "disabled"}>+ Manuell weiteren Dauerauftrag erfassen</button>
      <button class="ghost" data-action="skip-task" data-task-id="standing-order" style="font-size:14px;color:var(--text-tertiary);">Schritt überspringen</button>
    </div>
    ${items ? `<div class="stack">${items}</div>` : ""}
    ${state.standingOrders.items.length
      ? `<div class="card"><button class="primary" data-action="toggle-task" data-task-id="standing-order">Schritt abschliessen</button></div>`
      : `<div class="card"><p class="subtext" style="text-align:center;padding:8px;">Noch keine Daueraufträge erfasst.</p></div>`}
  `);
}

function insuranceScore(option, priorityCriterion) {
  const profiles = {
    balanced: { coverage: 100, premium: 1, deductible: 0.4 },
    lowPremium: { coverage: 70, premium: 1.5, deductible: 0.3 },
    lowDeductible: { coverage: 80, premium: 1, deductible: 1.1 },
    highCoverage: { coverage: 150, premium: 0.8, deductible: 0.4 }
  };
  const profile = profiles[priorityCriterion] || profiles.balanced;
  return (Number(option.coverage) * profile.coverage) - (Number(option.annualPremium) * profile.premium) - (Number(option.deductible) * profile.deductible);
}

function screenInsurance() {
  const options = state.insurance.options.map((o, idx) => `
    <div class="insurance-card ${o.selected ? "selected" : ""}">
      <div class="split" style="margin-bottom:14px;">
        <div>
          <p style="font-weight:600;font-size:16px;margin-bottom:4px;">${o.title}</p>
          <p class="subtext" style="font-size:13px;">${o.note}</p>
        </div>
        <button class="select-chip ${o.selected ? "selected" : ""}" data-action="toggle-insurance" data-index="${idx}">
          <span class="check-indicator">${o.selected ? "✓" : ""}</span>
          Vergleichen
        </button>
      </div>
      <div class="inline" style="gap:8px;">
        ${numberInput(`ins-prem-${idx}`, o.annualPremium, "Prämie/Jahr (€)")}
        ${numberInput(`ins-ded-${idx}`, o.deductible, "Selbstbehalt (€)")}
        ${numberInput(`ins-cov-${idx}`, o.coverage, "Deckung (1–5)")}
      </div>
    </div>`).join("");
  const selected = state.insurance.options.filter((o) => o.selected);
  const best = [...selected].sort((a, b) => insuranceScore(b, state.insurance.priorityCriterion) - insuranceScore(a, state.insurance.priorityCriterion))[0];
  const worst = [...selected].sort((a, b) => insuranceScore(a, state.insurance.priorityCriterion) - insuranceScore(b, state.insurance.priorityCriterion))[0];
  const savings = best && worst ? Math.max(0, Number(worst.annualPremium) - Number(best.annualPremium)) : 0;
  return layout("Versicherungen", `
    <div class="card-hero stack">
      <h2>Versicherungen vergleichen</h2>
      <p class="subtext">Wähle dein wichtigstes Kriterium – wir berechnen die beste Option für dich.</p>
    </div>
    <div class="card stack">
      <div class="inline">
        <label style="flex:1;">Vergleich bis<input type="date" id="insurance-compare" value="${state.insurance.compareBy}" /></label>
        <label style="flex:1;">Kriterium
          <select id="insurance-priority">
            <option value="">Auswählen</option>
            <option value="balanced" ${state.insurance.priorityCriterion === "balanced" ? "selected" : ""}>Ausgewogen</option>
            <option value="lowPremium" ${state.insurance.priorityCriterion === "lowPremium" ? "selected" : ""}>Niedrige Prämie</option>
            <option value="lowDeductible" ${state.insurance.priorityCriterion === "lowDeductible" ? "selected" : ""}>Niedriger Selbstbehalt</option>
            <option value="highCoverage" ${state.insurance.priorityCriterion === "highCoverage" ? "selected" : ""}>Hohe Deckung</option>
          </select>
        </label>
      </div>
      <button class="primary" data-action="save-insurance">Vergleich auswerten</button>
      ${state.insurance.recommendation ? `
        <div style="padding:16px;background:var(--green-soft);border-radius:var(--radius-md);border:1px solid rgba(52,199,89,0.25);">
          <p style="font-weight:600;color:#1a7a38;margin-bottom:4px;">Empfehlung</p>
          <p class="subtext">${state.insurance.recommendation}${savings ? ` · Potenzielle Ersparnis: <strong>${savings} €/Jahr</strong>` : ""}</p>
          <a href="https://scheinversicherung.example.com" target="_blank" rel="noreferrer" class="learn-link">Zur Partnerfirma für Abschluss ↗</a>
        </div>` : ""}
      <button class="ghost" data-action="skip-task" data-task-id="insurance" style="font-size:14px;color:var(--text-tertiary);">Überspringen</button>
    </div>
    <div class="stack">${options}</div>
    <div class="card"><button class="primary" data-action="toggle-task" data-task-id="insurance" ${isInsuranceComplete() ? "" : "disabled"}>Schritt abschliessen</button></div>
  `);
}

function screenDocuments() {
  const uploadCard = (title, key, isUploaded) => `
    <div class="card stack">
      <div class="split">
        <div>
          <p style="font-weight:600;">${title}</p>
          <span class="badge ${isUploaded ? "badge-done" : "badge-open"}">${isUploaded ? "✓ Hochgeladen" : "Noch offen"}</span>
        </div>
        <label style="cursor:pointer;">
          <div class="file-upload-zone ${isUploaded ? "upload-done" : ""}" style="padding:12px 20px;border-radius:var(--radius-md);">
            <p style="font-size:14px;font-weight:500;color:${isUploaded ? "#1a7a38" : "var(--blue)"};">${isUploaded ? "Erneut hochladen" : "Datei wählen"}</p>
            <input type="file" data-action="file-upload" data-doc="${key}" style="position:absolute;opacity:0;width:0;height:0;" />
          </div>
        </label>
      </div>
    </div>`;
  const history = state.documents.uploads.map((u) =>
    `<div class="inline" style="padding:8px 0;border-bottom:1px solid var(--border);">
       <span style="font-size:20px;">${u.type === "Mietvertrag" ? "📄" : "💰"}</span>
       <div style="flex:1;">
         <p style="font-size:14px;font-weight:500;">${u.name}</p>
         <p class="caption">${u.type} · ${u.sizeKb} KB · ${u.date}</p>
       </div>
     </div>`
  ).join("");
  return layout("Dokumente", `
    <div class="card-hero stack">
      <h2>Wichtige Dokumente</h2>
      <p class="subtext">Lade Mietvertrag und Kautionsbestätigung hoch, um diesen Schritt abzuschliessen.</p>
    </div>
    ${uploadCard("Mietvertrag", "lease", state.documents.leaseUploaded)}
    ${uploadCard("Kautionsbestätigung", "depositConfirmation", state.documents.depositConfirmationUploaded)}
    ${state.documents.uploads.length ? `<div class="card stack"><h4>Upload-Verlauf</h4>${history}</div>` : ""}
    <div class="card">
      <button class="primary" data-action="toggle-task" data-task-id="documents" ${(state.documents.leaseUploaded && state.documents.depositConfirmationUploaded) ? "" : "disabled"}>
        Dokumente abschliessen
      </button>
    </div>
  `);
}

function screenDone() {
  const totals = calculateBudgetTotal(state.budget);
  const completed = state.tasks.filter((t) => t.status === "done");
  const roommates = state.deposit.roommates.map((r) =>
    `<div class="inline" style="padding:8px 0;border-bottom:1px solid var(--border);">
       <span>${r.status === "signed" ? "✅" : "⏳"}</span>
       <div style="flex:1;"><p style="font-size:14px;font-weight:500;">${r.name}</p><p class="caption">${r.email || "Keine E-Mail"} · ${r.phone || "Kein Telefon"}</p></div>
       <span class="badge ${r.status === "signed" ? "badge-done" : "badge-open"}">${r.status === "signed" ? "Signiert" : "Offen"}</span>
     </div>`
  ).join("");
  const orders = state.standingOrders.items.map((s, idx) =>
    `<div class="inline" style="padding:8px 0;border-bottom:1px solid var(--border);">
       <span>🔄</span>
       <div style="flex:1;"><p style="font-size:14px;font-weight:500;">#${idx + 1} ${s.recipient}</p><p class="caption">${s.monthlyAmount} € · Tag ${s.executionDay} · ${s.purpose}</p></div>
     </div>`
  ).join("");
  const totalPeople = Math.max(1, state.deposit.roommates.length);
  const perPerson = Math.round((Number(state.deposit.amount) || 0) / totalPeople);
  const rentPerPerson = Math.round((Number(state.budget.rent) || 0) / totalPeople);
  const maxShare = Math.max(perPerson, rentPerPerson, 1);
  const shareBars = state.deposit.roommates.map((roommate) => `
    <div class="share-row">
      <div class="share-head"><strong>${roommate.name}</strong><span>${perPerson} € Kaution · ${rentPerPerson} € Miete</span></div>
      <div class="share-chart-track">
        <div class="share-chart-fill" style="width:${Math.round((perPerson / maxShare) * 100)}%"></div>
      </div>
    </div>
  `).join("");

  return layout("Zusammenfassung", `
    <div class="card-hero stack" style="background:linear-gradient(145deg,#f0fff4,#ffffff);border-color:rgba(52,199,89,0.2);">
      <div style="font-size:40px;">🎉</div><h2>Alles erledigt!</h2><p class="subtext">Hier ist deine vollständige Zusammenfassung.</p>
    </div>
    <div class="card"><div class="summary-grid">
      <div class="summary-card"><p class="label">Kaution</p><p class="value">${state.deposit.amount} €</p></div>
      <div class="summary-card"><p class="label">Monatlich</p><p class="value">${totals.monthlyTotal} €</p></div>
      <div class="summary-card"><p class="label">Einmalig</p><p class="value">${totals.oneTimeTotal} €</p></div>
      <div class="summary-card"><p class="label">Versicherung</p><p class="value" style="font-size:14px;line-height:1.3;">${state.insurance.recommendation || "Keine Empfehlung"}</p></div>
    </div></div>
    ${state.deposit.roommates.length ? `<div class="card stack"><h3>Wer zahlt wie viel?</h3><p class="subtext">Responsive Aufteilung pro Person (vereinfacht gleichmässig verteilt).</p>${shareBars}</div>` : ""}
    ${state.deposit.roommates.length ? `<div class="card stack"><h3>Personen</h3>${roommates}</div>` : ""}
    ${state.standingOrders.items.length ? `<div class="card stack"><h3>Daueraufträge</h3>${orders}</div>` : ""}
    <div class="card stack"><h3>Dokumente</h3><div class="inline"><span>${state.documents.leaseUploaded ? "✅" : "⭕"}</span><span style="font-size:15px;">Mietvertrag</span></div><div class="inline"><span>${state.documents.depositConfirmationUploaded ? "✅" : "⭕"}</span><span style="font-size:15px;">Kautionsbestätigung</span></div></div>
    <div class="card stack">
      <h3>Status</h3>
      ${state.tasks.map((task) => `<div class="split"><span style="font-size:15px;">${task.title}</span><span class="status-${task.status}">${task.status === "done" ? "Erledigt" : "Offen"}</span></div>`).join("")}
      <p class="caption">${completed.length}/${state.tasks.length} Schritte abgeschlossen</p>
      <div class="inline">
        <button class="secondary" data-nav="/checklist/first-apartment">Zur Übersicht</button>
        <button class="primary" data-nav="/home">Neu starten</button>
      </div>
    </div>
  `, { showBack: false });
}

function applyLanguageToDom() {
  const lang = getLanguage();
  document.documentElement.lang = lang;
  document.title = lang === "en" ? "FirstHome by UBS" : "FirstHome by UBS";
  if (lang !== "en") return;

  const replacements = [
    ["Willkommen bei firsthome", "Welcome to FirstHome"],
    ["Dein persönlicher Begleiter für den Einzug in die erste eigene Wohnung – von UBS.", "Your personal guide for moving into your first apartment – by UBS."],
    ["Jetzt starten", "Start now"],
    ["Erste eigene Wohnung", "First apartment"],
    ["Kaution organisieren", "Organize deposit"],
    ["Mietvertrag hochladen", "Upload lease contract"],
    ["Budget planen", "Plan budget"],
    ["Daueraufträge einrichten", "Set up standing orders"],
    ["Versicherungen prüfen", "Review insurances"],
    ["Dokumente speichern", "Store documents"],
    ["Los geht's", "Let's get started"],
    ["Bereit für dein neues Zuhause?", "Ready for your new home?"],
    ["In 3 Phasen zum Ziel", "Reach your goal in 3 phases"],
    ["Vorbereitung", "Preparation"],
    ["Struktur", "Structure"],
    ["Absicherung", "Protection"],
    ["Dein Fortschritt", "Your progress"],
    ["Erledigt", "Done"],
    ["Offen", "Open"],
    ["Ausstehend", "Pending"],
    ["Mitbewohner", "Roommates"],
    ["Kautionsbetrag", "Deposit amount"],
    ["Betrag bestätigen", "Confirm amount"],
    ["Betrag in €", "Amount in €"],
    ["Speichern", "Save"],
    ["Unterschriften", "Signatures"],
    ["Mitbewohner verwalten", "Manage roommates"],
    ["Zurück zur Übersicht", "Back to overview"],
    ["Dokumente", "Documents"],
    ["Wichtige Dokumente", "Important documents"],
    ["Mietvertrag", "Lease contract"],
    ["Kautionsbestätigung", "Deposit confirmation"],
    ["Datei wählen", "Choose file"],
    ["Erneut hochladen", "Upload again"],
    ["Upload-Verlauf", "Upload history"],
    ["Dokumente abschliessen", "Complete documents"],
    ["Versicherungen", "Insurances"],
    ["Versicherungen vergleichen", "Compare insurances"],
    ["Vergleich auswerten", "Evaluate comparison"],
    ["Empfehlung", "Recommendation"],
    ["Überspringen", "Skip"],
    ["Schritt abschliessen", "Complete step"],
    ["Zusammenfassung", "Summary"],
    ["Alles erledigt!", "Everything done!"],
    ["Zur Übersicht", "Back to overview"],
    ["Monatlich", "Monthly"],
    ["Einmalig", "One-time"],
    ["Fortschritt", "Progress"],
    ["Nächster Schritt", "Next step"],
    ["Weiter", "Continue"],
    ["Kontaktdaten gespeichert", "Contact details saved"],
    ["Schritt erledigt", "Step completed"],
    ["Schritt übersprungen", "Step skipped"],
    ["Dokument erfolgreich hochgeladen", "Document uploaded successfully"],
    ["Reset", "Reset"]
  ];

  const replaceText = (input) => replacements.reduce((acc, [de, en]) => acc.split(de).join(en), input);

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => {
    node.textContent = replaceText(node.textContent || "");
  });

  document.querySelectorAll("input[placeholder], button[aria-label]").forEach((el) => {
    if (el instanceof HTMLInputElement && el.placeholder) el.placeholder = replaceText(el.placeholder);
    const label = el.getAttribute("aria-label");
    if (label) el.setAttribute("aria-label", replaceText(label));
  });
}

function render() {
  updateTaskFromRules();
  const r = route();
  let html;
  if (r.path === "/" || r.path === "/home") html = screenHome();
  else if (r.path === "/onboarding/first-apartment") html = screenOnboarding();
  else if (r.path === "/checklist/first-apartment") html = screenChecklist();
  else if (r.path === "/task/:taskId") html = screenTask(r.taskId);
  else if (r.path === "/education") html = screenEducation(r.query);
  else if (r.path === "/deposit") html = screenDeposit();
  else if (r.path === "/deposit/invite") html = screenInvite();
  else if (r.path === "/budget") html = screenBudget();
  else if (r.path === "/standing-order") html = screenStandingOrder();
  else if (r.path === "/insurance") html = screenInsurance();
  else if (r.path === "/documents") html = screenDocuments();
  else if (r.path === "/done") html = screenDone();
  else html = screenHome();
  app.innerHTML = html;
  initializeSignaturePads();
  applyLanguageToDom();
}

const signaturePadContext = new Map();

function initializeSignaturePads() {
  const pads = document.querySelectorAll("canvas[data-signature-pad]");
  pads.forEach((pad) => {
    const index = Number(pad.dataset.signaturePad);
    if (Number.isNaN(index)) return;

    const width = Math.max(280, Math.floor(pad.getBoundingClientRect().width));
    const height = 110;
    const dpr = window.devicePixelRatio || 1;
    pad.width = Math.floor(width * dpr);
    pad.height = Math.floor(height * dpr);
    const ctx = pad.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#172033";

    ctx.clearRect(0, 0, pad.width, pad.height);
    const existing = state.deposit.roommates[index]?.signatureDataUrl;
    if (existing) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0);
      image.src = existing;
    }

    const drawingState = { drawing: false, hasDrawn: Boolean(existing) };
    signaturePadContext.set(index, { pad, ctx, drawingState });

    pad.onpointerdown = (event) => {
      drawingState.drawing = true;
      const rect = pad.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(event.clientX - rect.left, event.clientY - rect.top);
    };

    pad.onpointermove = (event) => {
      if (!drawingState.drawing) return;
      const rect = pad.getBoundingClientRect();
      ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top);
      ctx.stroke();
      drawingState.hasDrawn = true;
    };

    pad.onpointerup = () => { drawingState.drawing = false; };
    pad.onpointerleave = () => { drawingState.drawing = false; };
  });
}

window.addEventListener("hashchange", () => render());

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const clickable = target.closest("[data-action], [data-nav], [data-back]");
  if (!(clickable instanceof HTMLElement)) return;
  const nav = clickable.dataset.nav;
  if (nav) return go(nav);
  if (clickable.dataset.back) return history.back();

  const action = clickable.dataset.action;
  if (!action) return;

  if (action === "toggle-task") {
    const id = clickable.dataset.taskId;
    if (!id || !taskCanBeDone(id)) return;
    markTask(id, true);
    saveState();
    const next = getNextOpenTaskId();
    setToast("Schritt erledigt");
    ensureCompletionNavigation();
    if (next) go(`/task/${next}`); else go("/done");
    return render();
  }

  if (action === "skip-task") {
    const id = clickable.dataset.taskId;
    if (!id) return;
    const next = getNextOpenTaskId(id);
    setToast("Schritt übersprungen");
    if (next) go(`/task/${next}`); else go("/checklist/first-apartment");
    return render();
  }

  if (action === "toggle-language") {
    return toggleLanguage();
  }

  if (action === "show-issues") {
    const taskId = clickable.dataset.taskId;
    const issues = completionIssues(taskId || "");
    return setToast(issues.length ? `Fehlt: ${issues.join(", ")}` : "Keine offenen Punkte.");
  }

  if (action === "save-deposit-amount") {
    const input = document.getElementById("deposit-amount");
    state.deposit.amount = Number(input?.value || 0);
    state.deposit.amountConfirmed = false;
    saveState();
    return setToast("Kautionsbetrag gespeichert");
  }

  if (action === "confirm-amount") {
    state.deposit.amountConfirmed = Number(state.deposit.amount) > 0;
    saveState();
    return setToast("Kautionsbetrag bestätigt");
  }

  if (action === "add-roommate") {
    const input = document.getElementById("roommate-name");
    const name = input?.value?.trim();
    if (!name) return;
    state.deposit.roommates.push({ name, email: "", phone: "", status: "open", signatureType: "none", signedAt: "", signatureDataUrl: "" });
    saveState();
    setToast(`${name} hinzugefügt`);
    return render();
  }

  if (action === "remove-roommate") {
    const index = Number(clickable.dataset.index);
    if (Number.isNaN(index)) return;
    const removed = state.deposit.roommates.splice(index, 1)?.[0];
    saveState();
    setToast(`${removed?.name || "Person"} entfernt`);
    return render();
  }

  if (action === "save-roommate-contact") {
    const index = Number(clickable.dataset.index);
    if (Number.isNaN(index) || !state.deposit.roommates[index]) return;
    const email = document.getElementById(`roommate-email-${index}`)?.value?.trim() || "";
    const phone = document.getElementById(`roommate-phone-${index}`)?.value?.trim() || "";
    state.deposit.roommates[index].email = email;
    state.deposit.roommates[index].phone = phone;
    saveState();
    return setToast("Kontaktdaten gespeichert");
  }

  if (action === "clear-signature") {
    const index = Number(clickable.dataset.index);
    const signaturePad = signaturePadContext.get(index);
    if (!signaturePad || !state.deposit.roommates[index]) return;
    signaturePad.ctx.clearRect(0, 0, signaturePad.pad.width, signaturePad.pad.height);
    signaturePad.drawingState.hasDrawn = false;
    state.deposit.roommates[index].status = "open";
    state.deposit.roommates[index].signatureType = "none";
    state.deposit.roommates[index].signedAt = "";
    state.deposit.roommates[index].signatureDataUrl = "";
    saveState();
    return setToast("Signatur gelöscht");
  }

  if (action === "sign") {
    const index = Number(clickable.dataset.index);
    if (Number.isNaN(index) || !state.deposit.roommates[index]) return;
    const email = document.getElementById(`roommate-email-${index}`)?.value?.trim() || "";
    const phone = document.getElementById(`roommate-phone-${index}`)?.value?.trim() || "";
    state.deposit.roommates[index].email = email;
    state.deposit.roommates[index].phone = phone;
    if (!roommateHasContactData(state.deposit.roommates[index])) return setToast("Bitte zuerst E-Mail und Telefon erfassen");
    const signaturePad = signaturePadContext.get(index);
    if (!signaturePad?.drawingState?.hasDrawn) return setToast("Bitte mit der Maus im Signaturfeld unterschreiben");
    state.deposit.roommates[index].status = "signed";
    state.deposit.roommates[index].signatureType = "qes";
    state.deposit.roommates[index].signedAt = new Date().toLocaleString("de-DE");
    state.deposit.roommates[index].signatureDataUrl = signaturePad.pad.toDataURL("image/png");
    saveState();
    setToast(`${state.deposit.roommates[index].name} hat digital per QES unterschrieben`);
    return render();
  }

  if (action === "add-item") {
    const type = clickable.dataset.type;
    const item = { id: String(Date.now()), label: "Neuer Punkt", amount: 0 };
    if (type === "custom") state.budget.customItems.push(item);
    if (type === "oneTime") state.budget.oneTimeItems.push(item);
    saveState();
    return render();
  }

  if (action === "remove-item") {
    const type = clickable.dataset.type;
    const index = Number(clickable.dataset.index);
    if (type === "custom") state.budget.customItems.splice(index, 1);
    if (type === "oneTime") state.budget.oneTimeItems.splice(index, 1);
    saveState();
    return render();
  }

  if (action === "save-budget") {
    ["rent", "internet", "power", "insurance", "transport", "groceries"].forEach((id) => {
      const input = document.getElementById(id);
      state.budget[id] = Number(input?.value || 0);
    });
    ["custom", "oneTime"].forEach((type) => {
      const source = type === "custom" ? state.budget.customItems : state.budget.oneTimeItems;
      source.forEach((item, idx) => {
        const labelInput = document.querySelector(`[data-item-label="${type}-${idx}"]`);
        const amountInput = document.querySelector(`[data-item-amount="${type}-${idx}"]`);
        item.label = labelInput?.value?.trim() || item.label;
        item.amount = Number(amountInput?.value || 0);
      });
    });
    markTask("budget", true);
    saveState();
    setToast("Budget gespeichert");
    return render();
  }

  if (action === "save-standing-order") {
    const d = state.standingOrders.draft;
    d.monthlyAmount = Number(document.getElementById("so-amount")?.value || 0);
    d.recipient = document.getElementById("so-recipient")?.value?.trim() || "";
    d.iban = document.getElementById("so-iban")?.value?.trim() || "";
    d.executionDay = Number(document.getElementById("so-day")?.value || 1);
    d.startDate = document.getElementById("so-start")?.value || "";
    d.purpose = document.getElementById("so-purpose")?.value || "Miete";
    d.confirmed = false;
    saveState();
    return setToast("Entwurf gespeichert");
  }

  if (action === "confirm-standing-order") {
    state.standingOrders.draft.confirmed = isStandingOrderDraftReady(state.standingOrders.draft);
    saveState();
    if (state.standingOrders.draft.confirmed) {
      state.standingOrders.items.push({ ...state.standingOrders.draft, id: String(Date.now()) });
      state.standingOrders.draft = { ...clone(defaultState.standingOrders.draft) };
      saveState();
      render();
      return setToast("Dauerauftrag bestätigt und erfasst");
    }
    return setToast("Bitte Entwurf zuerst vollständig ausfüllen");
  }

  if (action === "add-standing-order") {
    if (!isStandingOrderItemComplete(state.standingOrders.draft)) return;
    state.standingOrders.items.push({ ...state.standingOrders.draft, id: String(Date.now()) });
    state.standingOrders.draft = { ...clone(defaultState.standingOrders.draft) };
    saveState();
    setToast("Dauerauftrag erfasst");
    return render();
  }

  if (action === "delete-standing-order") {
    const id = clickable.dataset.id;
    state.standingOrders.items = state.standingOrders.items.filter((item) => item.id !== id);
    saveState();
    return setToast("Dauerauftrag entfernt");
  }

  if (action === "toggle-insurance") {
    const index = Number(clickable.dataset.index);
    if (Number.isNaN(index)) return;
    state.insurance.options[index].selected = !state.insurance.options[index].selected;
    saveState();
    return render();
  }

  if (action === "save-insurance") {
    state.insurance.compareBy = document.getElementById("insurance-compare")?.value || "";
    state.insurance.priorityCriterion = document.getElementById("insurance-priority")?.value || "";
    state.insurance.options.forEach((o, idx) => {
      o.annualPremium = Number(document.getElementById(`ins-prem-${idx}`)?.value || o.annualPremium);
      o.deductible = Number(document.getElementById(`ins-ded-${idx}`)?.value || o.deductible);
      o.coverage = Number(document.getElementById(`ins-cov-${idx}`)?.value || o.coverage);
    });
    const selected = state.insurance.options.filter((o) => o.selected);
    const criterionLabel = {
      balanced: "ausgewogene Entscheidung",
      lowPremium: "niedrige Jahresprämie",
      lowDeductible: "niedriger Selbstbehalt",
      highCoverage: "hohe Deckung"
    };
    if (selected.length && state.insurance.priorityCriterion) {
      const best = [...selected].sort((a, b) => insuranceScore(b, state.insurance.priorityCriterion) - insuranceScore(a, state.insurance.priorityCriterion))[0];
      state.insurance.recommendation = `${best.title} passt am besten zum Kriterium „${criterionLabel[state.insurance.priorityCriterion] || "ausgewogene Entscheidung"}“`;
    } else {
      state.insurance.recommendation = "";
    }
    saveState();
    return setToast("Versicherungsvergleich aktualisiert");
  }

  if (action === "reset") {
    if (confirm("Wirklich alle Daten zurücksetzen? Diese Aktion kann nicht rückgängig gemacht werden.")) {
      localStorage.removeItem(STORAGE_KEY);
      state = clone(defaultState);
      go("/");
      return render();
    }
    return;
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.action !== "file-upload") return;

  const doc = target.dataset.doc;
  const file = target.files?.[0];
  if (!file || !doc) return;
  const now = new Date().toLocaleDateString("de-DE");
  if (doc === "lease") state.documents.leaseUploaded = true;
  if (doc === "depositConfirmation") state.documents.depositConfirmationUploaded = true;
  state.documents.uploads.unshift({
    type: doc === "lease" ? "Mietvertrag" : "Kautionsbestätigung",
    name: file.name,
    sizeKb: Math.max(1, Math.round(file.size / 1024)),
    date: now
  });
  saveState();
  target.value = "";
  setToast("Dokument erfolgreich hochgeladen");
  render();
});

window.addEventListener("load", () => {
  if (!window.location.hash) go("/");
  render();
});
