---
title: "How Attention Levels Work"
description: "Understand attention levels, clause categories, severity levels, and how review guidance is generated."
order: 4
---

## Attention Levels

Every scan assigns a qualitative attention level. The label is meant to help you decide where to focus your review, not to make a legal risk determination.

| Label | Color | Meaning |
|-------|-------|---------|
| Standard | Green | Typical clauses with lower review priority |
| Worth reviewing | Amber | Some clauses are worth reading before agreeing |
| Needs attention | Red | Clauses deserve careful review before accepting |

Treat every attention level as review guidance, not legal advice or an authoritative legal risk determination.

## Severity Levels

Findings use severity cues to explain why something was highlighted:

- **Informational** (neutral): Context worth understanding without a warning or noteworthy rating.
- **Noteworthy** (amber): A term worth reviewing, including some common industry terms.
- **Warning** (red): A term that deserves closer attention because of its potential effect on your rights or obligations.

These are review priorities. A warning does not, by itself, mean a term is unlawful or unusual.

## Categories

Themys looks for risks in areas such as the following. The exact finding titles depend on the detected terms:

| Category | What It Covers |
|----------|----------------|
| **Data Privacy** | Data collection, sharing with third parties, tracking, retention policies |
| **Arbitration** | Mandatory arbitration, class action waivers, jury trial waivers |
| **Liability** | Limitation of liability, indemnification, warranty disclaimers |
| **Content/IP** | Content licensing, IP ownership transfer, broad usage grants |
| **Billing** | Auto-renewal, hidden fees, unilateral price changes, cancellation hurdles |
| **Account** | Unilateral termination, account suspension, data deletion on termination |

## How to Use the Guidance

Start with clauses marked **Warning**, then read **Noteworthy** findings that involve the topics most important to you. Open **Full Document** to verify wording and surrounding context. The **Extraction** view can provide a structured reading guide when available.

## Example

Consider a ToS with two major findings:

- **Mandatory arbitration** with class action waiver in the Arbitration category
- **Broad data sharing** with third parties in the Data Privacy category

Those signals may produce an overall **Worth reviewing** attention level, with the arbitration and data-sharing clauses highlighted first.

## Color Coding Reference

Results use consistent color coding throughout the web app and the planned
extension (coming soon):

| Attention Level | Badge Color |
|-----------------|-------------|
| Standard | Green |
| Worth reviewing | Amber |
| Needs attention | Red |

These colors appear in attention badges, category breakdowns, and the overlay UI to provide at-a-glance review guidance.
