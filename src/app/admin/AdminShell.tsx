"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Upload,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { Mascot, ThemeToggle } from "@/components";
import { adminLogoutAction } from "./actions";

const links = [
  { href: "/admin", label: "Resumen", icon: LayoutDashboard, exact: true },
  { href: "/admin/estudiantes", label: "Estudiantes", icon: GraduationCap },
  { href: "/admin/docentes", label: "Docentes", icon: UserRoundCheck },
  { href: "/admin/grupos", label: "Grupos", icon: UsersRound },
  { href: "/admin/importar", label: "Importar Excel", icon: Upload },
];

interface AdminShellProps {
  user: { name: string; email: string };
  children: ReactNode;
}

export function AdminShell({ user, children }: AdminShellProps) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-full p-2">
              <Mascot expression="cheer" size="sm" />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold text-text">
                Panel de Administración
              </h1>
              <p className="text-xs text-text-muted">
                {user.name} · {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/docente"
              className="px-3 py-2 text-sm rounded-xl text-text-muted hover:bg-surface-alt transition flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Panel docente
            </Link>
            <form action={adminLogoutAction}>
              <button
                type="submit"
                className="px-3 py-2 text-sm rounded-xl text-text-muted hover:bg-surface-alt transition flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>

        <nav className="max-w-6xl mx-auto w-full px-4 md:px-8 pb-3 flex flex-wrap gap-2">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href, link.exact);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-text-muted hover:bg-surface-alt hover:text-text"
                }`}
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
