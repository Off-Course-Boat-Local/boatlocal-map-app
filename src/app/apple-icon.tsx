// iOS home-screen icon (PRD §5.7's Install flow).
// Renders the BoatLocal brand icon: #ff6301 circle with #fbf2ef monogram.

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
          background: "#091747",
        }}
      >
        <svg width="150" height="150" viewBox="0 0 595.28 595.28">
          <circle cx="297.64" cy="297.64" r="259.86" fill="#ff6301" />
          <path
            d="M212.91,381.02c55.06,0,55.06,28.29,110.12,28.29,41.51,0,51.74-16.08,77.85-23.99,8.39-16.23,12.62-37.26,12.62-63.19,0-33.66-7.18-59.08-21.53-76.29-14.36-17.2-34.77-25.8-61.25-25.8-22.52,0-40.84,7.55-54.94,22.64v-91.32h-73.87v230.09c3.42-.27,7.06-.43,11.01-.43ZM275.03,316.56c0-12.37,2.72-22.46,8.17-30.26,5.44-7.79,13.61-11.69,24.5-11.69,21.28,0,31.93,12.75,31.93,38.24v19.67c0,25.24-10.65,37.86-31.93,37.86-10.89,0-19.06-3.83-24.5-11.51-5.45-7.67-8.17-17.69-8.17-30.07v-12.25Z"
            fill="#fbf2ef"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
