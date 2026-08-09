import { describe, expect, it } from 'vitest';
import {
  InvalidDiagramFile,
  createDocument,
  parseDocumentFile,
  serializeDocument,
  uniqueName,
} from './document';

describe('serializar / importar', () => {
  it('conserva código, posiciones y dirección al dar la vuelta completa', () => {
    const original = createDocument({
      name: 'Mi esquema',
      lang: 'dbml',
      code: 'Table users {\n  id integer [pk]\n}',
      positions: { t1: { x: 120, y: -40 } },
      direction: 'TB',
    });

    const restored = parseDocumentFile(serializeDocument(original));

    expect(restored.name).toBe('Mi esquema');
    expect(restored.lang).toBe('dbml');
    expect(restored.code).toBe(original.code);
    expect(restored.positions).toEqual({ t1: { x: 120, y: -40 } });
    expect(restored.direction).toBe('TB');
  });

  it('asigna un id nuevo para no chocar con la pestaña original', () => {
    const original = createDocument({ name: 'A' });
    expect(parseDocumentFile(serializeDocument(original)).id).not.toBe(original.id);
  });
});

describe('validación al importar', () => {
  const rejects = (raw: string, match: RegExp) => {
    expect(() => parseDocumentFile(raw)).toThrow(InvalidDiagramFile);
    expect(() => parseDocumentFile(raw)).toThrow(match);
  };

  it('rechaza JSON inválido', () => {
    rejects('{ esto no es json', /JSON válido/);
  });

  it('rechaza un JSON que no sea de dbviewer', () => {
    rejects(JSON.stringify({ hola: 'mundo' }), /No es un archivo de dbviewer/);
  });

  it('rechaza una versión futura del formato', () => {
    rejects(
      JSON.stringify({ format: 'dbviewer-diagram', version: 99, lang: 'dbml', code: '' }),
      /versión 99/,
    );
  });

  it('rechaza un lenguaje desconocido', () => {
    rejects(
      JSON.stringify({ format: 'dbviewer-diagram', version: 1, lang: 'cobol', code: '' }),
      /Lenguaje desconocido/,
    );
  });

  it('descarta posiciones corruptas sin perder el resto del diagrama', () => {
    const raw = JSON.stringify({
      format: 'dbviewer-diagram',
      version: 1,
      lang: 'dbml',
      code: 'Table t { id integer }',
      positions: {
        buena: { x: 10, y: 20 },
        nan: { x: Number.NaN, y: 0 },
        texto: { x: '10', y: '20' },
        incompleta: { x: 5 },
      },
    });

    const document = parseDocumentFile(raw);

    // un NaN en las posiciones deja el canvas en un estado irrecuperable
    expect(document.positions).toEqual({ buena: { x: 10, y: 20 } });
    expect(document.code).toContain('Table t');
  });
});

describe('uniqueName', () => {
  it('deja el nombre si está libre', () => {
    expect(uniqueName('Esquema', ['Otro'])).toBe('Esquema');
  });

  it('numera al chocar, saltando los ya tomados', () => {
    expect(uniqueName('Esquema', ['Esquema'])).toBe('Esquema 2');
    expect(uniqueName('Esquema', ['Esquema', 'Esquema 2'])).toBe('Esquema 3');
  });
});
