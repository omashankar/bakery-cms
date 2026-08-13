import type { Metadata } from "next";
import { GalleryPage } from "@/apps/website";
import { buildRouteMetadataServer } from "@/features/seo/server/seo-store.server";
import { getPublishedHomepageSections } from "@/features/cms-sections/data/homepage-sections.server";
import { parseListField, renderableRows } from "@/constants/section-registry";

/**
 * Per request, not at module load.
 *
 * `export const metadata = ...` is evaluated once when this module loads, so
 * it could never reflect what the admin saved — and the builder it called
 * read a module variable that only client code writes, i.e. the demo seed.
 */
export async function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadataServer("store-gallery");
}

export default async function Page() {
  /**
   * The shop's photographs live on its Gallery SECTION.
   *
   * There is no second place to upload them, and asking an admin to maintain
   * two lists of the same pictures is how they drift apart. Both this page and
   * the homepage strip used to render the same twelve stock photos from a
   * constant; both now read what the shop actually put in the builder.
   */
  const sections = await getPublishedHomepageSections();
  const gallery = sections.find((section) => section.type === "gallery");
  const photos = gallery
    ? renderableRows(parseListField(gallery.content, "images")).map((row) => ({
        image: row.image,
        title: row.title,
        tag: row.tag,
      }))
    : [];

  return <GalleryPage photos={photos} />;
}
