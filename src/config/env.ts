export function getApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL;
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
