const ta = document.getElementById("json");
const statusEl = document.getElementById("status");

function showStatus(msg, ok = true) {
  statusEl.textContent = msg;
  statusEl.style.color = ok ? "inherit" : "crimson";
  setTimeout(() => (statusEl.textContent = ""), 2000);
}

chrome.storage.sync.get({ mapping: {} }, ({ mapping }) => {
  ta.value = JSON.stringify(mapping, null, 2);
});

document.getElementById("save").addEventListener("click", () => {
  try {
    const obj = JSON.parse(ta.value || "{}");
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      chrome.storage.sync.set({ mapping: obj }, () => {
        showStatus("Сохранено");
      });
    } else {
      showStatus("Нужен JSON-объект {key: value}", false);
    }
  } catch (e) {
    showStatus("Ошибка JSON: " + e.message, false);
  }
});

document.getElementById("format").addEventListener("click", () => {
  try {
    const obj = JSON.parse(ta.value || "{}");
    ta.value = JSON.stringify(obj, null, 2);
  } catch (e) {
    showStatus("Невалидный JSON", false);
  }
});
