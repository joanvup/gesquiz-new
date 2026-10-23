"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  X,
  Info,
} from "lucide-react";
import { Button } from "@/components";
import { RichTextEditor } from "@/components/questions/RichTextEditor";
import {
  isManualEditableDbType,
  MANUAL_QUESTION_TYPES,
  MANUAL_QUESTION_TYPE_HINTS,
  MANUAL_QUESTION_TYPE_LABELS,
  describeDbQuestionType,
  questionToEditorPayload,
  type ManualQuestionType,
} from "@/lib/question-types";
import type { QuestionDto } from "@/components/questions/types";
import { isBlankHtml } from "@/lib/html-text";

interface QuestionEditorProps {
  quizId: string;
  question?: QuestionDto | null;
  onSaved: (question: QuestionDto, puntajeMaximo: number) => void;
  onClose: () => void;
}

interface OptionState {
  textoHtml: string;
  esCorrecta: boolean;
}

interface FormState {
  tipo: ManualQuestionType;
  enunciadoHtml: string;
  defaultGrade: string;
  generalFeedbackHtml: string;
  opciones: OptionState[];
  respuestaVerdadero: boolean;
  respuestasAceptadas: string[];
  distinguirMayusculas: boolean;
}

const EMPTY_OPTION: OptionState = { textoHtml: "", esCorrecta: false };

function buildInitialState(question?: QuestionDto | null): FormState {
  if (!question) {
    return {
      tipo: "MULTICHOICE_SINGLE",
      enunciadoHtml: "",
      defaultGrade: "1",
      generalFeedbackHtml: "",
      opciones: [
        { textoHtml: "", esCorrecta: true },
        { textoHtml: "", esCorrecta: false },
      ],
      respuestaVerdadero: true,
      respuestasAceptadas: [""],
      distinguirMayusculas: false,
    };
  }

  const payload = questionToEditorPayload(question);
  const isImported = !isManualEditableDbType(question.tipo);

  return {
    tipo: payload.tipo,
    enunciadoHtml: payload.enunciadoHtml,
    defaultGrade: String(payload.defaultGrade),
    generalFeedbackHtml: payload.generalFeedbackHtml,
    opciones:
      payload.opciones.length > 0
        ? payload.opciones
        : [{ textoHtml: "", esCorrecta: true }, { textoHtml: "", esCorrecta: false }],
    respuestaVerdadero: payload.respuestaVerdadero,
    respuestasAceptadas:
      payload.respuestasAceptadas.length > 0 ? payload.respuestasAceptadas : [""],
    distinguirMayusculas: payload.distinguirMayusculas,
    ...(isImported ? { tipo: payload.tipo } : {}),
  };
}

export function QuestionEditor({
  quizId,
  question,
  onSaved,
  onClose,
}: QuestionEditorProps) {
  const [form, setForm] = useState<FormState>(() => buildInitialState(question));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isImported = Boolean(question && !isManualEditableDbType(question.tipo));

  const tipoLabel = useMemo(() => {
    if (isImported && question) {
      return describeDbQuestionType(question.tipo, question.datosJson, question.options);
    }
    return MANUAL_QUESTION_TYPE_LABELS[form.tipo];
  }, [form.tipo, isImported, question]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function changeType(tipo: ManualQuestionType) {
    setForm((previous) => ({
      ...previous,
      tipo,
      opciones:
        tipo === "MULTICHOICE_SINGLE" || tipo === "MULTICHOICE_MULTIPLE"
          ? previous.opciones.length >= 2
            ? previous.opciones
            : [
                { textoHtml: "", esCorrecta: true },
                { textoHtml: "", esCorrecta: false },
              ]
          : previous.opciones,
    }));
  }

  function updateOption(index: number, patch: Partial<OptionState>) {
    setForm((previous) => ({
      ...previous,
      opciones: previous.opciones.map((option, position) =>
        position === index ? { ...option, ...patch } : option
      ),
    }));
  }

  function markCorrect(index: number, checked: boolean) {
    setForm((previous) => ({
      ...previous,
      opciones: previous.opciones.map((option, position) => {
        if (previous.tipo === "MULTICHOICE_SINGLE") {
          return { ...option, esCorrecta: position === index };
        }
        return position === index ? { ...option, esCorrecta: checked } : option;
      }),
    }));
  }

  function addOption() {
    setForm((previous) => ({
      ...previous,
      opciones: [...previous.opciones, { ...EMPTY_OPTION }],
    }));
  }

  function removeOption(index: number) {
    setForm((previous) => ({
      ...previous,
      opciones: previous.opciones.filter((_, position) => position !== index),
    }));
  }

  function updateAnswer(index: number, value: string) {
    setForm((previous) => ({
      ...previous,
      respuestasAceptadas: previous.respuestasAceptadas.map((answer, position) =>
        position === index ? value : answer
      ),
    }));
  }

  function addAnswer() {
    setForm((previous) => ({
      ...previous,
      respuestasAceptadas: [...previous.respuestasAceptadas, ""],
    }));
  }

  function removeAnswer(index: number) {
    setForm((previous) => ({
      ...previous,
      respuestasAceptadas: previous.respuestasAceptadas.filter(
        (_, position) => position !== index
      ),
    }));
  }

  function validate(): string | null {
    if (isBlankHtml(form.enunciadoHtml)) {
      return "El enunciado no puede estar vacío";
    }

    const grade = Number(form.defaultGrade);
    if (!Number.isFinite(grade) || grade <= 0) {
      return "El puntaje debe ser mayor que 0";
    }

    if (!isImported) {
      if (form.tipo === "MULTICHOICE_SINGLE" || form.tipo === "MULTICHOICE_MULTIPLE") {
        if (form.opciones.length < 2) return "Agrega al menos dos opciones";
        if (form.opciones.some((option) => isBlankHtml(option.textoHtml))) {
          return "Completa el texto de todas las opciones";
        }
        const correctas = form.opciones.filter((option) => option.esCorrecta).length;
        if (correctas === 0) return "Marca al menos una opción correcta";
        if (form.tipo === "MULTICHOICE_SINGLE" && correctas > 1) {
          return "En respuesta única solo puede haber una opción correcta";
        }
      }

      if (form.tipo === "SHORTANSWER") {
        const answers = form.respuestasAceptadas.map((answer) => answer.trim()).filter(Boolean);
        if (answers.length === 0) return "Agrega al menos una respuesta aceptada";
      }
    }

    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");

    const body = isImported
      ? {
          enunciadoHtml: form.enunciadoHtml,
          defaultGrade: Number(form.defaultGrade),
          generalFeedbackHtml: form.generalFeedbackHtml || null,
        }
      : {
          tipo: form.tipo,
          enunciadoHtml: form.enunciadoHtml,
          defaultGrade: Number(form.defaultGrade),
          generalFeedbackHtml: form.generalFeedbackHtml || null,
          opciones:
            form.tipo === "MULTICHOICE_SINGLE" || form.tipo === "MULTICHOICE_MULTIPLE"
              ? form.opciones
              : [],
          respuestaVerdadero: form.respuestaVerdadero,
          respuestasAceptadas: form.respuestasAceptadas
            .map((answer) => answer.trim())
            .filter(Boolean),
          distinguirMayusculas: form.distinguirMayusculas,
        };

    try {
      const url = question
        ? `/api/docente/quizzes/${quizId}/questions/${question.id}`
        : `/api/docente/quizzes/${quizId}/questions`;

      const response = await fetch(url, {
        method: question ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "No se pudo guardar la pregunta");
        return;
      }

      onSaved(data.question as QuestionDto, data.puntajeMaximo as number);
    } catch {
      setError("Error de red al guardar la pregunta");
    } finally {
      setSaving(false);
    }
  }

  const showOptions =
    form.tipo === "MULTICHOICE_SINGLE" || form.tipo === "MULTICHOICE_MULTIPLE";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm dark:bg-black/70 md:p-6">
      <div className="my-4 w-full max-w-3xl rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h3 className="text-xl font-heading font-bold text-text">
              {question ? "Editar pregunta" : "Nueva pregunta"}
            </h3>
            <p className="mt-1 text-sm text-text-muted">{tipoLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-text-muted transition hover:bg-surface-alt hover:text-text"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-5">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm text-danger-text">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isImported && (
            <div className="flex items-start gap-3 rounded-xl border border-info/25 bg-info-soft p-3 text-sm text-info-text">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                Esta pregunta se importó desde Moodle ({question?.tipo}). Puedes cambiar el
                enunciado, el puntaje y la retroalimentación, pero sus opciones se conservan.
              </span>
            </div>
          )}

          {!isImported && (
            <div>
              <label className="mb-2 block text-sm font-medium text-text">
                Tipo de pregunta
              </label>
              <select
                value={form.tipo}
                onChange={(event) => changeType(event.target.value as ManualQuestionType)}
                className="w-full rounded-2xl border-2 border-border bg-surface px-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none"
              >
                {MANUAL_QUESTION_TYPES.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {MANUAL_QUESTION_TYPE_LABELS[tipo]}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-text-muted">
                {MANUAL_QUESTION_TYPE_HINTS[form.tipo]}
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-text">
              Enunciado *
            </label>
            <RichTextEditor
              key={`enunciado-${question?.id ?? "nuevo"}`}
              quizId={quizId}
              value={form.enunciadoHtml}
              onChange={(html) => update("enunciadoHtml", html)}
              placeholder="Escribe la pregunta. Puedes insertar imágenes con los botones de la barra."
            />
          </div>

          {showOptions && !isImported && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-text">
                  Opciones *
                  <span className="ml-2 text-xs font-normal text-text-muted">
                    {form.tipo === "MULTICHOICE_SINGLE"
                      ? "Marca la correcta"
                      : "Marca todas las correctas"}
                  </span>
                </label>
                <span className="text-xs text-text-muted">
                  {form.opciones.length} opción(es)
                </span>
              </div>

              <div className="space-y-3">
                {form.opciones.map((option, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 rounded-2xl border-2 p-3 transition ${
                      option.esCorrecta
                        ? "border-success/40 bg-success-soft/40"
                        : "border-border bg-surface"
                    }`}
                  >
                    <input
                      type={form.tipo === "MULTICHOICE_SINGLE" ? "radio" : "checkbox"}
                      checked={option.esCorrecta}
                      onChange={(event) => markCorrect(index, event.target.checked)}
                      className="mt-3 h-5 w-5 flex-shrink-0 text-success focus:ring-success"
                      title="Marcar como correcta"
                    />
                    <div className="min-w-0 flex-1">
                      <RichTextEditor
                        quizId={quizId}
                        compact
                        value={option.textoHtml}
                        onChange={(html) => updateOption(index, { textoHtml: html })}
                        placeholder={`Opción ${index + 1}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      disabled={form.opciones.length <= 2}
                      className="mt-2 rounded-lg p-1.5 text-text-muted transition hover:bg-danger-soft hover:text-danger-text disabled:cursor-not-allowed disabled:opacity-40"
                      title="Eliminar opción"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addOption}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-text hover:underline"
              >
                <Plus className="h-4 w-4" /> Agregar opción
              </button>
            </div>
          )}

          {form.tipo === "TRUEFALSE" && !isImported && (
            <div>
              <label className="mb-2 block text-sm font-medium text-text">
                Respuesta correcta *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[true, false].map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => update("respuestaVerdadero", value)}
                    className={`rounded-2xl border-2 px-4 py-4 text-sm font-semibold transition ${
                      form.respuestaVerdadero === value
                        ? "border-success bg-success-soft text-success-text"
                        : "border-border bg-surface text-text hover:border-border-strong"
                    }`}
                  >
                    {value ? "Verdadero" : "Falso"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.tipo === "SHORTANSWER" && !isImported && (
            <div>
              <label className="mb-2 block text-sm font-medium text-text">
                Respuestas aceptadas *
              </label>
              <p className="mb-3 text-xs text-text-muted">
                Puedes agregar sinónimos o variantes. Usa <code className="rounded bg-surface-alt px-1">*</code>{" "}
                como comodín (ej. <code className="rounded bg-surface-alt px-1">*París*</code>).
              </p>

              <div className="space-y-2">
                {form.respuestasAceptadas.map((answer, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={answer}
                      onChange={(event) => updateAnswer(index, event.target.value)}
                      placeholder={`Respuesta ${index + 1}`}
                      className="flex-1 rounded-xl border-2 border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeAnswer(index)}
                      disabled={form.respuestasAceptadas.length <= 1}
                      className="rounded-lg p-2 text-text-muted transition hover:bg-danger-soft hover:text-danger-text disabled:cursor-not-allowed disabled:opacity-40"
                      title="Eliminar respuesta"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addAnswer}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-text hover:underline"
              >
                <Plus className="h-4 w-4" /> Agregar respuesta aceptada
              </button>

              <label className="mt-4 flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={form.distinguirMayusculas}
                  onChange={(event) => update("distinguirMayusculas", event.target.checked)}
                  className="rounded border-border text-primary-text focus:ring-primary"
                />
                Distinguir mayúsculas y minúsculas
              </label>
            </div>
          )}

          {form.tipo === "ESSAY" && !isImported && (
            <div className="flex items-start gap-3 rounded-xl border border-info/25 bg-info-soft p-3 text-sm text-info-text">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                Las respuestas abiertas no se califican automáticamente. El docente las
                califica desde el detalle del intento en los resultados del quiz.
              </span>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-[140px_1fr]">
            <div>
              <label
                htmlFor="pregunta-puntaje"
                className="mb-2 block text-sm font-medium text-text"
              >
                Puntaje *
              </label>
              <input
                id="pregunta-puntaje"
                type="number"
                min="0.01"
                step="0.01"
                value={form.defaultGrade}
                onChange={(event) => update("defaultGrade", event.target.value)}
                className="w-full rounded-xl border-2 border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>
            <details className="rounded-xl border border-border bg-surface px-3 py-2">
              <summary className="cursor-pointer select-none text-sm font-medium text-text">
                Retroalimentación general (opcional)
              </summary>
              <div className="mt-3">
                <RichTextEditor
                  quizId={quizId}
                  compact
                  value={form.generalFeedbackHtml}
                  onChange={(html) => update("generalFeedbackHtml", html)}
                  placeholder="Se muestra al estudiante al finalizar (según configuración del quiz)."
                />
              </div>
            </details>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-muted transition hover:text-text"
            >
              Cancelar
            </button>
            <Button
              type="submit"
              variant="primary"
              isLoading={saving}
              leftIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            >
              {question ? "Guardar cambios" : "Crear pregunta"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
