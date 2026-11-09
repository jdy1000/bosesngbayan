"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  MessageSquareQuote,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table,
  Underline,
  Undo2,
  Video,
} from "lucide-react";
import { richTextExtensions } from "@/lib/rich-text/extensions";
import { MediaPicker, type PickedMedia } from "@/components/studio/media-picker";

/**
 * Shared TipTap editor for articles and pages. Holds the document JSON in a hidden input `name`
 * (set imperatively to avoid re-rendering on every keystroke). The server re-renders and sanitizes
 * the JSON on save (src/lib/rich-text/render.ts); nothing produced here is trusted as HTML.
 */
export function RichTextEditor({
  name,
  initialContent,
  onChange,
  disabled = false,
  label = "Content",
}: {
  name: string;
  initialContent: unknown;
  onChange?: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: richTextExtensions(),
    content: initialContent as object,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-bnb min-h-[420px] px-5 py-4 focus:outline-none",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
      },
    },
    onUpdate: ({ editor: e }) => {
      if (inputRef.current) inputRef.current.value = JSON.stringify(e.getJSON());
      onChange?.();
    },
  });

  return (
    <div className="rounded-xl border border-line bg-paper focus-within:border-brand">
      <input ref={inputRef} type="hidden" name={name} defaultValue={JSON.stringify(initialContent)} />
      {editor && !disabled && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
      {!editor && <p className="px-5 py-4 text-sm text-muted">Loading editor…</p>}
    </div>
  );
}

function isSafeHref(raw: string): boolean {
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(raw)) return true;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

const YOUTUBE_URL = /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\/\S+$/i;

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      h4: e.isActive("heading", { level: 4 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote") && !e.isActive("blockquote", { variant: "pull" }),
      pull: e.isActive("blockquote", { variant: "pull" }),
      table: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const [imageOpen, setImageOpen] = useState(false);
  const c = () => editor.chain().focus();

  function setLink() {
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    const raw = window.prompt("Link URL (https://… or mailto:…). Leave blank to remove the link.", prev);
    if (raw === null) return;
    const href = raw.trim();
    if (!href) return void c().extendMarkRange("link").unsetLink().run();
    if (!isSafeHref(href)) return window.alert("Invalid URL. Use https://, http:// or mailto:.");
    c().extendMarkRange("link").setLink({ href }).run();
  }

  function addYoutube() {
    const raw = window.prompt("YouTube URL (e.g. https://www.youtube.com/watch?v=…)");
    if (raw === null) return;
    const src = raw.trim();
    if (!YOUTUBE_URL.test(src) || !editor.commands.setYoutubeVideo({ src })) {
      window.alert("Invalid YouTube URL.");
    }
  }

  function togglePull() {
    if (s.pull) c().unsetBlockquote().run();
    else if (s.quote) c().updateAttributes("blockquote", { variant: "pull" }).run();
    else c().wrapIn("blockquote", { variant: "pull" }).run();
  }

  return (
    <div role="toolbar" aria-label="Formatting tools" className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-line bg-surface px-2 py-1.5">
      <Btn label="Heading 2" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} icon={<Heading2 />} />
      <Btn label="Heading 3" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} icon={<Heading3 />} />
      <Btn label="Heading 4" active={s.h4} onClick={() => c().toggleHeading({ level: 4 }).run()} icon={<Heading4 />} />
      <Sep />
      <Btn label="Bold" active={s.bold} onClick={() => c().toggleBold().run()} icon={<Bold />} />
      <Btn label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()} icon={<Italic />} />
      <Btn label="Underline" active={s.underline} onClick={() => c().toggleUnderline().run()} icon={<Underline />} />
      <Btn label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()} icon={<Strikethrough />} />
      <Btn label="Link" active={s.link} onClick={setLink} icon={<LinkIcon />} />
      <Sep />
      <Btn label="Bullet list" active={s.bullet} onClick={() => c().toggleBulletList().run()} icon={<List />} />
      <Btn label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()} icon={<ListOrdered />} />
      <Btn label="Blockquote" active={s.quote} onClick={() => c().toggleBlockquote().run()} icon={<Quote />} />
      <Btn label="Pull quote" active={s.pull} onClick={togglePull} icon={<MessageSquareQuote />} />
      <Sep />
      <Btn label="Insert image" onClick={() => setImageOpen(true)} icon={<ImagePlus />} />
      <Btn label="YouTube video" onClick={addYoutube} icon={<Video />} />
      <Btn label="Table" active={s.table} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} icon={<Table />} />
      <Btn label="Horizontal rule" onClick={() => c().setHorizontalRule().run()} icon={<Minus />} />
      <Sep />
      <Btn label="Undo" disabled={!s.canUndo} onClick={() => c().undo().run()} icon={<Undo2 />} />
      <Btn label="Redo" disabled={!s.canRedo} onClick={() => c().redo().run()} icon={<Redo2 />} />
      {s.table && (
        <span className="ml-1 flex flex-wrap gap-1 text-xs">
          <TextBtn onClick={() => c().addRowAfter().run()}>+ Row</TextBtn>
          <TextBtn onClick={() => c().addColumnAfter().run()}>+ Column</TextBtn>
          <TextBtn onClick={() => c().deleteRow().run()}>− Row</TextBtn>
          <TextBtn onClick={() => c().deleteColumn().run()}>− Column</TextBtn>
          <TextBtn onClick={() => c().deleteTable().run()}>Delete table</TextBtn>
        </span>
      )}
      {imageOpen && <FigureDialog editor={editor} onClose={() => setImageOpen(false)} />}
    </div>
  );
}

function Btn({ label, icon, onClick, active = false, disabled = false }: { label: string; icon: React.ReactNode; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md [&_svg]:h-4 [&_svg]:w-4 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-40 ${
        active ? "bg-brand-100 text-brand-700" : "text-ink-soft hover:bg-paper"
      }`}
    >
      {icon}
    </button>
  );
}

function TextBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md border border-line bg-paper px-2 py-1 font-semibold text-ink-soft hover:border-brand">
      {children}
    </button>
  );
}

function Sep() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-line" />;
}

/** Insert a Figure node (image + caption + credit); the picker can also upload a new image. */
function FigureDialog({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [caption, setCaption] = useState("");
  const [credit, setCredit] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  const noEnter = (e: React.KeyboardEvent) => e.key === "Enter" && e.preventDefault();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  function insert() {
    if (!media?.url) return;
    editor
      .chain()
      .focus()
      .insertContent({ type: "figure", attrs: { src: media.url, alt: media.alt_text ?? "", caption: caption.trim(), credit: credit.trim(), mediaId: media.id } })
      .run();
    onClose();
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-label="Insert image" className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-0 backdrop:bg-black/40">
      <div className="space-y-4 p-5">
        <h2 className="text-base font-bold text-ink">Insert image</h2>
        <MediaPicker name="_figure_media" label="Image" onChange={setMedia} />
        {media && !media.alt_text && (
          <p className="text-xs font-semibold text-amber-800">This image has no alt text. Upload it again with alt text for accessibility.</p>
        )}
        <label className="block text-sm font-semibold text-ink">
          Caption
          <input className="field mt-1" value={caption} maxLength={600} onChange={(e) => setCaption(e.target.value)} onKeyDown={noEnter} />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Credit
          <input className="field mt-1" value={credit} maxLength={200} onChange={(e) => setCredit(e.target.value)} onKeyDown={noEnter} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-outline min-h-10 px-4 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary min-h-10 px-4 text-sm" disabled={!media?.url} onClick={insert}>
            Insert
          </button>
        </div>
      </div>
    </dialog>
  );
}
