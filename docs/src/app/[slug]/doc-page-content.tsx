"use client";

import Link from "next/link";
import { useTheme } from "@/lib/theme-context";
import { DocsTOC } from "../components/docs-toc";

type DocPageContentProps = {
  slug: string;
  title: string;
  description: string;
  content: string;
  headings: { id: string; text: string; level: number }[];
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
};

const C = {
  dark: {
    text: "#f9fafb", textSec: "#9ca3af", textMuted: "#6b7280", accent: "#2563eb",
    border: "#1f2937", card: "#111827", cardHover: "#1a2332",
    codeBg: "#0f1628", codeText: "#e2e8f0", inlineCodeBg: "#1e293b", inlineCodeText: "#e2e8f0",
    blockquoteBg: "rgba(37,99,235,0.1)", blockquoteBorder: "#2563eb", blockquoteText: "#93c5fd",
    tableBg: "#111827", tableBorder: "#1f2937", tableHeaderText: "#f9fafb", tableCellText: "#9ca3af",
    hr: "#1f2937",
  },
  light: {
    text: "#0f172a", textSec: "#475569", textMuted: "#94a3b8", accent: "#2563eb",
    border: "#e2e8f0", card: "#ffffff", cardHover: "#f8fafc",
    codeBg: "#0f172a", codeText: "#e2e8f0", inlineCodeBg: "#1e293b", inlineCodeText: "#e2e8f0",
    blockquoteBg: "#eff6ff", blockquoteBorder: "#2563eb", blockquoteText: "#1e40af",
    tableBg: "#ffffff", tableBorder: "#e2e8f0", tableHeaderText: "#0f172a", tableCellText: "#475569",
    hr: "#e2e8f0",
  },
};

export function DocPageContent({ slug, title, description, content, headings, prev, next }: DocPageContentProps) {
  const { theme } = useTheme();
  const c = C[theme];

  const html = markdownToHtml(content, c);

  return (
    <div className="relative flex gap-8">
      <article className="min-w-0 flex-1 max-w-3xl">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm" style={{ color: c.textMuted }}>
          <Link href="/" className="hover:underline" style={{ color: c.textMuted }}>Docs</Link>
          <span>/</span>
          <span style={{ color: c.textSec }}>{title}</span>
        </nav>

        <h1 className="text-3xl font-medium tracking-[-0.035em]" style={{ color: c.text }}>{title}</h1>
        {description && (
          <p className="mt-3 text-lg leading-8" style={{ color: c.textSec }}>{description}</p>
        )}

        <div className="mt-8 border-t pt-8" style={{ borderColor: c.border }}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        {/* Prev/Next navigation */}
          <nav className="mt-12 flex items-stretch border-y" style={{ borderColor: c.border }}>
          {prev ? (
            <Link
              href={`/${prev.slug}`}
              className="group flex-1 border-r p-4 transition hover:bg-[var(--ds-card-hover)]"
              style={{ borderColor: c.border }}
            >
              <span className="text-xs" style={{ color: c.textMuted }}>Previous</span>
              <p className="mt-1 text-sm font-semibold group-hover:text-[#2563eb]" style={{ color: c.text }}>← {prev.title}</p>
            </Link>
          ) : <div className="flex-1" />}
          {next ? (
            <Link
              href={`/${next.slug}`}
              className="group flex-1 p-4 text-right transition hover:bg-[var(--ds-card-hover)]"
            >
              <span className="text-xs" style={{ color: c.textMuted }}>Next</span>
              <p className="mt-1 text-sm font-semibold group-hover:text-[#2563eb]" style={{ color: c.text }}>{next.title} →</p>
            </Link>
          ) : <div className="flex-1" />}
        </nav>

      </article>

      {/* Right TOC */}
      <aside className="hidden xl:block w-[200px] shrink-0">
        <div className="sticky top-20">
          <DocsTOC headings={headings} />
        </div>
      </aside>
    </div>
  );
}

function markdownToHtml(md: string, c: (typeof C)[keyof typeof C]): string {
  const codeBlocks: string[] = [];
  const tables: string[] = [];
  const renderTableCell = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`([^`]+)`/g, `<code class="rounded px-1.5 py-0.5 text-xs font-mono" style="background:${c.inlineCodeBg};color:${c.inlineCodeText}">$1</code>`)
    .replace(/\*\*(.+?)\*\*/g, `<strong class="font-semibold" style="color:${c.text}">$1</strong>`)
    .replace(/\[(.+?)\]\((.+?)\)/g, `<a href="$2" style="color:${c.accent}" class="underline underline-offset-2">$1</a>`);
  let html = md
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const index = codeBlocks.push(
        `<div class="relative my-6 overflow-hidden rounded-xl border" style="border-color:${c.tableBorder}"><div class="flex items-center justify-between px-4 py-2" style="background:#0a1628"><span class="text-xs font-mono" style="color:#94a3b8">${lang || "code"}</span><button class="copy-btn text-xs cursor-pointer" style="color:#94a3a8">Copy</button></div><pre class="overflow-x-auto p-4 text-sm leading-6" style="background:${c.codeBg};color:${c.codeText}"><code class="language-${lang}">${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre></div>`,
      ) - 1;
      return `\n<!--CODE_BLOCK_${index}-->\n`;
    })
    // Tables: convert Markdown table syntax into a responsive, semantic table.
    .replace(/(^\|[^\n]+\|\n)^\|(?:\s*:?-{3,}:?\s*\|)+\n((?:^\|[^\n]+\|\n?)+)/gm, (_, headerLine, body) => {
      const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const header = cells(headerLine);
      const rows: string[][] = body.trim().split("\n").filter(Boolean).map(cells);
      const index = tables.push(
        `<div class="my-8 overflow-x-auto rounded-xl border shadow-sm" style="border-color:${c.tableBorder};background:${c.tableBg}"><table style="width:100%;min-width:520px;border-collapse:collapse;text-align:left"><thead><tr style="background:${c.cardHover}">${header.map((cell) => `<th scope="col" style="border-bottom:1px solid ${c.tableBorder};padding:0.75rem 1rem;color:${c.tableHeaderText};font-size:0.875rem;font-weight:600">${renderTableCell(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td style="border-bottom:1px solid ${c.tableBorder};padding:0.75rem 1rem;vertical-align:top;color:${c.tableCellText};font-size:0.875rem;line-height:1.5">${renderTableCell(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`,
      ) - 1;
      return `\n<!--TABLE_${index}-->\n`;
    })
    // Inline code
    .replace(/`([^`]+)`/g, `<code class="rounded px-1.5 py-0.5 text-sm font-mono" style="background:${c.inlineCodeBg};color:${c.inlineCodeText}">$1</code>`)
    // Headings
    .replace(/^### (.+)$/gm, (_, text) => {
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return `<h3 id="${id}" class="text-xl font-semibold mt-8 mb-3 scroll-mt-24" style="color:${c.text}">${text}</h3>`;
    })
    .replace(/^## (.+)$/gm, (_, text) => {
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return `<h2 id="${id}" class="text-2xl font-medium tracking-tight mt-12 mb-4 scroll-mt-24" style="color:${c.text}">${text}</h2>`;
    })
    // Blockquotes
    .replace(/^> (.+)$/gm, `<div class="my-6 border-y border-l-2 px-5 py-4" style="border-color:${c.blockquoteBorder};background:${c.blockquoteBg}"><p class="text-sm leading-6" style="color:${c.blockquoteText}">$1</p></div>`)
    // Bold
    .replace(/\*\*(.+?)\*\*/g, `<strong class="font-semibold" style="color:${c.text}">$1</strong>`)
    // Italic
    .replace(/\*(.+?)\*/g, `<em>$1</em>`)
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, `<a href="$2" style="color:${c.accent}" class="underline underline-offset-2 hover:opacity-80">$1</a>`)
    // Unordered lists
    .replace(/^- (.+)$/gm, `<li class="md-unordered-item text-base leading-7" style="color:${c.textSec}">$1</li>`)
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, `<li class="md-ordered-item text-base leading-7" style="color:${c.textSec}">$1</li>`)
    // HR
    .replace(/^---$/gm, `<hr class="my-8" style="border-color:${c.hr}" />`)
    // Paragraphs
    .replace(/^(?!<)(.+)$/gm, (match) => {
      if (match.trim() === "") return "";
      return `<p class="text-base leading-7 mb-4" style="color:${c.textSec}">${match}</p>`;
    });

  // Wrap consecutive unordered list items in ul.
  html = html.replace(/(<li class="md-unordered-item[^>]*>[\s\S]*?<\/li>\n?)+/g, (match) =>
    `<ul class="list-disc pl-6 space-y-2 mb-4">${match}</ul>`
  );
  // Wrap ordered list items in ol, preserving the document's numbering.
  html = html.replace(/(<li class="md-ordered-item[^>]*>[\s\S]*?<\/li>\n?)+/g, (match) =>
    `<ol class="list-decimal pl-6 space-y-3 mb-6">${match}</ol>`
  );
  html = html.replace(/<!--CODE_BLOCK_(\d+)-->/g, (_, index) => codeBlocks[Number(index)]);
  html = html.replace(/<!--TABLE_(\d+)-->/g, (_, index) => tables[Number(index)]);

  return html;
}
