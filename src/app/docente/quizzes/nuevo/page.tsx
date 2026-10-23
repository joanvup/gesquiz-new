'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mascot, Button, ThemeToggle } from '@/components';
import { Save, AlertCircle } from 'lucide-react';

interface QuizFormProps {
  params: Promise<{ id?: string }>;
  /** Oculta la cabecera propia cuando se muestra dentro de las pestañas del editor. */
  embedded?: boolean;
}

interface QuizData {
  id: string;
  titulo: string;
  descripcion?: string | null;
  instrucciones?: string | null;
  tiempoLimiteMinutos?: number | null;
  intentosPermitidos: number;
  ventanaAbre?: string | null;
  ventanaCierra?: string | null;
  mostrarResultado: string;
  maxInfracciones: number;
  publicado: boolean;
  permitirRetroceso: boolean;
  advertirAlContinuar: boolean;
  ordenAleatorioPreguntas: boolean;
  ordenAleatorioOpciones: boolean;
  modoSeguro: boolean;
}

function QuizFormContent({ params, embedded = false }: QuizFormProps) {
  const { id } = use(params || { id: undefined });
  const isEdit = Boolean(id);
  const router = useRouter();

  // Estado del formulario
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [instrucciones, setInstrucciones] = useState('');
  const [permitirRetroceso, setPermitirRetroceso] = useState(true);
  const [advertirAlContinuar, setAdvertirAlContinuar] = useState(false);
  const [tiempoLimiteMinutos, setTiempoLimiteMinutos] = useState('');
  const [ordenAleatorioPreguntas, setOrdenAleatorioPreguntas] = useState(false);
  const [ordenAleatorioOpciones, setOrdenAleatorioOpciones] = useState(false);
  const [intentosPermitidos, setIntentosPermitidos] = useState('1');
  const [ventanaAbre, setVentanaAbre] = useState('');
  const [ventanaCierra, setVentanaCierra] = useState('');
  const [mostrarResultado, setMostrarResultado] = useState('NOTA');
  const [modoSeguro, setModoSeguro] = useState(true);
  const [maxInfracciones, setMaxInfracciones] = useState('3');
  const [publicado, setPublicado] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);

  // Cargar datos si es edición
  useEffect(() => {
    if (!id) return;

    fetch('/api/docente/quizzes/' + id)
      .then((res) => res.json())
      .then((data) => {
        if (data.quiz) {
          const q: QuizData = data.quiz;
          setTitulo(q.titulo || '');
          setDescripcion(q.descripcion || '');
          setInstrucciones(q.instrucciones || '');
          setPermitirRetroceso(q.permitirRetroceso);
          setAdvertirAlContinuar(q.advertirAlContinuar ?? false);
          setTiempoLimiteMinutos(q.tiempoLimiteMinutos ? q.tiempoLimiteMinutos.toString() : '');
          setOrdenAleatorioPreguntas(q.ordenAleatorioPreguntas);
          setOrdenAleatorioOpciones(q.ordenAleatorioOpciones);
          setIntentosPermitidos(q.intentosPermitidos ? q.intentosPermitidos.toString() : '1');
          setVentanaAbre(q.ventanaAbre ? q.ventanaAbre.substring(0, 16) : '');
          setVentanaCierra(q.ventanaCierra ? q.ventanaCierra.substring(0, 16) : '');
          setMostrarResultado(q.mostrarResultado || 'NOTA');
          setModoSeguro(q.modoSeguro);
          setMaxInfracciones(q.maxInfracciones ? q.maxInfracciones.toString() : '3');
          setPublicado(q.publicado);
        } else {
          setError(data.error || 'Quiz no encontrado');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Error al cargar quiz');
        setLoading(false);
      });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const body: Record<string, unknown> = {
      titulo,
      descripcion: descripcion || null,
      instrucciones: instrucciones || null,
      permitirRetroceso,
      advertirAlContinuar,
      tiempoLimiteMinutos: tiempoLimiteMinutos ? parseInt(tiempoLimiteMinutos) : null,
      ordenAleatorioPreguntas,
      ordenAleatorioOpciones,
      intentosPermitidos: parseInt(intentosPermitidos) || 1,
      ventanaAbre: ventanaAbre ? new Date(ventanaAbre).toISOString() : null,
      ventanaCierra: ventanaCierra ? new Date(ventanaCierra).toISOString() : null,
      mostrarResultado,
      modoSeguro,
      maxInfracciones: parseInt(maxInfracciones) || 3,
      publicado,
    };

    try {
      const res = await fetch(isEdit ? `/api/docente/quizzes/${id}` : '/api/docente/quizzes', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        router.push('/docente');
      } else {
        setError(data.error || (isEdit ? 'Error al actualizar' : 'Error al crear quiz'));
        setSaving(false);
      }
    } catch {
      setError('Error de red');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className={
          embedded
            ? 'w-full px-4 py-8 md:px-8'
            : 'flex-1 p-8 max-w-4xl mx-auto w-full'
        }
      >
        <div className="text-center text-text-muted">
          <Mascot expression="think" size="lg" />
          <p className="mt-4">Cargando quiz...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        embedded
          ? 'w-full px-4 py-6 md:px-8'
          : 'flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full'
      }
    >
      {/* Header (oculto cuando el formulario vive dentro de las pestañas) */}
      {!embedded && (
        <div className='mb-6 flex items-center justify-between'>
          <h1 className='text-2xl font-heading font-bold text-text flex items-center gap-2'>
            <Mascot expression="think" size="sm" />
            {isEdit ? 'Configurar Quiz' : 'Crear Nuevo Quiz'}
          </h1>
          <div className='flex items-center gap-3'>
            <ThemeToggle />
            <Link
              href='/docente'
              className='flex items-center gap-1 text-sm text-primary-text hover:underline'
            >
              ← Volver al panel
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className='mb-6 p-4 bg-danger-soft border border-danger/25 text-danger-text rounded-xl flex items-center gap-3'>
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className='bg-card rounded-3xl shadow-lg border border-border p-6 md:p-8 space-y-6'
      >
        {/* Título */}
        <div>
          <label className='block text-sm font-medium text-text mb-2'>
            Título *
          </label>
          <input
            type='text'
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className='w-full px-4 py-3 border-2 border-border rounded-2xl text-base bg-surface focus:outline-none focus:border-primary transition-colors'
            placeholder="Ej: Geometría Básica"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className='block text-sm font-medium text-text mb-2'>
            Descripción
          </label>
          <textarea
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className='w-full px-4 py-3 border-2 border-border rounded-2xl text-base bg-surface focus:outline-none focus:border-primary transition-colors resize-none'
            placeholder="Una breve descripción del quiz..."
          />
        </div>

        {/* Instrucciones */}
        <div>
          <label className='block text-sm font-medium text-text mb-2'>
            Instrucciones
          </label>
          <textarea
            rows={3}
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
            className='w-full px-4 py-3 border-2 border-border rounded-2xl text-base bg-surface focus:outline-none focus:border-primary transition-colors resize-none'
            placeholder="Instrucciones para los estudiantes..."
          />
        </div>

        {/* Grid de configuración */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <label className='block text-sm font-medium text-text mb-2'>
              Tiempo límite (minutos)
            </label>
            <input
              type='number'
              placeholder='Ej. 30 (vacío = sin límite)'
              value={tiempoLimiteMinutos}
              onChange={(e) => setTiempoLimiteMinutos(e.target.value)}
              min={1}
              className='w-full px-4 py-3 border-2 border-border rounded-2xl text-base bg-surface focus:outline-none focus:border-primary transition-colors'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-text mb-2'>
              Intentos permitidos
            </label>
            <input
              type='number'
              min={1}
              value={intentosPermitidos}
              onChange={(e) => setIntentosPermitidos(e.target.value)}
              className='w-full px-4 py-3 border-2 border-border rounded-2xl text-base bg-surface focus:outline-none focus:border-primary transition-colors'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-text mb-2'>
              Ventana abre
            </label>
            <input
              type='datetime-local'
              value={ventanaAbre}
              onChange={(e) => setVentanaAbre(e.target.value)}
              className='w-full px-4 py-3 border-2 border-border rounded-2xl text-base bg-surface focus:outline-none focus:border-primary transition-colors'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-text mb-2'>
              Ventana cierra
            </label>
            <input
              type='datetime-local'
              value={ventanaCierra}
              onChange={(e) => setVentanaCierra(e.target.value)}
              className='w-full px-4 py-3 border-2 border-border rounded-2xl text-base bg-surface focus:outline-none focus:border-primary transition-colors'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-text mb-2'>
              Mostrar resultado
            </label>
            <select
              value={mostrarResultado}
              onChange={(e) => setMostrarResultado(e.target.value)}
              className='w-full px-4 py-3 border-2 border-border rounded-2xl text-base bg-surface focus:outline-none focus:border-primary transition-colors'
            >
              <option value='NOTA'>Solo Nota</option>
              <option value='NOTA_Y_RESPUESTAS'>Nota y Respuestas</option>
              <option value='NADA'>Nada</option>
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium text-text mb-2'>
              Máx. infracciones modo seguro
            </label>
            <input
              type='number'
              min={1}
              value={maxInfracciones}
              onChange={(e) => setMaxInfracciones(e.target.value)}
              className='w-full px-4 py-3 border-2 border-border rounded-2xl text-base bg-surface focus:outline-none focus:border-primary transition-colors'
            />
          </div>
        </div>

        {/* Checkboxes */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <label className='flex items-center gap-3 text-sm text-text bg-surface-alt p-3 rounded-xl hover:bg-primary/5 transition cursor-pointer'>
            <input
              type='checkbox'
              checked={permitirRetroceso}
              onChange={(e) => setPermitirRetroceso(e.target.checked)}
              className='rounded border-border text-primary-text focus:ring-primary'
            />
            Permitir retroceso entre preguntas
          </label>

          <label
            className={`flex items-start gap-3 text-sm text-text bg-surface-alt p-3 rounded-xl transition ${
              permitirRetroceso
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:bg-primary/5 cursor-pointer'
            }`}
          >
            <input
              type='checkbox'
              checked={advertirAlContinuar}
              onChange={(e) => setAdvertirAlContinuar(e.target.checked)}
              disabled={permitirRetroceso}
              className='mt-0.5 rounded border-border text-primary-text focus:ring-primary disabled:cursor-not-allowed'
            />
            <span>
              Mostrar advertencia al continuar
              <span className='block text-xs text-text-muted'>
                Solo aplica cuando el retroceso está desactivado.
              </span>
            </span>
          </label>

          <label className='flex items-center gap-3 text-sm text-text bg-surface-alt p-3 rounded-xl hover:bg-primary/5 transition cursor-pointer'>
            <input
              type='checkbox'
              checked={ordenAleatorioPreguntas}
              onChange={(e) => setOrdenAleatorioPreguntas(e.target.checked)}
              className='rounded border-border text-primary-text focus:ring-primary'
            />
            Orden aleatorio de preguntas
          </label>

          <label className='flex items-center gap-3 text-sm text-text bg-surface-alt p-3 rounded-xl hover:bg-primary/5 transition cursor-pointer'>
            <input
              type='checkbox'
              checked={ordenAleatorioOpciones}
              onChange={(e) => setOrdenAleatorioOpciones(e.target.checked)}
              className='rounded border-border text-primary-text focus:ring-primary'
            />
            Orden aleatorio de opciones
          </label>

          <label className='flex items-center gap-3 text-sm text-text bg-surface-alt p-3 rounded-xl hover:bg-primary/5 transition cursor-pointer'>
            <input
              type='checkbox'
              checked={modoSeguro}
              onChange={(e) => setModoSeguro(e.target.checked)}
              className='rounded border-border text-primary-text focus:ring-primary'
            />
            Activar modo seguro anti-copia
          </label>

          <label className='flex items-center gap-3 text-sm font-semibold text-text bg-primary/5 p-3 rounded-xl hover:bg-primary/10 transition cursor-pointer md:col-span-2'>
            <input
              type='checkbox'
              checked={publicado}
              onChange={(e) => setPublicado(e.target.checked)}
              className='rounded border-primary text-primary-text focus:ring-primary'
            />
            Publicar quiz (visible para estudiantes asignados)
          </label>
        </div>

        {/* Footer */}
        <div className='flex justify-end gap-4 pt-6 border-t border-border'>
          <Link
            href='/docente'
            className='px-4 py-2 text-text-muted hover:text-text transition'
          >
            Cancelar
          </Link>
          <Button
            type='submit'
            variant="primary"
            isLoading={saving}
            leftIcon={<Save className="w-5 h-5" />}
          >
            {saving
              ? 'Guardando...'
              : isEdit ? 'Guardar Cambios' : 'Crear Quiz'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function QuizForm({ params, embedded }: QuizFormProps) {
  return <QuizFormContent params={params} embedded={embedded} />;
}

// Re-export for dynamic route compatibility
export function NuevoQuizPage({
  params = {} as never,
  embedded = false,
}: {
  params?: Promise<{ id?: string }>;
  embedded?: boolean;
}) {
  // Handle both nuevo and editar cases
  return (
    <QuizFormContent params={params || Promise.resolve({})} embedded={embedded} />
  );
}
