export function normalizeBaseUrl(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getApiBaseUrl(): string {
  return normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
}
