import { decodeJWT } from "@/lib/token-utils";

const LEGACY_WIZARD_KEY = "terapieWizardCompleted";

function getCurrentUserId(): string | number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = localStorage.getItem("accessToken");
  if (!token) {
    return null;
  }

  const payload = decodeJWT(token);
  return payload?.userId ?? payload?.sub ?? null;
}

export function getWizardStorageKey(): string {
  const userId = getCurrentUserId();
  return userId ? `${LEGACY_WIZARD_KEY}_${userId}` : LEGACY_WIZARD_KEY;
}

export function hasCompletedTerapieWizard(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const scopedKey = getWizardStorageKey();
  return (
    localStorage.getItem(scopedKey) === "true" ||
    localStorage.getItem(LEGACY_WIZARD_KEY) === "true"
  );
}

export function markTerapieWizardCompleted(): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(getWizardStorageKey(), "true");
  localStorage.setItem(LEGACY_WIZARD_KEY, "true");
}
