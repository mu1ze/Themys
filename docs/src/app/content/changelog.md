---
title: "Changelog"
description: "Public product updates for Themys."
order: 12
---

## September 2026

- Refreshed scan results with a shared expandable report layout and a dedicated **Full Document** view in the navigation.
- Simplified finding labels to **Warning**, **Noteworthy**, and **Informational**, and removed the slide-out inspector.
- Added TypeSafe Jev clause detection when configured; structured extraction and fallback analysis continue through OpenRouter.
- Added a versioned Developer API response contract, OpenAPI 3.1 schema, scoped API keys, and strict-analysis policy metadata for typed clients and LLM tools.

## August 2026

- Added document monitoring notifications for Base and Advanced plans, with
  per-document email controls, retry handling, and duplicate-send protection.
- Moved notification delivery to a private Cloudflare Worker service binding;
  production delivery no longer depends on a public Worker URL or shared email
  secret.
- Added monitoring setup, plan limits, and notification guidance to the docs.

## July 2026

- Updated the web app to support URL-based scans of public Terms of Service and Privacy Policy pages.
- Improved account settings, subscriptions, credit purchases, and payment history.
- Added expanded API documentation for supported programmatic analysis workflows.
- Added downloadable PDF reports for eligible scan results.

## June 2026

- Launched Themys for reviewing public Terms of Service and Privacy Policy pages.
- Added attention levels, clause explanations, structured extractions, and scan history. The Chrome extension integration is prepared but remains coming soon until its Web Store release is verified.

For current usage, privacy, and billing information, see the relevant pages in this documentation and the [legal policies](https://docs.themys.ca/legal).
