const REVIEW_STATUS_LABELS = Object.freeze({
  draft: "پیش‌نویس",
  in_review: "در انتظار بازبینی",
  approved: "تأییدشده برای انتشار",
  changes_requested: "نیازمند اصلاح",
});

export const CONTENT_REVIEW_STATUSES = Object.freeze(
  Object.entries(REVIEW_STATUS_LABELS).map(([value, label]) => Object.freeze({ value, label })),
);

export function normalizeContentReviewStatus(value) {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(REVIEW_STATUS_LABELS, value)
    ? value
    : "draft";
}

export function getContentReviewStatusLabel(value) {
  return REVIEW_STATUS_LABELS[normalizeContentReviewStatus(value)];
}
