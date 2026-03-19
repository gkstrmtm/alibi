const fs = require('fs');
let code = fs.readFileSync('src/screens/RecordingScreen.tsx', 'utf8');

if (!code.includes('ScribbleMic')) {
  code = code.replace(/import \{ StyleSheet, Text, View \} from 'react-native';/, "import { StyleSheet, Text, View, Pressable } from 'react-native';\nimport { ScribbleMic } from '../components/ScribbleMic';\nimport { Ionicons } from '@expo/vector-icons';\nimport { LinearGradient } from 'expo-linear-gradient';");
}

code = code.replace(/<View style=\{styles\.container\}>[\s\S]*?<\/View>\s*<\/ScreenLayout>/, `<View style={styles.container}>
        <View style={styles.micStage}>
            <Pressable onPress={() => setIsRecording(v => !v)} style={styles.pulseWrap}>
              <ScribbleMic size={240} iconSize={64} aggressive={isRecording} />
            </Pressable>
        </View>

        <Text style={styles.time}>{formatTime(elapsedSec)}</Text>
        <Text style={styles.hintText}>{isRecording ? "Tap the mic to pause" : "Tap the mic to resume / Save to generate"}</Text>

        <View style={styles.bottomZone}>
            <View style={styles.reviewActionsRow}>
              <Pressable style={styles.reviewDiscardBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.reviewDiscardText}>Discard session</Text>
              </Pressable>
              
              <LinearGradient
                colors={['#03a9f4', '#f441a5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBorder}
              >
                  <Pressable style={styles.reviewSubmitBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="sparkles" size={16} color={tokens.color.surface} />
                    <Text style={styles.reviewSubmitText}>Generate</Text>
                  </Pressable>
              </LinearGradient>
            </View>
        </View>
      </View>
    </ScreenLayout>`);

const stylesToAdd = `
  micStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  pulseWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomZone: {
    width: '100%',
    paddingBottom: 40,
    paddingTop: 20,
    paddingHorizontal: tokens.space[16],
  },
  hintText: {
    fontSize: tokens.font.size[14],
    color: tokens.color.textMuted,
    marginBottom: tokens.space[24],
  },
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
    borderColor: tokens.color.border,
  },
  reviewDiscardText: {
    fontSize: 15,
    color: tokens.color.textMuted,
    fontWeight: '600',
  },
  gradientBorder: {
    flex: 1,
    borderRadius: 999,
    padding: 3, 
  },
  reviewSubmitBtn: {
    paddingVertical: tokens.space[12],
    paddingHorizontal: tokens.space[20],
    borderRadius: 999,
    backgroundColor: tokens.color.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[8],
  },
  reviewSubmitText: {
    fontSize: 15,
    color: tokens.color.surface,
    fontWeight: '600',
  },
`;

code = code.replace(/const styles = StyleSheet\.create\(\{/, 'const styles = StyleSheet.create({' + stylesToAdd);

fs.writeFileSync('src/screens/RecordingScreen.tsx', code);
