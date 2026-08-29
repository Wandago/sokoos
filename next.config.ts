import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static output: the whole app is client-rendered against local
  // storage, so it can be hosted anywhere and precached by the service
  // worker for real offline use.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
