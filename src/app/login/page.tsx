"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot, Button, ThemeToggle } from "@/components";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // e.currentTarget deja de ser válido después del primer await
    const form = e.currentTarget as HTMLFormElement;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al iniciar sesión");
      }

      // Feedback animado
      setTimeout(() => {
        if (data.user.role === "ADMIN") {
          router.push("/admin");
        } else if (data.user.role === "TEACHER") {
          router.push("/docente");
        } else {
          router.push("/estudiante");
        }
        router.refresh();
      }, 300);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
      // Animación de error
      form.classList.add("animate-shake");
      setTimeout(() => form.classList.remove("animate-shake"), 600);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface relative overflow-hidden">
      <ThemeToggle className="absolute top-4 right-4 z-20" />
      {/* Fondos decorativos */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 translate-y-1/3 w-80 h-80 bg-accent-teal/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-5xl">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Hero */}
          <div className="text-center md:text-left space-y-6">
            <Mascot expression="wave" size="lg" />
            <h1 className="text-4xl font-heading font-bold text-primary-text">
              ¡Bienvenido a QuizColegio!
            </h1>
            <p className="text-text-muted">
              Ingresa con tu cuenta para acceder a tus quizzes y comenzar a aprender.
            </p>
          </div>

          {/* Formulario */}
          <div>
            <div className="bg-card rounded-3xl shadow-2xl border border-border p-8">
              <h2 className="text-2xl font-heading font-bold text-center text-text mb-6">
                Iniciar Sesión
              </h2>

              {error && (
                <div className="mb-4 p-4 bg-danger-soft border border-danger/25 text-danger-text rounded-xl flex items-center gap-3">
                  <span className="text-xl">⚠️</span>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className="w-full px-4 py-3 border-2 border-border rounded-2xl text-base focus:outline-none focus:border-primary transition-colors bg-surface"
                      placeholder="nombre@ejemplo.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full px-4 py-3 border-2 border-border rounded-2xl pr-12 text-base focus:outline-none focus:border-primary transition-colors bg-surface"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={loading}
                  leftIcon={<LogIn className="w-5 h-5" />}
                  className="w-full"
                >
                  Entrar
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-border text-center">
                <p className="text-xs text-text-soft space-y-1">
                  <span>Credenciales de prueba:</span>
                  <br />
                  <span className="font-medium text-text">📚 Docente:</span>{" "}
                  docente@quizcolegio.test / Docente123!
                  <br />
                  <span className="font-medium text-text">🎓 Estudiante:</span>{" "}
                  estudiante1@quizcolegio.test / Estudiante123!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
