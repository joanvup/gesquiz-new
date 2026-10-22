"use client";

import { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-surface-alt text-text-muted",
        success: "bg-green-100 text-green-800",
        warning: "bg-amber-100 text-amber-800",
        danger: "bg-red-100 text-red-800",
        info: "bg-blue-100 text-blue-800",
        outline: "border border-border text-text-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  children: ReactNode;
}

export function Badge({ className, variant, children, ...props }: BadgeProps) {
  return (
    <span className={badgeVariants({ variant, className })} {...props}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { text: string; variant: "success" | "warning" | "danger" | "info" }> = {
    CALIFICADO: { text: "Calificado", variant: "success" },
    ENVIADO: { text: "Enviado", variant: "info" },
    EN_CURSO: { text: "En curso", variant: "warning" },
    EXPIRADO: { text: "Expirado", variant: "danger" },
    ANULADO: { text: "Anulado", variant: "danger" },
    FINALIZADO_POR_INFRACCIONES: { text: "Por infracciones", variant: "danger" },
    default: { text: status, variant: "secondary" },
  };

  const { text, variant } = map[status] || map.default;

  return <Badge variant={variant}>{text}</Badge>;
}
