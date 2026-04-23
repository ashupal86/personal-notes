'use client';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { Color, TextStyle, FontFamily } from '@tiptap/extension-text-style';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Code, Quote, List, ListOrdered, ListChecks,
  AlignLeft, AlignCenter, AlignRight,
  Heading1, Minus, Highlighter, Palette,
  Link as LinkIcon, Image as ImageIcon, Table as TableIcon,
  Undo2, Redo2,
} from 'lucide-react';
import { useCallback, useRef } from 'react';

/* ── Toolbar button ── */
function TBtn({
  onClick, active = false, disabled = false, title, children,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean;
  title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`p-1.5 rounded-[var(--radius-md)] transition-colors disabled:opacity-30 ${
        active
          ? 'bg-[var(--color-primary-container)] text-[var(--color-on-primary-cnt)]'
          : 'text-[var(--color-on-surface-var)] hover:bg-[var(--color-surface-high)] hover:text-[var(--color-on-surface)]'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-[var(--color-surface-high)] mx-0.5 flex-shrink-0" />;
}

/* ── Toolbar ── */
function Toolbar({ editor }: { editor: Editor }) {
  const colorRef = useRef<HTMLInputElement>(null);
  const hlRef    = useRef<HTMLInputElement>(null);

  const addLink = useCallback(() => {
    const url = window.prompt('Enter URL:');
    if (!url) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    const url = window.prompt('Image URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const insertTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 bg-[var(--color-surface-mid)] border-b border-[var(--color-surface-high)] rounded-t-lg">
      {/* History */}
      <TBtn title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 size={15} />
      </TBtn>
      <TBtn title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 size={15} />
      </TBtn>

      <Divider />

      {/* Headings */}
      <TBtn title="Heading 1" active={editor.isActive('heading',{level:1})} onClick={() => editor.chain().focus().toggleHeading({level:1}).run()}>
        <Heading1 size={15} />
      </TBtn>
      <TBtn title="Heading 2" active={editor.isActive('heading',{level:2})} onClick={() => editor.chain().focus().toggleHeading({level:2}).run()}>
        <span className="text-[11px] font-bold">H2</span>
      </TBtn>
      <TBtn title="Heading 3" active={editor.isActive('heading',{level:3})} onClick={() => editor.chain().focus().toggleHeading({level:3}).run()}>
        <span className="text-[11px] font-bold">H3</span>
      </TBtn>

      <Divider />

      {/* Inline marks */}
      <TBtn title="Bold"          active={editor.isActive('bold')}      onClick={() => editor.chain().focus().toggleBold().run()}>      <Bold size={15} /></TBtn>
      <TBtn title="Italic"        active={editor.isActive('italic')}    onClick={() => editor.chain().focus().toggleItalic().run()}>    <Italic size={15} /></TBtn>
      <TBtn title="Underline"     active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}> <UnderlineIcon size={15} /></TBtn>
      <TBtn title="Strikethrough" active={editor.isActive('strike')}    onClick={() => editor.chain().focus().toggleStrike().run()}>    <Strikethrough size={15} /></TBtn>
      <TBtn title="Inline code"   active={editor.isActive('code')}      onClick={() => editor.chain().focus().toggleCode().run()}>      <Code size={15} /></TBtn>

      <Divider />

      {/* Blocks */}
      <TBtn title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={15} /></TBtn>
      <TBtn title="Code block" active={editor.isActive('codeBlock')}  onClick={() => editor.chain().focus().toggleCodeBlock().run()}> <Code size={15} strokeWidth={1.5} /></TBtn>
      <TBtn title="Divider line" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus size={15} /></TBtn>

      <Divider />

      {/* Lists */}
      <TBtn title="Bullet list"  active={editor.isActive('bulletList')}  onClick={() => editor.chain().focus().toggleBulletList().run()}>  <List size={15} /></TBtn>
      <TBtn title="Ordered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}> <ListOrdered size={15} /></TBtn>
      <TBtn title="Task list"    active={editor.isActive('taskList')}    onClick={() => editor.chain().focus().toggleTaskList().run()}>    <ListChecks size={15} /></TBtn>

      <Divider />

      {/* Align */}
      <TBtn title="Align left"   active={editor.isActive({textAlign:'left'})}   onClick={() => editor.chain().focus().setTextAlign('left').run()}>   <AlignLeft size={15} /></TBtn>
      <TBtn title="Align center" active={editor.isActive({textAlign:'center'})} onClick={() => editor.chain().focus().setTextAlign('center').run()}> <AlignCenter size={15} /></TBtn>
      <TBtn title="Align right"  active={editor.isActive({textAlign:'right'})}  onClick={() => editor.chain().focus().setTextAlign('right').run()}>  <AlignRight size={15} /></TBtn>

      <Divider />

      {/* Color + highlight */}
      <div className="relative">
        <TBtn title="Highlight" active={editor.isActive('highlight')} onClick={() => hlRef.current?.click()}>
          <Highlighter size={15} />
        </TBtn>
        <input ref={hlRef} type="color" defaultValue="#fef08a" className="absolute opacity-0 w-0 h-0 pointer-events-none"
          onChange={e => editor.chain().focus().setHighlight({ color: e.target.value }).run()} />
      </div>
      <div className="relative">
        <TBtn title="Text color" onClick={() => colorRef.current?.click()}><Palette size={15} /></TBtn>
        <input ref={colorRef} type="color" defaultValue="#005fad" className="absolute opacity-0 w-0 h-0 pointer-events-none"
          onChange={e => editor.chain().focus().setColor(e.target.value).run()} />
      </div>

      <Divider />

      {/* Insert */}
      <TBtn title="Link"  active={editor.isActive('link')} onClick={addLink}><LinkIcon size={15} /></TBtn>
      <TBtn title="Image" onClick={addImage}><ImageIcon size={15} /></TBtn>
      <TBtn title="Table" onClick={insertTable}><TableIcon size={15} /></TBtn>
    </div>
  );
}

/* ── Main component ── */
interface TiptapEditorProps {
  initialContent?: string;
  initialJson?: object;
  onChange?: (text: string, json: object) => void;
  placeholder?: string;
  editable?: boolean;
}

export default function TiptapEditor({
  initialContent = '',
  initialJson,
  onChange,
  placeholder = 'Start writing…',
  editable = true,
}: TiptapEditorProps) {

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1,2,3,4,5,6] } }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      FontFamily,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      Table.configure({ resizable: false }),
      TableRow, TableCell, TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
    ],
    content: initialJson ?? (initialContent
      ? `<p>${initialContent.split('\n').join('</p><p>')}</p>`
      : ''),
    editable,
    onUpdate: ({ editor }) => {
      if (!onChange) return;
      onChange(editor.getText({ blockSeparator: '\n' }), editor.getJSON());
    },
    immediatelyRender: false,
  });

  if (!editor) return null;

  const chars = editor.storage.characterCount?.characters?.() ?? 0;
  const words = editor.storage.characterCount?.words?.()      ?? 0;

  return (
    <div className="flex flex-col h-full">
      {editable && <Toolbar editor={editor} />}
      <div className="flex-1 overflow-y-auto">
        <EditorContent
          editor={editor}
          className="tiptap-editor px-5 py-4 min-h-96 text-[14px] text-[var(--color-on-surface)] leading-relaxed"
        />
      </div>
      {editable && (
        <div className="px-5 py-1.5 border-t border-[var(--color-surface-high)] flex gap-4">
          <span className="text-[10.5px] text-[var(--color-outline)]">{words} words</span>
          <span className="text-[10.5px] text-[var(--color-outline)]">{chars} chars</span>
        </div>
      )}
    </div>
  );
}
