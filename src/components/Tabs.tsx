import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/useStore';
import { useAnchoredPanel } from '../hooks/useAnchoredPanel';
import type { SourceLang } from '../lib/types';
import { FILE_EXTENSION, parseDocumentFile, serializeDocument, InvalidDiagramFile } from '../lib/document';
import { download } from '../lib/exporters';

const LANG_LABEL: Record<string, string> = { dbml: 'DBML', mermaid: 'MMD' };

/**
 * El lenguaje se elige aquí y no en la barra: es lo único que no se puede
 * cambiar después sin tirar el código, porque son sintaxis distintas.
 */
const NEW_TAB: { lang: SourceLang; label: string }[] = [
  { lang: 'dbml', label: 'Nueva pestaña DBML' },
  { lang: 'mermaid', label: 'Nueva pestaña Mermaid' },
];

/** Nombre de archivo seguro a partir del título de la pestaña. */
function fileNameFor(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'diagrama'}${FILE_EXTENSION}`;
}

export function Tabs() {
  const documents = useStore((state) => state.documents);
  const activeId = useStore((state) => state.activeId);
  const selectDocument = useStore((state) => state.selectDocument);
  const closeDocument = useStore((state) => state.closeDocument);
  const addDocument = useStore((state) => state.addDocument);
  const renameDocument = useStore((state) => state.renameDocument);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const newTab = useAnchoredPanel();

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setDraft(name);
  };

  const commitRename = () => {
    if (editingId) renameDocument(editingId, draft);
    setEditingId(null);
  };

  const exportActive = () => {
    const active = documents.find((document) => document.id === activeId);
    if (!active) return;
    download(fileNameFor(active.name), serializeDocument(active), 'application/json');
  };

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      try {
        addDocument(parseDocumentFile(await file.text()));
      } catch (error) {
        const reason = error instanceof InvalidDiagramFile ? error.message : String(error);
        errors.push(`${file.name}: ${reason}`);
      }
    }
    if (errors.length) window.alert(`No se pudo importar:\n\n${errors.join('\n')}`);
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <div className="tabs" role="tablist">
      {documents.map((document) => {
        const active = document.id === activeId;
        return (
          <div
            key={document.id}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            className={`tab${active ? ' is-active' : ''}`}
            onClick={() => selectDocument(document.id)}
            onDoubleClick={() => startRename(document.id, document.name)}
            title={`${document.name} · doble clic para renombrar`}
          >
            <span className="tab__lang">{LANG_LABEL[document.lang] ?? document.lang}</span>
            {editingId === document.id ? (
              <input
                ref={inputRef}
                className="tab__input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitRename();
                  if (event.key === 'Escape') setEditingId(null);
                }}
                onClick={(event) => event.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="tab__name">{document.name}</span>
            )}
            <button
              type="button"
              className="tab__close"
              title="Cerrar pestaña"
              aria-label={`Cerrar ${document.name}`}
              onClick={(event) => {
                event.stopPropagation();
                closeDocument(document.id);
              }}
            >
              ×
            </button>
          </div>
        );
      })}

      <button
        ref={newTab.buttonRef}
        type="button"
        className="tabs__action"
        title="Nueva pestaña"
        aria-label="Nueva pestaña"
        aria-expanded={newTab.open}
        onClick={newTab.toggle}
      >
        +
      </button>

      <div className="tabs__spacer" />

      <button type="button" className="tabs__action tabs__action--text" onClick={() => fileInput.current?.click()}>
        Importar
      </button>
      <button
        type="button"
        className="tabs__action tabs__action--text"
        onClick={exportActive}
        title={`Guarda código y posiciones en un ${FILE_EXTENSION}`}
      >
        Guardar
      </button>

      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        multiple
        hidden
        onChange={(event) => void importFiles(event.target.files)}
      />

      {/* portal: la barra de pestañas tiene overflow-x y recortaría el panel */}
      {newTab.open &&
        newTab.position &&
        createPortal(
          <div className="menu__list" role="menu" ref={newTab.panelRef} style={newTab.position}>
            {NEW_TAB.map((option) => (
              <button
                key={option.lang}
                type="button"
                role="menuitem"
                className="menu__item"
                onClick={() => {
                  newTab.close();
                  addDocument({ lang: option.lang });
                }}
              >
                <span>{option.label}</span>
                <span className="menu__hint">{LANG_LABEL[option.lang]}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
