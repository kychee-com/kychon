// Members CSV export for the admin members page. The page builds the file in
// the browser from the member records it already loaded through the Capability
// API: `members.list` returns private fields (email, custom_fields) to admins
// only, and no other portal endpoint returns the member list.

export interface MembersCsvRow {
  display_name?: string | null;
  email?: string | null;
  status?: string | null;
  role?: string | null;
  tier_name?: string | null;
  joined_at?: string | null;
  custom_fields?: unknown;
}

const MEMBERS_CSV_HEADERS = ['display_name', 'email', 'status', 'role', 'tier', 'joined_at', 'custom_fields'];

// Spreadsheet apps evaluate a cell that starts with = + - @ (or a tab or
// carriage return) as a formula. Display names and custom fields are
// member-controlled, so such a cell is written with a leading ' to keep it text.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  const safe = FORMULA_START.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildMembersCsv(members: readonly MembersCsvRow[]): string {
  const rows = members.map((member) => [
    member.display_name,
    member.email,
    member.status,
    member.role,
    member.tier_name,
    member.joined_at,
    JSON.stringify(member.custom_fields ?? {}),
  ]);
  return [MEMBERS_CSV_HEADERS.join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n');
}

export function membersCsvHref(members: readonly MembersCsvRow[]): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(buildMembersCsv(members))}`;
}
