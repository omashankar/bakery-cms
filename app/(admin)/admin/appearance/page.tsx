import type { Metadata } from "next";
import { AppearancePage } from "@/apps/admin/appearance";

export const metadata: Metadata = {
  title: "Appearance",
  description: "Theme colors, typography, and live preview.",
};

export default function Page() {
  return <AppearancePage />;
}
