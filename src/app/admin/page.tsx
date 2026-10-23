"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  Upload,
  UsersRound,
  UserRoundCheck,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { Mascot } from "@/components";

interface Resumen {
  students: number;
  groups: number;
  teachers: number;
  quizzes: number;
  attempts: number;
}

const cards = [
  { key: "students", label: "Estudiantes", icon: GraduationCap, color: "bg-info-soft text-info-text" },
  { key: "groups", label: "Grupos", icon: UsersRound, color: "bg-primary-soft text-primary-text" },
  { key: "teachers", label: "Docentes", icon: UserRoundCheck, color: "bg-success-soft text-success-text" },
  { key: "quizzes", label: "Quizzes", icon: BookOpen, color: "bg-warning-soft text-warning-text" },
  { key: "attempts", label: "Intentos", icon: ClipboardList, color: "bg-danger-soft text-danger-text" },
] as const;

export default function AdminHomePage() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/resumen", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setResumen(data);
        }
      })
      .catch(() => setError("Error al cargar el resumen"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="bg-card border border-border rounded-3xl shadow-lg p-6 md:p-8 mb-8 flex flex-col md:flex-row md:items-center gap-6">
        <Mascot expression="happy" size="lg" />
        <div className="flex-1">
          <h2 className="text-2xl font-heading font-bold text-text">
            Bienvenido al panel de administración
          </h2>
          <p className="text-text-muted mt-2">
            Desde aquí puedes importar estudiantes y grupos desde Excel, gestionarlos
            manualmente y restablecer contraseñas.
          </p>
        </div>
        <Link
          href="/admin/importar"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-heading font-bold hover:brightness-110 transition"
        >
          <Upload className="w-5 h-5" />
          Importar Excel
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger-soft border border-danger/25 text-danger-text rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-text-muted">Cargando resumen...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {cards.map((card) => {
            const Icon = card.icon;
            const value = resumen ? resumen[card.key] : 0;

            return (
              <div
                key={card.key}
                className="bg-card border border-border rounded-3xl p-6 shadow-sm"
              >
                <div className={`inline-flex p-3 rounded-2xl ${card.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <p className="text-3xl font-heading font-bold text-text mt-4">{value}</p>
                <p className="text-sm text-text-muted">{card.label}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/admin/estudiantes"
          className="bg-card border border-border rounded-3xl p-6 hover:shadow-lg hover:-translate-y-1 transition"
        >
          <GraduationCap className="w-6 h-6 text-info-text" />
          <h3 className="font-heading font-bold text-text mt-3">Gestionar estudiantes</h3>
          <p className="text-sm text-text-muted mt-1">
            Crear, editar, eliminar y asignar grupos.
          </p>
          <span className="inline-flex items-center gap-1 text-primary-text text-sm font-medium mt-4">
            Abrir <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        <Link
          href="/admin/grupos"
          className="bg-card border border-border rounded-3xl p-6 hover:shadow-lg hover:-translate-y-1 transition"
        >
          <UsersRound className="w-6 h-6 text-primary-text" />
          <h3 className="font-heading font-bold text-text mt-3">Gestionar grupos</h3>
          <p className="text-sm text-text-muted mt-1">
            Crear, renombrar y eliminar grupos.
          </p>
          <span className="inline-flex items-center gap-1 text-primary-text text-sm font-medium mt-4">
            Abrir <ArrowRight className="w-4 h-4" />
          </span>
        </Link>

        <Link
          href="/admin/importar"
          className="bg-card border border-border rounded-3xl p-6 hover:shadow-lg hover:-translate-y-1 transition"
        >
          <Upload className="w-6 h-6 text-success-text" />
          <h3 className="font-heading font-bold text-text mt-3">Importar desde Excel</h3>
          <p className="text-sm text-text-muted mt-1">
            Carga masiva de estudiantes y grupos con reporte de errores.
          </p>
          <span className="inline-flex items-center gap-1 text-primary-text text-sm font-medium mt-4">
            Abrir <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}
