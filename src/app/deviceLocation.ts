import { NativeModules, Platform } from 'react-native';

const nativeDeviceLocation = Platform.OS === 'android' ? (NativeModules as any)?.DeviceLocation : null;

export type EnableDeviceLocationResult = 'enabled' | 'denied' | 'settings_opened' | 'unsupported';

export type DevicePosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export function hasNativeDeviceLocation(): boolean {
  return typeof nativeDeviceLocation?.getCurrentPosition === 'function';
}

export async function isDeviceLocationEnabled(): Promise<boolean | null> {
  if (typeof nativeDeviceLocation?.isLocationEnabled !== 'function') {
    return null;
  }
  return Boolean(await nativeDeviceLocation.isLocationEnabled());
}

export async function requestEnableDeviceLocation(): Promise<EnableDeviceLocationResult> {
  if (typeof nativeDeviceLocation?.requestEnableLocation !== 'function') {
    return 'unsupported';
  }
  const result = String(await nativeDeviceLocation.requestEnableLocation());
  return result === 'enabled' || result === 'denied' || result === 'settings_opened' ? result : 'denied';
}

export async function getDeviceCurrentPosition(timeoutMs: number): Promise<DevicePosition> {
  const position = await nativeDeviceLocation.getCurrentPosition(timeoutMs);
  return {
    latitude: Number(position?.latitude),
    longitude: Number(position?.longitude),
    accuracy: Number(position?.accuracy),
  };
}
