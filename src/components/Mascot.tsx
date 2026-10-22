"use client";

interface MascotProps {
  expression?: "happy" | "cheer" | "think" | "oops" | "wave" | "excited";
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const expressions = {
  happy: { eye: "○", mouth: "⌣" },
  cheer: { eye: "◕", mouth: "ω" },
  think: { eye: "○", mouth: "∽" },
  oops: { eye: "o", mouth: "▽" },
  wave: { eye: "◕", mouth: "ʕ" },
  excited: { eye: "◥", mouth: "►" },
} as const;

const sizes = {
  sm: "w-16 h-16 text-3xl",
  md: "w-24 h-24 text-4xl",
  lg: "w-36 h-36 text-6xl",
};

export function Mascot({
  expression = "happy",
  size = "md",
  label,
  className = "",
}: MascotProps) {
  const expr = expressions[expression];
  const sizeClass = sizes[size];

  return (
    <div
      className={`inline-flex flex-col items-center ${className}`}
      aria-label={label || `Mascota ${expression}`}
    >
      <div
        className={`${sizeClass} relative flex items-center justify-center`}
        role="img"
        aria-hidden={Boolean(label)}
      >
        {/* Cabeza */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-primary-dark shadow-xl flex items-center justify-center">
          {/* Antenas */}
          <div className="absolute -top-2 -left-1 w-2 h-6 bg-accent-pink rounded-full"></div>
          <div className="absolute -top-2 -right-1 w-2 h-6 bg-accent-teal rounded-full"></div>

          {/* Ojos */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex gap-2">
            <div
              className={`w-2.5 h-4 text-xl ${
                expr.eye === "○" ? "text-primary-dark" : "text-accent-teal"
              }`}
            >
              {expr.eye === "○" && "•"}
              {expr.eye === "◕" && "•"}
              {expr.eye === "o" && "•"}
              {expr.eye === "◥" && "◥"}
            </div>
            <div className="w-2.5 h-4 text-xl text-accent-teal">
              {expr.eye === "○" && "•"}
              {expr.eye === "◕" && "•"}
              {expr.eye === "o" && "•"}
              {expr.eye === "◥" && "◔"}
            </div>
          </div>

          {/* Boca / expresión */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl">
            {expr.mouth}
          </div>
        </div>
      </div>
      {label && (
        <span className="mt-2 text-sm font-medium text-text-muted">
          {label}
        </span>
      )}
    </div>
  );
}
