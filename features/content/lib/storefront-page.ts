import type { CmsPage, CmsPageBlockType } from "@/types/content";

/**
 * A PUBLISHED CMS page as the phone app reads it — `GET /api/storefront/pages/[slug]`.
 *
 * Only what `/store/pages/[slug]`, `/store/privacy` and `/store/terms` already
 * put in front of any visitor: the title, the one-line description and the
 * body blocks. Nothing of the editor — status, schedule, sort order, SEO, the
 * system flag — because the admin route `/api/pages` is where those live, and
 * it stays signed-in only.
 */
export interface StorefrontPageBlock {
  id: string;
  type: CmsPageBlockType;
  content: string;
}

export interface StorefrontPage {
  slug: string;
  title: string;
  description: string;
  blocks: StorefrontPageBlock[];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The body, block by block, the way `CmsPageView`'s `renderBlocks` draws it:
 * a `heading` is a heading and ANY other type is a paragraph. The collection is
 * `Mixed` in Mongo, so a hand-edited record must not be able to hand the app a
 * block it cannot draw — and a block with no words renders nothing on the
 * website, so it is not sent.
 */
export function storefrontPageFrom(page: CmsPage): StorefrontPage {
  const blocks = (Array.isArray(page.blocks) ? page.blocks : [])
    .map((block, index) => ({
      id: text(block?.id) || `block-${index}`,
      type: (block?.type === "heading" ? "heading" : "paragraph") as CmsPageBlockType,
      content: text(block?.content),
    }))
    .filter((block) => block.content.length > 0);

  return {
    slug: text(page.slug),
    title: text(page.title),
    description: text(page.description),
    blocks,
  };
}
