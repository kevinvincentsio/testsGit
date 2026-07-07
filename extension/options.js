const $ = (id) => document.getElementById(id);
const csv = (s) => (s || "").split(",").map((x) => x.trim()).filter(Boolean);
const joinCsv = (a) => (a || []).join(", ");

async function load() {
  const { prefs, ai, profile } = await chrome.storage.local.get(["prefs", "ai", "profile"]);
  const p = prefs || {};
  const a = ai || {};
  const pr = profile || {};

  $("apiKey").value = a.apiKey || "";
  $("model").value = a.model || "claude-opus-4-8";
  $("effort").value = a.effort || "medium";

  $("householdSize").value = p.householdSize ?? 2;
  $("coverDays").value = p.coverDays ?? 4;
  $("weeklyBudget").value = p.weeklyBudget ?? "";
  $("diet").value = p.diet || "";
  $("allergies").value = joinCsv(p.allergies);
  $("dislikes").value = joinCsv(p.dislikes);
  $("staples").value = joinCsv(p.staples);

  $("profileFreeText").value = pr.freeText || "";
}

async function save() {
  const { ai, profile } = await chrome.storage.local.get(["ai", "profile"]);
  const budget = $("weeklyBudget").value.trim();

  const prefs = {
    householdSize: parseInt($("householdSize").value, 10) || 1,
    coverDays: parseInt($("coverDays").value, 10) || 1,
    weeklyBudget: budget === "" ? null : parseFloat(budget),
    diet: $("diet").value.trim(),
    allergies: csv($("allergies").value),
    dislikes: csv($("dislikes").value),
    staples: csv($("staples").value),
  };
  const nextAi = {
    ...(ai || {}),
    apiKey: $("apiKey").value.trim(),
    model: $("model").value,
    effort: $("effort").value,
  };
  const nextProfile = { ...(profile || {}), freeText: $("profileFreeText").value };

  await chrome.storage.local.set({ prefs, ai: nextAi, profile: nextProfile });
  const saved = $("saved");
  saved.hidden = false;
  setTimeout(() => (saved.hidden = true), 1800);
}

$("save").addEventListener("click", save);
load();
