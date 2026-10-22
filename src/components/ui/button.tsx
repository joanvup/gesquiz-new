"use client";

import { ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "success"
  | "danger"
  | "play";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  animate?: boolean;
}

const baseClasses =
  "inline-flex items-center justify-center rounded-xl font-heading font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:brightness-110 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 focus-visible:ring-primary",
  secondary:
    "bg-surface-alt text-text border border-border hover:bg-surface-alt/80 focus-visible:ring-border-strong",
  ghost:
    "bg-transparent text-text-muted hover:bg-surface-alt/50 focus-visible:ring-border-strong",
  success:
    "bg-green-500 text-white hover:bg-green-600 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 focus-visible:ring-green-500",
  danger:
    "bg-red-500 text-white hover:bg-red-600 hover:shadow-lg focus-visible:ring-red-500",
  play:
    "bg-gradient-to-r from-primary to-accent-teal text-white hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-1 active:scale-95 focus-visible:ring-primary font-heading text-xl",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
  xl: "px-8 py-4 text-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  animate = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    animate ? "animate-pop-in" : "",
    className,
  ].join(" ");

  return (
    <button className={classes} disabled={isLoading} {...props}>
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Cargando...
        </span>
      ) : (
        <>
          {leftIcon && <span className="mr-2">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="ml-2">{rightIcon}</span>}
        </>
      )}
    </button>
  );
}
