import { useState } from 'react';
import { useReactFlow } from '@xyflow/react';

import { useStore, selectCode, selectLang, selectDirection } from '../store/useStore';
import type { FlowDirection, SourceLang } from '../lib/types';
import { SAMPLES } from '../lib/samples';
import { FONTS, getFont } from '../lib/fonts';
import { Menu, type MenuItem } from './Menu';
import { AboutButton } from './AboutButton';
import {
  dbmlToSql,
  download,
  exportPng,
  exportStaticPng,
  exportStaticSvg,
  exportSvg,
  type SqlDialect,
} from '../lib/exporters';

const DIRECTIONS: { value: FlowDirection | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'LR', label: '→ Izq. a der.' },
  { value: 'RL', label: '← Der. a izq.' },
  { value: 'TB', label: '↓ Arriba a abajo' },
  { value: 'BT', label: '↑ Abajo a arriba' },
];

const SQL_DIALECTS: { value: SqlDialect; label: string }[] = [
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mssql', label: 'SQL Server' },
  { value: 'oracle', label: 'Oracle' },
];

export function Toolbar() {
  const lang = useStore(selectLang);
  const setLang = useStore((state) => state.setLang);
  const addDocument = useStore((state) => state.addDocument);
  const code = useStore(selectCode);
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const fontKey = useStore((state) => state.fontKey);
  const setFontKey = useStore((state) => state.setFontKey);
  const direction = useStore(selectDirection);
  const setDirection = useStore((state) => state.setDirection);
  const snapToGrid = useStore((state) => state.snapToGrid);
  const toggleSnap = useStore((state) => state.toggleSnap);
  const showMinimap = useStore((state) => state.showMinimap);
  const toggleMinimap = useStore((state) => state.toggleMinimap);
  const requestLayout = useStore((state) => state.requestLayout);
  const requestFit = useStore((state) => state.requestFit);
  const model = useStore((state) => state.model);
  const diagnostics = useStore((state) => state.diagnostics);
  const parsing = useStore((state) => state.parsing);
  const staticSvg = useStore((state) => state.staticSvg);

  const { getNodes } = useReactFlow();
  const [busy, setBusy] = useState<string | null>(null);

  const errors = diagnostics.filter((d) => d.severity === 'error').length;

  const switchLang = (next: SourceLang) => {
    if (next !== lang) setLang(next);
  };

  // Los ejemplos abren una pestaña nueva en vez de pisar lo que estés editando.
  const loadSample = (id: string) => {
    const sample = SAMPLES.find((item) => item.id === id);
    if (!sample) return;
    addDocument({ lang: sample.lang, name: sample.label, code: sample.code });
  };

  const runExport = async (name: string, task: () => Promise<void> | void) => {
    setBusy(name);
    try {
      await task();
    } catch (error) {
      window.alert(`No se pudo exportar: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(null);
    }
  };

  // Los diagramas estáticos (sequence, gantt, pie...) ya son un SVG y no pasan
  // por React Flow, así que tienen su propia ruta de exportación.
  const hasImage = Boolean(staticSvg) || model.nodes.length > 0;

  const exportItems: MenuItem[] = [
    {
      // los grupos entran en el encuadre: su recuadro sobresale de los nodos
      label: 'PNG (2x)',
      onSelect: () =>
        runExport('png', () =>
          staticSvg
            ? exportStaticPng(staticSvg, `diagrama-${lang}.png`)
            : exportPng(getNodes(), `diagrama-${lang}.png`),
        ),
      disabled: !hasImage,
    },
    {
      label: 'SVG',
      onSelect: () =>
        runExport('svg', () =>
          staticSvg
            ? exportStaticSvg(staticSvg, `diagrama-${lang}.svg`)
            : exportSvg(getNodes(), `diagrama-${lang}.svg`),
        ),
      disabled: !hasImage,
    },
    {
      label: lang === 'dbml' ? 'Código .dbml' : 'Código .mmd',
      onSelect: () => download(lang === 'dbml' ? 'esquema.dbml' : 'diagrama.mmd', code),
    },
    ...(lang === 'dbml'
      ? SQL_DIALECTS.map((dialect) => ({
          label: `SQL · ${dialect.label}`,
          onSelect: () =>
            runExport('sql', async () => {
              download(`esquema-${dialect.value}.sql`, await dbmlToSql(code, dialect.value), 'application/sql');
            }),
          disabled: errors > 0,
          hint: errors > 0 ? 'corrige los errores' : undefined,
        }))
      : []),
  ];

  const sampleItems: MenuItem[] = SAMPLES.map((sample) => ({
    label: sample.label,
    onSelect: () => loadSample(sample.id),
  }));

  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__logo" aria-hidden />
        <strong>dbviewer</strong>
      </div>

      <div className="seg">
        <button
          type="button"
          className={`seg__btn${lang === 'dbml' ? ' is-active' : ''}`}
          onClick={() => switchLang('dbml')}
        >
          DBML
        </button>
        <button
          type="button"
          className={`seg__btn${lang === 'mermaid' ? ' is-active' : ''}`}
          onClick={() => switchLang('mermaid')}
        >
          Mermaid
        </button>
      </div>

      <div className="toolbar__divider" />

      <button type="button" className="tb-btn" onClick={requestLayout} title="Reacomodar todo con auto-layout">
        Reacomodar
      </button>

      <select
        className="tb-select"
        value={direction}
        onChange={(event) => setDirection(event.target.value as FlowDirection | 'auto')}
        title="Dirección del auto-layout"
      >
        {DIRECTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button type="button" className="tb-btn" onClick={requestFit} title="Encuadrar (ajustar a la vista)">
        Encuadrar
      </button>

      <button
        type="button"
        className={`tb-btn${snapToGrid ? ' is-active' : ''}`}
        onClick={toggleSnap}
        title="Ajustar a la grilla al arrastrar"
      >
        Grilla
      </button>

      <button
        type="button"
        className={`tb-btn${showMinimap ? ' is-active' : ''}`}
        onClick={toggleMinimap}
        title="Mostrar minimapa"
      >
        Minimapa
      </button>

      <div className="toolbar__divider" />

      <Menu label="Ejemplos" items={sampleItems} />
      <Menu label={busy ? 'Exportando…' : 'Exportar'} items={exportItems} />

      <div className="toolbar__spacer" />

      <select
        className="tb-select"
        value={fontKey}
        onChange={(event) => setFontKey(event.target.value)}
        title="Tipografía del diagrama"
        aria-label="Tipografía del diagrama"
        style={{ fontFamily: getFont(fontKey).stack }}
      >
        {FONTS.map((font) => (
          <option key={font.key} value={font.key} style={{ fontFamily: font.stack }}>
            {font.label}
          </option>
        ))}
      </select>

      <span className={`status${errors ? ' status--error' : ''}`}>
        {parsing ? 'Analizando…' : errors ? `${errors} error${errors > 1 ? 'es' : ''}` : `${model.nodes.length} nodos`}
      </span>

      <button
        type="button"
        className="tb-btn tb-btn--outlined"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      >
        <span aria-hidden>{theme === 'dark' ? '☀' : '☾'}</span>
        {theme === 'dark' ? 'Claro' : 'Oscuro'}
      </button>

      <AboutButton />
    </header>
  );
}
