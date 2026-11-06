export type ContentReviewStatus = "draft" | "in_review" | "approved" | "changes_requested";
export const CONTENT_REVIEW_STATUSES: readonly { value: ContentReviewStatus; label: string }[];
export function normalizeContentReviewStatus(value: unknown): ContentReviewStatus;
export function getContentReviewStatusLabel(value: unknown): string;
