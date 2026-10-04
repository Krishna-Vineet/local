import React, { Component } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  SafeAreaView,
  ViewStyle,
  StatusBar,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useAppTheme } from '../context/ThemeContext';

/*
 * ─────────────────────────────────────────────────────────────────
 *  SCREEN ERROR BOUNDARY
 *  ─────────────────────────────────────────────────────────────────
 *  Without a boundary, ONE unhandled JS error in a release kiosk build
 *  kills the whole app — which is exactly what happens when something
 *  throws while a screen re-renders after a tap ("app just closes").
 *
 *  With this, a broken screen:
 *   1. logs the exact error + component stack to the console (this is
 *      how you find the next crash), and
 *   2. shows a recoverable fallback instead of shutting down.
 * ─────────────────────────────────────────────────────────────────
 */
export class ScreenErrorBoundary extends Component<
  { children: React.ReactNode; onRecover?: () => void },
  { hasError: boolean; resetKey: number }
> {
  state = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[Booth] Screen crash caught:', error);
    if (info?.componentStack) {
      console.error('[Booth] Component stack:', info.componentStack);
    }
  }

  private handleRecover = () => {
    try {
      this.props.onRecover?.();
    } catch {
      /* a recovery callback must never take the kiosk down */
    }
    // bumping the key remounts the entire screen subtree below
    this.setState((s) => ({ hasError: false, resetKey: s.resetKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={boundaryStyles.root}>
          <Text style={boundaryStyles.title}>SCREEN ERROR</Text>
          <Text style={boundaryStyles.sub}>
            Something went wrong on this screen.
          </Text>
          <TouchableOpacity
            onPress={this.handleRecover}
            activeOpacity={0.85}
            style={boundaryStyles.button}
          >
            <Text style={boundaryStyles.buttonText}>TAP TO RECOVER</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View key={this.state.resetKey} style={boundaryStyles.passThrough}>
        {this.props.children}
      </View>
    );
  }
}

const boundaryStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  sub: {
    color: '#a1a1aa',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    backgroundColor: '#8b5cf6',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  passThrough: {
    flex: 1,
  },
});

/* ─────────────────────────────────────────────────────────────────
 *  SCREEN CONTAINER
 * ───────────────────────────────────────────────────────────────── */

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  /** Kept for API compatibility — orientation is detected internally. */
  isLandscape?: boolean;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  style,
  contentStyle,
}) => {
  const { theme, mode } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: theme.colors.background },
        style,
      ]}
    >
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
        hidden={false}
      />
      <View
        style={[
          styles.container,
          { flexDirection: isLandscape ? 'row' : 'column' },
          contentStyle,
        ]}
      >
        {/* Every screen is now crash-proof: a render error degrades to a
            recoverable screen instead of closing the app. */}
        <ScreenErrorBoundary>{children}</ScreenErrorBoundary>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
});
