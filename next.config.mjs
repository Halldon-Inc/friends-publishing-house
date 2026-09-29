/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rarefriends/friendsdk"],
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      { source: "/((?!embed/).*)", headers: [...security, { key: "X-Frame-Options", value: "DENY" }] },
      { source: "/embed/:path*", headers: security },
    ];
  },
};
export default nextConfig;
