// No "use client" aquí. Es un Server Component.
import { getSessionUser, destroySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Suspense } from "react";
import Link from "next/link";
import { StartQuizButton, ResumeQuizButton } from "./StartQuizButton";
import { Mascot, Badge, ProgressBar, EmptyState, Button, ThemeToggle } from "@/components";
import { BookOpen, Trophy, Timer, CheckCircle2 } from "lucide-react";

async function EstudianteContent() {
  const user = await getSessionUser();
  if (!user || user.role !== "STUDENT") {
    redirect("/login");
  }

  async function logoutAction() {
    "use server";
    await destroySession();
    redirect("/login");
  }

  const memberships = await db.groupMember.findMany({
    where: { userId: user.id },
    select: { groupId: true },
  });
  const groupIds = memberships.map(m => m.groupId);

  const assignments = await db.quizAssignment.findMany({
    where: {
      OR: [
        { studentId: user.id },
        { groupId: { in: groupIds } },
      ],
    },
    select: { quizId: true },
  });
  const quizIds = Array.from(new Set(assignments.map(a => a.quizId)));

  const quizzes = await db.quiz.findMany({
    where: {
      id: { in: quizIds },
      publicado: true,
    },
    include: {
      attempts: {
        where: { studentId: user.id },
        orderBy: { numeroAttempt: 'desc' },
      },
      _count: {
        select: { questions: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();

  return (
    <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-4 bg-card p-6 rounded-3xl shadow-lg border border-border mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="shrink-0 bg-primary/10 rounded-full p-2">
            <Mascot expression="wave" size="md" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-heading font-bold text-text sm:text-2xl">Panel del Estudiante</h1>
            <p className="text-text-muted">
              ¡Hola, <span className="font-semibold text-primary-text">{user.name}</span>!
              <span className="block text-sm break-all sm:inline"> ({user.email})</span>
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <ThemeToggle />
          <form action={logoutAction}>
            <Button variant="ghost" size="md" type="submit">
              Cerrar Sesión
            </Button>
          </form>
        </div>
      </div>

      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-6 h-6 text-primary-text" />
        <h2 className="text-xl font-heading font-bold text-text">Tus Quizzes Asignados</h2>
      </div>

      {quizzes.length === 0 ? (
        <EmptyState
          title="No hay quizzes asignados"
          description="Cuando tus docentes te asignen cuestionarios, aparecerán aquí."
          emoji="📚"
          variant="default"
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map(quiz => {
            const activeAttempt = quiz.attempts.find(a => a.status === 'EN_CURSO');
            const validAttempts = quiz.attempts.filter(a => a.status !== 'ANULADO');
            const attemptsCount = validAttempts.length;
            const canAttempt = attemptsCount < quiz.intentosPermitidos;

            let windowOpen = true;
            if (quiz.ventanaAbre && now < new Date(quiz.ventanaAbre)) windowOpen = false;
            if (quiz.ventanaCierra && now > new Date(quiz.ventanaCierra)) windowOpen = false;

            const latestAttempt = quiz.attempts[0];
            const isCompleted = latestAttempt && (latestAttempt.status === 'CALIFICADO' || latestAttempt.status === 'ENVIADO' || latestAttempt.status === 'ANULADO');

            return (
              <div key={quiz.id} className="bg-card border border-border hover:shadow-xl hover:-translate-y-1 transition-all duration-200 rounded-3xl p-6 flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-heading font-bold text-text text-lg">{quiz.titulo}</h3>
                  <Badge variant={quiz.publicado ? "success" : "warning"}>
                    {quiz.publicado ? "Publicado" : "Borrador"}
                  </Badge>
                </div>
                <p className="text-text-muted text-sm mb-4 line-clamp-2">
                  {quiz.descripcion || 'Sin descripción'}
                </p>

                {/* Stats */}
                <div className="space-y-2 text-sm text-text-muted mb-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" /> Preguntas
                    </span>
                    <span className="font-semibold text-text">{quiz._count.questions}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Trophy className="w-4 h-4" /> Puntaje máximo
                    </span>
                    <span className="font-semibold text-text">{quiz.puntajeMaximo}</span>
                  </div>
                  {quiz.tiempoLimiteMinutos && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Timer className="w-4 h-4" /> Tiempo límite
                      </span>
                      <span className="font-semibold text-text">{quiz.tiempoLimiteMinutos} min</span>
                    </div>
                  )}
                </div>

                {/* Estado del intento */}
                {activeAttempt && (
                  <Badge variant="warning" className="mb-2 justify-center">
                    Intento en curso
                  </Badge>
                )}
                {latestAttempt && (
                  <div className="text-xs text-text-muted mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" />
                    Último estado:{" "}
                    <span className={`font-medium ${
                      latestAttempt.status === 'CALIFICADO' ? 'text-success-text' : 'text-warning-text'
                    }`}>
                      {latestAttempt.status}
                    </span>
                    {latestAttempt.score !== null && (
                      <span className="text-primary-text font-bold">
                        ({latestAttempt.score}/{quiz.puntajeMaximo})
                      </span>
                    )}
                  </div>
                )}

                {/* Intentos */}
                <ProgressBar
                  value={attemptsCount}
                  max={quiz.intentosPermitidos}
                  label={`Intentos: ${attemptsCount}/${quiz.intentosPermitidos}`}
                  color="gradient"
                  animated
                  showValue
                  className="mt-auto mb-4"
                />

                {/* Acción */}
                <div className="mt-2">
                  {activeAttempt ? (
                    <ResumeQuizButton quizId={quiz.id} attemptId={activeAttempt.id} />
                  ) : canAttempt && windowOpen ? (
                    <StartQuizButton quizId={quiz.id} fullWidth />
                  ) : isCompleted ? (
                    <Link href={`/estudiante/quizzes/${quiz.id}/intentos/${latestAttempt.id}/presentar`}>
                      <Button variant="secondary" size="lg" className="w-full">
                        Ver Resultados
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="secondary" size="lg" className="w-full" disabled>
                      {!windowOpen ? 'Fuera de ventana de tiempo' : 'Intentos agotados'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EstudianteDashboard() {
  return (
    <Suspense fallback={<div className="p-8 text-center"><Mascot expression="happy" size="lg" /> <p className="text-text-muted mt-4">Cargando quizzes...</p></div>}>
      <EstudianteContent />
    </Suspense>
  );
}
