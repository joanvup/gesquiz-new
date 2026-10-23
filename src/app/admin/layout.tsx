import { Suspense, type ReactNode } from "react";
import { Mascot } from "@/components";
import { requireAdminPage } from "@/lib/admin";
import { AdminShell } from "./AdminShell";

async function AdminGate({ children }: { children: ReactNode }) {
  const user = await requireAdminPage();

  return (
    <AdminShell user={{ name: user.name, email: user.email }}>
      {children}
    </AdminShell>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-text-muted">
            <Mascot expression="think" size="lg" />
            <p className="mt-4">Cargando panel de administración...</p>
          </div>
        </div>
      }
    >
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
