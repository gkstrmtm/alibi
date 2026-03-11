import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/store';
import { ListRow } from '../components/ListRow';
import { ScreenLayout } from '../components/ScreenLayout';
import { tokens } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function VaultScreen() {
  const navigation = useNavigation<Nav>();
  const { state } = useAppStore();

  const entries = Object.values(state.entries).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <ScreenLayout title="Vault" topRight={<Text style={styles.topAction}>Search</Text>}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.filters}>
          <Text style={styles.filterChip}>All</Text>
          <Text style={styles.filterChip}>Captured</Text>
          <Text style={styles.filterChip}>Digested</Text>
          <Text style={styles.filterChip}>Drafted</Text>
        </View>

        <View style={styles.list}>
          {entries.map((e) => (
            <ListRow
              key={e.id}
              title={e.title}
              subtitle={new Date(e.createdAt).toLocaleString()}
              right={e.status}
              onPress={() => navigation.navigate('EntryDetail', { entryId: e.id })}
            />
          ))}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: tokens.space[24],
    gap: tokens.space[16],
  },
  topAction: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
  filters: {
    flexDirection: 'row',
    gap: tokens.space[8],
  },
  filterChip: {
    paddingVertical: tokens.space[8],
    paddingHorizontal: tokens.space[12],
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    fontSize: tokens.font.size[12],
    color: '#111111',
  },
  list: {
    gap: tokens.space[12],
  },
});
