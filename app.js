import { calculateBudgetTotal, canCompleteDeposit, calculateProgress } from "./utils.mjs";

const STORAGE_KEY = "first-apartment-prototype-v1";

const defaultState = {
  tasks: [
    { id: "lease", title: "Mietvertrag hochladen", status: "open", description: "Lade deinen Mietvertrag hoch, damit alles an einem Ort liegt.", educationTopics: [] },
    { id: "deposit", title: "Kaution organisieren", status: "open", description: "Bestätige den Betrag und kläre die Unterschriften in der WG.", educationTopics: ["kaution", "wg-kaution"] },
    { id: "budget", title: "Budget planen", status: "open", description: "Schätze deine monatlichen Wohnkosten realistisch ein.", educationTopics: ["nebenkosten"] },
    { id: "standing-order", title: "Dauerauftrag einrichten", status: "open", description: "Plane die regelmäßige Mietzahlung.", educationTopics: [] },
    { id: "insurance", title: "Versicherung prüfen", status: "open", description: "Prüfe, welche Absicherung für dich sinnvoll ist.", educationTopics: ["versicherungen"] },
    { id: "documents", title: "Dokumente speichern", status: "open", description: "Speichere wichtige Unterlagen wie Mietvertrag und Kautionsbestätigung.", educationTopics: [] }
  ],
  deposit: {
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
    insurance: 18
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

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return clone(defaultState);
  try {
    return { ...clone(defaultState), ...JSON.parse(raw) };
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
  }, 1600);
}

function go(path) {
  window.location.hash = `#${path}`;
}

function taskById(id) {
  return state.tasks.find((task) => task.id === id);
}

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
}

function ensureCompletionNavigation() {
  const progress = calculateProgress(state.tasks);
  if (progress.done === progress.total && route().path !== "/done") {
    go("/done");
  }
}

function route() {
  const hash = window.location.hash.replace("#", "") || "/";
  const [path, queryString] = hash.split("?");
  const query = new URLSearchParams(queryString || "");
  if (path.startsWith("/task/")) {
    return { path: "/task/:taskId", taskId: path.replace("/task/", ""), query };
  }
  return { path, query };
}

function taskSubAction(task) {
  if (task.id === "deposit") return `<button class="secondary" data-nav="/deposit">Kautionsflow öffnen</button>`;
  if (task.id === "budget") return `<button class="secondary" data-nav="/budget">Budget öffnen</button>`;
  if (task.id === "documents" || task.id === "lease") return `<button class="secondary" data-nav="/documents">Dokumente öffnen</button>`;
  return "";
}

function getNextOpenTaskId() {
  return state.tasks.find((task) => task.status === "open")?.id;
}

function layout(title, content, { showBack = true } = {}) {
  return `
    <div class="app-shell">
      <header>
        ${showBack ? '<button class="ghost" data-back="1">←</button>' : ""}
        <h1>Erste Wohnung · ${title}</h1>
      </header>
      <main>
        ${content}
        ${state.ui.toast ? `<div class="toast">${state.ui.toast}</div>` : ""}
      </main>
      <footer>
        <button class="ghost" data-nav="/checklist/first-apartment">Zur Checkliste</button>
        <button class="ghost" data-action="reset">Reset Prototype</button>
      </footer>
    </div>`;
}

function screenHome() {
  return layout(
    "Home",
    `<div class="tile" data-nav="/onboarding/first-apartment">
      <h2>🏠 Erste eigene Wohnung</h2>
      <p>Starte dein Life-Moment Onboarding jetzt.</p>
    </div>`,
    { showBack: false }
  );
}

function screenOnboarding() {
  return layout(
    "Onboarding",
    `<div class="card stack">
      <h2>Ziehst du in deine erste Wohnung?</h2>
      <p>Wir helfen dir Schritt für Schritt bei Kaution, Budget, Zahlungen und Versicherungen.</p>
      <button class="primary" data-nav="/checklist/first-apartment">Start Checkliste</button>
    </div>`
  );
}

function screenChecklist() {
  const progress = calculateProgress(state.tasks);
  const next = getNextOpenTaskId();
  const rows = state.tasks
    .map(
      (t) => `<div class="card task-row">
      <div>
        <p class="task-title">${t.status === "done" ? "✓" : "○"} ${t.title}</p>
        <p class="subtext">${t.description}</p>
      </div>
      <div class="stack">
        <span class="${t.status === "done" ? "status-done" : "status-open"}">${t.status === "done" ? "Erledigt" : "Offen"}</span>
        <button class="secondary" data-nav="/task/${t.id}">Öffnen</button>
      </div>
    </div>`
    )
    .join("");

  return layout(
    "Checkliste",
    `<div class="card">
      <strong>Fortschritt: ${progress.done}/${progress.total} erledigt</strong>
      <p class="subtext">Nächster Schritt: ${next ? taskById(next).title : "Alles fertig"}</p>
    </div>
    ${rows}
    <button class="ghost" data-nav="/education">📚 Wohnung verstehen</button>`
  );
}

function taskCanBeDone(taskId) {
  if (taskId === "deposit") return canCompleteDeposit(state.deposit);
  if (taskId === "lease") return state.documents.leaseUploaded;
  if (taskId === "documents") return state.documents.leaseUploaded && state.documents.depositConfirmationUploaded;
  return true;
}

function taskHints(taskId) {
  if (taskId === "deposit") return "Bitte Betrag bestätigen und alle Unterschriften simulieren.";
  if (taskId === "lease") return "Bitte zuerst Upload im Dokumentenbereich simulieren.";
  if (taskId === "documents") return "Mietvertrag + Kautionsbestätigung müssen vorhanden sein.";
  return "";
}

function screenTask(taskId) {
  const task = taskById(taskId);
  if (!task) return layout("Task", `<p>Task nicht gefunden.</p>`);
  const canDone = taskCanBeDone(taskId);

  return layout(
    "Task Detail",
    `<div class="card stack">
      <h2>${task.title}</h2>
      <p>${task.description}</p>
      ${task.educationTopics
        .slice(0, 2)
        .map((topic) => `<a href="#/education?topic=${topic}">Mehr erfahren: ${topic}</a>`)
        .join("")}
      ${taskSubAction(task)}
      <button class="primary" data-action="toggle-task" data-task-id="${task.id}" ${canDone ? "" : "disabled"}>Als erledigt markieren</button>
      ${!canDone ? `<p class="subtext">${taskHints(task.id)}</p>` : ""}
    </div>`
  );
}

function screenEducation(query) {
  const focus = query.get("topic");
  const section = (id, title, text) => `<div class="card" id="${id}" style="${focus === id ? "border-color:#2c67f2" : ""}"><h3>${title}</h3><p>${text}</p></div>`;
  return layout(
    "📚 Wohnung verstehen",
    `${section("kaution", "Kaution", "Die Mietkaution ist eine Sicherheitszahlung fürs Mietverhältnis. Oft sind es bis zu drei Monatsmieten. Das Geld bleibt gesperrt und wird am Ende zurückbezahlt, wenn alles ok ist.")}
     ${section("nebenkosten", "Nebenkosten", "Nebenkosten sind zusätzliche Kosten zur Miete, z.B. Heizung oder Wasser. Sie werden oft pauschal oder als Akonto bezahlt. Am Jahresende gibt es eine Abrechnung.")}
     ${section("versicherungen", "Versicherungen", "Haftpflicht hilft, wenn du anderen aus Versehen Schaden machst. Hausrat deckt dein Eigentum in der Wohnung, z.B. bei Diebstahl oder Wasser. Welche sinnvoll ist, hängt von deiner Situation ab.")}
     ${section("wg-kaution", "WG-Kaution", "In WGs müssen oft mehrere Personen mitmachen. Entscheidend ist, dass alle beteiligten Personen bestätigen können. Ein klarer Status verhindert Stress und Fristprobleme.")}
     <button class="ghost" data-nav="/checklist/first-apartment">← Zurück zur Checkliste</button>`
  );
}

function screenDeposit() {
  const signed = state.deposit.roommates.filter((r) => r.status === "signed").length;
  return layout(
    "Kaution",
    `<div class="card stack">
      <h2>Kaution organisieren</h2>
      <p>Schritte: 1) Betrag bestätigen 2) Mitbewohner einladen 3) Unterschreiben</p>
      <button class="${state.deposit.amountConfirmed ? "secondary" : "primary"}" data-action="confirm-amount">${state.deposit.amountConfirmed ? "Betrag bestätigt ✓" : "Betrag bestätigen"}</button>
      <button class="secondary" data-nav="/deposit/invite">Mitbewohner einladen</button>
      <p class="subtext">Status: ${signed}/${state.deposit.roommates.length} unterschrieben</p>
      <button class="primary" data-action="toggle-task" data-task-id="deposit" ${canCompleteDeposit(state.deposit) ? "" : "disabled"}>Kaution als erledigt markieren</button>
    </div>`
  );
}

function screenInvite() {
  const signed = state.deposit.roommates.filter((r) => r.status === "signed").length;
  const items = state.deposit.roommates
    .map(
      (r, idx) => `<div class="card task-row">
      <div>
        <p class="task-title">${r.name}</p>
        <p class="subtext">${r.status === "signed" ? `${r.name} ✓ unterschrieben` : `${r.name} ⏳ offen`}</p>
      </div>
      <button class="secondary" data-action="sign" data-index="${idx}" ${r.status === "signed" ? "disabled" : ""}>Unterschrift simulieren</button>
    </div>`
    )
    .join("");
  return layout(
    "Invite",
    `<div class="card stack">
      <h2>Mitbewohner einladen</h2>
      <p><strong>${signed}/${state.deposit.roommates.length} unterschrieben</strong></p>
      <div class="inline"><input id="roommate-name" placeholder="Name eingeben" /><button class="primary" data-action="add-roommate">Hinzufügen</button></div>
    </div>
    ${items}
    <button class="ghost" data-nav="/deposit">← Zurück zur Kaution</button>`
  );
}

function numberInput(id, value, label) {
  return `<label>${label}<input type="number" id="${id}" value="${value}" min="0" /></label>`;
}

function screenBudget() {
  const total = calculateBudgetTotal(state.budget);
  return layout(
    "Budget",
    `<div class="card stack">
      <h2>Budgetübersicht</h2>
      ${numberInput("rent", state.budget.rent, "Miete")}
      ${numberInput("internet", state.budget.internet, "Internet")}
      ${numberInput("power", state.budget.power, "Strom")}
      ${numberInput("insurance", state.budget.insurance, "Versicherung")}
      <p class="total">Total: ${total} €</p>
      <button class="primary" data-action="save-budget">Budget erstellt markieren</button>
      <a href="#/education?topic=nebenkosten">Mehr erfahren: Nebenkosten</a>
    </div>`
  );
}

function screenDocuments() {
  const uploadRow = (title, key) => {
    const uploaded = key === "lease" ? state.documents.leaseUploaded : state.documents.depositConfirmationUploaded;
    return `<div class="card task-row">
      <div>
        <p class="task-title">${title}</p>
        <p class="subtext">${uploaded ? "hochgeladen" : "noch offen"}</p>
      </div>
      <button class="secondary" data-action="upload" data-doc="${key}">Dokument hochladen</button>
    </div>`;
  };

  const history = state.documents.uploads
    .map((u) => `<li>${u.type} · ${u.date}</li>`)
    .join("");

  return layout(
    "Wohnungsdokumente",
    `${uploadRow("Mietvertrag", "lease")}
     ${uploadRow("Kautionsbestätigung", "depositConfirmation")}
     <div class="card">
      <h3>Upload-Historie</h3>
      <ul>${history || "<li>Noch keine Uploads</li>"}</ul>
     </div>
     <button class="primary" data-action="toggle-task" data-task-id="documents" ${(state.documents.leaseUploaded && state.documents.depositConfirmationUploaded) ? "" : "disabled"}>Dokumente als erledigt markieren</button>`
  );
}

function screenDone() {
  const completed = state.tasks.filter((t) => t.status === "done");
  return layout(
    "Abschluss",
    `<div class="card stack">
      <h2>🎉 Geschafft!</h2>
      <p>Deine Wohnung ist organisiert.</p>
      <ul>
        <li>Kaution eingerichtet</li>
        <li>Budget erstellt</li>
        <li>Dauerauftrag geplant</li>
        ${completed.map((t) => `<li>${t.title}</li>`).join("")}
      </ul>
      <button class="primary" data-nav="/checklist/first-apartment">Zur Übersicht</button>
    </div>`
  );
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
  if (nav) {
    go(nav);
    return;
  }
  if (target.dataset.back) {
    history.back();
    return;
  }

  const action = target.dataset.action;
  if (!action) return;

  if (action === "toggle-task") {
    const id = target.dataset.taskId;
    if (!id) return;
    if (!taskCanBeDone(id)) return;
    markTask(id, true);
    setToast("Task als erledigt markiert");
    ensureCompletionNavigation();
    render();
  }

  if (action === "confirm-amount") {
    state.deposit.amountConfirmed = true;
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
    render();
  }

  if (action === "sign") {
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) return;
    state.deposit.roommates[index].status = "signed";
    saveState();
    setToast(`${state.deposit.roommates[index].name} hat unterschrieben`);
    render();
  }

  if (action === "save-budget") {
    ["rent", "internet", "power", "insurance"].forEach((id) => {
      const input = document.getElementById(id);
      state.budget[id] = Number(input?.value || 0);
    });
    markTask("budget", true);
    saveState();
    setToast("Budget gespeichert");
    render();
  }

  if (action === "upload") {
    const doc = target.dataset.doc;
    const now = new Date().toLocaleDateString("de-DE");
    if (doc === "lease") state.documents.leaseUploaded = true;
    if (doc === "depositConfirmation") state.documents.depositConfirmationUploaded = true;
    state.documents.uploads.unshift({ type: doc === "lease" ? "Mietvertrag" : "Kautionsbestätigung", date: now });
    saveState();
    setToast("Dokument hochgeladen");
    render();
  }

  if (action === "reset") {
    localStorage.removeItem(STORAGE_KEY);
    state = clone(defaultState);
    go("/");
    render();
  }
});

window.addEventListener("load", () => {
  if (!window.location.hash) go("/");
  render();
});
