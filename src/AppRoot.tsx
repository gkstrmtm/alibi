import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Platform, StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppStoreProvider } from './store/store';
import { RootNavigator } from './navigation/RootNavigator';
import { PrelaunchWaitlistScreen } from './screens/PrelaunchWaitlistScreen';
import { DESKTOP_APP_MAX_WIDTH } from './theme/layout';
import { tokens } from './theme/tokens';

const GlobalStack = createNativeStackNavigator();

function AppShell() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 900;
  return (
    <View style={styles.root}>
      <View style={[styles.stage, isDesktopWeb ? styles.stageDesktop : null]}>
        <View
          style={[
            styles.shell,
            isDesktopWeb ? styles.shellDesktop : null,
            isDesktopWeb ? { maxWidth: DESKTOP_APP_MAX_WIDTH } : null,
          ]}
        >
          <RootNavigator />
        </View>
      </View>
    </View>
  );
}

export function AppRoot() {
  const prelaunchEnabled = (process.env.EXPO_PUBLIC_PRELAUNCH_MODE ?? 'true').trim() !== 'false';

  const linking = {
    prefixes: ['http://localhost:8081', 'https://alibi-ashen.vercel.app', 'alibi://'],
    config: {
      initialRouteName: prelaunchEnabled ? 'Waitlist' : 'AppContent',
      screens: {
        Waitlist: prelaunchEnabled ? '' : 'waitlist',
        AppContent: {
          path: prelaunchEnabled ? 'app' : '',
          screens: {
            Tabs: {
              path: '',
              screens: {
                Home: '',
                Vault: 'vault',
                Projects: 'projects',
                Profile: 'profile',
              },
            },
            Create: 'create',
            Recording: 'recording',
            TypeNote: 'type-note',
            EntryDetail: 'entry/:entryId',
            ProjectDetail: 'project/:projectId',
            NewProject: 'new-project',
            SelectProject: 'select-project',
            SelectEntries: 'select-entries',
            Studio: 'studio/:projectId',
            Output: 'output/:draftId',
            Auth: 'auth',
            ApiSettings: 'settings',
            ProjectSettings: 'project/:projectId/settings'
          },
        },
      },
    },
  };

  return (
    <AppStoreProvider>
      <SafeAreaProvider>
        <StatusBar barStyle={prelaunchEnabled ? "light-content" : "dark-content"} backgroundColor={prelaunchEnabled ? "#050608" : tokens.color.bg} /> 
        <NavigationContainer
          linking={linking as any}
          theme={{
            dark: false,
            colors: {
              primary: tokens.color.accent,
              background: tokens.color.bg,
              card: tokens.color.surface,
              text: tokens.color.text,
              border: tokens.color.borderSubtle,
              notification: tokens.color.accent2,
            },
          }}
        >
          <GlobalStack.Navigator screenOptions={{ headerShown: false, animation: 'none' }} initialRouteName={prelaunchEnabled ? 'Waitlist' : 'AppContent'}>
            <GlobalStack.Screen name="Waitlist" component={PrelaunchWaitlistScreen} />
            <GlobalStack.Screen name="AppContent" component={AppShell} />
          </GlobalStack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </AppStoreProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tokens.color.bg,
  },
  stage: {
    flex: 1,
  },
  stageDesktop: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  shell: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    backgroundColor: tokens.color.bg,
  },
  shellDesktop: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    shadowColor: '#000000',
    shadowOpacity: 0.8,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
  },
});
