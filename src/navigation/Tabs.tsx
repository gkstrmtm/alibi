import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import type { RootTabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { VaultScreen } from '../screens/VaultScreen';
import { CreateScreen } from '../screens/CreateScreen';
import { ProjectsScreen } from '../screens/ProjectsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

export function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Vault" component={VaultScreen} />
      <Tab.Screen name="Create" component={CreateScreen} />
      <Tab.Screen name="Projects" component={ProjectsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
