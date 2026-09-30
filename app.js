const DATA_URL = "./data/opportunities.json";
const SGT = "Asia/Singapore";

const FORMAT_LABEL = {
  hackathon: "Hackathon",
  "open-call": "Open call",
  "film-festival": "Film festival",
  prize: "Prize",
  challenge: "Challenge",
  accelerator: "Accelerator",
  other: "Other",
};
const MODE_LABEL = { online: "Online", hybrid: "Hybrid", irl: "IRL" };
const NOTE_LABEL = {
  cash: "Cash",
  tokens: "Tokens",
  grants: "Grants",
  "in-kind": "In kind",
  tbd: "TBD",
  none: "None",
};
const PALETTES = [
  ["#3a221c", "#c4653a", "#f0d7a8"],
  ["#2c1814", "#a34828", "#e7c9a2"],
  ["#243026", "#c46a3a", "#d5e4cc"],
  ["#3d2618", "#8d4a2c", "#f3d7b4"],
];

const $ = (id) => document.getElementById(id);
const board = $("board");
const statusEl = $("status");
const params = new URLSearchParams(location.search);

let items = [];
let meta = {};
let lane = "all";
let mode = "all";
let formats = new Set();
let sortKey = "deadline";
let view = document.documentElement.getAttribute("data-view") || "cards";
let theme = document.documentElement.getAttribute("data-theme") || "dark";

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function safeUrl(url) {
  return /^https?:\/\//i.test(url || "") ? url : "";
}

function parseTime(iso) {
  if (!iso) return null;
  const value = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00Z` : iso;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

function fmtWhen(iso) {
  if (!iso) return "TBD";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const t = parseTime(iso);
  if (t == null) return "TBD";
  const opts = dateOnly
    ? { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
    : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: SGT };
  const text = new Intl.DateTimeFormat("en-GB", opts).format(t);
  return dateOnly ? text : `${text} SGT`;
}

function countdown(iso) {
  const t = parseTime(iso);
  if (t == null) return { label: "—", kind: "unknown" };
  const ms = t - Date.now();
  if (ms < 0) return { label: "Closed", kind: "expired" };
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return { label: `${Math.max(mins, 1)}m`, kind: "soon" };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { label: `${hours}h`, kind: "soon" };
  const days = Math.ceil(ms / 86400000);
  if (days <= 7) return { label: `T-${days}d`, kind: "week" };
  return { label: `${days}d`, kind: "ok" };
}

function initials(name) {
  const skip = new Set(["the", "a", "an", "of", "and", "for", "x", "in", "on", "to"]);
  const words = String(name).split(/[^A-Za-z0-9+]+/).filter(Boolean);
  const picked = words.filter((word) => !skip.has(word.toLowerCase()));
  return (picked.length ? picked : words).slice(0, 2).map((word) => word[0].toUpperCase()).join("") || "•";
}

function paletteStyle(id) {
  let h = 0;
  for (const ch of id) h = (h + ch.charCodeAt(0)) % PALETTES.length;
  const [a, b, c] = PALETTES[h];
  return `background:linear-gradient(145deg,${a} 0%,${b} 62%,${c} 140%)`;
}

function prizeBits(item) {
  const label = item.prizeLabel || item.prize || "Prize TBD";
  const note = NOTE_LABEL[item.prizeAmountNote] || "";
  let extra = "";
  if (item.prizeAmountUsd != null) extra = `~${moneyFmt.format(item.prizeAmountUsd)} · ${note}`;
  else if (note && note !== "TBD") extra = note;
  else if (!/tbd/i.test(label)) extra = "Amount TBD";
  return { label, extra };
}

function regSortKey(item) {
  return parseTime(item.registrationOpens) ?? parseTime(item.registrationCloses) ?? Infinity;
}

function compare(a, b) {
  let diff = 0;
  if (sortKey === "name") diff = a.name.localeCompare(b.name);
  else if (sortKey === "prize") {
    const an = a.prizeAmountUsd == null;
    const bn = b.prizeAmountUsd == null;
    if (an && bn) diff = 0;
    else if (an) diff = 1;
    else if (bn) diff = -1;
    else diff = b.prizeAmountUsd - a.prizeAmountUsd;
  } else if (sortKey === "registration") {
    diff = regSortKey(a) - regSortKey(b);
  } else {
    const at = parseTime(a.deadline);
    const bt = parseTime(b.deadline);
    diff = (at ?? Infinity) - (bt ?? Infinity);
  }
  return diff || a.name.localeCompare(b.name);
}

function visibleItems() {
  const q = ($("q").value || "").trim().toLowerCase();
  const hide = $("hideExpired").checked;
  return items.filter((item) => {
    if (lane !== "all" && item.lane !== lane) return false;
    if (mode !== "all" && item.mode !== mode) return false;
    if (formats.size && !formats.has(item.format)) return false;
    if (hide) {
      const t = parseTime(item.deadline);
      if (t != null && t < Date.now()) return false;
    }
    if (!q) return true;
    const blob = [
      item.name,
      item.fit,
      item.prize,
      item.prizeLabel,
      item.deadlineLabel,
      item.registrationLabel,
      item.residencyRisk,
      FORMAT_LABEL[item.format],
      MODE_LABEL[item.mode],
      item.lane,
      ...(item.tags || []),
    ].join(" ").toLowerCase();
    return blob.includes(q);
  }).sort(compare);
}

function thumbHTML(item, large) {
  if (item.image) {
    return `<div class="thumb ${large ? "thumb-lg" : ""}"><img src="${esc(item.image)}" alt="" data-name="${esc(item.name)}" width="84" height="84" /></div>`;
  }
  return `<div class="thumb ${large ? "thumb-lg" : ""} fallback" style="${paletteStyle(item.id)}" aria-hidden="true">${esc(initials(item.name))}</div>`;
}

function mediaHTML(item) {
  const pills = `<div class="badges"><span class="pill ${esc(item.lane)}">${esc(item.lane)}</span><span class="pill mode">${esc(MODE_LABEL[item.mode] || item.mode)}</span></div>`;
  if (item.image) {
    const credit = item.imageCredit ? `<span class="credit" title="${esc(item.imageCredit)}">${esc(item.imageCredit)}</span>` : "";
    return `<div class="media">${pills}<img src="${esc(item.image)}" alt="" data-name="${esc(item.name)}" width="640" height="400" />${credit}</div>`;
  }
  return `<div class="media fallback" style="${paletteStyle(item.id)}">${pills}<span>${esc(initials(item.name))}</span></div>`;
}

function actionsHTML(item, small) {
  const apply = safeUrl(item.applyUrl);
  const info = safeUrl(item.infoUrl);
  const size = small ? " small" : "";
  const applyLink = apply
    ? `<a class="btn apply${size}" href="${esc(apply)}" target="_blank" rel="noopener noreferrer">Apply</a>`
    : "";
  const infoLink = info && info !== apply
    ? `<a class="btn ghost${size}" href="${esc(info)}" target="_blank" rel="noopener noreferrer">Info</a>`
    : "";
  return `<div class="actions">${applyLink}${infoLink}</div>`;
}

function countHTML(item) {
  const c = countdown(item.deadline);
  return `<span class="count ${c.kind}" data-deadline="${esc(item.deadline || "")}">${esc(c.label)}</span>`;
}

function regBlock(item) {
  if (!item.registrationOpens && !item.registrationCloses) {
    return esc(item.registrationLabel || "TBD");
  }
  const opens = item.registrationOpens ? fmtWhen(item.registrationOpens) : "TBD";
  const closes = item.registrationCloses ? fmtWhen(item.registrationCloses) : "TBD";
  return `<span class="reg-line">Opens ${esc(opens)}</span><span class="reg-line">Closes ${esc(closes)}</span>`;
}

function cardHTML(item) {
  const c = countdown(item.deadline);
  const bits = prizeBits(item);
  const tags = (item.tags || []).slice(0, 3).join(" · ");
  const kicker = [FORMAT_LABEL[item.format] || item.format, tags].filter(Boolean).join(" · ");
  const risk = item.residencyRisk && !/^none$/i.test(item.residencyRisk.trim())
    ? `<p class="note">${esc(item.residencyRisk)}</p>`
    : "";
  const extra = bits.extra
    ? `<strong title="Approximate USD for sorting. Tiered prizes are added. Tokens use stated face value.">${esc(bits.extra)}</strong>`
    : "";
  const cls = ["card", c.kind === "soon" || c.kind === "week" ? "is-soon" : "", c.kind === "expired" ? "is-expired" : ""].filter(Boolean).join(" ");
  return `<article class="${cls}">
    ${mediaHTML(item)}
    <div class="card-body">
      <p class="kicker">${esc(kicker)}</p>
      <h2>${esc(item.name)}</h2>
      <p class="prize"><span>${esc(bits.label)}</span>${extra}</p>
      <p class="when">${countHTML(item)}${esc(item.deadlineLabel || fmtWhen(item.deadline))}</p>
      <p class="reg">Registration · ${esc(item.registrationLabel || "TBD")}</p>
      ${item.fit ? `<p class="fit">${esc(item.fit)}</p>` : ""}
      ${risk}
      ${actionsHTML(item, false)}
    </div>
  </article>`;
}

function stackHTML(item) {
  const c = countdown(item.deadline);
  const bits = prizeBits(item);
  const cls = c.kind === "soon" || c.kind === "week" ? "dense is-soon" : "dense";
  return `<article class="${cls}">
    <div class="dense-top">
      ${thumbHTML(item, true)}
      <div>
        <h2>${esc(item.name)}</h2>
        <p class="meta">${esc(item.lane)} · ${esc(MODE_LABEL[item.mode] || "")} · ${esc(FORMAT_LABEL[item.format] || "")}</p>
      </div>
    </div>
    <dl class="facts">
      <div><dt>Prize</dt><dd>${esc(bits.label)}${bits.extra ? `<span class="prize-num">${esc(bits.extra)}</span>` : ""}</dd></div>
      <div><dt>Registration</dt><dd>${regBlock(item)}</dd></div>
      <div><dt>Deadline</dt><dd>${esc(item.deadlineLabel || fmtWhen(item.deadline))}</dd></div>
      <div><dt>Countdown</dt><dd>${countHTML(item)}</dd></div>
    </dl>
    ${actionsHTML(item, false)}
  </article>`;
}

function tableHTML(rows) {
  const aria = {
    deadline: sortKey === "deadline" ? "ascending" : "none",
    registration: sortKey === "registration" ? "ascending" : "none",
    prize: sortKey === "prize" ? "descending" : "none",
    name: sortKey === "name" ? "ascending" : "none",
  };
  const head = (key, label, cls = "") => {
    const sortAttr = aria[key] && aria[key] !== "none" ? ` aria-sort="${aria[key]}"` : ` aria-sort="none"`;
    return `<th class="${cls}"${key ? sortAttr : ""}><button type="button" data-sort="${key}">${label}</button></th>`;
  };
  const body = rows.map((item) => {
    const bits = prizeBits(item);
    return `<tr>
      <td class="name-cell"><div class="name-wrap">${thumbHTML(item, false)}<strong>${esc(item.name)}</strong></div></td>
      <td><span class="pill ${esc(item.lane)}">${esc(item.lane)}</span></td>
      <td>${esc(MODE_LABEL[item.mode] || item.mode || "")}</td>
      <td>${esc(FORMAT_LABEL[item.format] || item.format || "")}</td>
      <td><span class="prize-human">${esc(bits.label)}</span>${bits.extra ? `<span class="prize-num">${esc(bits.extra)}</span>` : ""}</td>
      <td title="${esc(item.registrationLabel || "")}">${regBlock(item)}</td>
      <td title="${esc(item.deadlineLabel || "")}">${esc(fmtWhen(item.deadline))}</td>
      <td>${countHTML(item)}</td>
      <td class="apply-cell">${actionsHTML(item, true)}</td>
    </tr>`;
  }).join("");
  return `<div class="table-wrap"><table>
    <caption class="sr">Open calls</caption>
    <thead><tr>
      ${head("name", "Name", "name-col")}
      <th>Lane</th>
      <th>Mode</th>
      <th>Format</th>
      ${head("prize", "Prize")}
      ${head("registration", "Registration")}
      ${head("deadline", "Deadline")}
      <th>Countdown</th>
      <th class="apply-col">Apply</th>
    </tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function narrowTable() {
  return matchMedia("(max-width: 759px)").matches;
}

function filtersDirty() {
  return lane !== "all" || mode !== "all" || formats.size > 0 || ($("q").value || "").trim() !== "" || !$("hideExpired").checked || sortKey !== "deadline";
}

function renderStatus(shown, total) {
  const hiddenClosed = $("hideExpired").checked ? items.length - items.filter((item) => {
    const t = parseTime(item.deadline);
    return t == null || t >= Date.now();
  }).length : 0;
  const sortLabels = {
    deadline: "soonest deadline",
    registration: "registration date",
    prize: "prize amount, high to low",
    name: "name",
  };
  const bits = [`${shown} shown`, `${total} on the board`, `sorted by ${sortLabels[sortKey]}`];
  if (hiddenClosed) bits.push(`${hiddenClosed} closed hidden`);
  if (meta.updatedAt) {
    const when = new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: SGT,
    }).format(new Date(meta.updatedAt));
    bits.push(`updated ${when} SGT`);
  }
  statusEl.innerHTML = `${esc(bits.join(" · "))}${filtersDirty() ? ' <button type="button" id="reset">Reset filters</button>' : ""}`;
}

function render() {
  const rows = visibleItems();
  renderStatus(rows.length, items.length);
  if (!rows.length) {
    board.className = "wrap board";
    board.innerHTML = `<div class="empty"><h2>Nothing in this slice</h2><p>Widen the lane, mode, or format — or show expired calls.</p></div>`;
    return;
  }
  const useStack = view === "table" && narrowTable();
  board.className = `wrap board is-${useStack ? "stack" : view}`;
  if (view === "cards") board.innerHTML = `<div class="cards">${rows.map(cardHTML).join("")}</div>`;
  else if (useStack) board.innerHTML = `<div class="stack">${rows.map(stackHTML).join("")}</div>`;
  else board.innerHTML = tableHTML(rows);
}

function syncChips() {
  document.querySelectorAll("#lane-chips .chip").forEach((btn) => {
    const on = btn.dataset.lane === lane;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", String(on));
  });
  document.querySelectorAll("#mode-chips .chip").forEach((btn) => {
    const on = btn.dataset.mode === mode;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", String(on));
  });
  document.querySelectorAll("#format-chips .chip").forEach((btn) => {
    const on = btn.dataset.format === "all" ? formats.size === 0 : formats.has(btn.dataset.format);
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", String(on));
  });
}

function syncView() {
  $("view-cards").setAttribute("aria-pressed", String(view === "cards"));
  $("view-table").setAttribute("aria-pressed", String(view === "table"));
  document.documentElement.setAttribute("data-view", view);
}

function applyTheme(next, persist) {
  theme = next;
  document.documentElement.setAttribute("data-theme", theme);
  const metaTag = document.querySelector('meta[name="theme-color"]');
  if (metaTag) metaTag.setAttribute("content", theme === "dark" ? "#120e0c" : "#f4ece3");
  $("theme-light").setAttribute("aria-pressed", String(theme === "light"));
  $("theme-night").setAttribute("aria-pressed", String(theme === "dark"));
  if (persist) {
    try { localStorage.setItem("fhr-theme", theme); } catch (e) {}
  }
}

function setView(next, persist) {
  view = next;
  syncView();
  if (persist) {
    try { localStorage.setItem("fhr-view", view); } catch (e) {}
  }
  render();
}

$("lane-chips").addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-lane]");
  if (!btn) return;
  lane = btn.dataset.lane;
  syncChips();
  render();
});
$("mode-chips").addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-mode]");
  if (!btn) return;
  mode = btn.dataset.mode;
  syncChips();
  render();
});
$("format-chips").addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-format]");
  if (!btn) return;
  if (btn.dataset.format === "all") formats.clear();
  else if (formats.has(btn.dataset.format)) formats.delete(btn.dataset.format);
  else formats.add(btn.dataset.format);
  syncChips();
  render();
});

$("q").addEventListener("input", render);
$("hideExpired").addEventListener("change", render);
$("sort").addEventListener("change", () => {
  sortKey = $("sort").value;
  render();
});
statusEl.addEventListener("click", (event) => {
  if (event.target.id === "reset") {
    lane = "all";
    mode = "all";
    formats.clear();
    $("q").value = "";
    $("hideExpired").checked = true;
    sortKey = "deadline";
    $("sort").value = "deadline";
    syncChips();
    render();
  }
});
board.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-sort]");
  if (!btn) return;
  sortKey = btn.dataset.sort;
  $("sort").value = sortKey;
  render();
});
board.addEventListener("load", (event) => {
  const img = event.target;
  if (img.tagName !== "IMG") return;
  if (img.naturalHeight > img.naturalWidth) img.style.objectPosition = "center 12%";
}, true);
board.addEventListener("error", (event) => {
  const img = event.target;
  if (img.tagName !== "IMG") return;
  const holder = img.closest(".media, .thumb");
  if (!holder) return;
  holder.classList.add("fallback");
  holder.style.cssText = paletteStyle("fallback");
  holder.innerHTML = `<span>${esc(initials(img.dataset.name || "Call"))}</span>`;
}, true);

$("view-cards").addEventListener("click", () => setView("cards", true));
$("view-table").addEventListener("click", () => setView("table", true));
$("theme-light").addEventListener("click", () => applyTheme("light", true));
$("theme-night").addEventListener("click", () => applyTheme("dark", true));

const wideQuery = matchMedia("(min-width: 1040px)");
const narrowQuery = matchMedia("(max-width: 759px)");
wideQuery.addEventListener("change", () => {
  let stored = null;
  try { stored = localStorage.getItem("fhr-view"); } catch (e) {}
  if (stored === "cards" || stored === "table" || params.get("view")) return;
  setView(wideQuery.matches ? "table" : "cards", false);
});
narrowQuery.addEventListener("change", () => {
  if (view === "table") render();
});

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
  let stored = null;
  try { stored = localStorage.getItem("fhr-theme"); } catch (e) {}
  if (stored === "light" || stored === "dark" || params.get("theme")) return;
  applyTheme(event.matches ? "dark" : "light", false);
});

setInterval(() => {
  document.querySelectorAll("[data-deadline]").forEach((el) => {
    const c = countdown(el.dataset.deadline);
    el.textContent = c.label;
    el.className = `count ${c.kind}`;
  });
}, 30000);

applyTheme(theme, false);
syncView();

fetch(DATA_URL)
  .then((res) => {
    if (!res.ok) throw new Error(`Could not read the board (${res.status})`);
    return res.json();
  })
  .then((data) => {
    items = data.items || [];
    meta = data;
    if (items.length === 0) statusEl.textContent = `${items.length} calls loaded`;
    render();
  })
  .catch((err) => {
    statusEl.textContent = "The board could not be read.";
    board.innerHTML = `<div class="error"><h2>Soil’s quiet</h2><p>${esc(err.message)}. Serve this folder over HTTP, then reload. Opening the file directly blocks the data fetch.</p></div>`;
  });
