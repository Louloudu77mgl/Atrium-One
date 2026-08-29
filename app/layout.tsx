import type { Metadata } from "next";
import "./globals.css";
import { socialFontVariables } from "./social-font-assets";
import { FailureSupportProvider } from "@/components/FailureSupportProvider";

export const metadata: Metadata = {
  title: "AtriumOne",
  description: "Dashboard IA pour commerçants indépendants"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={socialFontVariables}><FailureSupportProvider>{children}</FailureSupportProvider></body>
    </html>
  );
}
