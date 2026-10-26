import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API key is read at request time by the route handler in
  // src/app/api/mb; nothing here exposes it to the browser. Never add it to
  // `env` or give it a NEXT_PUBLIC_ prefix: both would inline it in the JS bundle.
  poweredByHeader: false,
};

export default nextConfig;
