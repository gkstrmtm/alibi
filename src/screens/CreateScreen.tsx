import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import { tokens } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CreateScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <ScreenLayout title="Create">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.actions}>
          <Button label="Record voice" onPress={() => navigation.navigate('Recording', { source: 'create' })} />
          <Button label="Type a note" variant="secondary" onPress={() => navigation.navigate('TypeNote', { source: 'create' })} />
          <Button label="Import audio / transcript" variant="secondary" onPress={() => {}} />
        </View>

        <Section title="Capture defaults">
          <View style={styles.defaults}>
            <Text style={styles.defaultItem}>Default project: Inbox</Text>
            <Text style={styles.defaultItem}>Tags: optional</Text>
          </View>
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
  actions: {
    gap: tokens.space[12],
  },
  defaults: {
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    padding: tokens.space[16],
    gap: tokens.space[8],
  },
  defaultItem: {
    fontSize: tokens.font.size[14],
    color: '#6A6A6A',
  },
});
