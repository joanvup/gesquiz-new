"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ListChecks, Settings } from "lucide-react";
import { Mascot, ThemeToggle } from "@/components";
import { QuizQuestionsTab } from "@/components/questions/QuizQuestionsTab";
import QuizForm from "../../nuevo/page";

type EditorTab = "config" | "questions";

function EditorTabs({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState<EditorTab>("config");

  const tabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
      active
        ? "bg-primary text-primary-foreground shadow"
        : "text-text-muted hover:bg-surface-alt hover:text-text"
    }`;

  return (
    <div className="flex-1">
      <div className="mx-auto w-full max-w-4xl px-4 pt-6 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/docente"
            className="flex items-center gap-1 text-sm text-primary-text hover:underline"
          >
            <ChevronLeft className="h-4 w-4" /> Volver al panel
          </Link>
          <ThemeToggle />
        </div>

        <div
          role="tablist"
          aria-label="Editor del quiz"
          className="mt-4 flex gap-2 rounded-2xl border border-border bg-card p-1.5 shadow-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "config"}
            onClick={() => setTab("config")}
            className={tabClass(tab === "config")}
          >
            <Settings className="h-4 w-4" /> Configuración
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "questions"}
            onClick={() => setTab("questions")}
            className={tabClass(tab === "questions")}
          >
            <ListChecks className="h-4 w-4" /> Preguntas
          </button>
        </div>
      </div>

      {/* Configuración: se mantiene montada para no perder cambios al cambiar de pestaña. */}
      <div className={tab === "config" ? "" : "hidden"}>
        <QuizForm params={params} embedded />
      </div>

      {tab === "questions" && (
        <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8">
          <QuizQuestionsTab quizId={id} />
        </div>
      )}
    </div>
  );
}

export default function EditarQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center">
          <Mascot expression="think" size="lg" />
          <p className="mt-4 text-text-muted">Cargando editor...</p>
        </div>
      }
    >
      <EditorTabs params={params} />
    </Suspense>
  );
}
