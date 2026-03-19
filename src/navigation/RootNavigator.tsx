import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from './types';
import { Tabs } from './Tabs';
import { CreateScreen } from '../screens/CreateScreen';
import { RecordingScreen } from '../screens/RecordingScreen';
import { TypeNoteScreen } from '../screens/TypeNoteScreen';
import { EntryDetailScreen } from '../screens/EntryDetailScreen';
import { ProjectDetailScreen } from '../screens/ProjectDetailScreen';
import { NewProjectScreen } from '../screens/NewProjectScreen';
import { SelectProjectScreen } from '../screens/SelectProjectScreen';
import { SelectEntriesScreen } from '../screens/SelectEntriesScreen';
import { StudioScreen } from '../screens/StudioScreen';
import { OutputScreen } from '../screens/OutputScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { ApiSettingsScreen } from '../screens/ApiSettingsScreen';
import { ProjectSettingsScreen } from '../screens/ProjectSettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Create" component={CreateScreen} />
      <Stack.Screen name="Recording" component={RecordingScreen} />
      <Stack.Screen name="TypeNote" component={TypeNoteScreen} />
      <Stack.Screen name="EntryDetail" component={EntryDetailScreen} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />     
      <Stack.Screen name="ProjectSettings" component={ProjectSettingsScreen} />
      <Stack.Screen name="NewProject" component={NewProjectScreen} />
      <Stack.Screen name="SelectProject" component={SelectProjectScreen} />
      <Stack.Screen name="SelectEntries" component={SelectEntriesScreen} />
      <Stack.Screen name="Studio" component={StudioScreen} />
      <Stack.Screen name="Output" component={OutputScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="ApiSettings" component={ApiSettingsScreen} />
    </Stack.Navigator>
  );
}
