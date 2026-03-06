import { NativeModules } from 'react-native';

const nativeAppInfo = (NativeModules as any)?.AppInfo;

export async function getInstalledAppVersion(fallbackVersion: string): Promise<string> {
  try {
    if (typeof nativeAppInfo?.getCurrentVersion === 'function') {
      const version = String(await nativeAppInfo.getCurrentVersion()).trim();
      if (version) {
        return version;
      }
    }
  } catch {
    // Fall back to the bundled version string if the native bridge is unavailable.
  }

  return String(fallbackVersion || '').trim() || '0.0.0';
}
