import { AuthLayoutShell } from "@/layouts/auth-layout";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthLayoutShell>{children}</AuthLayoutShell>;
}
