import React, { useEffect, useRef } from 'react';
import { StatusBar, View, BackHandler } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Must load before the provider: wires the file-backed device storage.
import './src/storage/deviceStorage';
import { BoothProvider, useBooth } from './src/context/BoothProvider';
import { ThemeProvider } from '../../packages/ui/src/context/ThemeContext';

import { LoginScreen } from './src/screens/LoginScreen';
import { WaitingScreen } from './src/screens/WaitingScreen';
import { StartScreen } from './src/screens/StartScreen';
import { LayoutSelectionScreen } from './src/screens/LayoutSelectionScreen';
import { SlotSelectionScreen } from './src/screens/SlotSelectionScreen';
import { PrintCountScreen } from './src/screens/PrintCountScreen';
import { PaymentScreen } from './src/screens/PaymentScreen';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { PhotoSelectionScreen } from './src/screens/PhotoSelectionScreen';
import { CustomizeScreen } from './src/screens/CustomizeScreen';
import { OrderSuccessScreen } from './src/screens/OrderSuccessScreen';

export type RootStackParamList = {
  Login: undefined;
  Waiting: undefined;
  Start: undefined;
  Orientation: undefined;
  Templates: undefined;
  Prints: undefined;
  Payment: undefined;
  Camera: undefined;
  Photos: undefined;
  Customize: undefined;
  OrderSuccess: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Moves the booth to the right screen whenever its pairing or event changes:
 * unassigned / paused / not live -> Waiting, logged out or removed -> Login,
 * live again -> Start. The initial screen is still chosen by initialRouteName.
 */
function NavigationSync() {
  const { bootReady, installation, snapshot } = useBooth();
  const desired: keyof RootStackParamList = !installation
    ? 'Login'
    : snapshot?.event?.status === 'live'
    ? 'Start'
    : 'Waiting';
  const key = `${desired}|${snapshot?.event?.id ?? ''}`;
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!bootReady) return;
    if (lastKey.current === null) {
      lastKey.current = key;
      return;
    }
    if (lastKey.current === key) return;
    lastKey.current = key;
    if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: desired }] });
    }
  }, [bootReady, key, desired]);

  return null;
}

function RootNavigator() {
  const { bootReady, installation, snapshot } = useBooth();

  if (!bootReady) {
    return <View style={{ flex: 1, backgroundColor: '#050508' }} />;
  }

  const initialRoute: keyof RootStackParamList = !installation
    ? 'Login'
    : snapshot?.event?.status === 'live'
    ? 'Start'
    : 'Waiting';

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#000000' },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Waiting" component={WaitingScreen} />
      <Stack.Screen name="Start" component={StartScreen} />
      <Stack.Screen name="Orientation" component={LayoutSelectionScreen} />
      <Stack.Screen name="Templates" component={SlotSelectionScreen} />
      <Stack.Screen name="Prints" component={PrintCountScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="Camera" component={CaptureScreen} />
      <Stack.Screen name="Photos" component={PhotoSelectionScreen} />
      <Stack.Screen name="Customize" component={CustomizeScreen} />
      <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
    </Stack.Navigator>
  );
}

function GlobalInteractionHandler({ children }: { children: React.ReactNode }) {
  const { resetIdleTimer } = useBooth();
  const lastResetRef = useRef(0);

  const handleInteraction = () => {
    const now = Date.now();
    if (now - lastResetRef.current > 250) {
      lastResetRef.current = now;
      resetIdleTimer();
    }
    return false; // Passive listener: allow children to receive all gestures
  };

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={handleInteraction}
      onMoveShouldSetResponderCapture={handleInteraction}
    >
      {children}
    </View>
  );
}

export function App() {
  useEffect(() => {
    const onHardwareBack = () => {
      if (navigationRef.isReady()) {
        if (navigationRef.canGoBack()) {
          navigationRef.goBack();
          return true;
        }
        const currentRoute = navigationRef.getCurrentRoute()?.name;
        // On child screens where back stack was reset, safely return to Start
        if (currentRoute && !['Start', 'Waiting', 'Login'].includes(currentRoute)) {
          navigationRef.reset({ index: 0, routes: [{ name: 'Start' }] });
          return true;
        }
      }
      // Consume the event on root screens so the app does not crash or emit unhandled action
      return true;
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => backSub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <BoothProvider>
          <GlobalInteractionHandler>
            <NavigationContainer
              ref={navigationRef}
              onUnhandledAction={(action) => {
                if (action.type === 'GO_BACK') {
                  // Safely handle unhandled GO_BACK when already at root of navigator
                  return;
                }
              }}
            >
              <StatusBar hidden />
              <NavigationSync />
              <RootNavigator />
            </NavigationContainer>
          </GlobalInteractionHandler>
        </BoothProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
