import { Suspense } from "react";
import { StoreHomeContent } from "./store-home-content";

export function StoreHomePage() {
  return (
    <Suspense fallback={<div className="min-h-96 animate-pulse bg-cream-50" />}>
      <StoreHomeContent />
    </Suspense>
  );
}
