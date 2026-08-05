// iOS home-screen icon (PRD §5.7's Install flow). iOS mostly ignores the Web
// App Manifest's `icons` list (src/app/manifest.ts) in favour of this
// specific file convention — see node_modules/next/dist/docs/01-app
// /03-api-reference/03-file-conventions/01-metadata/app-icons.md.
//
// Static (no request-time API used), so this generates once at build time
// and is cached like any other static asset, per that doc's "Good to know".
// Kept to a single ASCII letter on a plain background — the documented safe
// pattern for `ImageResponse` (see the doc's own example) — rather than an
// emoji or an embedded SVG path, both of which risk pulling in fonts/assets
// this build has no network access to fetch.
//
// Deliberately neutral, not any one tenant's brand colour — same reasoning
// as public/icons/icon.svg's comment.

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#17181C",
          color: "#FFFFFF",
          fontSize: 104,
          fontWeight: 700,
        }}
      >
        B
      </div>
    ),
    { ...size },
  );
}
