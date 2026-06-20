interface ScoutFlowLogoProps {
  size?: "sm" | "md" | "lg";
  textColor?: string;
  className?: string;
}

export function ScoutFlowLogo({ size = "md", className }: ScoutFlowLogoProps) {
  const iconSize = size === "sm" ? 22 : size === "lg" ? 38 : 30;
  const textSz = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";

  return (
    <div className="flex items-center gap-2 select-none">
      {/* Basketball / SF mark */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Outer basketball */}
        <circle cx="20" cy="20" r="19" fill="#f97316" />
        {/* Seam — horizontal arc */}
        <path
          d="M1.5 20 C8 6 20 14 20 20 C20 26 32 34 38.5 20"
          fill="none"
          stroke="rgba(0,0,0,0.22)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Seam — vertical arc */}
        <path
          d="M20 1.5 C6 8 14 20 20 20 C26 20 34 32 20 38.5"
          fill="none"
          stroke="rgba(0,0,0,0.22)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* SF letters */}
        <text
          x="3.5"
          y="30"
          fontFamily="'Arial Black', 'Impact', sans-serif"
          fontSize="24"
          fontWeight="900"
          fontStyle="italic"
          fill="white"
          letterSpacing="-1"
        >
          SF
        </text>
      </svg>

      {/* Wordmark */}
      <span className={`${textSz} font-black leading-none tracking-tight`}>
        <span className="text-foreground">Scout</span>
        <span className="text-primary">Flow</span>
      </span>
    </div>
  );
}

/** Compact icon-only mark for mobile / tight spaces */
export function ScoutFlowMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ScoutFlow"
    >
      <circle cx="20" cy="20" r="19" fill="#f97316" />
      <path
        d="M1.5 20 C8 6 20 14 20 20 C20 26 32 34 38.5 20"
        fill="none"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 1.5 C6 8 14 20 20 20 C26 20 34 32 20 38.5"
        fill="none"
        stroke="rgba(0,0,0,0.22)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <text
        x="3.5"
        y="30"
        fontFamily="'Arial Black', 'Impact', sans-serif"
        fontSize="24"
        fontWeight="900"
        fontStyle="italic"
        fill="white"
        letterSpacing="-1"
      >
        SF
      </text>
    </svg>
  );
}
