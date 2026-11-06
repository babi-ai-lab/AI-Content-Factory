const MAX_BRANDS = 10;

export function normalizeBrandProfileEntries(value, fallbackProfile = {}) {
  const candidates = Array.isArray(value) ? value.slice(0, MAX_BRANDS) : [];
  const normalized = candidates.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const id = typeof entry.id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(entry.id)
      ? entry.id
      : `brand-${index + 1}`;
    const name = typeof entry.name === "string" && entry.name.trim()
      ? entry.name.trim().slice(0, 120)
      : `برند ${index + 1}`;
    const profile = entry.profile && typeof entry.profile === "object" && !Array.isArray(entry.profile)
      ? entry.profile
      : {};
    return [{ id, name, profile }];
  });
  const unique = normalized.filter((entry, index, all) => all.findIndex((item) => item.id === entry.id) === index);
  if (unique.length) return unique;

  const legacyName = fallbackProfile && typeof fallbackProfile.brandName === "string"
    ? fallbackProfile.brandName.trim().slice(0, 120)
    : "";
  return [{
    id: "default",
    name: legacyName || "برند اول",
    profile: fallbackProfile && typeof fallbackProfile === "object" && !Array.isArray(fallbackProfile)
      ? fallbackProfile
      : {},
  }];
}

export function createBrandProfileEntry(id, index, profile = {}) {
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) {
    throw new TypeError("شناسه برند معتبر نیست.");
  }
  if (!Number.isInteger(index) || index < 1 || index > MAX_BRANDS) {
    throw new RangeError("حداکثر ۱۰ برند برای هر حساب قابل تعریف است.");
  }
  return { id, name: `برند جدید ${index}`, profile };
}

export function canAddBrandProfile(count) {
  return Number.isInteger(count) && count >= 0 && count < MAX_BRANDS;
}
