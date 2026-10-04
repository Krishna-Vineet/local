import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// State Provider import karenge
import { BoothProvider } from './src/context/BoothProvider';
import { ThemeProvider } from '../../packages/ui/src/context/ThemeContext';

// Saari screens ko import karenge
import { BootScreen } from './src/screens/BootScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ClientEventsScreen } from './src/screens/ClientEventsScreen';
import { StartScreen } from './src/screens/StartScreen';
import { LayoutSelectionScreen } from './src/screens/LayoutSelectionScreen';
import { BoothSetupScreen } from './src/screens/BoothSetupScreen';
import { SlotSelectionScreen } from './src/screens/SlotSelectionScreen';
import { PrintCountScreen } from './src/screens/PrintCountScreen';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { PhotoSelectionScreen } from './src/screens/PhotoSelectionScreen';
import { CustomizeScreen } from './src/screens/CustomizeScreen';
import { PaymentScreen } from './src/screens/PaymentScreen';
import { OrderSuccessScreen } from './src/screens/OrderSuccessScreen';



// Ye stack navigation ke types hain jo baaki screens me use ho rahe hain
export type RootStackParamList = {
  Boot: undefined;
  Login: undefined;
  ClientEvents: undefined;
  Start: undefined;
  BoothSetup: undefined;
  LayoutSelection: undefined;
  SlotSelection: { layout?: 'vertical' | 'horizontal' };
  PrintCount: { orientation: 'vertical' | 'horizontal'; templateId: string };
  Capture: { orientation: 'vertical' | 'horizontal'; prints: number; includeQR: boolean; packageType: 'print-only' | 'digital-only' | 'print-digital' };
  PhotoSelection: { orientation: 'vertical' | 'horizontal'; prints: number; includeQR: boolean; packageType: 'print-only' | 'digital-only' | 'print-digital'; images?: any[] };
  Customize: {
    orientation: 'vertical' | 'horizontal';
    prints: number;
    includeQR: boolean;
    packageType: 'print-only' | 'digital-only' | 'print-digital';
    images?: any[];
    selectedImages: any[];
  };
  Payment: {
    orientation: 'vertical' | 'horizontal';
    prints: number;
    includeQR: boolean;
    packageType: 'print-only' | 'digital-only' | 'print-digital';
    selectedImages: any[];
    frameColor: string;
    taglineText: string;
    activeFilter: string;
    optionalLogoUrl: string;
    selectedTemplate: any;
  };
  OrderSuccess: { token: string | null; qrUrl?: string | null };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <BoothProvider>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="Boot"
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="Boot" component={BootScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="ClientEvents" component={ClientEventsScreen} />
              <Stack.Screen name="Start" component={StartScreen} />
              <Stack.Screen name="LayoutSelection" component={LayoutSelectionScreen} />
              <Stack.Screen name="BoothSetup" component={BoothSetupScreen} />
              <Stack.Screen name="SlotSelection" component={SlotSelectionScreen} />
              <Stack.Screen name="PrintCount" component={PrintCountScreen as any} />
              <Stack.Screen name="Capture" component={CaptureScreen as any} />
              <Stack.Screen name="PhotoSelection" component={PhotoSelectionScreen as any} />
              <Stack.Screen name="Customize" component={CustomizeScreen as any} />
              <Stack.Screen name="Payment" component={PaymentScreen as any} />
              <Stack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </BoothProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;

