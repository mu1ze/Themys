/* Themys extension overlay — v2 design (artifacts/design/extension-overlay-v1/overlay-redesign.html)
   Editorial redesign: serif verdict header, mono meta, quiet segmented tabs, hairline finding rows,
   neutral factual presentation (no red alarm labels). Same shadow-DOM host + exported API as v1. */
(function () {
  var HOST_ID = 'themys-overlay-host';
  var host = null;
  var shadow = null;
  var isExpanded = false;
  var activeTab = 'summary';
  var extApi = (typeof browser !== 'undefined' && browser.runtime)
    ? browser
    : (typeof chrome !== 'undefined' ? chrome : null);
  var extRuntime = (typeof browser !== 'undefined' && browser.runtime)
    ? browser.runtime
    : (typeof chrome !== 'undefined' ? chrome.runtime : null);

  function storageGet(key, callback) {
    if (!extApi || !extApi.storage || !extApi.storage.local) return;
    var result = extApi.storage.local.get(key);
    if (result && typeof result.then === 'function') result.then(callback).catch(function () {});
    else extApi.storage.local.get(key, callback);
  }

  function storageSet(values) {
    if (!extApi || !extApi.storage || !extApi.storage.local) return;
    var result = extApi.storage.local.set(values);
    if (result && typeof result.catch === 'function') result.catch(function () {});
  }

  function sendRuntimeMessage(message, callback) {
    if (!extRuntime || typeof extRuntime.sendMessage !== 'function') return;
    if (typeof callback === 'function') extRuntime.sendMessage(message, callback);
    else extRuntime.sendMessage(message);
  }

  function getOrCreateHost() {
    var el = document.getElementById(HOST_ID);
    if (el) { shadow = el.shadowRoot; host = el; return { host: host, shadow: shadow }; }
    el = document.createElement('div');
    el.id = HOST_ID;
    document.body.appendChild(el);
    host = el;
    shadow = el.attachShadow({ mode: 'open' });
    return { host: host, shadow: shadow };
  }

  function styles() {
    return `
      /* tokens from src/app/theme.css (scoped to the shadow root) */
      :host {
        all: initial; position: fixed; bottom: 20px; right: 20px;
        z-index: 2147483647;
        --ds-bg: #fafafb; --ds-card: #fff; --ds-card-hover: #f2f2f3;
        --ds-border: #ececec; --ds-border-hover: #d8d8dc;
        --ds-text: #17191c; --ds-text-secondary: #5f646d; --ds-text-muted: #6f7278; --ds-text-dim: #8b8f98;
        --ds-danger: #dc2626; --ds-warning: #d97706; --ds-success: #059669;
        --ds-danger-bg: rgba(220,38,38,.08); --ds-warning-bg: rgba(217,119,6,.08); --ds-success-bg: rgba(5,150,105,.08);
        --ds-peach: #fbe1d1; --ds-sienna: #5d2a1a; --ds-accent: #17191c; --ds-accent-glow: rgba(23,25,28,.06);
        --serif: "Source Serif 4", ui-serif, Georgia, "Times New Roman", serif;
        --sans: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        --mono: "DM Mono", ui-monospace, "SFMono-Regular", Menlo, monospace;
        font-family: var(--sans); font-size: 13px; line-height: 1.5; color: var(--ds-text);
        -webkit-font-smoothing: antialiased;
      }
      @media (max-width: 480px) {
        :host { right: 12px; bottom: max(16px, env(safe-area-inset-bottom)); left: 12px; }
        .container { width: 100% !important; }
      }
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      .container { background: var(--ds-card); border: 1px solid var(--ds-border); border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0,0,0,.1); width: 420px; overflow: hidden; transition: height 250ms ease; }
      .container.expanded { height: calc(100vh - 40px); display: flex; flex-direction: column; }

      /* ===== collapsed bar ===== */
      .ov-bar { display: flex; align-items: center; gap: 9px; padding: 12px 14px; cursor: pointer; user-select: none; transition: background 150ms; }
      .ov-bar:hover { background: var(--ds-bg); }
      .brand-mark { width: 18px; height: 18px; flex-shrink: 0; color: var(--ds-text); }
      .ov-brand { font-family: var(--serif); font-size: 16px; letter-spacing: -.04em; color: var(--ds-text); }
      .ov-spacer { flex: 1; }
      .sev { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 500; }
      .sev::before { content: ""; width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
      .sev.high { color: var(--ds-danger); } .sev.medium { color: var(--ds-warning); } .sev.low { color: var(--ds-text-muted); }
      .ov-count { font-family: var(--mono); font-size: 11px; color: var(--ds-text-dim); }
      .ov-chevron { width: 14px; height: 14px; color: var(--ds-text-dim); transition: transform 200ms ease; flex-shrink: 0; }
      .ov-chevron.expanded { transform: rotate(180deg); }
      .ov-x { background: none; border: 0; color: var(--ds-text-dim); font-size: 13px; padding: 2px 4px; cursor: pointer; border-radius: 8px; transition: color 150ms; line-height: 1; }
      .ov-x:hover { color: var(--ds-text); }

      /* ===== expanded: header ===== */
      .expanded-panel { max-height: 0; opacity: 0; overflow: hidden; transition: max-height 200ms ease, opacity 200ms ease; }
      .expanded-panel.open { max-height: none; opacity: 1; flex: 1; min-height: 0; display: flex; flex-direction: column; }
      .ov-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 18px 0; }
      .ov-kicker { font-family: var(--mono); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--ds-text-dim); margin-bottom: 4px; }
      .ov-verdict { font-family: var(--serif); font-weight: 400; font-size: 24px; letter-spacing: -.025em; line-height: 1.15; color: var(--ds-text); }
      .ov-score { font-family: var(--mono); font-size: 11px; color: var(--ds-text-muted); margin-top: 6px; }
      .ov-head-x { background: none; border: 0; color: var(--ds-text-dim); font-size: 16px; padding: 2px 6px; cursor: pointer; border-radius: 8px; transition: color 150ms; line-height: 1; }
      .ov-head-x:hover { color: var(--ds-text); }
      .ov-summary-toggle { display: inline-flex; align-items: center; gap: 5px; margin: 8px 18px 0; border: 0; padding: 0; background: none; color: var(--ds-text); font-size: 11px; font-family: var(--sans); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
      .ov-summary-toggle:hover { color: var(--ds-text-secondary); }
      .ov-summary-toggle svg { width: 12px; height: 12px; transition: transform 150ms ease; }
      .ov-summary-details[open] .ov-summary-toggle svg { transform: rotate(180deg); }
      .ov-summary-preview { margin: 0 18px 8px; color: var(--ds-text-secondary); font-size: 12.5px; line-height: 1.6; }
      .ov-summary-full { margin: 6px 18px 0; color: var(--ds-text-secondary); font-size: 12px; line-height: 1.6; }

      /* ===== tab bar — quiet segments, not a dark pill ===== */
      .ov-tabs { position: relative; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1px; margin: 14px 18px 0; background: var(--ds-card-hover); border-radius: 12px; padding: 3px; flex-shrink: 0; }
      .ov-tabind { position: absolute; top: 3px; bottom: 3px; left: 3px; background: var(--ds-card); border: 1px solid var(--ds-border); border-radius: 10px; width: 0; transition: transform 200ms ease, width 200ms ease; }
      .ov-tab { position: relative; z-index: 1; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 3px; padding: 6px 2px; border: 0; background: transparent; font-size: 10px; font-weight: 500; font-family: var(--sans); color: var(--ds-text-muted); cursor: pointer; border-radius: 10px; transition: color 150ms; white-space: nowrap; }
      .ov-tab.active { color: var(--ds-text); }
      .ov-tab .n { font-family: var(--mono); font-size: 9px; color: var(--ds-text-dim); }
      .ov-tab.active .n { color: var(--ds-text-secondary); }

      /* ===== findings container: hairline rows, not stacked gray cards ===== */
      .tab-content { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 18px 4px; }
      .tab-panel { display: none; }
      .tab-panel.active { display: block; }
      .ov-list { border: 1px solid var(--ds-border); border-radius: 16px; background: var(--ds-card); overflow: hidden; }
      .row { padding: 14px 16px; }
      .row + .row { border-top: 1px solid var(--ds-border); }
      .row-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 4px; }
      .row-no { font-family: var(--serif); font-size: 14px; color: var(--ds-text-dim); flex-shrink: 0; }
      .row-title { font-size: 13px; font-weight: 500; letter-spacing: -.01em; line-height: 1.45; color: var(--ds-text); }
      .row-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 5px 10px; margin-bottom: 3px; font-size: 10px; }
      .row-cat { color: var(--ds-text-muted); }
      .row-juris { font-family: var(--mono); font-size: 9px; color: var(--ds-sienna); }
      .row-why { font-size: 12px; color: var(--ds-text-secondary); line-height: 1.55; margin-top: 6px; }
      .lbl { font-family: var(--mono); font-size: 9px; letter-spacing: .11em; text-transform: uppercase; color: var(--ds-text-dim); margin-top: 10px; }
      .ov-quote { margin: 6px 0 0; border-left: 2px solid var(--ds-border); border-radius: 0 8px 8px 0; padding: 9px 12px; background: var(--ds-bg); font-family: var(--serif); font-size: 12.5px; line-height: 1.65; color: var(--ds-text-secondary); word-break: break-word; }

      /* ===== result disclosures — mirrors the main scan workspace ===== */
      .result-list { display: grid; gap: 8px; }
      .result-item { overflow: hidden; border: 1px solid var(--ds-border); border-radius: 14px; background: var(--ds-card); }
      .result-item[open] { border-color: var(--ds-border-hover); }
      .result-summary { display: flex; align-items: flex-start; gap: 10px; padding: 12px 13px; cursor: pointer; list-style: none; transition: background 150ms; }
      .result-summary::-webkit-details-marker { display: none; }
      .result-summary:hover { background: var(--ds-card-hover); }
      .result-number { flex: 0 0 auto; padding-top: 1px; font-family: var(--serif); font-size: 13px; color: var(--ds-text-dim); }
      .result-copy { min-width: 0; flex: 1; }
      .result-tags { display: flex; flex-wrap: wrap; gap: 5px 9px; margin-bottom: 4px; font-size: 9px; color: var(--ds-text-muted); text-transform: uppercase; letter-spacing: .06em; }
      .result-title { display: block; font-size: 13px; font-weight: 600; line-height: 1.4; color: var(--ds-text); }
      .result-preview { display: -webkit-box; margin-top: 3px; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; font-family: var(--serif); font-size: 12px; font-style: italic; line-height: 1.45; color: var(--ds-text-muted); }
      .result-chevron { width: 14px; height: 14px; margin-top: 3px; flex: 0 0 auto; color: var(--ds-text-dim); transition: transform 180ms ease; }
      .result-item[open] .result-chevron { transform: rotate(180deg); }
      .result-detail { display: grid; gap: 13px; padding: 13px; border-top: 1px solid var(--ds-border); background: var(--ds-bg); }
      .detail-label { margin-bottom: 4px; font-family: var(--mono); font-size: 9px; letter-spacing: .11em; text-transform: uppercase; color: var(--ds-text-dim); }
      .detail-copy { font-size: 12px; line-height: 1.55; color: var(--ds-text-secondary); }
      .detail-quote { border-left: 2px solid var(--ds-border-hover); padding-left: 10px; font-family: var(--serif); font-size: 12px; line-height: 1.6; color: var(--ds-text-secondary); }
      .panel-heading { margin-bottom: 10px; }
      .panel-heading h2 { font-family: var(--serif); font-size: 18px; font-weight: 500; letter-spacing: -.02em; color: var(--ds-text); }
      .panel-heading p { margin-top: 2px; font-size: 11px; color: var(--ds-text-muted); }

      /* ===== extraction tab ===== */
      .extraction-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; font-size: 11px; color: var(--ds-text-dim); }
      .extraction-meta span { display: flex; align-items: center; gap: 4px; }
      .ghost-btn { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border: 1px solid var(--ds-border); border-radius: 999px; background: var(--ds-card); font-size: 11px; font-weight: 500; font-family: var(--sans); color: var(--ds-text-secondary); cursor: pointer; transition: background 150ms, border-color 150ms; }
      .ghost-btn:hover { background: var(--ds-card-hover); border-color: var(--ds-border-hover); }
      .ghost-btn svg { width: 12px; height: 12px; }
      .ghost-btn.ok { color: var(--ds-success); border-color: transparent; background: var(--ds-success-bg); }
      .link-btn { font-size: 12px; font-weight: 500; color: var(--ds-text); text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--ds-border-hover); background: none; border: 0; cursor: pointer; padding: 0; font-family: var(--sans); }
      .link-btn:hover { text-decoration-color: var(--ds-text); }
      .extraction-section { margin-bottom: 14px; }
      .extraction-section:last-child { margin-bottom: 0; }
      .section-header { display: flex; align-items: center; gap: 6px; padding: 8px 10px; background: var(--ds-bg); border: 1px solid var(--ds-border); border-radius: 16px; cursor: pointer; user-select: none; transition: background 150ms; }
      .section-header:hover { background: var(--ds-card-hover); }
      .section-icon { font-size: 16px; flex-shrink: 0; }
      .section-title { font-size: 13px; font-weight: 500; color: var(--ds-text); flex: 1; }
      .section-chevron { width: 14px; height: 14px; color: var(--ds-text-muted); transition: transform 200ms; flex-shrink: 0; }
      .section-chevron.open { transform: rotate(90deg); }
      .section-body { display: none; padding: 8px 0 0; }
      .section-body.open { display: block; }
      .key-point { padding: 8px 10px; border-left: 2px solid var(--ds-border); margin-bottom: 8px; border-radius: 0 12px 12px 0; background: var(--ds-bg); }
      .key-point.severity-info { border-left-color: var(--ds-text-dim); }
      .key-point.severity-caution { border-left-color: var(--ds-warning); }
      .key-point.severity-warning { border-left-color: var(--ds-danger); }
      .kp-title { font-size: 12px; font-weight: 600; color: var(--ds-text); margin-bottom: 2px; }
      .kp-detail { font-size: 12px; color: var(--ds-text-secondary); line-height: 1.5; }
      .kp-quote { font-size: 11px; color: var(--ds-text-muted); font-style: italic; margin-top: 4px; padding: 4px 8px; background: var(--ds-card-hover); border-radius: 8px; word-break: break-word; }
      .empty-note { font-size: 13px; color: var(--ds-text-dim); text-align: center; padding: 20px 0; }

      /* ===== footer + actions ===== */
      .ov-actions { display: flex; flex-direction: column; gap: 8px; margin: 0 18px 8px; flex-shrink: 0; }
      .ov-actions .monitor-btn { margin: 0; }
      .monitor-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 16px; border-radius: 999px; font-size: 12px; font-weight: 500; font-family: var(--sans); cursor: pointer; transition: all 200ms; border: 1px solid var(--ds-border); background: var(--ds-card); color: var(--ds-text-secondary); }
      .monitor-btn svg { width: 14px; height: 14px; flex-shrink: 0; }
      .container.expanded .ov-bar { display: none; }
      .monitor-btn:hover { background: var(--ds-card-hover); border-color: var(--ds-border-hover); }
      .monitor-btn.subscribed { color: var(--ds-success); border-color: transparent; background: var(--ds-success-bg); }
      .monitor-btn.subscribed:hover { background: rgba(5,150,105,.12); }
      .monitor-btn .spinner { width: 12px; height: 12px; border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: spin 600ms linear infinite; }
      .ov-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; padding: 10px 18px 12px; border-top: 1px solid var(--ds-border); flex-shrink: 0; }
      .ov-foot .hint { font-family: var(--mono); font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: var(--ds-text-dim); }
      .ov-foot .right { display: flex; gap: 12px; align-items: center; }
      .ov-foot a { font-size: 11px; color: var(--ds-text); text-decoration: none; font-weight: 500; }
      .ov-foot a:hover { text-decoration: underline; }

      /* ===== state overlays (loading / auth / error / limit) ===== */
      .loading-container { display: flex; align-items: center; gap: 10px; padding: 14px 16px; min-width: 200px; }
      .spinner { width: 18px; height: 18px; border: 2.5px solid var(--ds-border); border-top-color: var(--ds-text); border-radius: 50%; animation: spin 0.7s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .loading-text { font-size: 13px; color: var(--ds-text-muted); }
      .primary-btn { margin-top: 14px; padding: 8px 20px; background: var(--ds-text); color: var(--ds-card); border: none; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: var(--sans); }
      .primary-btn:hover { opacity: 0.9; }
    `;
  }

  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function hasContent(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /* Neutral factual labels — no alarm language (user direction, Sep 2026). */
  function flagCountLabel(risk) {
    return risk >= 7 ? 'high' : risk >= 4 ? 'medium' : 'low';
  }

  function resultsDecisionUrl(scanId) {
    var origin = globalThis.THEMYS_CONFIG && globalThis.THEMYS_CONFIG.appOrigin
      ? globalThis.THEMYS_CONFIG.appOrigin
      : 'https://themys.ca';
    return scanId
      ? origin + '/scan/results?id=' + encodeURIComponent(scanId)
      : origin + '/scan/results';
  }

  function clip(text, max) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '...' : text;
  }

  function bellIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg>';
  }

  function brandMarkSVG() {
    return '<svg class="brand-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 3v18"/><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M7 21h10"/>' +
      '</svg>';
  }

  function chevronSVG() {
    return '<svg class="ov-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
  }

  function attentionLabel(risk) {
    return risk >= 7 ? 'Elevated' : risk >= 4 ? 'Review advised' : 'Standard';
  }

  function sevLabel(sev) {
    return sev === 'high' ? 'Warning' : sev === 'medium' ? 'Caution' : 'Informational';
  }

  function buildCollapsedBar(data) {
    var risk = data.riskScore || 0;
    var flags = data.flags || [];
    var cls = flagCountLabel(risk);

    var bar = document.createElement('div');
    bar.className = 'ov-bar';
    bar.innerHTML =
      brandMarkSVG() +
      '<span class="ov-brand">themys</span>' +
      '<span class="ov-spacer"></span>' +
      '<span class="sev ' + cls + '">' + esc(attentionLabel(risk)) + '</span>' +
      '<span class="ov-count">' + flags.length + ' flag' + (flags.length !== 1 ? 's' : '') + '</span>' +
      chevronSVG() +
      '<button class="ov-x" title="Dismiss">&#x2715;</button>';

    bar.querySelector('.ov-x').addEventListener('click', function (e) {
      e.stopPropagation();
      dismiss();
    });

    bar.addEventListener('click', function () {
      toggleExpanded(data);
    });

    return bar;
  }

  function displayTitle(value, fallback) {
    if (!hasContent(value)) return fallback;
    return value.replace(/_/g, ' ').replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function detailBlock(label, value, quote) {
    if (!hasContent(value)) return '';
    return '<div><p class="detail-label">' + esc(label) + '</p>' +
      (quote ? '<blockquote class="detail-quote">&ldquo;' + esc(value) + '&rdquo;</blockquote>' : '<p class="detail-copy">' + esc(value) + '</p>') +
      '</div>';
  }

  function disclosureRow(index, title, preview, tags, details) {
    var item = document.createElement('details');
    item.className = 'result-item';
    item.innerHTML =
      '<summary class="result-summary">' +
        '<span class="result-number">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<span class="result-copy">' +
          '<span class="result-tags">' + tags + '</span>' +
          '<span class="result-title">' + esc(title) + '</span>' +
          (hasContent(preview) ? '<span class="result-preview">' + esc(clip(preview, 150)) + '</span>' : '') +
        '</span>' +
        '<svg class="result-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>' +
      '</summary>' +
      '<div class="result-detail">' + details + '</div>';
    return item;
  }

  function appendDisclosureList(target, rows, emptyMessage) {
    if (!rows.length) {
      target.insertAdjacentHTML('beforeend', '<p class="empty-note">' + esc(emptyMessage) + '</p>');
      return;
    }
    var list = document.createElement('div');
    list.className = 'result-list';
    rows.forEach(function (row) {
      row.addEventListener('toggle', function () {
        if (!row.open) return;
        list.querySelectorAll('details[open]').forEach(function (candidate) {
          if (candidate !== row) candidate.open = false;
        });
      });
      list.appendChild(row);
    });
    target.appendChild(list);
  }

  function clauseRow(flag, index) {
    var severity = sevLabel(flag.severity);
    var category = displayTitle(flag.category, 'Flagged clause');
    var tags = '<span class="sev ' + esc(flag.severity || 'low') + '">' + esc(severity) + '</span>' +
      (flag.isTargetClause ? '<span>Target clause</span>' : '');
    var details = detailBlock('What the document says', flag.fullClauseText || flag.text, true) +
      detailBlock('In plain English', flag.explanation, false) +
      detailBlock('Why it matters', flag.whyItMatters, false) +
      detailBlock('Next step', flag.recommendedAction, false);
    return disclosureRow(index, category, flag.text, tags, details);
  }

  function complianceGroups(flags) {
    var grouped = {};
    flags.forEach(function (flag) {
      (flag.complianceTags || []).forEach(function (tag) {
        var code = tag.regulationCode || 'Regulation';
        if (!grouped[code]) grouped[code] = { code: code, tags: [], flags: [] };
        grouped[code].tags.push(tag);
        if (grouped[code].flags.indexOf(flag) === -1) grouped[code].flags.push(flag);
      });
    });
    return Object.keys(grouped).sort().map(function (code) { return grouped[code]; });
  }

  function panelHeading(title, description) {
    return '<div class="panel-heading"><h2>' + esc(title) + '</h2><p>' + esc(description) + '</p></div>';
  }

  function buildExpandedPanel(data) {
    var risk = data.riskScore || 0;
    var flags = Array.isArray(data.flags) ? data.flags : [];
    var pushback = Array.isArray(data.pushback) ? data.pushback : [];
    var sections = Array.isArray(data.fullExtraction) ? data.fullExtraction : [];
    var compliance = complianceGroups(flags);
    var hostname = data.host || (typeof window !== 'undefined' && window.location ? window.location.hostname : '');
    var tabs = [
      { id: 'summary', label: 'Summary', count: null },
      { id: 'flagged', label: 'Flagged', count: flags.length },
      { id: 'suggestions', label: 'Suggestions', count: pushback.length },
      { id: 'compliance', label: 'Compliance', count: compliance.length },
      { id: 'extraction', label: 'Extraction', count: sections.length }
    ];
    if (!tabs.some(function (tab) { return tab.id === activeTab; })) activeTab = 'summary';

    var panel = document.createElement('div');
    panel.className = 'expanded-panel';
    var header = document.createElement('div');
    header.className = 'ov-head';
    header.innerHTML = '<div><p class="ov-kicker">' + esc(hostname) + '</p><div class="ov-verdict">' +
      esc(attentionLabel(risk)) + '</div><p class="ov-score">' + flags.length + ' flag' +
      (flags.length !== 1 ? 's' : '') + '</p></div><button class="ov-head-x" title="Collapse">&times;</button>';

    var tabBar = document.createElement('div');
    tabBar.className = 'ov-tabs';
    tabBar.setAttribute('role', 'tablist');
    var tabIndicator = document.createElement('div');
    tabIndicator.className = 'ov-tabind';
    tabBar.appendChild(tabIndicator);
    var tabButtons = {};
    tabs.forEach(function (tab) {
      var button = document.createElement('button');
      button.className = 'ov-tab' + (activeTab === tab.id ? ' active' : '');
      button.dataset.tab = tab.id;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', activeTab === tab.id ? 'true' : 'false');
      button.innerHTML = esc(tab.label) + (tab.count == null ? '' : ' <span class="n">' + tab.count + '</span>');
      tabButtons[tab.id] = button;
      tabBar.appendChild(button);
    });

    var tabContent = document.createElement('div');
    tabContent.className = 'tab-content';
    var panels = {};
    tabs.forEach(function (tab) {
      var tabPanel = document.createElement('section');
      tabPanel.className = 'tab-panel' + (activeTab === tab.id ? ' active' : '');
      tabPanel.dataset.panel = tab.id;
      tabPanel.setAttribute('role', 'tabpanel');
      panels[tab.id] = tabPanel;
      tabContent.appendChild(tabPanel);
    });

    panels.summary.innerHTML = panelHeading('Scan summary', 'The bottom line and the findings to review first');
    if (hasContent(data.summary)) panels.summary.insertAdjacentHTML('beforeend', '<p class="ov-summary-preview">' + esc(data.summary.trim()) + '</p>');
    appendDisclosureList(panels.summary, flags.slice(0, 3).map(clauseRow), 'No findings need extra attention.');

    panels.flagged.innerHTML = panelHeading('Flagged clauses', 'Open a finding to see its meaning and original wording');
    appendDisclosureList(panels.flagged, flags.map(clauseRow), 'No clauses were flagged for extra attention.');

    panels.suggestions.innerHTML = panelHeading('Actionable insights', 'Steps you can start now, grounded in the document');
    appendDisclosureList(panels.suggestions, pushback.map(function (item, index) {
      var tag = item.isDirectAction ? 'Available action' : 'Suggested ask';
      return disclosureRow(index, item.title || displayTitle(item.category, 'Review this term'), item.whyItMatters,
        '<span>' + esc(tag) + '</span>',
        detailBlock(item.isDirectAction ? 'Action you can take' : 'What you can ask for', item.suggestedAsk, false) +
        detailBlock('Why it matters', item.whyItMatters, false) + detailBlock('What the document says', item.quote, true));
    }), 'No immediate steps were identified in this scan. Review flagged clauses for context.');

    panels.compliance.innerHTML = panelHeading('Compliance', 'Regulatory frameworks connected to the findings');
    appendDisclosureList(panels.compliance, compliance.map(function (group, index) {
      var articles = Array.from(new Set(group.tags.map(function (tag) { return tag.articleId; }).filter(Boolean)));
      var wording = group.flags.map(function (flag) { return flag.text; }).filter(Boolean).join('\n\n');
      return disclosureRow(index, group.code, group.flags.length + ' connected clause' + (group.flags.length === 1 ? '' : 's'),
        '<span>' + esc(group.code) + '</span>',
        detailBlock('Referenced articles', articles.join(' · '), false) + detailBlock('Connected wording', wording, true));
    }), 'No regulatory connections are available for this scan.');

    panels.extraction.innerHTML = panelHeading('Extraction', 'Sections identified in the source document');
    appendDisclosureList(panels.extraction, sections.map(function (section, index) {
      var points = Array.isArray(section.keyPoints) ? section.keyPoints : [];
      var details = points.map(function (point) {
        return detailBlock(point.severity === 'warning' ? 'Warning' : point.severity === 'caution' ? 'Noteworthy' : 'Key point', point.detail, false) +
          detailBlock('What the document says', point.quote, true);
      }).join('');
      return disclosureRow(index, section.section || 'Document section', points[0] && points[0].detail,
        '<span>Section ' + (index + 1) + '</span>', details || detailBlock('Key points', 'No key points extracted.', false));
    }), 'No extraction sections are available for this scan.');

    // ===== monitor action =====
    var actions = document.createElement('div');
    actions.className = 'ov-actions';

    var monitorBtn = document.createElement('button');
    monitorBtn.className = 'monitor-btn';
    monitorBtn.innerHTML = bellIcon() + 'Monitor this service';
    monitorBtn.title = 'Get alerted when this ToS changes';
    var isMonitored = false;
    var subscriptionId = null;
    var monitorLoading = false;

    monitorBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (monitorLoading) return;
      monitorLoading = true;
      monitorBtn.innerHTML = '<span class="spinner"></span> ' + (isMonitored ? 'Removing...' : 'Subscribing...');

      var action = isMonitored ? 'unsubscribe' : 'subscribe';
      sendRuntimeMessage({
        type: 'MONITOR_TOGGLE',
        action: action,
        url: window.location.href,
        domain: window.location.hostname,
        title: document.title,
        subscriptionId: subscriptionId
      }, function (resp) {
        monitorLoading = false;
        if (resp && resp.ok) {
          isMonitored = !isMonitored;
          if (isMonitored && resp.data && resp.data.subscription && resp.data.subscription.id) {
            subscriptionId = resp.data.subscription.id;
          }
          if (!isMonitored) {
            subscriptionId = null;
          }
        }
        monitorBtn.className = 'monitor-btn' + (isMonitored ? ' subscribed' : '');
        monitorBtn.innerHTML = isMonitored ? bellIcon() + 'Monitoring' : bellIcon() + 'Monitor this service';
      });
    });

    sendRuntimeMessage({ type: 'MONITOR_CHECK', url: window.location.href }, function (resp) {
      if (resp && resp.monitored) {
        isMonitored = true;
        subscriptionId = resp.subscriptionId || null;
        monitorBtn.className = 'monitor-btn subscribed';
        monitorBtn.innerHTML = bellIcon() + 'Monitoring';
      }
    });

    actions.appendChild(monitorBtn);

    // ===== footer (hint + actions) =====
    var footer = document.createElement('div');
    footer.className = 'ov-foot';
    footer.innerHTML =
      '<span class="hint">Not legal advice</span>' +
      '<div class="right">' +
        '<a class="ov-pdf-link" href="#">Download PDF</a>' +
        '<a class="ov-decision-link" href="' + resultsDecisionUrl(data.scanId) + '" target="_blank" rel="noopener noreferrer">Save decision</a>' +
        '<a class="ov-home-link" href="' + resultsDecisionUrl(null) + '" target="_blank" rel="noopener noreferrer">Themys</a>' +
      '</div>';

    var pdfLink = footer.querySelector('.ov-pdf-link');
    pdfLink.addEventListener('click', function (e) {
      e.preventDefault();
      var domain = window.location.hostname.replace(/^www\./, "");
      var apiBase = (globalThis.THEMYS_CONFIG && globalThis.THEMYS_CONFIG.appOrigin) || "";
      var url = apiBase + "/scan/history/" + domain + "?download=true";
      window.open(url, '_blank');
    });

    // ===== assemble =====
    panel.appendChild(header);
    panel.appendChild(tabBar);
    panel.appendChild(tabContent);
    panel.appendChild(actions);
    panel.appendChild(footer);

    // ===== tab switching =====
    function moveIndicator() {
      var active = tabBar.querySelector('.ov-tab.active');
      if (!active) return;
      tabIndicator.style.width = active.offsetWidth + 'px';
      tabIndicator.style.transform = 'translateX(' + (active.offsetLeft - 3) + 'px)';
    }

    function switchTab(next) {
      if (next === activeTab) return;
      activeTab = next;
      tabs.forEach(function (tab) {
        var selected = tab.id === next;
        tabButtons[tab.id].classList.toggle('active', selected);
        tabButtons[tab.id].setAttribute('aria-selected', selected ? 'true' : 'false');
        panels[tab.id].classList.toggle('active', selected);
      });
      moveIndicator();
    }

    tabs.forEach(function (tab) {
      tabButtons[tab.id].addEventListener('click', function (event) {
        event.stopPropagation();
        switchTab(tab.id);
      });
    });

    header.querySelector('.ov-head-x').addEventListener('click', function (e) {
      e.stopPropagation();
      collapse();
    });

    requestAnimationFrame(moveIndicator);

    return panel;
  }

  function toggleExpanded(data) {
    var panel = shadow.querySelector('.expanded-panel');
    var chevron = shadow.querySelector('.ov-chevron');
    var container = shadow.querySelector('.container');
    if (isExpanded) {
      collapse();
    } else {
      if (container) container.classList.add('expanded');
      if (panel) panel.classList.add('open');
      if (chevron) chevron.classList.add('expanded');
      isExpanded = true;
    }
  }

  function collapse() {
    var panel = shadow.querySelector('.expanded-panel');
    var chevron = shadow.querySelector('.ov-chevron');
    var container = shadow.querySelector('.container');
    if (panel) panel.classList.remove('open');
    if (chevron) chevron.classList.remove('expanded');
    if (container) container.classList.remove('expanded');
    isExpanded = false;
  }

  function dismiss() {
    var origin = window.location.origin;
    try {
      storageGet('themys-dismissed', function (result) {
        var map = result['themys-dismissed'] || {};
        map[origin] = Date.now();
        storageSet({ 'themys-dismissed': map });
      });
    } catch (_) {}
    removeOverlay();
  }

  function removeOverlay() {
    var el = document.getElementById(HOST_ID);
    if (el) el.remove();
    host = null;
    shadow = null;
    isExpanded = false;
  }

  function injectOverlay(data) {
    removeOverlay();
    getOrCreateHost();

    var style = document.createElement('style');
    style.textContent = styles();
    shadow.appendChild(style);

    var container = document.createElement('div');
    container.className = 'container';

    var bar = buildCollapsedBar(data);
    var panel = buildExpandedPanel(data);

    container.appendChild(bar);
    container.appendChild(panel);
    shadow.appendChild(container);

    // A completed scan is the result state, so show the report immediately.
    // The collapsed bar remains available as the compact state after the user
    // closes the report.
    toggleExpanded(data);
  }

  function mountStateContainer(innerHtml) {
    removeOverlay();
    getOrCreateHost();

    var style = document.createElement('style');
    style.textContent = styles();
    shadow.appendChild(style);

    var container = document.createElement('div');
    container.className = 'container';
    container.innerHTML = innerHtml;
    shadow.appendChild(container);
    return container;
  }

  function showLoadingOverlay() {
    mountStateContainer(
      '<div class="loading-container">' +
        '<div class="spinner"></div>' +
        '<span class="loading-text">Scanning with Themys...</span>' +
      '</div>'
    );
  }

  function showAuthRequired() {
    var container = mountStateContainer(
      '<div class="loading-container" style="flex-direction:column;align-items:center;text-align:center;min-width:260px;padding:20px;">' +
        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#17191c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>' +
        '<p class="loading-text" style="margin-top:10px;font-weight:600;color:var(--ds-text);">Sign in to Themys</p>' +
        '<p class="loading-text" style="margin-top:4px;font-size:12px;">Authenticate to scan this page</p>' +
        '<button id="themys-auth-btn" class="primary-btn">Sign in</button>' +
      '</div>'
    );

    var btn = container.querySelector
      ? container.querySelector('#themys-auth-btn')
      : (shadow && shadow.getElementById ? shadow.getElementById('themys-auth-btn') : null);
    if (btn) {
      btn.addEventListener('click', function () {
        var config = globalThis.THEMYS_CONFIG || {};
        if (config.platform === 'safari-ios') {
          var scheme = config.appScheme || 'themys';
          window.location.href = scheme + '://sign-in?return=' + encodeURIComponent(window.location.href);
          return; // Keep Sign in available if the user cancels opening the app.
        } else if (extRuntime) {
          sendRuntimeMessage({ type: 'OPEN_AUTH', returnUrl: window.location.href });
        }
        removeOverlay();
      });
    }
  }

  function showError(message) {
    mountStateContainer(
      '<div class="loading-container" style="flex-direction:column;align-items:center;text-align:center;min-width:260px;padding:20px;">' +
        '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="17"/></svg>' +
        '<p class="loading-text" style="margin-top:10px;font-weight:600;color:var(--ds-danger);">Scan failed</p>' +
        '<p class="loading-text" style="margin-top:4px;font-size:12px;max-width:240px;">' + esc(message || 'An unknown error occurred') + '</p>' +
      '</div>'
    );

    setTimeout(removeOverlay, 8000);
  }

  function showLimitReached(data) {
    var tier = (data && data.tier) || 'free';
    mountStateContainer(
      '<div class="loading-container" style="flex-direction:column;align-items:center;text-align:center;min-width:280px;padding:20px;">' +
        '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
        '<p class="loading-text" style="margin-top:10px;font-weight:600;color:var(--ds-warning);">Daily scan limit reached</p>' +
        '<p class="loading-text" style="margin-top:4px;font-size:12px;">You are on the ' + esc(tier) + ' plan.</p>' +
        '<a href="' + resultsDecisionUrl(null).replace('/scan/results', '/pricing') + '" target="_blank" class="primary-btn" style="text-decoration:none;display:inline-block;">Upgrade plan</a>' +
      '</div>'
    );
  }

  // ── Unified detection widget (used by both page-level and popup detection) ──
  function showDetectionWidget(label, onScan, onDismiss) {
    removeOverlay();
    // Also remove any legacy inline widget host
    var existing = document.querySelector(".__themys-inline-widget-host");
    if (existing) existing.remove();

    getOrCreateHost();

    var style = document.createElement('style');
    style.textContent = styles();
    shadow.appendChild(style);

    var badgeLabel = label || 'Terms';
    var container = document.createElement('div');
    container.className = 'container';
    container.innerHTML =
      '<div class="ov-bar" role="status">' +
        brandMarkSVG() +
        '<span class="ov-brand">themys</span>' +
        '<span class="sev medium">' + esc(badgeLabel) + '</span>' +
        '<span class="ov-spacer"></span>' +
        '<button type="button" class="ghost-btn" data-themys-scan>Scan</button>' +
        '<button type="button" class="ov-x" data-themys-dismiss title="Dismiss" aria-label="Dismiss">&times;</button>' +
      '</div>';
    shadow.appendChild(container);

    var scanBtn = container.querySelector('[data-themys-scan]');
    var dismissBtn = container.querySelector('[data-themys-dismiss]');
    if (scanBtn) {
      scanBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof onScan === 'function') onScan();
      });
    }
    if (dismissBtn) {
      dismissBtn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof onDismiss === 'function') onDismiss();
        removeOverlay();
      });
    }
  }

  // ── Inline widget for popup detection ──
  function showInlineWidget(termsUrl, detectionType, onScan, onDismiss) {
    var label = detectionType === 'checkbox' ? 'Agreement'
      : detectionType === 'modal' ? 'Agreement'
      : 'Terms';

    showDetectionWidget(label, function () {
      onScan(termsUrl);
    }, function () {
      onDismiss(termsUrl);
    });
  }

  function showDetectionBadge(onScan, onDismiss) {
    showDetectionWidget('Terms', onScan, onDismiss);
  }

  var exports = {
    injectOverlay: injectOverlay,
    showLoadingOverlay: showLoadingOverlay,
    showAuthRequired: showAuthRequired,
    showError: showError,
    showLimitReached: showLimitReached,
    showInlineWidget: showInlineWidget,
    showDetectionBadge: showDetectionBadge,
    removeOverlay: removeOverlay
  };
  try { self.__themysOverlay = exports; } catch (_) {}
})();
