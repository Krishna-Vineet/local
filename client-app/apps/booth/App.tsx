import React from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <BoothProvider>
          <NavigationContainer>
            <StatusBar hidden />
            <RootNavigator />
          </NavigationContainer>
        </BoothProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
