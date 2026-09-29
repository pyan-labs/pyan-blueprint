export interface ConnectionEntry {
  server: string;
  port?: number;
  database: string;
  authentication?: "sql" | "windows";
  user?: string;
  password?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  // 생략하면 true. 쓰기를 허용하려면 false를 명시한다.
  readonly?: boolean;
}

export interface DbFetcherConnections {
  open: string;
  [env: string]: string | ConnectionEntry;
}

export interface DbFetcherConfig {
  connections: DbFetcherConnections;
}

export type ConfigScope = "local" | "parent" | "global";

export interface ConfigLocation {
  path: string;
  scope: ConfigScope;
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  max_length: number | null;
  precision: number | null;
  scale: number | null;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_identity: boolean;
  default_value: string | null;
  description: string | null;
}

export interface TableInfo {
  table_name: string;
  schema_name: string;
  row_count: number;
  columns: ColumnInfo[];
}

export interface RelationshipInfo {
  fk_name: string;
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  on_delete: string;
  on_update: string;
}

export interface IndexInfo {
  index_name: string;
  table_name: string;
  is_unique: boolean;
  is_primary_key: boolean;
  columns: string[];
  included_columns: string[];
}

export interface StoredProcedureInfo {
  name: string;
  schema_name: string;
  parameters: SpParameterInfo[];
  definition_preview: string;
}

export interface SpParameterInfo {
  name: string;
  data_type: string;
  max_length: number | null;
  is_output: boolean;
  has_default: boolean;
}

export interface SampleDataResult {
  table_name: string;
  row_count_total: number;
  rows: Record<string, unknown>[];
  note: string | null;
}

export interface ConnectionListItem {
  env: string;
  server: string;
  database: string;
  readonly: boolean;
  is_open: boolean;
  available: boolean;
}
