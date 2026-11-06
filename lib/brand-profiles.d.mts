export type BrandProfileEntry<TProfile = Record<string, unknown>> = { id: string; name: string; profile: TProfile };
export function normalizeBrandProfileEntries<TProfile = Record<string, unknown>>(value: unknown, fallbackProfile?: TProfile): BrandProfileEntry<TProfile>[];
export function createBrandProfileEntry<TProfile = Record<string, unknown>>(id: string, index: number, profile?: TProfile): BrandProfileEntry<TProfile>;
export function canAddBrandProfile(count: number): boolean;
