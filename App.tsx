import React, { useEffect } from 'react';
import { LogBox } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import MainApp from './src/app/MainApp';
import { API_BASE } from './src/app/constants';

type LogLevel = 'warn' | 'error';

const CLIENT_LOG_ENDPOINT = `${API_BASE}/api/client-logs`;
const MAX_LOG_MESSAGE_LENGTH = 5000;

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

  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

export default App;
