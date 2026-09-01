import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 refuses to start a second `next dev` for the same project
  // directory — it locks on `<distDir>/dev/lock`. Giving a second server its
  // own dist dir is the supported way for two people to run this repo at once
  // (e.g. one previewing Studio as a company admin while another works the
  // guide side). Unset — the normal case — this is a no-op and the build
  // output stays in `.next` exactly as before.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),

  experimental: {
    serverActions: {
      // Default is 1MB, which the recommendation/boat-tour forms blow past
      // immediately: photos have no Supabase Storage yet (see
      // RecommendationPhotosField.tsx's header comment), so every photo
      // submits as a base64 data: URL directly in the Server Action body —
      // up to MAX_PHOTOS (8) of them, each up to 4MB raw before base64's
      // ~33% inflation, whether from a manual upload or Google Places
      // enrichment's auto-downloaded photos (src/lib/admin/googlePlaces.ts).
      // 20mb comfortably covers real-world usage without removing the cap
      // entirely.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
