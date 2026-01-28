const HIDDEN_SERVICE_KEYWORDS = ["hub", "hubplay", "telemedicina", "telepet"];

export function isHiddenServiceName(name?: string | null): boolean {
  if (!name) return false;
  const normalized = name.toLowerCase();
  return HIDDEN_SERVICE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function hiddenServiceKeywords(): string[] {
  return [...HIDDEN_SERVICE_KEYWORDS];
}
