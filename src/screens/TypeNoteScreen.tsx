import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { tokens } from '../theme/tokens';
import { useAppStore } from '../store/store';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TypeNoteScreen() {
  const navigation = useNavigation<Nav>();
  const { dispatch } = useAppStore();
  const [text, setText] = useState('');

  return (
    <ScreenLayout
      title="Type"
      stickyBottom={
        <View style={styles.stickyRow}>
          <Button label="Save" onPress={() => {
            dispatch({ type: 'entry.createText', payload: { text } });
            navigation.navigate('Tabs');
          }} disabled={!text.trim()} />
        </View>
      }
    >
      <View style={styles.container}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Write the raw thought. You can shape it later."
          multiline
          style={styles.input}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    padding: tokens.space[16],
    textAlignVertical: 'top',
    fontSize: tokens.font.size[16],
    color: '#111111',
  },
  stickyRow: {
    flexDirection: 'row',
  },
});
