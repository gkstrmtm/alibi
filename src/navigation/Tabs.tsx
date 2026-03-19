import { Ionicons } from '@expo/vector-icons';
import { type BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { type ComponentType, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View, useWindowDimensions, StyleSheet } from 'react-native';

import type { RootTabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ProjectsScreen } from '../screens/ProjectsScreen';
import { VaultScreen } from '../screens/VaultScreen';
import { ScribbleMic } from '../components/ScribbleMic';
import { useAppStore } from '../store/store';
import { getLayoutMetrics } from '../theme/layout';
import { tokens } from '../theme/tokens';
import { triggerSoftFeedback } from '../utils/feedback';

const Tab = createBottomTabNavigator<RootTabParamList>();
const ROUTE_INDEX: Record<keyof RootTabParamList, number> = {
  Home: 0,
  Vault: 1,
  Projects: 2,
  Profile: 3,
};

let lastFocusedTabIndex = 0;

function withTabSceneMotion<T extends object>(Component: ComponentType<T>, routeName: keyof RootTabParamList) {
  return function MotionWrapped(props: T) {
    const isFocused = useIsFocused();
    const translateX = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      if (!isFocused) return;
      const currentIndex = ROUTE_INDEX[routeName];
      const direction = currentIndex >= lastFocusedTabIndex ? 1 : -1;
      translateX.setValue(direction * 18);
      opacity.setValue(0.72);

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      lastFocusedTabIndex = currentIndex;
    }, [isFocused, opacity, routeName, translateX]);

    return (
      <Animated.View style={{ flex: 1, opacity, transform: [{ translateX }] }}>
        <Component {...props} />
      </Animated.View>
    );
  };
}

const HomeScene = withTabSceneMotion(HomeScreen, 'Home');
const VaultScene = withTabSceneMotion(VaultScreen, 'Vault');
const ProjectsScene = withTabSceneMotion(ProjectsScreen, 'Projects');
const ProfileScene = withTabSceneMotion(ProfileScreen, 'Profile');

function CustomTabButton({
  options,
  route,
  isFocused,
  onPress,
  onLongPress, 
  metrics
}: {
  options: import('@react-navigation/bottom-tabs').BottomTabNavigationOptions,
  route: any,
  isFocused: boolean,
  onPress: () => void,
  onLongPress: () => void,
  metrics: { bottomControlHeight: number, bottomNavHeight: number, stickyBottomSpace: number }
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [isHovered, setIsHovered] = useState(false);

  const animateIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1.15,
        friction: 5,
        tension: 300,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: -4,
        friction: 5,
        tension: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 6,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleHoverIn = () => {
    setIsHovered(true);
    animateIn();
  };

  const handleHoverOut = () => {
    setIsHovered(false);
    animateOut();
  };

  const handlePressIn = () => animateIn();
  const handlePressOut = () => animateOut();

  const label =
    options.tabBarLabel !== undefined
      ? options.tabBarLabel
      : options.title !== undefined
        ? options.title
        : route.name;

  const color = isHovered
    ? tokens.color.brand
    : isFocused
      ? '#000000'
      : '#A3A3A3';

  return (
    <Pressable
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel}
      testID={options.tabBarTestID}
      onPress={() => {
        triggerSoftFeedback();
        onPress();
      }}
      onLongPress={onLongPress}
      onPressIn={Platform.OS !== 'web' ? handlePressIn : undefined}
      onPressOut={Platform.OS !== 'web' ? handlePressOut : undefined}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      style={{ width: '25%', alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }, { translateY }],
          ...(isHovered && Platform.OS === 'web' ? {
            filter: `drop-shadow(0px 4px 12px ${tokens.color.brand}40)`
          } : {})
        }}
      >
        {options.tabBarIcon ? options.tabBarIcon({ focused: isFocused, color, size: 20 }) : null}
        <Text
          style={{
            color,
            fontSize: tokens.font.size[10],
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            fontWeight: tokens.font.weight.bold,
            marginTop: 4,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function CustomTabBar({ state, descriptors, navigation, metrics }: BottomTabBarProps & { metrics: { bottomControlHeight: number, bottomNavHeight: number, stickyBottomSpace: number } }) {
  const isHome = state.index === 0;
  const { state: appState } = useAppStore();
  const micSize = 76;
  const barHeight = metrics.bottomNavHeight;

  const renderTabButton = (route: any) => {
    const index = state.routes.findIndex((item) => item.key === route.key);
    const descriptor = descriptors[route.key];
    const options = (descriptor ? descriptor.options : {}) as import('@react-navigation/bottom-tabs').BottomTabNavigationOptions;
    const isFocused = state.index === index;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    const onLongPress = () => {
      navigation.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    };

    return <CustomTabButton key={route.key} options={options} route={route} isFocused={isFocused} onPress={onPress} onLongPress={onLongPress} metrics={metrics} />;
  };
  return (
    <View style={{ position: 'relative' }}>
      {!isHome ? <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable
            onPress={() => {
              triggerSoftFeedback();
              if (appState.auth.status !== 'signedIn' || !appState.auth.userId) {
                navigation.navigate('Auth' as any);
                return;
              }
              navigation.navigate('Recording' as any, { source: 'tab' } as any);
            }}
            style={{
              position: 'absolute',
              right: 18,
              bottom: barHeight + 12,
              width: micSize,
              height: micSize,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
            }}
          >
            <ScribbleMic size={micSize} iconSize={26} aggressive />
          </Pressable>
      </View> : null}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          backgroundColor: '#FAFAFA',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
          elevation: 0,
          height: barHeight,
          paddingTop: 8,
          paddingBottom: 8,
          paddingHorizontal: 0,
          alignItems: 'stretch',
        }}
      >
        {state.routes.map(renderTabButton)}
      </View>
    </View>
  );
}
export function Tabs() {
  const { width, height } = useWindowDimensions();
  const metrics = getLayoutMetrics(width, height);

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} metrics={metrics} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScene}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size ?? 20} />,
        }}
      />
      <Tab.Screen
        name="Vault"
        component={VaultScene}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="archive-outline" color={color} size={size ?? 20} />,
        }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectsScene}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline" color={color} size={size ?? 20} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScene}
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size ?? 20} />,
        }}
      />
    </Tab.Navigator>
  );
}