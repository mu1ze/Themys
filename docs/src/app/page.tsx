import { getAllDocs } from "./lib/content";
import { sidebar } from "./lib/sidebar";
import { DocsLandingContent } from "./docs-landing-content";

export default function DocsLanding() {
  const docs = getAllDocs();
  return <DocsLandingContent docs={docs} sidebarSections={sidebar} />;
}
