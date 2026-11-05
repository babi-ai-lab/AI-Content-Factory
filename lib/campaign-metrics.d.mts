export type CampaignMetricInput = {
  impressions?: number;
  clicks?: number;
  leads?: number;
  conversions?: number;
  budget?: number;
  spend?: number;
  revenue?: number;
};
export type CampaignMetricResults = {
  ctr: number | null;
  cpl: number | null;
  cpa: number | null;
  conversionRate: number | null;
  budgetUtilization: number | null;
  roas: number | null;
};
export function parseCampaignMetric(value: string | number | null | undefined, options?: { integer?: boolean }): number | null;
export function calculateCampaignMetrics(input?: CampaignMetricInput): CampaignMetricResults;
