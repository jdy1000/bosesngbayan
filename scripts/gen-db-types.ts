/**
 * Generate src/lib/database.types.ts from the actual migrations (Supabase-compatible format).
 * Works without Docker by introspecting a PGlite database built from supabase/migrations.
 * With a running Supabase stack you can alternatively use `supabase gen types typescript --local`.
 *
 * Usage: pnpm db:types
 */
import { writeFileSync } from "node:fs";
import { createSupabaseLikeDb, repoPath } from "./lib/pglite-supabase";

interface ColumnRow {
  table_name: string;
  column_name: string;
  udt_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  is_identity: "YES" | "NO";
  is_generated: "ALWAYS" | "NEVER";
  ordinal_position: number;
}

interface FkRow {
  constraint_name: string;
  table_name: string;
  columns: string[];
  ref_table: string;
  ref_columns: string[];
  is_one_to_one: boolean;
}

interface FnRow {
  name: string;
  arg_names: string[] | null;
  arg_types: string[];
  arg_modes: string[] | null;
  num_defaults: number;
  return_type: string;
  returns_set: boolean;
  return_type_kind: string;
  out_names: string[] | null;
  out_types: string[] | null;
}

async function main() {
  const db = await createSupabaseLikeDb({ seed: false });

  const enums = (
    await db.query<{ name: string; labels: string[] }>(`
      select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
      from pg_type t join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' group by t.typname order by t.typname`)
  ).rows;
  const enumNames = new Set(enums.map((e) => e.name));

  const tables = (
    await db.query<{ table_name: string }>(`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`)
  ).rows.map((r) => r.table_name);

  const columns = (
    await db.query<ColumnRow>(`
      select table_name, column_name, udt_name, data_type, is_nullable, column_default, is_identity, is_generated, ordinal_position
      from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`)
  ).rows;

  const fks = (
    await db.query<FkRow>(`
      select c.conname as constraint_name, cl.relname as table_name,
        (select array_agg(a.attname order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord)
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as columns,
        rcl.relname as ref_table,
        (select array_agg(a.attname order by k.ord) from unnest(c.confkey) with ordinality k(attnum, ord)
           join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum) as ref_columns,
        exists (select 1 from pg_constraint u where u.conrelid = c.conrelid and u.contype in ('p','u')
                and u.conkey::int[] @> c.conkey::int[] and u.conkey::int[] <@ c.conkey::int[]) as is_one_to_one
      from pg_constraint c
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      join pg_class rcl on rcl.oid = c.confrelid
      join pg_namespace rn on rn.oid = rcl.relnamespace
      where c.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public'
      order by c.conname`)
  ).rows;

  const fns = (
    await db.query<FnRow>(`
      select p.proname as name, p.proargnames as arg_names,
        array(select format_type(t, null) from unnest(p.proargtypes) t) as arg_types,
        p.proargmodes::text[] as arg_modes,
        p.pronargdefaults as num_defaults,
        format_type(p.prorettype, null) as return_type,
        p.proretset as returns_set,
        rt.typtype::text as return_type_kind,
        case when p.proargmodes is not null then
          array(select p.proargnames[i] from generate_subscripts(p.proargmodes, 1) i where p.proargmodes[i] in ('o','t'))
        end as out_names,
        case when p.proargmodes is not null then
          array(select format_type(p.proallargtypes[i], null) from generate_subscripts(p.proargmodes, 1) i where p.proargmodes[i] in ('o','t'))
        end as out_types
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_type rt on rt.oid = p.prorettype
      where n.nspname = 'public' and p.prokind = 'f'
        and rt.typname <> 'trigger'
      order by p.proname`)
  ).rows;

  const tsType = (pgType: string): string => {
    const t = pgType.replace(/^public\./, "").replace(/^extensions\./, "");
    if (t.endsWith("[]")) return `${tsType(t.slice(0, -2))}[]`;
    if (t.startsWith("_")) return `${tsType(t.slice(1))}[]`;
    if (enumNames.has(t)) return `Database["public"]["Enums"]["${t}"]`;
    if (tables.includes(t)) return `Database["public"]["Tables"]["${t}"]["Row"]`;
    switch (t) {
      case "uuid": case "text": case "citext": case "varchar": case "character varying": case "char": case "bpchar":
      case "timestamptz": case "timestamp with time zone": case "timestamp": case "timestamp without time zone":
      case "date": case "time": case "interval": case "tsvector": case "name":
        return "string";
      case "int2": case "int4": case "int8": case "smallint": case "integer": case "bigint":
      case "float4": case "float8": case "real": case "double precision": case "numeric":
        return "number";
      case "bool": case "boolean":
        return "boolean";
      case "json": case "jsonb":
        return "Json";
      case "void":
        return "undefined";
      default:
        return "unknown";
    }
  };

  const colTs = (c: ColumnRow) => tsType(c.data_type === "ARRAY" ? c.udt_name : c.data_type === "USER-DEFINED" ? c.udt_name : c.udt_name);

  const out: string[] = [];
  out.push("// AUTO-GENERATED by scripts/gen-db-types.ts from supabase/migrations. Do not edit by hand.");
  out.push("export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];");
  out.push("");
  out.push("export type Database = {");
  out.push('  __InternalSupabase: { PostgrestVersion: "12" };');
  out.push("  public: {");
  out.push("    Tables: {");
  for (const table of tables) {
    const cols = columns.filter((c) => c.table_name === table);
    const row = cols.map((c) => `          ${c.column_name}: ${colTs(c)}${c.is_nullable === "YES" ? " | null" : ""};`);
    const insert = cols.map((c) => {
      if (c.is_generated === "ALWAYS") return `          ${c.column_name}?: never;`;
      const optional = c.is_nullable === "YES" || c.column_default !== null || c.is_identity === "YES";
      return `          ${c.column_name}${optional ? "?" : ""}: ${colTs(c)}${c.is_nullable === "YES" ? " | null" : ""};`;
    });
    const update = cols.map((c) =>
      c.is_generated === "ALWAYS" ? `          ${c.column_name}?: never;` : `          ${c.column_name}?: ${colTs(c)}${c.is_nullable === "YES" ? " | null" : ""};`,
    );
    const rels = fks
      .filter((f) => f.table_name === table)
      .map(
        (f) =>
          `          { foreignKeyName: "${f.constraint_name}"; columns: [${f.columns.map((x) => `"${x}"`).join(", ")}]; isOneToOne: ${f.is_one_to_one}; referencedRelation: "${f.ref_table}"; referencedColumns: [${f.ref_columns.map((x) => `"${x}"`).join(", ")}] },`,
      );
    out.push(`      ${table}: {`);
    out.push("        Row: {", ...row, "        };");
    out.push("        Insert: {", ...insert, "        };");
    out.push("        Update: {", ...update, "        };");
    out.push("        Relationships: [", ...rels, "        ];");
    out.push("      };");
  }
  out.push("    };");
  out.push("    Views: { [_ in never]: never };");
  out.push("    Functions: {");
  const seen = new Set<string>();
  for (const f of fns) {
    if (seen.has(f.name)) continue; // overloads are not used in this schema
    seen.add(f.name);
    const inNames = (f.arg_names ?? []).filter((_, i) => !f.arg_modes || f.arg_modes[i] === "i" || f.arg_modes[i] === "b");
    const firstOptional = f.arg_types.length - f.num_defaults;
    const args = f.arg_types
      .map((t, i) => {
        const name = inNames[i];
        if (!name) return null;
        // SQL functions accept NULL for any argument; each function validates its own inputs.
        return `${name}${i >= firstOptional ? "?" : ""}: ${tsType(t)} | null`;
      })
      .filter(Boolean);
    let returns: string;
    if (f.out_names && f.out_names.length > 0) {
      const obj = `{ ${f.out_names.map((n, i) => `${n}: ${tsType(f.out_types![i]!)}`).join("; ")} }`;
      returns = f.returns_set ? `${obj}[]` : obj;
    } else {
      const base = tsType(f.return_type);
      returns = f.returns_set ? `${base}[]` : base;
    }
    out.push(`      ${f.name}: { Args: ${args.length ? `{ ${args.join("; ")} }` : "never"}; Returns: ${returns} };`);
  }
  out.push("    };");
  out.push("    Enums: {");
  for (const e of enums) out.push(`      ${e.name}: ${e.labels.map((l) => `"${l}"`).join(" | ")};`);
  out.push("    };");
  out.push("    CompositeTypes: { [_ in never]: never };");
  out.push("  };");
  out.push("};");
  out.push("");
  out.push('export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];');
  out.push('export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];');
  out.push("");

  const target = repoPath("src", "lib", "database.types.ts");
  writeFileSync(target, out.join("\n"));
  await db.close();
  console.log(`Wrote ${target} (${tables.length} tables, ${seen.size} functions, ${enums.length} enums)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
