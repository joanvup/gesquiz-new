"use client";

import { Suspense } from "react";
import QuizForm from "../../nuevo/page";

export default function EditarQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando...</div>}>
      <QuizForm params={params} />
    </Suspense>
  );
}
