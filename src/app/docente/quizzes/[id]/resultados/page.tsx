'use client';

import { Suspense } from 'react';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Mascot, Button, StatusBadge, EmptyState, ThemeToggle } from '@/components';
import { ChevronRight, Download, Trophy, AlertCircle, Eye, Loader2 } from 'lucide-react';
import { toGradeScale } from '@/lib/grades';

interface AttemptItem {
  id: string;
  numeroAttempt: number;
  status: string;
  score: number | null;
  infractions: number;
  startedAt: string;
  submittedAt: string | null;
  student: {
    id: string;
    name: string;
    email: string;
  };
}

interface QuizData {
  id: string;
  titulo: string;
  puntajeMaximo: number;
  attempts: AttemptItem[];
}

function QuizResultadosContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  async function handleExport() {
    setExporting(true);
    setExportError('');

    try {
      const res = await fetch(
        `/api/docente/quizzes/${id}/resultados?format=xlsx`
      );

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || 'No se pudieron exportar los resultados');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || `resultados-quiz-${id}.xlsx`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setExportError(
        err instanceof Error
          ? err.message
          : 'No se pudieron exportar los resultados'
      );
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    fetch('/api/docente/quizzes/' + id + '/resultados')
      .then((res) => res.json())
      .then((data) => {
        if (data.quiz) {
          setQuiz(data.quiz);
        } else if (data.error) {
          setError(data.error);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Error al cargar resultados');
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 p-8 max-w-6xl mx-auto w-full">
        <div className="text-center text-text-muted">
          <Mascot expression="think" size="lg" />
          <p className="mt-4">Cargando resultados...</p>
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <div className="p-4 bg-danger-soft text-danger-text rounded-xl mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error || 'No encontrado'}
        </div>
        <Link href='/docente' className='text-primary-text underline text-sm flex items-center w-max gap-1'>
          ← Volver al panel
        </Link>
      </div>
    );
  }

  return (
    <div className='flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full'>
      {/* Header */}
      <div className='mb-6 flex items-center justify-between'>
        <div className='flex items-center gap-2 text-sm text-text-muted'>
          <Link href='/docente' className='hover:text-primary-text transition'>Panel</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-text">Resultados</span>
        </div>
        <div className='flex items-center gap-2'>
          <ThemeToggle />
          <Button
            variant="success"
            size="md"
            leftIcon={
              exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )
            }
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? 'Exportando...' : 'Exportar a Excel'}
          </Button>
        </div>
      </div>

      {exportError && (
        <div className='mb-4 p-3 bg-danger-soft text-danger-text rounded-xl text-sm flex items-center gap-2'>
          <AlertCircle className='w-4 h-4 flex-shrink-0' /> {exportError}
        </div>
      )}

      <div className='bg-card rounded-3xl shadow-lg border border-border p-6 md:p-8 mb-8'>
        <h1 className='text-2xl font-heading font-bold text-text mb-2'>{quiz.titulo}</h1>
        <p className='text-text-muted text-sm flex flex-wrap items-center gap-2'>
          <Trophy className="w-4 h-4 text-warning-text" />
          <span>Puntaje base: {quiz.puntajeMaximo}</span>
          <span>·</span>
          <span>Escala de nota: 10–100</span>
          <span>·</span>
          <span>Total Intentos: {quiz.attempts.length}</span>
        </p>
      </div>

      {/* Attempts table */}
      <div className='bg-card rounded-3xl shadow-lg border border-border overflow-hidden'>
        <div className='p-6 border-b border-border'>
          <h3 className='font-heading font-bold text-text text-lg'>
            Intentos de Estudiantes
          </h3>
        </div>

        {quiz.attempts.length === 0 ? (
          <EmptyState
            title="No hay intentos registrados"
            description="Los intentos de los estudiantes aparecerán aquí."
            emoji="📊"
            variant="search"
          />
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-left border-collapse text-sm'>
              <thead>
                <tr className='bg-surface-alt border-b border-border text-text-muted font-semibold'>
                  <th className='p-4'>Estudiante</th>
                  <th className='p-4'>Email</th>
                  <th className='p-4'>Intento</th>
                  <th className='p-4'>Estado</th>
                  <th className='p-4'>Nota (10–100)</th>
                  <th className='p-4'>Infracciones</th>
                  <th className='p-4'>Fecha Envío</th>
                  <th className='p-4 text-right'>Acciones</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {quiz.attempts.map((att) => {
                  const grade = toGradeScale(att.score, quiz.puntajeMaximo);
                  return (
                    <tr key={att.id} className='hover:bg-surface-alt/50 transition'>
                      <td className='p-4 font-semibold text-text'>{att.student.name}</td>
                      <td className='p-4 text-text-muted'>{att.student.email}</td>
                      <td className='p-4 text-text-muted'>#{att.numeroAttempt}</td>
                      <td className='p-4'>
                        <StatusBadge status={att.status} />
                      </td>
                      <td className='p-4 font-bold text-text'>
                        {grade !== null ? `${grade} / 100` : '-'}
                        {att.score !== null && (
                          <span className='block text-xs font-normal text-text-muted'>
                            Puntaje: {att.score} / {quiz.puntajeMaximo}
                          </span>
                        )}
                      </td>
                      <td className='p-4 text-text-muted'>{att.infractions}</td>
                      <td className='p-4 text-text-muted text-xs'>
                        {att.submittedAt
                          ? new Date(att.submittedAt).toLocaleString()
                          : 'En curso'}
                      </td>
                      <td className='p-4 text-right'>
                        <Link
                          href={'/docente/intentos/' + att.id}
                          className='px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary-text font-medium rounded-xl text-xs transition inline-flex items-center gap-1'
                        >
                          <Eye className="w-3 h-3" /> Ver Detalle
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuizResultadosPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={
      <div className='p-8 text-center'>
        <Mascot expression="think" size="lg" />
      </div>
    }>
      <QuizResultadosContent params={params} />
    </Suspense>
  );
}
