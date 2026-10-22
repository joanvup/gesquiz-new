import Link from "next/link";
import { Mascot } from "@/components";
import { Play } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background overflow-hidden">
      <div className="relative">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-64 h-64 bg-accent-teal/5 rounded-full blur-3xl" />

        <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-20">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Mascota animada */}
            <div className="mb-6">
              <Mascot expression="cheer" size="lg" animate />
            </div>

            <h1 className="text-5xl md:text-6xl font-heading font-extrabold text-primary bg-clip-text bg-gradient-to-r from-primary via-accent-teal to-accent-pink text-transparent bg-300%">
              QuizColegio
            </h1>

            <p className="text-xl md:text-2xl text-text-muted max-w-2xl mx-auto">
              Aprende y pon a prueba tus conocimientos con quizzes interactivos,
              importa fácilmente desde Moodle XML y juega con gamificación.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/login" passHref>
                <button className="flex items-center justify-center gap-2 px-8 py-4 bg-wayground-gradient text-white rounded-3xl font-heading font-bold text-xl shadow-2xl hover:shadow-3xl hover:-translate-y-1 transition-all duration-300 animate-pop-in">
                  <Play className="w-6 h-6" />
                  Comenzar a aprender
                </button>
              </Link>
            </div>

            <p className="text-xs text-text-soft mt-8">
              Prueba con las credenciales de la academia:{" "}
              <span className="font-medium">
                docente@quizcolegio.test / estudiante1@quizcolegio.test
              </span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
