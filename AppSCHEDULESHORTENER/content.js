const SKIP_NODES = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMatchers(map) {
  const terms = Object.keys(map)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);

  if (terms.length === 0) return null;

  const pattern = new RegExp("(" + terms.join("|") + ")", "g");
  return { pattern, map };
}

function replaceInTextNode(node, matchers) {
  const { pattern, map } = matchers;
  const original = node.nodeValue;
  const replaced = original.replace(pattern, (m) => map[m] ?? m);
  if (replaced !== original) node.nodeValue = replaced;
}

function shouldSkip(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (SKIP_NODES.has(el.tagName)) return true;
  if (el.closest("input, textarea, [contenteditable]")) return true;
  return false;
}

function walkAndReplace(root, matchers) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (shouldSkip(parent)) return NodeFilter.FILTER_REJECT;
        return node.nodeValue.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    }
  );
  const texts = [];
  let node;
  while ((node = walker.nextNode())) texts.push(node);
  texts.forEach((t) => replaceInTextNode(t, matchers));
}

let currentMatchers = null;

function apply() {
  if (!currentMatchers) return;
  walkAndReplace(document.body, currentMatchers);
}

const mo = new MutationObserver((mutations) => {
  if (!currentMatchers) return;

  for (const m of mutations) {
    // 1) Обработка добавленных узлов
    if (m.type === "childList" && m.addedNodes?.length) {
      for (const n of m.addedNodes) {
        if (n.nodeType === Node.ELEMENT_NODE && !shouldSkip(n)) {
          walkAndReplace(n, currentMatchers);
        } else if (n.nodeType === Node.TEXT_NODE) {
          replaceInTextNode(n, currentMatchers);
        }
      }
    }

    // 2) Обработка изменения текста существующих узлов
    if (m.type === "characterData" && m.target?.nodeType === Node.TEXT_NODE) {
      replaceInTextNode(m.target, currentMatchers);
    }
  }
});

function startObserver() {
  mo.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true // следим за изменением текста
  });
}

function init(mapping) {
  currentMatchers = buildMatchers(mapping || {});
  apply();
  startObserver();
}

// Загружаем словарь сокращений и запускаем замену
chrome.storage.sync.get({ mapping: {} }, ({ mapping }) => {
  init(mapping);
});

// Отслеживаем смену недели (SPA-навигация)
(function () {
  const wrap = (type) => {
    const orig = history[type];
    history[type] = function () {
      const ret = orig.apply(this, arguments);
      window.dispatchEvent(new Event("locationchange"));
      return ret;
    };
  };
  ["pushState", "replaceState"].forEach(wrap);
  window.addEventListener("popstate", () => window.dispatchEvent(new Event("locationchange")));
  window.addEventListener("locationchange", () => apply());
})();
