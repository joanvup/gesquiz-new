"use client";

import { useState, useEffect, use, Suspense } from 'react';
import Link from 'next/link';
import { Mascot, Button, Badge } from '@/components';
import { ChevronLeft, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  memberCount?: number;
}

interface Student {
  id: string;
  name: string;
  email: string;
}

function AsignarQuizPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/docente/grupos').then((res) => res.json()),
      fetch('/api/docente/quizzes/' + id + '/asignar').then((res) => res.json()),
    ])
      .then(([groupData, assignData]) => {
        if (groupData.groups) setGroups(groupData.groups);
        if (groupData.students) setStudents(groupData.students);

        if (assignData.assignments) {
          const gIds: string[] = [];
          const sIds: string[] = [];
          assignData.assignments.forEach((a: { groupId?: string; studentId?: string }) => {
            if (a.groupId) gIds.push(a.groupId);
            if (a.studentId) sIds.push(a.studentId);
          });
          setSelectedGroupIds(gIds);
          setSelectedStudentIds(sIds);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Error al cargar datos de asignación');
        setLoading(false);
      });
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/docente/quizzes/' + id + '/asignar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupIds: selectedGroupIds,
          studentIds: selectedStudentIds,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('Asignaciones guardadas correctamente');
      } else {
        setError(data.error || 'Error al guardar asignaciones');
      }
    } catch {
      setError('Error de red');
    } finally {
      setSaving(false);
    }
  }

  function toggleGroup(groupId: string) {
    if (selectedGroupIds.includes(groupId)) {
      setSelectedGroupIds(selectedGroupIds.filter((gid) => gid !== groupId));
    } else {
      setSelectedGroupIds([...selectedGroupIds, groupId]);
    }
  }

  function toggleStudent(studentId: string) {
    if (selectedStudentIds.includes(studentId)) {
      setSelectedStudentIds(selectedStudentIds.filter((sid) => sid !== studentId));
    } else {
      setSelectedStudentIds([...selectedStudentIds, studentId]);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <div className="text-center text-text-muted">
          <Mascot expression="think" size="lg" />
          <p className="mt-4">Cargando asignaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full'>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold text-text flex items-center gap-2">
          <Mascot expression="think" size="sm" />
          Asignar Quiz
        </h1>
        <Link
          href='/docente'
          className='flex items-center gap-1 text-sm text-primary hover:underline'
        >
          <ChevronLeft className="w-4 h-4" /> Volver al panel
        </Link>
      </div>

      {error && (
        <div className='mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3'>
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {message && (
        <div className='mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center gap-3'>
          <CheckCircle2 className="w-5 h-5" /> {message}
        </div>
      )}

      <form onSubmit={handleSave} className='bg-card rounded-3xl shadow-lg border border-border p-6 md:p-8 space-y-8'>
        {/* Grupos */}
        <div>
          <h3 className='text-lg font-heading font-bold text-text mb-4 flex items-center gap-2'>
            <span>👥</span>
            Grupos Habilitados
            <Badge variant="info">
              {selectedGroupIds.length} seleccionados
            </Badge>
          </h3>

          {groups.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <p>No hay grupos creados en el sistema.</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              {groups.map((g) => {
                const isSelected = selectedGroupIds.includes(g.id);
                return (
                  <label
                    key={g.id}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/30 hover:bg-primary/5'
                    }`}
                  >
                    <input
                      type='checkbox'
                      checked={isSelected}
                      onChange={() => toggleGroup(g.id)}
                      className='rounded border-border text-primary focus:ring-primary w-5 h-5'
                    />
                    <div>
                      <div className='text-sm font-medium text-text'>{g.name}</div>
                      {g.memberCount && (
                        <div className='text-xs text-text-muted'>
                          {g.memberCount} estudiantes
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Estudiantes específicos */}
        <div>
          <h3 className='text-lg font-heading font-bold text-text mb-4 flex items-center gap-2'>
            <span>🎓</span>
            Estudiantes Específicos (Opcional)
            <Badge variant="info">
              {selectedStudentIds.length} seleccionados
            </Badge>
          </h3>

          {students.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <p>No hay estudiantes en el sistema.</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              {students.map((s) => {
                const isSelected = selectedStudentIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/30 hover:bg-primary/5'
                    }`}
                  >
                    <input
                      type='checkbox'
                      checked={isSelected}
                      onChange={() => toggleStudent(s.id)}
                      className='rounded border-border text-primary focus:ring-primary w-5 h-5'
                    />
                    <div className="flex-1 min-w-0">
                      <div className='text-sm font-medium text-text truncate'>{s.name}</div>
                      <div className='text-xs text-text-muted truncate'>{s.email}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className='flex justify-end gap-4 pt-6 border-t border-border'>
          <Link
            href='/docente'
            className='px-4 py-2 text-text-muted hover:text-text transition'
          >
            Cancelar
          </Link>
          <Button
            variant="primary"
            isLoading={saving}
            leftIcon={!saving && <Save className="w-5 h-5" />}
          >
            {saving ? 'Guardando...' : 'Guardar Asignaciones'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function AsignarQuizPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <div className="text-center text-text-muted">
          <Mascot expression="think" size="lg" />
        </div>
      </div>
    }>
      <AsignarQuizPageContent params={params} />
    </Suspense>
  );
}
