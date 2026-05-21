const AUDIT_COUNT_KEY = "launchroast-audit-count";

export function getStoredAuditCount() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const rawValue = window.localStorage.getItem(AUDIT_COUNT_KEY);
    const parsed = Number(rawValue ?? "0");

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function incrementStoredAuditCount() {
  const nextValue = getStoredAuditCount() + 1;

  try {
    window.localStorage.setItem(AUDIT_COUNT_KEY, String(nextValue));
  } catch {
    return nextValue;
  }

  return nextValue;
}
