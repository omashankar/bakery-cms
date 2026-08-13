import {
  LandingGallery,
  type GalleryPhoto,
} from "@/apps/website/landing/components/landing-gallery";
import { StorePageHeader } from "@/apps/website/components/store-page-header";

/**
 * The shop's photographs come from its Gallery SECTION.
 *
 * There is no second place to upload them: the homepage's Gallery section is
 * where an admin curates this shop's pictures, so this page shows the same
 * ones rather than asking for them twice. Before, both rendered the same twelve
 * stock photos from a constant.
 */
export function GalleryPage({ photos = [] }: { photos?: GalleryPhoto[] }) {
  return (
    <>
      <StorePageHeader
        title="Gallery"
        description="A glimpse into our world of sweet artistry and celebration moments."
        breadcrumbs={[{ label: "Gallery" }]}
      />
      <LandingGallery showHeader={false} photos={photos} />
    </>
  );
}
