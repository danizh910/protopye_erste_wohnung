import { calculateBudgetTotal, canCompleteDeposit, calculateProgress } from "./utils.mjs";

const STORAGE_KEY = "first-apartment-prototype-v2";

const defaultState = {
  tasks: [
    { id: "lease", title: "Mietvertrag hochladen", status: "open", description: "Schritt 1: Lade deinen Mietvertrag als Datei hoch.", educationTopics: [] },
    { id: "deposit", title: "Kaution organisieren", status: "open", description: "Schritt 2: Betrag festlegen, WG einladen, Signaturen tracken.", educationTopics: ["kaution", "wg-kaution"] },
    { id: "budget", title: "Budget planen", status: "open", description: "Schritt 3: Plane alle monatlichen Wohnkosten inkl. Extras.", educationTopics: ["nebenkosten"] },
    { id: "standing-order", title: "Dauerauftrag einrichten", status: "open", description: "Schritt 4: Lege Betrag, IBAN und Ausführungstag fest.", educationTopics: [] },
    { id: "insurance", title: "Versicherung prüfen", status: "open", description: "Schritt 5: Wähle passende Absicherung für deine Situation.", educationTopics: ["versicherungen"] },
    { id: "documents", title: "Dokumente speichern", status: "open", description: "Schritt 6: Prüfe, ob Mietvertrag und Kautionsbestätigung vorhanden sind.", educationTopics: [] }
  ],
  deposit: {
    amount: 1800,
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
    heating: 45,
    water: 20,
    reserve: 70,
    customItems: []
  },
  standingOrder: {
    recipient: "Hausverwaltung Nord",
    iban: "DE22500105175407324931",
    dayOfMonth: 3,
    amount: 850,
    reference: "Miete WG Musterstraße",
    confirmed: false
  },
  insurance: {
    liabilitySelected: false,
    householdSelected: false,
    checked: false,
    notes: ""
  },
  documents: {
    leaseUploaded: false,
    depositConfirmationUploaded: false,
    uploads: []
  },
  ui: { toast: "", pendingUploadDoc: null }
};

const app = document.getElementById("app");
let state = loadState();

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function euro(v) { return `${Number(v || 0).toFixed(2)} €`; }

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return clone(defaultState);
  try {
    return { ...clone(defaultState), ...JSON.parse(raw) };
  } catch {
    return clone(defaultState);
  }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function calculateBudgetTotalExtended(budget) {
  const base = calculateBudgetTotal(budget);
  const extras = Number(budget.heating) + Number(budget.water) + Number(budget.reserve);
  const custom = budget.customItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return base + extras + custom;
}

function canCompleteStandingOrder() {
  const s = state.standingOrder;
  return Boolean(s.recipient && s.iban && s.reference) && Number(s.amount) > 0 && Number(s.dayOfMonth) >= 1 && Number(s.dayOfMonth) <= 28 && s.confirmed;
}

function canCompleteInsurance() {
  return state.insurance.checked && (state.insurance.liabilitySelected || state.insurance.householdSelected);
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
  saveState();
}

function updateTaskFromRules() {
  markTask("deposit", canCompleteDeposit(state.deposit));
  markTask("lease", state.documents.leaseUploaded);
  markTask("documents", state.documents.leaseUploaded && state.documents.depositConfirmationUploaded);
  markTask("standing-order", canCompleteStandingOrder());
  markTask("insurance", canCompleteInsurance());
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

function getNextOpenTaskId() { return state.tasks.find((task) => task.status === "open")?.id; }

function layout(title, content, { showBack = true } = {}) {
  return `<div class="app-shell">
      <header>
        ${showBack ? '<button class="ghost icon" data-back="1">←</button>' : ""}
        <div><h1>Erste Wohnung</h1><p class="header-sub">${title}</p></div>
      </header>
      <main>${content}${state.ui.toast ? `<div class="toast">${state.ui.toast}</div>` : ""}
      <input id="real-upload" type="file" hidden />
      </main>
      <footer>
        <button class="ghost" data-nav="/checklist/first-apartment">Zur Checkliste</button>
        <button class="ghost" data-action="reset">Reset Prototype</button>
      </footer>
    </div>`;
}

function progressBar() {
  const p = calculateProgress(state.tasks);
  const percent = Math.round((p.done / p.total) * 100);
  return `<div class="card"><strong>Fortschritt: ${p.done}/${p.total} erledigt</strong>
    <div class="progress"><div style="width:${percent}%"></div></div></div>`;
}

function screenHome() {
  return layout("Home", `<div class="hero tile" data-nav="/onboarding/first-apartment"><h2>🏠 Erste eigene Wohnung</h2>
    <p>Klickbarer Prototyp für einen klaren, stressfreien Start in die neue Wohnung.</p>
    <span>Jetzt starten →</span></div>`, { showBack: false });
}

function screenOnboarding() {
  return layout("Onboarding", `<div class="card stack"><h2>Ziehst du in deine erste Wohnung?</h2>
      <p>Wir helfen dir Schritt für Schritt bei Kaution, Budget, Zahlungen und Versicherungen.</p>
      <ol class="subtext"><li>Dokumente vorbereiten</li><li>Kaution mit WG abstimmen</li><li>Kosten und Zahlungen planen</li></ol>
      <button class="primary" data-nav="/checklist/first-apartment">Start Checkliste</button></div>`);
}

function screenChecklist() {
  const next = getNextOpenTaskId();
  const rows = state.tasks.map((t, index) => `<div class="card task-row">
      <div><p class="task-title">${t.status === "done" ? "✓" : "○"} ${index + 1}. ${t.title}</p><p class="subtext">${t.description}</p></div>
      <div class="stack"><span class="${t.status === "done" ? "status-done" : "status-open"}">${t.status === "done" ? "Erledigt" : "Offen"}</span>
      <button class="secondary" data-nav="/task/${t.id}">Öffnen</button></div></div>`).join("");
  return layout("Checkliste", `${progressBar()}<div class="card"><p class="subtext">Nächster logischer Schritt: <strong>${next ? taskById(next).title : "Alles erledigt"}</strong></p></div>${rows}<button class="ghost" data-nav="/education">📚 Wohnung verstehen</button>`);
}

function taskCanBeDone(taskId) {
  if (taskId === "deposit") return canCompleteDeposit(state.deposit);
  if (taskId === "lease") return state.documents.leaseUploaded;
  if (taskId === "documents") return state.documents.leaseUploaded && state.documents.depositConfirmationUploaded;
  if (taskId === "standing-order") return canCompleteStandingOrder();
  if (taskId === "insurance") return canCompleteInsurance();
  return true;
}

function taskSubAction(task) {
  if (task.id === "deposit") return `<button class="secondary" data-nav="/deposit">Kautionsflow öffnen</button>`;
  if (task.id === "budget") return `<button class="secondary" data-nav="/budget">Budget öffnen</button>`;
  if (task.id === "documents" || task.id === "lease") return `<button class="secondary" data-nav="/documents">Dokumente öffnen</button>`;
  if (task.id === "standing-order") return `<button class="secondary" data-nav="/standing-order">Dauerauftrag planen</button>`;
  if (task.id === "insurance") return `<button class="secondary" data-nav="/insurance">Versicherungscheck öffnen</button>`;
  return "";
}

function screenTask(taskId) {
  const task = taskById(taskId);
  if (!task) return layout("Task", `<p>Task nicht gefunden.</p>`);
  return layout("Task Detail", `<div class="card stack"><h2>${task.title}</h2><p>${task.description}</p>
      ${(task.educationTopics || []).map((topic) => `<a href="#/education?topic=${topic}">Mehr erfahren: ${topic}</a>`).join("")}
      ${taskSubAction(task)}
      <button class="primary" data-action="toggle-task" data-task-id="${task.id}" ${taskCanBeDone(task.id) ? "" : "disabled"}>Als erledigt markieren</button></div>`);
}

function screenEducation(query) {
  const focus = query.get("topic");
  const section = (id, title, text) => `<div class="card" style="${focus === id ? "border-color:#3468f5;box-shadow:0 0 0 3px #dfe7ff" : ""}"><h3>${title}</h3><p>${text}</p></div>`;
  return layout("📚 Wohnung verstehen", `${section("kaution", "Kaution", "Die Mietkaution ist eine Sicherheitszahlung fürs Mietverhältnis. Oft sind es bis zu drei Monatsmieten. Das Geld bleibt gesperrt und wird am Ende zurückbezahlt, wenn alles ok ist.")}
      ${section("nebenkosten", "Nebenkosten", "Nebenkosten sind zusätzliche Kosten zur Miete, z.B. Heizung oder Wasser. Sie werden oft pauschal oder als Akonto bezahlt. Am Jahresende gibt es eine Abrechnung.")}
      ${section("versicherungen", "Versicherungen", "Haftpflicht hilft, wenn du anderen aus Versehen Schaden machst. Hausrat deckt dein Eigentum in der Wohnung, z.B. bei Diebstahl oder Wasser. Welche sinnvoll ist, hängt von deiner Situation ab.")}
      ${section("wg-kaution", "WG-Kaution", "In WGs müssen oft mehrere Personen mitmachen. Entscheidend ist, dass alle beteiligten Personen bestätigen können. Ein klarer Status verhindert Stress und Fristprobleme.")}
      <button class="ghost" data-nav="/checklist/first-apartment">← Zurück zur Checkliste</button>`);
}

function screenDeposit() {
  const signed = state.deposit.roommates.filter((r) => r.status === "signed").length;
  return layout("Kaution", `<div class="card stack"><h2>Kaution organisieren</h2>
      <p>Schritte: 1) Betrag festlegen 2) Mitbewohner einladen 3) Unterschriften sammeln</p>
      <label>Kautionsbetrag<input id="deposit-amount" type="number" min="100" step="50" value="${state.deposit.amount}" /></label>
      <button class="${state.deposit.amountConfirmed ? "secondary" : "primary"}" data-action="confirm-amount">${state.deposit.amountConfirmed ? `Betrag bestätigt (${euro(state.deposit.amount)}) ✓` : "Betrag bestätigen"}</button>
      <button class="secondary" data-nav="/deposit/invite">Mitbewohner einladen</button>
      <p class="subtext">Status: ${signed}/${state.deposit.roommates.length} unterschrieben</p>
      <button class="primary" data-action="toggle-task" data-task-id="deposit" ${canCompleteDeposit(state.deposit) ? "" : "disabled"}>Kaution als erledigt markieren</button></div>`);
}

function screenInvite() {
  const signed = state.deposit.roommates.filter((r) => r.status === "signed").length;
  const items = state.deposit.roommates.map((r, idx) => `<div class="card task-row"><div><p class="task-title">${r.name}</p><p class="subtext">${r.status === "signed" ? `${r.name} ✓ unterschrieben` : `${r.name} ⏳ offen`}</p></div>
      <button class="secondary" data-action="sign" data-index="${idx}" ${r.status === "signed" ? "disabled" : ""}>Unterschrift simulieren</button></div>`).join("");
  return layout("Invite", `<div class="card stack"><h2>Mitbewohner einladen</h2><p><strong>${signed}/${state.deposit.roommates.length} unterschrieben</strong></p>
      <div class="inline"><input id="roommate-name" placeholder="Name eingeben" /><button class="primary" data-action="add-roommate">Hinzufügen</button></div></div>
      ${items}<button class="ghost" data-nav="/deposit">← Zurück zur Kaution</button>`);
}

function numberInput(id, value, label) {
  return `<label>${label}<input type="number" id="${id}" value="${value}" min="0" /></label>`;
}

function screenBudget() {
  const total = calculateBudgetTotalExtended(state.budget);
  const customItems = state.budget.customItems.map((item, index) => `<div class="inline budget-item"><input value="${item.name}" data-custom-name="${index}" placeholder="Eigener Punkt" />
      <input type="number" value="${item.amount}" data-custom-amount="${index}" min="0" /><button class="ghost" data-action="remove-budget-item" data-index="${index}">Entfernen</button></div>`).join("");
  return layout("Budget", `<div class="card stack"><h2>Budgetübersicht</h2>
      ${numberInput("rent", state.budget.rent, "Miete")}
      ${numberInput("internet", state.budget.internet, "Internet")}
      ${numberInput("power", state.budget.power, "Strom")}
      ${numberInput("insurance", state.budget.insurance, "Versicherung")}
      ${numberInput("heating", state.budget.heating, "Heizung")}
      ${numberInput("water", state.budget.water, "Wasser")}
      ${numberInput("reserve", state.budget.reserve, "Rücklage")}
      <h3>Eigene Punkte</h3>${customItems || '<p class="subtext">Noch keine zusätzlichen Punkte.</p>'}
      <button class="secondary" data-action="add-budget-item">+ Punkt hinzufügen</button>
      <p class="total">Monatliche Gesamtkosten: ${euro(total)}</p>
      <button class="primary" data-action="save-budget">Budget erstellt markieren</button>
      <a href="#/education?topic=nebenkosten">Mehr erfahren: Nebenkosten</a></div>`);
}

function screenStandingOrder() {
  const s = state.standingOrder;
  return layout("Dauerauftrag", `<div class="card stack"><h2>Dauerauftrag planen</h2>
      <p>Lege alle Daten fest, damit die Miete jeden Monat pünktlich eingeplant ist.</p>
      <label>Empfänger<input id="so-recipient" value="${s.recipient}" /></label>
      <label>IBAN<input id="so-iban" value="${s.iban}" /></label>
      <label>Betrag<input id="so-amount" type="number" min="1" value="${s.amount}" /></label>
      <label>Ausführungstag (1-28)<input id="so-day" type="number" min="1" max="28" value="${s.dayOfMonth}" /></label>
      <label>Verwendungszweck<input id="so-reference" value="${s.reference}" /></label>
      <button class="secondary" data-action="save-standing-order">Plan speichern</button>
      <button class="primary" data-action="toggle-task" data-task-id="standing-order" ${canCompleteStandingOrder() ? "" : "disabled"}>Dauerauftrag als erledigt markieren</button></div>`);
}

function screenInsurance() {
  const i = state.insurance;
  return layout("Versicherung", `<div class="card stack"><h2>Versicherung prüfen</h2>
      <p>Markiere, welche Absicherungen für dich passen. Eine Auswahl + Check reichen für den Prototyp.</p>
      <label class="inline"><input type="checkbox" id="ins-liability" ${i.liabilitySelected ? "checked" : ""}/> Haftpflicht sinnvoll</label>
      <label class="inline"><input type="checkbox" id="ins-household" ${i.householdSelected ? "checked" : ""}/> Hausrat sinnvoll</label>
      <label>Notiz<input id="ins-notes" value="${i.notes}" placeholder="z. B. WG hat bereits Hausrat"/></label>
      <a href="#/education?topic=versicherungen">Mehr erfahren: versicherungen</a>
      <button class="secondary" data-action="save-insurance">Auswahl speichern</button>
      <button class="primary" data-action="toggle-task" data-task-id="insurance" ${canCompleteInsurance() ? "" : "disabled"}>Versicherung als erledigt markieren</button></div>`);
}

function screenDocuments() {
  const docRow = (title, key) => {
    const uploaded = key === "lease" ? state.documents.leaseUploaded : state.documents.depositConfirmationUploaded;
    return `<div class="card task-row"><div><p class="task-title">${title}</p><p class="subtext">${uploaded ? "hochgeladen" : "noch offen"}</p></div>
      <button class="secondary" data-action="start-upload" data-doc="${key}">Datei auswählen & hochladen</button></div>`;
  };
  const history = state.documents.uploads.map((u) => `<li>${u.type}: <strong>${u.filename}</strong> · ${u.date}</li>`).join("");
  return layout("Wohnungsdokumente", `${docRow("Mietvertrag", "lease")}${docRow("Kautionsbestätigung", "depositConfirmation")}
      <div class="card"><h3>Upload-Historie</h3><ul>${history || "<li>Noch keine Uploads</li>"}</ul></div>
      <button class="primary" data-action="toggle-task" data-task-id="documents" ${(state.documents.leaseUploaded && state.documents.depositConfirmationUploaded) ? "" : "disabled"}>Dokumente als erledigt markieren</button>`);
}

function completionSummaryItems() {
  const fixed = ["Kaution organisiert", "Budget erstellt", "Dauerauftrag geplant"];
  const dynamic = state.tasks
    .filter((t) => t.status === "done")
    .map((t) => t.title)
    .filter((title) => !fixed.some((f) => title.toLowerCase().includes(f.split(" ")[0].toLowerCase())));
  return [...fixed, ...dynamic];
}

function screenDone() {
  const completed = state.tasks.filter((t) => t.status === "done");
  const monthly = calculateBudgetTotalExtended(state.budget);
  const items = completionSummaryItems();
  return layout("Abschluss", `<div class="card stack"><h2>🎉 Geschafft!</h2><p>Deine Wohnung ist organisiert.</p>
      <div class="summary-grid"><div><strong>${completed.length}/6</strong><span>Tasks fertig</span></div><div><strong>${euro(monthly)}</strong><span>Monatsbudget</span></div></div>
      <h3>Erledigte Punkte</h3><ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>
      <button class="primary" data-nav="/checklist/first-apartment">Zur Übersicht</button></div>`);
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

window.addEventListener("hashchange", render);

document.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.id === "real-upload") {
    const input = target;
    const file = input.files?.[0];
    if (!file || !state.ui.pendingUploadDoc) return;
    const doc = state.ui.pendingUploadDoc;
    if (doc === "lease") state.documents.leaseUploaded = true;
    if (doc === "depositConfirmation") state.documents.depositConfirmationUploaded = true;
    state.documents.uploads.unshift({ type: doc === "lease" ? "Mietvertrag" : "Kautionsbestätigung", filename: file.name, date: new Date().toLocaleDateString("de-DE") });
    state.ui.pendingUploadDoc = null;
    saveState();
    setToast(`Datei „${file.name}“ hochgeladen`);
    render();
  }
});

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
    setToast("Task als erledigt markiert");
    ensureCompletionNavigation();
    return render();
  }

  if (action === "confirm-amount") {
    const amountInput = document.getElementById("deposit-amount");
    state.deposit.amount = Number(amountInput?.value || 0);
    state.deposit.amountConfirmed = state.deposit.amount > 0;
    saveState();
    return setToast(state.deposit.amountConfirmed ? "Kautionsbetrag bestätigt" : "Bitte gültigen Betrag eingeben");
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

  if (action === "add-budget-item") {
    state.budget.customItems.push({ name: "Neuer Punkt", amount: 0 });
    saveState();
    return render();
  }

  if (action === "remove-budget-item") {
    const index = Number(target.dataset.index);
    state.budget.customItems.splice(index, 1);
    saveState();
    return render();
  }

  if (action === "save-budget") {
    ["rent", "internet", "power", "insurance", "heating", "water", "reserve"].forEach((id) => {
      const input = document.getElementById(id);
      state.budget[id] = Number(input?.value || 0);
    });
    document.querySelectorAll("[data-custom-name]").forEach((el) => {
      const idx = Number(el.dataset.customName);
      state.budget.customItems[idx].name = el.value;
    });
    document.querySelectorAll("[data-custom-amount]").forEach((el) => {
      const idx = Number(el.dataset.customAmount);
      state.budget.customItems[idx].amount = Number(el.value || 0);
    });
    markTask("budget", true);
    state.standingOrder.amount = Number(state.budget.rent || state.standingOrder.amount);
    saveState();
    setToast("Budget gespeichert");
    return render();
  }

  if (action === "save-standing-order") {
    state.standingOrder.recipient = document.getElementById("so-recipient")?.value || "";
    state.standingOrder.iban = document.getElementById("so-iban")?.value || "";
    state.standingOrder.amount = Number(document.getElementById("so-amount")?.value || 0);
    state.standingOrder.dayOfMonth = Number(document.getElementById("so-day")?.value || 0);
    state.standingOrder.reference = document.getElementById("so-reference")?.value || "";
    state.standingOrder.confirmed = true;
    saveState();
    setToast("Dauerauftrag-Plan gespeichert");
    return render();
  }

  if (action === "save-insurance") {
    state.insurance.liabilitySelected = Boolean(document.getElementById("ins-liability")?.checked);
    state.insurance.householdSelected = Boolean(document.getElementById("ins-household")?.checked);
    state.insurance.notes = document.getElementById("ins-notes")?.value || "";
    state.insurance.checked = true;
    saveState();
    setToast("Versicherungscheck gespeichert");
    return render();
  }

  if (action === "start-upload") {
    state.ui.pendingUploadDoc = target.dataset.doc;
    saveState();
    document.getElementById("real-upload")?.click();
    return;
  }

  if (action === "reset") {
    localStorage.removeItem(STORAGE_KEY);
    state = clone(defaultState);
    go("/");
    return render();
  }
});

window.addEventListener("load", () => {
  if (!window.location.hash) go("/");
  render();
});
