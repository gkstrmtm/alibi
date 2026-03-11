import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenLayout } from '../components/ScreenLayout';
import { ListRow } from '../components/ListRow';
import { Section } from '../components/Section';
import { tokens } from '../theme/tokens';

export function ProfileScreen() {
  return (
    <ScreenLayout title="Profile">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <Text style={styles.name}>Account</Text>
          <Text style={styles.meta}>Plan: Free (placeholder)</Text>
        </View>

        <Section title="Privacy">
          <ListRow title="What’s stored" subtitle="Audio, transcripts, extracts, drafts" onPress={() => {}} />
          <ListRow title="Delete data" subtitle="Delete entries/projects" onPress={() => {}} />
        </Section>

        <Section title="Settings">
          <ListRow title="Notifications" subtitle="Off by default" onPress={() => {}} />
          <ListRow title="Subscription" subtitle="Manage" onPress={() => {}} />
          <ListRow title="Help" subtitle="Support" onPress={() => {}} />
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
  headerCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  name: {
    fontSize: tokens.font.size[18],
    fontWeight: tokens.font.weight.semibold,
    color: '#111111',
  },
  meta: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
});
