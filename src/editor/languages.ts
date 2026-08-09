import { StreamLanguage, type StreamParser } from '@codemirror/language';

/**
 * Modos ligeros hechos a mano: CodeMirror no trae gramáticas para DBML ni
 * Mermaid, y un tokenizador por líneas alcanza para colorear bien ambos.
 */

const DBML_KEYWORDS =
  /^(Table|TableGroup|TablePartial|Ref|Enum|Project|Note|Indexes|indexes|as|Ref:|note)\b/i;
const DBML_SETTINGS = /^(pk|primary key|increment|not null|null|unique|default|ref|note|name|type|update|delete)\b/i;
const DBML_TYPES =
  /^(int|integer|bigint|smallint|tinyint|serial|bigserial|decimal|numeric|real|double|float|money|char|varchar|text|citext|uuid|json|jsonb|xml|bool|boolean|date|time|timestamp|timestamptz|datetime|blob|bytea|binary|enum|array)\b/i;

interface DbmlState {
  inSettings: boolean;
  inBlockComment: boolean;
}

const dbmlParser: StreamParser<DbmlState> = {
  name: 'dbml',
  startState: () => ({ inSettings: false, inBlockComment: false }),
  token(stream, state) {
    if (state.inBlockComment) {
      if (stream.skipTo('*/')) {
        stream.match('*/');
        state.inBlockComment = false;
      } else {
        stream.skipToEnd();
      }
      return 'comment';
    }
    if (stream.eatSpace()) return null;

    if (stream.match('/*')) {
      state.inBlockComment = true;
      return 'comment';
    }
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }

    // strings de una línea y strings multilínea ''' ... '''
    if (stream.match("'''")) {
      if (!stream.skipTo("'''")) stream.skipToEnd();
      else stream.match("'''");
      return 'string';
    }
    const quote = stream.peek();
    if (quote === "'" || quote === '"' || quote === '`') {
      stream.next();
      let escaped = false;
      let ch: string | void;
      while ((ch = stream.next()) != null) {
        if (ch === quote && !escaped) break;
        escaped = !escaped && ch === '\\';
      }
      return quote === '`' ? 'literal' : 'string';
    }

    if (stream.eat('[')) {
      state.inSettings = true;
      return 'bracket';
    }
    if (stream.eat(']')) {
      state.inSettings = false;
      return 'bracket';
    }
    if (stream.match(/^[{}()]/)) return 'bracket';
    if (stream.match(/^[<>*-]+/)) return 'operator';

    if (stream.match(/^#[0-9a-fA-F]{3,8}\b/)) return 'atom';
    if (stream.match(/^\d+(\.\d+)?\b/)) return 'number';

    if (state.inSettings) {
      if (stream.match(DBML_SETTINGS)) return 'keyword';
      // consumimos el token sí o sí para no dejar el stream sin avanzar
      if (!stream.match(/^[\w.]+/)) stream.next();
      return 'propertyName';
    }

    if (stream.match(DBML_KEYWORDS)) return 'keyword';
    if (stream.match(DBML_TYPES)) return 'typeName';
    if (stream.match(/^[\w.]+/)) return 'variableName';

    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: '//', block: { open: '/*', close: '*/' } },
    closeBrackets: { brackets: ['(', '[', '{', "'", '"', '`'] },
  },
};

export const dbmlLanguage = StreamLanguage.define(dbmlParser);

const MERMAID_DIAGRAMS =
  /^(flowchart|graph|sequenceDiagram|classDiagram(-v2)?|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|mindmap|timeline|sankey(-beta)?|xychart(-beta)?|block(-beta)?|C4Context|architecture(-beta)?)\b/;
const MERMAID_KEYWORDS =
  /^(subgraph|end|direction|class|classDef|click|style|linkStyle|state|note|participant|actor|loop|alt|else|opt|par|and|rect|activate|deactivate|section|title|accTitle|accDescr|dateFormat|axisFormat|excludes|todayMarker)\b/;
const MERMAID_DIRECTION = /^(TB|TD|BT|RL|LR)\b/;
const MERMAID_ARROW = /^(-{1,3}>{0,1}|={2,3}>?|\.{1,3}-?>?|<-{1,3}|-{2,3}[ox]|x-{2,3}|o-{2,3}|--|\|\||\}o|o\{|\|\{|\}\||\.\.|\|>|\*--|<\|--|<\|\.\.|--\*|--o|\.\.>|\.\.\|>)/;

const mermaidParser: StreamParser<{ inPercentComment: boolean }> = {
  name: 'mermaid',
  startState: () => ({ inPercentComment: false }),
  token(stream) {
    if (stream.eatSpace()) return null;

    if (stream.match('%%')) {
      stream.skipToEnd();
      return 'comment';
    }

    const quote = stream.peek();
    if (quote === '"') {
      stream.next();
      let ch: string | void;
      while ((ch = stream.next()) != null) if (ch === '"') break;
      return 'string';
    }

    if (stream.sol() && stream.match(MERMAID_DIAGRAMS)) return 'keyword';
    if (stream.match(MERMAID_KEYWORDS)) return 'keyword';
    if (stream.match(MERMAID_DIRECTION)) return 'atom';
    if (stream.match(MERMAID_ARROW)) return 'operator';
    if (stream.match(/^[[\]{}()>/\\]/)) return 'bracket';
    if (stream.match(/^:::?/)) return 'operator';
    if (stream.match(/^\d+(\.\d+)?\b/)) return 'number';
    if (stream.match(/^[\w.-]+/)) return 'variableName';

    stream.next();
    return null;
  },
  languageData: {
    commentTokens: { line: '%%' },
  },
};

export const mermaidLanguage = StreamLanguage.define(mermaidParser);
