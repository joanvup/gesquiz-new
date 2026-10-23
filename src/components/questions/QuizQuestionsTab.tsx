/* eslint-disable react-hooks/set-state-in-effect -- carga inicial de datos desde la API */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileJson,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge, Button } from "@/components";
import { QuestionEditor } from "@/components/questions/QuestionEditor";
import type {
  QuestionDto,
  QuizImportReport,
  QuestionsResponse,
} from "@/components/questions/types";
import {
  describeDbQuestionType,
  isManualEditableDbType,
  isMultipleAnswer,
} from "@/lib/question-types";
import { htmlPreview } from "@/lib/html-text";

interface QuizQuestionsTabProps {
  quizId: string;
}

interface SortableQuestionCardProps {
  question: QuestionDto;
  index: number;
  busy: boolean;
  onEdit: (question: QuestionDto) => void;
  onDelete: (question: QuestionDto) => void;
}

function correctCount(question: QuestionDto): number {
  return question.options.filter(
    (option) => option.esCorrecta || option.fraction > 0
  ).length;
}

function answerSummary(question: QuestionDto): string {
  if (question.tipo === "SHORTANSWER") {
    return `${question.options.length} respuesta(s) aceptada(s)`;
  }
  if (question.tipo === "ESSAY") {
    return "Calificación manual";
  }
  if (question.tipo === "MULTICHOICE") {
    const total = question.options.length;
    const correctas = correctCount(question);
    return isMultipleAnswer(question)
      ? `${total} opciones · ${correctas} correctas`
      : `${total} opciones · 1 correcta`;
  }
  if (question.tipo === "TRUEFALSE") {
    return "Verdadero / Falso";
  }
  return `${question.options.length} opción(es)`;
}

function SortableQuestionCard({
  question,
  index,
  busy,
  onEdit,
  onDelete,
}: SortableQuestionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: question.id, disabled: busy });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const editable = isManualEditableDbType(question.tipo);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm transition ${
        isDragging ? "border-primary shadow-lg" : "border-border"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={busy}
        className="mt-1 cursor-grab rounded-lg p-1.5 text-text-muted hover:bg-surface-alt hover:text-text active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
        title="Arrastrar para reordenar"
        aria-label={`Reordenar pregunta ${index + 1}`}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-heading font-bold text-primary-text">
        {index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={editable ? "info" : "secondary"}>
            {describeDbQuestionType(
              question.tipo,
              question.datosJson,
              question.options
            )}
          </Badge>
          <Badge variant="outline">{question.defaultGrade} pts</Badge>
          {!editable && <Badge variant="secondary">Importada</Badge>}
        </div>

        <p className="mt-2 line-clamp-2 text-sm text-text">
          {htmlPreview(question.enunciadoHtml, 160) || "(sin enunciado)"}
        </p>
        <p className="mt-1 text-xs text-text-muted">{answerSummary(question)}</p>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(question)}
          disabled={busy}
          className="rounded-lg p-2 text-text-muted transition hover:bg-primary/10 hover:text-primary-text disabled:opacity-40"
          title="Editar pregunta"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(question)}
          disabled={busy}
          className="rounded-lg p-2 text-text-muted transition hover:bg-danger-soft hover:text-danger-text disabled:opacity-40"
          title="Eliminar pregunta"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function QuizQuestionsTab({ quizId }: QuizQuestionsTabProps) {
  const [questions, setQuestions] = useState<QuestionDto[]>([]);
  const [puntajeMaximo, setPuntajeMaximo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionDto | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [applyConfig, setApplyConfig] = useState(false);
  const [replaceQuestions, setReplaceQuestions] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<QuizImportReport | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/docente/quizzes/${quizId}/questions`, {
        cache: "no-store",
      });
      const data = (await response.json()) as QuestionsResponse;
      if (!response.ok || !data.success) {
        setError(data.error || "No se pudieron cargar las preguntas");
        return;
      }
      setQuestions(data.questions);
      setPuntajeMaximo(data.puntajeMaximo);
    } catch {
      setError("Error de red al cargar las preguntas");
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = questions.findIndex((question) => question.id === active.id);
    const newIndex = questions.findIndex((question) => question.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const previous = questions;
    const reordered = arrayMove(questions, oldIndex, newIndex);
    setQuestions(reordered);
    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        `/api/docente/quizzes/${quizId}/questions/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: reordered.map((question) => question.id) }),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setQuestions(previous);
        setError(data.error || "No se pudo guardar el nuevo orden");
      }
    } catch {
      setQuestions(previous);
      setError("Error de red al guardar el orden");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(question: QuestionDto) {
    if (
      !window.confirm(
        `¿Eliminar la pregunta ${question.orden}? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/docente/quizzes/${quizId}/questions/${question.id}`,
        { method: "DELETE" }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || "No se pudo eliminar la pregunta");
        return;
      }
      await load();
    } catch {
      setError("Error de red al eliminar la pregunta");
    } finally {
      setBusy(false);
    }
  }

  function handleSaved(saved: QuestionDto, nuevoPuntajeMaximo: number) {
    setQuestions((previous) => {
      const exists = previous.some((question) => question.id === saved.id);
      if (exists) {
        return previous.map((question) =>
          question.id === saved.id ? saved : question
        );
      }
      return [...previous, saved].sort((a, b) => a.orden - b.orden);
    });
    setPuntajeMaximo(nuevoPuntajeMaximo);
    setEditorOpen(false);
    setEditingQuestion(null);
  }

  function exportQuiz() {
    // Descarga directa: el endpoint responde con Content-Disposition: attachment.
    const link = document.createElement("a");
    link.href = `/api/docente/quizzes/${quizId}/export`;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function handleImport(event: React.FormEvent) {
    event.preventDefault();
    if (!importFile) {
      setError("Selecciona un archivo .json");
      return;
    }

    setImporting(true);
    setError("");
    setImportReport(null);

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("aplicarConfiguracion", String(applyConfig));
      formData.append("reemplazar", String(replaceQuestions));

      const response = await fetch(
        `/api/docente/quizzes/${quizId}/import-json`,
        { method: "POST", body: formData }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "No se pudo importar el quiz");
        return;
      }

      setImportReport(data.report as QuizImportReport);
      setImportFile(null);
      if (importInputRef.current) importInputRef.current.value = "";
      await load();
    } catch {
      setError("Error de red al importar el quiz");
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-3xl border border-border bg-card p-10 text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando preguntas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-heading font-bold text-text">
              Preguntas del quiz
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Crea preguntas manualmente, inserta imágenes y ordénalas arrastrando.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={exportQuiz}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Exportar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setImportOpen(true);
                setImportReport(null);
                setError("");
              }}
              leftIcon={<Upload className="h-4 w-4" />}
            >
              Importar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingQuestion(null);
                setEditorOpen(true);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Nueva pregunta
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="info">
            {questions.length} pregunta{questions.length === 1 ? "" : "s"}
          </Badge>
          <Badge variant="secondary">{puntajeMaximo} pts en total</Badge>
          {questions.length > 1 && (
            <Badge variant="outline">Arrastra para ordenar</Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/25 bg-danger-soft p-4 text-sm text-danger-text">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {importReport && (
        <div className="rounded-2xl border border-success/25 bg-success-soft p-4 text-sm text-success-text">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5" />
            Importación completada
          </div>
          <p className="mt-1">
            {importReport.creadas} pregunta(s) creada(s), {importReport.omitidas}{" "}
            omitida(s), {importReport.imagenesImportadas} imagen(es).
          </p>
          {importReport.advertencias.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {importReport.advertencias.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {questions.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-border bg-card p-10 text-center">
          <p className="text-4xl">📝</p>
          <h3 className="mt-3 font-heading text-lg font-bold text-text">
            Este quiz todavía no tiene preguntas
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Crea la primera manualmente o importa un archivo Moodle XML / JSON.
          </p>
          <Button
            type="button"
            variant="primary"
            className="mt-4"
            onClick={() => {
              setEditingQuestion(null);
              setEditorOpen(true);
            }}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Crear primera pregunta
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={questions.map((question) => question.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {questions.map((question, index) => (
                <SortableQuestionCard
                  key={question.id}
                  question={question}
                  index={index}
                  busy={busy}
                  onEdit={(selected) => {
                    setEditingQuestion(selected);
                    setEditorOpen(true);
                  }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editorOpen && (
        <QuestionEditor
          quizId={quizId}
          question={editingQuestion}
          onSaved={handleSaved}
          onClose={() => {
            setEditorOpen(false);
            setEditingQuestion(null);
          }}
        />
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm dark:bg-black/70">
          <div className="my-10 w-full max-w-lg rounded-3xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div>
                <h3 className="text-lg font-heading font-bold text-text">
                  Importar quiz (JSON)
                </h3>
                <p className="mt-1 text-sm text-text-muted">
                  Usa un archivo exportado desde QuizColegio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-xl p-2 text-text-muted hover:bg-surface-alt hover:text-text"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleImport} className="space-y-4 p-5">
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface p-6 text-center transition hover:border-primary hover:bg-primary/5"
                onClick={() => importInputRef.current?.click()}
              >
                <FileJson className="h-8 w-8 text-primary-text" />
                <span className="text-sm font-medium text-text">
                  {importFile ? importFile.name : "Selecciona el archivo .quiz.json"}
                </span>
                <span className="text-xs text-text-muted">
                  Configuración, preguntas e imágenes incluidas
                </span>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) =>
                    setImportFile(event.target.files?.[0] ?? null)
                  }
                />
              </div>

              <label className="flex items-start gap-3 rounded-xl bg-surface-alt p-3 text-sm text-text">
                <input
                  type="checkbox"
                  checked={replaceQuestions}
                  onChange={(event) => setReplaceQuestions(event.target.checked)}
                  className="mt-0.5 rounded border-border text-primary-text focus:ring-primary"
                />
                <span>
                  Reemplazar las preguntas actuales
                  <span className="block text-xs text-text-muted">
                    Si lo dejas desmarcado, las preguntas se agregan al final (merge).
                    No se permite si el quiz ya tiene intentos.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-xl bg-surface-alt p-3 text-sm text-text">
                <input
                  type="checkbox"
                  checked={applyConfig}
                  onChange={(event) => setApplyConfig(event.target.checked)}
                  className="mt-0.5 rounded border-border text-primary-text focus:ring-primary"
                />
                <span>
                  Aplicar también la configuración del archivo
                  <span className="block text-xs text-text-muted">
                    Título, tiempo límite, intentos, modo seguro, etc.
                  </span>
                </span>
              </label>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-soft p-3 text-sm text-danger-text">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setImportOpen(false)}
                  className="px-4 py-2 text-sm text-text-muted hover:text-text"
                >
                  Cancelar
                </button>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={importing}
                  disabled={!importFile || importing}
                >
                  {importing ? "Importando..." : "Importar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
