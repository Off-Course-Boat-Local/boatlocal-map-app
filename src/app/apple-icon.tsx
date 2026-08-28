// iOS home-screen icon (PRD §5.7's Install flow).
// Renders the neutral black background (#17181C) with white sailboat glyph.

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
        }}
      >
        <svg width="110" height="110" viewBox="0 0 512 512" fill="none">
          <path
            d="M256 128v128h-96l96-128zm16 0v128h80l-80-128zM120 304h272l-35.2 67.2a48 48 0 0 1-43.2 25.6H198.4a48 48 0 0 1-43.2-25.6L120 304z"
            fill="#FFFFFF"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
