import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from './types';
import { Tabs } from './Tabs';
import { RecordingScreen } from '../screens/RecordingScreen';
import { TypeNoteScreen } from '../screens/TypeNoteScreen';
import { EntryDetailScreen } from '../screens/EntryDetailScreen';
import { ProjectDetailScreen } from '../screens/ProjectDetailScreen';
import { StudioScreen } from '../screens/StudioScreen';
import { OutputScreen } from '../screens/OutputScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Recording" component={RecordingScreen} />
      <Stack.Screen name="TypeNote" component={TypeNoteScreen} />
      <Stack.Screen name="EntryDetail" component={EntryDetailScreen} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      <Stack.Screen name="Studio" component={StudioScreen} />
      <Stack.Screen name="Output" component={OutputScreen} />
    </Stack.Navigator>
  );
}
