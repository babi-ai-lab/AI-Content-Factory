const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String(persianDigits.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabicDigits.indexOf(digit)))
    .replace(/[٬,،\s]/g, "")
    .replace(/٫/g, ".");
}

export function parseCampaignMetric(value, { integer = false } = {}) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    if (integer && !Number.isSafeInteger(value)) return null;
    if (!integer && value > 999999999999.99) return null;
    return integer ? value : Math.round(value * 100) / 100;
  }

  const normalized = normalizeDigits(value).trim();
  if (!normalized) return 0;
  const pattern = integer ? /^\d+$/ : /^\d+(?:\.\d{1,2})?$/;
  if (!pattern.test(normalized)) return null;

  const [wholePart] = normalized.split(".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  if (integer && !Number.isSafeInteger(parsed)) return null;
  if (!integer && wholePart.length > 12) return null;
  return integer ? parsed : Math.round(parsed * 100) / 100;
}

function rounded(value) {
  return Math.round(value * 100) / 100;
}

export function calculateCampaignMetrics(input = {}) {
  const impressions = Math.max(0, Number(input.impressions) || 0);
  const clicks = Math.max(0, Number(input.clicks) || 0);
  const leads = Math.max(0, Number(input.leads) || 0);
  const conversions = Math.max(0, Number(input.conversions) || 0);
  const budget = Math.max(0, Number(input.budget) || 0);
  const spend = Math.max(0, Number(input.spend) || 0);
  const revenue = Math.max(0, Number(input.revenue) || 0);

  return {
    ctr: impressions > 0 ? rounded((clicks / impressions) * 100) : null,
    cpl: leads > 0 ? rounded(spend / leads) : null,
    cpa: conversions > 0 ? rounded(spend / conversions) : null,
    conversionRate: clicks > 0 ? rounded((conversions / clicks) * 100) : null,
    budgetUtilization: budget > 0 ? rounded((spend / budget) * 100) : null,
    roas: spend > 0 ? rounded(revenue / spend) : null,
  };
}


export function buildCampaignComparisonCsv(headers, rows) {
  const values = [headers, ...rows];
  return "\uFEFF" + values
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
}
