const fs = require('fs');

let code = fs.readFileSync('src/screens/RecordingScreen.tsx', 'utf8');

// 1. Inject imports
if (!code.includes('ScribbleMic')) {
  code = code.replace(
    "import { Button } from '../components/Button';",
    "import { Button } from '../components/Button';\nimport { ScribbleMic } from '../components/ScribbleMic';\nimport { LinearGradient } from 'expo-linear-gradient';"
  );
}

// 2. Fix the toast message error filter (aborted appeal issue)
code = code.replace(
  /useEffect\(\(\) => \{\n\s*if \(\!error\) return;\n\s*setToastMessage\(error\);\n\s*setError\(null\);\n\s*\}, \[error\]\);/,
  `useEffect(() => {
    if (!error) return;
    const msg = error.toLowerCase();
    if (msg.includes('already') || msg.includes('not recording') || msg.includes('abort') || msg.includes('conflict')) {
      setError(null);
      return;
    }
    setToastMessage(error);
    setError(null);
  }, [error]);`
);

// 3. Replace the generic pulse core mic with ScribbleMic
const pulseRegex = /<Animated\.View[\s\S]*?styles\.pulseCore[\s\S]*?<Ionicons name=\{isRecording \? "mic" : "mic-outline"\}[\s\S]*?<\/Animated\.View>/;
if (pulseRegex.test(code)) {
    code = code.replace(pulseRegex, `<ScribbleMic size={visualSize * 0.75} iconSize={42} aggressive={isRecording} />`);
}

// 4. Update the bottomZone to use the pasteboard Nawsome/Spacious gradient buttons and remove generic Start/Cancel.
const bottomZoneRegex = /<View style=\{\[styles\.bottomZone[\s\S]*?<\/View>\s*<\/ScrollView>/;
const replacementBottomZone = `<View style={[styles.bottomZone, { minHeight: metrics.bottomControlHeight, paddingHorizontal: metrics.horizontalFrame }]}>
            {!hasSession ? null : (
              <View style={styles.reviewActionsRow}>
                <Pressable style={styles.reviewDiscardBtn} disabled={isStarting || isStopping} onPress={() => navigation.goBack()}>
                  <Text style={styles.reviewDiscardText}>Discard session</Text>
                </Pressable>
                
                <LinearGradient
                  colors={['#03a9f4', '#f441a5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientBorder}
                >
                    <Pressable style={styles.reviewSubmitBtn} disabled={isStopping} onPress={stopRecording}>
                      <Ionicons name="sparkles" size={16} color={tokens.color.surface} />
                      <Text style={styles.reviewSubmitText}>{isStopping ? 'Saving...' : 'Generate'}</Text>
                    </Pressable>
                </LinearGradient>
              </View>
            )}
          </View>
        </ScrollView>`;

if (bottomZoneRegex.test(code)) {
    code = code.replace(bottomZoneRegex, replacementBottomZone);
}

// 5. Change the "PulseWrap" `onPress` action so tapping the mic pauses or starts
const pulseWrapRegex = /<Pressable\s*onPress=\{isRecording \? undefined : undefined\}\s*style=\{\[styles\.pulseWrap/g;
if (pulseWrapRegex.test(code)) {
    code = code.replace(pulseWrapRegex, `<Pressable onPress={hasSession ? togglePause : startRecording} style={[styles.pulseWrap`);
} else {
    // If it's already modified or looks different
    const fallbackPulseWrap = /<Pressable\s*onPress=\{[^\}]*\}\s*style=\{\[styles\.pulseWrap/;
    if (fallbackPulseWrap.test(code)) {
        code = code.replace(fallbackPulseWrap, `<Pressable onPress={hasSession ? togglePause : startRecording} style={[styles.pulseWrap`);
    }
}

// 6. Clean up styles injection manually
const styleIndex = code.lastIndexOf('});');
if (styleIndex !== -1 && !code.includes('reviewSubmitBtn: {')) {
    const textBefore = code.substring(0, styleIndex);
    const textAfter = code.substring(styleIndex);
    
    code = textBefore + `,
  reviewActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[16],
    width: '100%',
    justifyContent: 'center',
  },
  reviewDiscardBtn: {
    paddingVertical: tokens.space[14],
    paddingHorizontal: tokens.space[24],
    borderRadius: 999,
    backgroundColor: tokens.color.surface,
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  reviewDiscardText: {
    fontFamily: 'Inter-Medium',
    fontSize: tokens.font.size[14],
    color: tokens.color.textMuted,
  },
  gradientBorder: {
    flex: 1.5,
    borderRadius: 999,
    padding: 2, 
  },
  reviewSubmitBtn: {
    paddingVertical: tokens.space[12],
    paddingHorizontal: tokens.space[24],
    borderRadius: 999,
    backgroundColor: '#000', // matches the gradient container look
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[8],
  },
  reviewSubmitText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: tokens.font.size[14],
    color: tokens.color.surface,
  }
` + textAfter;
}

fs.writeFileSync('src/screens/RecordingScreen.tsx', code);
console.log('RecordingScreen patched successfully!');
