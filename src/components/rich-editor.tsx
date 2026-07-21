import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { useEffect } from "react";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Highlighter, List, ListOrdered, Heading1, Heading2, Quote, Undo2, Redo2,
} from "lucide-react";

const COLORS = ["#111827", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

type Props = {
  value: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
};

export function RichEditor({ value, onChange, editable = true }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
    ],
    content: value || "",
    editable,
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-sm dark:prose-invert max-w-none min-h-[40vh] focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync when switching pages
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-1 flex-col">
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="mt-4 flex-1" />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    `rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground ${
      active ? "bg-muted text-foreground" : ""
    }`;
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-background/80 py-2 backdrop-blur">
      <button className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></button>
      <button className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></button>
      <button className={btn(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-3.5 w-3.5" /></button>
      <button className={btn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5" /></button>
      <span className="mx-1 h-4 w-px bg-border" />
      <button className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-3.5 w-3.5" /></button>
      <button className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-3.5 w-3.5" /></button>
      <button className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></button>
      <button className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></button>
      <button className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5" /></button>
      <span className="mx-1 h-4 w-px bg-border" />
      <div className="flex items-center gap-0.5">
        <Highlighter className="h-3.5 w-3.5 text-muted-foreground" />
        {COLORS.slice(1, 5).map((c) => (
          <button
            key={c}
            onClick={() => editor.chain().focus().toggleHighlight({ color: c + "33" }).run()}
            className="h-4 w-4 rounded border"
            style={{ background: c + "55" }}
            title={`Highlight ${c}`}
          />
        ))}
        <button
          onClick={() => editor.chain().focus().unsetHighlight().run()}
          className="rounded px-1 text-[10px] text-muted-foreground hover:bg-muted"
        >clear</button>
      </div>
      <span className="mx-1 h-4 w-px bg-border" />
      <div className="flex items-center gap-0.5">
        <span className="text-[10px] text-muted-foreground">A</span>
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => editor.chain().focus().setColor(c).run()}
            className="h-4 w-4 rounded-full border"
            style={{ background: c }}
            title={`Text ${c}`}
          />
        ))}
        <button
          onClick={() => editor.chain().focus().unsetColor().run()}
          className="rounded px-1 text-[10px] text-muted-foreground hover:bg-muted"
        >reset</button>
      </div>
      <span className="mx-1 h-4 w-px bg-border" />
      <button className={btn(false)} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-3.5 w-3.5" /></button>
      <button className={btn(false)} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}
