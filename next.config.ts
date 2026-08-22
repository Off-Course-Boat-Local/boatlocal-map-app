import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 refuses to start a second `next dev` for the same project
  // directory — it locks on `<distDir>/dev/lock`. Giving a second server its
  // own dist dir is the supported way for two people to run this repo at once
  // (e.g. one previewing Studio as a company admin while another works the
  // guide side). Unset — the normal case — this is a no-op and the build
  // output stays in `.next` exactly as before.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
};

export default nextConfig;
