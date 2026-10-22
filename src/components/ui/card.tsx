"use client";

import { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

const cardVariants = cva(
  "rounded-3xl bg-card border border-border shadow-sm transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-border",
        elevated: "border-border shadow-xl",
        interactive:
          "border-border hover:shadow-lg hover:-translate-y-1 cursor-pointer",
        color: "border-transparent",
      },
      padding: {
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  children: ReactNode;
}

export function Card({ className, variant, padding, children, ...props }: CardProps) {
  return (
    <div className={cardVariants({ variant, padding, className })} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: CardProps) {
  return (
    <div
      className={`flex items-center justify-between border-b border-border pb-4 ${className || ""}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardContent({ className, children, ...props }: CardProps) {
  return (
    <div className={className || ""} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: CardProps) {
  return (
    <div
      className={`border-t border-border pt-4 flex items-center justify-end gap-2 ${className || ""}`}
      {...props}
    >
      {children}
    </div>
  );
}
