import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';

import {
  getDeviceCurrentPosition,
  hasNativeDeviceLocation,
  requestEnableDeviceLocation,
} from '../deviceLocation';
import { reverseGeocode, type ReverseGeocodeResult } from '../geocoding';
import type { DeliveryLocation, Theme } from '../types';

type LatLng = { lat: number; lng: number };

type MapWebViewHandle = { injectJavaScript: (script: string) => void };
// react-native-webview 14 declares `WebView<P = undefined>`, which resolves its props to `never`.
const MapWebView = WebView as unknown as React.ComponentType<WebViewProps & React.RefAttributes<MapWebViewHandle>>;

type MapLocationPickerProps = {
  visible: boolean;
  theme: Theme;
  initialCenter: LatLng | null;
  onClose: () => void;
  onSave: (location: DeliveryLocation, deliverHere: boolean) => Promise<void>;
};

const DEFAULT_CENTER: LatLng = { lat: 28.6139, lng: 77.209 };
const GEOCODE_DEBOUNCE_MS = 600;
// OpenStreetMap's tile policy requires an identifying Referer, which the WebView derives from baseUrl.
const MAP_BASE_URL = 'https://fuelectric.com/';

function buildMapHtml(center: LatLng, zoom: number) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #E5E7EB; }
  .pin { position: absolute; left: 50%; top: 50%; z-index: 1000; pointer-events: none; transform: translate(-50%, -100%); }
  .pin-dot { position: absolute; left: 50%; top: 50%; z-index: 999; pointer-events: none; width: 10px; height: 4px;
    margin-left: -5px; margin-top: -2px; border-radius: 50%; background: rgba(0, 0, 0, 0.35); }
</style>
</head>
<body>
<div id="map"></div>
<div class="pin-dot"></div>
<div class="pin">
  <svg width="40" height="52" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 0C9 0 0 9 0 20c0 15 20 32 20 32s20-17 20-32C40 9 31 0 20 0z" fill="#1E8C28" />
    <circle cx="20" cy="20" r="8" fill="#FFFFFF" />
  </svg>
</div>
<script>
  function post(message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
  onerror="post({ type: 'error', message: 'Map could not be loaded. Check your internet connection.' })"></script>
<script>
  if (window.L) {
    var map = L.map('map', { zoomControl: true }).setView([${center.lat}, ${center.lng}], ${zoom});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    function postCenter() {
      var c = map.getCenter().wrap();
      post({ type: 'move', lat: c.lat, lng: c.lng });
    }
    map.on('movestart', function () { post({ type: 'movestart' }); });
    map.on('moveend', postCenter);
    window.setCenter = function (lat, lng, zoom) { map.setView([lat, lng], zoom || 17); };
    postCenter();
  }
</script>
</body>
</html>`;
}

function buildLabel(name: string, address: ReverseGeocodeResult | null) {
  const trimmed = name.trim();
  if (trimmed) return trimmed;
  if (!address) return 'Pinned Location';
  return [address.area, address.city || address.state].filter(Boolean).join(', ') || 'Pinned Location';
}

async function ensureAndroidLocationPermission() {
  if (Platform.OS !== 'android') return true;
  const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
  if ((await PermissionsAndroid.check(fine)) || (await PermissionsAndroid.check(coarse))) return true;
  const result = await PermissionsAndroid.request(fine);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function MapLocationPicker({ visible, theme, initialCenter, onClose, onSave }: MapLocationPickerProps) {
  const webViewRef = useRef<MapWebViewHandle>(null);
  const geocodeRequestRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapHtml, setMapHtml] = useState('');
  const [center, setCenter] = useState<LatLng | null>(null);
  const [address, setAddress] = useState<ReverseGeocodeResult | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [savingMode, setSavingMode] = useState<'save' | 'deliver' | null>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const canLocate = useMemo(() => hasNativeDeviceLocation(), []);

  useEffect(() => {
    if (!visible) return;
    const start = initialCenter ?? DEFAULT_CENTER;
    setMapHtml(buildMapHtml(start, initialCenter ? 16 : 12));
    setCenter(null);
    setAddress(null);
    setName('');
    setMessage(null);
    setSavingMode(null);
  }, [visible, initialCenter]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const resolveAddress = useCallback((point: LatLng) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const requestId = ++geocodeRequestRef.current;
    setIsResolving(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await reverseGeocode(point.lat, point.lng);
        if (requestId !== geocodeRequestRef.current) return;
        setAddress(result);
        setMessage(null);
      } catch {
        if (requestId !== geocodeRequestRef.current) return;
        setAddress(null);
        setMessage('Could not find an address here. You can still save this pin.');
      } finally {
        if (requestId === geocodeRequestRef.current) setIsResolving(false);
      }
    }, GEOCODE_DEBOUNCE_MS);
  }, []);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let data: any;
      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (data?.type === 'movestart') {
        setIsMoving(true);
      } else if (data?.type === 'move') {
        const lat = Number(data.lat);
        const lng = Number(data.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setIsMoving(false);
        setCenter({ lat, lng });
        resolveAddress({ lat, lng });
      } else if (data?.type === 'error') {
        setMessage(String(data.message || 'Map could not be loaded.'));
      }
    },
    [resolveAddress],
  );

  const locateMe = async () => {
    try {
      setIsLocating(true);
      setMessage(null);
      if (!(await ensureAndroidLocationPermission())) {
        setMessage('Location permission denied. Move the map to place the pin.');
        return;
      }
      const enableResult = await requestEnableDeviceLocation();
      if (enableResult === 'denied' || enableResult === 'settings_opened') {
        setMessage('Turn on device location, then tap the locate button again.');
        return;
      }
      const position = await getDeviceCurrentPosition(12000);
      if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) {
        throw new Error('Location unavailable');
      }
      webViewRef.current?.injectJavaScript(
        `window.setCenter && window.setCenter(${position.latitude}, ${position.longitude}, 17); true;`,
      );
    } catch {
      setMessage('Could not get your current location. Move the map to place the pin.');
    } finally {
      setIsLocating(false);
    }
  };

  const save = async (deliverHere: boolean) => {
    if (!center || savingMode) return;
    const location: DeliveryLocation = {
      id: `loc_map_${Date.now()}`,
      label: buildLabel(name, address),
      area: address?.area || '',
      city: address?.city || '',
      state: address?.state || '',
      country: address?.country || 'India',
      pincode: address?.pincode || '',
      lat: Number(center.lat.toFixed(6)),
      lng: Number(center.lng.toFixed(6)),
      source: 'manual',
    };
    try {
      setSavingMode(deliverHere ? 'deliver' : 'save');
      await onSave(location, deliverHere);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save location');
    } finally {
      setSavingMode(null);
    }
  };

  const addressTitle = isMoving
    ? 'Moving pin...'
    : isResolving
      ? 'Finding address...'
      : address
        ? [address.area, address.city].filter(Boolean).join(', ') || address.state || 'Pinned Location'
        : center
          ? 'Pinned Location'
          : 'Loading map...';
  const addressSub = address
    ? [address.city, address.state, address.pincode].filter(Boolean).join(' - ')
    : center
      ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
      : '';
  const canSave = Boolean(center) && !isMoving && !isResolving && !savingMode;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[pickerStyles.safe, { backgroundColor: theme.bg }]}>
        <View style={[pickerStyles.header, { backgroundColor: theme.panel, borderBottomColor: theme.steel }]}>
          <Pressable
            onPress={onClose}
            style={[pickerStyles.headerBtn, { backgroundColor: theme.panelSoft }]}
            accessibilityRole="button"
            accessibilityLabel="Close map"
          >
            <Text style={[pickerStyles.headerBtnText, { color: theme.text }]}>←</Text>
          </Pressable>
          <Text style={[pickerStyles.headerTitle, { color: theme.text }]}>Pick Location on Map</Text>
          <View style={pickerStyles.headerBtn} />
        </View>

        <View style={pickerStyles.mapWrap}>
          {mapHtml ? (
            <MapWebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: mapHtml, baseUrl: MAP_BASE_URL }}
              onMessage={onMessage}
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
              style={pickerStyles.map}
            />
          ) : null}
          <View pointerEvents="none" style={pickerStyles.hint}>
            <Text style={pickerStyles.hintText}>Move the map to place the pin on your address</Text>
          </View>
          {canLocate ? (
            <Pressable
              onPress={locateMe}
              disabled={isLocating}
              style={pickerStyles.locateBtn}
              accessibilityRole="button"
              accessibilityLabel="Go to my current location"
            >
              {isLocating ? (
                <ActivityIndicator size="small" color="#166534" />
              ) : (
                <Text style={pickerStyles.locateBtnText}>◎</Text>
              )}
            </Pressable>
          ) : null}
        </View>

        <View style={[pickerStyles.sheet, { backgroundColor: theme.panel, borderTopColor: theme.steel }]}>
          <View style={pickerStyles.addressRow}>
            {isMoving || isResolving ? <ActivityIndicator size="small" color="#1E8C28" /> : null}
            <View style={pickerStyles.addressTextWrap}>
              <Text style={[pickerStyles.addressTitle, { color: theme.text }]} numberOfLines={1}>
                {addressTitle}
              </Text>
              {addressSub ? (
                <Text style={[pickerStyles.addressSub, { color: theme.subtext }]} numberOfLines={1}>
                  {addressSub}
                </Text>
              ) : null}
            </View>
          </View>
          {message ? <Text style={pickerStyles.message}>{message}</Text> : null}
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Save as (optional): Home, Office, Shop..."
            placeholderTextColor={theme.subtext}
            maxLength={60}
            style={[pickerStyles.nameInput, { color: theme.text, borderColor: theme.steel, backgroundColor: theme.panelSoft }]}
          />
          <View style={pickerStyles.actions}>
            <Pressable
              style={[pickerStyles.secondaryBtn, !canSave && pickerStyles.btnDisabled]}
              disabled={!canSave}
              onPress={() => save(false)}
            >
              {savingMode === 'save' ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <Text style={pickerStyles.secondaryBtnText}>Save Address</Text>
              )}
            </Pressable>
            <Pressable
              style={[pickerStyles.primaryBtn, !canSave && pickerStyles.btnDisabled]}
              disabled={!canSave}
              onPress={() => save(true)}
            >
              {savingMode === 'deliver' ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={pickerStyles.primaryBtnText}>Save & Deliver Here</Text>
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  mapWrap: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  hint: {
    position: 'absolute',
    top: 12,
    left: 60,
    right: 60,
    alignItems: 'center',
  },
  hintText: {
    backgroundColor: 'rgba(17, 24, 39, 0.78)',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
    textAlign: 'center',
  },
  locateBtn: {
    position: 'absolute',
    right: 14,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  locateBtnText: {
    color: '#166534',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
  sheet: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addressTextWrap: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  addressSub: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  message: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '700',
  },
  nameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#9CA3AF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 48,
  },
  secondaryBtnText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800',
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#1E8C28',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 48,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

export default React.memo(MapLocationPicker);
