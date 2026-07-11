import { Suspense } from "react";
import { WeddingPageContent } from "./wedding-page-content";

export function WeddingPage() {
  return (
    <Suspense fallback={<div className="min-h-96 animate-pulse bg-cream-50" />}>
      <WeddingPageContent />
    </Suspense>
  );
}
