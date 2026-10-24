/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { Mascot, Button, Badge, ProgressBar, Modal, ThemeToggle } from "@/components";
import { Confetti } from "@/components/Confetti";
import { toGradeScale } from "@/lib/grades";
import { getQuizNavigationDecision } from "@/lib/quiz-navigation";
import {
  ArrowLeft,
  ArrowRight,
  Send,
  CheckCircle,
  XCircle,
  Timer,
  HelpCircle,
  AlertCircle,
  AlertTriangle,
  Maximize2,
  ShieldAlert,
  ShieldCheck,
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
  multiple: boolean;
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
  puntajeMaximo?: number;
  infractions: number;
  quiz: {
    id: string;
    titulo: string;
    permitirRetroceso: boolean;
    advertirAlContinuar: boolean;
    puntajeMaximo: number;
    mostrarResultado: string;
    tiempoLimiteMinutos?: number | null;
    modoSeguro: boolean;
    maxInfracciones: number;
    questions: { id: string; tipo: string }[];
  };
  answers: {
    questionId: string;
    respuestaJson?: string | null;
    respuestaTexto?: string | null;
  }[];
}

const XP_PER_CORRECT = 10;

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

  // Modo seguro
  const [safeModeStarted, setSafeModeStarted] = useState(false);
  const [enteringSafeMode, setEnteringSafeMode] = useState(false);
  const [safeModeError, setSafeModeError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [infractions, setInfractions] = useState(0);
  const [showInfractionWarning, setShowInfractionWarning] = useState(false);
  const [infractionMessage, setInfractionMessage] = useState("");
  const [infractionError, setInfractionError] = useState("");
  const [requiresFullscreen, setRequiresFullscreen] = useState(false);
  const [reenteringFullscreen, setReenteringFullscreen] = useState(false);

  const safeModeActiveRef = useRef(false);
  const endingSafeModeRef = useRef(false);
  const submittingRef = useRef(false);
  const sessionTokenRef = useRef<string | null>(null);
  const tokenRequestRef = useRef<Promise<string | null> | null>(null);
  const lastInfractionAtRef = useRef(0);
  const infractionInFlightRef = useRef(false);
  const heartbeatInFlightRef = useRef(false);

  const maxInfracciones = attempt?.quiz.maxInfracciones ?? 3;
  const safeModeEnabled = Boolean(attempt?.quiz.modoSeguro);

  const initializeAnswerState = (q: Question, ans: AnswerData | null) => {
    setSelectedOptions([]);
    setTextValue("");
    setMatchingPairs({});

    if (!ans) return;

    if (q.tipo === "MULTICHOICE" || q.tipo === "TRUEFALSE") {
      try {
        const parsed = ans.respuestaJson ? JSON.parse(ans.respuestaJson) : [];
        if (Array.isArray(parsed)) {
          const values = parsed.map(String);
          // Preguntas de respuesta única: limpia selecciones múltiples
          // guardadas por versiones anteriores.
          setSelectedOptions(q.multiple ? values : values.slice(-1));
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

  const exitFullscreen = useCallback(async () => {
    if (typeof document === "undefined" || !document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
    } catch {
      // El navegador puede bloquear la salida si ya no hay pantalla completa.
    }
  }, []);

  const handleSessionBlocked = useCallback((message: string) => {
    setSessionError(message);
    setSafeModeStarted(false);
    safeModeActiveRef.current = false;
    endingSafeModeRef.current = true;
    setShowInfractionWarning(false);
    setRequiresFullscreen(false);
    void exitFullscreen();
  }, [exitFullscreen]);

  const ensureSessionToken = useCallback(
    async (attemptData: AttemptData) => {
      const key = `attempt_token_${attemptId}`;

      try {
        const existing = sessionStorage.getItem(key);
        if (existing) {
          sessionTokenRef.current = existing;
          return existing;
        }
      } catch {
        throw new Error("El navegador bloqueó el almacenamiento de la sesión segura.");
      }

      if (!attemptData.quiz.modoSeguro) return null;

      // Si dos cargas (o React Strict Mode) piden token a la vez, comparten la
      // misma petición para no rotar el token dos veces y dejar una sesión vieja.
      if (tokenRequestRef.current) return tokenRequestRef.current;

      const request = (async () => {
        const res = await fetch(`/api/estudiante/quizzes/${attemptData.quiz.id}/intentos`, {
          method: "POST",
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success || !data.sessionToken) {
          throw new Error(data.error || "No se pudo validar la sesión del intento.");
        }

        if (data.attempt?.id && data.attempt.id !== attemptData.id) {
          throw new Error("El intento activo cambió. Vuelve al panel e inicia el quiz de nuevo.");
        }

        try {
          sessionStorage.setItem(key, data.sessionToken);
        } catch {
          throw new Error("El navegador bloqueó el almacenamiento de la sesión segura.");
        }

        sessionTokenRef.current = data.sessionToken;
        return data.sessionToken as string;
      })();

      tokenRequestRef.current = request;

      try {
        return await request;
      } finally {
        tokenRequestRef.current = null;
      }
    },
    [attemptId]
  );

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
        setInfractions(dataAttempt.attempt.infractions ?? 0);

        if (dataAttempt.attempt.status !== "EN_CURSO") {
          setResultsData(dataAttempt.attempt);
          if (safeModeActiveRef.current) {
            endingSafeModeRef.current = true;
            safeModeActiveRef.current = false;
            void exitFullscreen();
          }
          setLoading(false);
          return;
        }

        if (dataAttempt.attempt.quiz.modoSeguro) {
          try {
            await ensureSessionToken(dataAttempt.attempt);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "No se pudo validar la sesión segura.";
            if (safeModeActiveRef.current) {
              handleSessionBlocked(message);
              return;
            }
            setSafeModeError(message);
          }
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
    [attemptId, ensureSessionToken, exitFullscreen, handleSessionBlocked, router]
  );

  const handleAutoSubmitDueToExpiration = useCallback(async () => {
    submittingRef.current = true;
    endingSafeModeRef.current = true;
    safeModeActiveRef.current = false;
    setShowInfractionWarning(false);
    setRequiresFullscreen(false);
    await exitFullscreen();

    try {
      const res = await fetch(`/api/estudiante/intentos/${attemptId}/enviar`, {
        method: "POST",
      });
      const data = await res.json();
      setResultsData(data);
      setShowConfetti(true);
    } catch {
      router.push("/estudiante");
    } finally {
      submittingRef.current = false;
    }
  }, [attemptId, exitFullscreen, router]);

  const reportInfraction = useCallback(
    async (tipo: string, detalle: string) => {
      if (!safeModeEnabled || !safeModeActiveRef.current) return;
      if (endingSafeModeRef.current || submittingRef.current || sessionError) return;

      const now = Date.now();
      if (now - lastInfractionAtRef.current < 1500) return;
      if (infractionInFlightRef.current) return;
      lastInfractionAtRef.current = now;
      infractionInFlightRef.current = true;

      let token = sessionTokenRef.current;
      if (!token) {
        try {
          token = sessionStorage.getItem(`attempt_token_${attemptId}`);
        } catch {
          token = null;
        }
      }

      if (!token) {
        infractionInFlightRef.current = false;
        handleSessionBlocked(
          "No se pudo validar la sesión segura del intento. Vuelve al panel e ingresa nuevamente."
        );
        return;
      }
      sessionTokenRef.current = token;

      const isFullscreenStillMissing = () =>
        tipo === "SALIDA_PANTALLA_COMPLETA" &&
        (typeof document === "undefined" || !document.fullscreenElement);

      try {
        const res = await fetch(`/api/estudiante/intentos/${attemptId}/infracciones`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-attempt-session": token,
          },
          body: JSON.stringify({ tipo, detalle }),
          keepalive: true,
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 409) {
          handleSessionBlocked(
            data.error ||
              "Este intento se abrió en otra pestaña o dispositivo. La sesión de esta pestaña fue bloqueada."
          );
          return;
        }
        if (res.status === 401 || res.status === 403) {
          handleSessionBlocked(
            data.error || "Tu sesión expiró. Vuelve al panel e ingresa nuevamente."
          );
          return;
        }
        if (!res.ok || !data.success) {
          setInfractionMessage(detalle);
          setRequiresFullscreen(
            (previous) => previous || isFullscreenStillMissing()
          );
          setInfractionError(data.error || "No se pudo registrar la infracción.");
          setShowInfractionWarning(true);
          return;
        }

        setInfractions((prev) =>
          typeof data.infractions === "number" ? data.infractions : prev + 1
        );
        setInfractionError("");

        if (data.autoSubmitted) {
          setShowInfractionWarning(false);
          setRequiresFullscreen(false);
          endingSafeModeRef.current = true;
          safeModeActiveRef.current = false;
          await exitFullscreen();
          await loadAttemptAndQuestion(0);
          return;
        }

        setInfractionMessage(detalle);
        setRequiresFullscreen(
          (previous) => previous || isFullscreenStillMissing()
        );
        setShowInfractionWarning(true);
      } catch {
        setInfractionMessage(detalle);
        setRequiresFullscreen(
          (previous) => previous || isFullscreenStillMissing()
        );
        setInfractionError(
          "Error de red al registrar la infracción. Se reintentará en el próximo evento."
        );
        setShowInfractionWarning(true);
      } finally {
        infractionInFlightRef.current = false;
      }
    },
    [
      attemptId,
      exitFullscreen,
      handleSessionBlocked,
      loadAttemptAndQuestion,
      safeModeEnabled,
      sessionError,
    ]
  );

  async function enterSafeMode() {
    if (!attempt) return;

    setEnteringSafeMode(true);
    setSafeModeError("");
    setInfractionError("");

    try {
      if (
        typeof document === "undefined" ||
        typeof document.documentElement.requestFullscreen !== "function"
      ) {
        throw new Error(
          "Tu navegador no permite pantalla completa. Usa Chrome, Edge o Firefox en computadora."
        );
      }

      // Debe invocarse dentro del clic del usuario para que el navegador lo permita.
      const fullscreenRequest = document.documentElement.requestFullscreen();
      await fullscreenRequest;

      const token = await ensureSessionToken(attempt);
      if (!token) {
        throw new Error("No se pudo validar la sesión segura del intento.");
      }

      sessionTokenRef.current = token;
      endingSafeModeRef.current = false;
      safeModeActiveRef.current = true;
      setSafeModeStarted(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo activar el modo seguro.";
      setSafeModeError(message);
      setSafeModeStarted(false);
      safeModeActiveRef.current = false;

      if (typeof document !== "undefined" && document.fullscreenElement) {
        endingSafeModeRef.current = true;
        await exitFullscreen();
      }
    } finally {
      setEnteringSafeMode(false);
    }
  }

  async function reenterFullscreen() {
    setReenteringFullscreen(true);
    setInfractionError("");

    try {
      if (
        typeof document === "undefined" ||
        typeof document.documentElement.requestFullscreen !== "function"
      ) {
        throw new Error(
          "Tu navegador no permite pantalla completa. Usa Chrome, Edge o Firefox en computadora."
        );
      }

      const fullscreenRequest = document.documentElement.requestFullscreen();
      await fullscreenRequest;

      setRequiresFullscreen(false);
      setShowInfractionWarning(false);
      setInfractionMessage("");
    } catch (error) {
      setInfractionError(
        error instanceof Error
          ? error.message
          : "No se pudo volver a pantalla completa. Inténtalo de nuevo."
      );
    } finally {
      setReenteringFullscreen(false);
    }
  }

  useEffect(() => {
    try {
      const token = sessionStorage.getItem(`attempt_token_${attemptId}`);
      if (token) sessionTokenRef.current = token;
    } catch {
      // sessionStorage puede estar bloqueado; el gate de modo seguro mostrará el error.
    }
  }, [attemptId]);

  // Evita cerrar o recargar accidentalmente durante el modo seguro.
  useEffect(() => {
    if (!safeModeStarted) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [safeModeStarted]);

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

  // Detecta cambios de pestaña/ventana y salidas de pantalla completa.
  useEffect(() => {
    if (!safeModeEnabled || !safeModeStarted || attempt?.status !== "EN_CURSO") return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        void reportInfraction(
          "CAMBIO_PESTANA",
          "El estudiante cambió de pestaña o minimizó la ventana."
        );
      }
    };

    const handleWindowBlur = () => {
      // visibilitychange ya cubre el cambio de pestaña; blur cubre cambios de ventana.
      if (!document.hidden) {
        void reportInfraction(
          "CAMBIO_VENTANA",
          "El estudiante cambió de ventana o perdió el foco de la evaluación."
        );
      }
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement || endingSafeModeRef.current) return;

      // Bloquea la interacción de inmediato; el conteo se confirma con la API.
      setInfractionMessage("El estudiante salió de la pantalla completa.");
      setRequiresFullscreen(true);
      setShowInfractionWarning(true);
      void reportInfraction(
        "SALIDA_PANTALLA_COMPLETA",
        "El estudiante salió de la pantalla completa."
      );
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [attempt?.status, reportInfraction, safeModeEnabled, safeModeStarted]);

  // Heartbeat: mantiene viva la sesión y detecta si otro dispositivo la reemplazó.
  useEffect(() => {
    if (
      !safeModeEnabled ||
      !safeModeStarted ||
      Boolean(sessionError) ||
      attempt?.status !== "EN_CURSO"
    ) {
      return;
    }

    let cancelled = false;

    const sendHeartbeat = async () => {
      if (cancelled || heartbeatInFlightRef.current) return;

      let token = sessionTokenRef.current;
      if (!token) {
        try {
          token = sessionStorage.getItem(`attempt_token_${attemptId}`);
        } catch {
          token = null;
        }
      }
      if (!token) return;
      sessionTokenRef.current = token;

      heartbeatInFlightRef.current = true;
      try {
        const res = await fetch(`/api/estudiante/intentos/${attemptId}/heartbeat`, {
          method: "POST",
          headers: { "x-attempt-session": token },
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (res.status === 409) {
          handleSessionBlocked(
            data.error ||
              "Este intento se abrió en otra pestaña o dispositivo. La sesión de esta pestaña fue bloqueada."
          );
          return;
        }
        if (res.status === 401 || res.status === 403) {
          handleSessionBlocked(
            data.error || "Tu sesión expiró. Vuelve al panel e ingresa nuevamente."
          );
          return;
        }
        if (data.status && data.status !== "EN_CURSO") {
          await loadAttemptAndQuestion(0);
        }
      } catch {
        // Sin conexión: el siguiente latido reintenta.
      } finally {
        heartbeatInFlightRef.current = false;
      }
    };

    void sendHeartbeat();
    const interval = setInterval(() => {
      void sendHeartbeat();
    }, 20000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    attempt?.status,
    attemptId,
    handleSessionBlocked,
    loadAttemptAndQuestion,
    safeModeEnabled,
    safeModeStarted,
    sessionError,
  ]);

  // Salir de pantalla completa al abandonar la página.
  useEffect(() => {
    return () => {
      endingSafeModeRef.current = true;
      if (typeof document !== "undefined" && document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Si el intento termina, no debe quedar la pantalla completa abierta.
  useEffect(() => {
    if (!resultsData && (!attempt || attempt.status === "EN_CURSO")) return;

    endingSafeModeRef.current = true;
    safeModeActiveRef.current = false;
    setSafeModeStarted(false);
    setShowInfractionWarning(false);
    setRequiresFullscreen(false);

    if (typeof document !== "undefined" && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
  }, [attempt, resultsData]);

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

  function handleOptionChange(optionId: string) {
    const isMulti = Boolean(question?.multiple);
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

    const decision = getQuizNavigationDecision({
      permitirRetroceso: attempt.quiz.permitirRetroceso,
      advertirAlContinuar: attempt.quiz.advertirAlContinuar,
      currentIndex,
      targetIndex,
    });

    if (decision === "block") return;

    if (decision === "confirm") {
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
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/estudiante/intentos/${attemptId}/enviar`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        endingSafeModeRef.current = true;
        safeModeActiveRef.current = false;
        setShowInfractionWarning(false);
        setRequiresFullscreen(false);
        await exitFullscreen();
        setResultsData(data);
        setShowConfetti(true);
      } else {
        alert(data.error || "Error al enviar intento");
      }
    } catch {
      alert("Error de red al enviar");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
      setShowConfirmSubmit(false);
    }
  }

  const safeModeWarning = (
    <Modal
      isOpen={showInfractionWarning}
      onClose={() => {
        if (!requiresFullscreen) {
          setShowInfractionWarning(false);
          setInfractionError("");
        }
      }}
      title="Infracción de modo seguro"
      size="md"
      closeOnOverlayClick={!requiresFullscreen}
    >
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-danger-soft border border-danger/25 text-danger-text flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Se registró una infracción</p>
            <p className="text-sm mt-1">
              {infractionMessage || "Se detectó una acción no permitida durante la evaluación."}
            </p>
          </div>
        </div>

        <p className="text-text-muted text-sm">
          Infracciones registradas:{" "}
          <strong className="text-text">
            {infractions} de {maxInfracciones}
          </strong>
          .{" "}
          {infractions < maxInfracciones
            ? `Al llegar a ${maxInfracciones}, tu intento se enviará automáticamente.`
            : "Tu intento será enviado automáticamente."}
        </p>

        {requiresFullscreen && (
          <div className="p-4 rounded-xl bg-warning-soft border border-warning/25 text-warning-text text-sm flex items-start gap-3">
            <Maximize2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>
              Debes volver a pantalla completa para continuar con la evaluación. Si intentas
              salir de nuevo, se registrará otra infracción.
            </span>
          </div>
        )}

        {infractionError && (
          <p className="text-sm text-danger-text">{infractionError}</p>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          {requiresFullscreen ? (
            <Button
              variant="primary"
              isLoading={reenteringFullscreen}
              leftIcon={<Maximize2 className="w-4 h-4" />}
              onClick={reenterFullscreen}
            >
              Volver a pantalla completa
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => {
                setShowInfractionWarning(false);
                setInfractionError("");
              }}
            >
              Entendido
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );

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
  // VIEW: SESSION BLOCKED
  // ========================
  if (sessionError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
        <ThemeToggle className="absolute top-4 right-4 z-20" />
        <div className="max-w-lg w-full bg-card rounded-3xl shadow-2xl border border-border p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-danger-text" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-text">Sesión bloqueada</h1>
            <p className="mt-2 text-text-muted">{sessionError}</p>
          </div>
          <Link href="/estudiante" className="block">
            <Button variant="primary" size="lg" className="w-full">
              Volver al Panel
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ========================
  // VIEW: SAFE MODE GATE
  // ========================
  if (!resultsData && safeModeEnabled && attempt?.status === "EN_CURSO" && !safeModeStarted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
        <ThemeToggle className="absolute top-4 right-4 z-20" />
        <div className="max-w-xl w-full bg-card rounded-3xl shadow-2xl border border-border p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-primary-text" />
          </div>

          <div>
            <h1 className="text-2xl font-heading font-bold text-text">Modo seguro activado</h1>
            <p className="mt-2 text-text-muted">
              Para comenzar esta evaluación debes activar la pantalla completa.
            </p>
          </div>

          <div className="text-left p-4 rounded-2xl bg-warning-soft border border-warning/25 text-warning-text flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <ul className="text-sm space-y-1 list-disc pl-4">
              <li>La evaluación se abrirá en pantalla completa.</li>
              <li>Cambiar de pestaña o ventana cuenta como infracción.</li>
              <li>Salir de pantalla completa cuenta como infracción.</li>
              <li>
                Al llegar a {maxInfracciones} infracciones, el intento se enviará automáticamente.
              </li>
            </ul>
          </div>

          {infractions > 0 && (
            <p className="text-sm text-text-muted">
              Infracciones registradas:{" "}
              <strong className="text-text">
                {infractions} de {maxInfracciones}
              </strong>
            </p>
          )}

          {safeModeError && (
            <div className="p-4 rounded-2xl bg-danger-soft border border-danger/25 text-danger-text text-sm text-left flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{safeModeError}</span>
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={enteringSafeMode}
            leftIcon={<Maximize2 className="w-5 h-5" />}
            onClick={enterSafeMode}
          >
            {enteringSafeMode ? "Activando..." : "Activar pantalla completa y comenzar"}
          </Button>

          <p className="text-xs text-text-muted">
            El tiempo del intento ya está corriendo. No cierres esta ventana ni cambies de
            pestaña.
          </p>
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

    const finalScore = data?.score ?? attempt?.score ?? null;
    const maxScore =
      attempt?.quiz?.puntajeMaximo ?? data?.puntajeMaximo ?? data?.quiz?.puntajeMaximo ?? 0;
    const finalGrade = toGradeScale(finalScore, maxScore);
    const rawPercentage =
      finalScore !== null && maxScore > 0
        ? Math.round((finalScore / maxScore) * 100)
        : 0;
    const gradePercentage = finalGrade ?? 0;

    // Mensaje de aliento según desempeño
    let mascotExpression: "happy" | "cheer" | "oops" = "happy";
    let encouragement = "¡Buen trabajo!";
    if (gradePercentage >= 90) {
      mascotExpression = "cheer";
      encouragement = "¡Excelente puntuación! 🎉";
    } else if (gradePercentage >= 70) {
      mascotExpression = "happy";
      encouragement = "¡Muy bien hecho!";
    } else if (gradePercentage >= 50) {
      mascotExpression = "happy";
      encouragement = "¡Puedes mejorar! 💪";
    } else {
      mascotExpression = "oops";
      encouragement = "¡Ánimo! La práctica hace al maestro 📚";
    }

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
        <ThemeToggle className="absolute top-4 right-4 z-20" />
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
              <span className="font-bold text-xl text-primary-text">+{xp} XP</span>
            </div>

            {/* Score */}
            {showScore ? (
              <div className="space-y-4 py-6">
                <div className="text-center">
                  <span className="text-sm text-text-muted font-medium block mb-1">
                    Calificación Obtenida
                  </span>
                  <span className="text-xs text-text-muted block mb-1">
                    Escala 10–100
                  </span>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-heading font-extrabold text-primary-text">
                      {finalGrade ?? "—"}
                    </span>
                    <span className="text-2xl text-text-muted">
                      / 100
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
                      strokeDasharray={`${gradePercentage * 2.64}, 264`}
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
                      {gradePercentage}%
                    </span>
                  </div>
                </div>

                {finalGrade === null ? (
                  <p className="text-xs text-text-muted">
                    Pendiente de calificación
                  </p>
                ) : (
                  <p className="text-xs text-text-muted">
                    Puntaje: {finalScore ?? 0} / {maxScore} · Aciertos: {rawPercentage}%
                  </p>
                )}
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
        <ThemeToggle className="absolute top-4 right-4 z-20" />
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

            <div className="p-4 bg-warning-soft border border-warning/25 text-warning-text rounded-xl flex items-center gap-3">
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
        {safeModeWarning}
      </div>
    );
  }

  // ========================
  // VIEW: QUIZ PRESENTATION
  // ========================
  if (!question || !attempt) return null;

  const isMultiChoice = Boolean(question.multiple);

  // Colores para opciones
  const optionColors = [
    "bg-primary/10 hover:bg-primary/20 border-primary/30",
    "bg-accent-teal/10 hover:bg-accent-teal/20 border-accent-teal/30",
    "bg-accent-pink/10 hover:bg-accent-pink/20 border-accent-pink/30",
    "bg-warning/10 hover:bg-warning/20 border-warning/30",
    "bg-info/10 hover:bg-info/20 border-info/30",
    "bg-success/10 hover:bg-success/20 border-success/30",
  ];

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Confetti overlay */}
      <Confetti active={showConfetti} />

      {/* Top Bar */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-2">
        {/* Left: safe mode indicator / back link */}
        {safeModeEnabled && safeModeStarted ? (
          <div
            className="flex items-center gap-2 text-primary-text"
            title="El modo seguro está activo"
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden md:inline text-sm font-medium">Modo seguro</span>
          </div>
        ) : (
          <Link
            href="/estudiante"
            className="flex items-center gap-2 text-text-muted hover:text-text transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden md:inline text-sm">Volver al Panel</span>
          </Link>
        )}

        {/* Center: Quiz title */}
        <div className="flex-1 text-center">
          <h1 className="font-heading font-bold text-text text-lg">
            {attempt.quiz.titulo}
          </h1>
        </div>

        {/* Right: Theme, Timer + XP */}
        <div className="flex items-center gap-4">
          <ThemeToggle />
          {/* XP */}
          <div className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 rounded-full">
            <span className="text-lg">⭐</span>
            <span className="font-bold text-primary-text">{xp} XP</span>
          </div>

          {/* Timer */}
          {timeLeft !== null && (
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-lg transition-colors ${
                timeLeft <= 30
                  ? "bg-danger/10 text-danger-text animate-pulse"
                  : timeLeft <= 60
                  ? "bg-warning/10 text-warning-text"
                  : "bg-primary/10 text-primary-text"
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
          <div className="flex items-center gap-2">
            {safeModeEnabled && (
              <Badge
                variant={infractions > 0 ? "danger" : "secondary"}
                title={`Infracciones: ${infractions} de ${maxInfracciones}`}
              >
                <ShieldCheck className="w-3 h-3" />
                <span className="ml-1">
                  {infractions}/{maxInfracciones}
                </span>
              </Badge>
            )}
            <Badge variant="info">
              {question.tipo} • {question.defaultGrade} pt{question.defaultGrade !== 1 ? "s" : ""}
            </Badge>
          </div>
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
                  <span className="font-heading font-bold text-primary-text text-lg">
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
            className="rich-content max-w-none text-text mb-8"
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
                          onChange={() => handleOptionChange(opt.id)}
                          className="text-primary-text focus:ring-primary w-5 h-5"
                        />
                        <div
                          className="rich-content text-text flex-1"
                          dangerouslySetInnerHTML={{ __html: opt.textoHtml }}
                        />
                        {checked && (
                          <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center animate-bounce">
                            <CheckCircle className="w-4 h-4 text-primary-foreground" />
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
                        <div
                          className="rich-content text-sm text-text font-medium"
                          dangerouslySetInnerHTML={{ __html: sub.textoHtml }}
                        ></div>
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
                {savingStatus === "guardado" && <CheckCircle className="w-4 h-4 text-success" />}
                {savingStatus === "guardando" && (
                  <div className="w-3 h-3 border border-text-muted border-t-transparent rounded-full animate-spin" />
                )}
                {savingStatus === "error" && <XCircle className="w-4 h-4 text-danger" />}
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
                          ? "bg-primary text-primary-foreground shadow-lg scale-110"
                          : hasAnswer
                          ? "bg-success-soft text-success-text border border-success/30"
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
            En este quiz no está permitido retroceder. Una vez que avances, no podrás volver a esta pregunta ni modificarla.
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

      {safeModeWarning}
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


