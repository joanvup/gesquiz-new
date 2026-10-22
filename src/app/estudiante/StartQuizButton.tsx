"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components";
import { Play, ArrowRight } from "lucide-react";

interface StartQuizButtonProps {
  quizId: string;
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  fullWidth?: boolean;
}

export function StartQuizButton({
  quizId,
  size = "lg",
  label = "Iniciar Quiz",
  fullWidth = false,
}: StartQuizButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      const res = await fetch(`/api/estudiante/quizzes/${quizId}/intentos`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success && data.attempt) {
        if (data.sessionToken) {
          sessionStorage.setItem(`attempt_token_${data.attempt.id}`, data.sessionToken);
        }
        router.push(`/estudiante/quizzes/${quizId}/intentos/${data.attempt.id}/presentar`);
      } else {
        alert(data.error || "Error al iniciar intento");
        setLoading(false);
      }
    } catch {
      alert("Error de red");
      setLoading(false);
    }
  }

  return (
    <Button
      variant="play"
      size={size}
      isLoading={loading}
      leftIcon={!loading && <Play className="w-6 h-6" />}
      rightIcon={!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
      className={`${fullWidth ? "w-full" : ""} group`}
      onClick={handleStart}
    >
      {loading ? "Preparando..." : label}
    </Button>
  );
}

export function ResumeQuizButton({ quizId, attemptId }: { quizId: string; attemptId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleResume() {
    setLoading(true);
    try {
      const res = await fetch(`/api/estudiante/intentos/${attemptId}`);
      const data = await res.json();
      if (data.attempt) {
        const token = sessionStorage.getItem(`attempt_token_${attemptId}`);
        if (token) {
          // Re-use token
        }
        router.push(`/estudiante/quizzes/${quizId}/intentos/${attemptId}/presentar`);
      }
    } catch {
      alert("Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="md"
      isLoading={loading}
      leftIcon={<RotateCw className="w-5 h-5" />}
      onClick={handleResume}
    >
      {loading ? "Cargando..." : "Continuar"}
    </Button>
  );
}
