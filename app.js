"use strict";

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "worksalary-v1";
const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});

let data = { version: 1, companies: [], entries: [] };
let storageReady = true;
let selectedEntryShift = "all";

function localDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

function newId() {
  return crypto.randomUUID();
}

function message(text, error = false) {
  $("message").textContent = text;
  $("message").classList.toggle("error", error);
}

function validDate(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function validData(value) {
  if (!value || value.version !== 1 ||
      !Array.isArray(value.companies) ||
      !Array.isArray(value.entries)) return false;

  const ids = new Set();
  const names = new Set();

  for (const company of value.companies) {
    if (!company ||
        typeof company.id !== "string" || !company.id ||
        ids.has(company.id) ||
        typeof company.name !== "string" ||
        !company.name.trim() ||
        company.name.length > 80) return false;

    const name = company.name.trim().toLowerCase();
    if (names.has(name)) return false;

    ids.add(company.id);
    names.add(name);
  }

  const entryIds = new Set();
  let total = 0;

  for (const entry of value.entries) {
    if (!entry ||
        typeof entry.id !== "string" || !entry.id ||
        entryIds.has(entry.id) ||
        !ids.has(entry.companyId) ||
        !validDate(entry.date) ||
        !["day", "night"].includes(entry.shift) ||
        !Number.isSafeInteger(entry.amount) ||
        entry.amount < 0 ||
        typeof entry.note !== "string" ||
        entry.note.length > 500) return false;

    entryIds.add(entry.id);
    total += entry.amount;
    if (!Number.isSafeInteger(total)) return false;
  }

  return true;
}

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) {
    const parsed = JSON.parse(saved);
    if (!validData(parsed)) throw new Error("Invalid data");
    data = parsed;
  }
} catch {
  storageReady = false;
  message(
    "Saved data could not be loaded. Changes are disabled to protect it. " +
    "Try reopening this app in your usual browser.",
    true
  );
}

// Save first, then update the screen.
function commit(next) {
  if (!storageReady) {
    message("Storage is unavailable. Your changes were not saved.", true);
    return false;
  }

  if (!validData(next)) {
    message("Please check the entered information.", true);
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    data = next;
    render();
    return true;
  } catch {
    message(
      "Could not save. Browser storage may be full or blocked. " +
      "Download a backup of your existing data.",
      true
    );
    return false;
  }
}

function copyData() {
  return JSON.parse(JSON.stringify(data));
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function action(text, className, handler) {
  const button = element("button", text, className);
  button.type = "button";
  button.addEventListener("click", handler);
  return button;
}

function companyName(id) {
  return data.companies.find((company) => company.id === id)?.name || "";
}

function fillCompanySelect(id, firstText, firstValue) {
  const select = $(id);
  const previous = select.value;
  select.replaceChildren();

  const first = element("option", firstText);
  first.value = firstValue;
  select.append(first);

  for (const company of data.companies) {
    const option = element("option", company.name);
    option.value = company.id;
    select.append(option);
  }

  if ([...select.options].some((option) => option.value === previous)) {
    select.value = previous;
  }
}

function resetEntry() {
  $("entry-form").reset();
  $("entry-id").value = "";
  $("entry-date").value = localDate();
  $("entry-heading").textContent = "Add Work Entry";
  $("save-entry").textContent = "Save Entry";
  $("cancel-edit").hidden = true;

  if (data.companies.length === 1) {
    $("entry-company").value = data.companies[0].id;
  }
}

function editEntry(entry) {
  $("entry-id").value = entry.id;
  $("entry-company").value = entry.companyId;
  $("entry-date").value = entry.date;
  $("entry-shift").value = entry.shift;
  $("entry-amount").value = entry.amount;
  $("entry-note").value = entry.note;
  $("entry-heading").textContent = "Edit Work Entry";
  $("save-entry").textContent = "Update Entry";
  $("cancel-edit").hidden = false;
  $("entry-form").scrollIntoView({ block: "start" });
  $("entry-company").focus();
}

function renderCompanies() {
  fillCompanySelect("entry-company", "Select a company", "");
  fillCompanySelect("filter-company", "All Companies", "all");

  const list = $("company-list");
  list.replaceChildren();

  for (const company of data.companies) {
    const item = element("li", undefined, "company-item");
    item.append(element("span", company.name, "company-name"));

    const actions = element("div", undefined, "actions");

    actions.append(action("Rename", "secondary", () => {
      const answer = prompt("Company name:", company.name);
      if (answer === null) return;

      const name = answer.trim();
      if (!name || name.length > 80) {
        message("Enter a company name with 1–80 characters.", true);
        return;
      }

      if (data.companies.some((other) =>
        other.id !== company.id &&
        other.name.toLowerCase() === name.toLowerCase()
      )) {
        message("This company name already exists.", true);
        return;
      }

      const next = copyData();
      next.companies.find((item) => item.id === company.id).name = name;
      if (commit(next)) message("Company renamed.");
    }));

  actions.append(action("Delete", "danger", async () => {
      const count = data.entries.filter(
        (entry) => entry.companyId === company.id
      ).length;

     if (!await appConfirm(
        `Delete "${company.name}" and its ${count} work entries? ` +
        "This cannot be undone. Download a backup first if needed."
      )) return;

      const next = copyData();
      next.companies = next.companies.filter(
        (item) => item.id !== company.id
      );
      next.entries = next.entries.filter(
        (entry) => entry.companyId !== company.id
      );

      const editingThisCompany =
        $("entry-company").value === company.id;

      if (commit(next)) {
        if (editingThisCompany) resetEntry();
        message("Company and its work entries deleted.");
      }
    }));

    item.append(actions);
    list.append(item);
  }

  $("save-entry").disabled =
    !storageReady || data.companies.length === 0;
}

function totals(entries) {
  const day = entries
    .filter((entry) => entry.shift === "day")
    .reduce((sum, entry) => sum + entry.amount, 0);

  const night = entries
    .filter((entry) => entry.shift === "night")
    .reduce((sum, entry) => sum + entry.amount, 0);

  return { day, night, total: day + night };
}

function renderEntries() {
  const month = $("filter-month").value;
  const selectedCompany = $("filter-company").value;

 const monthEntries = data.entries
    .filter((entry) =>
      month !== "" &&
      entry.date.slice(0, 7) === month &&
      (selectedCompany === "all" ||
        entry.companyId === selectedCompany)
    )
    .sort((a, b) =>
      b.date.localeCompare(a.date) ||
      a.shift.localeCompare(b.shift)
    );

      const entries = monthEntries.filter((entry) =>
    selectedEntryShift === "all" ||
    entry.shift === selectedEntryShift
  );

  const summary = totals(monthEntries);
  $("day-total").textContent = yen.format(summary.day);
  $("night-total").textContent = yen.format(summary.night);
  $("grand-total").textContent = yen.format(summary.total);

  const companyTotals = $("company-totals");
  companyTotals.replaceChildren();

  for (const company of data.companies) {
    if (selectedCompany !== "all" &&
        selectedCompany !== company.id) continue;

    const companyEntries = monthEntries.filter(
      (entry) => entry.companyId === company.id
    );
    const sum = totals(companyEntries);

    const card = element("article", undefined, "company-total");
    card.append(
      element("h4", company.name),
      element("p", `Day: ${yen.format(sum.day)}`),
      element("p", `Night: ${yen.format(sum.night)}`),
      element("strong", `Total: ${yen.format(sum.total)}`)
    );
    companyTotals.append(card);
  }

   const list = $("entry-list");
  list.replaceChildren();
  $("empty-state").hidden = entries.length > 0;

   const dayCount = monthEntries.filter(
    (entry) => entry.shift === "day"
  ).length;

  const nightCount = monthEntries.filter(
    (entry) => entry.shift === "night"
  ).length;

  const counts = element("div", undefined, "summary");
  counts.setAttribute("role", "group");
  counts.setAttribute("aria-label", "Filter entries by shift");

  for (const [label, value, shift] of [
    ["Day Shifts", dayCount, "day"],
    ["Night Shifts", nightCount, "night"],
    ["Total Shifts", monthEntries.length, "all"]
  ]) {
    const button = element("button", undefined, "shift-filter");
    button.type = "button";

    const active = selectedEntryShift === shift;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));

    button.append(
      element("span", label, "shift-filter-label"),
      element("span", String(value), "shift-filter-count")
    );

    button.addEventListener("click", () => {
      selectedEntryShift = shift;
      renderEntries();

      // Keep keyboard focus on the selected filter.
      $("entry-list")
        .querySelector('[aria-pressed="true"]')
        ?.focus({ preventScroll: true });
    });

    counts.append(button);
  }

  list.append(counts);

  const shiftLabel = selectedEntryShift === "all"
    ? "All shifts"
    : selectedEntryShift === "day"
      ? "Day shifts"
      : "Night shifts";

  $("empty-state").textContent =
    `No entries for the selected month and company (${shiftLabel}).`;

  if (entries.length === 0) return;

  const wrapper = element("div", undefined, "table-wrapper");
  const table = element("table", undefined, "entries-table");

  const caption = element(
    "caption",
    `Work entries for ${month} — ${
      selectedCompany === "all"
        ? "All Companies"
        : companyName(selectedCompany)
    }`
  );

  table.append(caption);

  const head = document.createElement("thead");
  const headingRow = document.createElement("tr");

  for (const title of [
    "Date", "Company", "Shift", "Earnings", "Notes", "Actions"
  ]) {
    const cell = element("th", title);
    cell.scope = "col";
    headingRow.append(cell);
  }

  head.append(headingRow);
  table.append(head);

  const body = document.createElement("tbody");

  for (const entry of entries) {
    const row = document.createElement("tr");

    row.append(
      element("td", entry.date),
      element("td", companyName(entry.companyId))
    );

    const shiftCell = document.createElement("td");
    shiftCell.append(
      element(
        "span",
        entry.shift === "day" ? "Day" : "Night",
        `shift-badge ${entry.shift}`
      )
    );

    row.append(
      shiftCell,
      element("td", yen.format(entry.amount), "money-cell"),
      element("td", entry.note || "—", "entry-note")
    );

    const actionsCell = document.createElement("td");
    const actions = element("div", undefined, "actions");

    actions.append(
      action("Edit", "secondary", () => editEntry(entry)),
   action("Delete", "danger", async () => {
       if (!await appConfirm(
          `Delete this ${entry.shift} entry for ${entry.date}?`
        )) return;

        const next = copyData();
        next.entries = next.entries.filter(
          (item) => item.id !== entry.id
        );

        const wasEditing = $("entry-id").value === entry.id;

        if (commit(next)) {
          if (wasEditing) resetEntry();
          message("Entry deleted.");
        }
      })
    );

    actionsCell.append(actions);
    row.append(actionsCell);
    body.append(row);
  }

  table.append(body);

  const foot = document.createElement("tfoot");
  const totalRow = document.createElement("tr");
  const totalLabel = element("th", "Total Earnings");
  totalLabel.scope = "row";
  totalLabel.colSpan = 3;

  const totalAmount = element(
    "td",
   yen.format(totals(entries).total),
    "money-cell"
  );

  const remaining = document.createElement("td");
  remaining.colSpan = 2;

  totalRow.append(totalLabel, totalAmount, remaining);
  foot.append(totalRow);
  table.append(foot);

  wrapper.append(table);
  list.append(wrapper);
}

function render() {
  renderCompanies();
  renderEntries();
}

$("company-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("company-name").value.trim();

  if (!name || name.length > 80) {
    message("Enter a company name with 1–80 characters.", true);
    return;
  }

  if (data.companies.some(
    (company) => company.name.toLowerCase() === name.toLowerCase()
  )) {
    message("This company already exists.", true);
    return;
  }

  const next = copyData();
  const company = { id: newId(), name };
  next.companies.push(company);

  if (commit(next)) {
    $("company-form").reset();
    if (!$("entry-id").value) {
      $("entry-company").value = company.id;
    }
    message("Company added.");
    showScreen("work-screen");
$("entry-date").focus();
  }
});

$("entry-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const existingId = $("entry-id").value;
  const rawAmount = $("entry-amount").value;
  const amount = Number(rawAmount);

  if (rawAmount.trim() === "" ||
      !Number.isSafeInteger(amount) || amount < 0) {
    message("Enter a valid whole-yen amount of 0 or more.", true);
    return;
  }

  const entry = {
    id: existingId || newId(),
    companyId: $("entry-company").value,
    date: $("entry-date").value,
    shift: $("entry-shift").value,
    amount,
    note: $("entry-note").value.trim()
  };

  const next = copyData();

  if (existingId) {
    const index = next.entries.findIndex(
      (item) => item.id === existingId
    );
    if (index === -1) {
      message("This entry no longer exists. Cancel editing.", true);
      return;
    }
    next.entries[index] = entry;
  } else {
    next.entries.push(entry);
  }

  if (commit(next)) {
    $("filter-month").value = entry.date.slice(0, 7);
    $("filter-company").value = entry.companyId;
    resetEntry();
    renderEntries();
    message(existingId ? "Entry updated." : "Entry saved.");
  }
});

$("cancel-edit").addEventListener("click", resetEntry);
$("filter-month").addEventListener("change", renderEntries);
$("filter-company").addEventListener("change", renderEntries);

$("export-backup").addEventListener("click", () => {
  if (!storageReady) {
    message("Stored data could not be loaded for backup.", true);
    return;
  }

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `WorkSalary-backup-${localDate()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  message("Backup download requested. Keep the file somewhere safe.");
});

$("import-backup").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Backup is too large.");
    }

    const restored = JSON.parse(await file.text());
    if (!validData(restored)) {
      throw new Error("This is not a valid WorkSalary backup.");
    }

 if (!await appConfirm(
  "This will replace all current companies and work entries. " +
  "Download your current backup first if needed.",
  "Restore this backup?",
  "Restore"
)) return;

    if (commit(restored)) {
      resetEntry();
      message("Backup restored.");
    }
  } catch (error) {
    message(
      error instanceof SyntaxError
        ? "The backup file is not valid JSON."
        : error.message,
      true
    );
  } finally {
    event.target.value = "";
  }
});

$("filter-month").value = localDate().slice(0, 7);
render();
resetEntry();

// Screen navigation
const screenButtons = document.querySelectorAll("[data-screen]");
const appScreens = document.querySelectorAll("main > section");

function showScreen(screenId) {
  if (!document.getElementById(screenId)) return;

  for (const screen of appScreens) {
    screen.hidden = screen.id !== screenId;
  }

  for (const button of screenButtons) {
    const active = button.dataset.screen === screenId;
    button.classList.toggle("active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  }

  document.querySelector("main").scrollTop = 0;
}

for (const button of screenButtons) {
  button.addEventListener("click", () => {
    showScreen(button.dataset.screen);
  });
}

// Add filters to the Work Entries screen.
// These stay in sync with the Overview filters.
const entriesFilters = document.createElement("div");

const entriesMonthLabel = element("label", "Month");
entriesMonthLabel.htmlFor = "entries-month";

const entriesMonth = document.createElement("input");
entriesMonth.type = "month";
entriesMonth.id = "entries-month";
entriesMonth.value = $("filter-month").value;

const entriesCompanyLabel = element("label", "Company");
entriesCompanyLabel.htmlFor = "entries-company";

const entriesCompany = document.createElement("select");
entriesCompany.id = "entries-company";

entriesFilters.append(
  entriesMonthLabel,
  entriesMonth,
  entriesCompanyLabel,
  entriesCompany
);

$("entries-screen").insertBefore(entriesFilters, $("empty-state"));
entriesFilters.style.marginBottom = "20px";

function syncEntryFilters() {
  entriesMonth.value = $("filter-month").value;
  entriesCompany.replaceChildren(
    ...Array.from(
      $("filter-company").options,
      (option) => option.cloneNode(true)
    )
  );
  entriesCompany.value = $("filter-company").value;
}

entriesMonth.addEventListener("change", () => {
  $("filter-month").value = entriesMonth.value;
  renderEntries();
});

entriesCompany.addEventListener("change", () => {
  $("filter-company").value = entriesCompany.value;
  renderEntries();
});

$("filter-month").addEventListener("change", syncEntryFilters);
$("filter-company").addEventListener("change", syncEntryFilters);

// Update the extra filters when companies or saved entries change.
const originalRender = render;
render = function () {
  originalRender();
  syncEntryFilters();
};

// Open Add Work before loading an entry for editing.
const originalEditEntry = editEntry;
editEntry = function (entry) {
  showScreen("work-screen");
  originalEditEntry(entry);
};

// Saving an entry changes the selected month/company.
$("entry-form").addEventListener("submit", syncEntryFilters);

syncEntryFilters();
showScreen(
  data.companies.length === 0
    ? "companies-screen"
    : "salary-screen"
);

// Enable offline support.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (error) {
      console.error("Offline setup failed:", error);
      message(
        "Offline setup failed. Please connect to the internet and reopen the app.",
        true
      );
    }
  });
}

function appConfirm(
  description,
  title = "Delete this item?",
  buttonText = "Delete"
) {
  return new Promise((resolve) => {
    const dialog = $("confirm-dialog");
    const cancelButton = $("confirm-cancel");
    const acceptButton = $("confirm-accept");

    $("confirm-title").textContent = title;
    $("confirm-description").textContent = description;
    acceptButton.textContent = buttonText;

    const previousFocus = document.activeElement;
    let finished = false;

    function finish(accepted) {
      if (finished) return;
      finished = true;

      cancelButton.removeEventListener("click", cancel);
      acceptButton.removeEventListener("click", accept);
      dialog.removeEventListener("cancel", escape);
      dialog.removeEventListener("close", closed);

      if (dialog.open) dialog.close();

      if (previousFocus instanceof HTMLElement &&
          previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }

      resolve(accepted);
    }

    function cancel() {
      finish(false);
    }

    function accept() {
      finish(true);
    }

    function escape(event) {
      event.preventDefault();
      finish(false);
    }

    function closed() {
      finish(false);
    }

    cancelButton.addEventListener("click", cancel);
    acceptButton.addEventListener("click", accept);
    dialog.addEventListener("cancel", escape);
    dialog.addEventListener("close", closed);

    dialog.showModal();
    cancelButton.focus();
  });
}