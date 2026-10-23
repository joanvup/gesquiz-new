"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Button, EmptyState, Modal } from "@/components";

interface GroupMember {
  id: string;
  name: string;
  email: string;
}

interface Group {
  id: string;
  nombre: string;
  createdAt: string;
  memberCount: number;
  members: GroupMember[];
}

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-border bg-surface-alt/40 text-text focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function AdminGruposPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [nombre, setNombre] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchGroups() {
    const res = await fetch("/api/admin/grupos", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al cargar grupos");
    return (data.groups || []) as Group[];
  }

  async function refreshGroups() {
    try {
      setGroups(await fetchGroups());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar los grupos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetchGroups()
      .then((data) => {
        if (cancelled) return;
        setGroups(data);
        setError("");
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error al cargar los grupos");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function openCreate() {
    setEditing(null);
    setNombre("");
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(group: Group) {
    setEditing(group);
    setNombre(group.nombre);
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      const res = await fetch(
        editing ? `/api/admin/grupos/${editing.id}` : "/api/admin/grupos",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "No se pudo guardar el grupo");
        return;
      }

      setModalOpen(false);
      setNotice(editing ? "Grupo actualizado" : "Grupo creado");
      await refreshGroups();
    } catch {
      setFormError("Error de red al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(group: Group) {
    if (
      !window.confirm(
        `¿Eliminar el grupo "${group.nombre}"? Se eliminarán sus membresías y asignaciones de quizzes.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/grupos/${group.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "No se pudo eliminar el grupo");
        return;
      }

      setNotice("Grupo eliminado");
      await refreshGroups();
    } catch {
      setError("Error de red al eliminar");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-heading font-bold text-text flex items-center gap-2">
            <UsersRound className="w-6 h-6 text-primary-text" />
            Grupos
          </h2>
          <p className="text-sm text-text-muted mt-1">
            {groups.length} grupo{groups.length === 1 ? "" : "s"} registrado
            {groups.length === 1 ? "" : "s"}
          </p>
        </div>

        <Button type="button" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>
          Nuevo grupo
        </Button>
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
        <div className="text-center py-12 text-text-muted">Cargando grupos...</div>
      ) : groups.length === 0 ? (
        <EmptyState
          title="No hay grupos"
          description="Crea un grupo manualmente o importa un archivo Excel."
          emoji="👥"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <div
              key={group.id}
              className="bg-card border border-border rounded-3xl p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading font-bold text-lg text-text">
                    {group.nombre}
                  </h3>
                  <p className="text-sm text-text-muted">
                    {group.memberCount} estudiante{group.memberCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(group)}
                    title="Editar"
                    className="p-2 rounded-lg text-text-muted hover:bg-info-soft hover:text-info-text transition"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(group)}
                    title="Eliminar"
                    className="p-2 rounded-lg text-text-muted hover:bg-danger-soft hover:text-danger-text transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                {group.members.length === 0 ? (
                  <p className="text-sm text-text-muted">Sin estudiantes asignados.</p>
                ) : (
                  <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {group.members.map((member) => (
                      <li
                        key={member.id}
                        className="flex items-center gap-2 text-sm text-text-muted"
                      >
                        <UserRound className="w-4 h-4 shrink-0" />
                        <span className="truncate">{member.name}</span>
                        <span className="text-xs truncate">({member.email})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar grupo" : "Nuevo grupo"}
        size="sm"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 bg-danger-soft border border-danger/25 text-danger-text rounded-xl text-sm">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Nombre del grupo
            </label>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={inputClass}
              placeholder="Ej. 8A"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={saving}>
              {saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear grupo"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
