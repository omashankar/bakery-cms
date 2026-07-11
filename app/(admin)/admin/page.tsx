import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { routes } from "@/constants/routes";

export const metadata: Metadata = {
  title: "Admin",
  description: "Bakery CMS admin panel",
};

export default function AdminRootPage() {
  redirect(routes.admin.dashboard);
}
