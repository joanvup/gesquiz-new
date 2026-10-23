"use client";

import { Suspense } from "react";
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Mascot, Badge, Button, ProgressBar, ThemeToggle } from '@/components';
import { isMultipleAnswerQuestion } from '@/lib/questions';
import { ChevronLeft, ChevronRight, Eye, AlertTriangle } from 'lucide-react';

interface OptionItem {
  id: string;
  textoHtml: string;
  esCorrecta: boolean;
}
interface QuestionItem {
  id: string;
  tipo: string;
  defaultGrade: number;
  enunciadoHtml: string;
  datosJson?: string | null;
  options: OptionItem[];
}
interface QuizData {
  titulo: string;
  descripcion?: string;
  instrucciones?: string;
  questions: QuestionItem[];
}

function PreviewQuizPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/docente/quizzes/' + id)
      .then((res) => res.json())
      .then((data) => {
        if (data.quiz) {
          setQuiz(data.quiz);
        } else {
          setError(data.error || 'Quiz no encontrado');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Error al cargar quiz');
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <div className="text-center text-text-muted">
          <Mascot expression="think" size="lg" />
          <p className="mt-4">Cargando vista previa...</p>
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto w-full text-center">
        <div className="text-danger mb-4 flex items-center justify-center gap-2">
          <AlertTriangle className="w-6 h-6" /> {error || 'Quiz no encontrado'}
        </div>
        <Link href='/docente' className='text-primary-text underline text-sm flex items-center justify-center gap-1'>
          <ChevronLeft className="w-4 h-4" /> Volver al panel
        </Link>
      </div>
    );
  }

  const questions = quiz.questions || [];
  const currentQ = questions[currentIndex];

  return (
    <div className='flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full'>
      {/* Banner de preview */}
      <div className='bg-warning-soft/60 border border-warning/25 text-warning-text px-4 py-3 rounded-2xl mb-6 text-sm flex justify-between items-center'>
        <span className="flex items-center gap-2">
          <Eye className="w-4 h-4" /> Modo vista previa — no se registrarán intentos
        </span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href='/docente' className='px-3 py-1 bg-card border border-warning/30 rounded-lg font-medium text-xs hover:bg-warning-soft transition'>
            Salir
          </Link>
        </div>
      </div>

      {/* Quiz header */}
      <div className='bg-card py-6 px-8 rounded-3xl shadow-lg border border-border mb-6'>
        <h1 className='text-2xl font-heading font-bold text-text mb-2'>{quiz.titulo}</h1>
        {quiz.descripcion && (
          <p className='text-text-muted text-sm mb-4'>{quiz.descripcion}</p>
        )}
        {quiz.instrucciones && (
          <div className='p-4 bg-surface-alt rounded-xl text-sm text-text'>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-warning-text" />
              <strong>Instrucciones:</strong>
            </div>
            <div dangerouslySetInnerHTML={{ __html: quiz.instrucciones }} />
          </div>
        )}
      </div>

      {questions.length === 0 ? (
        <div className="bg-card rounded-3xl shadow-lg border border-border p-12 text-center">
          <Mascot expression="think" size="lg" />
          <p className="text-text-muted mt-4 text-lg">Este quiz no tiene preguntas importadas todavía.</p>
          <Link href={`/docente/quizzes/${id}/importar`} className="mt-4 inline-block">
            <Button variant="primary" leftIcon={<ChevronRight className="w-5 h-5 rotate-180" />}>
              Importar ahora
            </Button>
          </Link>
        </div>
      ) : (
        <div className='bg-card rounded-3xl shadow-lg border border-border p-6 md:p-8 space-y-6'>
          {/* Header de pregunta */}
          <div className='flex justify-between items-center border-b border-border pb-4'>
            <span className='text-sm font-medium text-text-muted flex items-center gap-2'>
              Pregunta {currentIndex + 1} de {questions.length}
              <Badge variant={currentQ.tipo === 'MULTICHOICE' ? 'info' : 'default'}>
                {currentQ.tipo}
              </Badge>
            </span>
            <Badge variant="secondary">
              Puntaje: {currentQ.defaultGrade}
            </Badge>
          </div>

          {/* Progreso */}
          <ProgressBar
            value={currentIndex + 1}
            max={questions.length}
            color="gradient"
            striped
            showValue={false}
            label="Progreso"
            height={8}
          />

          {/* Enunciado */}
          <div
            className='rich-content max-w-none text-text mt-6'
            dangerouslySetInnerHTML={{ __html: currentQ.enunciadoHtml }}
          />

          {/* Opciones */}
          <div className='space-y-3 pt-4'>
            {currentQ.options?.map((opt) => (
              <label
                key={opt.id}
                className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  opt.esCorrecta
                    ? 'border-success/30 bg-success-soft/60'
                    : 'border-border hover:border-primary hover:bg-primary/5'
                }`}
              >
                <input
                  type={isMultipleAnswerQuestion(currentQ) ? 'checkbox' : 'radio'}
                  name='preview-option'
                  className='mt-1 text-primary-text focus:ring-primary'
                />
                <div
                  className='rich-content text-sm text-text flex-1'
                  dangerouslySetInnerHTML={{ __html: opt.textoHtml }}
                ></div>
                {opt.esCorrecta && (
                  <span className='ml-auto text-xs bg-success-soft text-success-text px-2 py-1 rounded-full font-semibold'>
                    ✓ Correcta
                  </span>
                )}
              </label>
            ))}
          </div>

          {/* Navegación */}
          <div className='flex justify-between pt-6 border-t border-border'>
            <Button
              variant="secondary"
              size="md"
              leftIcon={<ChevronLeft className="w-4 h-4" />}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
            >
              Anterior
            </Button>
            <Button
              variant="primary"
              size="md"
              rightIcon={<ChevronRight className="w-4 h-4" />}
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreviewQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-8 text-center"><Mascot expression="think" size="lg" /> <p className="text-text-muted mt-4">Cargando...</p></div>}>
      <PreviewQuizPageContent params={params} />
    </Suspense>
  );
}
