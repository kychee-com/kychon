// A PGlite-backed stand-in for @run402/functions' adminDb(): `sql(text, params)`
// plus the small `.from(table)` builder kychon-api uses (select/eq/limit,
// insert, update().eq, delete().eq). Lets functions run against the real
// schema.sql, triggers included.
import type { PGlite } from '@electric-sql/pglite';

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

export function pgliteAdminDb(db: PGlite) {
  return {
    async sql(text: string, params: unknown[] = []) {
      return { rows: (await db.query(text, params)).rows };
    },
    from(table: string) {
      type Query = Promise<unknown[]> & {
        eq(column: string, value: unknown): Query;
        limit(n: number): Promise<unknown[]>;
      };
      // Like the PostgREST builder: awaitable at every step, each step narrowing
      // the query (a real Promise with eq/limit attached, no custom thenable).
      const query = (columns: string, filters: Array<[string, unknown]>, max: number | null = null): Query => {
        const cols =
          columns === '*'
            ? '*'
            : columns
                .split(',')
                .map((c) => ident(c.trim()))
                .join(', ');
        const where = filters.length
          ? ` WHERE ${filters.map(([c], i) => `${ident(c)} = $${i + 1}`).join(' AND ')}`
          : '';
        const sql = `SELECT ${cols} FROM ${ident(table)}${where}${max != null ? ` LIMIT ${max}` : ''}`;
        const promise = db
          .query(
            sql,
            filters.map(([, v]) => v),
          )
          .then((r) => r.rows) as Query;
        promise.catch(() => {}); // superseded steps may be dropped unawaited
        promise.eq = (column, value) => query(columns, [...filters, [column, value]], max);
        promise.limit = (n) => query(columns, filters, n);
        return promise;
      };
      const builder = {
        select(cols = '*') {
          return query(cols, []);
        },
        async insert(row: Record<string, unknown>) {
          const keys = Object.keys(row);
          const sql = `INSERT INTO ${ident(table)} (${keys.map(ident).join(', ')}) SELECT ${keys.map(ident).join(', ')} FROM jsonb_populate_record(NULL::${ident(table)}, $1::jsonb) RETURNING *`;
          return (await db.query(sql, [JSON.stringify(row)])).rows;
        },
        update(patch: Record<string, unknown>) {
          return {
            async eq(column: string, value: unknown) {
              const keys = Object.keys(patch);
              const list = keys.map(ident).join(', ');
              const sql = `UPDATE ${ident(table)} SET (${list}) = (SELECT ${list} FROM jsonb_populate_record(NULL::${ident(table)}, $1::jsonb)) WHERE ${ident(column)} = $2 RETURNING *`;
              return (await db.query(sql, [JSON.stringify(patch), value])).rows;
            },
          };
        },
        delete() {
          return {
            async eq(column: string, value: unknown) {
              return (await db.query(`DELETE FROM ${ident(table)} WHERE ${ident(column)} = $1 RETURNING *`, [value]))
                .rows;
            },
          };
        },
      };
      return builder;
    },
  };
}
