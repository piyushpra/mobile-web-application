import { NativeEventEmitter, NativeModules, Platform, type EmitterSubscription } from 'react-native';

const nativeInstaller = Platform.OS === 'android' ? (NativeModules as any)?.AppUpdateInstaller : null;
const appUpdateEmitter = nativeInstaller ? new NativeEventEmitter(nativeInstaller) : null;

export type AppUpdateDownloadEvent = {
  status:
    | 'starting'
    | 'downloading'
    | 'downloaded'
    | 'installing'
    | 'permission_required'
    | 'cancelled'
    | 'error';
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  message?: string;
  fileName?: string;
};

export function isAppUpdateInstallerAvailable() {
  return Boolean(nativeInstaller);
}

export async function startAppUpdateDownload(
  downloadUrl: string,
  fileName?: string,
  checksumSha256?: string,
): Promise<void> {
  if (!nativeInstaller?.startDownload) {
    throw new Error('In-app updater is not available on this device.');
  }
  await nativeInstaller.startDownload(downloadUrl, fileName || null, checksumSha256 || null);
}

export async function cancelAppUpdateDownload(): Promise<boolean> {
  if (!nativeInstaller?.cancelDownload) {
    return false;
  }
  return Boolean(await nativeInstaller.cancelDownload());
}

export async function installDownloadedAppUpdate(): Promise<void> {
  if (!nativeInstaller?.installPendingUpdate) {
    throw new Error('No downloaded update is ready to install.');
  }
  await nativeInstaller.installPendingUpdate();
}

export async function openInstallPermissionSettings(): Promise<void> {
  if (!nativeInstaller?.openInstallPermissionSettings) {
    throw new Error('Install settings are not available on this device.');
  }
  await nativeInstaller.openInstallPermissionSettings();
}

export async function isInstallPermissionGranted(): Promise<boolean> {
  if (!nativeInstaller?.isInstallPermissionGranted) {
    return false;
  }
  return Boolean(await nativeInstaller.isInstallPermissionGranted());
}

export function addAppUpdateDownloadListener(
  listener: (event: AppUpdateDownloadEvent) => void,
): EmitterSubscription | { remove: () => void } {
  if (!appUpdateEmitter) {
    return { remove: () => {} };
  }
  return appUpdateEmitter.addListener('AppUpdateDownload', listener);
}
