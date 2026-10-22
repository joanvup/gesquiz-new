"use client";

import { useEffect, useRef, useState } from "react";

interface ConfettiProps {
  active?: boolean;
  particleCount?: number;
  className?: string;
}

const colors = [
  "#7B4FE0",
  "#38B2AC",
  "#F59E0B",
  "#EC4899",
  "#10B981",
  "#F97316",
  "#8B5CF6",
  "#06B6D4",
];

interface Piece {
  id: number;
  left: number;
  delay: number;
  size: number;
  color: string;
  duration: number;
}

export function Confetti({
  active = true,
  particleCount = 80,
  className = "",
}: ConfettiProps) {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!active) {
      setPieces([]);
      return;
    }

    // Generar piezas una sola vez cuando se activa
    const newPieces: Piece[] = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      size: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 2.2 + Math.random() * 1,
    }));

    setPieces(newPieces);

    // Limpiar tras la animación
    timeoutRef.current = setTimeout(() => setPieces([]), 3500);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [active, particleCount]);

  if (!active || pieces.length === 0) return null;

  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden z-50 ${className}`}
      aria-hidden="true"
    >
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.6}px`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            animationName: "confetti-fall",
            animationTimingFunction: "ease-out",
            animationFillStyle: "forwards",
          }}
        />
      ))}
    </div>
  );
}
