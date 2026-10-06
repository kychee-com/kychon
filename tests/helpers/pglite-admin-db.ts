// A PGlite-backed stand-in for @run402/functions' adminDb(): `sql(text, params)`
// plus the small `.from(table)` builder Kychon's functions use (select with
// eq/gt/gte/lt/order/limit, insert, update().eq, delete().eq). Lets functions
// run against the real schema.sql, triggers included.
import type { PGlite } from '@electric-sql/pglite';

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

type Filter = [column: string, operator: '=' | '>' | '>=' | '<', value: unknown];
type Order = [column: string, ascending: boolean];

export function pgliteAdminDb(db: PGlite) {
  return {
    async sql(text: string, params: unknown[] = []) {
      return { rows: (await db.query(text, params)).rows };
    },
    from(table: string) {
      type Query = Promise<unknown[]> & {
        eq(column: string, value: unknown): Query;
        gt(column: string, value: unknown): Query;
        gte(column: string, value: unknown): Query;
        lt(column: string, value: unknown): Query;
        order(column: string, opts?: { ascending?: boolean }): Query;
        limit(n: number): Promise<unknown[]>;
      };
      // Like the PostgREST builder: awaitable at every step, each step narrowing
      // the query (a real Promise with the filters attached, no custom thenable).
      const query = (
        columns: string,
        filters: Filter[],
        max: number | null = null,
        order: Order | null = null,
      ): Query => {
        const cols =
          columns === '*'
            ? '*'
            : columns
                .split(',')
                .map((c) => ident(c.trim()))
                .join(', ');
        const where = filters.length
          ? ` WHERE ${filters.map(([c, op], i) => `${ident(c)} ${op} $${i + 1}`).join(' AND ')}`
          : '';
        const orderBy = order ? ` ORDER BY ${ident(order[0])} ${order[1] ? 'ASC' : 'DESC'}` : '';
        const sql = `SELECT ${cols} FROM ${ident(table)}${where}${orderBy}${max != null ? ` LIMIT ${max}` : ''}`;
        const promise = db
          .query(
            sql,
            filters.map(([, , v]) => v),
          )
          .then((r) => r.rows) as Query;
        promise.catch(() => {}); // superseded steps may be dropped unawaited
        const filtered = (column: string, operator: Filter[1], value: unknown) =>
          query(columns, [...filters, [column, operator, value]], max, order);
        promise.eq = (column, value) => filtered(column, '=', value);
        promise.gt = (column, value) => filtered(column, '>', value);
        promise.gte = (column, value) => filtered(column, '>=', value);
        promise.lt = (column, value) => filtered(column, '<', value);
        promise.order = (column, opts) => query(columns, filters, max, [column, opts?.ascending !== false]);
        promise.limit = (n) => query(columns, filters, n, order);
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
