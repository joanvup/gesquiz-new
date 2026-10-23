'use client';

import { Suspense } from 'react';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mascot, Badge, StatusBadge, Button, ThemeToggle } from '@/components';
import { formatStudentAnswer } from '@/lib/answer-format';
import { toGradeScale } from '@/lib/grades';
import {
  RotateCcw,
  Ban,
  ClipboardCheck,
  Clock,
  Trophy,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface Question {
  id: string;
  tipo: string;
  enunciadoHtml: string;
  defaultGrade: number;
  options: Array<{
    id: string;
    textoHtml: string;
    esCorrecta: boolean;
    fraction: number;
    extraJson?: string | null;
  }>;
}

interface AttemptAnswer {
  id: string;
  questionId: string;
  respuestaJson?: string | null;
  respuestaTexto?: string | null;
  puntuacion: number | null;
  esCorrecta: boolean | null;
  calificadaManualmente: boolean;
}

interface AuditEvent {
  id: string;
  tipo: string;
  detalle?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
}

interface AttemptDetail {
  id: string;
  numeroAttempt: number;
  status: string;
  score: number | null;
  infractions: number;
  startedAt: string;
  submittedAt: string | null;
  student: { id: string; name: string; email: string };
  quiz: { id: string; titulo: string; puntajeMaximo: number; questions: Question[] };
  answers: AttemptAnswer[];
  events: AuditEvent[];
}

function AnswerContent({
  question,
  answer,
}: {
  question: Question;
  answer?: AttemptAnswer;
}) {
  const display = formatStudentAnswer(question, answer);

  if (display.kind === 'empty') {
    return <span className='text-text-muted italic'>Sin respuesta</span>;
  }

  if (display.kind === 'text') {
    return (
      <p className='text-text whitespace-pre-wrap break-words'>{display.text}</p>
    );
  }

  if (display.kind === 'raw') {
    return (
      <p className='text-text break-words font-mono text-xs'>{display.text}</p>
    );
  }

  if (display.kind === 'matching') {
    const showCorrect = answer?.esCorrecta === false;
    return (
      <ul className='space-y-3'>
        {display.pairs.map((pair) => (
          <li key={pair.id} className='text-text'>
            <div
              className='font-medium'
              dangerouslySetInnerHTML={{ __html: pair.leftHtml }}
            />
            <div className='mt-1 flex flex-wrap items-center gap-1'>
              <span className='text-text-muted'>→</span>
              <span
                className={
                  pair.isCorrect ? 'text-success-text' : 'text-danger-text'
                }
              >
                {pair.selected || 'Sin seleccionar'}
              </span>
              {showCorrect && !pair.isCorrect && pair.correct && (
                <span className='text-xs text-success-text'>
                  · Correcta: {pair.correct}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  const showCorrect = answer?.esCorrecta === false && display.correct.length > 0;
  return (
    <div className='space-y-2'>
      <ul className='list-disc list-inside space-y-1'>
        {display.selected.map((option) => (
          <li key={option.id} className='text-text'>
            <div dangerouslySetInnerHTML={{ __html: option.textoHtml }} />
          </li>
        ))}
      </ul>
      {showCorrect && (
        <div className='text-xs text-success-text'>
          <span className='font-semibold'>Respuesta correcta:</span>
          <ul className='list-disc list-inside mt-1 space-y-1'>
            {display.correct.map((option) => (
              <li key={option.id}>
                <div dangerouslySetInnerHTML={{ __html: option.textoHtml }} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AttemptDetailContent({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = use(params);
  const router = useRouter();
  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [essayScores, setEssayScores] = useState<Record<string, number>>({});
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!attemptId) return;
    fetch('/api/docente/intentos/' + attemptId)
      .then((res) => res.json())
      .then((data) => {
        if (data.attempt) {
          setAttempt(data.attempt);
          const initialScores: Record<string, number> = {};
          data.attempt.answers.forEach((ans: AttemptAnswer) => {
            if (ans.puntuacion !== null) {
              initialScores[ans.questionId] = ans.puntuacion;
            }
          });
          setEssayScores(initialScores);
        } else if (data.error) {
          setError(data.error);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Error al cargar intento');
        setLoading(false);
      });
  }, [attemptId]);

  async function handleGradeEssay(questionId: string) {
    const score = essayScores[questionId];
    if (score === undefined || isNaN(score)) {
      alert('Ingrese una puntuación válida');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/docente/intentos/' + attemptId + '/calificar-essay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, puntuacion: Number(score) }),
      });
      const data = await res.json();
      if (data.success && data.attempt) {
        const refRes = await fetch('/api/docente/intentos/' + attemptId);
        const refData = await refRes.json();
        if (refData.attempt) setAttempt(refData.attempt);
        alert('Calificación guardada exitosamente');
      } else {
        alert(data.error || 'Error al calificar');
      }
    } catch {
      alert('Error de red');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReopen() {
    const motivo = prompt('Motivo de la reapertura:', 'Reabierto por solicitud del estudiante');
    if (motivo === null) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/docente/intentos/' + attemptId + '/reabrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      });
      const data = await res.json();
      if (data.success) {
        router.refresh();
        window.location.reload();
      } else {
        alert(data.error || 'Error al reabrir');
      }
    } catch {
      alert('Error de red');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAnnul() {
    const motivo = prompt('Motivo de la anulación:', 'Anulado por fraude o regla incumplida');
    if (motivo === null) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/docente/intentos/' + attemptId + '/anular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      });
      const data = await res.json();
      if (data.success) {
        router.refresh();
        window.location.reload();
      } else {
        alert(data.error || 'Error al anular');
      }
    } catch {
      alert('Error de red');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <div className="text-center text-text-muted">
          <Mascot expression="think" size="lg" />
          <p className="mt-4">Cargando detalle del intento...</p>
        </div>
      </div>
    );
  }

  if (error || !attempt) {
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

  const finalGrade = toGradeScale(attempt.score, attempt.quiz.puntajeMaximo);

  return (
    <div className='flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full'>
      {/* Header */}
      <div className='mb-6 flex items-center justify-between'>
        <div className='flex items-center gap-2 text-sm text-text-muted'>
          <Link href={'/docente/quizzes/' + attempt.quiz.id + '/resultados'} className='hover:text-primary-text transition text-sm flex items-center'>
            ← Resultados
          </Link>
        </div>
        <div className='flex items-center gap-3'>
          <ThemeToggle />
          <Button variant="secondary" size="sm" leftIcon={<RotateCcw className="w-4 h-4" />} onClick={handleReopen} disabled={actionLoading}>
            {actionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : "Reabrir Intento"}
          </Button>
          <Button variant="danger" size="sm" leftIcon={<Ban className="w-4 h-4" />} onClick={handleAnnul} disabled={actionLoading}>
            Anular Intento
          </Button>
        </div>
      </div>

      {/* Title */}
      <div className="mb-6 flex items-center gap-3">
        <Mascot expression="think" size="md" />
        <div>
          <h1 className='text-2xl font-heading font-bold text-text'>
            Intento #{attempt.numeroAttempt} — {attempt.student.name}
          </h1>
          <p className='text-text-muted text-sm flex items-center gap-2'>
            <span>Quiz: {attempt.quiz.titulo}</span>
            <span>·</span>
            <span>{attempt.student.email}</span>
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-8'>
        <div className='bg-card rounded-2xl border border-border p-5 text-center'>
          <ClipboardCheck className="w-6 h-6 mx-auto mb-2 text-primary-text" />
          <span className='text-xs text-text-muted font-medium uppercase'>Estado</span>
          <div className='mt-1'>
            <StatusBadge status={attempt.status} />
          </div>
        </div>
        <div className='bg-card rounded-2xl border border-border p-5 text-center'>
          <Trophy className="w-6 h-6 mx-auto mb-2 text-warning-text" />
          <span className='text-xs text-text-muted font-medium uppercase'>Nota</span>
          <p className='font-heading font-bold text-2xl text-text mt-1'>
            {finalGrade !== null ? `${finalGrade} / 100` : '-'}
          </p>
          {attempt.score !== null && (
            <p className='text-xs text-text-muted mt-1'>
              Puntaje base: {attempt.score} / {attempt.quiz.puntajeMaximo}
            </p>
          )}
        </div>
        <div className='bg-card rounded-2xl border border-border p-5 text-center'>
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-danger" />
          <span className='text-xs text-text-muted font-medium uppercase'>Infracciones</span>
          <p className='font-heading font-bold text-2xl text-text mt-1'>{attempt.infractions}</p>
        </div>
        <div className='bg-card rounded-2xl border border-border p-5 text-center'>
          <Clock className="w-6 h-6 mx-auto mb-2 text-primary-text" />
          <span className='text-xs text-text-muted font-medium uppercase'>Envío</span>
          <p className='text-sm font-semibold text-text mt-1'>
            {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'En curso'}
          </p>
        </div>
      </div>

      {/* Questions */}
      <div className='bg-card rounded-3xl shadow-lg border border-border mb-8 p-6'>
        <h3 className='font-heading font-bold text-text text-lg mb-6 flex items-center gap-2'>
          <ClipboardCheck className="w-5 h-5 text-primary-text" />
          Preguntas y Respuestas del Estudiante
        </h3>
        <div className='space-y-8'>
          {attempt.quiz.questions.map((q, idx) => {
            const ans = attempt.answers.find((a) => a.questionId === q.id);
            const isEssay = q.tipo === 'ESSAY';
            const answerStatus = ans?.esCorrecta
              ? 'success'
              : ans?.esCorrecta === false
              ? 'danger'
              : 'pending';

            return (
              <div
                key={q.id}
                className={`p-6 rounded-2xl border ${
                  isEssay
                    ? 'bg-info-soft/60 border-info/30'
                    : 'bg-surface-alt border-border'
                }`}
              >
                <div className='flex justify-between items-start mb-3'>
                  <div className='flex items-center gap-2'>
                    <Badge variant="secondary">
                      Pregunta {idx + 1}
                    </Badge>
                    <Badge variant="info">
                      {q.tipo}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={answerStatus === 'success' ? 'success' : answerStatus === 'danger' ? 'danger' : 'secondary'}>
                      {answerStatus === 'success' ? '✓ Correcta' : answerStatus === 'danger' ? '✗ Incorrecta' : 'Sin calificar'}
                    </Badge>
                    <span className='text-xs px-2.5 py-1 bg-card border border-border rounded-full'>
                      {ans?.puntuacion ?? 0} / {q.defaultGrade}
                    </span>
                  </div>
                </div>

                <div
                  className='text-text mb-4 prose max-w-none text-sm'
                  dangerouslySetInnerHTML={{ __html: q.enunciadoHtml }}
                />

                {/* Respuesta del estudiante */}
                <div className='bg-card border border-border rounded-xl p-4 text-sm mb-4'>
                  <span className='font-semibold text-text-muted block mb-1'>
                    Respuesta del estudiante:
                  </span>
                  <AnswerContent question={q} answer={ans} />
                </div>

                {/* Calificación de ESSAY */}
                {isEssay && (
                  <div className='bg-primary-soft border border-primary/20 rounded-xl p-4 flex items-end gap-4'>
                    <div className='flex-1'>
                      <label className='block text-xs font-semibold text-primary-text mb-1'>
                        Calificación manual (0 a {q.defaultGrade}):
                      </label>
                      <input
                        type='number'
                        step='0.1'
                        min='0'
                        max={q.defaultGrade}
                        value={essayScores[q.id] ?? ''}
                        onChange={(e) =>
                          setEssayScores({ ...essayScores, [q.id]: parseFloat(e.target.value) })
                        }
                        className='w-full px-3 py-2 border-2 border-border rounded-xl text-base bg-card text-text focus:outline-none focus:border-primary transition-colors'
                      />
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                      onClick={() => handleGradeEssay(q.id)}
                      disabled={actionLoading}
                    >
                      Guardar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className='bg-card rounded-3xl shadow-lg border border-border p-6'>
        <h3 className='font-heading font-bold text-text text-lg mb-6 flex items-center gap-2'>
          <Clock className="w-5 h-5 text-primary-text" />
          Línea de Tiempo de Auditoría
        </h3>
        {attempt.events.length === 0 ? (
          <p className='text-text-muted text-sm'>No hay eventos de auditoría registrados.</p>
        ) : (
          <div className='space-y-4'>
            {attempt.events.map((ev) => (
              <div
                key={ev.id}
                className='flex items-start gap-4 p-4 bg-surface-alt rounded-xl border border-border text-sm'
              >
                <div className='w-36 flex-shrink-0 text-xs text-text-muted font-mono'>
                  {new Date(ev.createdAt).toLocaleString()}
                </div>
                <div className='flex-1'>
                  <div className='flex items-center gap-2 mb-1'>
                    <Badge variant="secondary">{ev.tipo}</Badge>
                    {ev.user && <span className='text-xs text-text-muted'>por {ev.user.name}</span>}
                  </div>
                  <p className='text-text-muted text-xs'>{ev.detalle || 'Sin detalle'}</p>
                  {(ev.ip || ev.userAgent) && (
                    <div className='mt-2 text-[11px] text-text-muted font-mono flex flex-wrap gap-2'>
                      {ev.ip && <span>IP: {ev.ip}</span>}
                      {ev.userAgent && <span className='truncate max-w-md'>UA: {ev.userAgent}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AttemptDetailPage({ params }: { params: Promise<{ attemptId: string }> }) {
  return (
    <Suspense fallback={
      <div className='p-8 text-center'>
        <Mascot expression="think" size="lg" />
      </div>
    }>
      <AttemptDetailContent params={params} />
    </Suspense>
  );
}
