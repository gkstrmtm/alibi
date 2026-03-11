import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/store';
import { Button } from '../components/Button';
import { ListRow } from '../components/ListRow';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import { tokens } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { state } = useAppStore();

  const entries = Object.values(state.entries).sort((a, b) => b.createdAt - a.createdAt);
  const drafts = Object.values(state.drafts).sort((a, b) => b.createdAt - a.createdAt);
  const pinnedProjects = Object.values(state.projects)
    .filter((p) => p.pinned)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 2);

  const processing = entries.some((e) => e.status === 'processing');
  const continueTarget = drafts[0]
    ? { label: 'Review latest draft', onPress: () => navigation.navigate('Output', { draftId: drafts[0].id }) }
    : entries[0]
      ? { label: 'Continue latest entry', onPress: () => navigation.navigate('EntryDetail', { entryId: entries[0].id }) }
      : { label: 'Start your first capture', onPress: () => navigation.navigate('Recording', { source: 'home' }) };

  return (
    <ScreenLayout
      title="Home"
      topRight={processing ? <Text style={styles.processing}>Processing…</Text> : <Text style={styles.topAction}>Search</Text>}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.continueCard}>
          <Text style={styles.continueTitle}>Continue</Text>
          <Text style={styles.continueSubtitle}>{continueTarget.label}</Text>
          <View style={styles.continueButtons}>
            <Button label="Open" onPress={continueTarget.onPress} />
          </View>
        </View>

        <View style={styles.quickRow}>
          <View style={styles.quickItem}>
            <Button label="Record" onPress={() => navigation.navigate('Recording', { source: 'home' })} />
          </View>
          <View style={styles.quickItem}>
            <Button label="Type" variant="secondary" onPress={() => navigation.navigate('TypeNote', { source: 'home' })} />
          </View>
        </View>

        {pinnedProjects.length ? (
          <Section title="Pinned Projects">
            {pinnedProjects.map((p) => (
              <ListRow
                key={p.id}
                title={p.name}
                subtitle={p.type === 'book' ? 'Book project' : 'Project'}
                onPress={() => navigation.navigate('ProjectDetail', { projectId: p.id })}
              />
            ))}
          </Section>
        ) : null}

        <Section title="Recent">
          {entries.slice(0, 5).map((e) => (
            <ListRow
              key={e.id}
              title={e.title}
              subtitle={new Date(e.createdAt).toLocaleString()}
              right={e.status}
              onPress={() => navigation.navigate('EntryDetail', { entryId: e.id })}
            />
          ))}
          {!entries.length ? <Text style={styles.muted}>No entries yet. Tap Record.</Text> : null}
        </Section>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: tokens.space[24],
    gap: tokens.space[16],
  },
  processing: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
  topAction: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
  continueCard: {
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    padding: tokens.space[16],
    gap: tokens.space[8],
  },
  continueTitle: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: '#111111',
  },
  continueSubtitle: {
    fontSize: tokens.font.size[14],
    color: '#6A6A6A',
  },
  continueButtons: {
    paddingTop: tokens.space[8],
  },
  quickRow: {
    flexDirection: 'row',
    gap: tokens.space[12],
  },
  quickItem: {
    flex: 1,
  },
  muted: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
});
