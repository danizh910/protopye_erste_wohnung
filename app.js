import { calculateBudgetTotal, canCompleteDeposit, calculateProgress } from "./utils.mjs";

const STORAGE_KEY = "first-apartment-prototype-v2";

const defaultState = {
  tasks: [
    { id: "lease", title: "Mietvertrag hochladen", status: "open", description: "Lade den unterschriebenen Mietvertrag hoch.", educationTopics: [] },
    { id: "deposit", title: "Kaution organisieren", status: "open", description: "Trage Betrag ein und sammle alle Unterschriften.", educationTopics: ["kaution", "wg-kaution"] },
    { id: "budget", title: "Budget planen", status: "open", description: "Plane monatliche und einmalige Wohnkosten.", educationTopics: ["nebenkosten"] },
    { id: "standing-order", title: "Dauerauftrag einrichten", status: "open", description: "Definiere Miete, Termin und Empfänger für die Zahlung.", educationTopics: [] },
    { id: "insurance", title: "Versicherungen prüfen", status: "open", description: "Vergleiche relevante Policen und dokumentiere deine Auswahl.", educationTopics: ["versicherungen"] },
    { id: "documents", title: "Dokumente speichern", status: "open", description: "Lege wichtige Nachweise zentral im Upload-Bereich ab.", educationTopics: [] }
  ],
  deposit: {
    amount: 2550,
    amountConfirmed: false,
    roommates: [
      { name: "Anna", status: "open" },
      { name: "Luca", status: "open" }
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
  standingOrder: {
    iban: "",
    recipient: "",
    monthlyAmount: 0,
    executionDay: 1,
    startDate: "",
    purpose: "Miete",
    confirmed: false
  },
  insurance: {
    options: [
      { id: "liability", title: "Privathaftpflicht", selected: true, priority: "hoch", note: "Wichtig bei Schäden gegenüber Dritten." },
      { id: "household", title: "Hausrat", selected: false, priority: "mittel", note: "Schützt Möbel und Technik in der Wohnung." },
      { id: "legal", title: "Rechtsschutz Wohnen", selected: false, priority: "niedrig", note: "Hilft bei mietrechtlichen Streitigkeiten." }
    ],
    compareBy: "",
    providerNote: ""
  },
  documents: {
    leaseUploaded: false,
    depositConfirmationUploaded: false,
    uploads: []
  },
  ui: { toast: "" }
};

const app = document.getElementById("app");
let state = loadState();

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function normalizeState(rawState) {
  const merged = {
    ...clone(defaultState),
    ...rawState,
    deposit: { ...clone(defaultState.deposit), ...(rawState?.deposit || {}) },
    budget: { ...clone(defaultState.budget), ...(rawState?.budget || {}) },
    standingOrder: { ...clone(defaultState.standingOrder), ...(rawState?.standingOrder || {}) },
    insurance: { ...clone(defaultState.insurance), ...(rawState?.insurance || {}) },
    documents: { ...clone(defaultState.documents), ...(rawState?.documents || {}) },
    ui: { ...clone(defaultState.ui), ...(rawState?.ui || {}) }
  };

  if (!Array.isArray(merged.budget.customItems)) merged.budget.customItems = [];
  if (!Array.isArray(merged.budget.oneTimeItems)) merged.budget.oneTimeItems = [];
  if (!Array.isArray(merged.documents.uploads)) merged.documents.uploads = [];
  if (!Array.isArray(merged.deposit.roommates)) merged.deposit.roommates = clone(defaultState.deposit.roommates);
  if (!Array.isArray(merged.insurance.options)) merged.insurance.options = clone(defaultState.insurance.options);

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

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function markTask(id, done) {
  const task = taskById(id);
  if (!task) return;
  task.status = done ? "done" : "open";
}

function isStandingOrderComplete() {
  const s = state.standingOrder;
  return Boolean(s.iban && s.recipient && Number(s.monthlyAmount) > 0 && Number(s.executionDay) >= 1 && Number(s.executionDay) <= 28 && s.startDate);
}

function isInsuranceComplete() {
  return state.insurance.options.some((o) => o.selected) && Boolean(state.insurance.compareBy) && Boolean(state.insurance.providerNote);
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
  if (task.id === "standing-order") return `<button class="secondary" data-nav="/standing-order">Dauerauftrag öffnen</button>`;
  if (task.id === "insurance") return `<button class="secondary" data-nav="/insurance">Versicherungen öffnen</button>`;
  if (task.id === "documents" || task.id === "lease") return `<button class="secondary" data-nav="/documents">Dokumente öffnen</button>`;
  return "";
}

function getNextOpenTaskId() { return state.tasks.find((task) => task.status === "open")?.id; }

function layout(title, content, { showBack = true } = {}) {
  return `<div class="app-shell">
    <header>
      ${showBack ? '<button class="ghost" data-back="1">←</button>' : ""}
      <h1>Erste Wohnung · ${title}</h1>
    </header>
    <main>${content}${state.ui.toast ? `<div class="toast">${state.ui.toast}</div>` : ""}</main>
    <footer>
      <button class="ghost" data-nav="/checklist/first-apartment">Zum Reiseplan</button>
      <button class="ghost" data-action="reset">Reset</button>
    </footer>
  </div>`;
}

function nextTaskButton(label = "Zum nächsten Schritt") {
  const next = getNextOpenTaskId();
  if (!next) return '<button class="primary" data-nav="/done">Zur Zusammenfassung</button>';
  return `<button class="primary" data-nav="/task/${next}">${label}: ${taskById(next).title}</button>`;
}

function screenHome() {
  return layout("Home", `<div class="tile" data-nav="/onboarding/first-apartment"><h2>🏠 Erste eigene Wohnung</h2><p>Ein klarer Plan für Kaution, Budget, Zahlungen, Versicherungen und Dokumente.</p></div>`, { showBack: false });
}

function screenOnboarding() {
  return layout("Onboarding", `<div class="card stack"><h2>Willkommen zu deiner Wohnungsreise</h2><p>Wir gehen gemeinsam Schritt für Schritt durch alles, was vor dem Einzug wichtig ist. Du musst nichts auswendig wissen — wir führen dich durch.</p><div class="journey-step"><strong>1. Ankommen:</strong> Mietvertrag & Kaution sauber aufsetzen.</div><div class="journey-step"><strong>2. Stabil werden:</strong> Budget + Dauerauftrag so planen, dass alles pünktlich läuft.</div><div class="journey-step"><strong>3. Absichern:</strong> Versicherungen logisch auswählen und Dokumente final sammeln.</div><button class="primary" data-nav="/task/lease">Reise starten</button><button class="secondary" data-nav="/checklist/first-apartment">Alle Schritte ansehen</button></div>`);
}

function screenChecklist() {
  const progress = calculateProgress(state.tasks);
  const next = getNextOpenTaskId();
  const percent = Math.round((progress.done / progress.total) * 100);
  const rows = state.tasks.map((t, idx) => `<div class="card task-row"><div><p class="task-title">${t.status === "done" ? "✓" : `${idx + 1}.`} ${t.title}</p><p class="subtext">${t.description}</p></div><div class="stack"><span class="${t.status === "done" ? "status-done" : "status-open"}">${t.status === "done" ? "Erledigt" : "Offen"}</span><button class="secondary" data-nav="/task/${t.id}">Öffnen</button></div></div>`).join("");

  return layout("Reiseplan", `<div class="card stack"><strong>Fortschritt: ${progress.done}/${progress.total} (${percent}%)</strong><div class="progress"><span style="width:${percent}%"></span></div><p class="subtext">Nächster logischer Schritt: ${next ? taskById(next).title : "Alles fertig"}</p>${next ? `<button class="primary" data-nav="/task/${next}">Weiter mit dem nächsten Schritt</button>` : '<button class="primary" data-nav="/done">Zur Zusammenfassung</button>'}</div>${rows}<button class="ghost" data-nav="/education">📚 Wohnung verstehen</button>`);
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
  if (taskId === "deposit") return "Betrag eingeben + bestätigen und alle Unterschriften sammeln.";
  if (taskId === "lease") return "Bitte Mietvertrag unter Dokumente hochladen.";
  if (taskId === "documents") return "Mietvertrag und Kautionsbestätigung fehlen noch.";
  if (taskId === "standing-order") return "IBAN, Betrag, Ausführungstag und Startdatum vervollständigen.";
  if (taskId === "insurance") return "Mindestens eine Versicherung wählen, Vergleichsdatum setzen und deine Kriterien notieren.";
  return "";
}

function screenTask(taskId) {
  const task = taskById(taskId);
  if (!task) return layout("Task", "<p>Task nicht gefunden.</p>");
  const canDone = taskCanBeDone(taskId);

  return layout("Schritt", `<div class="card stack"><h2>${task.title}</h2><p>${task.description}</p><p class="subtext">Fokus jetzt: erst diesen Schritt sauber abschliessen, dann führen wir dich direkt weiter.</p>${task.educationTopics.slice(0, 2).map((topic) => `<a href="#/education?topic=${topic}">Mehr erfahren: ${topic}</a>`).join("")}${taskSubAction(task)}<button class="primary" data-action="toggle-task" data-task-id="${task.id}" ${canDone ? "" : "disabled"}>Schritt abschliessen</button>${!canDone ? `<p class="subtext">${taskHints(task.id)}</p>` : nextTaskButton()}</div>`);
}

function screenEducation(query) {
  const focus = query.get("topic");
  const section = (id, title, text) => `<div class="card" id="${id}" style="${focus === id ? "border-color:#2c67f2" : ""}"><h3>${title}</h3><p>${text}</p></div>`;
  return layout("📚 Wohnung verstehen", `${section("kaution", "Kaution", "Die Kaution beträgt meist bis zu drei Nettokaltmieten und darf in 3 Raten gezahlt werden, wenn vereinbart. Immer Quittung/Beleg sichern.")}${section("nebenkosten", "Nebenkosten", "Plane zusätzlich zur Miete: Heizung, Wasser, Müll, Internet, Strom und Rücklagen. Eine realistische Reserve reduziert Stress.")}${section("versicherungen", "Versicherungen", "Haftpflicht ist meist Pflicht-Feeling, Hausrat optional je nach Wert deiner Möbel. Vergleiche Selbstbehalt, Deckungssumme und Laufzeit.")}${section("wg-kaution", "WG-Kaution", "In WGs: klare Aufteilung dokumentieren, wer zahlt wie viel und wie die Rückzahlung beim Auszug erfolgt.")}<button class="ghost" data-nav="/checklist/first-apartment">← Zurück zur Checkliste</button>`);
}

function screenDeposit() {
  const signed = state.deposit.roommates.filter((r) => r.status === "signed").length;
  const amount = Number(state.deposit.amount || 0);
  return layout("Kaution", `<div class="card stack"><h2>Kaution organisieren</h2><p>Schritte: 1) Betrag festlegen 2) Betrag bestätigen 3) Mitbewohner unterschreiben</p><label>Kautionsbetrag (€)<input type="number" min="0" id="deposit-amount" value="${amount}" /></label><div class="inline"><button class="secondary" data-action="save-deposit-amount">Betrag speichern</button><button class="${state.deposit.amountConfirmed ? "secondary" : "primary"}" data-action="confirm-amount" ${amount <= 0 ? "disabled" : ""}>${state.deposit.amountConfirmed ? "Betrag bestätigt ✓" : "Betrag bestätigen"}</button></div><button class="secondary" data-nav="/deposit/invite">Mitbewohner einladen</button><p class="subtext">Status: ${signed}/${state.deposit.roommates.length} unterschrieben</p><button class="primary" data-action="toggle-task" data-task-id="deposit" ${canCompleteDeposit(state.deposit) ? "" : "disabled"}>Kaution als erledigt markieren</button></div>`);
}

function screenInvite() {
  const signed = state.deposit.roommates.filter((r) => r.status === "signed").length;
  const items = state.deposit.roommates.map((r, idx) => `<div class="card task-row"><div><p class="task-title">${r.name}</p><p class="subtext">${r.status === "signed" ? `${r.name} ✓ unterschrieben` : `${r.name} ⏳ offen`}</p></div><button class="secondary" data-action="sign" data-index="${idx}" ${r.status === "signed" ? "disabled" : ""}>Unterschrift simulieren</button></div>`).join("");
  return layout("Mitbewohner", `<div class="card stack"><h2>Mitbewohner einladen</h2><p><strong>${signed}/${state.deposit.roommates.length} unterschrieben</strong></p><div class="inline"><input id="roommate-name" placeholder="Name eingeben" /><button class="primary" data-action="add-roommate">Hinzufügen</button></div></div>${items}<button class="ghost" data-nav="/deposit">← Zurück zur Kaution</button>`);
}

function numberInput(id, value, label) {
  return `<label>${label}<input type="number" id="${id}" value="${value}" min="0" /></label>`;
}

function itemRows(items, type) {
  return items.map((item, idx) => `<div class="inline item-row"><input data-item-label="${type}-${idx}" value="${item.label}" placeholder="Bezeichnung" /><input type="number" min="0" data-item-amount="${type}-${idx}" value="${item.amount}" /><button class="ghost" data-action="remove-item" data-type="${type}" data-index="${idx}">Entfernen</button></div>`).join("");
}

function screenBudget() {
  const totals = calculateBudgetTotal(state.budget);
  return layout("Budget", `<div class="card stack"><h2>Budgetübersicht</h2>${numberInput("rent", state.budget.rent, "Miete")}${numberInput("internet", state.budget.internet, "Internet")}${numberInput("power", state.budget.power, "Strom")}${numberInput("insurance", state.budget.insurance, "Versicherungen")}${numberInput("transport", state.budget.transport, "ÖV / Mobilität")}${numberInput("groceries", state.budget.groceries, "Lebensmittel")}<h3>Eigene monatliche Punkte</h3>${itemRows(state.budget.customItems, "custom") || '<p class="subtext">Noch keine eigenen Punkte</p>'}<button class="secondary" data-action="add-item" data-type="custom">+ Punkt hinzufügen</button><h3>Einmalige Kosten</h3>${itemRows(state.budget.oneTimeItems, "oneTime") || '<p class="subtext">Noch keine einmaligen Kosten</p>'}<button class="secondary" data-action="add-item" data-type="oneTime">+ Einmalkosten hinzufügen</button><p class="total">Monatlich: ${totals.monthlyTotal} €</p><p class="subtext">Einmalig: ${totals.oneTimeTotal} €</p><button class="primary" data-action="save-budget">Budget speichern</button><a href="#/education?topic=nebenkosten">Mehr erfahren: Nebenkosten</a></div>`);
}

function screenStandingOrder() {
  const s = state.standingOrder;
  return layout("Dauerauftrag", `<div class="card stack"><h2>Dauerauftrag einrichten</h2><p class="subtext">Ziel: Deine Miete läuft automatisch und pünktlich. Trage die Daten ein, speichere und bestätige dann final.</p>${numberInput("so-amount", s.monthlyAmount || "", "Monatlicher Betrag (€)")}<label>Empfänger<input id="so-recipient" value="${s.recipient}" placeholder="z.B. Vermietung Muster AG" /></label><label>IBAN<input id="so-iban" value="${s.iban}" placeholder="CH93...." /></label><label>Ausführungstag (1-28)<input type="number" min="1" max="28" id="so-day" value="${s.executionDay || 1}" /></label><label>Startdatum<input type="date" id="so-start" value="${s.startDate}" /></label><label>Zweck<input id="so-purpose" value="${s.purpose}" /></label><button class="primary" data-action="save-standing-order">Daten speichern</button><button class="${s.confirmed ? "secondary" : "primary"}" data-action="confirm-standing-order" ${isStandingOrderComplete() ? "" : "disabled"}>${s.confirmed ? "Dauerauftrag bestätigt ✓" : "Final bestätigen"}</button><p class="subtext">Tipp: 2-3 Tage vor Mietfälligkeit einplanen.</p>${s.confirmed ? nextTaskButton("Weiter") : ""}</div>`);
}

function screenInsurance() {
  const options = state.insurance.options.map((o, idx) => `<div class="card stack"><div class="task-row"><div><strong>${o.title}</strong><p class="subtext">${o.note}</p></div><span class="badge">Priorität: ${o.priority}</span></div><label class="inline"><input type="checkbox" data-action="toggle-insurance" data-index="${idx}" ${o.selected ? "checked" : ""} />Für mich sinnvoll</label></div>`).join("");
  return layout("Versicherungen", `<div class="card stack"><h2>Versicherungen logisch entscheiden</h2><p class="subtext">Orientierung: Haftpflicht ist fast immer sinnvoll. Hausrat lohnt sich, wenn deine Einrichtung wertvoll ist. Rechtsschutz ist eher optional für zusätzliche Sicherheit.</p><label>Bis wann vergleichst du Angebote?<input type="date" id="insurance-compare" value="${state.insurance.compareBy}" /></label><label>Deine Entscheidung / Kriterien<input id="insurance-note" value="${state.insurance.providerNote}" placeholder="z.B. Haftpflicht + Hausrat, Selbstbehalt max. 200 CHF" /></label><button class="secondary" data-action="save-insurance">Entscheidung speichern</button></div>${options}<button class="primary" data-action="toggle-task" data-task-id="insurance" ${isInsuranceComplete() ? "" : "disabled"}>Schritt abschliessen</button>`);
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
  return layout("Abschluss", `<div class="card stack"><h2>🎉 Stark gemacht!</h2><p>Dein Wohnungs-Setup steht. Unten siehst du deine Zusammenfassung.</p><div class="summary-grid"><div class="card"><p class="subtext">Kaution</p><strong>${state.deposit.amount} €</strong></div><div class="card"><p class="subtext">Monatsbudget</p><strong>${totals.monthlyTotal} €</strong></div><div class="card"><p class="subtext">Einmalige Kosten</p><strong>${totals.oneTimeTotal} €</strong></div><div class="card"><p class="subtext">Dauerauftrag</p><strong>${state.standingOrder.monthlyAmount || 0} € am ${state.standingOrder.executionDay}.</strong></div></div><h3>Erledigte Punkte</h3><ul>${completed.map((t) => `<li>${t.title}</li>`).join("")}</ul><button class="primary" data-nav="/checklist/first-apartment">Zur Übersicht</button></div>`);
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
    setToast("Task als erledigt markiert");
    ensureCompletionNavigation();
    return render();
  }

  if (action === "save-deposit-amount") {
    const input = document.getElementById("deposit-amount");
    state.deposit.amount = Number(input?.value || 0);
    state.deposit.amountConfirmed = false;
    saveState();
    setToast("Kautionsbetrag gespeichert");
  }

  if (action === "confirm-amount") {
    state.deposit.amountConfirmed = Number(state.deposit.amount) > 0;
    saveState();
    setToast("Kautionsbetrag bestätigt");
  }

  if (action === "add-roommate") {
    const input = document.getElementById("roommate-name");
    const name = input?.value?.trim();
    if (!name) return;
    state.deposit.roommates.push({ name, status: "open" });
    saveState();
    setToast(`${name} eingeladen`);
    return render();
  }

  if (action === "sign") {
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) return;
    state.deposit.roommates[index].status = "signed";
    saveState();
    setToast(`${state.deposit.roommates[index].name} hat unterschrieben`);
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
    state.standingOrder.monthlyAmount = Number(document.getElementById("so-amount")?.value || 0);
    state.standingOrder.recipient = document.getElementById("so-recipient")?.value?.trim() || "";
    state.standingOrder.iban = document.getElementById("so-iban")?.value?.trim() || "";
    state.standingOrder.executionDay = Number(document.getElementById("so-day")?.value || 1);
    state.standingOrder.startDate = document.getElementById("so-start")?.value || "";
    state.standingOrder.purpose = document.getElementById("so-purpose")?.value || "Miete";
    state.standingOrder.confirmed = false;
    saveState();
    setToast("Dauerauftrag-Daten gespeichert");
    return render();
  }

  if (action === "confirm-standing-order") {
    state.standingOrder.confirmed = isStandingOrderComplete();
    saveState();
    setToast("Dauerauftrag bestätigt");
    return render();
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
    state.insurance.providerNote = document.getElementById("insurance-note")?.value?.trim() || "";
    saveState();
    setToast("Versicherungsplan gespeichert");
    return render();
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
