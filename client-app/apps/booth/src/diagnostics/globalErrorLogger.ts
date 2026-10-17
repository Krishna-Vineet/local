/*
 * ─────────────────────────────────────────────────────────────────
 *  GLOBAL ERROR LOGGER — install ONCE at the very top of your app
 *  entry (index.tsx / App.tsx), before rendering anything:
 *
 *      import { installBoothErrorLogger } from './diagnostics/globalErrorLogger';
 *      installBoothErrorLogger();
 *
 *  Why: on a kiosk, an unhandled JS exception usually just logs —
 *  unless your kiosk watchdog/shell kills the app on the first
 *  error (which matches "closes instantly"). This handler prints
 *  the EXACT error + stack to the console (ReactNativeJS in
 *  logcat on Android, Xcode console on iOS) right before the
 *  default handler runs, so the crash log is never lost.
 * ─────────────────────────────────────────────────────────────────
 */

import { ErrorUtils } from 'react-native';

let installed = false;

export function installBoothErrorLogger() {
  if (installed) {
    return;
  }
  installed = true;

  const previous = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('[Booth] ══ UNCAUGHT JS ERROR ══', {
      fatal: isFatal,
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });
    // hand back to the default handler (red box in dev, etc.)
    previous(error, isFatal);
  });

  console.log('[Booth] global error logger installed');
}
