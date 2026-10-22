---
title: "FAQ"
description: "Frequently asked questions about Themys: accuracy, privacy, permissions, credits, and more."
order: 11
---

## General

### How accurate is the analysis?

Themys uses automated analysis to identify common concerns like data sharing, arbitration clauses, and liability limitations.

However:

- The analysis is **not legal advice**. It's a tool to help you understand what you're agreeing to.
- Accuracy depends on the quality of the source text. Extracting from clean HTML pages produces the best results.
- Automated analysis may occasionally miss nuance or flag clauses that are standard for a specific industry.
- Laws vary by jurisdiction. A clause flagged as problematic in one country may be standard in another.

For high-stakes decisions, always consult a qualified attorney.

### Is my data private?

Yes. Your scan data is stored per-user and is not shared with other users or third parties.

- Each scan result is tied to your account
- Scan history is only visible to you when logged in
- The extracted ToS text and analysis results are stored securely
- Themys does not sell or share your scan data

You can delete your account and associated Themys data from the **Danger zone** on [Settings](https://themys.ca/settings). Read the [Privacy Policy](https://docs.themys.ca/legal#privacy) for retention details.

### What does the Chrome extension access?

The Chrome extension is coming soon and is not currently available. Until its
Web Store listing and permissions are verified, use the web app. See the
[Privacy Policy](https://docs.themys.ca/legal#privacy) for details.

### Can I use Themys without the extension?

Yes. The web app at [themys.ca/scan/new](https://themys.ca/scan/new) provides the same analysis features:

1. Go to the scan page
2. Enter the URL of any public Terms of Service or Privacy Policy page
3. Click **Scan Now**

No browser extension required. The web app works in any modern browser.

## Scans & Limits

### How many documents can I monitor?

The Free plan can monitor 1 document with alerts in the app. Personal supports
10 documents with email alerts, and Founder supports 25. Email alerts can be
disabled per document from the Monitoring page.

Free includes one lifetime paste or PDF contract review. After that trial,
paste and PDF upload require Founder. Personal covers URL and extension page
scans only.

### How do credits work?

Credits are used when you exceed your monthly review or AI explanation allowance:

- **Free plan:** 15 reviews/month
- **Personal plan:** 30 reviews/month
- **Founder plan:** 50 reviews/month

When you hit the relevant plan allowance, an additional scan or AI explanation can consume **1 credit**. Credits expire 12 months after purchase.

You can purchase additional credit packs from the [pricing page](https://themys.ca/pricing#credits):

| Pack | Credits | Price |
|------|---------|-------|
| 10 credits | 10 | $1.99 |
| 50 credits | 50 | $7.99 |
| 200 credits | 200 | $24.99 |

### What happens when my monthly limit resets?

Monthly review and AI limits reset at the start of each UTC month. After the
reset, you get your full monthly allowance back.

Credits are independent of the monthly limit and are used only after the relevant included allowance is exhausted. Each credit pack expires 12 months after purchase.

### Can I export my scan results?

Eligible scan results can be exported as a PDF from the result page. You can also access results programmatically through the [API](/api-overview).

### Can Themys scan any website?

Themys works best on pages that contain Terms of Service, Privacy Policies, or similar legal documents. It can extract text from:

- Standard HTML pages
- Public pages that render their legal text in the browser

It may not work well with:

- Pages that require authentication to view
- Pages with heavy anti-bot protection
- Dynamically loaded content behind user interaction

## API

### Is there an API?

Yes. Themys provides a REST API for extracting and analyzing Terms of Service programmatically.

See the API documentation for details:

- [API Overview](/api-overview): Authentication, base URL, and general usage
- [POST /api/extract](/api-extract): Extract text from a URL
- [POST /api/analyze](/api-analyze): Analyze text and get flagged clauses with attention guidance

### How do I authenticate with the API?

Use an API key for programmatic integrations. See the [API Overview](/api-overview) and [API Keys](/api-keys) for details.

### What are the API rate limits?

| Plan | Monthly reviews |
|------|-----------------|
| Free | 15 |
| Personal | 30 |
| Founder | 50 |

## Billing

### How does billing work?

Subscriptions are billed according to the plan and checkout terms you accept.

- **Change plan:** Use **Manage billing** in Settings. Stripe shows any price change before you confirm it.
- **Cancel:** Your plan reverts to Free at the end of the billing cycle

### Can I get a refund?

The [Refund Policy](https://docs.themys.ca/legal#refunds) provides a 14-day request window for a first subscription payment with limited paid use, a seven-day window for an unused renewal, and a 14-day window for an unused credit pack. Billing errors and service failures are reviewed separately. Request a refund from [Settings → Payments](https://themys.ca/settings#payments), or email [admin@themys.ca](mailto:admin@themys.ca) if you cannot sign in.

### What happens to my data if I downgrade?

Your scan history is preserved when you downgrade. You just get fewer monthly reviews:

- Previously completed scans remain in your history
- Existing credits carry over
- Monthly review limit changes to match the new plan

## Troubleshooting

### When will the extension be available?

The Chrome extension is coming soon. We will publish installation and
troubleshooting steps after the Web Store release is verified.

### My scan failed with an error

Common causes:

- **"Extraction failed"**: The page blocked automated access or returned no readable text. Try the web app instead.
- **"Monthly review limit reached"**: You've hit your monthly review limit. Wait for the next UTC month or use credits.
- **"Text too short"**: The extracted text was under 50 words. Verify the URL points to the actual ToS page.

### I can't sign in

- If you signed up with Google or Apple, make sure you're using the same account
- Clear your browser cookies for themys.ca and try again
- Check if your account was deleted. Deleted accounts cannot be recovered.
