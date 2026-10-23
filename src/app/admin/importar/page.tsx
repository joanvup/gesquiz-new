"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { Button, Mascot } from "@/components";

interface ImportIssue {
  row: number;
  message: string;
}

interface Report {
  totalRows: number;
  studentsCreated: number;
  studentsExisting: number;
  studentsUpdated: number;
  groupsCreated: number;
  membershipsAdded: number;
  errors: ImportIssue[];
}

export default function AdminImportarPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<Report | null>(null);

  function selectFile(selected: File | null) {
    setError("");
    setReport(null);

    if (!selected) {
      setFile(null);
      return;
    }

    if (!selected.name.toLowerCase().endsWith(".xlsx")) {
      setError("El archivo debe tener extensión .xlsx");
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      setError("El archivo excede el límite de 10 MB");
      return;
    }

    setFile(selected);
  }

  function handleDrag(e: React.DragEvent) {
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave" || e.type === "drop") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    selectFile(e.dataTransfer.files?.[0] || null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Seleccione un archivo Excel");
      return;
    }

    setLoading(true);
    setError("");
    setReport(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/importar-estudiantes", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.report) setReport(data.report);

      if (!res.ok) {
        setError(data.error || "Error al importar el archivo");
        return;
      }

      setFile(null);
    } catch {
      setError("Error de red al importar el archivo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-heading font-bold text-text flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-success-text" />
            Importar estudiantes y grupos
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Carga masiva desde un archivo Excel (.xlsx).
          </p>
        </div>

        <a
          href="/api/admin/plantilla-estudiantes"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium text-text hover:bg-surface-alt transition"
        >
          <Download className="w-4 h-4" />
          Descargar plantilla
        </a>
      </div>

      <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm mb-6">
        <div className="flex items-start gap-4 mb-6">
          <Mascot expression="think" size="md" />
          <div className="text-sm text-text-muted space-y-2">
            <p>
              La hoja <strong className="text-text">Estudiantes</strong> debe tener las
              columnas <code>nombre</code>, <code>email</code>, <code>grupos</code> y{" "}
              <code>password</code>.
            </p>
            <p>
              La contraseña es obligatoria (mínimo 8 caracteres) y solo se aplica a
              estudiantes nuevos. Para varios grupos, sepáralos con punto y coma:{" "}
              <code>8A;Matemática</code>.
            </p>
            <p>
              La hoja <strong className="text-text">Grupos</strong> es opcional y permite
              crear grupos vacíos.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-danger-soft border border-danger/25 text-danger-text rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
              dragActive
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border hover:border-primary hover:bg-primary/5"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById("admin-excel-input")?.click()}
          >
            <input
              id="admin-excel-input"
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => selectFile(e.target.files?.[0] || null)}
            />
            <Upload className="w-10 h-10 text-primary-text mx-auto mb-3" />
            {file ? (
              <>
                <p className="font-medium text-text">{file.name}</p>
                <p className="text-sm text-text-muted mt-1">
                  {(file.size / 1024).toFixed(1)} KB · Haz clic para cambiar el archivo
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-text">
                  Arrastra el archivo aquí o haz clic para seleccionarlo
                </p>
                <p className="text-sm text-text-muted mt-1">Solo .xlsx · máximo 10 MB</p>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              isLoading={loading}
              disabled={!file}
              leftIcon={!loading && <Upload className="w-4 h-4" />}
            >
              {loading ? "Importando..." : "Importar archivo"}
            </Button>
          </div>
        </form>
      </div>

      {report && (
        <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            {report.errors.length === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-success-text" />
            ) : (
              <AlertCircle className="w-5 h-5 text-warning-text" />
            )}
            <h3 className="font-heading font-bold text-lg text-text">
              Reporte de importación
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            {[
              { label: "Filas válidas", value: report.totalRows },
              { label: "Estudiantes creados", value: report.studentsCreated },
              { label: "Estudiantes existentes", value: report.studentsExisting },
              { label: "Nombres actualizados", value: report.studentsUpdated },
              { label: "Grupos creados", value: report.groupsCreated },
              { label: "Membresías añadidas", value: report.membershipsAdded },
            ].map((item) => (
              <div key={item.label} className="bg-surface-alt/40 rounded-2xl p-4">
                <p className="text-2xl font-heading font-bold text-text">{item.value}</p>
                <p className="text-xs text-text-muted">{item.label}</p>
              </div>
            ))}
          </div>

          {report.errors.length > 0 && (
            <div>
              <h4 className="font-medium text-text mb-2">
                Filas con errores ({report.errors.length})
              </h4>
              <div className="max-h-72 overflow-y-auto border border-border rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-surface-alt/60 text-text-muted">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium w-24">Fila</th>
                      <th className="text-left px-4 py-2 font-medium">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.errors.map((issue, index) => (
                      <tr key={`${issue.row}-${index}`}>
                        <td className="px-4 py-2 text-text-muted">{issue.row}</td>
                        <td className="px-4 py-2 text-text">{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-border">
            <Link
              href="/admin/estudiantes"
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:brightness-110 transition"
            >
              Ver estudiantes
            </Link>
            <Link
              href="/admin/grupos"
              className="px-4 py-2 rounded-xl border border-border text-text text-sm font-medium hover:bg-surface-alt transition"
            >
              Ver grupos
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
