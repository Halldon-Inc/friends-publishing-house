import type { Metadata, Viewport } from "next";
import { SessionProvider } from "@/components/useSession";
import { TopBar } from "@/components/TopBar";
import { baseUrl, SITE_NAME, TAGLINE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl()),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: `${TAGLINE} Build worlds with FriendSDK, draw pages, publish, and share to X.`,
  openGraph: { siteName: SITE_NAME, type: "website", title: SITE_NAME, description: TAGLINE },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: TAGLINE },
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
};
export const viewport: Viewport = { themeColor: "#0a0a0a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip">Skip to content</a>
        <SessionProvider>
          <TopBar />
          <main id="main">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
