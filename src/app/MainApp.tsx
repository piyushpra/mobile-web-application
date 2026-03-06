import React, { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdminModuleContent from './components/admin/AdminModuleContent';
import ListRow from './components/ListRow';
import PublicCatalogSections from './components/public/PublicCatalogSections';
import PublicFeedbackPage from './components/public/PublicFeedbackPage';
import PublicFooter from './components/public/PublicFooter';
import {
  API_BASE,
  APP_CURRENT_VERSION,
  APP_UPDATE_APP_ID,
  APP_UPDATE_CHANNEL,
  FOOTER_LOGO_IMAGE,
  FUELECTRIC_LOGO_IMAGE,
  LANDING_HERO_IMAGE,
  darkTheme,
  modules,
  theme as lightTheme,
} from './constants';
import { getInstalledAppVersion } from './appInfo';
import styles from './styles';
import type {
  AuthMode,
  CartItem,
  DeliveryLocation,
  Doc,
  FeedbackOrderItem,
  Item,
  LandingCategory,
  ModuleId,
  Movement,
  Overview,
  Party,
  ProfileOrder,
  ProfilePanel,
  ProfilePaymentMethod,
  ProfileServiceRequest,
  ProfileWarrantyClaim,
  PublicProduct,
  PublicProductDetail,
  PublicStockItem,
  PublicView,
  User,
  ViewMoreContext,
} from './types';
import {
  getAvailableCapacities,
  getCapacityOptions,
  getLandingProductModel,
  getDetailPrice,
  getLandingProductTitle,
  getOfferLabel,
  locationMatchesQuery,
} from './utils/publicCatalog';

const DEFAULT_PAYMENT_METHODS: ProfilePaymentMethod[] = [
  { id: 'pm_cod', label: 'Cash on Delivery', detail: 'Pay when product is delivered', isDefault: true },
  { id: 'pm_upi', label: 'UPI', detail: 'piyush@upi', isDefault: false },
];

type ItemImageDraft = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  base64Data: string;
  previewUri: string;
};

type NativePickerImage = {
  uri?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  base64Data?: string;
};

const MAX_ITEM_IMAGES = 5;
const AUTH_TOKEN_STORAGE_KEY = '@mobile/auth_token';
const AUTH_USER_STORAGE_KEY = '@mobile/auth_user';
const GUEST_DARK_MODE_STORAGE_KEY = '@mobile/guest_dark_mode';
const APP_UPDATE_SKIP_VERSION_STORAGE_KEY = '@mobile/app_update_skipped_version';

function getFilledItemImageUrls(urls: string[]) {
  return urls.map(url => String(url || '').trim()).filter(Boolean);
}

function isHttpUrl(url: string) {
  try {
    const parsed = new URL(String(url || '').trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isAllowedItemImageUrl(url: string) {
  const normalized = String(url || '').trim();
  return normalized.startsWith('/static/') || isHttpUrl(normalized);
}

function compareVersionStrings(left: string, right: string) {
  const leftParts = String(left || '')
    .trim()
    .split('.')
    .map(part => Number(part));
  const rightParts = String(right || '')
    .trim()
    .split('.')
    .map(part => Number(part));
  const maxLen = Math.max(leftParts.length, rightParts.length, 1);
  for (let i = 0; i < maxLen; i += 1) {
    const a = Number.isFinite(leftParts[i]) ? leftParts[i] : 0;
    const b = Number.isFinite(rightParts[i]) ? rightParts[i] : 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function toFetchError(url: string, err: unknown, fallback = 'Request failed') {
  const message = err instanceof Error ? err.message : fallback;
  return new Error(`${message} [${url}]`);
}

function MainApp() {
  const insets = useSafeAreaInsets();
  const { width: viewportWidth } = useWindowDimensions();
  const horizontalScreenPadding = useMemo(() => {
    if (viewportWidth >= 1024) return 26;
    if (viewportWidth >= 768) return 20;
    if (viewportWidth <= 360) return 10;
    return 14;
  }, [viewportWidth]);
  const sectionGap = viewportWidth <= 360 ? 8 : 10;
  const bottomContentPadding = viewportWidth <= 360 ? 96 : 110;
  const featuredBrandFontSize = viewportWidth <= 360 ? 11 : viewportWidth >= 768 ? 13 : 12;
  const featuredModelFontSize = viewportWidth <= 360 ? 13 : viewportWidth >= 768 ? 16 : 15;
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [moduleId, setModuleId] = useState<ModuleId>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [isPublicLoading, setIsPublicLoading] = useState(false);
  const [isPublicDetailLoading, setIsPublicDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [registerName, setRegisterName] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('none');
  const [isAuthModalVisible, setIsAuthModalVisible] = useState(false);
  const [publicView, setPublicView] = useState<PublicView>('landing');
  const [landingCategory, setLandingCategory] = useState<LandingCategory>('inverters');

  const [items, setItems] = useState<Item[]>([]);
  const [publicStock, setPublicStock] = useState<PublicStockItem[]>([]);
  const [publicProducts, setPublicProducts] = useState<PublicProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<PublicProductDetail | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [isViewMoreModalVisible, setIsViewMoreModalVisible] = useState(false);
  const [viewMoreContext, setViewMoreContext] = useState<ViewMoreContext>('all');
  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);
  const [currentDeliveryLocation, setCurrentDeliveryLocation] = useState<DeliveryLocation>({
    id: 'loc_new_delhi_110001',
    label: 'New Delhi, India',
    city: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    pincode: '110001',
    source: 'default',
  });
  const [savedLocations, setSavedLocations] = useState<DeliveryLocation[]>([]);
  const [recentLocations, setRecentLocations] = useState<DeliveryLocation[]>([]);
  const [searchedLocations, setSearchedLocations] = useState<DeliveryLocation[]>([]);
  const [draftDeliveryLocation, setDraftDeliveryLocation] = useState<DeliveryLocation | null>(null);
  const [showMoreSuggestedLocations, setShowMoreSuggestedLocations] = useState(false);
  const [selectedCapacity, setSelectedCapacity] = useState('150Ah');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCheckoutSheetVisible, setIsCheckoutSheetVisible] = useState(false);
  const [checkoutFirstName, setCheckoutFirstName] = useState('');
  const [checkoutLastName, setCheckoutLastName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutEmail, setCheckoutEmail] = useState('');
  const [isCheckoutSubmitting, setIsCheckoutSubmitting] = useState(false);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [activeProfilePanel, setActiveProfilePanel] = useState<ProfilePanel | null>(null);
  const [isProfileEditModalVisible, setIsProfileEditModalVisible] = useState(false);
  const [profileName, setProfileName] = useState('Piyush Sharma');
  const [profileEmail, setProfileEmail] = useState('piyush@email.com');
  const [profilePhone, setProfilePhone] = useState('+91 98XXXXXXXX');
  const [profileDraftName, setProfileDraftName] = useState('');
  const [profileDraftEmail, setProfileDraftEmail] = useState('');
  const [profileDraftPhone, setProfileDraftPhone] = useState('');
  const [profileDarkMode, setProfileDarkMode] = useState(false);
  const [profileLanguage, setProfileLanguage] = useState<'English' | 'Hindi'>('English');
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [profileOrders, setProfileOrders] = useState<ProfileOrder[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<ProfilePaymentMethod[]>(DEFAULT_PAYMENT_METHODS);
  const [installationRequests, setInstallationRequests] = useState<ProfileServiceRequest[]>([]);
  const [warrantyClaims, setWarrantyClaims] = useState<ProfileWarrantyClaim[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState({
    orderUpdates: true,
    promotions: true,
    warrantyAlerts: true,
  });
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<Doc[]>([]);
  const [salesOrders, setSalesOrders] = useState<Doc[]>([]);
  const [bills, setBills] = useState<Doc[]>([]);
  const [invoices, setInvoices] = useState<Doc[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [overview, setOverview] = useState<Overview>({
    itemsCount: 0,
    totalUnits: 0,
    lowStockCount: 0,
    inventoryValue: 0,
    pendingPurchaseOrders: 0,
    pendingSalesOrders: 0,
    movementCount: 0,
    suppliersCount: 0,
    customersCount: 0,
    openBills: 0,
    openInvoices: 0,
  });

  const [search, setSearch] = useState('');
  const [publicSearch, setPublicSearch] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(4);
  const [feedbackOrderItems, setFeedbackOrderItems] = useState<FeedbackOrderItem[]>([]);
  const [selectedFeedbackOrderItemId, setSelectedFeedbackOrderItemId] = useState('');
  const [isFeedbackOrderItemsLoading, setIsFeedbackOrderItemsLoading] = useState(false);

  const [itemName, setItemName] = useState('');
  const [itemSku, setItemSku] = useState('');
  const [itemBrand, setItemBrand] = useState('');
  const [itemCategory, setItemCategory] = useState('Power Backup');
  const [itemCapacityAh, setItemCapacityAh] = useState('150Ah');
  const [itemQty, setItemQty] = useState('1');
  const [itemReorder, setItemReorder] = useState('8');
  const [itemPurchasePrice, setItemPurchasePrice] = useState('0');
  const [itemSellingPrice, setItemSellingPrice] = useState('0');
  const [itemTags, setItemTags] = useState<string[]>([]);
  const [itemImages, setItemImages] = useState<ItemImageDraft[]>([]);
  const [itemImageUrls, setItemImageUrls] = useState<string[]>(['']);
  const [editingItemId, setEditingItemId] = useState('');
  const [isItemEditModalVisible, setIsItemEditModalVisible] = useState(false);

  const [partyName, setPartyName] = useState('');
  const [partyCompany, setPartyCompany] = useState('');
  const [partyEmail, setPartyEmail] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyGstin, setPartyGstin] = useState('');

  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('0');
  const [nameField, setNameField] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [adjustDelta, setAdjustDelta] = useState('1');
  const [adjustReason, setAdjustReason] = useState('Manual adjustment');
  const theme = profileDarkMode ? darkTheme : lightTheme;
  const appBrandLogo = profileDarkMode ? FOOTER_LOGO_IMAGE : FUELECTRIC_LOGO_IMAGE;

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(8)).current;
  const viewMoreOpacity = useRef(new Animated.Value(0)).current;
  const viewMoreRise = useRef(new Animated.Value(24)).current;
  const authFormOpacity = useRef(new Animated.Value(1)).current;
  const authFormSlide = useRef(new Animated.Value(0)).current;
  const publicScrollRef = useRef<ScrollView | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guestIdRef = useRef(`gst_${Math.random().toString(36).slice(2, 10)}`);
  const lastAddActionRef = useRef<{ id: string; ts: number } | null>(null);
  const addActionLockRef = useRef(false);
  const skipNextCartSyncRef = useRef(true);
  const appUpdatePromptedRef = useRef(false);
  const guestDarkModeCacheRef = useRef<{ loaded: boolean; value: boolean }>({ loaded: false, value: false });
  const [isStorefrontHydrated, setIsStorefrontHydrated] = useState(false);
  const currentOwnerKey = useMemo(
    () => (token && user?.id ? `user_${user.id}` : `guest_${guestIdRef.current}`),
    [token, user?.id],
  );

  const canEdit = user?.role === 'admin';
  const canDeleteMaster = user?.role === 'admin';
  const isAdminUser = Boolean(token && user?.role === 'admin');
  const isHomeModuleForAdmin = isAdminUser && moduleId === 'home';

  const parseResponseSafe = async (res: Response) => {
    const raw = await res.text();
    if (!raw) {
      return {};
    }
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  };

  const toRequestError = (status: number, message: string) => {
    const err = new Error(message || 'Request failed') as Error & { status?: number };
    err.status = status;
    return err;
  };

  const clearSavedAuthSession = async () => {
    try {
      await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      await AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY);
    } catch {
      // best-effort cleanup
    }
  };

  const readGuestDarkModePreference = async () => {
    if (guestDarkModeCacheRef.current.loaded) {
      return guestDarkModeCacheRef.current.value;
    }
    try {
      const raw = await AsyncStorage.getItem(GUEST_DARK_MODE_STORAGE_KEY);
      const nextValue = String(raw || '').trim() === '1';
      guestDarkModeCacheRef.current = { loaded: true, value: nextValue };
      return nextValue;
    } catch {
      guestDarkModeCacheRef.current = { loaded: true, value: false };
      return false;
    }
  };

  const writeGuestDarkModePreference = async (darkMode: boolean) => {
    const nextValue = Boolean(darkMode);
    guestDarkModeCacheRef.current = { loaded: true, value: nextValue };
    try {
      await AsyncStorage.setItem(GUEST_DARK_MODE_STORAGE_KEY, nextValue ? '1' : '0');
    } catch {
      // best-effort local persistence for guest settings
    }
  };

  const locationApiRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const runRequest = async (authToken: string | null) => {
      const url = `${API_BASE}${path}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      let res: Response;
      try {
        res = await fetch(url, { ...init, headers });
      } catch (err) {
        throw toFetchError(url, err, 'Location request failed');
      }
      const json = await parseResponseSafe(res);
      return { res, json };
    };

    let { res, json } = await runRequest(token);
    if (res.status === 401 && token) {
      setToken(null);
      setUser(null);
      void clearSavedAuthSession();
      ({ res, json } = await runRequest(null));
    }

    if (!res.ok) {
      throw toRequestError(res.status, (json as any).error || (json as any).message || `Location request failed (${res.status})`);
    }
    if (typeof json !== 'object') {
      throw new Error('Invalid server response');
    }
    return json as T;
  };

  const apiRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const runRequest = async (authToken: string | null) => {
      const url = `${API_BASE}${path}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          headers,
        });
      } catch (err) {
        throw toFetchError(url, err);
      }
      const json = await parseResponseSafe(response);
      return { response, json };
    };

    let { response, json } = await runRequest(token);
    if (response.status === 401 && token) {
      setToken(null);
      setUser(null);
      void clearSavedAuthSession();
      ({ response, json } = await runRequest(null));
    }

    if (!response.ok) {
      throw toRequestError(response.status, (json as any).error || 'Request failed');
    }
    return json as T;
  };

  const storefrontApiRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const runRequest = async (authToken: string | null) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const url = new URL(`${API_BASE}${path}`);
      url.searchParams.set('guestId', guestIdRef.current);

      let res: Response;
      try {
        res = await fetch(url.toString(), {
          ...init,
          headers,
        });
      } catch (err) {
        throw toFetchError(url.toString(), err);
      }
      const json = await parseResponseSafe(res);
      return { res, json };
    };

    let { res, json } = await runRequest(token);
    if (res.status === 401 && token) {
      setToken(null);
      setUser(null);
      void clearSavedAuthSession();
      ({ res, json } = await runRequest(null));
    }

    if (!res.ok) {
      throw toRequestError(res.status, (json as any)?.error || (json as any)?.message || 'Request failed');
    }
    return json as T;
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    setToast({ message, type });
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 2600);
  };

  const showActionError = (title: string, err: unknown, fallback = 'Request failed') => {
    const status = Number((err as any)?.status || 0);
    const message = err instanceof Error ? err.message : fallback;
    if (status >= 500) {
      Alert.alert(title, 'Server error occurred. Please try again.');
      setError(message);
      return;
    }
    Alert.alert(title, message || fallback);
  };

  const checkForAppUpdate = async () => {
    if (appUpdatePromptedRef.current || typeof fetch !== 'function') {
      return;
    }
    try {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const installedVersion = await getInstalledAppVersion(APP_CURRENT_VERSION);
      const url = new URL(`${API_BASE}/api/public/app-update`);
      url.searchParams.set('appId', APP_UPDATE_APP_ID);
      url.searchParams.set('channel', APP_UPDATE_CHANNEL);
      url.searchParams.set('platform', platform);
      url.searchParams.set('currentVersion', installedVersion);

      const res = await fetch(url.toString());
      const json = await parseResponseSafe(res);
      if (!res.ok) {
        return;
      }

      const currentVersion = String((json as any)?.currentVersion || installedVersion).trim() || installedVersion;
      const latestVersion = String((json as any)?.latestVersion || '').trim();
      const minimumSupportedVersion = String((json as any)?.minimumSupportedVersion || '').trim();
      const updateAvailableFromApi = Boolean((json as any)?.updateAvailable);
      const updateAvailable =
        updateAvailableFromApi ||
        (latestVersion ? compareVersionStrings(latestVersion, currentVersion) > 0 : false);
      if (!updateAvailable || !latestVersion) {
        return;
      }

      const forceUpdate =
        Boolean((json as any)?.forceUpdate) ||
        Boolean((json as any)?.mandatory) ||
        (minimumSupportedVersion ? compareVersionStrings(minimumSupportedVersion, currentVersion) > 0 : false);
      const downloadUrl = String((json as any)?.downloadUrl || '').trim();
      if (!downloadUrl) {
        return;
      }

      if (!forceUpdate) {
        const skippedVersion = String((await AsyncStorage.getItem(APP_UPDATE_SKIP_VERSION_STORAGE_KEY)) || '').trim();
        if (skippedVersion && skippedVersion === latestVersion) {
          return;
        }
      }

      appUpdatePromptedRef.current = true;
      const releaseNotes = String((json as any)?.releaseNotes || '').trim();
      const messageParts = [`Current: ${currentVersion}`, `Latest: ${latestVersion}`];
      const publishedAt = String((json as any)?.publishedAt || '').trim();
      if (publishedAt) {
        messageParts.push(`Published: ${publishedAt}`);
      }
      if (releaseNotes) {
        messageParts.push('', releaseNotes);
      }
      const openUpdateUrl = async () => {
        try {
          await Linking.openURL(downloadUrl);
        } catch {
          showToast('Unable to open update link', 'error');
          appUpdatePromptedRef.current = false;
        }
      };

      if (forceUpdate) {
        Alert.alert(
          'Update Required',
          messageParts.join('\n'),
          [{ text: 'Update Now', onPress: () => void openUpdateUrl() }],
          { cancelable: false },
        );
        return;
      }

      Alert.alert('Update Available', messageParts.join('\n'), [
        {
          text: 'Later',
          style: 'cancel',
          onPress: () => {
            void AsyncStorage.setItem(APP_UPDATE_SKIP_VERSION_STORAGE_KEY, latestVersion);
            appUpdatePromptedRef.current = false;
          },
        },
        { text: 'Update Now', onPress: () => void openUpdateUrl() },
      ]);
    } catch {
      // Do not block app load if update check fails.
    }
  };

  const openAuthModal = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    authFormOpacity.setValue(1);
    authFormSlide.setValue(0);
    setIsAuthModalVisible(true);
  };

  const switchAuthMode = (mode: 'login' | 'register') => {
    if (authMode === mode) {
      return;
    }
    Animated.parallel([
      Animated.timing(authFormOpacity, { toValue: 0, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(authFormSlide, { toValue: mode === 'register' ? -18 : 18, duration: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      setAuthMode(mode);
      authFormSlide.setValue(mode === 'register' ? 18 : -18);
      Animated.parallel([
        Animated.timing(authFormOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(authFormSlide, { toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  };

  const closeAuthModal = () => {
    setIsAuthModalVisible(false);
  };

  const openViewMoreModal = (context: ViewMoreContext) => {
    setViewMoreContext(context);
    setIsViewMoreModalVisible(true);
  };

  const closeViewMoreModal = () => {
    setIsViewMoreModalVisible(false);
  };

  const closeProfileModal = () => {
    setIsProfileModalVisible(false);
    setActiveProfilePanel(null);
  };

  const openProfileEditModal = () => {
    if (!token || !user) {
      Alert.alert('Login Required', 'Please login to edit profile details.');
      closeProfileModal();
      openAuthModal('login');
      return;
    }
    setProfileDraftName(profileName);
    setProfileDraftEmail(profileEmail);
    setProfileDraftPhone(profilePhone);
    setIsProfileEditModalVisible(true);
  };

  const saveProfileEdits = async () => {
    if (!token || !user) {
      setIsProfileEditModalVisible(false);
      Alert.alert('Login Required', 'Please login to edit profile details.');
      openAuthModal('login');
      return;
    }

    if (!profileDraftName.trim() || !profileDraftEmail.trim() || !profileDraftPhone.trim()) {
      Alert.alert('Validation', 'Please fill all profile fields.');
      return;
    }

    try {
      const json = await storefrontApiRequest<{ profile?: { name: string; email: string; phone: string } }>(
        '/api/public/storefront/profile',
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: profileDraftName.trim(),
            email: profileDraftEmail.trim(),
            phone: profileDraftPhone.trim(),
          }),
        },
      );
      if (json.profile) {
        setProfileName(json.profile.name || profileDraftName.trim());
        setProfileEmail(json.profile.email || profileDraftEmail.trim());
        setProfilePhone(json.profile.phone || profileDraftPhone.trim());
        setUser(prev =>
          prev
            ? {
                ...prev,
                name: json.profile?.name || prev.name,
                username: json.profile?.email || prev.username,
              }
            : prev,
        );
      } else {
        setProfileName(profileDraftName.trim());
        setProfileEmail(profileDraftEmail.trim());
        setProfilePhone(profileDraftPhone.trim());
      }

      setIsProfileEditModalVisible(false);
      showToast('Profile updated');
    } catch (err) {
      Alert.alert('Profile Update Failed', err instanceof Error ? err.message : 'Unable to update profile');
    }
  };

  const toggleWishlist = async (productId: string) => {
    if (!token || !user) {
      Alert.alert('Login Required', 'Please login to save wishlist items to your account.');
      openAuthModal('login');
      return;
    }

    try {
      const json = await storefrontApiRequest<{ wishlistIds: string[]; inWishlist: boolean }>(
        '/api/public/storefront/wishlist/toggle',
        {
          method: 'POST',
          body: JSON.stringify({ productId }),
        },
      );
      setWishlistIds(Array.isArray(json.wishlistIds) ? json.wishlistIds : []);
      showToast(json.inWishlist ? 'Added to wishlist' : 'Removed from wishlist');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Wishlist update failed', 'error');
    }
  };

  const openProfilePanel = (panel: ProfilePanel) => {
    setActiveProfilePanel(panel);
  };

  const openNotificationsPanelDirect = () => {
    setIsProfileModalVisible(false);
    setActiveProfilePanel('notifications');
  };

  const openSavedAddressesFromProfile = () => {
    setIsProfileModalVisible(false);
    setIsLocationModalVisible(true);
  };

  const loadFeedbackOrderItems = async () => {
    try {
      setIsFeedbackOrderItemsLoading(true);
      const json = await storefrontApiRequest<{ items?: FeedbackOrderItem[] }>('/api/public/feedback/order-items?limit=120');
      const items = Array.isArray(json.items) ? json.items : [];
      setFeedbackOrderItems(items);
      setSelectedFeedbackOrderItemId(prev => {
        if (prev && items.some(item => item.orderItemId === prev)) {
          return prev;
        }
        return items[0]?.orderItemId || '';
      });
    } catch (err) {
      setFeedbackOrderItems([]);
      setSelectedFeedbackOrderItemId('');
      showToast(err instanceof Error ? err.message : 'Failed to load order items for feedback', 'error');
    } finally {
      setIsFeedbackOrderItemsLoading(false);
    }
  };

  const openFeedbackPage = () => {
    setIsProfileEditModalVisible(false);
    setIsProfileModalVisible(false);
    setActiveProfilePanel(null);
    setPublicView('feedback');
  };

  const openContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'How would you like to contact support?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Email', onPress: () => Linking.openURL('mailto:support@fuelectric.com') },
        { text: 'Call', onPress: () => Linking.openURL('tel:+919876543210') },
      ],
    );
  };

  const updateNotificationPrefs = async (patch: Partial<typeof notificationPrefs>) => {
    const next = {
      ...notificationPrefs,
      ...patch,
    };
    setNotificationPrefs(next);

    if (!token || !user) {
      return;
    }

    try {
      const json = await storefrontApiRequest<{ notificationPrefs: typeof notificationPrefs }>(
        '/api/public/storefront/notification-preferences',
        {
          method: 'PATCH',
          body: JSON.stringify(next),
        },
      );
      if (json.notificationPrefs) {
        setNotificationPrefs(json.notificationPrefs);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save notification settings', 'error');
    }
  };

  const updateUserPreferences = async (patch: { darkMode?: boolean; language?: 'English' | 'Hindi' }) => {
    const nextDarkMode = patch.darkMode ?? profileDarkMode;
    const nextLanguage = patch.language ?? profileLanguage;
    setProfileDarkMode(nextDarkMode);
    setProfileLanguage(nextLanguage);

    if (!token || !user) {
      if (Object.prototype.hasOwnProperty.call(patch, 'darkMode')) {
        void writeGuestDarkModePreference(nextDarkMode);
      }
      return;
    }

    try {
      await storefrontApiRequest('/api/public/storefront/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          darkMode: nextDarkMode,
          language: nextLanguage,
        }),
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save app settings', 'error');
    }
  };

  const addPaymentMethod = async () => {
    if (!token || !user) {
      const n = paymentMethods.length + 1;
      setPaymentMethods(prev => [
        ...prev,
        {
          id: `pm_upi_${Date.now()}`,
          label: 'UPI',
          detail: `user${n}@upi`,
          isDefault: false,
        },
      ]);
      showToast('Payment method added');
      return;
    }

    try {
      const n = paymentMethods.length + 1;
      const json = await storefrontApiRequest<{ paymentMethods: ProfilePaymentMethod[] }>(
        '/api/public/storefront/payment-methods',
        {
          method: 'POST',
          body: JSON.stringify({
            methodType: 'UPI',
            label: 'UPI',
            detail: `user${n}@upi`,
          }),
        },
      );
      setPaymentMethods(Array.isArray(json.paymentMethods) ? json.paymentMethods : []);
      showToast('Payment method added');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Payment method add failed', 'error');
    }
  };

  const setDefaultPaymentMethod = async (methodId: string) => {
    if (!token || !user) {
      setPaymentMethods(prev =>
        prev.map(method => ({
          ...method,
          isDefault: method.id === methodId,
        })),
      );
      showToast('Default payment method updated');
      return;
    }

    try {
      const json = await storefrontApiRequest<{ paymentMethods: ProfilePaymentMethod[] }>(
        '/api/public/storefront/payment-methods/default',
        {
          method: 'POST',
          body: JSON.stringify({ methodId }),
        },
      );
      setPaymentMethods(Array.isArray(json.paymentMethods) ? json.paymentMethods : []);
      showToast('Default payment method updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Default update failed', 'error');
    }
  };

  const addInstallationRequest = async () => {
    if (!token || !user) {
      const now = new Date();
      setInstallationRequests(prev => [
        {
          id: `INS${now.getTime().toString().slice(-5)}`,
          createdAt: now.toLocaleDateString('en-IN'),
          status: 'Pending',
          note: 'Installation requested for recent purchase',
        },
        ...prev,
      ]);
      showToast('Installation request submitted');
      return;
    }

    try {
      const json = await storefrontApiRequest<{ installationRequests: ProfileServiceRequest[] }>(
        '/api/public/storefront/installation-requests',
        {
          method: 'POST',
          body: JSON.stringify({ note: 'Installation requested for recent purchase' }),
        },
      );
      setInstallationRequests(Array.isArray(json.installationRequests) ? json.installationRequests : []);
      showToast('Installation request submitted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Installation request failed', 'error');
    }
  };

  const addWarrantyClaim = async () => {
    if (!token || !user) {
      const now = new Date();
      setWarrantyClaims(prev => [
        {
          id: `WAR${now.getTime().toString().slice(-5)}`,
          createdAt: now.toLocaleDateString('en-IN'),
          status: 'Submitted',
          note: 'Warranty claim filed for product issue',
        },
        ...prev,
      ]);
      showToast('Warranty claim submitted');
      return;
    }

    try {
      const json = await storefrontApiRequest<{ warrantyClaims: ProfileWarrantyClaim[] }>(
        '/api/public/storefront/warranty-claims',
        {
          method: 'POST',
          body: JSON.stringify({ note: 'Warranty claim filed for product issue' }),
        },
      );
      setWarrantyClaims(Array.isArray(json.warrantyClaims) ? json.warrantyClaims : []);
      showToast('Warranty claim submitted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Warranty claim failed', 'error');
    }
  };

  const closeCheckoutModal = () => {
    if (isCheckoutSubmitting) {
      return;
    }
    setIsCheckoutSheetVisible(false);
    setIsOrderPlaced(false);
  };

  const handleSocialAuthPress = (provider: 'Google' | 'Facebook') => {
    showToast(`${provider} authentication coming soon`, 'error');
  };

  const addProductToCart = (product: PublicProductDetail, capacity: string, qtyToAdd = 1) => {
    const unitPrice = getDetailPrice(product).base;
    const itemId = `${product.id}_${capacity}`.toLowerCase();
    const now = Date.now();
    const duplicateTapMs = 450;
    if (
      lastAddActionRef.current &&
      lastAddActionRef.current.id === itemId &&
      now - lastAddActionRef.current.ts < duplicateTapMs
    ) {
      return;
    }
    lastAddActionRef.current = { id: itemId, ts: now };
    let nextQty = qtyToAdd;
    const thumbnail = product.images[0] || 'https://dummyimage.com/240x160/e6ece2/1f2937.png&text=Product';
    setCartItems(prev => {
      const idx = prev.findIndex(item => item.id === itemId);
      if (idx >= 0) {
        const next = [...prev];
        nextQty = next[idx].qty + qtyToAdd;
        next[idx] = { ...next[idx], qty: nextQty };
        return next;
      }
      nextQty = qtyToAdd;
      return [
        ...prev,
        {
          id: itemId,
          productId: product.id,
          name: product.name,
          model: product.model,
          capacity,
          thumbnail,
          qty: qtyToAdd,
          unitPrice,
        },
      ];
    });
    showToast(`${product.name} (${capacity}) added. In cart: ${nextQty}`);
  };

  const ensureProductInCart = (product: PublicProductDetail, capacity: string, qtyToEnsure = 1) => {
    const unitPrice = getDetailPrice(product).base;
    const itemId = `${product.id}_${capacity}`.toLowerCase();
    const thumbnail = product.images[0] || 'https://dummyimage.com/240x160/e6ece2/1f2937.png&text=Product';
    let alreadyInCart = false;
    setCartItems(prev => {
      const idx = prev.findIndex(item => item.id === itemId);
      if (idx >= 0) {
        alreadyInCart = true;
        return prev;
      }
      return [
        ...prev,
        {
          id: itemId,
          productId: product.id,
          name: product.name,
          model: product.model,
          capacity,
          thumbnail,
          qty: qtyToEnsure,
          unitPrice,
        },
      ];
    });
    if (!alreadyInCart) {
      showToast(`${product.name} (${capacity}) ready for checkout`);
    }
  };

  const runWithAddActionLock = (fn: () => void) => {
    if (addActionLockRef.current) {
      return;
    }
    addActionLockRef.current = true;
    fn();
    setTimeout(() => {
      addActionLockRef.current = false;
    }, 550);
  };

  const removeCartItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const changeCartQty = (id: string, nextQty: number) => {
    if (nextQty <= 0) {
      removeCartItem(id);
      return;
    }
    setCartItems(prev => prev.map(item => (item.id === id ? { ...item, qty: nextQty } : item)));
  };

  const handleAddToCartFromDetail = () => {
    if (!selectedProduct) return;
    const availableCaps = getAvailableCapacities(selectedProduct);
    if (!availableCaps.includes(selectedCapacity)) {
      showToast('Selected capacity is unavailable for this product', 'error');
      return;
    }
    runWithAddActionLock(() => addProductToCart(selectedProduct, selectedCapacity, 1));
  };

  const handleBuyNowFromDetail = () => {
    if (!selectedProduct) return;
    const availableCaps = getAvailableCapacities(selectedProduct);
    if (!availableCaps.includes(selectedCapacity)) {
      showToast('Selected capacity is unavailable for this product', 'error');
      return;
    }
    runWithAddActionLock(() => ensureProductInCart(selectedProduct, selectedCapacity, 1));
    setIsDetailModalVisible(false);
    setIsOrderPlaced(false);
    setIsCheckoutSheetVisible(true);
  };

  const submitCheckoutOrder = async () => {
    try {
      setIsCheckoutSubmitting(true);
      const checkoutRes = await storefrontApiRequest<{
        order?: ProfileOrder;
        orders?: ProfileOrder[];
        cartItems?: CartItem[];
      }>('/api/public/storefront/checkout', {
        method: 'POST',
        body: JSON.stringify({
          firstName: checkoutFirstName.trim(),
          lastName: checkoutLastName.trim(),
          phone: checkoutPhone.trim(),
          email: checkoutEmail.trim(),
        }),
      });
      setCheckoutFirstName('');
      setCheckoutLastName('');
      setCheckoutPhone('');
      setCheckoutEmail('');
      skipNextCartSyncRef.current = true;
      setCartItems(Array.isArray(checkoutRes.cartItems) ? checkoutRes.cartItems : []);
      if (Array.isArray(checkoutRes.orders) && checkoutRes.orders.length > 0) {
        setProfileOrders(checkoutRes.orders);
      } else if (checkoutRes.order) {
        setProfileOrders(prev => [checkoutRes.order as ProfileOrder, ...prev]);
      } else {
        await loadStorefrontState();
      }
      setIsOrderPlaced(true);
      showToast('Order placed successfully');
    } catch (err) {
      Alert.alert('Checkout Failed', err instanceof Error ? err.message : 'Unable to place order');
    } finally {
      setIsCheckoutSubmitting(false);
    }
  };

  const continueCheckout = () => {
    setIsOrderPlaced(false);
    setIsCheckoutSheetVisible(true);
  };

  const submitFeedback = async () => {
    const selectedOrderItem = feedbackOrderItems.find(item => item.orderItemId === selectedFeedbackOrderItemId) || null;
    if (!selectedOrderItem) {
      Alert.alert('Validation', 'Please select an order item for feedback.');
      return;
    }
    if (!feedbackMessage.trim()) {
      Alert.alert('Validation', 'Please enter your feedback message.');
      return;
    }
    try {
      await storefrontApiRequest('/api/public/feedback', {
        method: 'POST',
        body: JSON.stringify({
          rating: feedbackRating,
          message: feedbackMessage.trim(),
          orderId: selectedOrderItem.orderId,
          orderItemId: selectedOrderItem.orderItemId,
          productId: selectedOrderItem.productId,
        }),
      });
      showToast(`Thanks for your ${feedbackRating}-star feedback`);
      setFeedbackMessage('');
      setFeedbackRating(4);
      setSelectedFeedbackOrderItemId(selectedOrderItem.orderItemId);
      setPublicView('landing');
    } catch (err) {
      Alert.alert('Feedback Failed', err instanceof Error ? err.message : 'Unable to submit feedback');
    }
  };

  const submitLoggedInCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Cart Empty', 'Add items to cart before checkout.');
      return;
    }
    await submitCheckoutOrder();
  };

  const submitGuestCheckout = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Cart Empty', 'Add items to cart before checkout.');
      return;
    }
    await submitCheckoutOrder();
  };

  const showLocationDetectedAlert = (title: string, location: DeliveryLocation) => {
    const details = [
      `Location: ${location.label}`,
      location.pincode ? `Pincode: ${location.pincode}` : null,
      Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng))
        ? `Coords: ${Number(location.lat).toFixed(5)}, ${Number(location.lng).toFixed(5)}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');
    Alert.alert(title, details || 'Location fetched successfully.');
  };

  const showEnableLocationAlert = () => {
    Alert.alert(
      'Enable Location',
      'Device location is turned off. Please enable Location/GPS and try again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
  };

  const isLocationServiceDisabledError = (err: unknown) => {
    const message = String((err as any)?.message || '').toLowerCase();
    return /location services? (are )?disabled|location service is disabled|gps is disabled/.test(message);
  };

  const loadPublicStock = async () => {
    if (typeof fetch !== 'function') {
      return;
    }
    try {
      setIsPublicLoading(true);
      const stockUrl = `${API_BASE}/api/public/stock`;
      let stockRes: Response;
      try {
        stockRes = await fetch(stockUrl);
      } catch (err) {
        throw toFetchError(stockUrl, err, 'Failed to load public stock');
      }
      const stockJson = await stockRes.json();
      if (!stockRes.ok) {
        throw new Error(stockJson.error || 'Failed to load public stock');
      }
      setPublicStock(stockJson.items || []);

      // Try products endpoint first; fallback to stock-derived cards if unavailable.
      try {
        const productsUrl = `${API_BASE}/api/public/products`;
        const productsRes = await fetch(productsUrl);
        const productsJson = await productsRes.json();
        if (productsRes.ok && Array.isArray(productsJson.products)) {
          setPublicProducts(productsJson.products);
        } else {
          throw new Error('Products endpoint unavailable');
        }
      } catch {
        const fallbackProducts: PublicProduct[] = (stockJson.items || []).map((item: PublicStockItem) => ({
          id: item.id,
          name: item.name,
          model: item.sku,
          brand: '',
          category: item.category,
          tags: [],
          shortDescription: `${item.category} product`,
          thumbnail: 'https://dummyimage.com/900x600/1f2937/f9fafb.png&text=Product',
        }));
        setPublicProducts(fallbackProducts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load public stock');
    } finally {
      setIsPublicLoading(false);
    }
  };

  const loadStorefrontState = async () => {
    if (typeof fetch !== 'function') {
      return;
    }

    try {
      const json = await storefrontApiRequest<{
        cartItems: CartItem[];
        orders: ProfileOrder[];
        wishlistIds?: string[];
        paymentMethods?: ProfilePaymentMethod[];
        installationRequests?: ProfileServiceRequest[];
        warrantyClaims?: ProfileWarrantyClaim[];
        notificationPrefs?: { orderUpdates: boolean; promotions: boolean; warrantyAlerts: boolean };
        profile?: { name: string; email: string; phone: string } | null;
        preferences?: { darkMode: boolean; language: 'English' | 'Hindi' };
      }>('/api/public/storefront/state');

      skipNextCartSyncRef.current = true;
      setCartItems(Array.isArray(json.cartItems) ? json.cartItems : []);
      setProfileOrders(Array.isArray(json.orders) ? json.orders : []);

      if (token && user) {
        setWishlistIds(Array.isArray(json.wishlistIds) ? json.wishlistIds : []);
        setPaymentMethods(
          Array.isArray(json.paymentMethods) && json.paymentMethods.length > 0
            ? json.paymentMethods
            : DEFAULT_PAYMENT_METHODS,
        );
        setInstallationRequests(Array.isArray(json.installationRequests) ? json.installationRequests : []);
        setWarrantyClaims(Array.isArray(json.warrantyClaims) ? json.warrantyClaims : []);
        if (json.notificationPrefs) {
          setNotificationPrefs({
            orderUpdates: Boolean(json.notificationPrefs.orderUpdates),
            promotions: Boolean(json.notificationPrefs.promotions),
            warrantyAlerts: Boolean(json.notificationPrefs.warrantyAlerts),
          });
        }
        if (json.profile) {
          setProfileName(json.profile.name || profileName);
          setProfileEmail(json.profile.email || profileEmail);
          setProfilePhone(json.profile.phone || profilePhone);
        }
        if (json.preferences) {
          setProfileDarkMode(Boolean(json.preferences.darkMode));
          setProfileLanguage(json.preferences.language === 'Hindi' ? 'Hindi' : 'English');
        }
      } else {
        const guestDarkMode = await readGuestDarkModePreference();
        setWishlistIds([]);
        setPaymentMethods(DEFAULT_PAYMENT_METHODS);
        setInstallationRequests([]);
        setWarrantyClaims([]);
        setProfileName('Piyush Sharma');
        setProfileEmail('piyush@email.com');
        setProfilePhone('+91 98XXXXXXXX');
        setProfileDarkMode(guestDarkMode);
        setNotificationPrefs({
          orderUpdates: true,
          promotions: true,
          warrantyAlerts: true,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storefront data');
    } finally {
      setIsStorefrontHydrated(true);
    }
  };

  const syncCartToStorefront = async (nextCart: CartItem[]) => {
    try {
      await storefrontApiRequest<{ cartItems: CartItem[] }>('/api/public/storefront/cart', {
        method: 'POST',
        body: JSON.stringify({ items: nextCart }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync cart');
    }
  };

  const openProductDetail = async (productId: string) => {
    try {
      setIsPublicDetailLoading(true);
      setError(null);
      const detailUrl = `${API_BASE}/api/public/products/${productId}`;
      let res: Response;
      try {
        res = await fetch(detailUrl);
      } catch (err) {
        throw toFetchError(detailUrl, err, 'Failed to load product details');
      }
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load product details');
      }
      setSelectedProduct(json.product || null);
      setIsDetailModalVisible(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open product');
    } finally {
      setIsPublicDetailLoading(false);
    }
  };

  const loadLocationProfile = async () => {
    try {
      const q = `?guestId=${encodeURIComponent(guestIdRef.current)}`;
      const json = await locationApiRequest<{ profile: { currentLocation: DeliveryLocation | null; savedLocations: DeliveryLocation[]; recentLocations: DeliveryLocation[] } }>(
        `/api/public/location-profile${q}`,
      );
      if (json.profile.currentLocation) {
        setCurrentDeliveryLocation(json.profile.currentLocation);
      }
      setSavedLocations(json.profile.savedLocations || []);
      setRecentLocations(json.profile.recentLocations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load location profile');
    }
  };

  const selectDeliveryLocation = async (location: DeliveryLocation, saveToSaved = false) => {
    // Optimistic UI update so landing header changes immediately.
    setCurrentDeliveryLocation(location);
    const q = `?guestId=${encodeURIComponent(guestIdRef.current)}`;
    const payload = { location, saveToSaved, guestId: guestIdRef.current };
    const json = await locationApiRequest<{ profile: { currentLocation: DeliveryLocation | null; savedLocations: DeliveryLocation[]; recentLocations: DeliveryLocation[] } }>(
      `/api/public/location-profile/select${q}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    if (json.profile.currentLocation) {
      setCurrentDeliveryLocation(json.profile.currentLocation);
    }
    setSavedLocations(json.profile.savedLocations || []);
    setRecentLocations(json.profile.recentLocations || []);
  };

  const saveLocationToBook = async (location: DeliveryLocation) => {
    const q = `?guestId=${encodeURIComponent(guestIdRef.current)}`;
    const payload = { location, guestId: guestIdRef.current };
    const json = await locationApiRequest<{ profile: { currentLocation: DeliveryLocation | null; savedLocations: DeliveryLocation[]; recentLocations: DeliveryLocation[] } }>(
      `/api/public/location-profile/save${q}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    setSavedLocations(json.profile.savedLocations || []);
    setRecentLocations(json.profile.recentLocations || []);
    if (json.profile.currentLocation) {
      setCurrentDeliveryLocation(json.profile.currentLocation);
    }
  };

  const loadSearchedLocations = async (queryText: string) => {
    const q = queryText.trim();
    if (q.length < 2) {
      setSearchedLocations([]);
      setIsSearchingLocations(false);
      return;
    }
    setIsSearchingLocations(true);
    try {
      const toUnique = (list: DeliveryLocation[]) => {
        const seen = new Set<string>();
        const out: DeliveryLocation[] = [];
        for (const loc of list) {
          const key = `${loc.label}|${loc.pincode || ''}|${loc.city || ''}|${loc.state || ''}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(loc);
          if (out.length >= 5) break;
        }
        return out;
      };

      const fromNominatim = (rows: any[]) =>
        toUnique(
          rows
            .map((entry: any, idx: number) => {
              const addr = entry?.address || {};
              const city = String(addr.city || addr.town || addr.village || addr.county || '').trim();
              const state = String(addr.state || '').trim();
              const country = String(addr.country || '').trim();
              const pincode = String(addr.postcode || '').trim();
              const label = String(entry?.display_name || [city, state, country].filter(Boolean).join(', ')).trim();
              const lat = Number.isFinite(Number(entry?.lat)) ? Number(entry.lat) : null;
              const lng = Number.isFinite(Number(entry?.lon)) ? Number(entry.lon) : null;
              if (!label) return null;
              return {
                id: `loc_search_nom_${entry?.osm_id || idx}_${Date.now()}`,
                label,
                city,
                state,
                country,
                pincode,
                lat,
                lng,
                source: 'search',
              } as DeliveryLocation;
            })
            .filter((entry): entry is DeliveryLocation => Boolean(entry)),
        );

      const fromOpenMeteo = (rows: any[]) =>
        toUnique(
          rows
            .map((entry: any, idx: number) => {
              const city = String(entry?.name || '').trim();
              const state = String(entry?.admin1 || entry?.admin2 || '').trim();
              const country = String(entry?.country || '').trim();
              const pincode = Array.isArray(entry?.postcodes) ? String(entry.postcodes[0] || '').trim() : '';
              const label = [city, state, country].filter(Boolean).join(', ');
              const lat = Number.isFinite(Number(entry?.latitude)) ? Number(entry.latitude) : null;
              const lng = Number.isFinite(Number(entry?.longitude)) ? Number(entry.longitude) : null;
              if (!label) return null;
              return {
                id: `loc_search_om_${entry?.id || idx}_${Date.now()}`,
                label,
                city,
                state,
                country,
                pincode,
                lat,
                lng,
                source: 'search',
              } as DeliveryLocation;
            })
            .filter((entry): entry is DeliveryLocation => Boolean(entry)),
        );

      const fromPostalApi = (rows: any[], pin: string) =>
        toUnique(
          rows
            .map((entry: any, idx: number) => {
              const area = String(entry?.Name || '').trim();
              const city = String(entry?.District || '').trim();
              const state = String(entry?.State || '').trim();
              const country = 'India';
              const label = [area, city, state, country].filter(Boolean).join(', ');
              if (!label) return null;
              return {
                id: `loc_search_pin_${idx}_${pin}_${Date.now()}`,
                label,
                area,
                city,
                state,
                country,
                pincode: pin,
                lat: null,
                lng: null,
                source: 'search',
              } as DeliveryLocation;
            })
            .filter((entry): entry is DeliveryLocation => Boolean(entry)),
        );

      const isNumeric = /^[0-9]+$/.test(q);
      let mapped: DeliveryLocation[] = [];

      if (isNumeric) {
        if (q.length < 6) {
          setSearchedLocations([]);
          return;
        }
        try {
          const pinRes = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(q)}`);
          const pinJson = await parseResponseSafe(pinRes);
          const first = Array.isArray(pinJson) ? pinJson[0] : null;
          if (pinRes.ok && first?.Status === 'Success' && Array.isArray(first?.PostOffice)) {
            mapped = fromPostalApi(first.PostOffice, q);
          } else {
            console.error('[LocationSearch] Postal API no results', { query: q, status: pinRes.status, pinJson });
          }
        } catch (err) {
          console.error('[LocationSearch] Postal API failed', { query: q, error: err });
        }
      } else {
        try {
          const omRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`,
          );
          const omJson = await parseResponseSafe(omRes);
          if (omRes.ok && Array.isArray((omJson as any)?.results)) {
            mapped = fromOpenMeteo((omJson as any).results);
          } else {
            console.error('[LocationSearch] Open-Meteo no results', { query: q, status: omRes.status, omJson });
          }
        } catch (err) {
          console.error('[LocationSearch] Open-Meteo failed', { query: q, error: err });
        }

        if (mapped.length === 0) {
          try {
            const nomRes = await fetch(
              `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`,
              {
                headers: {
                  Accept: 'application/json',
                },
              },
            );
            const nomJson = await parseResponseSafe(nomRes);
            if (nomRes.ok && Array.isArray(nomJson)) {
              mapped = fromNominatim(nomJson);
            } else {
              console.error('[LocationSearch] Nominatim fallback failed', {
                query: q,
                status: nomRes.status,
                nomJson,
              });
            }
          } catch (err) {
            console.error('[LocationSearch] Nominatim request failed', { query: q, error: err });
          }
        }
      }

      setSearchedLocations(mapped);
    } catch (err) {
      console.error('[LocationSearch] Search fetch failed', { query: q, error: err });
      setSearchedLocations([]);
    } finally {
      setIsSearchingLocations(false);
    }
  };

  const detectCurrentLocation = async () => {
    try {
      setIsDetectingLocation(true);
      if (Platform.OS === 'android') {
        const finePermission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
        const coarsePermission = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
        const hasFine = await PermissionsAndroid.check(finePermission);
        const hasCoarse = await PermissionsAndroid.check(coarsePermission);
        let permission: string | null = hasFine || hasCoarse ? PermissionsAndroid.RESULTS.GRANTED : null;
        if (!hasFine && !hasCoarse) {
          permission = await PermissionsAndroid.request(finePermission, {
            title: 'Location Permission',
            message: 'FuElectric needs your location to auto-select delivery address.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          });
          if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
            permission = await PermissionsAndroid.request(coarsePermission, {
              title: 'Approximate Location Permission',
              message: 'Allow approximate location to suggest delivery areas.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            });
          }
        }
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          if (permission === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
            Alert.alert(
              'Location Permission Blocked',
              'Permission is blocked. You can continue with city search or enable location in app settings.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ],
            );
          }
          throw new Error('Location permission denied. You can still select city/pincode manually.');
        }
      }

      const nav = (globalThis as any).navigator;
      if (!nav?.geolocation?.getCurrentPosition) {
        showToast('GPS not available in this build, using network location');
        await detectLocationByNetwork();
        return;
      }

      const position = await new Promise<any>((resolve, reject) => {
        nav.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 10000,
        });
      });
      const lat = Number(position?.coords?.latitude);
      const lng = Number(position?.coords?.longitude);

      let city = '';
      let state = '';
      let country = 'India';
      let pincode = '';
      let label = `Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)}`;

      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}`,
        );
        const j = await r.json();
        const addr = j?.address || {};
        city = String(addr.city || addr.town || addr.village || addr.county || '').trim();
        state = String(addr.state || '').trim();
        country = String(addr.country || country).trim();
        pincode = String(addr.postcode || '').trim();
        label = [city || state || 'Current Location', country].filter(Boolean).join(', ');
      } catch {
        // reverse geocoding failed, fallback to lat/lng label
      }

      const location: DeliveryLocation = {
        id: `loc_${Date.now()}`,
        label,
        city,
        state,
        country,
        pincode,
        lat,
        lng,
        source: 'gps',
      };
      await selectDeliveryLocation(location, true);
      showToast(`Current location: ${location.label}`);
      showLocationDetectedAlert('Location Fetched', location);
    } catch (err) {
      console.error('[Location] Current location fetch failed', err);
      const message = err instanceof Error ? err.message : 'Failed to detect current location';
      if (isLocationServiceDisabledError(err)) {
        showEnableLocationAlert();
        setError('Location is off. Enable Location/GPS and try again.');
        return;
      } else if (/permission denied/i.test(message)) {
        Alert.alert('Location Permission Needed', 'Allow location permission to use current location.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        setError('Location permission denied.');
        return;
      } else if (/timeout/i.test(message)) {
        setError('Could not fetch GPS fix in time. Location may be ON; try again outdoors or use network detection.');
        Alert.alert(
          'Location Timeout',
          'Could not get GPS fix in time. If Location is already enabled, try again outdoors or use Auto Detect by Network.',
        );
        return;
      } else {
        setError(message);
      }
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const detectLocationByNetwork = async () => {
    try {
      setIsDetectingLocation(true);
      let city = '';
      let state = '';
      let country = 'India';
      let pincode = '';
      let lat: number | null = null;
      let lng: number | null = null;

      let resolved = false;
      const providerErrors: string[] = [];

      try {
        const ipRes = await fetch('https://ipapi.co/json/');
        const ipJson = await parseResponseSafe(ipRes);
        if (!ipRes.ok || typeof ipJson !== 'object' || !ipJson) {
          throw new Error(`ipapi unavailable (${ipRes.status})`);
        }
        city = String((ipJson as any).city || '').trim();
        state = String((ipJson as any).region || '').trim();
        country = String((ipJson as any).country_name || country).trim();
        pincode = String((ipJson as any).postal || '').trim();
        lat = Number.isFinite(Number((ipJson as any).latitude)) ? Number((ipJson as any).latitude) : null;
        lng = Number.isFinite(Number((ipJson as any).longitude)) ? Number((ipJson as any).longitude) : null;
        resolved = Boolean(city || state || pincode || (lat !== null && lng !== null));
      } catch (e) {
        console.error('[LocationNetwork] ipapi failed', e);
        providerErrors.push(e instanceof Error ? e.message : 'ipapi failed');
      }

      if (!resolved) {
        try {
          const backupRes = await fetch('https://ipwho.is/');
          const backupJson = await parseResponseSafe(backupRes);
          if (!backupRes.ok || typeof backupJson !== 'object' || !(backupJson as any).success) {
            throw new Error(`ipwho.is unavailable (${backupRes.status})`);
          }
          city = String((backupJson as any).city || '').trim();
          state = String((backupJson as any).region || '').trim();
          country = String((backupJson as any).country || country).trim();
          pincode = String((backupJson as any).postal || '').trim();
          lat = Number.isFinite(Number((backupJson as any).latitude)) ? Number((backupJson as any).latitude) : null;
          lng = Number.isFinite(Number((backupJson as any).longitude)) ? Number((backupJson as any).longitude) : null;
          resolved = Boolean(city || state || pincode || (lat !== null && lng !== null));
        } catch (e) {
          console.error('[LocationNetwork] ipwho.is failed', e);
          providerErrors.push(e instanceof Error ? e.message : 'ipwho.is failed');
        }
      }

      if (!resolved) {
        throw new Error(
          `Unable to detect network location right now. ${providerErrors.filter(Boolean).join(' | ') || 'Please try again.'}`.trim(),
        );
      }

      const label = [city || 'Detected Location', state, country].filter(Boolean).join(', ');
      const location: DeliveryLocation = {
        id: `loc_net_${Date.now()}`,
        label,
        area: '',
        city,
        state,
        country,
        pincode,
        lat,
        lng,
        source: 'network',
      };

      await selectDeliveryLocation(location, true);
      showToast(`Network location: ${location.label}`);
      showLocationDetectedAlert('Location Fetched (Network)', location);
    } catch (err) {
      console.error('[LocationNetwork] Network detection failed', err);
      const message = err instanceof Error ? err.message : 'Failed to detect location from network';
      setError(message);
      Alert.alert('Network Location Failed', message);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  const loadAll = async () => {
    if (!token || user?.role !== 'admin' || typeof fetch !== 'function') {
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const [itemsRes, overviewRes, supRes, cusRes, poRes, soRes, billRes, invRes, movRes] = await Promise.all([
        apiRequest<{ items: Item[] }>('/api/items'),
        apiRequest<{ overview: Overview }>('/api/management/overview'),
        apiRequest<{ suppliers: Party[] }>('/api/suppliers'),
        apiRequest<{ customers: Party[] }>('/api/customers'),
        apiRequest<{ purchaseOrders: Doc[] }>('/api/purchase-orders'),
        apiRequest<{ salesOrders: Doc[] }>('/api/sales-orders'),
        apiRequest<{ bills: Doc[] }>('/api/bills'),
        apiRequest<{ invoices: Doc[] }>('/api/invoices'),
        apiRequest<{ movements: Movement[] }>('/api/stock-adjustments?limit=40'),
      ]);

      setItems(itemsRes.items);
      setOverview(overviewRes.overview);
      setSuppliers(supRes.suppliers);
      setCustomers(cusRes.customers);
      setPurchaseOrders(poRes.purchaseOrders);
      setSalesOrders(soRes.salesOrders);
      setBills(billRes.bills);
      setInvoices(invRes.invoices);
      setMovements(movRes.movements);

      if (!selectedItemId && itemsRes.items[0]) {
        setSelectedItemId(itemsRes.items[0].id);
      }
      if (!selectedSupplierId && supRes.suppliers[0]) {
        setSelectedSupplierId(supRes.suppliers[0].id);
      }
      if (!selectedCustomerId && cusRes.customers[0]) {
        setSelectedCustomerId(cusRes.customers[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const restoreSavedAuthSession = async () => {
      try {
        const savedToken = String((await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) || '').trim();
        const savedUserRaw = await AsyncStorage.getItem(AUTH_USER_STORAGE_KEY);
        if (!savedToken || !savedUserRaw) {
          return;
        }

        const parsedUser = JSON.parse(savedUserRaw);
        const role =
          parsedUser?.role === 'admin' || parsedUser?.role === 'manager' || parsedUser?.role === 'staff'
            ? parsedUser.role
            : null;
        if (!role || !parsedUser?.id || !parsedUser?.username || !parsedUser?.name) {
          await clearSavedAuthSession();
          return;
        }

        if (!isMounted) {
          return;
        }

        setToken(savedToken);
        setUser({
          id: String(parsedUser.id),
          username: String(parsedUser.username),
          role,
          name: String(parsedUser.name),
        });
      } catch {
        await clearSavedAuthSession();
      }
    };

    void restoreSavedAuthSession();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void checkForAppUpdate();
  }, []);

  useEffect(() => {
    skipNextCartSyncRef.current = true;
    setIsStorefrontHydrated(false);
    loadStorefrontState();
  }, [currentOwnerKey]);

  useEffect(() => {
    if (!isStorefrontHydrated) {
      return;
    }
    if (skipNextCartSyncRef.current) {
      skipNextCartSyncRef.current = false;
      return;
    }
    syncCartToStorefront(cartItems);
  }, [cartItems, currentOwnerKey, isStorefrontHydrated]);

  useEffect(() => {
    fade.setValue(0);
    rise.setValue(8);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [moduleId, fade, rise]);

  useEffect(() => {
    if (!isViewMoreModalVisible) {
      return;
    }
    viewMoreOpacity.setValue(0);
    viewMoreRise.setValue(24);
    Animated.parallel([
      Animated.timing(viewMoreOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(viewMoreRise, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isViewMoreModalVisible, viewMoreOpacity, viewMoreRise]);

  useEffect(() => {
    loadPublicStock();
    loadLocationProfile();
  }, [token]);

  useEffect(() => {
    if (publicView !== 'feedback') {
      return;
    }
    loadFeedbackOrderItems();
  }, [publicView, currentOwnerKey]);

  useEffect(() => {
    requestAnimationFrame(() => {
      publicScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, [publicView]);

  useEffect(() => {
    if (token && user?.role === 'admin') {
      loadAll();
      return;
    }
    if (token && user && user.role !== 'admin') {
      setError(null);
    }
  }, [token, user]);
  useEffect(() => {
    if (!user) return;
    setProfileName(user.name || 'Piyush Sharma');
    setProfileEmail(user.username || 'piyush@email.com');
    if (registerPhone.trim()) {
      setProfilePhone(registerPhone.trim());
    }
  }, [user, registerPhone]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);
  useEffect(() => {
    if (selectedProduct) {
      const availableCaps = getAvailableCapacities(selectedProduct);
      if (availableCaps.length > 0) {
        setSelectedCapacity(availableCaps[0]);
        return;
      }
      const caps = getCapacityOptions(selectedProduct);
      setSelectedCapacity(caps[0]);
    }
  }, [selectedProduct]);
  useEffect(() => {
    if (isLocationModalVisible) {
      setDraftDeliveryLocation(currentDeliveryLocation);
      setShowMoreSuggestedLocations(false);
    }
  }, [isLocationModalVisible, currentDeliveryLocation]);
  useEffect(() => {
    if (!isLocationModalVisible) return;
    const timer = setTimeout(() => {
      loadSearchedLocations(locationSearch);
    }, 260);
    return () => clearTimeout(timer);
  }, [locationSearch, isLocationModalVisible]);

  const login = async () => {
    if (typeof fetch !== 'function') {
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiRequest<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setToken(res.token);
      setUser(res.user);
      try {
        await AsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, res.token);
        await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(res.user));
      } catch {
        // best-effort persistence
      }
      if (res.user.role === 'admin') {
        setModuleId('dashboard');
      }
      setIsAuthModalVisible(false);
      setAuthMode('none');
      showToast('Login successful');
    } catch (err) {
      showActionError('Login Failed', err, 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async () => {
    if (!registerName.trim() || !registerUsername.trim() || !registerPassword.trim()) {
      Alert.alert('Validation', 'Full name, email/username and password are required.');
      return;
    }
    if (registerPassword.trim().length < 6) {
      Alert.alert('Validation', 'Password must be at least 6 characters.');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: registerName.trim(),
          username: registerUsername.trim(),
          phone: registerPhone.trim(),
          password: registerPassword.trim(),
        }),
      });
      showToast('Registration successful');
      setUsername(registerUsername.trim());
      setPassword(registerPassword.trim());
      setRegisterName('');
      setRegisterUsername('');
      setRegisterPhone('');
      setRegisterPassword('');
      switchAuthMode('login');
    } catch (err) {
      showActionError('Registration Failed', err, 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    closeProfileModal();
    setIsProfileEditModalVisible(false);
    setIsItemEditModalVisible(false);
    setIsCheckoutSheetVisible(false);
    setIsOrderPlaced(false);
    setPublicView('landing');

    try {
      if (token) {
        await apiRequest('/api/auth/logout', { method: 'POST' });
      }
    } catch {
      // ignore logout failure
    } finally {
      await clearSavedAuthSession();
      setToken(null);
      setUser(null);
      showToast('Logout successful');
    }
  };

  const pickItemImages = async () => {
    if (!canEdit) {
      Alert.alert('Permission', 'Your role cannot upload item images.');
      return;
    }
    if (Platform.OS !== 'android') {
      Alert.alert('Unsupported', 'Item image upload is currently enabled on Android.');
      return;
    }

    const picker = (NativeModules as any)?.LocalImagePicker;
    if (!picker || typeof picker.pickImages !== 'function') {
      Alert.alert('Unavailable', 'Image picker is not available in this build.');
      return;
    }

    const selectedUrlCount = getFilledItemImageUrls(itemImageUrls).length;
    const remainingSlots = Math.max(0, MAX_ITEM_IMAGES - itemImages.length - selectedUrlCount);
    if (remainingSlots === 0) {
      Alert.alert('Limit Reached', `You can upload up to ${MAX_ITEM_IMAGES} images per item.`);
      return;
    }

    try {
      const selected = await picker.pickImages(remainingSlots);
      if (!Array.isArray(selected) || selected.length === 0) {
        return;
      }

      const prepared = (selected as NativePickerImage[])
        .map((asset, index) => {
          const base64Data = String(asset?.base64Data || '').replace(/\s+/g, '');
          const mimeType = String(asset?.mimeType || 'image/jpeg').trim().toLowerCase();
          if (!base64Data || !mimeType.startsWith('image/')) {
            return null;
          }
          const fileName = String(asset?.fileName || `item-image-${Date.now()}-${index + 1}.jpg`).trim();
          const size = Number(asset?.size || 0);
          const uri = String(asset?.uri || '').trim();
          return {
            id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            fileName,
            mimeType,
            size: Number.isFinite(size) ? size : 0,
            base64Data,
            previewUri: uri || `data:${mimeType};base64,${base64Data}`,
          } as ItemImageDraft;
        })
        .filter((img): img is ItemImageDraft => Boolean(img));

      if (prepared.length === 0) {
        Alert.alert('No Images', 'No valid images were selected.');
        return;
      }

      setItemImages(prev => [...prev, ...prepared].slice(0, MAX_ITEM_IMAGES));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to pick images';
      if (/cancel/i.test(message)) {
        return;
      }
      Alert.alert('Upload Failed', message);
    }
  };

  const removeItemImage = (imageId: string) => {
    setItemImages(prev => prev.filter(image => image.id !== imageId));
  };

  const setItemImageUrlValue = (index: number, value: string) => {
    setItemImageUrls(prev => prev.map((url, idx) => (idx === index ? value : url)));
  };

  const addItemImageUrlField = () => {
    setItemImageUrls(prev => {
      const next = Array.isArray(prev) && prev.length > 0 ? prev : [''];
      const filledCount = getFilledItemImageUrls(next).length;
      if (itemImages.length + filledCount >= MAX_ITEM_IMAGES || next.length >= MAX_ITEM_IMAGES) {
        return next;
      }
      const last = String(next[next.length - 1] || '').trim();
      if (!last) return next;
      return [...next, ''];
    });
  };

  const removeItemImageUrlField = (index: number) => {
    setItemImageUrls(prev => {
      if (!Array.isArray(prev) || prev.length === 0) return [''];
      if (prev.length === 1) return [''];
      const next = prev.filter((_, idx) => idx !== index);
      return next.length > 0 ? next : [''];
    });
  };

  const resetItemDraft = () => {
    setItemName('');
    setItemSku('');
    setItemBrand('');
    setItemCategory('Power Backup');
    setItemCapacityAh('150Ah');
    setItemQty('1');
    setItemReorder('8');
    setItemPurchasePrice('0');
    setItemSellingPrice('0');
    setItemTags([]);
    setItemImages([]);
    setItemImageUrls(['']);
  };

  const startItemEdit = (itemId: string) => {
    const target = items.find(item => item.id === itemId);
    if (!target) {
      Alert.alert('Not Found', 'Item could not be loaded for editing.');
      return false;
    }
    setEditingItemId(target.id);
    setItemName(target.name || '');
    setItemSku(target.sku || '');
    setItemBrand(target.brand || '');
    setItemCategory(target.category || 'Power Backup');
    setItemCapacityAh(target.capacityAh || '150Ah');
    setItemQty(String(target.qty || 0));
    setItemReorder(String(target.reorderPoint || 0));
    setItemPurchasePrice(String(target.purchasePrice || 0));
    setItemSellingPrice(String(target.sellingPrice || 0));
    setItemTags(Array.isArray(target.tags) ? target.tags.map(tag => String(tag || '').trim().toLowerCase()).filter(Boolean) : []);
    setItemImages([]);
    const existingUrls = Array.isArray(target.images)
      ? target.images.map(url => String(url || '').trim()).filter(isAllowedItemImageUrl)
      : [];
    setItemImageUrls(existingUrls.length > 0 ? existingUrls.slice(0, MAX_ITEM_IMAGES) : ['']);
    return true;
  };

  const clearItemEdit = () => {
    setEditingItemId('');
    resetItemDraft();
  };

  const openItemEditModal = (itemId: string) => {
    const hasItemLoaded = startItemEdit(itemId);
    if (hasItemLoaded) {
      setIsItemEditModalVisible(true);
    }
  };

  const closeItemEditModal = () => {
    setIsItemEditModalVisible(false);
    clearItemEdit();
  };

  const createItem = async () => {
    if (!canEdit) {
      Alert.alert('Permission', 'Your role cannot create items.');
      return;
    }
    const isEditingItem = Boolean(editingItemId);
    if (!itemName.trim() || !itemSku.trim()) {
      Alert.alert('Validation', 'Item Name and HSN/SAC are required.');
      return;
    }
    const urlImages = getFilledItemImageUrls(itemImageUrls);
    if (itemImages.length + urlImages.length > MAX_ITEM_IMAGES) {
      Alert.alert('Validation', `You can add up to ${MAX_ITEM_IMAGES} images per item.`);
      return;
    }
    const invalidUrl = urlImages.find(url => !isAllowedItemImageUrl(url));
    if (invalidUrl) {
      Alert.alert('Validation', 'Please enter valid image URLs starting with http://, https://, or /static/');
      return;
    }

    try {
      setIsSaving(true);
      await apiRequest(isEditingItem ? `/api/items/${editingItemId}` : '/api/items', {
        method: isEditingItem ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name: itemName.trim(),
          sku: itemSku.trim(),
          brand: itemBrand.trim(),
          category: itemCategory.trim(),
          capacityAh: itemCapacityAh,
          qty: Number(itemQty || 0),
          reorderPoint: Number(itemReorder || 0),
          purchasePrice: Number(itemPurchasePrice || 0),
          sellingPrice: Number(itemSellingPrice || 0),
          unit: 'pcs',
          tags: itemTags,
          uploadedImages: itemImages.map(image => ({
            fileName: image.fileName,
            mimeType: image.mimeType,
            size: image.size,
            base64Data: image.base64Data,
          })),
          images: urlImages,
        }),
      });
      if (isEditingItem) {
        setIsItemEditModalVisible(false);
      }
      setEditingItemId('');
      resetItemDraft();
      showToast(isEditingItem ? 'Item updated' : 'Item created');
      await loadAll();
    } catch (err) {
      showActionError(isEditingItem ? 'Update Item Failed' : 'Create Item Failed', err, isEditingItem ? 'Failed to update item' : 'Failed to create item');
    } finally {
      setIsSaving(false);
    }
  };

  const createParty = async (type: 'suppliers' | 'customers') => {
    if (!canEdit) {
      Alert.alert('Permission', 'Your role cannot create masters.');
      return;
    }
    if (!partyName.trim()) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }

    try {
      setIsSaving(true);
      await apiRequest(`/api/${type}`, {
        method: 'POST',
        body: JSON.stringify({
          name: partyName.trim(),
          company: partyCompany.trim(),
          email: partyEmail.trim(),
          phone: partyPhone.trim(),
          gstin: partyGstin.trim(),
        }),
      });
      setPartyName('');
      setPartyCompany('');
      setPartyEmail('');
      setPartyPhone('');
      setPartyGstin('');
      await loadAll();
    } catch (err) {
      showActionError('Create Failed', err, 'Failed to create master');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteParty = async (type: 'suppliers' | 'customers', id: string) => {
    if (!canDeleteMaster) {
      Alert.alert('Permission', 'Only admin can delete master records.');
      return;
    }
    try {
      setIsSaving(true);
      await apiRequest(`/api/${type}/${id}`, { method: 'DELETE' });
      await loadAll();
    } catch (err) {
      showActionError('Delete Failed', err, 'Delete failed');
    } finally {
      setIsSaving(false);
    }
  };

  const createDocument = async (type: 'purchase-orders' | 'sales-orders' | 'bills' | 'invoices') => {
    if (!canEdit) {
      Alert.alert('Permission', 'Your role cannot create documents.');
      return;
    }
    if (!selectedItemId) {
      Alert.alert('Validation', 'Select an item first.');
      return;
    }

    const qtyNum = Number(qty || 0);
    const priceNum = Number(price || 0);
    if (qtyNum <= 0 || priceNum < 0) {
      Alert.alert('Validation', 'Qty > 0 and amount >= 0 required.');
      return;
    }

    const payload: any = {
      itemId: selectedItemId,
      qty: qtyNum,
      dueDate: dueDate.trim(),
    };

    if (type === 'purchase-orders') {
      payload.vendor = nameField.trim() || 'Vendor';
      payload.unitCost = priceNum;
      payload.expectedDate = dueDate.trim();
    }
    if (type === 'sales-orders') {
      payload.customer = nameField.trim() || 'Customer';
      payload.unitPrice = priceNum;
    }
    if (type === 'bills') {
      payload.supplierId = selectedSupplierId;
      payload.unitCost = priceNum;
    }
    if (type === 'invoices') {
      payload.customerId = selectedCustomerId;
      payload.unitPrice = priceNum;
    }

    try {
      setIsSaving(true);
      await apiRequest(`/api/${type}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setQty('1');
      setPrice('0');
      setNameField('');
      setDueDate('');
      await loadAll();
    } catch (err) {
      showActionError('Create Document Failed', err, 'Create failed');
    } finally {
      setIsSaving(false);
    }
  };

  const executeAction = async (path: string) => {
    if (!canEdit) {
      Alert.alert('Permission', 'Your role cannot perform this action.');
      return;
    }
    try {
      setIsSaving(true);
      await apiRequest(path, { method: 'POST' });
      await loadAll();
    } catch (err) {
      showActionError('Action Failed', err, 'Action failed');
    } finally {
      setIsSaving(false);
    }
  };

  const postAdjustment = async () => {
    if (!canEdit) {
      Alert.alert('Permission', 'Your role cannot post adjustments.');
      return;
    }
    const delta = Number(adjustDelta || 0);
    if (!selectedItemId || !Number.isFinite(delta) || delta === 0) {
      Alert.alert('Validation', 'Choose item and non-zero delta.');
      return;
    }
    try {
      setIsSaving(true);
      await apiRequest('/api/stock-adjustments', {
        method: 'POST',
        body: JSON.stringify({ itemId: selectedItemId, delta, reason: adjustReason }),
      });
      await loadAll();
    } catch (err) {
      showActionError('Adjustment Failed', err, 'Adjustment failed');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter(item => !q || `${item.name} ${item.sku} ${item.category} ${item.brand}`.toLowerCase().includes(q));
  }, [items, search]);
  const featuredPublic = useMemo(() => publicStock.slice(0, 2), [publicStock]);
  const inverterProducts = useMemo(
    () =>
      publicProducts.filter(product =>
        `${product.name} ${product.model} ${product.brand} ${product.category}`.toLowerCase().includes('inverter'),
      ),
    [publicProducts],
  );
  const batteryProducts = useMemo(
    () =>
      publicProducts.filter(product =>
        `${product.name} ${product.model} ${product.brand} ${product.category}`.toLowerCase().includes('battery'),
      ),
    [publicProducts],
  );
  const accessoryProducts = useMemo(
    () =>
      publicProducts.filter(product => {
        const t = `${product.name} ${product.model} ${product.brand} ${product.category}`.toLowerCase();
        return !t.includes('inverter') && !t.includes('battery');
      }),
    [publicProducts],
  );
  const landingProducts = useMemo(() => {
    if (landingCategory === 'inverters') {
      return inverterProducts;
    }
    if (landingCategory === 'batteries') {
      return batteryProducts;
    }
    return accessoryProducts;
  }, [landingCategory, inverterProducts, batteryProducts, accessoryProducts]);
  const searchedLandingProducts = useMemo(() => {
    const q = publicSearch.trim().toLowerCase();
    if (!q) {
      return landingProducts;
    }
    return landingProducts.filter(product =>
      `${product.name} ${product.model} ${product.brand} ${product.category} ${product.shortDescription}`.toLowerCase().includes(q),
    );
  }, [landingProducts, publicSearch]);
  const searchedPublicProducts = useMemo(() => {
    const q = publicSearch.trim().toLowerCase();
    if (!q) {
      return publicProducts;
    }
    return publicProducts.filter(product =>
      `${product.name} ${product.model} ${product.brand} ${product.category} ${product.shortDescription}`.toLowerCase().includes(q),
    );
  }, [publicProducts, publicSearch]);
  const featuredLandingProducts = useMemo(() => {
    const featured = searchedPublicProducts.filter(product => Boolean(getOfferLabel(product)));
    return featured.length > 0 ? featured : searchedPublicProducts.slice(0, 10);
  }, [searchedPublicProducts]);
  const viewMoreProducts = useMemo(() => {
    if (viewMoreContext === 'category') {
      return searchedLandingProducts;
    }
    if (viewMoreContext === 'featured') {
      return featuredLandingProducts;
    }
    return searchedPublicProducts;
  }, [viewMoreContext, searchedLandingProducts, featuredLandingProducts, searchedPublicProducts]);
  const viewMoreTitle = useMemo(() => {
    if (viewMoreContext === 'category') {
      if (landingCategory === 'inverters') return 'Inverter Products';
      if (landingCategory === 'batteries') return 'Battery Products';
      return 'Accessories Products';
    }
    if (viewMoreContext === 'featured') {
      return 'Featured Products';
    }
    return 'All Products';
  }, [viewMoreContext, landingCategory]);
  const categoryCards = useMemo(
    () => [
      { key: 'inverters' as LandingCategory, label: 'Inverters', icon: '⚡', thumb: inverterProducts[0]?.thumbnail },
      { key: 'batteries' as LandingCategory, label: 'Batteries', icon: '🔋', thumb: batteryProducts[0]?.thumbnail },
      { key: 'accessories' as LandingCategory, label: 'Accessories', icon: '🛠', thumb: accessoryProducts[0]?.thumbnail },
    ],
    [inverterProducts, batteryProducts, accessoryProducts],
  );
  const cartItemCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.qty, 0), [cartItems]);
  const cartQtyByProductId = useMemo(() => {
    const out: Record<string, number> = {};
    for (const item of cartItems) {
      out[item.productId] = (out[item.productId] || 0) + item.qty;
    }
    return out;
  }, [cartItems]);
  const cartAddedStatusText = useMemo(
    () =>
      cartItemCount > 0
        ? `${cartItemCount} item${cartItemCount === 1 ? '' : 's'} already added in cart`
        : 'No items added in cart yet',
    [cartItemCount],
  );
  const selectedProductCartQty = useMemo(() => {
    if (!selectedProduct) {
      return 0;
    }
    return cartQtyByProductId[selectedProduct.id] || 0;
  }, [selectedProduct, cartQtyByProductId]);
  const selectedVariantCartQty = useMemo(() => {
    if (!selectedProduct) {
      return 0;
    }
    const id = `${selectedProduct.id}_${selectedCapacity}`.toLowerCase();
    const match = cartItems.find(item => item.id === id);
    return match?.qty || 0;
  }, [selectedProduct, selectedCapacity, cartItems]);
  const selectedProductAvailableCapacities = useMemo(
    () => (selectedProduct ? getAvailableCapacities(selectedProduct) : []),
    [selectedProduct],
  );
  const selectedProductTags = useMemo(
    () =>
      Array.isArray(selectedProduct?.tags)
        ? selectedProduct.tags.map(tag => String(tag || '').trim().toLowerCase()).filter(Boolean)
        : [],
    [selectedProduct],
  );
  const isSelectedProductBestseller = selectedProductTags.includes('bestseller');
  const isSelectedProductPremium = selectedProductTags.includes('premium');
  const isSelectedCapacityAvailable = useMemo(
    () => selectedProductAvailableCapacities.includes(selectedCapacity),
    [selectedProductAvailableCapacities, selectedCapacity],
  );
  const wishlistProducts = useMemo(
    () => publicProducts.filter(product => wishlistIds.includes(product.id)),
    [publicProducts, wishlistIds],
  );
  const isSelectedProductWishlisted = useMemo(
    () => Boolean(selectedProduct && wishlistIds.includes(selectedProduct.id)),
    [selectedProduct, wishlistIds],
  );
  const activeProfilePanelTitle = useMemo(() => {
    if (activeProfilePanel === 'orders') return 'My Orders';
    if (activeProfilePanel === 'wishlist') return 'Wishlist';
    if (activeProfilePanel === 'payments') return 'Payment Methods';
    if (activeProfilePanel === 'notifications') return 'Notifications';
    if (activeProfilePanel === 'installation') return 'Installation Requests';
    if (activeProfilePanel === 'warranty') return 'Warranty Claims';
    if (activeProfilePanel === 'language') return 'Language';
    return 'Profile';
  }, [activeProfilePanel]);
  const cartSummary = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
    const discount = subtotal >= 20000 ? Math.round(subtotal * 0.1) : 0;
    const delivery = 0;
    const total = Math.max(0, subtotal - discount + delivery);
    return { subtotal, discount, delivery, total };
  }, [cartItems]);
  const landingSearchStickyHeaderIndices = useMemo(() => {
    if (publicView === 'feedback' || publicView === 'categories' || publicView === 'categoryProducts') {
      return [];
    }
    return [toast ? 3 : 2];
  }, [publicView, toast]);
  const filteredSavedLocations = useMemo(
    () => savedLocations.filter(loc => locationMatchesQuery(loc, locationSearch)),
    [savedLocations, locationSearch],
  );
  const filteredLocationSuggestions = useMemo(() => {
    const uniq: DeliveryLocation[] = [];
    const seen = new Set<string>();
    for (const loc of [...recentLocations, ...searchedLocations]) {
      const key = `${loc.id}_${loc.label}_${loc.pincode || ''}`.toLowerCase();
      if (seen.has(key)) continue;
      if (!locationMatchesQuery(loc, locationSearch)) continue;
      seen.add(key);
      uniq.push(loc);
    }
    return uniq;
  }, [recentLocations, searchedLocations, locationSearch]);
  const visibleSuggestedLocations = useMemo(
    () => filteredLocationSuggestions.slice(0, showMoreSuggestedLocations ? 5 : 3),
    [filteredLocationSuggestions, showMoreSuggestedLocations],
  );
  const canShowMoreSuggestedLocations = filteredLocationSuggestions.length > 3;
  const suggestedEmptyMessage = useMemo(() => {
    const q = locationSearch.trim();
    if (/^[0-9]+$/.test(q) && q.length > 0 && q.length < 6) {
      return 'Enter full 6-digit pincode to search.';
    }
    return 'No recent, detected, or matching searched locations found.';
  }, [locationSearch]);

  if (!isAdminUser || isHomeModuleForAdmin) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}> 
        <StatusBar barStyle="light-content" />
        <ScrollView
          key={`public_scroll_${publicView}`}
          ref={publicScrollRef}
          removeClippedSubviews={false}
          keyboardShouldPersistTaps="always"
          stickyHeaderIndices={landingSearchStickyHeaderIndices}
          contentContainerStyle={{
            paddingTop: Math.max(10, insets.top),
            paddingHorizontal: horizontalScreenPadding,
            paddingBottom: bottomContentPadding,
            gap: sectionGap,
          }}
        >
          {toast ? (
            <View
              style={[
                styles.toast,
                { backgroundColor: toast.type === 'success' ? '#4F8A57' : '#B85C5C' },
              ]}
            >
              <Text style={styles.toastText}>{toast.message}</Text>
            </View>
          ) : null}
          <View style={[styles.top, { backgroundColor: theme.panel }]}>
            <View style={styles.brandRow}>
              <View style={styles.brandLogo}>
                <Image source={appBrandLogo} style={styles.brandLogoImage} resizeMode="contain" />
              </View>
            </View>
            <View style={styles.topActions}>
              {isHomeModuleForAdmin ? (
                <Pressable
                  style={styles.headerIconBtn}
                  onPress={() => setModuleId('dashboard')}
                >
                  <Text style={styles.headerIconText}>📊</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={styles.headerIconBtn}
                onPress={() => {
                  setIsProfileModalVisible(true);
                  setActiveProfilePanel(null);
                }}
              >
                <Text style={[styles.headerIconText, styles.headerIconTextAccent]}>👤︎</Text>
              </Pressable>
              <Pressable
                style={styles.headerIconBtn}
                onPress={openNotificationsPanelDirect}
              >
                <Text style={styles.headerIconText}>🔔</Text>
              </Pressable>
              {!token ? (
                <Pressable style={styles.headerLoginBtn} onPress={() => openAuthModal('login')}>
                  <Text style={styles.headerLoginBtnText}>Login</Text>
                </Pressable>
              ) : (
                <Pressable style={[styles.chip, { backgroundColor: '#B85C5C' }]} onPress={logout}>
                  <Text style={[styles.chipText, { color: '#FEE2E2' }]}>Logout</Text>
                </Pressable>
              )}
            </View>
          </View>
          {publicView === 'feedback' ? (
            <PublicFeedbackPage
              theme={theme}
              rating={feedbackRating}
              setRating={setFeedbackRating}
              message={feedbackMessage}
              setMessage={setFeedbackMessage}
              onSubmit={submitFeedback}
              onBack={() => setPublicView('landing')}
              feedbackOrderItems={feedbackOrderItems}
              selectedFeedbackOrderItemId={selectedFeedbackOrderItemId}
              setSelectedFeedbackOrderItemId={setSelectedFeedbackOrderItemId}
              isFeedbackOrderItemsLoading={isFeedbackOrderItemsLoading}
            />
          ) : null}
          {publicView !== 'feedback' && publicView !== 'categories' && publicView !== 'categoryProducts' ? (
            <View style={[styles.locationSearchWrap, { backgroundColor: theme.panel }]}>
              <Pressable style={styles.locationRow} onPress={() => setIsLocationModalVisible(true)}>
                <Text style={styles.locationPin}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.small, { color: theme.subtext }]}>Deliver to</Text>
                  <Text style={[styles.locationText, { color: theme.text }]} numberOfLines={1}>
                    {currentDeliveryLocation.label || currentDeliveryLocation.city}
                  </Text>
                  <Text style={[styles.small, { color: theme.subtext }]} numberOfLines={1}>
                    {[currentDeliveryLocation.area, currentDeliveryLocation.city, currentDeliveryLocation.pincode]
                      .filter(Boolean)
                      .join(' - ') || currentDeliveryLocation.state || currentDeliveryLocation.country || 'India'}
                  </Text>
                </View>
                <Text style={[styles.small, { color: theme.subtext }]}>▼</Text>
              </Pressable>
            </View>
          ) : null}
          {publicView !== 'feedback' && publicView !== 'categories' && publicView !== 'categoryProducts' ? (
            <View style={[styles.stickySearchWrap, { backgroundColor: theme.panel }]}>
              <TextInput
                value={publicSearch}
                onChangeText={setPublicSearch}
                placeholder="Search Inverters, Batteries..."
                placeholderTextColor={theme.subtext}
                style={[styles.searchInput, { color: theme.text, backgroundColor: theme.panelSoft }]}
              />
            </View>
          ) : null}

          {publicView === 'landing' ? (
            <>
              <View style={styles.heroLanding}>
                {heroImageFailed ? (
                  <View style={styles.heroFallbackWrap}>
                    <View style={styles.heroFallbackInverter}>
                      <Text style={styles.heroFallbackText}>INVERTER</Text>
                    </View>
                    <View style={styles.heroFallbackBattery}>
                      <Text style={styles.heroFallbackText}>BATTERY 150AH</Text>
                    </View>
                  </View>
                ) : (
                  <Image
                    source={LANDING_HERO_IMAGE}
                    style={styles.heroBgImage}
                    resizeMode="stretch"
                    onError={() => setHeroImageFailed(true)}
                  />
                )}
                <View style={styles.heroOverlay} />
                <View style={styles.heroContent}>
                  <Text style={styles.heroTopText}>Reliable Power Backup Solutions</Text>
                  <Text style={styles.heroMain}>for Your Home & Office</Text>
                  <Pressable style={styles.shopNowHeroBtn} onPress={() => setPublicView('list')}>
                    <Text style={styles.shopNowHeroText}>Shop Now</Text>
                  </Pressable>
                </View>
              </View>
              <View style={[styles.trustStrip, { backgroundColor: theme.panel }]}>
                <View style={styles.trustItem}>
                  <Text style={styles.trustIcon}>🛠</Text>
                  <Text style={[styles.small, { color: theme.text }]}>Free Installation</Text>
                </View>
                <View style={styles.trustItem}>
                  <Text style={styles.trustIcon}>💳</Text>
                  <Text style={[styles.small, { color: theme.text }]}>Cash on Delivery</Text>
                </View>
                <View style={styles.trustItem}>
                  <Text style={styles.trustIcon}>✅</Text>
                  <Text style={[styles.small, { color: theme.text }]}>2 Years Warranty</Text>
                </View>
              </View>
            </>
          ) : null}

          {publicView !== 'feedback' ? (
            <PublicCatalogSections
              key={`public_sections_${publicView}`}
              theme={theme}
              publicView={publicView}
              setPublicView={setPublicView}
              openViewMoreModal={openViewMoreModal}
              categoryCards={categoryCards}
              landingCategory={landingCategory}
              setLandingCategory={setLandingCategory}
              searchedLandingProducts={searchedLandingProducts}
              cartQtyByProductId={cartQtyByProductId}
              openProductDetail={openProductDetail}
              publicProducts={publicProducts}
              searchedPublicProducts={searchedPublicProducts}
              isPublicLoading={isPublicLoading}
              cartItems={cartItems}
              changeCartQty={changeCartQty}
              removeCartItem={removeCartItem}
              cartSummary={cartSummary}
              continueCheckout={continueCheckout}
              error={error}
            />
          ) : null}
        </ScrollView>
        {publicView !== 'feedback' && publicView !== 'categories' && publicView !== 'categoryProducts' ? (
          <PublicFooter
            theme={theme}
            publicView={publicView}
            setPublicView={setPublicView}
            continueCheckout={continueCheckout}
            cartItemCount={cartItemCount}
            isCheckoutSheetVisible={isCheckoutSheetVisible}
          />
        ) : null}
        <Modal
          visible={isProfileModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={closeProfileModal}
        >
          <SafeAreaView style={[styles.profileSafe, { backgroundColor: profileDarkMode ? '#0B1220' : '#EEF2F3' }]}>
            <View style={[styles.profileHeader, { backgroundColor: profileDarkMode ? '#0F172A' : '#FFFFFF' }]}>
              <Pressable style={styles.profileHeaderIconBtn} onPress={closeProfileModal}>
                <Text style={[styles.profileHeaderIcon, { color: profileDarkMode ? '#E5E7EB' : '#111827' }]}>←</Text>
              </Pressable>
              <Text style={[styles.profileHeaderTitle, { color: profileDarkMode ? '#F8FAFC' : '#111827' }]}>My Profile</Text>
              {token && user ? (
                <Pressable style={styles.profileHeaderIconBtn} onPress={openProfileEditModal}>
                  <Text style={[styles.profileHeaderIcon, { color: profileDarkMode ? '#E5E7EB' : '#111827' }]}>✎</Text>
                </Pressable>
              ) : (
                <View style={styles.profileHeaderIconBtn} />
              )}
            </View>

            <ScrollView removeClippedSubviews contentContainerStyle={styles.profileContent}>
              <View style={[styles.profileUserCard, { backgroundColor: profileDarkMode ? '#111827' : '#FFFFFF' }]}>
                <Image source={{ uri: 'https://i.pravatar.cc/240?img=12' }} style={styles.profileAvatar} resizeMode="cover" />
                {token && user ? (
                  <>
                    <View style={styles.profileUserInfo}>
                      <Text style={[styles.profileUserName, { color: profileDarkMode ? '#F8FAFC' : '#111827' }]}>{profileName}</Text>
                      <Text style={[styles.profileUserMeta, { color: profileDarkMode ? '#CBD5E1' : '#374151' }]}>{profileEmail}</Text>
                      <Text style={[styles.profileUserMeta, { color: profileDarkMode ? '#CBD5E1' : '#374151' }]}>{profilePhone}</Text>
                    </View>
                    <Pressable style={styles.profileLogoutMiniBtn} onPress={logout}>
                      <Text style={styles.profileLogoutMiniText}>Logout</Text>
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.profileUserInfo}>
                    <Text style={[styles.profileUserName, { color: profileDarkMode ? '#F8FAFC' : '#111827' }]}>Guest User</Text>
                    <Text style={[styles.profileUserMeta, { color: profileDarkMode ? '#CBD5E1' : '#374151' }]}>
                      Login to view profile details and manage your account.
                    </Text>
                    <Pressable
                      style={[
                        styles.headerLoginBtn,
                        {
                          alignSelf: 'flex-start',
                          marginTop: 8,
                          borderColor: profileDarkMode ? '#4ADE80' : '#1E7B39',
                          backgroundColor: profileDarkMode ? '#0F172A' : '#FFFFFF',
                        },
                      ]}
                      onPress={() => {
                        closeProfileModal();
                        openAuthModal('login');
                      }}
                    >
                      <Text
                        style={[
                          styles.headerLoginBtnText,
                          {
                            color: profileDarkMode ? '#4ADE80' : '#1E7B39',
                          },
                        ]}
                      >
                        Login to View
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <Text style={[styles.profileSectionTitle, { color: profileDarkMode ? '#E5E7EB' : '#111827' }]}>Account Information</Text>
              <View style={[styles.profileSectionCard, { backgroundColor: profileDarkMode ? '#111827' : '#FFFFFF' }]}>
                <Pressable style={styles.profileMenuRow} onPress={() => openProfilePanel('orders')}>
                  <Text style={styles.profileMenuIcon}>👜</Text>
                  <Text style={[styles.profileMenuLabel, { color: profileDarkMode ? '#F8FAFC' : '#111827' }]}>My Orders</Text>
                  <Text style={[styles.profileMenuArrow, { color: profileDarkMode ? '#94A3B8' : '#6B7280' }]}>›</Text>
                </Pressable>
                <View style={[styles.profileMenuDivider, { backgroundColor: profileDarkMode ? '#1F2937' : '#E5E7EB' }]} />
                <Pressable style={styles.profileMenuRow} onPress={() => openProfilePanel('wishlist')}>
                  <Text style={styles.profileMenuIcon}>💚</Text>
                  <Text style={[styles.profileMenuLabel, { color: profileDarkMode ? '#F8FAFC' : '#111827' }]}>Wishlist</Text>
                  <Text style={[styles.profileMenuArrow, { color: profileDarkMode ? '#94A3B8' : '#6B7280' }]}>›</Text>
                </Pressable>
                <View style={[styles.profileMenuDivider, { backgroundColor: profileDarkMode ? '#1F2937' : '#E5E7EB' }]} />
                <Pressable style={styles.profileMenuRow} onPress={openSavedAddressesFromProfile}>
                  <Text style={styles.profileMenuIcon}>📍</Text>
                  <Text style={[styles.profileMenuLabel, { color: profileDarkMode ? '#F8FAFC' : '#111827' }]}>Saved Addresses</Text>
                  <Text style={[styles.profileMenuArrow, { color: profileDarkMode ? '#94A3B8' : '#6B7280' }]}>›</Text>
                </Pressable>
                <View style={[styles.profileMenuDivider, { backgroundColor: profileDarkMode ? '#1F2937' : '#E5E7EB' }]} />
                <Pressable style={styles.profileMenuRow} onPress={() => openProfilePanel('payments')}>
                  <Text style={styles.profileMenuIcon}>💳</Text>
                  <Text style={[styles.profileMenuLabel, { color: profileDarkMode ? '#F8FAFC' : '#111827' }]}>Payment Methods</Text>
                  <Text style={[styles.profileMenuArrow, { color: profileDarkMode ? '#94A3B8' : '#6B7280' }]}>›</Text>
                </Pressable>
                <View style={[styles.profileMenuDivider, { backgroundColor: profileDarkMode ? '#1F2937' : '#E5E7EB' }]} />
                <Pressable style={styles.profileMenuRow} onPress={() => openProfilePanel('notifications')}>
                  <Text style={styles.profileMenuIcon}>🔔</Text>
                  <Text style={[styles.profileMenuLabel, { color: profileDarkMode ? '#F8FAFC' : '#111827' }]}>Notifications</Text>
                  <Text style={[styles.profileMenuArrow, { color: profileDarkMode ? '#94A3B8' : '#6B7280' }]}>›</Text>
                </Pressable>
              </View>

              <Text style={[styles.profileSectionTitle, { color: profileDarkMode ? '#E5E7EB' : '#111827' }]}>Service & Support</Text>
              <View style={[styles.profileSectionCard, { backgroundColor: profileDarkMode ? '#111827' : '#FFFFFF' }]}>
                <Pressable style={styles.profileMenuRow} onPress={() => openProfilePanel('installation')}>
                  <Text style={styles.profileMenuIcon}>🚀</Text>
                  <Text style={[styles.profileMenuLabel, { color: profileDarkMode ? '#F8FAFC' : '#111827' }]}>Installation Requests</Text>
                  <Text style={[styles.profileMenuArrow, { color: profileDarkMode ? '#94A3B8' : '#6B7280' }]}>›</Text>
                </Pressable>
                <View style={[styles.profileMenuDivider, { backgroundColor: profileDarkMode ? '#1F2937' : '#E5E7EB' }]} />
                <Pressable style={styles.profileMenuRow} onPress={() => openProfilePanel('warranty')}>
                  <Text style={styles.profileMenuIcon}>🛡</Text>
                  <Text style={[styles.profileMenuLabel, { color: profileDarkMode ? '#F8FAFC' : '#111827' }]}>Warranty Claims</Text>
                  <Text style={[styles.profileMenuArrow, { color: profileDarkMode ? '#94A3B8' : '#6B7280' }]}>›</Text>
                </Pressable>
                <View style={[styles.profileMenuDivider, { backgroundColor: profileDarkMode ? '#1F2937' : '#E5E7EB' }]} />
                <Pressable style={styles.profileMenuRow} onPress={openFeedbackPage}>
                  <Text style={styles.profileMenuIcon}>⭐</Text>
                  <Text style={[styles.profileMenuLabel, { color: profileDarkMode ? '#F8FAFC' : '#111827' }]}>Add Feedback</Text>
                  <Text style={[styles.profileMenuArrow, { color: profileDarkMode ? '#94A3B8' : '#6B7280' }]}>›</Text>
                </Pressable>
                <View style={[styles.profileMenuDivider, { backgroundColor: profileDarkMode ? '#1F2937' : '#E5E7EB' }]} />
                <Pressable style={styles.profileMenuRow} onPress={openContactSupport}>
                  <Text style={styles.profileMenuIcon}>🎧</Text>
                  <Text style={[styles.profileMenuLabel, { color: profileDarkMode ? '#F8FAFC' : '#111827' }]}>Contact Support</Text>
                  <Text style={[styles.profileMenuArrow, { color: profileDarkMode ? '#94A3B8' : '#6B7280' }]}>›</Text>
                </Pressable>
              </View>

              <Text style={[styles.profileSectionTitle, { color: profileDarkMode ? '#E5E7EB' : '#111827' }]}>App Settings</Text>
              <View style={[styles.profileSectionCard, { backgroundColor: profileDarkMode ? '#111827' : '#FFFFFF' }]}>
                <View style={styles.profileMenuRow}>
                  <Text style={styles.profileMenuIcon}>🌙</Text>
                  <Text style={[styles.profileMenuLabel, { color: profileDarkMode ? '#F8FAFC' : '#111827' }]}>Dark Mode</Text>
                  <Pressable
                    style={[styles.profileToggleTrack, profileDarkMode && styles.profileToggleTrackActive]}
                    onPress={() => {
                      const nextDarkMode = !profileDarkMode;
                      updateUserPreferences({ darkMode: nextDarkMode });
                      showToast(nextDarkMode ? 'Dark mode enabled' : 'Dark mode disabled');
                    }}
                  >
                    <View style={[styles.profileToggleKnob, profileDarkMode && styles.profileToggleKnobActive]} />
                  </Pressable>
                </View>
                <View style={[styles.profileMenuDivider, { backgroundColor: profileDarkMode ? '#1F2937' : '#E5E7EB' }]} />
                <Pressable style={styles.profileMenuRow} onPress={() => openProfilePanel('language')}>
                  <Text style={styles.profileMenuIcon}>🌐</Text>
                  <Text style={[styles.profileMenuLabel, { color: profileDarkMode ? '#F8FAFC' : '#111827' }]}>Language</Text>
                  <Text style={[styles.profileMenuRightText, { color: profileDarkMode ? '#CBD5E1' : '#374151' }]}>{profileLanguage}</Text>
                  <Text style={[styles.profileMenuArrow, { color: profileDarkMode ? '#94A3B8' : '#6B7280' }]}>›</Text>
                </Pressable>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={activeProfilePanel !== null}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setActiveProfilePanel(null)}
        >
          <SafeAreaView style={styles.profilePanelSafe}>
            <View style={styles.profilePanelHeader}>
              <Pressable style={styles.profileHeaderIconBtn} onPress={() => setActiveProfilePanel(null)}>
                <Text style={styles.profileHeaderIcon}>←</Text>
              </Pressable>
              <Text style={styles.profilePanelTitle}>{activeProfilePanelTitle}</Text>
              <View style={styles.checkoutHeaderSpacer} />
            </View>
            <ScrollView removeClippedSubviews contentContainerStyle={styles.profilePanelContent}>
              {activeProfilePanel === 'orders' ? (
                <View style={styles.profilePanelCard}>
                  {profileOrders.length === 0 ? (
                    <Text style={styles.profilePanelEmpty}>No orders yet.</Text>
                  ) : (
                    profileOrders.map(order => {
                      const orderItemSummary = [order.category, order.model]
                        .map(value => String(value || '').trim())
                        .filter(Boolean)
                        .join(' ');

                      return (
                        <Pressable
                          key={order.id}
                          style={styles.profilePanelRow}
                          onPress={() => {
                            if (!order.productId) {
                              showToast('Product details unavailable for this order', 'error');
                              return;
                            }
                            setActiveProfilePanel(null);
                            closeProfileModal();
                            openProductDetail(order.productId);
                          }}
                        >
                          <Image
                            source={
                              typeof order.thumbnail === 'string' && order.thumbnail.trim().length > 0
                                ? { uri: order.thumbnail }
                                : appBrandLogo
                            }
                            style={styles.profileWishlistImage}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.profilePanelMain}>Placed on {order.createdAt}</Text>
                            <Text style={styles.profilePanelSub} numberOfLines={2}>
                              {orderItemSummary || 'Product details unavailable'}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              ) : null}

              {activeProfilePanel === 'wishlist' ? (
                <View style={styles.profilePanelCard}>
                  {wishlistProducts.length === 0 ? (
                    <Text style={styles.profilePanelEmpty}>No wishlist items yet.</Text>
                  ) : (
                    wishlistProducts.map(product => (
                      <View key={product.id} style={styles.profileWishlistRow}>
                        <Image source={{ uri: product.thumbnail }} style={styles.profileWishlistImage} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.profilePanelMain} numberOfLines={1}>{product.name}</Text>
                          <Text style={styles.profilePanelSub} numberOfLines={1}>{product.model}</Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            setActiveProfilePanel(null);
                            closeProfileModal();
                            openProductDetail(product.id);
                          }}
                        >
                          <Text style={styles.profilePanelLink}>Open</Text>
                        </Pressable>
                        <Pressable onPress={() => toggleWishlist(product.id)}>
                          <Text style={styles.profilePanelLinkDanger}>Remove</Text>
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              ) : null}

              {activeProfilePanel === 'payments' ? (
                <View style={styles.profilePanelCard}>
                  {paymentMethods.map(method => (
                    <View key={method.id} style={styles.profilePanelRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.profilePanelMain}>{method.label}</Text>
                        <Text style={styles.profilePanelSub}>{method.detail}</Text>
                      </View>
                      {method.isDefault ? (
                        <Text style={styles.profilePanelBadge}>Default</Text>
                      ) : (
                        <Pressable onPress={() => setDefaultPaymentMethod(method.id)}>
                          <Text style={styles.profilePanelLink}>Set Default</Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
                  <Pressable style={styles.profilePanelPrimaryBtn} onPress={addPaymentMethod}>
                    <Text style={styles.profilePanelPrimaryText}>Add UPI Method</Text>
                  </Pressable>
                </View>
              ) : null}

              {activeProfilePanel === 'notifications' ? (
                <View style={styles.profilePanelCard}>
                  <View style={styles.profilePanelRow}>
                    <Text style={styles.profilePanelMain}>Order Updates</Text>
                    <Pressable
                      style={[styles.profileToggleTrack, notificationPrefs.orderUpdates && styles.profileToggleTrackActive]}
                      onPress={() => updateNotificationPrefs({ orderUpdates: !notificationPrefs.orderUpdates })}
                    >
                      <View style={[styles.profileToggleKnob, notificationPrefs.orderUpdates && styles.profileToggleKnobActive]} />
                    </Pressable>
                  </View>
                  <View style={styles.profilePanelRow}>
                    <Text style={styles.profilePanelMain}>Promotional Offers</Text>
                    <Pressable
                      style={[styles.profileToggleTrack, notificationPrefs.promotions && styles.profileToggleTrackActive]}
                      onPress={() => updateNotificationPrefs({ promotions: !notificationPrefs.promotions })}
                    >
                      <View style={[styles.profileToggleKnob, notificationPrefs.promotions && styles.profileToggleKnobActive]} />
                    </Pressable>
                  </View>
                  <View style={styles.profilePanelRow}>
                    <Text style={styles.profilePanelMain}>Warranty Alerts</Text>
                    <Pressable
                      style={[styles.profileToggleTrack, notificationPrefs.warrantyAlerts && styles.profileToggleTrackActive]}
                      onPress={() => updateNotificationPrefs({ warrantyAlerts: !notificationPrefs.warrantyAlerts })}
                    >
                      <View style={[styles.profileToggleKnob, notificationPrefs.warrantyAlerts && styles.profileToggleKnobActive]} />
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {activeProfilePanel === 'installation' ? (
                <View style={styles.profilePanelCard}>
                  {installationRequests.length === 0 ? (
                    <Text style={styles.profilePanelEmpty}>No installation requests yet.</Text>
                  ) : (
                    installationRequests.map(req => (
                      <View key={req.id} style={styles.profilePanelRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.profilePanelMain}>{req.id}</Text>
                          <Text style={styles.profilePanelSub}>{req.createdAt} • {req.note}</Text>
                        </View>
                        <Text style={styles.profilePanelStatus}>{req.status}</Text>
                      </View>
                    ))
                  )}
                  <Pressable style={styles.profilePanelPrimaryBtn} onPress={addInstallationRequest}>
                    <Text style={styles.profilePanelPrimaryText}>Create Request</Text>
                  </Pressable>
                </View>
              ) : null}

              {activeProfilePanel === 'warranty' ? (
                <View style={styles.profilePanelCard}>
                  {warrantyClaims.length === 0 ? (
                    <Text style={styles.profilePanelEmpty}>No warranty claims yet.</Text>
                  ) : (
                    warrantyClaims.map(claim => (
                      <View key={claim.id} style={styles.profilePanelRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.profilePanelMain}>{claim.id}</Text>
                          <Text style={styles.profilePanelSub}>{claim.createdAt} • {claim.note}</Text>
                        </View>
                        <Text style={styles.profilePanelStatus}>{claim.status}</Text>
                      </View>
                    ))
                  )}
                  <Pressable style={styles.profilePanelPrimaryBtn} onPress={addWarrantyClaim}>
                    <Text style={styles.profilePanelPrimaryText}>File Claim</Text>
                  </Pressable>
                </View>
              ) : null}

              {activeProfilePanel === 'language' ? (
                <View style={styles.profilePanelCard}>
                  {(['English', 'Hindi'] as const).map(lang => (
                    <Pressable
                      key={lang}
                      style={[styles.profileLanguageRow, profileLanguage === lang && styles.profileLanguageRowActive]}
                      onPress={() => {
                        updateUserPreferences({ language: lang });
                        showToast(`Language set to ${lang}`);
                        setActiveProfilePanel(null);
                      }}
                    >
                      <Text style={[styles.profilePanelMain, profileLanguage === lang && { color: '#166534' }]}>{lang}</Text>
                      {profileLanguage === lang ? <Text style={styles.profilePanelBadge}>Selected</Text> : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={isProfileEditModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setIsProfileEditModalVisible(false)}
        >
          <SafeAreaView style={styles.profileEditBackdrop}>
            <View style={styles.profileEditCard}>
              <Text style={styles.profileEditTitle}>Edit Profile</Text>
              <TextInput
                value={profileDraftName}
                onChangeText={setProfileDraftName}
                placeholder="Full Name"
                placeholderTextColor="#6B7280"
                style={styles.profileEditInput}
              />
              <TextInput
                value={profileDraftEmail}
                onChangeText={setProfileDraftEmail}
                placeholder="Email Address"
                autoCapitalize="none"
                placeholderTextColor="#6B7280"
                style={styles.profileEditInput}
              />
              <TextInput
                value={profileDraftPhone}
                onChangeText={setProfileDraftPhone}
                placeholder="Phone Number"
                keyboardType="phone-pad"
                placeholderTextColor="#6B7280"
                style={styles.profileEditInput}
              />
              <View style={styles.profileEditActions}>
                <Pressable style={styles.profileEditCancelBtn} onPress={() => setIsProfileEditModalVisible(false)}>
                  <Text style={styles.profileEditCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.profileEditSaveBtn} onPress={saveProfileEdits}>
                  <Text style={styles.profileEditSaveText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={isAuthModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={closeAuthModal}
        >
          <SafeAreaView style={[styles.authModalSafe, { backgroundColor: theme.bg }]}>
            <ScrollView removeClippedSubviews contentContainerStyle={styles.authModalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.authModalTop}>
                <Pressable onPress={closeAuthModal} style={styles.authBackBtn}>
                  <Text style={styles.authBackText}>←</Text>
                </Pressable>
              </View>

              <View style={styles.authBrandRow}>
                <View style={styles.authBrandLogo}>
                  <Image source={appBrandLogo} style={styles.authBrandLogoImage} resizeMode="contain" />
                </View>
              </View>

              <Animated.View
                style={[
                  styles.authCard,
                  {
                    backgroundColor: theme.panel,
                    opacity: authFormOpacity,
                    transform: [{ translateX: authFormSlide }],
                  },
                ]}
              >
                <Text style={[styles.authTitle, { color: theme.text }]}>{authMode === 'register' ? 'Create an Account' : 'Welcome Back!'}</Text>
                <Text style={[styles.authSubtitle, { color: theme.subtext }]}>{authMode === 'register' ? 'Register to get started' : 'Login to your account'}</Text>

                {authMode === 'register' ? (
                  <>
                    <View style={styles.authInputWrap}>
                      <Text style={styles.authInputIcon}>👤</Text>
                      <TextInput
                        value={registerName}
                        onChangeText={setRegisterName}
                        placeholder="Full Name"
                        placeholderTextColor="#6B7280"
                        style={styles.authInputField}
                      />
                    </View>
                    <View style={styles.authInputWrap}>
                      <Text style={styles.authInputIcon}>✉</Text>
                      <TextInput
                        value={registerUsername}
                        onChangeText={setRegisterUsername}
                        placeholder="Email Address"
                        placeholderTextColor="#6B7280"
                        style={styles.authInputField}
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={styles.authInputWrap}>
                      <Text style={styles.authInputIcon}>📞</Text>
                      <TextInput
                        value={registerPhone}
                        onChangeText={setRegisterPhone}
                        placeholder="Phone Number"
                        placeholderTextColor="#6B7280"
                        keyboardType="phone-pad"
                        style={styles.authInputField}
                      />
                    </View>
                    <View style={styles.authInputWrap}>
                      <Text style={styles.authInputIcon}>🔒</Text>
                      <TextInput
                        value={registerPassword}
                        onChangeText={setRegisterPassword}
                        secureTextEntry
                        placeholder="Password"
                        placeholderTextColor="#6B7280"
                        style={styles.authInputField}
                      />
                    </View>
                    <Text style={[styles.authHint, { color: theme.subtext }]}>* Minimum 6 characters</Text>
                    <Pressable style={styles.authPrimaryBtn} onPress={register} disabled={isLoading}>
                      <Text style={styles.authPrimaryText}>{isLoading ? 'Registering...' : 'Register'}</Text>
                    </Pressable>
                    <View style={styles.authSwitchRow}>
                      <Text style={[styles.authSwitchText, { color: theme.subtext }]}>
                        Have an account?{' '}
                        <Text
                          style={[styles.authSwitchLink, { color: theme.accent }]}
                          accessibilityRole="button"
                          onPress={() => switchAuthMode('login')}
                        >
                          Login
                        </Text>
                      </Text>
                    </View>
                    <View style={styles.authDividerRow}>
                      <View style={[styles.authDividerLine, { backgroundColor: theme.steel }]} />
                      <Text style={[styles.authDividerText, { color: theme.subtext }]}>or register with</Text>
                      <View style={[styles.authDividerLine, { backgroundColor: theme.steel }]} />
                    </View>
                    <Pressable style={styles.authSocialBtn} onPress={() => handleSocialAuthPress('Google')}>
                      <Text style={styles.authSocialEmoji}>G</Text>
                      <Text style={styles.authSocialText}>Sign up with Google</Text>
                    </Pressable>
                    <Pressable style={styles.authSocialBtnFb} onPress={() => handleSocialAuthPress('Facebook')}>
                      <Text style={styles.authSocialEmojiFb}>f</Text>
                      <Text style={styles.authSocialTextFb}>Sign up with Facebook</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View style={styles.authInputWrap}>
                      <Text style={styles.authInputIcon}>✉</Text>
                      <TextInput
                        value={username}
                        onChangeText={setUsername}
                        placeholder="Email Address"
                        placeholderTextColor="#6B7280"
                        style={styles.authInputField}
                        autoCapitalize="none"
                      />
                    </View>
                    <View style={styles.authInputWrap}>
                      <Text style={styles.authInputIcon}>🔒</Text>
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        placeholder="Password"
                        placeholderTextColor="#6B7280"
                        style={styles.authInputField}
                      />
                    </View>
                    <Text
                      style={[styles.authForgot, { color: theme.accent, alignSelf: 'flex-end' }]}
                      accessibilityRole="button"
                      onPress={() => Alert.alert('Forgot Password', 'Password recovery flow will be added soon.')}
                    >
                      Forgot Password?
                    </Text>
                    <Pressable style={styles.authPrimaryBtn} onPress={login} disabled={isLoading}>
                      <Text style={styles.authPrimaryText}>{isLoading ? 'Signing in...' : 'Login'}</Text>
                    </Pressable>
                    <View style={styles.authSwitchRow}>
                      <Text style={[styles.authSwitchText, { color: theme.subtext }]}>
                        Don’t have an account?{' '}
                        <Text
                          style={[styles.authSwitchLink, { color: theme.accent }]}
                          accessibilityRole="button"
                          onPress={() => switchAuthMode('register')}
                        >
                          Register
                        </Text>
                      </Text>
                    </View>
                    <View style={styles.authDividerRow}>
                      <View style={[styles.authDividerLine, { backgroundColor: theme.steel }]} />
                      <Text style={[styles.authDividerText, { color: theme.subtext }]}>or login with</Text>
                      <View style={[styles.authDividerLine, { backgroundColor: theme.steel }]} />
                    </View>
                    <Pressable style={styles.authSocialBtn} onPress={() => handleSocialAuthPress('Google')}>
                      <Text style={styles.authSocialEmoji}>G</Text>
                      <Text style={styles.authSocialText}>Sign in with Google</Text>
                    </Pressable>
                    <Pressable style={styles.authSocialBtnFb} onPress={() => handleSocialAuthPress('Facebook')}>
                      <Text style={styles.authSocialEmojiFb}>f</Text>
                      <Text style={styles.authSocialTextFb}>Sign in with Facebook</Text>
                    </Pressable>
                  </>
                )}
              </Animated.View>

            </ScrollView>
          </SafeAreaView>
        </Modal>
        <Modal
          visible={isLocationModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setIsLocationModalVisible(false)}
        >
          <SafeAreaView style={[styles.locationModalSafe, { backgroundColor: theme.bg }]}>
            <View style={styles.locationModalHeader}>
              <Pressable onPress={() => setIsLocationModalVisible(false)}>
                <Text style={styles.locationModalBack}>←</Text>
              </Pressable>
              <Text style={styles.locationModalTitle}>Delivery Location</Text>
              <View style={{ width: 20 }} />
            </View>

            <View style={styles.locationModalSearchWrap}>
              <View style={styles.locationSearchInputWrap}>
                <TextInput
                  value={locationSearch}
                  onChangeText={setLocationSearch}
                  placeholder="Search city or pincode"
                  placeholderTextColor={theme.subtext}
                  style={[styles.searchInput, styles.searchInputWithClear, { color: theme.text, backgroundColor: theme.panel }]}
                />
                {locationSearch.trim().length > 0 ? (
                  <Pressable style={styles.searchClearBtn} onPress={() => setLocationSearch('')}>
                    <Text style={styles.searchClearBtnText}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
              {isSearchingLocations ? (
                <View style={styles.locationSearchLoaderRow}>
                  <ActivityIndicator size="small" color="#1E7B39" />
                  <Text style={styles.locationSearchLoaderText}>Fetching locations...</Text>
                </View>
              ) : null}
              <Pressable style={styles.detectBtn} onPress={detectCurrentLocation} disabled={isDetectingLocation}>
                <View style={styles.detectBtnContent}>
                  {isDetectingLocation ? <ActivityIndicator size="small" color="#166534" /> : null}
                  <Text style={styles.detectBtnText}>{isDetectingLocation ? 'Detecting...' : 'Use Current Location'}</Text>
                </View>
              </Pressable>
            </View>

            <ScrollView removeClippedSubviews contentContainerStyle={styles.locationModalContent}>
              <Text style={styles.locationSectionTitle}>Saved Addresses</Text>
              {filteredSavedLocations.length === 0 ? (
                <Text style={[styles.small, { color: theme.subtext }]}>
                  {savedLocations.length === 0 ? 'No saved addresses yet.' : 'No matching saved addresses found.'}
                </Text>
              ) : (
                filteredSavedLocations.map(loc => (
                  <Pressable
                    key={`saved_${loc.id}`}
                    style={[
                      styles.locationRowCard,
                      { backgroundColor: theme.panel, borderColor: theme.steel },
                      draftDeliveryLocation?.id === loc.id && styles.locationRowCardActive,
                    ]}
                    onPress={() => setDraftDeliveryLocation(loc)}
                  >
                    <Text style={[styles.locationRowTitle, { color: theme.text }]}>{loc.label}</Text>
                    <Text style={[styles.locationRowSub, { color: theme.subtext }]}>
                      {[loc.area, loc.city, loc.state, loc.pincode].filter(Boolean).join(' - ')}
                    </Text>
                  </Pressable>
                ))
              )}

              <View style={styles.locationSectionGap} />
              <Text style={styles.locationSectionTitle}>Suggested Locations</Text>
              {visibleSuggestedLocations.map(loc => (
                <Pressable
                  key={`sug_${loc.id}`}
                  style={[
                    styles.locationRowCard,
                    { backgroundColor: theme.panel, borderColor: theme.steel },
                    draftDeliveryLocation?.id === loc.id && styles.locationRowCardActive,
                  ]}
                  onPress={() => setDraftDeliveryLocation(loc)}
                >
                  <Text style={[styles.locationRowTitle, { color: theme.text }]}>{loc.label}</Text>
                  <Text style={[styles.locationRowSub, { color: theme.subtext }]}>
                    {[loc.area, loc.city, loc.state, loc.pincode].filter(Boolean).join(' - ')}
                  </Text>
                </Pressable>
              ))}
              {canShowMoreSuggestedLocations ? (
                <Pressable style={styles.seeMoreBtn} onPress={() => setShowMoreSuggestedLocations(prev => !prev)}>
                  <Text style={styles.seeMoreBtnText}>{showMoreSuggestedLocations ? 'See less' : 'See more'}</Text>
                </Pressable>
              ) : null}
              {filteredLocationSuggestions.length === 0 ? (
                <Text style={[styles.small, { color: theme.subtext }]}>{suggestedEmptyMessage}</Text>
              ) : null}
            </ScrollView>

            <View style={[styles.locationBottomActions, { backgroundColor: theme.bg }]}>
              <Pressable
                style={styles.saveAddrBtn}
                onPress={async () => {
                  try {
                    if (!draftDeliveryLocation) return;
                    await saveLocationToBook(draftDeliveryLocation);
                    showToast('Location saved');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to save location');
                  }
                }}
              >
                <Text style={styles.saveAddrBtnText}>Save Address</Text>
              </Pressable>
              <Pressable
                style={styles.applyLocationBtn}
                onPress={async () => {
                  try {
                    if (!draftDeliveryLocation) return;
                    await selectDeliveryLocation(draftDeliveryLocation, false);
                    setIsLocationModalVisible(false);
                    showToast('Delivery location updated');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to update delivery location');
                  }
                }}
              >
                <Text style={styles.applyLocationBtnText}>Apply</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Modal>
        <Modal
          visible={isDetailModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setIsDetailModalVisible(false)}
        >
          <SafeAreaView style={[styles.detailModalSafe, { backgroundColor: theme.bg }]}>
            <ScrollView removeClippedSubviews contentContainerStyle={styles.detailModalContent}>
              <View style={[styles.detailScreenWrap, { backgroundColor: theme.panelSoft }]}>
                {isPublicDetailLoading ? <ActivityIndicator color={theme.primary} /> : null}
                {selectedProduct ? (
                  <>
                    <View style={styles.detailHero}>
                      <Image
                        source={
                          selectedProduct.images[0] || selectedProduct.images[1]
                            ? { uri: selectedProduct.images[0] || selectedProduct.images[1] }
                            : LANDING_HERO_IMAGE
                        }
                        style={styles.detailHeroImage}
                        resizeMode="cover"
                      />
                      <View style={styles.detailHeroOverlay} />
                      <View style={styles.detailTopActions}>
                        <Pressable style={styles.detailCircleBtn} onPress={() => setIsDetailModalVisible(false)}>
                          <Text style={styles.detailCircleIcon}>←</Text>
                        </Pressable>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Pressable style={styles.detailCircleBtn}>
                            <Text style={styles.detailCircleIcon}>⌕</Text>
                          </Pressable>
                          <Pressable
                            style={styles.detailCircleBtn}
                            onPress={() => {
                              if (!selectedProduct) return;
                              toggleWishlist(selectedProduct.id);
                            }}
                          >
                            <Text style={[styles.detailCircleIcon, isSelectedProductWishlisted && { color: theme.accent }]}>
                              {isSelectedProductWishlisted ? '♥' : '♡'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                      {isSelectedProductBestseller ? (
                        <View style={styles.bestsellerTag}>
                          <Text style={styles.bestsellerTagText}>Bestseller</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={[styles.detailSheet, { backgroundColor: theme.panel }]}>
                      <Text style={[styles.detailTitle, { color: theme.text }]}>{selectedProduct.name}</Text>
                      <View style={styles.ratingRow}>
                        <Text style={styles.ratingStar}>★</Text>
                        <Text style={[styles.ratingText, { color: theme.text }]}>4.9</Text>
                        <Text style={[styles.small, { color: theme.subtext }]}>(1200+ Reviews)</Text>
                        {isSelectedProductPremium ? (
                          <View style={styles.premiumPill}>
                            <Text style={styles.premiumPillText}>Premium</Text>
                          </View>
                        ) : null}
                      </View>

                      {(() => {
                        const detailPrice = getDetailPrice(selectedProduct);
                        return (
                          <View style={styles.priceRow}>
                            <Text style={[styles.detailPrice, { color: theme.text }]}>₹{detailPrice.base.toLocaleString()}</Text>
                            {detailPrice.discountPct > 0 ? (
                              <>
                                <Text style={styles.detailMrp}>₹{detailPrice.mrp.toLocaleString()}</Text>
                                <View style={styles.discountPill}>
                                  <Text style={styles.discountPillText}>{detailPrice.discountPct}% Off</Text>
                                </View>
                              </>
                            ) : null}
                          </View>
                        );
                      })()}

                      <View style={styles.featureRow}>
                        <View style={styles.featureChip}>
                          <Text style={styles.featureIcon}>≈</Text>
                          <Text style={styles.featureText}>Pure Sine Wave</Text>
                        </View>
                        <View style={styles.featureChip}>
                          <Text style={styles.featureIcon}>⌗</Text>
                          <Text style={styles.featureText}>LED Display</Text>
                        </View>
                        <View style={styles.featureChip}>
                          <Text style={styles.featureIcon}>⏱</Text>
                          <Text style={styles.featureText}>24x7 Support</Text>
                        </View>
                      </View>

                      <Text style={[styles.itemText, { color: theme.text }]}>Battery Capacity</Text>
                      <View style={styles.capacityRow}>
                        {getCapacityOptions(selectedProduct).map(cap => {
                          const isAvailable = selectedProductAvailableCapacities.includes(cap);
                          return (
                          <Pressable
                            key={cap}
                            disabled={!isAvailable}
                            style={[
                              styles.capacityBtn,
                              !isAvailable && styles.capacityBtnDisabled,
                              selectedCapacity === cap && isAvailable && styles.capacityBtnActive,
                            ]}
                            onPress={() => {
                              if (!isAvailable) return;
                              setSelectedCapacity(cap);
                            }}
                          >
                            <Text
                              style={[
                                styles.capacityText,
                                !isAvailable && styles.capacityTextDisabled,
                                selectedCapacity === cap && isAvailable && styles.capacityTextActive,
                              ]}
                            >
                              {cap}
                            </Text>
                          </Pressable>
                          );
                        })}
                      </View>
                      {selectedProductAvailableCapacities.length === 0 ? (
                        <Text style={styles.capacityUnavailableText}>
                          No Ah options available for this product right now.
                        </Text>
                      ) : (
                        <Text style={styles.capacityUnavailableText}>
                          Unavailable Ah options are disabled.
                        </Text>
                      )}
                      <Text style={styles.inCartIndicatorText}>
                        {selectedVariantCartQty > 0
                          ? `In Cart: ${selectedVariantCartQty} (${selectedCapacity})`
                          : `Not in cart yet (${selectedCapacity})`}
                      </Text>
                      <Text style={styles.productCartHint}>
                        {selectedProductCartQty > 0
                          ? `Total added for this product: ${selectedProductCartQty}`
                          : 'This product is not in cart yet'}
                      </Text>

                      <View style={styles.detailCtaRow}>
                        <Pressable
                          style={[
                            styles.addCartBtn,
                            selectedVariantCartQty > 0 && isSelectedCapacityAvailable && styles.addCartBtnAdded,
                            !isSelectedCapacityAvailable && styles.ctaBtnDisabled,
                          ]}
                          onPress={handleAddToCartFromDetail}
                          disabled={!isSelectedCapacityAvailable}
                        >
                          <Text style={[styles.addCartText, !isSelectedCapacityAvailable && styles.ctaTextDisabled]}>
                            {selectedVariantCartQty > 0 ? `Add More (${selectedVariantCartQty})` : 'Add to Cart'}
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[styles.buyNowBtn, !isSelectedCapacityAvailable && styles.ctaBtnDisabled]}
                          onPress={handleBuyNowFromDetail}
                          disabled={!isSelectedCapacityAvailable}
                        >
                          <Text style={[styles.buyNowText, !isSelectedCapacityAvailable && styles.ctaTextDisabled]}>Buy Now</Text>
                        </Pressable>
                      </View>
                    </View>
                  </>
                ) : (
                  <Text style={[styles.small, { color: theme.subtext }]}>Select an item from View More.</Text>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={isCheckoutSheetVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={closeCheckoutModal}
        >
          <SafeAreaView style={[styles.checkoutPageSafe, { backgroundColor: theme.bg }]}>
            <View style={[styles.checkoutHeader, { backgroundColor: theme.bg, borderBottomColor: theme.steel }]}>
              <Pressable style={styles.checkoutBackBtn} onPress={closeCheckoutModal}>
                <Text style={[styles.checkoutBackIcon, { color: theme.text }]}>←</Text>
              </Pressable>
              <Text style={[styles.checkoutHeaderTitle, { color: theme.text }]}>Shopping Cart</Text>
              <View style={styles.checkoutHeaderSpacer} />
            </View>
            <ScrollView removeClippedSubviews contentContainerStyle={styles.checkoutPageContent}>
              {isOrderPlaced ? (
                <View style={styles.checkoutPlacedBanner}>
                  <Text style={styles.checkoutPlacedText}>Order placed successfully.</Text>
                </View>
              ) : null}
              {cartItems.length === 0 ? (
                <View style={[styles.checkoutEmptyState, { backgroundColor: theme.panel, borderColor: theme.steel }]}>
                  <Text style={[styles.checkoutEmptyText, { color: theme.subtext }]}>Your cart is empty.</Text>
                  <Pressable style={styles.checkoutContinueBtn} onPress={closeCheckoutModal}>
                    <Text style={[styles.checkoutContinueText, { color: theme.text }]}>Continue Shopping</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={[styles.checkoutListCard, { backgroundColor: theme.panel, borderColor: theme.steel }]}>
                    {cartItems.map((item, idx) => {
                      const secondaryLine = /battery/i.test(item.name) ? item.capacity : item.model || item.capacity;
                      return (
                        <View key={item.id}>
                          <View style={styles.checkoutLineItem}>
                            <Image source={{ uri: item.thumbnail }} style={styles.checkoutLineImage} resizeMode="cover" />
                            <View style={styles.checkoutLineMain}>
                              <Text style={[styles.checkoutLineTitle, { color: theme.text }]} numberOfLines={2}>
                                {item.name}
                              </Text>
                              <Text style={[styles.checkoutLineSubtitle, { color: theme.subtext }]} numberOfLines={1}>
                                {secondaryLine}
                              </Text>
                              <View style={styles.checkoutQtyPill}>
                                <Pressable
                                  style={styles.checkoutQtyStepperBtn}
                                  onPress={() => changeCartQty(item.id, item.qty - 1)}
                                >
                                  <Text style={styles.checkoutQtyStepperText}>-</Text>
                                </Pressable>
                                <Text style={styles.checkoutQtyText}>
                                  {item.qty} Unit{item.qty > 1 ? 's' : ''}
                                </Text>
                                <Pressable
                                  style={styles.checkoutQtyStepperBtn}
                                  onPress={() => changeCartQty(item.id, item.qty + 1)}
                                >
                                  <Text style={styles.checkoutQtyStepperText}>+</Text>
                                </Pressable>
                              </View>
                              <Text style={[styles.checkoutLinePrice, { color: theme.text }]}>₹{(item.unitPrice * item.qty).toLocaleString()}</Text>
                            </View>
                            <View style={styles.checkoutLineRight}>
                              <Pressable onPress={() => removeCartItem(item.id)}>
                                <Text style={[styles.checkoutRemoveLink, { color: theme.subtext }]}>Remove</Text>
                              </Pressable>
                            </View>
                          </View>
                          {idx < cartItems.length - 1 ? <View style={styles.checkoutLineDivider} /> : null}
                        </View>
                      );
                    })}
                  </View>

                  <View style={[styles.checkoutTotalsCard, { backgroundColor: theme.panel, borderColor: theme.steel }]}>
                    <View style={styles.checkoutSummaryRow}>
                      <Text style={[styles.checkoutSummaryLabel, { color: theme.subtext }]}>Subtotal</Text>
                      <Text style={[styles.checkoutSummaryValue, { color: theme.text }]}>₹{cartSummary.subtotal.toLocaleString()}</Text>
                    </View>
                    <View style={styles.checkoutSummaryRow}>
                      <Text style={[styles.checkoutSummaryLabel, { color: theme.subtext }]}>Discount ⓘ</Text>
                      <Text style={[styles.checkoutSummaryValue, styles.checkoutSummaryValueDiscount]}>
                        - ₹{cartSummary.discount.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.checkoutSummaryRow}>
                      <Text style={[styles.checkoutSummaryLabel, { color: theme.subtext }]}>Delivery</Text>
                      <Text style={[styles.checkoutSummaryValue, styles.checkoutSummaryValueDelivery, { color: theme.accent }]}>
                        {cartSummary.delivery === 0 ? 'Free' : `₹${cartSummary.delivery.toLocaleString()}`}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    style={[styles.checkoutPlaceBtn, isCheckoutSubmitting && styles.checkoutMainBtnDisabled]}
                    onPress={token && user ? submitLoggedInCheckout : submitGuestCheckout}
                    disabled={isCheckoutSubmitting}
                  >
                    <Text style={styles.checkoutPlaceBtnText}>
                      {isCheckoutSubmitting ? 'Placing Order...' : 'Place Order'}
                    </Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={isViewMoreModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={closeViewMoreModal}
        >
          <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
            <Animated.View
              style={{
                flex: 1,
                opacity: viewMoreOpacity,
                transform: [{ translateY: viewMoreRise }],
              }}
            >
              <View
                style={[
                  styles.top,
                  {
                    backgroundColor: theme.panel,
                    marginTop: Math.max(10, insets.top),
                    marginHorizontal: horizontalScreenPadding,
                    marginBottom: sectionGap,
                  },
                ]}
              >
                <View style={styles.rowBetween}>
                  <Text style={[styles.title, { color: theme.text }]}>{viewMoreTitle}</Text>
                  <Pressable onPress={closeViewMoreModal} style={{ padding: 4, paddingHorizontal: 8 }}>
                    <Text style={[styles.small, { color: theme.danger, fontSize: 13, fontWeight: '800' }]}>Close</Text>
                  </Pressable>
                </View>
              </View>
              <ScrollView
                removeClippedSubviews
                contentContainerStyle={{ paddingHorizontal: horizontalScreenPadding, paddingBottom: 30, gap: sectionGap }}
              >
                {viewMoreProducts.length === 0 ? (
                  <Text style={[styles.small, { color: theme.subtext }]}>No related products found.</Text>
                ) : (
                  viewMoreProducts.map(product => {
                    const productCartQty = cartQtyByProductId[product.id] || 0;
                    const isFeaturedView = viewMoreContext === 'featured';
                    return (
                      <Pressable
                        key={product.id}
                        onPress={() => {
                          closeViewMoreModal();
                          openProductDetail(product.id);
                        }}
                        style={[styles.productListRow, { backgroundColor: theme.panelSoft }]}
                      >
                        <Image
                          source={{ uri: product.thumbnail }}
                          style={[styles.productListImage, profileDarkMode && styles.productListImageDark]}
                          resizeMode="cover"
                        />
                        <View style={{ flex: 1 }}>
                          {isFeaturedView ? (
                            <>
                              <Text
                                style={[
                                  styles.small,
                                  {
                                    color: theme.subtext,
                                    fontSize: featuredBrandFontSize,
                                    fontWeight: '400',
                                    textAlign: 'left',
                                    alignSelf: 'flex-start',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                Brand: {product.brand || '—'}
                              </Text>
                              <Text
                                style={[
                                  styles.small,
                                  {
                                    color: theme.text,
                                    fontSize: featuredModelFontSize,
                                    fontWeight: '400',
                                    textAlign: 'left',
                                    alignSelf: 'flex-start',
                                  },
                                ]}
                                numberOfLines={1}
                              >
                                {getLandingProductModel(product)}
                              </Text>
                            </>
                          ) : (
                            <>
                              <Text style={[styles.itemText, { color: theme.text }]} numberOfLines={1}>
                                {getLandingProductTitle(product)}
                              </Text>
                              <Text style={[styles.small, { color: theme.subtext }]} numberOfLines={1}>
                                Model: {getLandingProductModel(product)}
                              </Text>
                              <Text style={[styles.small, { color: theme.subtext }]} numberOfLines={1}>
                                Brand: {product.brand || '—'}
                              </Text>
                            </>
                          )}
                          {productCartQty > 0 ? <Text style={styles.productCartHint}>In cart: {productCartQty}</Text> : null}
                        </View>
                        <Text style={[styles.small, { color: theme.primary }]}>Open</Text>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </Animated.View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}> 
      <StatusBar barStyle="light-content" />
      <ScrollView
        removeClippedSubviews
        contentContainerStyle={{
          paddingTop: Math.max(10, insets.top),
          paddingHorizontal: horizontalScreenPadding,
          paddingBottom: 30,
          gap: sectionGap,
        }}
      >
        {toast ? (
          <View
            style={[
              styles.toast,
              { backgroundColor: toast.type === 'success' ? '#4F8A57' : '#B85C5C' },
            ]}
          >
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        ) : null}
        <View style={[styles.top, { backgroundColor: theme.panel }]}> 
          <View>
            <Text style={[styles.brand, { color: theme.text }]}>FuElectric ERP</Text>
            <Text style={[styles.small, { color: theme.subtext }]}>{user?.name || 'Admin'} ({user?.role || 'admin'})</Text>
          </View>
          <View style={styles.topActions}>
            <Pressable style={[styles.chip, { backgroundColor: theme.steel }]} onPress={loadAll}><Text style={[styles.chipText, { color: theme.text }]}>Refresh</Text></Pressable>
            <Pressable style={[styles.chip, { backgroundColor: '#B85C5C' }]} onPress={logout}><Text style={[styles.chipText, { color: '#FEE2E2' }]}>Logout</Text></Pressable>
          </View>
        </View>

        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.navSliderRow}
        >
          {modules.map(m => {
            const active = moduleId === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setModuleId(m.id)}
                style={[styles.chip, styles.navSliderChip, active ? styles.adminNavChipActive : styles.adminNavChipInactive]}
              >
                <Text style={[styles.chipText, active ? styles.adminNavChipTextActive : { color: theme.subtext }]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? <Text style={[styles.small, { color: theme.danger }]}>{error}</Text> : null}
        {isLoading ? <ActivityIndicator color={theme.primary} /> : null}

        <AdminModuleContent
          moduleId={moduleId}
          theme={theme}
          fade={fade}
          rise={rise}
          overview={overview}
          itemName={itemName}
          setItemName={setItemName}
          itemSku={itemSku}
          setItemSku={setItemSku}
          itemBrand={itemBrand}
          setItemBrand={setItemBrand}
          itemCategory={itemCategory}
          setItemCategory={setItemCategory}
          itemCapacityAh={itemCapacityAh}
          setItemCapacityAh={setItemCapacityAh}
          itemQty={itemQty}
          setItemQty={setItemQty}
          itemReorder={itemReorder}
          setItemReorder={setItemReorder}
          itemPurchasePrice={itemPurchasePrice}
          setItemPurchasePrice={setItemPurchasePrice}
          itemSellingPrice={itemSellingPrice}
          setItemSellingPrice={setItemSellingPrice}
          itemTags={itemTags}
          setItemTags={setItemTags}
          itemImages={itemImages}
          itemImageUrls={itemImageUrls}
          pickItemImages={pickItemImages}
          removeItemImage={removeItemImage}
          setItemImageUrlValue={setItemImageUrlValue}
          addItemImageUrlField={addItemImageUrlField}
          removeItemImageUrlField={removeItemImageUrlField}
          createItem={createItem}
          editingItemId={editingItemId}
          isItemEditModalVisible={isItemEditModalVisible}
          openItemEditModal={openItemEditModal}
          closeItemEditModal={closeItemEditModal}
          canEdit={canEdit}
          isSaving={isSaving}
          search={search}
          setSearch={setSearch}
          filteredItems={filteredItems}
          partyName={partyName}
          setPartyName={setPartyName}
          partyCompany={partyCompany}
          setPartyCompany={setPartyCompany}
          partyEmail={partyEmail}
          setPartyEmail={setPartyEmail}
          partyPhone={partyPhone}
          setPartyPhone={setPartyPhone}
          partyGstin={partyGstin}
          setPartyGstin={setPartyGstin}
          createParty={createParty}
          suppliers={suppliers}
          customers={customers}
          canDeleteMaster={canDeleteMaster}
          deleteParty={deleteParty}
          selectedItemId={selectedItemId}
          setSelectedItemId={setSelectedItemId}
          items={items}
          selectedSupplierId={selectedSupplierId}
          setSelectedSupplierId={setSelectedSupplierId}
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
          nameField={nameField}
          setNameField={setNameField}
          qty={qty}
          setQty={setQty}
          price={price}
          setPrice={setPrice}
          dueDate={dueDate}
          setDueDate={setDueDate}
          createDocument={createDocument}
          purchaseOrders={purchaseOrders}
          salesOrders={salesOrders}
          bills={bills}
          invoices={invoices}
          executeAction={executeAction}
          adjustDelta={adjustDelta}
          setAdjustDelta={setAdjustDelta}
          adjustReason={adjustReason}
          setAdjustReason={setAdjustReason}
          postAdjustment={postAdjustment}
          movements={movements}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

export default MainApp;
