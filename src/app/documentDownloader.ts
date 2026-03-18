import { NativeModules, Platform } from 'react-native';

const nativeDocumentDownloader = Platform.OS === 'android' ? (NativeModules as any)?.AppUpdateInstaller : null;

export type DownloadedDocumentResult = {
  fileName: string;
  uri?: string;
  savedIn?: string;
};

export function isDocumentDownloaderAvailable() {
  return Boolean(nativeDocumentDownloader?.downloadDocument);
}

export async function downloadDocumentToDevice(
  downloadUrl: string,
  fileName?: string,
  mimeType = 'application/octet-stream',
): Promise<DownloadedDocumentResult> {
  if (!nativeDocumentDownloader?.downloadDocument) {
    throw new Error('In-app document download is not available on this device.');
  }
  return nativeDocumentDownloader.downloadDocument(downloadUrl, fileName || null, mimeType || null);
}
