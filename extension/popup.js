const $ = (id) => document.getElementById(id);

document.getElementById("options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

function setStatus(text, isError = false) {
  const el = $("status");
  el.hidden = false;
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function renderSummary(s) {
  if (!s) return;
  $("summary").hidden = false;
  $("sum-title").textContent = `${cap(s.store)} — ${s.items.length} articles pour ${s.coverDays} jours`;
  $("sum-notes").textContent = s.notes || "";

  const items = $("sum-items");
  items.innerHTML = "";
  for (const it of s.items || []) {
    const li = document.createElement("li");
    li.textContent = `${it.query} ×${it.quantity}`;
    const r = document.createElement("span");
    r.className = "reason";
    r.textContent = it.reason || "";
    li.appendChild(r);
    items.appendChild(li);
  }

  const recipes = $("sum-recipes");
  recipes.innerHTML = "";
  const hasRecipes = (s.recipes || []).length > 0;
  $("recipes-h").hidden = !hasRecipes;
  for (const rc of s.recipes || []) {
    const li = document.createElement("li");
    li.textContent = `${rc.name} (${rc.servings} pers.) — ${rc.uses}`;
    recipes.appendChild(li);
  }

  const log = $("sum-log");
  log.innerHTML = "";
  for (const line of s.log || []) {
    const li = document.createElement("li");
    li.textContent = line;
    log.appendChild(li);
  }
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

$("run").addEventListener("click", () => {
  $("run").disabled = true;
  $("summary").hidden = true;
  setStatus("Analyse du panier, des promos et de tes goûts… (peut prendre 30–60 s)");
  chrome.runtime.sendMessage({ action: "run" }, (resp) => {
    $("run").disabled = false;
    if (!resp) return; // le popup a pu être rouvert ; runDone via storage
    if (resp.error) setStatus(resp.error, true);
    else {
      setStatus("Panier prêt ✓ Vérifie-le sur le site puis commande.");
      renderSummary(resp.summary);
    }
  });
});

// Messages émis par le background (utile si le popup reste ouvert).
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "runDone") {
    $("run").disabled = false;
    setStatus("Panier prêt ✓ Vérifie-le sur le site puis commande.");
    renderSummary(msg.summary);
  } else if (msg.action === "runError") {
    $("run").disabled = false;
    setStatus(msg.error, true);
  }
});

// Au chargement : réafficher le dernier résultat s'il existe.
chrome.storage.local.get("lastRun").then(({ lastRun }) => {
  if (lastRun) {
    setStatus("Dernier passage : " + new Date(lastRun.at).toLocaleString("fr-FR"));
    renderSummary(lastRun);
  }
});
