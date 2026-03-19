import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import { Platform } from 'react-native';
import { useState } from 'react';

import { getSupabaseClient } from '../supabase/client';
import { useAppStore } from '../store/store';
import { makeId } from '../utils/id';
import { readFileAsText } from '../utils/fileAccess';

type UseImportMediaOptions = {
  onMessage?: (message: string | null) => void;
};

type PickedAsset = {
  uri: string;
  name?: string;
  mimeType?: string;
  size?: number;
  file?: File;
};

function safePathSegment(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'file';
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function seemsTextFile(filename?: string, mimeType?: string): boolean {
  if (typeof mimeType === 'string' && mimeType.startsWith('text/')) return true;
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return lower.endsWith('.txt') || lower.endsWith('.md');
}

async function pickDocumentForPlatform(): Promise<PickedAsset | undefined> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return await new Promise<PickedAsset | undefined>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '*/*';
      input.style.position = 'fixed';
      input.style.left = '-9999px';

      let settled = false;
      let focusTimeout: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (focusTimeout) {
          clearTimeout(focusTimeout);
          focusTimeout = null;
        }
        window.removeEventListener('focus', handleFocus, true);
        input.remove();
      };

      const finish = (value?: PickedAsset) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const handleFocus = () => {
        focusTimeout = setTimeout(() => finish(undefined), 350);
      };

      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          finish(undefined);
          return;
        }

        const uri = URL.createObjectURL(file);
        finish({
          uri,
          name: file.name,
          mimeType: file.type || undefined,
          size: file.size,
          file,
        });
      };

      window.addEventListener('focus', handleFocus, true);
      document.body.appendChild(input);
      input.click();
    });
  }

  const picked = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: false,
    copyToCacheDirectory: true,
  });

  if ((picked as any).canceled) return undefined;

  const asset = Array.isArray((picked as any).assets) ? (picked as any).assets[0] : (picked as any);
  const uri = typeof asset?.uri === 'string' ? asset.uri : undefined;
  if (!uri) return undefined;

  return {
    uri,
    name: typeof asset?.name === 'string' ? asset.name : undefined,
    mimeType: typeof asset?.mimeType === 'string' ? asset.mimeType : undefined,
    size: typeof asset?.size === 'number' ? asset.size : undefined,
  };
}

export function useImportMedia(options?: UseImportMediaOptions) {
  const navigation = useNavigation<any>();
  const { state, dispatch } = useAppStore();
  const [isImporting, setIsImporting] = useState(false);
  const onMessage = options?.onMessage;

  const importMedia = async () => {
    if (isImporting) return;
    const supabase = getSupabaseClient();
    const signedIn = state.auth.status === 'signedIn' && Boolean(state.auth.userId);
    
    setIsImporting(true);
    onMessage?.(null);
    try {
      const asset = await pickDocumentForPlatform();
      const uri = asset?.uri;
      if (!uri) throw new Error('No file selected');

      const filename = typeof asset?.name === 'string' ? asset.name : undefined;
      const mimeType = typeof asset?.mimeType === 'string' ? asset.mimeType : undefined;
      const sizeBytes = typeof asset?.size === 'number' ? asset.size : undefined;
      const kind = typeof mimeType === 'string' && mimeType.startsWith('video/') ? 'video' : 'upload';
      const entryId = makeId('entry');

      if (seemsTextFile(filename, mimeType)) {
        const transcript = asset?.file ? await asset.file.text() : await readFileAsText(uri);
        dispatch({
          type: 'entry.createImportTranscript',
          payload: {
            entryId,
            title: filename ? filename.replace(/\.[^.]+$/, '') : 'Imported transcript',
            transcript,
          },
        });
        navigation.navigate('EntryDetail', { entryId });
        onMessage?.('Imported transcript');
        return;
      }

      let mediaBucket: string | undefined;
      let mediaPath: string | undefined;

      if (supabase && signedIn) {
        const session = (await supabase.auth.getSession()).data.session;
        const userId = session?.user?.id;

        if (userId) {
          const bucket = 'alibi-media';
          const nameSegment = safePathSegment(filename ?? 'upload');
          const path = `${userId}/${entryId}/${nameSegment}`;

          const blob = asset?.file ?? (await (await fetch(uri)).blob());
          const upload = await supabase.storage.from(bucket).upload(path, blob, {
            contentType: mimeType,
            upsert: true,
          });
          if (upload.error) throw new Error(upload.error.message);

          mediaBucket = bucket;
          mediaPath = path;
        }
      }

      dispatch({
        type: 'entry.createUpload',
        payload: {
          entryId,
          title: filename ? filename.replace(/\.[^.]+$/, '') : kind === 'video' ? 'Uploaded video' : 'Uploaded file',
          kind,
          localUri: uri,
          filename,
          sizeBytes,
          mimeType,
          mediaBucket,
          mediaPath,
        },
      });

      navigation.navigate('EntryDetail', {
        entryId,
        autoExtract: kind === 'upload' && Boolean(mimeType?.startsWith('audio/')),
      });
      onMessage?.(mediaBucket ? 'Imported upload' : 'Imported into app');
    } catch (e: any) {
      onMessage?.(e?.message || 'Import failed');
      console.warn('Import failed', e);
    } finally {
      setIsImporting(false);
    }
  };

  return { importMedia, isImporting };
}