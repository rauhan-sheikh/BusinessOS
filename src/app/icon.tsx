import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F172A",
          borderRadius: "8px",
          border: "1.5px solid #6366F1",
          position: "relative",
        }}
      >
        {/* Left balance pillar */}
        <div
          style={{
            position: "absolute",
            left: "7px",
            top: "8px",
            width: "4.5px",
            height: "15px",
            background: "#6366F1",
            borderRadius: "2.5px",
          }}
        />
        {/* Right balance pillar */}
        <div
          style={{
            position: "absolute",
            right: "7px",
            bottom: "8px",
            width: "4.5px",
            height: "11.5px",
            background: "#818CF8",
            borderRadius: "2.5px",
          }}
        />
        {/* Central connector */}
        <div
          style={{
            position: "absolute",
            left: "9px",
            top: "14px",
            width: "14px",
            height: "2.5px",
            background: "#A5B4FC",
            borderRadius: "1px",
          }}
        />
        {/* Emerald accent dot */}
        <div
          style={{
            position: "absolute",
            right: "7px",
            top: "8px",
            width: "4.5px",
            height: "4.5px",
            background: "#10B981",
            borderRadius: "50%",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
