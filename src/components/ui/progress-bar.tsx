"use client";

import { useEffect, useRef, useState } from "react";

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  animated?: boolean;
  color?: "primary" | "teal" | "green" | "amber" | "red" | "gradient";
  height?: number;
  striped?: boolean;
  className?: string;
}

const colorClasses: Record<NonNullable<ProgressBarProps["color"]>, string> = {
  primary: "bg-primary",
  teal: "bg-teal-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  gradient: "bg-gradient-to-r from-primary to-accent-teal",
};

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  animated = false,
  color = "gradient",
  height = 10,
  striped = false,
  className = "",
}: ProgressBarProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevPctRef = useRef(0);

  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  useEffect(() => {
    if (animated) {
      const start = prevPctRef.current;
      const end = pct;
      const duration = 700;
      const step = (end - start) / (duration / 16);
      let current = start;

      const timer = setInterval(() => {
        current += step;
        if ((step > 0 && current >= end) || (step < 0 && current <= end)) {
          setDisplayValue(end);
          prevPctRef.current = end;
          clearInterval(timer);
        } else {
          setDisplayValue(current);
          prevPctRef.current = current;
        }
      }, 16);

      return () => clearInterval(timer);
    } else {
      setDisplayValue(pct);
      prevPctRef.current = pct;
    }
  }, [pct, animated]);

  const fillColor = colorClasses[color];

  return (
    <div className={`w-full ${className}`}>
      {(label || showValue) && (
        <div className="flex justify-between text-xs text-text-muted mb-2">
          {label && <span>{label}</span>}
          {showValue && <span>{Math.round(displayValue)}%</span>}
        </div>
      )}
      <div
        className="w-full overflow-hidden rounded-full bg-surface-alt"
        style={{ height }}
      >
        <div
          className={`${fillColor} h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden`}
          style={{ width: `${displayValue}%` }}
        >
          {striped && (
            <div
              className="absolute inset-0 bg-white/20"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, rgba(255,255,255,0.2), rgba(255,255,255,0.2) 4px, transparent 4px, transparent 8px)",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

ProgressBar.defaultProps = {
  max: 100,
  showValue: false,
  animated: false,
  color: "gradient",
  height: 10,
  striped: false,
};
