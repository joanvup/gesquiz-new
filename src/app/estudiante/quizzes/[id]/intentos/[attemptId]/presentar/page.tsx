/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Mascot, Button, Badge, ProgressBar, Modal } from "@/components";
import { Confetti } from "@/components/Confetti";
import {
  ArrowLeft,
  ArrowRight,
  Send,
  CheckCircle,
  XCircle,
  Timer,
  Trophy,
  HelpCircle,
  ChevronUp,
  AlertCircle,
} from "lucide-react";

interface Option {
  id: string;
  textoHtml: string;
  orden: number;
  extraJson?: string | null;
  esCorrecta?: boolean;
}

interface Question {
  id: string;
  tipo: string;
  enunciadoHtml: string;
  defaultGrade: number;
  options: Option[];
}

interface AnswerData {
  respuestaJson?: string | null;
  respuestaTexto?: string | null;
}

interface AttemptData {
  id: string;
  status: string;
  expiresAt?: string | null;
  currentQuestionIndex: number;
  score?: number | null;
  quiz: {
    id: string;
    titulo: string;
    permitirRetroceso: boolean;
    puntajeMaximo: number;
    mostrarResultado: string;
    tiempoLimiteMinutos?: number | null;
    questions: { id: string; tipo: string }[];
  };
  answers: {
    questionId: string;
    respuestaJson?: string | null;
    respuestaTexto?: string | null;
  }[];
}

const XP_PER_CORRECT = 10;
const XP_BONUS_TIME = 5;

function PresentarQuizContent({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { attemptId } = use(params);
  const router = useRouter();

  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);

  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [textValue, setTextValue] = useState("");
  const [matchingPairs, setMatchingPairs] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<"guardado" | "guardando" | "error" | "">("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showNoBackWarning, setShowNoBackWarning] = useState(false);
  const [targetIndexToNavigate, setTargetIndexToNavigate] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [resultsData, setResultsData] = useState<AttemptData | null>(null);
  const [xp, setXp] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const initializeAnswerState = (q: Question, ans: AnswerData | null) => {
    setSelectedOptions([]);
    setTextValue("");
    setMatchingPairs({});

    if (!ans) return;

    if (q.tipo === "MULTICHOICE" || q.tipo === "TRUEFALSE") {
      try {
        const parsed = ans.respuestaJson ? JSON.parse(ans.respuestaJson) : [];
        if (Array.isArray(parsed)) {
          setSelectedOptions(parsed.map(String));
        } else if (parsed) {
          setSelectedOptions([String(parsed)]);
        }
      } catch {
        if (ans.respuestaJson) setSelectedOptions([ans.respuestaJson]);
      }
    } else if (q.tipo === "SHORTANSWER" || q.tipo === "NUMERICAL" || q.tipo === "ESSAY") {
      setTextValue(ans.respuestaTexto || ans.respuestaJson || "");
    } else if (q.tipo === "MATCHING") {
      try {
        const parsed = ans.respuestaJson ? JSON.parse(ans.respuestaJson) : {};
        if (parsed.pairs) {
          setMatchingPairs(parsed.pairs);
        } else if (typeof parsed === "object" && parsed !== null) {
          setMatchingPairs(parsed as Record<string, string>);
        }
      } catch {}
    }
  };

  const loadAttemptAndQuestion = useCallback(
    async (targetIndex: number) => {
      setLoading(true);
      try {
        const resAttempt = await fetch(`/api/estudiante/intentos/${attemptId}`);
        const dataAttempt = await resAttempt.json();
        if (dataAttempt.error) {
          alert(dataAttempt.error);
          router.push("/estudiante");
          return;
        }
        setAttempt(dataAttempt.attempt);

        if (dataAttempt.attempt.status !== "EN_CURSO") {
          setResultsData(dataAttempt.attempt);
          setLoading(false);
          return;
        }

        const resQ = await fetch(
          `/api/estudiante/intentos/${attemptId}/preguntas/${targetIndex}`
        );
        const dataQ = await resQ.json();
        if (dataQ.error) {
          alert(dataQ.error);
          return;
        }

        setQuestion(dataQ.question);
        setTotalQuestions(dataQ.totalQuestions);
        setCurrentIndex(dataQ.index);

        initializeAnswerState(dataQ.question, dataQ.answer);
      } catch {
        alert("Error de red al cargar pregunta");
      } finally {
        setLoading(false);
      }
    },
    [attemptId, router]
  );

  const handleAutoSubmitDueToExpiration = useCallback(async () => {
    try {
      const res = await fetch(`/api/estudiante/intentos/${attemptId}/enviar`, {
        method: "POST",
      });
      const data = await res.json();
      setResultsData(data);
      setShowConfetti(true);
    } catch {
      router.push("/estudiante");
    }
  }, [attemptId, router]);

  useEffect(() => {
    loadAttemptAndQuestion(0);
  }, [loadAttemptAndQuestion]);

  useEffect(() => {
    if (!attempt?.expiresAt) return;
    const expiryTime = new Date(attempt.expiresAt).getTime();

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        handleAutoSubmitDueToExpiration();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [attempt?.expiresAt, handleAutoSubmitDueToExpiration]);

  const triggerSave = useCallback(
    (newRespuestaJson: string | null, newRespuestaTexto: string | null) => {
      if (!question) return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      setSavingStatus("guardando");

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/estudiante/intentos/${attemptId}/respuestas`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                questionId: question.id,
                respuestaJson: newRespuestaJson,
                respuestaTexto: newRespuestaTexto,
              }),
            }
          );
          const data = await res.json();
          if (data.success) {
            setSavingStatus("guardado");
            setTimeout(() => setSavingStatus(""), 2000);
          } else {
            setSavingStatus("error");
          }
        } catch {
          setSavingStatus("error");
        }
      }, 400);
    },
    [attemptId, question]
  );

  function handleOptionChange(optionId: string, isMulti: boolean) {
    let updated: string[];
    if (isMulti) {
      if (selectedOptions.includes(optionId)) {
        updated = selectedOptions.filter((id) => id !== optionId);
      } else {
        updated = [...selectedOptions, optionId];
      }
    } else {
      updated = [optionId];
      // Feedback inmediato
      const opt = question?.options.find(o => o.id === optionId);
      if (opt) {
        setXp(prev => prev + (opt.esCorrecta ? XP_PER_CORRECT : 0));
      }
    }
    setSelectedOptions(updated);
    triggerSave(JSON.stringify(updated), null);
  }

  function handleTextChange(val: string) {
    setTextValue(val);
    triggerSave(null, val);
  }

  function handleMatchingChange(subId: string, rightVal: string) {
    const updated = { ...matchingPairs, [subId]: rightVal };
    setMatchingPairs(updated);
    triggerSave(JSON.stringify({ pairs: updated }), null);
  }

  async function goToQuestion(targetIndex: number) {
    if (!attempt) return;
    if (targetIndex < 0 || targetIndex >= totalQuestions) return;

    if (!attempt.quiz.permitirRetroceso && targetIndex < currentIndex) {
      setShowNoBackWarning(true);
      setTargetIndexToNavigate(targetIndex);
      return;
    }

    if (!attempt.quiz.permitirRetroceso && targetIndex > currentIndex) {
      setShowNoBackWarning(true);
      setTargetIndexToNavigate(targetIndex);
      return;
    }

    await loadAttemptAndQuestion(targetIndex);
  }

  async function confirmNoBackNavigation() {
    setShowNoBackWarning(false);
    if (targetIndexToNavigate !== null) {
      await loadAttemptAndQuestion(targetIndexToNavigate);
      setTargetIndexToNavigate(null);
    }
  }

  async function handleFinalSubmit() {
    if (!confirm("¿Estás seguro de enviar tu intento? No podrás realizar más cambios.")) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/estudiante/intentos/${attemptId}/enviar`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setResultsData(data);
        setShowConfetti(true);
      } else {
        alert(data.error || "Error al enviar intento");
      }
    } catch {
      alert("Error de red al enviar");
    } finally {
      setSubmitting(false);
      setShowConfirmSubmit(false);
    }
  }

  // ========================
  // VIEW: LOADING
  // ========================
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Mascot expression="think" size="lg" />
          <p className="mt-4 text-text-muted text-lg">Preparando tu evaluación...</p>
          <div className="mt-4">
            <div className="w-48 h-3 bg-surface-alt rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-accent-teal rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // VIEW: RESULTS
  // ========================
  if (resultsData || (attempt && attempt.status !== "EN_CURSO")) {
    const data = resultsData || attempt;
    const showScore =
      data?.quiz?.mostrarResultado === "NOTA" ||
      data?.score !== undefined ||
      data?.quiz?.mostrarResultado === "NOTA_Y_RESPUESTAS";

    const finalScore = data?.score ?? attempt?.score ?? 0;
    const maxScore = attempt?.quiz?.puntajeMaximo ?? data?.quiz?.puntajeMaximo ?? 0;
    const percentage = maxScore > 0 ? Math.round((finalScore / maxScore) * 100) : 0;

    // Mensaje de aliento según desempeño
    let mascotExpression: "happy" | "cheer" | "oops" = "happy";
    let encouragement = "¡Buen trabajo!";
    if (percentage >= 90) {
      mascotExpression = "cheer";
      encouragement = "¡Excelente puntuación! 🎉";
    } else if (percentage >= 70) {
      mascotExpression = "happy";
      encouragement = "¡Muy bien hecho!";
    } else if (percentage >= 50) {
      mascotExpression = "happy";
      encouragement = "¡Puedes mejorar! 💪";
    } else {
      mascotExpression = "oops";
      encouragement = "¡Ánimo! La práctica hace al maestro 📚";
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
        <Confetti active={showConfetti} />

        <div className="max-w-2xl w-full">
          <div className="bg-card rounded-3xl shadow-2xl border border-border p-8 md:p-12 text-center space-y-8">
            {/* Mascota + confeti */}
            <div className="mb-4">
              <Mascot expression={mascotExpression} size="lg" />
            </div>

            <div>
              <h1 className="text-3xl font-heading font-bold text-text mb-3">
                ¡Evaluación Finalizada!
              </h1>
              <p className="text-text-muted text-lg">{encouragement}</p>
            </div>

            {/* XP Badge */}
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-primary/10 rounded-full">
              <span className="text-2xl">⭐</span>
              <span className="font-bold text-xl text-primary">+{xp} XP</span>
            </div>

            {/* Score */}
            {showScore ? (
              <div className="space-y-4 py-6">
                <div className="text-center">
                  <span className="text-sm text-text-muted font-medium block mb-1">
                    Calificación Obtenida
                  </span>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-heading font-extrabold text-primary">
                      {finalScore}
                    </span>
                    <span className="text-2xl text-text-muted">
                      / {maxScore}
                    </span>
                  </div>
                </div>

                {/* Progress ring style */}
                <div className="relative w-40 h-40 mx-auto">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      className="stroke-surface-alt stroke-[8]"
                    />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="url(#gradient)"
                      strokeWidth="8"
                      strokeDasharray={`${percentage * 2.64}, 264`}
                      className="transition-all duration-1000 ease-out"
                    />
                    <defs>
                      <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
                        <stop stopColor="#7B4FE0" />
                        <stop offset="1" stopColor="#38B2AC" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-heading font-bold text-text">
                      {percentage}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-text-muted">
                Las calificaciones se publicarán próximamente.
              </p>
            )}

            <div className="pt-6 border-t border-border">
              <Link href="/estudiante">
                <Button variant="primary" size="lg" className="w-full">
                  Volver al Panel
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========================
  // VIEW: CONFIRM SUBMIT MODAL
  // ========================
  if (showConfirmSubmit) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Modal
          isOpen={true}
          onClose={() => setShowConfirmSubmit(false)}
          title="Confirmar Envío de Evaluación"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-text-muted">
              Estás a punto de finalizar tu intento. Una vez enviado, no podrás modificar tus respuestas.
            </p>

            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>Asegúrate de haber respondido todas las preguntas antes de confirmar.</span>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="secondary"
                onClick={() => setShowConfirmSubmit(false)}
              >
                Volver al Quiz
              </Button>
              <Button
                variant="success"
                isLoading={submitting}
                leftIcon={<Send className="w-4 h-4" />}
                onClick={handleFinalSubmit}
              >
                {submitting ? "Enviando..." : "Confirmar y Enviar"}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ========================
  // VIEW: QUIZ PRESENTATION
  // ========================
  if (!question || !attempt) return null;

  const isMultiChoice = question.tipo === "MULTICHOICE" && question.options.length > 2;

  // Colores para opciones
  const optionColors = [
    "bg-primary/10 hover:bg-primary/20 border-primary/30",
    "bg-accent-teal/10 hover:bg-accent-teal/20 border-accent-teal/30",
    "bg-accent-pink/10 hover:bg-accent-pink/20 border-accent-pink/30",
    "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30",
    "bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30",
    "bg-green-500/10 hover:bg-green-500/20 border-green-500/30",
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Confetti overlay */}
      <Confetti active={showConfetti} />

      {/* Top Bar */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-2">
        {/* Left: Quiz title */}
        <Link
          href="/estudiante"
          className="flex items-center gap-2 text-text-muted hover:text-text transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden md:inline text-sm">Volver al Panel</span>
        </Link>

        {/* Center: Quiz title */}
        <div className="flex-1 text-center">
          <h1 className="font-heading font-bold text-text text-lg">
            {attempt.quiz.titulo}
          </h1>
        </div>

        {/* Right: Timer + XP */}
        <div className="flex items-center gap-4">
          {/* XP */}
          <div className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 rounded-full">
            <span className="text-lg">⭐</span>
            <span className="font-bold text-primary">{xp} XP</span>
          </div>

          {/* Timer */}
          {timeLeft !== null && (
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-lg transition-colors ${
                timeLeft <= 30
                  ? "bg-red-500/10 text-red-600 animate-pulse"
                  : timeLeft <= 60
                  ? "bg-amber-500/10 text-amber-600"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <Timer className="w-5 h-5" />
              <span>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-3 bg-card/50 border-b border-border">
        <div className="flex items-center justify-between text-sm text-text-muted mb-2">
          <span>
            Pregunta {currentIndex + 1} de {totalQuestions}
          </span>
          <Badge variant="info">
            {question.tipo} • {question.defaultGrade} pt{question.defaultGrade !== 1 ? "s" : ""}
          </Badge>
        </div>
        <ProgressBar
          value={currentIndex + 1}
          max={totalQuestions}
          color="gradient"
          height={8}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto py-6">
        <div className="max-w-3xl mx-auto px-4">
          {/* Question Card */}
          <div className="bg-card rounded-3xl shadow-xl border border-border p-6 md:p-10 mb-8 animate-pop-in">
            {/* Q number + type */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <span className="font-heading font-bold text-primary text-lg">
                    {currentIndex + 1}
                  </span>
                </div>
                <Badge variant="info" className="text-xs">
                  {question.tipo}
                </Badge>
              </div>
              <div className="text-right">
                <Badge variant="secondary">
                  {question.defaultGrade} pts
                </Badge>
              </div>
            </div>

            {/* Enunciado */}
            <div
            className="prose prose-lg max-w-none text-text mb-8"
              dangerouslySetInnerHTML={{ __html: question.enunciadoHtml }}
            />

            {/* Opciones / inputs según tipo */}
            <div className="space-y-4">
              {(question.tipo === "MULTICHOICE" || question.tipo === "TRUEFALSE") && (
                <div className="space-y-3">
                  {question.options.map((opt, i) => {
                    const checked = selectedOptions.includes(opt.id);
                    const colorClass = optionColors[i % optionColors.length];

                    return (
                      <label
                        key={opt.id}
                        className={`group flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                          checked
                            ? "border-primary bg-primary/5 shadow-md"
                            : colorClass
                        }`}
                      >
                        <input
                          type={isMultiChoice ? "checkbox" : "radio"}
                          name={`question-${question.id}`}
                          checked={checked}
                          onChange={() => handleOptionChange(opt.id, isMultiChoice)}
                          className="text-primary focus:ring-primary w-5 h-5"
                        />
                        <div
                          className="text-text flex-1"
                          dangerouslySetInnerHTML={{ __html: opt.textoHtml }}
                        />
                        {checked && (
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center animate-bounce">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}

              {(question.tipo === "SHORTANSWER" || question.tipo === "NUMERICAL") && (
                <div>
                  <input
                    type={question.tipo === "NUMERICAL" ? "number" : "text"}
                    value={textValue}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder="Escribe tu respuesta aquí..."
                    className="w-full px-6 py-4 rounded-2xl border-2 border-border bg-surface text-text text-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              )}

              {question.tipo === "ESSAY" && (
                <div>
                  <textarea
                    rows={8}
                    value={textValue}
                    onChange={(e) => handleTextChange(e.target.value)}
                    placeholder="Escribe tu respuesta desarrollada aquí..."
                    className="w-full p-6 rounded-2xl border-2 border-border bg-surface text-text text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  />
                </div>
              )}

              {question.tipo === "MATCHING" && (
                <div className="space-y-4">
                  {question.options.map((sub) => {
                    let rightMatches: string[] = [];
                    try {
                      if (sub.extraJson) {
                        const extra = JSON.parse(sub.extraJson);
                        if (extra.choices) rightMatches = extra.choices;
                      }
                    } catch {}

                    if (rightMatches.length === 0) {
                      rightMatches = question.options.map((o) => o.textoHtml);
                    }

                    return (
                      <div
                        key={sub.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-surface-alt rounded-2xl border border-border"
                      >
                        <span
                          className="text-sm text-text font-medium"
                          dangerouslySetInnerHTML={{ __html: sub.textoHtml }}
                        />
                        <select
                          value={matchingPairs[sub.id] || ""}
                          onChange={(e) => handleMatchingChange(sub.id, e.target.value)}
                          className="px-4 py-2 rounded-xl border-2 border-border bg-card text-text text-base focus:outline-none focus:border-primary transition-all flex-1 sm:flex-none"
                        >
                          <option value="">-- Seleccionar --</option>
                          {rightMatches.map((optText, idx) => (
                            <option key={idx} value={optText}>
                              {optText}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}

              {(question.tipo === "DESCRIPTION" || question.tipo === "UNSUPPORTED") && (
                <div className="p-6 bg-surface-alt rounded-2xl text-text-muted text-center text-lg italic">
                  <HelpCircle className="w-8 h-8 mx-auto mb-2" />
                  Pregunta informativa. Continúa cuando estés listo.
                </div>
              )}
            </div>

            {/* Saving status indicator */}
            {savingStatus && (
              <div className="mt-6 flex items-center gap-2 text-xs text-text-muted animate-fade-up">
                {savingStatus === "guardado" && <CheckCircle className="w-4 h-4 text-green-500" />}
                {savingStatus === "guardando" && (
                  <div className="w-3 h-3 border border-text-muted border-t-transparent rounded-full animate-spin" />
                )}
                {savingStatus === "error" && <XCircle className="w-4 h-4 text-red-500" />}
                <span>
                  {savingStatus === "guardado"
                    ? "Respuesta guardada ✓"
                    : savingStatus === "guardando"
                    ? "Guardando..."
                    : "Error al guardar"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="border-t border-border bg-card/80 backdrop-blur-sm px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Navigation (if permitirRetroceso) */}
          {attempt.quiz.permitirRetroceso && totalQuestions > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => goToQuestion(currentIndex - 1)}
                disabled={currentIndex === 0}
              >
                Anterior
              </Button>

              {/* Mini grid de navegación */}
              <div className="hidden md:flex items-center gap-1 mx-4">
                {Array.from({ length: totalQuestions }).map((_, idx) => {
                  const isCurrent = idx === currentIndex;
                  const qid = attempt.quiz.questions?.[idx]?.id;
                  const hasAnswer = attempt.answers.some(
                    (a) =>
                      a.questionId === qid &&
                      (a.respuestaJson || a.respuestaTexto)
                  );

                  return (
                    <button
                      key={idx}
                      onClick={() => goToQuestion(idx)}
                      className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                        isCurrent
                          ? "bg-primary text-white shadow-lg scale-110"
                          : hasAnswer
                          ? "bg-green-500/10 text-green-600 border border-green-200"
                          : "bg-surface-alt text-text-muted hover:bg-surface-alt/80"
                      }`}
                    />
                  );
                })}
              </div>

              <Button
                variant="ghost"
                size="sm"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => goToQuestion(currentIndex + 1)}
                disabled={currentIndex === totalQuestions - 1}
              >
                Siguiente
              </Button>
            </div>
          )}

          {/* Submit button */}
          {currentIndex === totalQuestions - 1 ? (
            <Button
              variant="success"
              size="lg"
              leftIcon={<Send className="w-5 h-5" />}
              onClick={() => setShowConfirmSubmit(true)}
            >
              Revisar y Enviar
            </Button>
          ) : !attempt.quiz.permitirRetroceso ? (
            <Button
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight className="w-5 h-5" />}
              onClick={() => goToQuestion(currentIndex + 1)}
            >
              Continuar
            </Button>
          ) : null}
        </div>
      </div>

      {/* No back warning modal */}
      <Modal
        isOpen={showNoBackWarning}
        onClose={() => setShowNoBackWarning(false)}
        title="¿Continuar?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-text-muted">
            {attempt.quiz.permitirRetroceso
              ? "No puedes retroceder a tu pregunta anterior."
              : "En este quiz no está permitido retroceder. Una vez que avances, no podrás volver a esta pregunta ni modificarla."}
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setShowNoBackWarning(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={confirmNoBackNavigation}>
              Continuar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function PresentarQuizPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Mascot expression="think" size="lg" />
            <p className="mt-4 text-text-muted">Cargando evaluación...</p>
          </div>
        </div>
      }
    >
      <PresentarQuizContent params={params} />
    </Suspense>
  );
}


