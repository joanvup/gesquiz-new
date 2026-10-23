"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Mail,
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react";
import { Button, EmptyState, Modal } from "@/components";

interface Group {
  id: string;
  nombre: string;
  memberCount: number;
}

interface Student {
  id: string;
  nombre: string;
  email: string;
  createdAt: string;
  groups: { id: string; name: string }[];
}

interface StudentForm {
  nombre: string;
  email: string;
  password: string;
  groupIds: string[];
}

const emptyForm: StudentForm = {
  nombre: "",
  email: "",
  password: "",
  groupIds: [],
};

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-border bg-surface-alt/40 text-text focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function AdminEstudiantesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [resetStudent, setResetStudent] = useState<Student | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);

  async function fetchData() {
    const [studentsRes, groupsRes] = await Promise.all([
      fetch("/api/admin/estudiantes", { cache: "no-store" }),
      fetch("/api/admin/grupos", { cache: "no-store" }),
    ]);

    const studentsData = await studentsRes.json();
    const groupsData = await groupsRes.json();

    if (!studentsRes.ok) throw new Error(studentsData.error || "Error al cargar estudiantes");
    if (!groupsRes.ok) throw new Error(groupsData.error || "Error al cargar grupos");

    return {
      students: (studentsData.students || []) as Student[],
      groups: (groupsData.groups || []) as Group[],
    };
  }

  async function refreshData() {
    try {
      const data = await fetchData();
      setStudents(data.students);
      setGroups(data.groups);
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
        setStudents(data.students);
        setGroups(data.groups);
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

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;

    return students.filter((student) => {
      return (
        student.nombre.toLowerCase().includes(term) ||
        student.email.toLowerCase().includes(term) ||
        student.groups.some((group) => group.name.toLowerCase().includes(term))
      );
    });
  }, [students, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(student: Student) {
    setEditing(student);
    setForm({
      nombre: student.nombre,
      email: student.email,
      password: "",
      groupIds: student.groups.map((group) => group.id),
    });
    setFormError("");
    setModalOpen(true);
  }

  function toggleGroup(groupId: string) {
    setForm((current) => ({
      ...current,
      groupIds: current.groupIds.includes(groupId)
        ? current.groupIds.filter((id) => id !== groupId)
        : [...current.groupIds, groupId],
    }));
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
        editing ? `/api/admin/estudiantes/${editing.id}` : "/api/admin/estudiantes",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: form.nombre,
            email: form.email,
            groupIds: form.groupIds,
            ...(editing ? {} : { password: form.password }),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "No se pudo guardar el estudiante");
        return;
      }

      setModalOpen(false);
      setNotice(editing ? "Estudiante actualizado" : "Estudiante creado");
      await refreshData();
    } catch {
      setFormError("Error de red al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(student: Student) {
    if (
      !window.confirm(
        `¿Eliminar a ${student.nombre}? También se eliminarán sus intentos y asignaciones.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/estudiantes/${student.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo eliminar el estudiante");
        return;
      }

      setNotice("Estudiante eliminado");
      await refreshData();
    } catch {
      setError("Error de red al eliminar");
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetStudent) return;

    setResetError("");
    if (newPassword.length < 8) {
      setResetError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setResetting(true);
    try {
      const res = await fetch(
        `/api/admin/estudiantes/${resetStudent.id}/password`,
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

      setResetStudent(null);
      setNewPassword("");
      setNotice(`Contraseña actualizada para ${resetStudent.nombre}`);
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
            <UsersRound className="w-6 h-6 text-info-text" />
            Estudiantes
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {students.length} estudiante{students.length === 1 ? "" : "s"} registrado
            {students.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email o grupo"
              className="pl-9 pr-3 py-2 rounded-xl border border-border bg-card text-sm w-72 max-w-full"
            />
          </div>
          <Button type="button" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
            Nuevo estudiante
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
        <div className="text-center py-12 text-text-muted">Cargando estudiantes...</div>
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          title={search ? "No hay resultados" : "No hay estudiantes"}
          description={
            search
              ? "Prueba con otra búsqueda."
              : "Crea un estudiante manualmente o importa un archivo Excel."
          }
          emoji="🎓"
        />
      ) : (
        <div className="bg-card border border-border rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-surface-alt/60 text-text-muted">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">Nombre</th>
                  <th className="text-left px-6 py-3 font-medium">Email</th>
                  <th className="text-left px-6 py-3 font-medium">Grupos</th>
                  <th className="text-right px-6 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-surface-alt/30">
                    <td className="px-6 py-4 font-medium text-text">{student.nombre}</td>
                    <td className="px-6 py-4 text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {student.email}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {student.groups.length === 0 ? (
                        <span className="text-text-muted text-xs">Sin grupos</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {student.groups.map((group) => (
                            <span
                              key={group.id}
                              className="px-2 py-1 rounded-full bg-primary-soft text-primary-text text-xs"
                            >
                              {group.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(student)}
                          title="Editar"
                          className="p-2 rounded-lg text-text-muted hover:bg-info-soft hover:text-info-text transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetStudent(student);
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
                          onClick={() => handleDelete(student)}
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
        title={editing ? "Editar estudiante" : "Nuevo estudiante"}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 bg-danger-soft border border-danger/25 text-danger-text rounded-xl text-sm">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text mb-1">Nombre</label>
            <input
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Email</label>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
            />
          </div>

          {!editing && (
            <div>
              <label className="block text-sm font-medium text-text mb-1">
                Contraseña inicial
              </label>
              <input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClass}
              />
              <p className="text-xs text-text-muted mt-1">
                Mínimo 8 caracteres. El estudiante podrá usarla para iniciar sesión.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text mb-2">Grupos</label>
            {groups.length === 0 ? (
              <p className="text-sm text-text-muted">
                No hay grupos creados. Puedes crear uno desde la sección Grupos.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {groups.map((group) => (
                  <label
                    key={group.id}
                    className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition ${
                      form.groupIds.includes(group.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-surface-alt/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.groupIds.includes(group.id)}
                      onChange={() => toggleGroup(group.id)}
                      className="rounded border-border text-primary-text focus:ring-primary"
                    />
                    <span className="text-sm text-text">{group.nombre}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={saving}>
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear estudiante"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(resetStudent)}
        onClose={() => setResetStudent(null)}
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
            <span className="font-medium text-text">{resetStudent?.nombre}</span>.
          </p>

          <input
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
              onClick={() => setResetStudent(null)}
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
