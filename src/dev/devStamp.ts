import { NativeModules, Platform } from 'react-native';

function getScriptUrl(): string | undefined {
  const sourceCode = (NativeModules as any)?.SourceCode;
  const scriptURL = sourceCode?.scriptURL as string | undefined;
  return scriptURL;
}

function normalize(url: string): string {
  // Drop protocol + query to keep this short.
  return url.replace(/^https?:\/\//, '').split('?')[0] ?? url;
}

const scriptUrl = getScriptUrl();

// Evaluated on module load. If you reload / reconnect to a different Metro session,
// this should change, making it an easy “am I seeing the latest bundle?” indicator.
export const DEV_STAMP = __DEV__
  ? `${new Date().toISOString()} • ${Platform.OS} • ${scriptUrl ? normalize(scriptUrl) : 'no-script-url'}`
  : '';
