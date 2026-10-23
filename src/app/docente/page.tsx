"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mascot, Badge, Button, EmptyState, ThemeToggle } from '@/components';
import { Plus, Edit3, Upload, Share2, Eye, BarChart3, Trash2, LogOut, FileJson } from 'lucide-react';

interface QuizItem {
  id: string;
  titulo: string;
  descripcion?: string;
  publicado: boolean;
  puntajeMaximo: number;
  _count: {
    questions: number;
    assignments: number;
    attempts: number;
  };
}

export default function DocenteDashboard() {
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/docente/quizzes')
      .then((res) => res.json())
      .then((data) => {
        if (data.quizzes) {
          setQuizzes(data.quizzes);
        } else if (data.error) {
          setError(data.error);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Error al cargar quizzes');
        setLoading(false);
      });
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('¿Está seguro de eliminar este quiz y todas sus preguntas?')) return;
    try {
      const res = await fetch('/api/docente/quizzes/' + id, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setQuizzes(quizzes.filter((q) => q.id !== id));
      } else {
        alert(data.error || 'Error al eliminar');
      }
    } catch {
      alert('Error de red');
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function handleImportQuiz(file: File) {
    setImporting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/docente/quizzes/import-json', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'No se pudo importar el quiz');
        return;
      }

      router.push(`/docente/quizzes/${data.report.quizId}/editar`);
    } catch {
      setError('Error de red al importar el quiz');
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }

  return (
    <div className='flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full'>
      {/* Header */}
      <div className='flex justify-between items-center bg-card p-6 rounded-3xl shadow-lg border border-border mb-8'>
        <div className='flex items-center gap-4'>
          <Mascot expression="cheer" size="md" />
          <div>
            <h1 className='text-2xl font-heading font-bold text-text'>Panel del Docente</h1>
            <p className='text-text-muted'>Gestión de Quizzes, Importación Moodle y Asignaciones</p>
          </div>
        </div>
        <div className='flex gap-3'>
          <ThemeToggle />
          <Link
            href='/docente/quizzes/nuevo'
            className='px-4 py-2 bg-primary text-primary-foreground rounded-2xl font-heading font-bold hover:brightness-110 transition flex items-center gap-2'
          >
            <Plus className='w-4 h-4' />
            Crear Nuevo Quiz
          </Link>
          <Button
            variant="secondary"
            size="md"
            onClick={() => importInputRef.current?.click()}
            isLoading={importing}
            leftIcon={<FileJson className="w-4 h-4" />}
          >
            Importar JSON
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImportQuiz(file);
            }}
          />
          <Button variant="ghost" size="md" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-1" />
            Cerrar Sesión
          </Button>
        </div>
      </div>

      {error && (
        <div className='mb-6 p-4 bg-danger-soft border border-danger/25 text-danger-text rounded-xl flex items-center gap-3'>
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className='text-center py-12 text-text-muted'>
          <div className="inline-block">
            <Mascot expression="think" size="md" />
            <p className="mt-4">Cargando quizzes...</p>
          </div>
        </div>
      ) : quizzes.length === 0 ? (
        <EmptyState
          title="No hay quizzes creados"
          description="Comienza creando tu primer cuestionario."
          emoji="📚"
          action={{
            label: "Crear Primer Quiz",
            onClick: () => router.push('/docente/quizzes/nuevo'),
          }}
          variant="default"
        />
      ) : (
        <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
          {quizzes.map((q) => (
            <div key={q.id} className='bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col'>
              <div className='flex justify-between items-start mb-3'>
                <h3 className='font-heading font-bold text-text text-lg'>{q.titulo}</h3>
                <Badge variant={q.publicado ? "success" : "warning"}>
                  {q.publicado ? 'Publicado' : 'Borrador'}
                </Badge>
              </div>
              <p className='text-text-muted text-sm mb-4 line-clamp-2'>
                {q.descripcion || 'Sin descripción'}
              </p>

              <div className='space-y-2 text-sm text-text-muted mb-4'>
                <div className='flex justify-between'>
                  <span>📚 Preguntas:</span>
                  <span className='font-semibold text-text'>{q._count.questions}</span>
                </div>
                <div className='flex justify-between'>
                  <span>🏆 Puntaje base:</span>
                  <span className='font-semibold text-text'>{q.puntajeMaximo}</span>
                </div>
                <div className='flex justify-between'>
                  <span>👥 Asignaciones:</span>
                  <span className='font-semibold text-text'>{q._count.assignments}</span>
                </div>
                <div className='flex justify-between'>
                  <span>📊 Intentos:</span>
                  <span className='font-semibold text-text'>{q._count.attempts}</span>
                </div>
              </div>

              <div className='border-t border-border pt-4 grid grid-cols-2 gap-2 text-xs font-medium'>
                <Link
                  href={'/docente/quizzes/' + q.id + '/editar'}
                  className='px-3 py-2 bg-surface-alt hover:bg-primary-soft text-text rounded-xl flex items-center gap-1 transition'
                >
                  <Edit3 className='w-3 h-3' /> Configurar
                </Link>
                <Link
                  href={'/docente/quizzes/' + q.id + '/importar'}
                  className='px-3 py-2 bg-primary-soft hover:bg-primary-soft/80 text-primary-text rounded-xl flex items-center gap-1 transition'
                >
                  <Upload className='w-3 h-3' /> Importar XML
                </Link>
                <Link
                  href={'/docente/quizzes/' + q.id + '/asignar'}
                  className='px-3 py-2 bg-primary-soft hover:bg-primary-soft/80 text-primary-text rounded-xl flex items-center gap-1 transition'
                >
                  <Share2 className='w-3 h-3' /> Asignar
                </Link>
                <Link
                  href={'/docente/quizzes/' + q.id + '/preview'}
                  className='px-3 py-2 bg-success-soft hover:bg-success-soft/80 text-success-text rounded-xl flex items-center justify-center gap-1 transition'
                >
                  <Eye className='w-3 h-3' /> Preview
                </Link>
                <Link
                  href={'/docente/quizzes/' + q.id + '/resultados'}
                  className='col-span-2 px-3 py-2 bg-info-soft hover:bg-info-soft/80 text-info-text rounded-xl flex items-center justify-center gap-1 transition'
                >
                  <BarChart3 className='w-3 h-3' /> Resultados de Estudiantes
                </Link>
                <button
                  onClick={() => handleDelete(q.id)}
                  className='px-3 py-2 bg-danger-soft hover:bg-danger-soft/80 text-danger-text rounded-xl flex items-center justify-center gap-1 transition'
                >
                  <Trash2 className='w-3 h-3' /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
