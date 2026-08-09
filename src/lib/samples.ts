import type { SourceLang } from './types';

export interface Sample {
  id: string;
  lang: SourceLang;
  label: string;
  code: string;
}

export const SAMPLES: Sample[] = [
  {
    id: 'dbml-blog',
    lang: 'dbml',
    label: 'DBML · Blog',
    code: `Project blog {
  database_type: 'PostgreSQL'
  Note: 'Esquema de ejemplo'
}

Table users {
  id integer [pk, increment]
  username varchar(50) [not null, unique]
  email varchar(120) [not null, unique]
  role user_role [not null, default: 'member']
  created_at timestamp [default: \`now()\`]

  Note: 'Usuarios registrados'
}

Table posts {
  id integer [pk, increment]
  title varchar(200) [not null]
  slug varchar(200) [not null, unique]
  body text
  status post_status [not null, default: 'draft']
  author_id integer [not null, ref: > users.id]
  published_at timestamp

  Indexes {
    (status, published_at)
  }
}

Table comments {
  id integer [pk, increment]
  post_id integer [not null, ref: > posts.id]
  author_id integer [ref: > users.id]
  body text [not null]
  created_at timestamp
}

Table tags {
  id integer [pk, increment]
  name varchar(40) [not null, unique]
}

Table post_tags {
  post_id integer [ref: > posts.id]
  tag_id integer [ref: > tags.id]

  Indexes {
    (post_id, tag_id) [pk]
  }
}

Enum user_role {
  admin
  editor
  member
}

Enum post_status {
  draft
  published
  archived
}

TableGroup contenido {
  posts
  tags
  post_tags
}
`,
  },
  {
    id: 'mermaid-flow',
    lang: 'mermaid',
    label: 'Mermaid · Flowchart',
    code: `flowchart LR
  A([Inicio]) --> B{¿Tiene sesión?}
  B -- no --> C[Login]
  B -- sí --> D[Dashboard]
  C --> E[(Base de datos)]
  E --> D

  subgraph Backend
    E
    F[[Job de sincronización]]
  end

  D --> F
  F -.reintento.-> E
  D ==> G[/Reporte/]
  G --> H([Fin])
`,
  },
  {
    id: 'mermaid-er',
    lang: 'mermaid',
    label: 'Mermaid · ER',
    code: `erDiagram
  CLIENTE ||--o{ PEDIDO : realiza
  CLIENTE {
    int id PK
    string nombre
    string email UK
  }
  PEDIDO ||--|{ LINEA_PEDIDO : contiene
  PEDIDO {
    int id PK
    int cliente_id FK
    date fecha
    decimal total
  }
  PRODUCTO ||--o{ LINEA_PEDIDO : aparece_en
  PRODUCTO {
    int id PK
    string sku UK
    decimal precio
  }
  LINEA_PEDIDO {
    int pedido_id FK
    int producto_id FK
    int cantidad
  }
`,
  },
  {
    id: 'mermaid-class',
    lang: 'mermaid',
    label: 'Mermaid · Clases',
    code: `classDiagram
  class Repositorio~T~ {
    <<interface>>
    +buscar(id) T
    +guardar(entidad) void
  }
  class RepositorioUsuarios {
    -conexion: Pool
    +buscar(id) Usuario
    +guardar(usuario) void
  }
  class Usuario {
    +int id
    +string nombre
    -string hash
    +verificar(password) bool
  }
  class Sesion {
    +string token
    +Date expira
  }

  Repositorio <|.. RepositorioUsuarios
  RepositorioUsuarios --> Usuario : devuelve
  Usuario "1" *-- "0..*" Sesion : tiene
`,
  },
];

export const DEFAULT_CODE: Record<SourceLang, string> = {
  dbml: SAMPLES[0].code,
  mermaid: SAMPLES[1].code,
};
