import { File } from 'expo-file-system';

async function webBlobToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] ?? '' : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(blob);
  });
}

export async function readFileAsBase64(uri: string): Promise<string> {
  if (uri.startsWith('blob:') || uri.startsWith('data:') || uri.startsWith('http://') || uri.startsWith('https://')) {
    return await webBlobToBase64(uri);
  }
  const file = new File(uri);
  const base64 = await file.base64();
  return typeof base64 === 'string' ? base64 : '';
}

export async function readFileAsText(uri: string): Promise<string> {
  if (uri.startsWith('blob:') || uri.startsWith('data:') || uri.startsWith('http://') || uri.startsWith('https://')) {
    const response = await fetch(uri);
    return await response.text();
  }
  const file = new File(uri);
  return await file.text();
}