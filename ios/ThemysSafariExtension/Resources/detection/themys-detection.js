/**
 * Shared Terms detection heuristics for Chrome MV3 and the Safari Web Extension.
 * Classic script: assigns globalThis.ThemysDetection. Also exported for Node tests.
 * No chrome.*, no network, no storage.
 */
(function (root) {
  "use strict";

  var EXCLUDED_PATH_PREFIXES = [
    "/search",
    "/search?",
    "/results",
    "/feed",
    "/explore",
    "/discover",
    "/hashtag",
    "/trending",
  ];

  var EXCLUDED_DOMAIN_PATHS = [
    { domain: "google.com", pathPrefix: "/search" },
    { domain: "bing.com", pathPrefix: "/search" },
    { domain: "duckduckgo.com", pathPrefix: "/", requiresSearch: true },
    { domain: "yahoo.com", pathPrefix: "/search" },
    { domain: "reddit.com", pathPrefix: "/r/" },
    { domain: "twitter.com", pathPrefix: "/search" },
    { domain: "x.com", pathPrefix: "/search" },
    { domain: "youtube.com", pathPrefix: "/results" },
  ];

  var URL_PATTERNS = [
    "terms",
    "tos",
    "privacy",
    "policy",
    "legal",
    "conditions",
    "eula",
    "agreement",
    "user-agreement",
    "terms-of-service",
    "privacy-policy",
    "terms-of-use",
  ];

  var LEGAL_KEYWORDS = [
    "shall",
    "herein",
    "pursuant",
    "liability",
    "indemnify",
    "arbitration",
    "jurisdiction",
    "warrant",
    "governing law",
    "force majeure",
    "breach",
    "terminate",
    "suspend",
    "hereinafter",
    "notwithstanding",
    "whereas",
    "hereunder",
    "covenant",
    "relinquish",
    "waive",
    "waiver",
  ];

  var HEADING_PATTERNS = [
    "terms of service",
    "terms of use",
    "privacy policy",
    "user agreement",
    "terms and conditions",
    "legal notice",
    "cookie policy",
    "data policy",
    "platform terms",
    "service agreement",
    "subscriber agreement",
    "acceptable use",
    "terms of sale",
    "end user license",
    "eula",
    "master agreement",
    "service level agreement",
  ];

  var LEGAL_STRUCTURAL_PATTERNS = [
    /\bsection\s+\d+[\.\d]*\b/i,
    /\barticle\s+[IVX\d]+[\.\d]*\b/i,
    /\b\d+\.\d+\s+[A-Z]/,
    /\blast\s+updated[:\s]/i,
    /\beffective\s+date[:\s]/i,
    /\beffective\s+as\s+of\b/i,
    /\bplease\s+read\s+(these|the)\s+(terms|agreement|policy)\b/i,
    /\byou\s+(acknowledge|agree|consent)\s+that\b/i,
    /\bwe\s+(may|shall|will)\s+(collect|use|share|process)\b/i,
  ];

  var HOSTNAME_LABELS = {
    legal: true,
    terms: true,
    privacy: true,
    tos: true,
    eula: true,
    policy: true,
    agreements: true,
    agreement: true,
  };

  var TERMS_HREF = /\/terms|\/tos|\/legal|\/privacy|\/policy|\/eula|\/agreement|\/conditions/i;

  var DETECTION_THRESHOLD = 5;
  var TEXT_LIMIT = 50000;
  var DISMISS_MS = 24 * 60 * 60 * 1000;
  var POPUP_MIN_CONFIDENCE = 5;

  function isExcludedPage(input) {
    var host = String(input && input.hostname ? input.hostname : "").toLowerCase();
    var path = String(input && input.pathname ? input.pathname : "").toLowerCase();
    var search = String(input && input.search ? input.search : "");

    for (var i = 0; i < EXCLUDED_PATH_PREFIXES.length; i++) {
      if (path.startsWith(EXCLUDED_PATH_PREFIXES[i])) return true;
    }

    for (var j = 0; j < EXCLUDED_DOMAIN_PATHS.length; j++) {
      var rule = EXCLUDED_DOMAIN_PATHS[j];
      if (host.indexOf(rule.domain) !== -1 && path.startsWith(rule.pathPrefix)) {
        if (rule.requiresSearch && !search) continue;
        return true;
      }
    }
    return false;
  }

  function scoreURL(pathname) {
    var segments = String(pathname || "")
      .toLowerCase()
      .split("/")
      .filter(Boolean);
    var score = 0;
    for (var i = 0; i < URL_PATTERNS.length; i++) {
      var pattern = URL_PATTERNS[i];
      for (var s = 0; s < segments.length; s++) {
        if (segments[s] === pattern || segments[s].indexOf(pattern) !== -1) {
          score += 2;
          break;
        }
      }
    }
    return score;
  }

  function scoreDomSignals(input) {
    var title = String(input && input.title ? input.title : "").toLowerCase();
    var headingTexts = (input && input.headingTexts) || [];
    var bodyText = String(input && input.bodyText ? input.bodyText : "");
    var score = 0;

    for (var h = 0; h < headingTexts.length; h++) {
      var heading = String(headingTexts[h] || "").trim().toLowerCase();
      for (var hp = 0; hp < HEADING_PATTERNS.length; hp++) {
        if (heading.indexOf(HEADING_PATTERNS[hp]) !== -1) {
          score += 3;
          break;
        }
      }
    }

    for (var tp = 0; tp < HEADING_PATTERNS.length; tp++) {
      if (title.indexOf(HEADING_PATTERNS[tp]) !== -1) {
        score += 3;
        break;
      }
    }

    var words = bodyText.split(/\s+/).filter(Boolean);
    var totalWords = words.length;
    if (totalWords > 0) {
      var legalCount = 0;
      for (var k = 0; k < LEGAL_KEYWORDS.length; k++) {
        var keyword = LEGAL_KEYWORDS[k];
        var re = new RegExp("\\b" + keyword.replace(/ /g, "\\s+") + "\\b", "gi");
        var matches = bodyText.match(re);
        if (matches) legalCount += matches.length;
      }
      var density = legalCount / totalWords;
      if (density > 0.005) score += 4;
      else if (density > 0.002) score += 2;
    }

    var structuralHits = 0;
    for (var p = 0; p < LEGAL_STRUCTURAL_PATTERNS.length; p++) {
      if (LEGAL_STRUCTURAL_PATTERNS[p].test(bodyText)) structuralHits++;
    }
    if (structuralHits >= 3) score += 3;
    else if (structuralHits >= 1) score += 1;

    if (totalWords > 2000) score += 2;
    else if (totalWords > 800) score += 1;

    return score;
  }

  function scorePage(input) {
    if (isExcludedPage(input)) return { urlScore: 0, domScore: 0, combined: 0, excluded: true };
    var urlScore = scoreURL(input && input.pathname);
    var domScore = scoreDomSignals(input);
    return { urlScore: urlScore, domScore: domScore, combined: urlScore + domScore, excluded: false };
  }

  function isHighConfidenceLegalPage(score) {
    if (typeof score === "number") return score >= DETECTION_THRESHOLD;
    var combined = Number(score && score.combined || 0);
    var urlScore = Number(score && score.urlScore || 0);
    var domScore = Number(score && score.domScore || 0);
    if (combined < DETECTION_THRESHOLD) return false;

    // A legal-looking URL or heading alone is not enough. Requiring evidence
    // from both the URL and document body avoids prompting on marketing pages,
    // privacy centers, settings screens, and articles that merely discuss ToS.
    return (urlScore >= 2 && domScore >= 4) || domScore >= 7;
  }

  function sitemapUrlLooksLegal(url) {
    var lower = String(url || "").toLowerCase();
    for (var i = 0; i < URL_PATTERNS.length; i++) {
      var p = URL_PATTERNS[i];
      if (lower.indexOf("/" + p) !== -1 || lower.indexOf("-" + p) !== -1) return true;
    }
    return false;
  }

  function isTermsHref(href) {
    if (!href || !TERMS_HREF.test(href)) return false;
    try {
      var path = new URL(String(href), "https://themys.invalid").pathname.toLowerCase();
      if (/\/(?:privacy|cookie|consent)-(?:settings|preferences|choices|controls|center)(?:\/|$)/.test(path)) return false;
    } catch (_) {}
    return true;
  }

  function scorePopupDetection(input) {
    var score = 0;
    var t = String(input && input.text ? input.text : "").toLowerCase();
    var linkHref = input && input.linkHref ? String(input.linkHref) : "";

    if (t.indexOf("terms of service") !== -1) score += 3;
    else if (t.indexOf("terms and conditions") !== -1) score += 3;
    else if (t.indexOf("terms of use") !== -1) score += 2;
    else if (t.indexOf("terms") !== -1) score += 1;
    if (t.indexOf("privacy policy") !== -1) score += 1;

    if (/i\s+agree|you\s+agree|agree\s+to/i.test(t)) score += 2;
    if (/by\s+(?:clicking|tapping|continuing|signing)/i.test(t)) score += 3;
    if (/accept|consent/i.test(t)) score += 1;

    if (linkHref) {
      if (/\/terms|\/tos/i.test(linkHref)) score += 2;
      else if (/\/privacy|\/legal|\/policy/i.test(linkHref)) score += 1;
    }

    if (input && input.hasButton) score += 2;
    if (input && input.inDialog) score += 1;
    if (input && input.isInline) score += 1;

    return score;
  }

  function hasExplicitAgreementIntent(text) {
    var value = String(text || "").toLowerCase();
    return /\bby\s+(?:clicking|tapping|selecting|continuing|signing\s+up|creating|registering|proceeding|using)\b/.test(value) ||
      /\bi\s+(?:agree|accept|consent|acknowledge)\s+to\b/.test(value) ||
      /\byou\s+(?:agree|accept|consent|acknowledge)\s+to\s+(?:the|our|these)\s+(?:terms|conditions|agreement|policy)\b/.test(value) ||
      /\b(?:agree|accept|consent)\s+to\s+(?:the|our|these)\s+(?:terms|conditions|agreement|policy)\b/.test(value);
  }

  function isCookieConsentText(text) {
    var value = String(text || "").toLowerCase();
    var cookieSignals = (value.match(/\b(?:cookie|cookies|tracking technologies|manage preferences|accept all|reject all)\b/g) || []).length;
    return cookieSignals >= 2 && !/\b(?:terms of service|terms and conditions|terms of use|user agreement|eula)\b/.test(value);
  }

  function isHighConfidencePopupDetection(input) {
    if (!input || !isTermsHref(input.linkHref) || !input.hasButton) return false;
    if (!hasExplicitAgreementIntent(input.text)) return false;
    if (isCookieConsentText(input.text)) return false;
    if (/\b(?:newsletter|marketing emails?|promotional emails?|email updates)\b/i.test(String(input.text || ""))) return false;
    return scorePopupDetection(input) >= POPUP_MIN_CONFIDENCE;
  }

  function matchesHostnameShape(hostname) {
    var host = String(hostname || "")
      .toLowerCase()
      .replace(/\.$/, "");
    if (!host) return false;
    var labels = host.split(".");
    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      if (!label || label === "www") continue;
      if (HOSTNAME_LABELS[label]) return true;
      if (
        label.indexOf("terms-") === 0 ||
        label.indexOf("privacy-") === 0 ||
        label.indexOf("legal-") === 0 ||
        label.indexOf("tos-") === 0
      ) {
        return true;
      }
    }
    return false;
  }

  var api = {
    EXCLUDED_PATH_PREFIXES: EXCLUDED_PATH_PREFIXES,
    URL_PATTERNS: URL_PATTERNS,
    HEADING_PATTERNS: HEADING_PATTERNS,
    DETECTION_THRESHOLD: DETECTION_THRESHOLD,
    TEXT_LIMIT: TEXT_LIMIT,
    DISMISS_MS: DISMISS_MS,
    POPUP_MIN_CONFIDENCE: POPUP_MIN_CONFIDENCE,
    TERMS_HREF: TERMS_HREF,
    isExcludedPage: isExcludedPage,
    scoreURL: scoreURL,
    scoreDomSignals: scoreDomSignals,
    scorePage: scorePage,
    isHighConfidenceLegalPage: isHighConfidenceLegalPage,
    sitemapUrlLooksLegal: sitemapUrlLooksLegal,
    isTermsHref: isTermsHref,
    scorePopupDetection: scorePopupDetection,
    hasExplicitAgreementIntent: hasExplicitAgreementIntent,
    isCookieConsentText: isCookieConsentText,
    isHighConfidencePopupDetection: isHighConfidencePopupDetection,
    matchesHostnameShape: matchesHostnameShape,
  };

  root.ThemysDetection = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
