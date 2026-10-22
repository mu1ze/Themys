---
title: "Extraction View"
description: "How to read the structured sections generated from a scanned document."
order: 5
---

## Extraction and Original Text

**Extraction** is a structured reading guide generated from the scanned text. It groups key points under section headings and may include supporting quotes. The section names depend on the document; they are not a fixed list of categories.

**Full Document** is a separate view containing the stored original text. Use it to check a quote in context. The extraction does not reproduce every paragraph of the document.

## Reading a Section

Select **Extraction** in the report navigation, then open a section to read its key points. Each point has a plain-English detail. A point may also have a quote and a label such as **Warning**, **Noteworthy**, or **Key point**. The label helps prioritize reading; it is not a legal conclusion.

Choose **Read the full document** from an open section to switch to the original text. When the section contains a matching quote, Themys attempts to highlight it there. You can also open **Full Document** directly from the navigation.

## When Extraction Is Unavailable

A scan can have a summary and flagged findings even if the separate structured extraction did not return usable sections. In that case, the Extraction view says that no sections are available. Review the flagged findings and the original text instead.

For scans of a public URL, source quality matters. Pages that block automated access, load important terms dynamically, or contain little readable text may produce incomplete results. Check the source page if the saved text appears incomplete.

## API Access

The [POST /api/analyze](/api-analyze) response includes `fullExtraction` when structured sections are available. An empty array means no usable sections were returned; it does not mean the source document had no terms. Each section has a title and key points with details, optional quotes, and severity labels.
