"use client";

import { useState, use, Suspense } from 'react';
import Link from 'next/link';
import { Mascot, Button, Badge, ProgressBar, EmptyState, ThemeToggle } from '@/components';
import { UploadCloud, FileText, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react';

interface Report {
  preguntasImportadas: number;
  preguntasOmitidas: number;
  advertencias: string[];
  detalles: Array<{
    nombre: string;
    tipo: string;
    estado: string;
    mensaje?: string;
  }>;
}

function ImportarQuizPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [puntajeMaximo, setPuntajeMaximo] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Seleccione un archivo XML');
      return;
    }

    setLoading(true);
    setError('');
    setReport(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/docente/quizzes/' + id + '/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setReport(data.report);
        setPuntajeMaximo(data.puntajeMaximo);
      } else {
        setError(data.error || 'Error al importar archivo');
      }
    } catch {
      setError('Error de red al importar');
    } finally {
      setLoading(false);
    }
  }

  function handleDrag(e: React.DragEvent) {
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave' || e.type === 'drop') {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  }

  return (
    <div className='flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full'>
      {/* Header */}
      <div className='mb-6 flex items-center justify-between'>
        <h1 className='text-2xl font-heading font-bold text-text flex items-center gap-2'>
          <Mascot expression="think" size="sm" />
          Importar Preguntas Moodle XML
        </h1>
        <div className='flex items-center gap-3'>
          <ThemeToggle />
          <Link
            href='/docente'
            className='flex items-center gap-1 text-sm text-primary-text hover:underline'
          >
            <ChevronLeft className="w-4 h-4" /> Volver al panel
          </Link>
        </div>
      </div>

      {error && (
        <div className='mb-6 p-4 bg-danger-soft border border-danger/25 text-danger-text rounded-xl flex items-center gap-3'>
          <AlertCircle className='w-5 h-5' /> {error}
        </div>
      )}

      <div className='mb-6 p-4 bg-warning-soft border border-warning/30 text-warning-text rounded-xl flex items-start gap-3'>
        <AlertCircle className='w-5 h-5 flex-shrink-0 mt-0.5' />
        <p className='text-sm'>
          <strong>Importar este XML reemplaza todas las preguntas del quiz</strong>, incluidas
          las creadas manualmente desde la pestaña «Preguntas». Si el quiz ya tiene intentos,
          las respuestas asociadas a las preguntas eliminadas también se pierden.
        </p>
      </div>

      {/* Upload zone */}
      <div className='bg-card rounded-3xl shadow-lg border-2 border-dashed border-border p-8 text-center mb-8 transition-all'>
        <form onSubmit={handleImport} className='space-y-4'>
          <div
            className={`relative border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer ${
              dragActive
                ? 'border-primary bg-primary/5 scale-[1.02]'
                : 'border-border hover:border-primary hover:bg-primary/5'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type='file'
              accept='.xml'
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
            />

            <div className="flex flex-col items-center justify-center gap-3">
              <div className={`p-4 rounded-full bg-primary/10 transition-colors ${
                dragActive ? 'bg-primary/20 animate-bounce' : ''
              }`}>
                <UploadCloud className='w-10 h-10 text-primary-text' />
              </div>
              <div>
                <label className='block text-lg font-semibold text-text mb-1'>
                  {file ? file.name : 'Arrastra tu archivo XML aquí'}
                </label>
                <p className='text-sm text-text-muted'>
                  Moodle XML compatible (.xml, máx 10MB)
                </p>
              </div>
            </div>
          </div>

          <Button
            type='submit'
            variant={file ? 'primary' : 'secondary'}
            size="lg"
            leftIcon={!loading && file ? <FileText className="w-5 h-5" /> : undefined}
            isLoading={loading}
            disabled={loading || !file}
            className="w-full"
          >
            {loading ? 'Analizando e Importando...' : 'Importar y Actualizar Quiz'}
          </Button>
        </form>
      </div>

      {/* Reporte de importación */}
      {report && (
        <div className='bg-card rounded-3xl shadow-lg border border-border p-8 mb-8'>
          <div className='border-b border-border pb-4 flex justify-between items-center mb-6'>
            <h3 className='text-xl font-heading font-bold text-text flex items-center gap-2'>
              <CheckCircle2 className='w-6 h-6 text-success' />
              Importación completada
            </h3>
            {puntajeMaximo !== null && (
              <Badge variant="success">
                Puntaje base: {puntajeMaximo}
              </Badge>
            )}
          </div>

          {/* Resumen */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-6'>
            <div className='p-4 bg-surface-alt rounded-2xl text-center'>
              <div className='text-3xl font-heading font-bold text-primary-text'>
                {report.preguntasImportadas}
              </div>
              <div className='text-xs text-text-muted'>Preguntas importadas</div>
            </div>
            <div className='p-4 bg-surface-alt rounded-2xl text-center'>
              <div className='text-3xl font-heading font-bold text-warning-text'>
                {report.preguntasOmitidas}
              </div>
              <div className='text-xs text-text-muted'>Omitidas/Errores</div>
            </div>
            <div className='p-4 bg-surface-alt rounded-2xl text-center col-span-2'>
              <ProgressBar
                value={report.preguntasImportadas}
                max={report.preguntasImportadas + report.preguntasOmitidas}
                label="Éxito"
                showValue
                color="gradient"
                striped
              />
            </div>
          </div>

          {/* Advertencias */}
          {report.advertencias.length > 0 && (
            <div className='mb-6'>
              <h4 className='text-sm font-semibold text-warning-text mb-3 flex items-center gap-2'>
                <AlertCircle className='w-4 h-4' />
                Advertencias
              </h4>
              <ul className='list-disc pl-5 space-y-2 text-sm text-warning-text bg-warning-soft/60 p-4 rounded-xl'>
                {report.advertencias.map((adv, idx) => (
                  <li key={idx}>{adv}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Detalle */}
          <div>
            <h4 className='text-sm font-semibold text-text-muted mb-3'>
              Detalle por Pregunta
            </h4>
            <div className='border border-border rounded-xl overflow-hidden max-h-80 overflow-y-auto'>
              <table className='w-full text-left border-collapse text-sm'>
                <thead className='bg-surface-alt border-b border-border text-text-muted'>
                  <tr>
                    <th className='p-3'>Nombre</th>
                    <th className='p-3'>Tipo Moodle</th>
                    <th className='p-3'>Estado</th>
                    <th className='p-3'>Mensaje</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-border'>
                  {report.detalles.map((d, idx) => (
                    <tr key={idx} className='hover:bg-surface-alt/50 transition'>
                      <td className='p-3 font-medium text-text'>{d.nombre}</td>
                      <td className='p-3 text-text-muted'>{d.tipo}</td>
                      <td className='p-3'>
                        <Badge
                          variant={
                            d.estado === 'IMPORTADA'
                              ? 'success'
                              : d.estado === 'UNSUPPORTED'
                              ? 'warning'
                              : 'danger'
                          }
                        >
                          {d.estado}
                        </Badge>
                      </td>
                      <td className='p-3 text-text-muted'>{d.mensaje || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!report && !file && (
        <EmptyState
          title="Necesitas un archivo XML"
          description="Importa preguntas desde Moodle XML usando el formulario arriba."
          emoji="📂"
          variant="search"
        />
      )}
    </div>
  );
}

export default function ImportarQuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-8 text-center"><Mascot expression="think" size="lg" /> <p className="text-text-muted mt-4">Cargando...</p></div>}>
      <ImportarQuizPageContent params={params} />
    </Suspense>
  );
}
