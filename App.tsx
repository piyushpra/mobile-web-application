import React, { useEffect, useState } from 'react';
import { Image, LogBox, StatusBar, StyleSheet, Text, View } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import MainApp from './src/app/MainApp';
import { API_BASE, APP_LOGO_IMAGE } from './src/app/constants';

type LogLevel = 'warn' | 'error';

const CLIENT_LOG_ENDPOINT = `${API_BASE}/api/client-logs`;
const MAX_LOG_MESSAGE_LENGTH = 5000;
const runtimeProcess =
  typeof globalThis === 'object'
    ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    : undefined;
const IS_TEST_ENV = Boolean(runtimeProcess?.env?.JEST_WORKER_ID);

function serializeLogPart(part: unknown) {
  if (part instanceof Error) {
    return part.stack || part.message;
  }
  if (typeof part === 'string') {
    return part;
  }
  if (typeof part === 'number' || typeof part === 'boolean' || part == null) {
    return String(part);
  }
  try {
    return JSON.stringify(part);
  } catch {
    return String(part);
  }
}

function forwardClientLog(level: LogLevel, args: unknown[]) {
  const combined = args.map(serializeLogPart).join(' ').trim();
  if (!combined) return;
  const message = combined.slice(0, MAX_LOG_MESSAGE_LENGTH);
  const payload = {
    level,
    message,
    source: 'mobile-app',
    timestamp: new Date().toISOString(),
  };
  void fetch(CLIENT_LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Ignore network failures for fire-and-forget log forwarding.
  });
}

function App() {
  const [isStartupBrandVisible, setIsStartupBrandVisible] = useState(!IS_TEST_ENV);

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    // Hide in-app warning banner/log box and send warnings/errors to backend terminal.
    LogBox.ignoreAllLogs();

    const originalWarn = console.warn.bind(console);
    const originalError = console.error.bind(console);

    console.warn = (...args: unknown[]) => {
      originalWarn(...args);
      forwardClientLog('warn', args);
    };
    console.error = (...args: unknown[]) => {
      originalError(...args);
      forwardClientLog('error', args);
    };

    return () => {
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  useEffect(() => {
    if (IS_TEST_ENV) {
      return;
    }
    const timeout = setTimeout(() => {
      setIsStartupBrandVisible(false);
    }, 950);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <SafeAreaProvider>
      {isStartupBrandVisible ? (
        <View style={styles.startupSplash}>
          <StatusBar barStyle="dark-content" backgroundColor="#F5F7F3" />
          <Image source={APP_LOGO_IMAGE} style={styles.startupLogo} resizeMode="contain" />
          <Text style={styles.startupTitle}>FuElectric</Text>
          <Text style={styles.startupSubtitle}>By Dayal Electronics</Text>
        </View>
      ) : (
        <MainApp />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  startupSplash: {
    flex: 1,
    backgroundColor: '#F5F7F3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  startupLogo: {
    width: 120,
    height: 96,
    marginBottom: 28,
  },
  startupTitle: {
    color: '#1F2A37',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    textAlign: 'center',
  },
  startupSubtitle: {
    color: '#5F9D67',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    letterSpacing: 1.6,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default App;
