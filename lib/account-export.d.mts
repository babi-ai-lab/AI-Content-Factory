export type AccountExportUser = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};
export const ACCOUNT_EXPORT_TABLES: ReadonlyArray<{
  key: string;
  table: string;
  columns: string;
  orderBy: string;
}>;
export function createAccountExportPayload(
  user: AccountExportUser,
  data: Record<string, unknown[]>,
  exportedAt?: Date | string,
): {
  format: string;
  schemaVersion: number;
  exportedAt: string;
  account: { id: string; email: string | null; createdAt: string | null; userMetadata: Record<string, unknown> };
  data: Record<string, unknown[]>;
  included: string[];
  excluded: string[];
};
