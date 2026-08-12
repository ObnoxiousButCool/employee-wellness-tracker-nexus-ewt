/**
 * Client-side pub/sub for cross-component wellness-data invalidation. The
 * dashboard's `/api/dashboard/summary` data derives from `wellness_entries`
 * (see API Contract 3d), so a successful `POST /api/wellness/entries` (S3)
 * makes any mounted dashboard stale. There is no shared query cache/store in
 * this project, so this dispatches a same-tab `CustomEvent` on `window`
 * instead of polling — any dashboard mounted in the same browser tab
 * refetches immediately, and nothing happens if none is mounted.
 */

const WELLNESS_ENTRY_SUBMITTED_EVENT = "ewt:wellness-entry-submitted";

/** Called after a successful wellness entry submission (POST /api/wellness/entries). */
export function notifyWellnessEntrySubmitted() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WELLNESS_ENTRY_SUBMITTED_EVENT));
}

/**
 * Subscribes `onSubmitted` to wellness-entry-submitted notifications.
 * Returns an unsubscribe function for use in a `useEffect` cleanup.
 */
export function subscribeToWellnessEntrySubmitted(onSubmitted) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(WELLNESS_ENTRY_SUBMITTED_EVENT, onSubmitted);
  return () => window.removeEventListener(WELLNESS_ENTRY_SUBMITTED_EVENT, onSubmitted);
}
