import { NavigationContainer } from '@react-navigation/native';

import { AppStoreProvider } from './store/store';
import { RootNavigator } from './navigation/RootNavigator';

export function AppRoot() {
  return (
    <AppStoreProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AppStoreProvider>
  );
}
