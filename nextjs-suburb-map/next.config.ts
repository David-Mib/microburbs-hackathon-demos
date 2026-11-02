import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API key is read at request time on the server (src/lib/server); nothing
  // here exposes it to the browser. Never add it to `env` or give it a
  // NEXT_PUBLIC_ prefix: both would inline it in the JS bundle.
  poweredByHeader: false,
  async redirects() {
    return [
      // Old routes: the city map became the heat maps; suburb search became the homepage search.
      { source: "/city", destination: "/heatmaps", permanent: false },
      {
        source: "/search",
        has: [{ type: "query", key: "suburb", value: "(?<suburb>.+)" }],
        destination: "/suburbs/:suburb",
        permanent: false,
      },
      { source: "/search", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
