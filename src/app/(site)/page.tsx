import { RenderBlocks } from "@/components/public/blocks/render-blocks";
import { EmptyState } from "@/components/public/article-card";
import { getHomepage } from "@/lib/cms/homepage";
import { buildMetadata } from "@/lib/seo";

export function generateMetadata() {
  return buildMetadata({ path: "/" });
}

export default async function HomePage() {
  const homepage = await getHomepage("published");
  if (!homepage || homepage.blocks.length === 0) {
    return (
      <div className="container-site py-20">
        <EmptyState title="Inihahanda pa ang homepage.">Walang nakalathalang homepage configuration sa Studio.</EmptyState>
      </div>
    );
  }
  return <RenderBlocks blocks={homepage.blocks} />;
}
