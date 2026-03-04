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
      { name: "Anna", status: "open", signatureType: "none", signedAt: "" },
      { name: "Luca", status: "open", signatureType: "none", signedAt: "" }
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
  ui: { toast: "", lastError: "" }
};

const app = document.getElementById("app");
let state = loadState();

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function normalizeRoommate(r) {
  return { name: r.name || "Unbekannt", status: r.status || "open", signatureType: r.signatureType || "none", signedAt: r.signedAt || "" };
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

function getNextOpenTaskId() { return state.tasks.find((task) => task.status === "open")?.id; }

function layout(title, content, { showBack = true } = {}) {
  return `<div class="app-shell">
    <header>
      ${showBack ? '<button class="ghost" data-back="1">←</button>' : ""}
      <div class="brand"><div class="logo-mark">FH</div><h1>firsthome by UBS · ${title}</h1></div>
    </header>
    <main>${content}${state.ui.toast ? `<div class="toast">${state.ui.toast}</div>` : ""}</main>
    <footer>
      <button class="ghost" data-nav="/checklist/first-apartment">Zur Übersicht</button>
      <button class="ghost" data-action="reset">Reset</button>
    </footer>
  </div>`;
}

function nextTaskButton(label = "Zum nächsten Schritt") {
  const next = getNextOpenTaskId();
  if (!next) return '<button class="primary" data-nav="/done">Zur Zusammenfassung</button>';
  return `<button class="primary" data-nav="/task/${next}">${label}: ${taskById(next).title}</button>`;
}

function completionIssues(taskId) {
  if (taskId === "deposit") {
    const issues = [];
    if (!(Number(state.deposit.amount) > 0)) issues.push("Kautionsbetrag fehlt");
    if (!state.deposit.amountConfirmed) issues.push("Betrag nicht bestätigt");
    return issues;
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
  return layout("Home", `<div class="tile" data-nav="/onboarding/first-apartment"><h2>🏠 Erste eigene Wohnung</h2><p>Klare Schritte für Kaution, Budget, Zahlungen, Versicherungen und Dokumente.</p></div>`, { showBack: false });
}

function screenOnboarding() {
  return layout("Onboarding", `<div class="card stack"><h2>Willkommen bei firsthome by UBS</h2><p>Wir führen dich Schritt für Schritt durch den Einzug. Das Erlebnis ist als geführter Ablauf konzipiert – ohne Marketing-Sprache rund um "Reise".</p><div class="journey-step"><strong>1. Start:</strong> Mietvertrag & Kaution vorbereiten.</div><div class="journey-step"><strong>2. Struktur:</strong> Budget und Daueraufträge festlegen.</div><div class="journey-step"><strong>3. Sicherheit:</strong> Versicherungen vergleichen und Dokumente finalisieren.</div><button class="primary" data-nav="/task/lease">Jetzt starten</button><button class="secondary" data-nav="/checklist/first-apartment">Alle Schritte ansehen</button></div>`);
}

function screenChecklist() {
  const progress = calculateProgress(state.tasks);
  const next = getNextOpenTaskId();
  const percent = Math.round((progress.done / progress.total) * 100);
  const rows = state.tasks.map((t, idx) => `<div class="card task-row"><div><p class="task-title">${t.status === "done" ? "✓" : `${idx + 1}.`} ${t.title}</p><p class="subtext">${t.description}</p></div><div class="stack"><span class="${t.status === "done" ? "status-done" : "status-open"}">${t.status === "done" ? "Erledigt" : "Offen"}</span><button class="secondary" data-nav="/task/${t.id}">Öffnen</button></div></div>`).join("");
  return layout("Ablaufübersicht", `<div class="card stack"><strong>Fortschritt: ${progress.done}/${progress.total} (${percent}%)</strong><div class="progress"><span style="width:${percent}%"></span></div><p class="subtext">Nächster Schritt: ${next ? taskById(next).title : "Alles fertig"}</p>${next ? `<button class="primary" data-nav="/task/${next}">Weiter</button>` : '<button class="primary" data-nav="/done">Zur Zusammenfassung</button>'}</div>${rows}<button class="ghost" data-nav="/education">📚 Wohnung verstehen</button>`);
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
  if (!task) return layout("Schritt", "<p>Schritt nicht gefunden.</p>");
  const canDone = taskCanBeDone(taskId);
  const issues = completionIssues(taskId);
  return layout("Schritt", `<div class="card stack"><h2>${task.title}</h2><p>${task.description}</p><p class="subtext">Wenn ein Schritt erledigt ist, wirst du automatisch weitergeleitet.</p>${task.educationTopics.slice(0, 2).map((topic) => `<a href="#/education?topic=${topic}">Mehr erfahren: ${topic}</a>`).join("")}${taskSubAction(task)}<button class="primary" data-action="toggle-task" data-task-id="${task.id}" ${canDone ? "" : "disabled"}>Schritt abschliessen</button>${!canDone ? `<p class="subtext">${taskHints(task.id)}</p><button class="secondary" data-action="show-issues" data-task-id="${task.id}">Trotzdem weiter? Zeige was fehlt</button>` : nextTaskButton()}</div>${issues.length ? `<div class="card"><strong>Offen:</strong><ul>${issues.map((i) => `<li>${i}</li>`).join("")}</ul></div>` : ""}`);
}

function screenEducation(query) {
  const focus = query.get("topic");
  const section = (id, title, text) => `<div class="card" id="${id}" style="${focus === id ? "border-color:#2c67f2" : ""}"><h3>${title}</h3><p>${text}</p></div>`;
  return layout("📚 Wohnung verstehen", `${section("kaution", "Kaution", "Die Kaution beträgt meist bis zu drei Nettokaltmieten und darf in 3 Raten gezahlt werden, wenn vereinbart. Immer Quittung/Beleg sichern.")}${section("nebenkosten", "Nebenkosten", "Plane zusätzlich zur Miete: Heizung, Wasser, Müll, Internet, Strom und Rücklagen. Eine realistische Reserve reduziert Stress.")}${section("versicherungen", "Versicherungen", "Vergleiche Preis, Selbstbehalt und Deckung. Wähle nicht nur nach dem günstigsten Preis.")}${section("wg-kaution", "WG-Kaution", "In WGs: klare Aufteilung dokumentieren, wer zahlt wie viel und wie die Rückzahlung beim Auszug erfolgt.")}<button class="ghost" data-nav="/checklist/first-apartment">← Zurück zur Checkliste</button>`);
}

function screenDeposit() {
  const signed = state.deposit.roommates.filter((r) => r.status === "signed").length;
  const amount = Number(state.deposit.amount || 0);
  return layout("Kaution", `<div class="card stack"><h2>Kaution organisieren</h2><p>Unterschriften sind optional für den Abschluss, können aber dokumentiert werden.</p><label>Kautionsbetrag (€)<input type="number" min="0" id="deposit-amount" value="${amount}" /></label><div class="inline"><button class="secondary" data-action="save-deposit-amount">Betrag speichern</button><button class="${state.deposit.amountConfirmed ? "secondary" : "primary"}" data-action="confirm-amount" ${amount <= 0 ? "disabled" : ""}>${state.deposit.amountConfirmed ? "Betrag bestätigt ✓" : "Betrag bestätigen"}</button></div><button class="secondary" data-nav="/deposit/invite">Mitbewohner verwalten</button><p class="subtext">Unterschriftenstatus: ${signed}/${state.deposit.roommates.length}</p><button class="primary" data-action="toggle-task" data-task-id="deposit" ${canCompleteDeposit(state.deposit) ? "" : "disabled"}>Kaution als erledigt markieren</button></div>`);
}

function screenInvite() {
  const signed = state.deposit.roommates.filter((r) => r.status === "signed").length;
  const items = state.deposit.roommates.map((r, idx) => `<div class="card task-row"><div><p class="task-title">${r.name}</p><p class="subtext">${r.status === "signed" ? `${r.name} ✓ (${r.signatureType === "qes" ? "QES simuliert" : "Standard"})` : `${r.name} ⏳ offen`}</p>${r.signedAt ? `<p class="subtext">${r.signedAt}</p>` : ""}</div><div class="stack"><div class="inline"><button class="secondary" data-action="sign" data-index="${idx}" data-signature="standard" ${r.status === "signed" ? "disabled" : ""}>Standard</button><button class="secondary" data-action="sign" data-index="${idx}" data-signature="qes" ${r.status === "signed" ? "disabled" : ""}>QES simuliert</button></div><button class="ghost" data-action="remove-roommate" data-index="${idx}">Entfernen</button></div></div>`).join("");
  return layout("Mitbewohner", `<div class="card stack"><h2>Mitbewohner verwalten</h2><p><strong>${signed}/${state.deposit.roommates.length} unterschrieben</strong></p><div class="inline"><input id="roommate-name" placeholder="Name eingeben" /><button class="primary" data-action="add-roommate">Hinzufügen</button></div></div>${items || '<div class="card"><p class="subtext">Keine Personen erfasst.</p></div>'}<button class="ghost" data-nav="/deposit">← Zurück zur Kaution</button>`);
}

function numberInput(id, value, label) { return `<label>${label}<input type="number" id="${id}" value="${value}" min="0" /></label>`; }
function itemRows(items, type) {
  return items.map((item, idx) => `<div class="inline item-row"><input data-item-label="${type}-${idx}" value="${item.label}" placeholder="Bezeichnung" /><input type="number" min="0" data-item-amount="${type}-${idx}" value="${item.amount}" /><button class="ghost" data-action="remove-item" data-type="${type}" data-index="${idx}">Entfernen</button></div>`).join("");
}

function screenBudget() {
  const totals = calculateBudgetTotal(state.budget);
  const max = Math.max(totals.monthlyTotal, totals.oneTimeTotal, 1);
  return layout("Budget", `<div class="card stack"><h2>Budgetübersicht</h2>${numberInput("rent", state.budget.rent, "Miete")}${numberInput("internet", state.budget.internet, "Internet")}${numberInput("power", state.budget.power, "Strom")}${numberInput("insurance", state.budget.insurance, "Versicherungen")}${numberInput("transport", state.budget.transport, "ÖV / Mobilität")}${numberInput("groceries", state.budget.groceries, "Lebensmittel")}<h3>Eigene monatliche Punkte</h3>${itemRows(state.budget.customItems, "custom") || '<p class="subtext">Noch keine eigenen Punkte</p>'}<button class="secondary" data-action="add-item" data-type="custom">+ Punkt hinzufügen</button><h3>Einmalige Kosten</h3>${itemRows(state.budget.oneTimeItems, "oneTime") || '<p class="subtext">Noch keine einmaligen Kosten</p>'}<button class="secondary" data-action="add-item" data-type="oneTime">+ Einmalkosten hinzufügen</button><div class="budget-chart"><div><span>Monatlich</span><div class="bar"><i style="width:${Math.round((totals.monthlyTotal / max) * 100)}%"></i></div><strong>${totals.monthlyTotal} €</strong></div><div><span>Einmalig</span><div class="bar"><i style="width:${Math.round((totals.oneTimeTotal / max) * 100)}%"></i></div><strong>${totals.oneTimeTotal} €</strong></div></div><button class="primary" data-action="save-budget">Budget speichern</button><a href="#/education?topic=nebenkosten">Mehr erfahren: Nebenkosten</a></div>`);
}

function screenStandingOrder() {
  const d = state.standingOrders.draft;
  const items = state.standingOrders.items.map((item, idx) => `<li>Dauerauftrag ${idx + 1}: ${item.monthlyAmount} € an ${item.recipient} (Tag ${item.executionDay}) · ${item.confirmed ? "bestätigt" : "offen"} <button class="ghost" data-action="delete-standing-order" data-id="${item.id}">Entfernen</button></li>`).join("");
  return layout("Daueraufträge", `<div class="card stack"><h2>Daueraufträge einrichten</h2><p class="subtext">Du kannst mehrere Daueraufträge erfassen. Diese kannst du später im E-Banking ansehen, löschen und editieren.</p>${numberInput("so-amount", d.monthlyAmount || "", "Monatlicher Betrag (€)")}<label>Empfänger<input id="so-recipient" value="${d.recipient}" placeholder="z.B. Vermietung Muster AG" /></label><label>IBAN<input id="so-iban" value="${d.iban}" placeholder="CH93...." /></label><label>Ausführungstag (1-28)<input type="number" min="1" max="28" id="so-day" value="${d.executionDay || 1}" /></label><label>Startdatum<input type="date" id="so-start" value="${d.startDate}" /></label><label>Zweck<input id="so-purpose" value="${d.purpose}" /></label><button class="secondary" data-action="save-standing-order">Daten speichern</button><button class="primary" data-action="confirm-standing-order" ${isStandingOrderDraftReady(d) ? "" : "disabled"}>Dauerauftrag bestätigen</button><button class="primary" data-action="add-standing-order" ${isStandingOrderItemComplete(d) ? "" : "disabled"}>Als weiteren Dauerauftrag erfassen</button></div><div class="card"><h3>Erfasste Daueraufträge</h3><ul>${items || "<li>Noch keine Daueraufträge erfasst.</li>"}</ul><p class="subtext">Hinweis: Im E-Banking kannst du Daueraufträge ansehen/löschen/editieren.</p></div>`);
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
  const options = state.insurance.options.map((o, idx) => `<div class="card stack"><div class="task-row"><div><strong>${o.title}</strong><p class="subtext">${o.note}</p></div></div><div class="inline">${numberInput(`ins-prem-${idx}`, o.annualPremium, "Prämie/Jahr")}${numberInput(`ins-ded-${idx}`, o.deductible, "Selbstbehalt")}${numberInput(`ins-cov-${idx}`, o.coverage, "Deckung (1-5)")}</div><label class="inline"><input type="checkbox" data-action="toggle-insurance" data-index="${idx}" ${o.selected ? "checked" : ""} />In Vergleich aufnehmen</label></div>`).join("");
  const selected = state.insurance.options.filter((o) => o.selected);
  const best = [...selected].sort((a, b) => insuranceScore(b, state.insurance.priorityCriterion) - insuranceScore(a, state.insurance.priorityCriterion))[0];
  const worst = [...selected].sort((a, b) => insuranceScore(a, state.insurance.priorityCriterion) - insuranceScore(b, state.insurance.priorityCriterion))[0];
  const savings = best && worst ? Math.max(0, Number(worst.annualPremium) - Number(best.annualPremium)) : 0;
  return layout("Versicherungen", `<div class="card stack"><h2>Versicherungen logisch entscheiden</h2><p class="subtext">Wähle das wichtigste Kriterium aus. Daraus berechnen wir im Backend eine nachvollziehbare Empfehlung aus Prämie, Selbstbehalt und Deckung.</p><label>Bis wann vergleichst du Angebote?<input type="date" id="insurance-compare" value="${state.insurance.compareBy}" /></label><label>Wichtigstes Kriterium<select id="insurance-priority"><option value="">Bitte auswählen</option><option value="balanced" ${state.insurance.priorityCriterion === "balanced" ? "selected" : ""}>Ausgewogen</option><option value="lowPremium" ${state.insurance.priorityCriterion === "lowPremium" ? "selected" : ""}>Niedrige Jahresprämie</option><option value="lowDeductible" ${state.insurance.priorityCriterion === "lowDeductible" ? "selected" : ""}>Niedriger Selbstbehalt</option><option value="highCoverage" ${state.insurance.priorityCriterion === "highCoverage" ? "selected" : ""}>Hohe Deckung</option></select></label><button class="secondary" data-action="save-insurance">Vergleich auswerten</button>${state.insurance.recommendation ? `<p><strong>Empfehlung:</strong> ${state.insurance.recommendation}${savings ? ` · Potenzielle Ersparnis: ${savings} CHF/Jahr` : ""}</p>` : ""}</div>${options}<button class="primary" data-action="toggle-task" data-task-id="insurance" ${isInsuranceComplete() ? "" : "disabled"}>Schritt abschliessen</button>`);
}

function screenDocuments() {
  const uploadRow = (title, key) => {
    const uploaded = key === "lease" ? state.documents.leaseUploaded : state.documents.depositConfirmationUploaded;
    return `<div class="card stack"><div class="task-row"><div><p class="task-title">${title}</p><p class="subtext">${uploaded ? "hochgeladen" : "noch offen"}</p></div><label class="file-picker">Datei wählen<input type="file" data-action="file-upload" data-doc="${key}" /></label></div></div>`;
  };
  const history = state.documents.uploads.map((u) => `<li>${u.type}: ${u.name} (${u.sizeKb} KB) · ${u.date}</li>`).join("");
  return layout("Wohnungsdokumente", `${uploadRow("Mietvertrag", "lease")}${uploadRow("Kautionsbestätigung", "depositConfirmation")}<div class="card"><h3>Upload-Historie</h3><ul>${history || "<li>Noch keine Uploads</li>"}</ul></div><button class="primary" data-action="toggle-task" data-task-id="documents" ${(state.documents.leaseUploaded && state.documents.depositConfirmationUploaded) ? "" : "disabled"}>Dokumente als erledigt markieren</button>`);
}

function screenDone() {
  const totals = calculateBudgetTotal(state.budget);
  const completed = state.tasks.filter((t) => t.status === "done");
  const roommates = state.deposit.roommates.map((r) => `<li>${r.name}: ${r.status === "signed" ? `unterschrieben (${r.signatureType === "qes" ? "QES simuliert" : "Standard"})` : "offen"}</li>`).join("");
  const standingOrders = state.standingOrders.items.map((s, idx) => `<li>#${idx + 1}: ${s.monthlyAmount} € an ${s.recipient}, IBAN ${s.iban}, Tag ${s.executionDay}, Start ${s.startDate}, Zweck ${s.purpose}</li>`).join("");
  return layout("Abschluss", `<div class="card stack"><h2>🎉 Stark gemacht!</h2><p>Hier ist deine vollständige Zusammenfassung.</p><div class="summary-grid"><div class="card"><p class="subtext">Kaution</p><strong>${state.deposit.amount} €</strong></div><div class="card"><p class="subtext">Monatsbudget</p><strong>${totals.monthlyTotal} €</strong></div><div class="card"><p class="subtext">Einmalige Kosten</p><strong>${totals.oneTimeTotal} €</strong></div><div class="card"><p class="subtext">Versicherung</p><strong>${state.insurance.recommendation || "Noch keine Empfehlung"}</strong></div></div><h3>Personen / Unterschriften</h3><ul>${roommates || "<li>Keine Personen erfasst</li>"}</ul><h3>Daueraufträge</h3><ul>${standingOrders || "<li>Keine Daueraufträge erfasst</li>"}</ul><h3>Dokumente</h3><ul><li>Mietvertrag: ${state.documents.leaseUploaded ? "Ja" : "Nein"}</li><li>Kautionsbestätigung: ${state.documents.depositConfirmationUploaded ? "Ja" : "Nein"}</li></ul><h3>Erledigte Punkte</h3><ul>${completed.map((t) => `<li>${t.title}</li>`).join("")}</ul><button class="primary" data-nav="/checklist/first-apartment">Zur Übersicht</button></div>`);
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
}

window.addEventListener("hashchange", () => render());

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const nav = target.dataset.nav;
  if (nav) return go(nav);
  if (target.dataset.back) return history.back();

  const action = target.dataset.action;
  if (!action) return;

  if (action === "toggle-task") {
    const id = target.dataset.taskId;
    if (!id || !taskCanBeDone(id)) return;
    markTask(id, true);
    saveState();
    const next = getNextOpenTaskId();
    setToast("Schritt erledigt");
    ensureCompletionNavigation();
    if (next) go(`/task/${next}`); else go("/done");
    return render();
  }

  if (action === "show-issues") {
    const taskId = target.dataset.taskId;
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
    state.deposit.roommates.push({ name, status: "open", signatureType: "none", signedAt: "" });
    saveState();
    setToast(`${name} hinzugefügt`);
    return render();
  }

  if (action === "remove-roommate") {
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) return;
    const removed = state.deposit.roommates.splice(index, 1)?.[0];
    saveState();
    setToast(`${removed?.name || "Person"} entfernt`);
    return render();
  }

  if (action === "sign") {
    const index = Number(target.dataset.index);
    const signature = target.dataset.signature || "standard";
    if (Number.isNaN(index) || !state.deposit.roommates[index]) return;
    state.deposit.roommates[index].status = "signed";
    state.deposit.roommates[index].signatureType = signature === "qes" ? "qes" : "standard";
    state.deposit.roommates[index].signedAt = new Date().toLocaleString("de-DE");
    saveState();
    setToast(`${state.deposit.roommates[index].name} hat ${signature === "qes" ? "qualifiziert" : "standard"} unterschrieben (simuliert)`);
    return render();
  }

  if (action === "add-item") {
    const type = target.dataset.type;
    const item = { id: String(Date.now()), label: "Neuer Punkt", amount: 0 };
    if (type === "custom") state.budget.customItems.push(item);
    if (type === "oneTime") state.budget.oneTimeItems.push(item);
    saveState();
    return render();
  }

  if (action === "remove-item") {
    const type = target.dataset.type;
    const index = Number(target.dataset.index);
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
    return setToast("Daten gespeichert");
  }

  if (action === "confirm-standing-order") {
    state.standingOrders.draft.confirmed = isStandingOrderDraftReady(state.standingOrders.draft);
    saveState();
    return setToast("Dauerauftrag bestätigt");
  }

  if (action === "add-standing-order") {
    if (!isStandingOrderItemComplete(state.standingOrders.draft)) return;
    state.standingOrders.items.push({ ...state.standingOrders.draft, id: String(Date.now()) });
    state.standingOrders.draft = { ...clone(defaultState.standingOrders.draft) };
    saveState();
    return setToast("Dauerauftrag erfasst");
  }

  if (action === "delete-standing-order") {
    const id = target.dataset.id;
    state.standingOrders.items = state.standingOrders.items.filter((item) => item.id !== id);
    saveState();
    return setToast("Dauerauftrag entfernt");
  }

  if (action === "toggle-insurance") {
    const index = Number(target.dataset.index);
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
    localStorage.removeItem(STORAGE_KEY);
    state = clone(defaultState);
    go("/");
    return render();
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
  setToast("Dokument erfolgreich hochgeladen");
  render();
});

window.addEventListener("load", () => {
  if (!window.location.hash) go("/");
  render();
});
