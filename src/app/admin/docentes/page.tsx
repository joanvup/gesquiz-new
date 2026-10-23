"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserRoundCheck,
} from "lucide-react";
import { Button, EmptyState, Modal } from "@/components";

interface Teacher {
  id: string;
  nombre: string;
  email: string;
  createdAt: string;
  quizzesCount: number;
}

interface TeacherForm {
  nombre: string;
  email: string;
  password: string;
}

const emptyForm: TeacherForm = {
  nombre: "",
  email: "",
  password: "",
};

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-border bg-surface-alt/40 text-text focus:outline-none focus:ring-2 focus:ring-primary/40";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminDocentesPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState<TeacherForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [resetTeacher, setResetTeacher] = useState<Teacher | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);

  async function fetchData() {
    const res = await fetch("/api/admin/docentes", { cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Error al cargar los docentes");
    }

    return (data.teachers || []) as Teacher[];
  }

  async function refreshData() {
    try {
      setTeachers(await fetchData());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetchData()
      .then((data) => {
        if (cancelled) return;
        setTeachers(data);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar los datos");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTeachers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return teachers;

    return teachers.filter((teacher) => {
      return (
        teacher.nombre.toLowerCase().includes(term) ||
        teacher.email.toLowerCase().includes(term)
      );
    });
  }, [teachers, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  function openEdit(teacher: Teacher) {
    setEditing(teacher);
    setForm({
      nombre: teacher.nombre,
      email: teacher.email,
      password: "",
    });
    setFormError("");
    setError("");
    setNotice("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!editing && form.password.length < 8) {
      setFormError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/admin/docentes/${editing.id}` : "/api/admin/docentes",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: form.nombre,
            email: form.email,
            ...(editing ? {} : { password: form.password }),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "No se pudo guardar el docente");
        return;
      }

      setModalOpen(false);
      setNotice(editing ? "Docente actualizado" : "Docente creado");
      await refreshData();
    } catch {
      setFormError("Error de red al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(teacher: Teacher) {
    const quizzesWarning =
      teacher.quizzesCount > 0
        ? ` También se eliminarán ${teacher.quizzesCount} ${
            teacher.quizzesCount === 1 ? "quiz" : "quizzes"
          } y todos sus intentos asociados.`
        : "";

    if (!window.confirm(`¿Eliminar a ${teacher.nombre}?${quizzesWarning}`)) {
      return;
    }

    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/admin/docentes/${teacher.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo eliminar el docente");
        return;
      }

      setNotice("Docente eliminado");
      await refreshData();
    } catch {
      setError("Error de red al eliminar");
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTeacher) return;

    setResetError("");
    if (newPassword.length < 8) {
      setResetError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setResetting(true);
    try {
      const res = await fetch(
        `/api/admin/docentes/${resetTeacher.id}/password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: newPassword }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setResetError(data.error || "No se pudo restablecer la contraseña");
        return;
      }

      setResetTeacher(null);
      setNewPassword("");
      setNotice(`Contraseña actualizada para ${resetTeacher.nombre}`);
    } catch {
      setResetError("Error de red al restablecer la contraseña");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-heading font-bold text-text flex items-center gap-2">
            <UserRoundCheck className="w-6 h-6 text-success-text" />
            Docentes
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {teachers.length} docente{teachers.length === 1 ? "" : "s"} registrado
            {teachers.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email"
              className="pl-9 pr-3 py-2 rounded-xl border border-border bg-card text-sm w-64 max-w-full"
            />
          </div>
          <Link
            href="/admin/importar"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium text-text hover:bg-surface-alt transition"
          >
            <Upload className="w-4 h-4" />
            Importar Excel
          </Link>
          <Button type="button" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
            Nuevo docente
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-danger-soft border border-danger/25 text-danger-text rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 p-4 bg-success-soft border border-success/25 text-success-text rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" /> {notice}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-text-muted">Cargando docentes...</div>
      ) : filteredTeachers.length === 0 ? (
        <EmptyState
          title={search ? "No hay resultados" : "No hay docentes"}
          description={
            search
              ? "Prueba con otra búsqueda."
              : "Crea un docente manualmente o importa un archivo Excel."
          }
          emoji="🧑‍🏫"
        />
      ) : (
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-surface-alt/60 text-text-muted">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">Nombre</th>
                  <th className="text-left px-6 py-3 font-medium">Email</th>
                  <th className="text-left px-6 py-3 font-medium">Quizzes</th>
                  <th className="text-left px-6 py-3 font-medium">Creado</th>
                  <th className="text-right px-6 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-surface-alt/30">
                    <td className="px-6 py-4 font-medium text-text">{teacher.nombre}</td>
                    <td className="px-6 py-4 text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {teacher.email}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" /> {teacher.quizzesCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-muted">
                      {formatDate(teacher.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(teacher)}
                          title="Editar"
                          className="p-2 rounded-lg text-text-muted hover:bg-info-soft hover:text-info-text transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetTeacher(teacher);
                            setNewPassword("");
                            setResetError("");
                          }}
                          title="Restablecer contraseña"
                          className="p-2 rounded-lg text-text-muted hover:bg-warning-soft hover:text-warning-text transition"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(teacher)}
                          title="Eliminar"
                          className="p-2 rounded-lg text-text-muted hover:bg-danger-soft hover:text-danger-text transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar docente" : "Nuevo docente"}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 bg-danger-soft border border-danger/25 text-danger-text rounded-xl text-sm">
              {formError}
            </div>
          )}

          <div>
            <label
              htmlFor="teacher-nombre"
              className="block text-sm font-medium text-text mb-1"
            >
              Nombre
            </label>
            <input
              id="teacher-nombre"
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="teacher-email"
              className="block text-sm font-medium text-text mb-1"
            >
              Email
            </label>
            <input
              id="teacher-email"
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
            />
          </div>

          {!editing && (
            <div>
              <label
                htmlFor="teacher-password"
                className="block text-sm font-medium text-text mb-1"
              >
                Contraseña inicial
              </label>
              <input
                id="teacher-password"
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClass}
              />
              <p className="text-xs text-text-muted mt-1">
                Mínimo 8 caracteres. El docente podrá usarla para iniciar sesión.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={saving}>
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear docente"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(resetTeacher)}
        onClose={() => setResetTeacher(null)}
        title="Restablecer contraseña"
        size="sm"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          {resetError && (
            <div className="p-3 bg-danger-soft border border-danger/25 text-danger-text rounded-xl text-sm">
              {resetError}
            </div>
          )}

          <p className="text-sm text-text-muted">
            Nueva contraseña para{" "}
            <span className="font-medium text-text">{resetTeacher?.nombre}</span>.
          </p>

          <label htmlFor="teacher-new-password" className="sr-only">
            Nueva contraseña
          </label>
          <input
            id="teacher-new-password"
            required
            type="password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className={inputClass}
          />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setResetTeacher(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={resetting}>
              {resetting ? "Actualizando..." : "Actualizar contraseña"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
