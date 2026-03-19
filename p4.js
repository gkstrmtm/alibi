const fs = require('fs');

let code = fs.readFileSync('src/screens/RecordingScreen.tsx', 'utf8');

// The issue stems from a regex mismatch adding styles to the top of the file!

// 1. Add states
const stateInjection = `const [reviewState, setReviewState] = useState<{ transcript: string, durationSec: number, audioUri?: string, mimeType?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);`;
code = code.replace(/const \[toastMessage, setToastMessage\] = useState<string \| null>\(null\);/, 'const [toastMessage, setToastMessage] = useState<string | null>(null);\n  ' + stateInjection);

// 2. Add imports
if (!code.includes('ActivityIndicator')) {
  code = "import { ActivityIndicator } from 'react-native';\n" + code;
}

// 3. Fix stopRecording and submitCapture
const regex = /async function stopRecording\(\) \{[\s\S]*?finally \{\s*setIsStopping\(false\);\s*\}\s*\}/;

const replacement = `async function stopRecording() {
    if ((!recording && !isWeb) || isStarting || isStopping) return;
    passiveCommandModeRef.current = false;
    // Don't clear error right away so we can track issues
    setIsStopping(true);
    try {
      speechShouldRunRef.current = false;
      await stopSpeechRecognitionSession();
      const durationSec = elapsedSec;
      const recognizedTranscript = typeof liveTranscript === 'string' ? liveTranscript.trim() : '';
      setIsRecording(false);
      triggerMediumFeedback();

      if (isWeb) {
        if (!recognizedTranscript) {
          setError('Nothing was heard. Check the browser microphone permission and try again.');
          setElapsedSec(0);
          return;
        }
        setReviewState({ transcript: recognizedTranscript, durationSec });
      } else {
        const nativeRecording = recording;
        if (!nativeRecording) {
            setError('Recording session missing');
            return;
        }
        try {
            await nativeRecording.stopAndUnloadAsync();
        } catch (e: any) {
            console.log('Orphan stop error', e);
        }
        const uri = nativeRecording.getURI();
        setRecording(null);
        recordingRef.current = null;
        if (!uri) {
            setError('Recording file missing');
            return;
        }
        const mimeType = guessAudioMimeType(uri);
        setReviewState({ transcript: recognizedTranscript, durationSec, audioUri: uri, mimeType });
      }
    } catch (e: any) {
      // Silence 'already stopped' or 'not recording' errors
      const msg = e?.message || '';
      if (!msg.toLowerCase().includes('already') && !msg.toLowerCase().includes('not recording')) {
        setError('Failed to stop recording: ' + msg);
      }
    } finally {
      setIsStopping(false);
    }
  }

  async function submitCapture() {
    if (!reviewState) return;
    setIsSubmitting(true);
    try {
      const entryId = makeId('entry');
      const workingTitle = recordingTitle ?? makeInstantRecordingTitle();
      
      let finalAudioUri = reviewState.audioUri;
      let finalMimeType = reviewState.mimeType;

      let base64Audio;
      if (finalAudioUri && finalMimeType) {
        base64Audio = await readFileAsBase64(finalAudioUri);
      }

      const isVoice = Boolean(finalAudioUri && finalMimeType);

      if (isVoice) {
          dispatch({
            type: 'entry.createRecording',
            payload: {
              entryId,
              title: workingTitle,
              audioUri: finalAudioUri!,
              audioMimeType: finalMimeType!,
              durationSec: reviewState.durationSec,
              intent: recordingIntent,
              intakeKey,
            },
          });
      } else {
          dispatch({
            type: 'entry.createText',
            payload: {
              entryId,
              title: workingTitle,
              text: reviewState.transcript,
              intent: recordingIntent,
              intakeKey,
            },
          });
      }

      if (projectId) {
        dispatch({ type: 'project.addEntry', payload: { projectId, entryId } });
        dispatch({ type: 'entry.setStatus', payload: { entryId, status: 'processing' } });
      }

      const result = await extractEntry(
        {
          title: workingTitle,
          transcript: reviewState.transcript,
          intent: recordingIntent,
          voice,
          ...(base64Audio ? { audio: { base64: base64Audio, mimeType: finalMimeType!, filename: 'audio' } } : {})
        },
        { baseUrl: state.settings.apiBaseUrlOverride },
      );

      if (result.ok) {
        dispatch({
          type: 'entry.setExtraction',
          payload: {
            entryId,
            title: result.title,
            transcript: result.transcript,
            highlights: result.highlights,
            themes: result.themes,
            ideas: result.ideas,
          },
        });
        triggerSuccessFeedback();
        void playFeedbackSound('success');
      } else {
        dispatch({ type: 'entry.setStatus', payload: { entryId, status: 'captured' } });
        triggerMediumFeedback();
      }

      if (projectId && returnTo === 'studio') {
        navigation.replace('Studio', { projectId });
        return;
      }
      if (projectId && returnTo === 'project') {
        navigation.replace('ProjectDetail', { projectId });
        return;
      }
      if (returnTo === 'output' && draftId) {
        navigation.replace('Output', { draftId });
        return;
      }
      navigation.replace('EntryDetail', { entryId, autoExtract: true });

    } catch (e: any) {
      setError(e?.message || 'Submit failed');
    } finally {
      setIsSubmitting(false);
    }
  }`;

code = code.replace(regex, replacement);

const regexCenter = /<Pressable onPress=\{hasSession \? togglePause : startRecording\} style=\{\[styles\.pulseWrap, \{ width: visualSize, height: visualSize \}\]\}>\s*<Ionicons name="mic" size=\{42\} color=\{tokens\.color\.surface\} \/>\s*<\/Pressable>/;

const replacementCenter = `<View style={styles.micStage}>
              {hasSession && !isRecording && !reviewState && (
                <Pressable onPress={() => navigation.goBack()} style={styles.stageActionLeft}>
                  <Ionicons name="trash-outline" size={24} color={tokens.color.textMuted} />
                </Pressable>
              )}
              
              <Pressable onPress={hasSession ? togglePause : startRecording} style={[styles.pulseWrap, { width: visualSize, height: visualSize }]}>
                {isStarting || isStopping ? (
                  <ActivityIndicator size="large" color={tokens.color.text} />
                ) : (
                  <ScribbleMic size={visualSize * 0.75} iconSize={42} aggressive={isRecording} />
                )}
              </Pressable>

              {hasSession && !isRecording && !reviewState && (
                <Pressable onPress={stopRecording} style={styles.stageActionRight}>
                  <Ionicons name="checkmark" size={24} color={tokens.color.surface} />
                </Pressable>
              )}
            </View>`;

if (code.includes('<Ionicons name="mic" size={42}')) {
    code = code.replace(regexCenter, replacementCenter);
} else {
    const backupCenter = /<Pressable onPress=\{hasSession \? togglePause : startRecording\}[\s\S]*?<\/Pressable>/;
    code = code.replace(backupCenter, replacementCenter);
}


const regexBottom = /<View style=\{\[styles\.bottomZone[\s\S]*?<\/View>\s*<\/ScrollView>/;

const replacementBottom = `<View style={[styles.bottomZone, { minHeight: metrics.bottomControlHeight, paddingHorizontal: metrics.horizontalFrame }]}>
          {reviewState ? (
            <View style={styles.reviewActionsRow}>
              <Pressable style={styles.reviewDiscardBtn} disabled={isSubmitting} onPress={() => { setReviewState(null); navigation.goBack() }}>
                <Text style={styles.reviewDiscardText}>Discard session</Text>
              </Pressable>
              
              <Pressable style={styles.reviewSubmitBtn} disabled={isSubmitting} onPress={submitCapture}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={tokens.color.surface} />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color={tokens.color.surface} />
                    <Text style={styles.reviewSubmitText}>Generate Draft</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
        </ScrollView>`;

code = code.replace(regexBottom, replacementBottom);

code = code.replace(/sessionTitle === 'Open capture' \? 'Catch the thought now\. Shape it later\.' : 'Tap the mic to pause'/, "hasSession ? (isRecording ? 'Tap the mic to pause' : 'Tap the mic to resume / Save to generate') : 'Tap the microphone to begin.'");

const styleIndexStart = code.lastIndexOf('const styles = StyleSheet.create({');

if (styleIndexStart !== -1) {
    const mainLastIndex = code.lastIndexOf('});');
    
    // Instead of messing with substrings, lets just replace the match
    const newStylesBlock = `const styles = StyleSheet.create({
  micStage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 200,
    width: '100%',
  },
  stageActionLeft: {
    padding: tokens.space[16],
    position: 'absolute',
    left: '8%',
    zIndex: 10,
    backgroundColor: tokens.color.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    shadowColor: tokens.color.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  stageActionRight: {
    padding: tokens.space[16],
    position: 'absolute',
    right: '8%',
    zIndex: 10,
    backgroundColor: tokens.color.accent,
    borderRadius: 999,
    shadowColor: tokens.color.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  reviewActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[16],
    width: '100%',
    justifyContent: 'center',
  },
  reviewDiscardBtn: {
    paddingVertical: tokens.space[12],
    paddingHorizontal: tokens.space[24],
    borderRadius: 999,
    backgroundColor: tokens.color.surface,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.color.border,
  },
  reviewDiscardText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: tokens.color.textMuted,
  },
  reviewSubmitBtn: {
    flex: 1.5,
    paddingVertical: tokens.space[12],
    paddingHorizontal: tokens.space[24],
    borderRadius: 999,
    backgroundColor: tokens.color.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[8],
  },
  reviewSubmitText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 15,
    color: tokens.color.surface,
  },`;

    code = code.replace('const styles = StyleSheet.create({', newStylesBlock);
}

// startRecording fix
const startRegex = /async function startRecording\(\) \{[\s\S]*?\}\s*catch\s*\(e:\s*any\)\s*\{\s*setError\(e\?\.message \|\| 'Recording failed to start'\);\s*\}\s*finally\s*\{\s*setIsStarting\(false\);\s*\}\s*\}/;
code = code.replace(startRegex, (match) => {
    return match.replace(/setError\(e\?.message \|\| 'Recording failed to start'\);/, `
      const msg = e?.message || '';
      if (!msg.toLowerCase().includes('already') && !msg.toLowerCase().includes('not recording') && !msg.toLowerCase().includes('conflict')) {
        setError(msg || 'Recording failed to start');
      }
    `);
});

// Avoid "Recording started" and "Already recording" race conditions from another start hook
const toggleRegex = /async function togglePause\(\) \{[\s\S]*?catch\s*\(e:\s*any\)\s*\{\s*setError\(e\?\.message \|\| 'Failed to toggle recording'\);\s*\}\s*\}/;
code = code.replace(toggleRegex, (match) => {
    return match.replace(/setError\(e\?.message \|\| 'Failed to toggle recording'\);/, `
      const msg = e?.message || '';
      if (!msg.toLowerCase().includes('already') && !msg.toLowerCase().includes('not recording') && !msg.toLowerCase().includes('conflict')) {
        setError(msg || 'Failed to toggle capture state');
      }
    `);
});

fs.writeFileSync('src/screens/RecordingScreen.tsx', code);
console.log('Restored all capture logic and fixed startRecording error trap');