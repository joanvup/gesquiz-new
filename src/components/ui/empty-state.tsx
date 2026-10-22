"use client";

import { ReactNode } from "react";
import { Mascot } from "../Mascot";

interface EmptyStateProps {
  title: string;
  description?: string;
  emoji?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: "default" | "search" | "success";
  className?: string;
}

export function EmptyState({
  title,
  description,
  emoji,
  action,
  variant = "default",
  className = "",
}: EmptyStateProps) {
  const expressions = {
    default: "think",
    search: "happy",
    success: "cheer",
  } as const;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}
    >
      {emoji ? (
        <div className="text-7xl mb-6">{emoji}</div>
      ) : (
        <Mascot expression={expressions[variant]} size="lg" />
      )}

      <h3 className="text-xl font-heading font-bold text-text mb-2">{title}</h3>
      {description && (
        <p className="text-text-muted text-sm max-w-sm mb-6">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-primary text-white rounded-2xl font-heading font-bold hover:brightness-110 hover:shadow-xl transition-all duration-200"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
