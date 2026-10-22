import { notFound } from "next/navigation";
import { getDocBySlug, getAllDocs } from "../lib/content";
import { getAdjacentPages } from "../lib/sidebar";
import { DocPageContent } from "./doc-page-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllDocs().map((doc) => ({ slug: doc.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => {
    const doc = getDocBySlug(slug);
    if (!doc) return {};
    return {
      title: `${doc.title} | Themys Docs`,
      description: doc.description,
    };
  });
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);
  if (!doc) notFound();

  const { prev, next } = getAdjacentPages(slug);

  return (
    <DocPageContent
      slug={slug}
      title={doc.title}
      description={doc.description}
      content={doc.content}
      headings={doc.headings}
      prev={prev}
      next={next}
    />
  );
}
