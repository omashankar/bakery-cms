import { LandingGallery } from "@/features/landing/components/landing-gallery";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";

export function GalleryPage() {
  return (
    <>
      <StorePageHeader
        title="Gallery"
        description="A glimpse into our world of sweet artistry and celebration moments."
        breadcrumbs={[{ label: "Gallery" }]}
      />
      <LandingGallery showHeader={false} />
    </>
  );
}
