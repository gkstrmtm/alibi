const fs = require('fs');

let code = fs.readFileSync('src/screens/RecordingScreen.tsx', 'utf8');

// 1. Inject imports safely at top
if (!code.includes('ScribbleMic')) {
    const importPosition = code.indexOf('import { Button }');
    if (importPosition !== -1) {
        code = code.slice(0, importPosition) + "import { ScribbleMic } from '../components/ScribbleMic';\nimport { LinearGradient } from 'expo-linear-gradient';\n" + code.slice(importPosition);
    }
}

// 2. Fix the toast message error filter exactly
const oldEffect = `useEffect(() => {
    if (!error) return;
    setToastMessage(error);
    setError(null);
  }, [error]);`;

const newEffect = `useEffect(() => {
    if (!error) return;
    const msg = error.toLowerCase();
    if (msg.includes('already') || msg.includes('not recording') || msg.includes('abort') || msg.includes('conflict')) {
      setError(null);
      return;
    }
    setToastMessage(error);
    setError(null);
  }, [error]);`;

code = code.replace(oldEffect, newEffect);

// 3. Replace the inner view of pulseWrap with ScribbleMic safely
const startAnchor = "<Animated.View";
const midAnchor = "styles.pulseCore,";
const idxStart = code.lastIndexOf(startAnchor, code.indexOf(midAnchor));
if (idxStart !== -1) {
    const endStr = "</Animated.View>";
    const idxEnd = code.indexOf(endStr, idxStart) + endStr.length;
    
    code = code.substring(0, idxStart) + 
           `<ScribbleMic size={visualSize * 0.85} iconSize={64} aggressive={isRecording} />` + 
           code.substring(idxEnd);
}

// 4. Update the bottomZone safely
const bottomZoneStart = "<View style={[styles.bottomZone,";
const bottomZoneIdx = code.indexOf(bottomZoneStart);
if (bottomZoneIdx !== -1) {
    const scrollViewEnd = "</ScrollView>";
    const svEndIdx = code.indexOf(scrollViewEnd, bottomZoneIdx);
    
    if (svEndIdx !== -1) {
        const textBefore = code.substring(0, bottomZoneIdx);
        const textAfter = code.substring(svEndIdx);
        
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
          `;
          
        code = textBefore + replacementBottomZone + textAfter;
    }
}

// 5. Change pulseWrap onPress to pause/start
code = code.replace(/<Pressable\n?\s*onPress=\{[^\}]+\}\s*\n?\s*style=\{\[\n?\s*styles\.pulseWrap/g, `<Pressable onPress={hasSession ? togglePause : startRecording} style={[styles.pulseWrap`);


// 6. Safe Styles Injection
const styleAnchor = 'const styles = StyleSheet.create({';
const styleIdx = code.indexOf(styleAnchor);
if (styleIdx !== -1 && !code.includes('reviewSubmitBtn:')) {
    const injection = `
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
    backgroundColor: '#000', 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[8],
  },
  reviewSubmitText: {
    fontFamily: 'Inter-SemiBold',
    fontSize: tokens.font.size[14],
    color: tokens.color.surface,
  },`;
  
    code = code.slice(0, styleIdx + styleAnchor.length) + injection + code.slice(styleIdx + styleAnchor.length);
}

fs.writeFileSync('src/screens/RecordingScreen.tsx', code);
console.log('Done safely!');
