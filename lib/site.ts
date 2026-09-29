export const SITE_NAME = "Friends Publishing House";
export const TAGLINE = "Manga by Rare Friends holders, starring their Friends.";

export function baseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3190";
}

/** Absolute URL for a stored asset (local /api/media paths are relative). */
export const absolute = (url: string) => (url.startsWith("http") ? url : `${baseUrl()}${url}`);
