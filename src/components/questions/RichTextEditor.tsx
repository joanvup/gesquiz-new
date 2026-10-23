"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code2,
  Link2,
  ImagePlus,
  Undo2,
  Redo2,
  Loader2,
  Check,
  X,
} from "lucide-react";

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  quizId: string;
  placeholder?: string;
  /** Oculta las herramientas avanzadas (se usa en las opciones de respuesta). */
  compact?: boolean;
  disabled?: boolean;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        isActive
          ? "bg-primary/15 text-primary-text"
          : "text-text-muted hover:bg-surface-alt hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Editor de texto enriquecido (Tiptap) con insercion de imagenes:
 * - Subida al servidor del quiz (`/api/docente/quizzes/[id]/images`).
 * - URL externa (http/https).
 */
export function RichTextEditor({
  value,
  onChange,
  quizId,
  placeholder = "Escribe aquí...",
  compact = false,
  disabled = false,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState("");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      editable: !disabled,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          link: {
            openOnClick: false,
            autolink: true,
            HTMLAttributes: { rel: "noopener noreferrer" },
          },
        }),
        Image.configure({
          inline: false,
          allowBase64: true,
          HTMLAttributes: { class: "rich-image" },
        }),
        Placeholder.configure({ placeholder }),
      ],
      content: value || "",
      editorProps: {
        attributes: {
          class: `rich-content editor-content focus:outline-none ${
            compact ? "min-h-[56px] px-3 py-2 text-sm" : "min-h-[140px] px-4 py-3"
          }`,
        },
      },
      onUpdate: ({ editor: current }) => {
        onChangeRef.current(current.getHTML());
      },
    },
    []
  );

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-text-muted">
        Cargando editor...
      </div>
    );
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/docente/quizzes/${quizId}/images`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "No se pudo subir la imagen");
        return;
      }

      editor
        ?.chain()
        .focus()
        .setImage({ src: data.image.url, alt: file.name })
        .run();
    } catch {
      setError("Error de red al subir la imagen");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function insertExternalImage() {
    const url = urlValue.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError("La URL debe comenzar por http:// o https://");
      return;
    }
    setError("");
    editor?.chain().focus().setImage({ src: url }).run();
    setUrlValue("");
    setShowUrlInput(false);
  }

  function promptLink() {
    const previous = editor?.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL del enlace (vacío para quitarlo)", previous ?? "https://");
    if (url === null) return;

    const chain = editor?.chain().focus();
    if (!chain) return;

    if (!url.trim()) {
      chain.extendMarkRange("link").unsetLink().run();
      return;
    }

    if (!/^https?:\/\//i.test(url)) {
      setError("El enlace debe comenzar por http:// o https://");
      return;
    }

    chain.extendMarkRange("link").setLink({ href: url }).run();
  }

  const chain = () => editor.chain().focus();

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-alt/60 px-2 py-1.5">
        <ToolbarButton title="Negrita" isActive={editor.isActive("bold")} onClick={() => chain().toggleBold().run()}>
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Cursiva" isActive={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()}>
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Subrayado" isActive={editor.isActive("underline")} onClick={() => chain().toggleUnderline().run()}>
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Tachado" isActive={editor.isActive("strike")} onClick={() => chain().toggleStrike().run()}>
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>

        {!compact && (
          <>
            <span className="mx-1 h-5 w-px bg-border" />
            <ToolbarButton
              title="Título"
              isActive={editor.isActive("heading", { level: 2 })}
              onClick={() => chain().toggleHeading({ level: 2 }).run()}
            >
              <span className="text-xs font-bold">H2</span>
            </ToolbarButton>
            <ToolbarButton
              title="Subtítulo"
              isActive={editor.isActive("heading", { level: 3 })}
              onClick={() => chain().toggleHeading({ level: 3 }).run()}
            >
              <span className="text-xs font-bold">H3</span>
            </ToolbarButton>
          </>
        )}

        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton title="Lista" isActive={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()}>
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton title="Lista numerada" isActive={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()}>
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        {!compact && (
          <>
            <ToolbarButton title="Cita" isActive={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()}>
              <Quote className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Código" isActive={editor.isActive("code")} onClick={() => chain().toggleCode().run()}>
              <Code2 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Enlace" isActive={editor.isActive("link")} onClick={promptLink}>
              <Link2 className="w-4 h-4" />
            </ToolbarButton>
          </>
        )}

        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          title="Subir imagen"
          disabled={uploading || disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        </ToolbarButton>
        <ToolbarButton
          title="Insertar imagen por URL"
          isActive={showUrlInput}
          onClick={() => setShowUrlInput((previous) => !previous)}
        >
          <span className="text-[10px] font-bold leading-none">URL</span>
        </ToolbarButton>

        {!compact && (
          <>
            <span className="mx-1 h-5 w-px bg-border" />
            <ToolbarButton title="Deshacer" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}>
              <Undo2 className="w-4 h-4" />
            </ToolbarButton>
            <ToolbarButton title="Rehacer" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}>
              <Redo2 className="w-4 h-4" />
            </ToolbarButton>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadImage(file);
          }}
        />
      </div>

      {showUrlInput && (
        <div className="flex items-center gap-2 border-b border-border bg-info-soft/40 px-3 py-2">
          <input
            type="url"
            value={urlValue}
            onChange={(event) => setUrlValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                insertExternalImage();
              }
            }}
            placeholder="https://ejemplo.com/imagen.png"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text focus:outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={insertExternalImage}
            className="rounded-lg bg-primary p-1.5 text-primary-foreground hover:brightness-110"
            title="Insertar imagen"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowUrlInput(false);
              setUrlValue("");
            }}
            className="rounded-lg border border-border p-1.5 text-text-muted hover:bg-surface-alt"
            title="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <p className="border-b border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger-text">
          {error}
        </p>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
