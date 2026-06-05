import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  SafeAreaView as SafeAreaOverlay,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  CATEGORIES,
  CULTURE_EVENTS,
  MOCK_NOTIFICATIONS,
  MOCK_USER,
  TRENDING_SEARCHES,
} from './src/data/events';
import { AdBanner } from './src/components/AdBanner';
import { NativeMapView, NativeMarker, NativeMapProvider } from './src/components/NativeMap';
import { AD_BANNER_HEIGHT, isAdMobEnabled } from './src/services/admob';
import {
  AuthSessionState,
  getCurrentAuthSession,
  isSupabaseAuthConfigured,
  onAuthSessionChange,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from './src/services/authClient';
import {
  getKakaoRedirectUri,
  isKakaoAuthConfigured,
  signInWithKakao,
} from './src/services/kakaoAuth';
import {
  filterEvents,
  formatEventDistance,
  getInitialCultureEventsData,
  getEventDistanceKm,
  loadCultureEventsData,
} from './src/services/cultureApi';
import type { CultureEventsDataState } from './src/services/cultureApi';
import {
  deleteViewerSavedEvent,
  loadViewerData,
  saveViewerRecentSearch,
  saveViewerEvent,
  updateViewerPreferences,
  updateViewerProfile,
} from './src/services/userApi';
import type { ViewerData } from './src/services/userApi';
import {
  createReview,
  loadEventReviews,
  loadMyReviews,
  reportReview,
  type ReviewItem,
} from './src/services/reviewApi';
import type {
  Category,
  CultureEvent,
  CultureFilters,
  PriceTier,
  UserCoordinate,
} from './src/types';

type MapRegion = {
  latitude: number;
  latitudeDelta: number;
  longitude: number;
  longitudeDelta: number;
};

type NaverMapInstance = {
  destroy?: () => void;
  setCenter: (center: unknown) => void;
  setZoom: (zoom: number) => void;
};

type NaverMarkerInstance = {
  setMap: (map: unknown | null) => void;
};

type TabKey = 'feed' | 'map' | 'saved' | 'my';
type OverlayKey =
  | 'auth'
  | 'search'
  | 'filter'
  | 'notifications'
  | 'itinerary'
  | 'profile'
  | 'settings'
  | 'guide'
  | 'review';
type AuthMode = 'signIn' | 'signUp';

type ReviewSuccessPayload = {
  eventTitle: string;
  rating: number;
};

const ONBOARDING_KEY = 'zero-won-poomgyeok:onboarded';
const SAVED_KEY = 'zero-won-poomgyeok:saved-events';
const RECENT_SEARCH_KEY = 'zero-won-poomgyeok:recent-searches';
const REVIEWS_KEY = 'zero-won-poomgyeok:user-reviews';
const AVATAR_KEY = 'zero-won-poomgyeok:avatar-uri';
const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ??
  'https://zero-won-poomgyeok.vercel.app/privacy-policy.html';
const SUPPORT_EMAIL = 'privacy@olalab.kr';

function openExternalUrl(url: string, failureTitle = '링크를 열 수 없습니다') {
  Linking.openURL(url).catch(() => {
    Alert.alert(failureTitle, url);
  });
}

const SEOUL_CITY_HALL: UserCoordinate = {
  latitude: 37.5662952,
  longitude: 126.9779451,
};

const DEFAULT_FILTERS: CultureFilters = {
  region: '전체',
  category: '전체',
  price: '전체',
  date: '전체',
  radiusKm: 5,
};

const REGIONS = ['전체', '서울', '경기', '인천', '부산', '대구', '광주', '대전', '기타'];
const PRICES: CultureFilters['price'][] = ['전체', '무료', '1만원 이하', '1-3만원'];
const DATES: CultureFilters['date'][] = ['전체', '오늘', '이번 주', '이번 달'];

const TAB_BAR_BODY_HEIGHT = 64;
const TAB_BAR_TOP_PADDING = 12;
const TAB_BAR_MIN_BOTTOM_PADDING = 26;
const TAB_BAR_SCROLL_GAP = 30;
const DETAIL_BOTTOM_ACTION_HEIGHT = 86;

function useTabBarLayout() {
  const { bottom } = useSafeAreaInsets();
  const tabBarBottomPadding = Math.max(bottom, TAB_BAR_MIN_BOTTOM_PADDING);
  const tabBarHeight = TAB_BAR_BODY_HEIGHT + TAB_BAR_TOP_PADDING + tabBarBottomPadding;
  const adBannerHeight = isAdMobEnabled() ? AD_BANNER_HEIGHT : 0;
  const scrollPaddingBottom = tabBarHeight + adBannerHeight + TAB_BAR_SCROLL_GAP;

  return {
    adBannerHeight,
    tabBarHeight,
    tabBarStyle: {
      minHeight: TAB_BAR_BODY_HEIGHT + TAB_BAR_TOP_PADDING,
      paddingBottom: tabBarBottomPadding,
      paddingTop: TAB_BAR_TOP_PADDING,
    },
    scrollPaddingBottom,
  };
}

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#161A20' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7C828C' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#161A20' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#2E353F' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#232933' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#111419' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8D949E' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0B1017' }],
  },
];

const WEB_MAP_TILE_SIZE = 256;
const WEB_MAP_MIN_ZOOM = 11;
const WEB_MAP_MAX_ZOOM = 15;
const KAKAO_MAP_APP_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_APP_KEY?.trim();
const KAKAO_MAP_SCRIPT_ID = 'zero-won-kakao-map-sdk';
const NAVER_MAP_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID?.trim();
const NAVER_MAP_SCRIPT_ID = 'zero-won-naver-map-sdk';
const NAVER_MAP_CALLBACK = '__zeroWonNaverMapsLoaded';

declare global {
  interface Window {
    __zeroWonKakaoMapPromise?: Promise<void>;
    __zeroWonNaverMapPromise?: Promise<void>;
    __zeroWonNaverMapsLoaded?: () => void;
    kakao?: {
      maps?: {
        LatLng: new (latitude: number, longitude: number) => unknown;
        Map: new (element: HTMLElement, options: Record<string, unknown>) => {
          setCenter: (position: unknown) => void;
          setLevel: (level: number) => void;
        };
        Marker: new (options: Record<string, unknown>) => {
          setMap: (map: unknown | null) => void;
          setZIndex: (zIndex: number) => void;
        };
        event: {
          addListener: (target: unknown, eventName: string, listener: () => void) => unknown;
        };
        load: (callback: () => void) => void;
      };
    };
    naver?: {
      maps?: {
        Event: {
          addListener: (target: unknown, eventName: string, listener: () => void) => unknown;
        };
        LatLng: new (latitude: number, longitude: number) => unknown;
        Map: new (element: HTMLElement, options: Record<string, unknown>) => NaverMapInstance;
        Marker: new (options: Record<string, unknown>) => NaverMarkerInstance;
        Point: new (x: number, y: number) => unknown;
        Size: new (width: number, height: number) => unknown;
      };
    };
  }
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>('feed');
  const [overlay, setOverlay] = useState<OverlayKey | null>(null);
  const [reviewSuccessPayload, setReviewSuccessPayload] = useState<ReviewSuccessPayload | null>(null);
  const [showReviewSuccessModal, setShowReviewSuccessModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CultureEvent | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category>('전체');
  const [filters, setFilters] = useState<CultureFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<CultureFilters>(DEFAULT_FILTERS);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [authSession, setAuthSession] = useState<AuthSessionState>({
    session: null,
    user: null,
  });
  const [authMode, setAuthMode] = useState<AuthMode>('signIn');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [pendingSaveEventId, setPendingSaveEventId] = useState<string | null>(null);
  const [viewerData, setViewerData] = useState<ViewerData | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [preferencesSyncing, setPreferencesSyncing] = useState(false);
  const [cultureEventsData, setCultureEventsData] = useState(
    getInitialCultureEventsData,
  );
  const [cultureEventsLoading, setCultureEventsLoading] = useState(false);
  const [location, setLocation] = useState<UserCoordinate>(SEOUL_CITY_HALL);
  const [locationLabel, setLocationLabel] = useState('서울시청 기준');
  const [locationMessage, setLocationMessage] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedMapEventId, setSelectedMapEventId] = useState(CULTURE_EVENTS[0].id);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [eventPushEnabled, setEventPushEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [myReviews, setMyReviews] = useState<ReviewItem[]>([]);
  const [legacyReviewCount, setLegacyReviewCount] = useState(0);
  const [detailReviews, setDetailReviews] = useState<ReviewItem[]>([]);
  const [detailReviewsLoading, setDetailReviewsLoading] = useState(false);
  const [detailReviewsError, setDetailReviewsError] = useState('');
  const [reviewPinnedEvent, setReviewPinnedEvent] = useState<CultureEvent | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const authConfigured = isSupabaseAuthConfigured();
  const currentUser = authSession.user;
  const isSignedIn = Boolean(currentUser);
  const viewerEmail = currentUser?.email ?? '로그인 사용자';
  const viewerProfile = viewerData?.profile ?? null;

  useEffect(() => {
    let mounted = true;

    async function restore() {
      const [onboarded, saved, recent, reviews, avatar] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_KEY),
        AsyncStorage.getItem(SAVED_KEY),
        AsyncStorage.getItem(RECENT_SEARCH_KEY),
        AsyncStorage.getItem(REVIEWS_KEY),
        AsyncStorage.getItem(AVATAR_KEY),
      ]);

      if (!mounted) {
        return;
      }

      setShowOnboarding(onboarded !== 'true');
      setSavedIds(saved ? JSON.parse(saved) : []);
      setRecentSearches(recent ? JSON.parse(recent) : ['전시', '무료공연', '이번 주말']);
      const parsedReviews = reviews ? JSON.parse(reviews) : [];
      setLegacyReviewCount(Array.isArray(parsedReviews) ? parsedReviews.length : 0);
      setAvatarUri(avatar ?? null);
      setBooting(false);
    }

    restore().catch(() => {
      setShowOnboarding(true);
      setBooting(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    getCurrentAuthSession()
      .then((nextSession) => {
        if (mounted) {
          setAuthSession(nextSession);
        }
      })
      .catch(() => undefined);

    const unsubscribe = onAuthSessionChange((nextSession) => {
      setAuthSession(nextSession);
      setAuthError('');
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSignedIn || !pendingSaveEventId) {
      return;
    }

    const eventId = pendingSaveEventId;

    setPendingSaveEventId(null);
    toggleSaved(eventId);
  }, [isSignedIn, pendingSaveEventId]);

  useEffect(() => {
    let cancelled = false;

    async function loadViewer() {
      if (!isSignedIn) {
        setViewerData(null);
        setViewerError('');
        setViewerLoading(false);
        return;
      }

      setViewerLoading(true);
      setViewerError('');

      try {
        const nextViewerData = await loadViewerData();

        if (!cancelled) {
          setViewerData(nextViewerData);
          setSavedIds(nextViewerData.savedEventIds);
          setPushEnabled(nextViewerData.preferences.pushEnabled);
          setEventPushEnabled(nextViewerData.preferences.eventPushEnabled);
          setMarketingEnabled(nextViewerData.preferences.marketingEnabled);
          setFilters((current) => ({
            ...current,
            radiusKm: nextViewerData.preferences.radiusKm,
            region: nextViewerData.preferences.defaultRegion,
          }));
          if (nextViewerData.recentSearches.length > 0) {
            setRecentSearches(nextViewerData.recentSearches.map((item) => item.query));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setViewerError(
            error instanceof Error
              ? error.message
              : '유저 데이터를 불러오지 못했습니다.',
          );
        }
      } finally {
        if (!cancelled) {
          setViewerLoading(false);
        }
      }
    }

    loadViewer();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, currentUser?.id]);

  useEffect(() => {
    AsyncStorage.setItem(SAVED_KEY, JSON.stringify(savedIds)).catch(
      () => undefined,
    );
  }, [savedIds]);

  useEffect(() => {
    AsyncStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recentSearches)).catch(
      () => undefined,
    );
  }, [recentSearches]);

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setCultureEventsLoading(true);

      const nextData = await loadCultureEventsData();

      if (!cancelled) {
        setCultureEventsData(nextData);
        setCultureEventsLoading(false);
        setSelectedMapEventId(nextData.events[0]?.id ?? CULTURE_EVENTS[0].id);
      }
    }

    loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  const requestLocation = useCallback(async () => {
    setLocationLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLocation(SEOUL_CITY_HALL);
        setLocationLabel('서울시청 기준');
        setLocationMessage('위치 권한이 꺼져 있어 서울시청 기준으로 가까운 콘텐츠를 정렬합니다.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocationLabel('현재 위치 기준');
      setLocationMessage('현재 위치 기준으로 가까운 콘텐츠를 다시 정렬했어요.');
    } catch {
      setLocation(SEOUL_CITY_HALL);
      setLocationLabel('서울시청 기준');
      setLocationMessage('현재 위치를 가져오지 못해 서울시청 기준으로 표시합니다.');
    } finally {
      setLocationLoading(false);
    }
  }, []);

  const activeFilters = useMemo(
    () => ({
      ...filters,
      category: selectedCategory,
    }),
    [filters, selectedCategory],
  );
  const cultureEvents = cultureEventsData.events;

  const feedEvents = useMemo(
    () => filterEvents(cultureEvents, activeFilters),
    [activeFilters, cultureEvents],
  );

  const nearbyEvents = useMemo(
    () =>
      feedEvents
        .map((event) => ({
          ...event,
          distanceKm: getEventDistanceKm(location, event),
        }))
        .filter((event) => (event.distanceKm ?? 0) <= filters.radiusKm || filters.radiusKm >= 30)
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0)),
    [feedEvents, filters.radiusKm, location],
  );

  const visibleSavedIds = isSignedIn ? viewerData?.savedEventIds ?? savedIds : [];
  const reviewCount = isSignedIn ? myReviews.length : legacyReviewCount;

  const reviewEventOptions = useMemo(() => {
    const nearby = nearbyEvents.slice(0, 5).map(({ distanceKm, ...event }) => event);

    if (nearby.length > 0) {
      return nearby;
    }

    return cultureEvents.slice(0, 8);
  }, [cultureEvents, nearbyEvents]);

  const savedEvents = useMemo(
    () => cultureEvents.filter((event) => visibleSavedIds.includes(event.id)),
    [cultureEvents, visibleSavedIds],
  );

  const stats = useMemo(
    () => ({
      free: feedEvents.filter((event) => event.priceTier === 'free').length,
      cheap: feedEvents.filter(
        (event) => event.priceTier === 'free' || event.priceTier === 'cheap',
      ).length,
      weekend: feedEvents.filter((event) => {
        const day = new Date(event.schedule.startDate).getDay();

        return day === 0 || day === 6;
      }).length,
    }),
    [feedEvents],
  );

  const featured = nearbyEvents[0] ?? cultureEvents[0] ?? CULTURE_EVENTS[0];
  const selectedMapEvent =
    nearbyEvents.find((event) => event.id === selectedMapEventId) ??
    nearbyEvents[0] ??
    cultureEvents[0] ??
    CULTURE_EVENTS[0];

  const searchResults = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();

    if (normalized.length < 2) {
      return [];
    }

    return filterEvents(cultureEvents, filters)
      .filter((event) =>
        [
          event.title,
          event.subtitle,
          event.category,
          event.priceLabel,
          event.location.address,
          ...event.hashtags,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalized),
      )
      .map((event) => ({
        ...event,
        distanceKm: getEventDistanceKm(location, event),
      }));
  }, [cultureEvents, filters, location, searchQuery]);

  function completeOnboarding() {
    AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => undefined);
    setShowOnboarding(false);
    requestLocation();
  }

  function advanceOnboarding() {
    if (onboardingStep < 2) {
      setOnboardingStep((step) => step + 1);
      return;
    }

    completeOnboarding();
  }

  function openAuthGate(mode: AuthMode = 'signIn') {
    setAuthMode(mode);
    setAuthError('');
    setOverlay('auth');
  }

  async function toggleSaved(eventId: string) {
    if (!isSignedIn) {
      setPendingSaveEventId(eventId);
      openAuthGate('signIn');
      return;
    }

    const event = cultureEvents.find((item) => item.id === eventId);

    if (!event) {
      Alert.alert('저장 실패', '콘텐츠 정보를 찾을 수 없습니다.');
      return;
    }

    const wasSaved = visibleSavedIds.includes(eventId);
    const previousViewerData = viewerData;
    const previousSavedIds = savedIds;
    const nextSavedIds = wasSaved
      ? visibleSavedIds.filter((id) => id !== eventId)
      : [eventId, ...visibleSavedIds];

    setSavedIds(nextSavedIds);
    setViewerData((current) =>
      current
        ? {
            ...current,
            savedEventIds: nextSavedIds,
            savedEvents: wasSaved
              ? current.savedEvents.filter((savedEvent) => savedEvent.eventId !== eventId)
              : [
                  {
                    id: `optimistic-${eventId}`,
                    eventCategory: event.category,
                    eventEndDate: event.schedule.endDate,
                    eventId: event.id,
                    eventLocation: event.location.address,
                    eventSnapshot: event,
                    eventSource: 'seoul-open-api',
                    eventStartDate: event.schedule.startDate,
                    eventTitle: event.title,
                    savedAt: new Date().toISOString(),
                  },
                  ...current.savedEvents.filter(
                    (savedEvent) => savedEvent.eventId !== eventId,
                  ),
                ],
          }
        : current,
    );

    try {
      if (wasSaved) {
        await deleteViewerSavedEvent(eventId);
      } else {
        await saveViewerEvent(event);
      }
    } catch (error) {
      // 서버 쓰기 자체가 실패한 경우에만 되돌린다.
      setViewerData(previousViewerData);
      setSavedIds(previousSavedIds);
      Alert.alert(
        '저장 실패',
        error instanceof Error
          ? error.message
          : '저장함을 서버에 반영하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
      return;
    }

    // 쓰기는 성공. 최신 목록 재조회는 실패해도 낙관적 상태를 유지한다.
    try {
      const nextViewerData = await loadViewerData();
      setViewerData(nextViewerData);
      setSavedIds(nextViewerData.savedEventIds);
    } catch {
      // 네트워크 일시 오류 등은 무시 (다음 진입 시 동기화됨)
    }
  }

  function openEvent(event: CultureEvent) {
    setSelectedEvent(event);
    setOverlay(null);
  }

  function openTab(tab: TabKey) {
    setActiveTab(tab);
    setOverlay(null);
    setSelectedEvent(null);
  }

  function openReviewForEvent(event: CultureEvent) {
    setReviewPinnedEvent(event);
    setOverlay('review');
  }

  function openFabPress() {
    if (selectedEvent) {
      openReviewForEvent(selectedEvent);
      return;
    }

    if (activeTab === 'map') {
      if (!selectedMapEvent) {
        Alert.alert('후기', '지도에 표시된 장소가 없어요.');
        return;
      }

      openReviewForEvent(selectedMapEvent);
      return;
    }

    setReviewPinnedEvent(null);
    setOverlay('review');
  }

  function closeReview() {
    setReviewPinnedEvent(null);
    setOverlay(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadServerMyReviews() {
      if (!isSignedIn) {
        setMyReviews([]);
        return;
      }

      try {
        const payload = await loadMyReviews();

        if (!cancelled) {
          setMyReviews(payload.reviews);
        }
      } catch {
        if (!cancelled) {
          setMyReviews([]);
        }
      }
    }

    loadServerMyReviews();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, currentUser?.id]);

  const fetchDetailReviews = useCallback(async (eventId: string) => {
    setDetailReviewsLoading(true);
    setDetailReviewsError('');

    try {
      const payload = await loadEventReviews(eventId, 3);
      setDetailReviews(payload.reviews);
    } catch (error) {
      setDetailReviews([]);
      setDetailReviewsError(
        error instanceof Error ? error.message : '후기 목록을 불러오지 못했어요.',
      );
    } finally {
      setDetailReviewsLoading(false);
    }
  }, []);

  useEffect(() => {
    const eventId = selectedEvent?.id;

    if (!eventId) {
      setDetailReviews([]);
      setDetailReviewsError('');
      setDetailReviewsLoading(false);
      return;
    }

    fetchDetailReviews(eventId);
  }, [fetchDetailReviews, selectedEvent?.id]);

  async function submitReview(input: {
    comment: string;
    eventId: string;
    eventTitle: string;
    rating: number;
  }) {
    if (!isSignedIn) {
      openAuthGate('signIn');
      return;
    }

    try {
      const payload = await createReview({
        comment: input.comment,
        eventId: input.eventId,
        eventTitle: input.eventTitle,
        rating: input.rating,
      });
      const savedReview = payload.review;

      setMyReviews((current) => [savedReview, ...current]);

      if (selectedEvent?.id === input.eventId) {
        setDetailReviews((current) => [savedReview, ...current].slice(0, 3));
      }
    } catch (error) {
      throw new Error(getReviewSubmitErrorMessage(error));
    }

    setReviewPinnedEvent(null);
    setOverlay(null);
    setReviewSuccessPayload({
      eventTitle: input.eventTitle,
      rating: input.rating,
    });
    setShowReviewSuccessModal(true);
  }

  async function handleKakaoSignIn() {
    setAuthLoading(true);
    setAuthError('');

    try {
      const data = await signInWithKakao();
      const session = data.session ?? null;

      setAuthSession({
        session,
        user: session?.user ?? data.user ?? null,
      });
      setOverlay(null);
    } catch (error) {
      const message = formatAuthError(error);

      if (!/취소/.test(message)) {
        setAuthError(message);
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleAuthSubmit(email: string, password: string) {
    setAuthLoading(true);
    setAuthError('');

    try {
      const data =
        authMode === 'signIn'
          ? await signInWithEmail(email, password)
          : await signUpWithEmail(email, password);

      const session = data.session ?? null;

      setAuthSession({
        session,
        user: session?.user ?? data.user ?? null,
      });

      if (session) {
        setOverlay(null);
        return;
      }

      Alert.alert(
        '이메일 확인',
        '가입 확인 메일을 보냈어요. 메일 인증 후 로그인해주세요.',
      );
      setAuthMode('signIn');
    } catch (error) {
      setAuthError(formatAuthError(error));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    setAuthLoading(true);
    setAuthError('');

    try {
      await signOut();
      setAuthSession({
        session: null,
        user: null,
      });
      setOverlay(null);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : '로그아웃 중 문제가 발생했습니다.',
      );
    } finally {
      setAuthLoading(false);
    }
  }

  function openFilter() {
    setDraftFilters(filters);
    setOverlay('filter');
  }

  async function submitSearch(nextQuery = searchQuery) {
    const normalized = nextQuery.trim();

    if (normalized.length < 2) {
      return;
    }

    setSearchQuery(normalized);
    setRecentSearches((current) => [
      normalized,
      ...current.filter((item) => item !== normalized),
    ].slice(0, 5));

    if (isSignedIn) {
      try {
        const payload = await saveViewerRecentSearch(normalized);

        setViewerData((current) =>
          current
            ? {
                ...current,
                recentSearches: payload.recentSearches,
              }
            : current,
        );
        setRecentSearches(payload.recentSearches.map((item) => item.query));
      } catch {
        // Search should remain usable even if account sync is temporarily unavailable.
      }
    }
  }

  async function handleProfileSave(input: {
    avatarUri: string | null;
    district: string;
    interests: string[];
    marketingConsent: boolean;
    nickname: string;
  }) {
    if (!isSignedIn) {
      openAuthGate('signIn');
      return;
    }

    setProfileSaving(true);
    setViewerError('');

    try {
      const { avatarUri: nextAvatarUri, ...profileInput } = input;
      const nextViewerData = await updateViewerProfile(profileInput);
      setViewerData(nextViewerData);
      setMarketingEnabled(nextViewerData.profile.marketingConsent);

      setAvatarUri(nextAvatarUri);
      if (nextAvatarUri) {
        await AsyncStorage.setItem(AVATAR_KEY, nextAvatarUri);
      } else {
        await AsyncStorage.removeItem(AVATAR_KEY);
      }

      setOverlay(null);
    } catch (error) {
      setViewerError(
        error instanceof Error
          ? error.message
          : '프로필을 저장하지 못했습니다.',
      );
    } finally {
      setProfileSaving(false);
    }
  }

  async function syncPreferences(input: {
    defaultRegion?: string;
    eventPushEnabled?: boolean;
    marketingEnabled?: boolean;
    pushEnabled?: boolean;
    radiusKm?: number;
  }) {
    if (!isSignedIn) {
      return;
    }

    setPreferencesSyncing(true);

    try {
      const payload = await updateViewerPreferences(input);
      setViewerData((current) =>
        current
          ? {
              ...current,
              preferences: payload.preferences,
            }
          : current,
      );
    } catch (error) {
      Alert.alert(
        '설정 저장 실패',
        error instanceof Error
          ? error.message
          : '설정을 서버에 저장하지 못했습니다.',
      );
    } finally {
      setPreferencesSyncing(false);
    }
  }

  function handlePushEnabledChange(enabled: boolean) {
    setPushEnabled(enabled);
    syncPreferences({ pushEnabled: enabled });
  }

  function handleEventPushEnabledChange(enabled: boolean) {
    setEventPushEnabled(enabled);
    syncPreferences({ eventPushEnabled: enabled });
  }

  function handleMarketingEnabledChange(enabled: boolean) {
    setMarketingEnabled(enabled);
    syncPreferences({ marketingEnabled: enabled });
  }

  function handleDefaultRegionChange(region: string) {
    setFilters((current) => ({
      ...current,
      region,
    }));
    syncPreferences({ defaultRegion: region });
  }

  function handleRadiusChange(radiusKm: number) {
    setFilters((current) => ({
      ...current,
      radiusKm,
    }));
    syncPreferences({ radiusKm });
  }

  async function openUrl(url: string, fallbackMessage: string) {
    try {
      const canOpen = await Linking.canOpenURL(url);

      if (!canOpen) {
        Alert.alert('열 수 없음', fallbackMessage);
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert('열 수 없음', fallbackMessage);
    }
  }

  function openReservation(event: CultureEvent) {
    if (!event.reservationUrl) {
      Alert.alert('예약 안내', '이 콘텐츠는 현장 참여 또는 선착순 입장입니다.');
      return;
    }

    openUrl(event.reservationUrl, '예약 페이지를 열 수 없습니다.');
  }

  function openDirections(event: CultureEvent) {
    const destination = `${event.location.lat},${event.location.lng}`;
    const encodedName = encodeURIComponent(event.title);
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${destination}&q=${encodedName}`
        : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;

    openUrl(url, '지도 앱을 열 수 없습니다.');
  }

  if (booting) {
    return <BootScreen />;
  }

  if (showOnboarding) {
    return (
      <OnboardingScreen
        onNext={advanceOnboarding}
        onSkip={completeOnboarding}
        step={onboardingStep}
      />
    );
  }

  return (
    <SafeAreaOverlay edges={['left', 'right', 'top']} style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.appShell}>
        {selectedEvent ? (
          <DetailScreen
            event={selectedEvent}
            isSaved={visibleSavedIds.includes(selectedEvent.id)}
            onBack={() => setSelectedEvent(null)}
            onDirections={openDirections}
            onReportReview={async (reviewId) => {
              if (!isSignedIn) {
                openAuthGate('signIn');
                return;
              }
              try {
                const payload = await reportReview({
                  reason: '부적절한 후기',
                  reviewId,
                });
                if (payload.hideTriggered) {
                  Alert.alert('신고 접수 완료', '커뮤니티 신고 누적으로 해당 후기가 숨김 처리됐어요.');
                  fetchDetailReviews(selectedEvent.id);
                  return;
                }
                Alert.alert('신고 접수 완료', '검토를 위해 신고를 접수했어요.');
              } catch (error) {
                Alert.alert(
                  '신고 실패',
                  error instanceof Error ? error.message : '신고를 처리하지 못했어요.',
                );
              }
            }}
            onReservation={openReservation}
            onRetryReviews={() => fetchDetailReviews(selectedEvent.id)}
            onToggleSaved={toggleSaved}
            onWriteReview={() => openReviewForEvent(selectedEvent)}
            recentReviews={detailReviews}
            reviewsError={detailReviewsError}
            reviewsLoading={detailReviewsLoading}
          />
        ) : (
          <>
            {activeTab === 'feed' ? (
              <FeedScreen
                cultureEventsLoading={cultureEventsLoading}
                dataSource={cultureEventsData}
                events={nearbyEvents}
                featured={featured}
                filters={filters}
                interests={isSignedIn ? viewerProfile?.interests ?? [] : []}
                locationLabel={locationLabel}
                locationLoading={locationLoading}
                locationMessage={locationMessage}
                onCategoryChange={setSelectedCategory}
                onEventPress={openEvent}
                onFilterPress={openFilter}
                onLocationRefresh={requestLocation}
                onNotificationsPress={() => setOverlay('notifications')}
                onSearchPress={() => setOverlay('search')}
                onToggleSaved={toggleSaved}
                savedIds={visibleSavedIds}
                selectedCategory={selectedCategory}
                stats={stats}
              />
            ) : null}

            {activeTab === 'map' ? (
              <MapScreen
                events={nearbyEvents}
                onCategoryChange={setSelectedCategory}
                onEventPress={openEvent}
                onSearchPress={() => setOverlay('search')}
                onSelectEvent={setSelectedMapEventId}
                onToggleSaved={toggleSaved}
                savedIds={visibleSavedIds}
                selectedCategory={selectedCategory}
                selectedEvent={selectedMapEvent}
              />
            ) : null}

            {activeTab === 'saved' ? (
              <SavedScreen
                events={savedEvents}
                isSignedIn={isSignedIn}
                onAuthPress={() => openAuthGate('signIn')}
                onBrowse={() => openTab('feed')}
                onEventPress={openEvent}
                onToggleSaved={toggleSaved}
              />
            ) : null}

            {activeTab === 'my' ? (
              <MyScreen
                authConfigured={authConfigured}
                avatarUri={avatarUri}
                isSignedIn={isSignedIn}
                onAuthPress={() => openAuthGate('signIn')}
                onGuidePress={() => setOverlay('guide')}
                onItineraryPress={() => setOverlay('itinerary')}
                onNotificationsPress={() => setOverlay('notifications')}
                onProfilePress={() => setOverlay('profile')}
                onSettingsPress={() => setOverlay('settings')}
                profileName={viewerProfile?.nickname ?? null}
                reviewCount={reviewCount}
                savedCount={savedEvents.length}
                userEmail={viewerEmail}
                viewerError={viewerError}
                viewerLoading={viewerLoading}
              />
            ) : null}

            <AdBanner />
            <BottomTabBar activeTab={activeTab} onFabPress={openFabPress} onTabPress={openTab} />
          </>
        )}

        {overlay === 'search' ? (
          <SearchScreen
            onCancel={() => setOverlay(null)}
            onEventPress={openEvent}
            onRecentClear={() => setRecentSearches([])}
            onRecentPick={(query) => {
              setSearchQuery(query);
              submitSearch(query);
            }}
            onSubmit={submitSearch}
            query={searchQuery}
            recentSearches={recentSearches}
            results={searchResults}
            setQuery={setSearchQuery}
          />
        ) : null}

        {overlay === 'auth' ? (
          <AuthScreen
            authConfigured={authConfigured}
            errorMessage={authError}
            loading={authLoading}
            mode={authMode}
            onBack={() => {
              setPendingSaveEventId(null);
              setOverlay(null);
            }}
            kakaoConfigured={isKakaoAuthConfigured()}
            onKakaoPress={handleKakaoSignIn}
            onModeChange={(mode) => {
              setAuthMode(mode);
              setAuthError('');
            }}
            onSubmit={handleAuthSubmit}
          />
        ) : null}

        {overlay === 'filter' ? (
          <FilterScreen
            draft={draftFilters}
            resultCount={filterEvents(cultureEvents, draftFilters).length}
            onApply={() => {
              setFilters(draftFilters);
              setSelectedCategory(draftFilters.category);
              syncPreferences({
                defaultRegion: draftFilters.region,
                radiusKm: draftFilters.radiusKm,
              });
              setOverlay(null);
            }}
            onBack={() => setOverlay(null)}
            onChange={setDraftFilters}
            onReset={() => setDraftFilters(DEFAULT_FILTERS)}
          />
        ) : null}

        {overlay === 'notifications' ? (
          <NotificationsScreen
            notifications={MOCK_NOTIFICATIONS}
            onBack={() => setOverlay(null)}
            onEventPress={(eventId) => {
              const event = cultureEvents.find((item) => item.id === eventId);

              if (event) {
                openEvent(event);
              }
            }}
            onSettingsPress={() => setOverlay('settings')}
          />
        ) : null}

        {overlay === 'itinerary' ? (
          <MyCultureScreen
            onBack={() => setOverlay(null)}
            onBrowse={() => {
              setOverlay(null);
              openTab('feed');
            }}
            onOpenEvent={(eventId) => {
              const event = cultureEvents.find((item) => item.id === eventId);

              if (event) {
                openEvent(event);
              } else {
                setOverlay(null);
              }
            }}
            reviews={myReviews}
          />
        ) : null}

        {overlay === 'settings' ? (
          <SettingsScreen
            authConfigured={authConfigured}
            defaultRegion={filters.region}
            eventPushEnabled={eventPushEnabled}
            isSignedIn={isSignedIn}
            marketingEnabled={marketingEnabled}
            onAuthPress={() => openAuthGate('signIn')}
            onBack={() => setOverlay(null)}
            onDefaultRegionChange={handleDefaultRegionChange}
            onEventPushEnabledChange={handleEventPushEnabledChange}
            onManageInterests={() => setOverlay(isSignedIn ? 'profile' : 'auth')}
            onMarketingEnabledChange={handleMarketingEnabledChange}
            onPushEnabledChange={handlePushEnabledChange}
            onRadiusChange={handleRadiusChange}
            onSignOut={handleSignOut}
            pushEnabled={pushEnabled}
            radiusKm={filters.radiusKm}
            signingOut={authLoading}
            syncing={preferencesSyncing}
            userEmail={viewerEmail}
            userInterests={viewerProfile?.interests ?? MOCK_USER.interests}
          />
        ) : null}

        {overlay === 'profile' ? (
          <ProfileScreen
            defaultAvatarUri={avatarUri}
            defaultDistrict={viewerProfile?.district ?? '서울'}
            defaultInterests={viewerProfile?.interests ?? MOCK_USER.interests}
            defaultMarketingConsent={
              viewerProfile?.marketingConsent ?? marketingEnabled
            }
            defaultNickname={viewerProfile?.nickname ?? viewerEmail.split('@')[0]}
            errorMessage={viewerError}
            loading={profileSaving}
            onBack={() => setOverlay(null)}
            onSubmit={handleProfileSave}
          />
        ) : null}

        {overlay === 'guide' ? (
          <GuideScreen onBack={() => setOverlay(null)} />
        ) : null}

        {overlay === 'review' ? (
          <ReviewWriteScreen
            defaultEventId={selectedMapEventId}
            events={reviewEventOptions}
            onBack={closeReview}
            onSubmit={submitReview}
            pinnedEvent={reviewPinnedEvent}
          />
        ) : null}

        {showReviewSuccessModal && reviewSuccessPayload ? (
          <ReviewSuccessModal
            payload={reviewSuccessPayload}
            onConfirm={() => {
              setShowReviewSuccessModal(false);
              setReviewSuccessPayload(null);
            }}
          />
        ) : null}
      </View>
    </SafeAreaOverlay>
  );
}

function BootScreen() {
  return (
    <SafeAreaView style={styles.bootScreen}>
      <StatusBar style="light" />
      <BrandTitle large />
      <Text style={styles.bootText}>무료 문화생활을 준비하는 중</Text>
      <View style={styles.bootPill}>
        <ActivityIndicator color={colors.accent} size="small" />
        <Text style={styles.bootPillText}>MVP 데이터 로딩</Text>
      </View>
    </SafeAreaView>
  );
}

function OnboardingScreen({
  onNext,
  onSkip,
  step,
}: {
  onNext: () => void;
  onSkip: () => void;
  step: number;
}) {
  const contents = [
    {
      title: '좋은 문화는\n누구에게나\n열려 있어야 하니까',
      body: '무료로 즐길 수 있는 다양한 문화생활을 발견해보세요.',
    },
    {
      title: '내 주변에서,\n지금 바로',
      body: '위치 기준으로 가까운 전시, 공연, 클래스, 문화공간을 정렬해드려요.',
    },
    {
      title: '취향에 맞게\n저장하고\n다시 찾아보기',
      body: '관심 카테고리를 고르고 나만의 문화 리스트를 만들어보세요.',
    },
  ];
  const current = contents[step];
  const insets = useSafeAreaInsets();
  const footerBottomPadding = Math.max(insets.bottom, 16) + 20;

  return (
    <SafeAreaOverlay edges={['left', 'right', 'top']} style={styles.onboarding}>
      <StatusBar style="light" />
      <Pressable accessibilityRole="button" onPress={onSkip} style={styles.skipButton}>
        <Text style={styles.skipText}>건너뛰기</Text>
      </Pressable>
      <View style={styles.onboardingGlowTop} />
      <View style={styles.onboardingGlowBottom} />
      <View style={styles.onboardingContent}>
        <Text style={styles.onboardingTitle}>{current.title}</Text>
        <Text style={styles.onboardingBody}>{current.body}</Text>
        {step === 2 ? (
          <View style={styles.interestGrid}>
            {CATEGORIES.filter((category) => category !== '전체').map((category) => (
              <View key={category} style={styles.interestChip}>
                <Text style={styles.interestText}>{category}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <View style={[styles.onboardingFooter, { paddingBottom: footerBottomPadding }]}>
        <View style={styles.dots}>
          {[0, 1, 2].map((item) => (
            <View
              key={item}
              style={[styles.dot, item === step && styles.dotActive]}
            />
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={onNext} style={styles.nextFab}>
          <Text style={styles.nextFabText}>{step === 2 ? '시작' : '>'}</Text>
        </Pressable>
      </View>
    </SafeAreaOverlay>
  );
}

function FeedScreen({
  cultureEventsLoading,
  dataSource,
  events,
  featured,
  filters,
  interests,
  locationLabel,
  locationLoading,
  locationMessage,
  onCategoryChange,
  onEventPress,
  onFilterPress,
  onLocationRefresh,
  onNotificationsPress,
  onSearchPress,
  onToggleSaved,
  savedIds,
  selectedCategory,
  stats,
}: {
  cultureEventsLoading: boolean;
  dataSource: CultureEventsDataState;
  events: Array<CultureEvent & { distanceKm?: number }>;
  featured: CultureEvent & { distanceKm?: number };
  filters: CultureFilters;
  interests: string[];
  locationLabel: string;
  locationLoading: boolean;
  locationMessage: string;
  onCategoryChange: (category: Category) => void;
  onEventPress: (event: CultureEvent) => void;
  onFilterPress: () => void;
  onLocationRefresh: () => void;
  onNotificationsPress: () => void;
  onSearchPress: () => void;
  onToggleSaved: (eventId: string) => void;
  savedIds: string[];
  selectedCategory: Category;
  stats: { free: number; cheap: number; weekend: number };
}) {
  const { scrollPaddingBottom } = useTabBarLayout();
  const interestEvents = useMemo(
    () =>
      interests.length > 0
        ? events.filter((event) => interests.includes(event.category))
        : [],
    [events, interests],
  );

  return (
    <ScrollView
      contentContainerStyle={[styles.tabContent, { paddingBottom: scrollPaddingBottom }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.feedHeader}>
        <View style={styles.headerTopRow}>
          <BrandTitle />
          <View style={styles.headerActions}>
            <IconButton label="검색" onPress={onSearchPress} icon="search-outline" />
            <IconButton label="알림" onPress={onNotificationsPress} icon="notifications-outline" />
          </View>
        </View>
        <Text style={styles.feedSubtitle}>지금 무료로 즐길 수 있는 문화생활을 추천해요.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onLocationRefresh}
          style={styles.locationPill}
        >
          <View style={styles.locationDot} />
          <Text style={styles.locationText}>{locationLabel}</Text>
          {locationLoading ? <ActivityIndicator color={colors.accent} size="small" /> : null}
        </Pressable>
        {locationMessage ? <Text style={styles.locationMessage}>{locationMessage}</Text> : null}
        <View style={styles.dataSourceRow}>
          <View style={styles.dataSourcePill}>
            {cultureEventsLoading ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              <View style={styles.dataSourceDot} />
            )}
            <Text style={styles.dataSourceText}>
              {dataSource.sourceLabel} · {dataSource.events.length}개
            </Text>
          </View>
          {dataSource.updatedAt ? (
            <Text style={styles.dataSourceTime}>
              {new Date(dataSource.updatedAt).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
              })} 갱신
            </Text>
          ) : null}
        </View>
        {dataSource.warning ? (
          <Text style={styles.dataSourceWarning}>{dataSource.warning}</Text>
        ) : null}
      </View>

      <CategoryRow
        selected={selectedCategory}
        onSelect={onCategoryChange}
      />

      {selectedCategory === '전체' && interestEvents.length > 0 ? (
        <>
          <SectionHeader title="내 관심 카테고리 추천" />
          <View style={styles.nearbyGrid}>
            {interestEvents.slice(0, 6).map((event) => (
              <NearbyCard
                event={event}
                isSaved={savedIds.includes(event.id)}
                key={`interest-${event.id}`}
                onPress={() => onEventPress(event)}
                onToggleSaved={onToggleSaved}
              />
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader
        actionLabel="필터"
        onAction={onFilterPress}
        title="오늘의 추천"
      />
      <FeaturedCard
        event={featured}
        isSaved={savedIds.includes(featured.id)}
        onPress={() => onEventPress(featured)}
        onToggleSaved={onToggleSaved}
      />

      <View style={styles.statsRow}>
        <StatCard
          description="지금 예약 가능"
          highlight
          label="오늘 무료"
          value={stats.free}
        />
        <StatCard description="가성비 추천" label="만원 이하" value={stats.cheap} />
        <StatCard description="이번 주말" label="주말 추천" value={stats.weekend} />
      </View>

      <SectionHeader
        actionLabel={`반경 ${filters.radiusKm}km`}
        onAction={onFilterPress}
        title="가까운 무료 공간"
      />
      {events.length > 0 ? (
        <View style={styles.nearbyGrid}>
          {events.slice(0, 9).map((event) => (
            <NearbyCard
              event={event}
              isSaved={savedIds.includes(event.id)}
              key={event.id}
              onPress={() => onEventPress(event)}
              onToggleSaved={onToggleSaved}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          ctaLabel="필터 초기화"
          description="조건을 조금 넓히면 더 많은 무료 문화생활을 찾을 수 있어요."
          onCta={onFilterPress}
          title="조건에 맞는 콘텐츠가 없어요"
        />
      )}
    </ScrollView>
  );
}

function DetailScreen({
  event,
  isSaved,
  onBack,
  onDirections,
  onReportReview,
  onReservation,
  onRetryReviews,
  onToggleSaved,
  onWriteReview,
  recentReviews,
  reviewsError,
  reviewsLoading,
}: {
  event: CultureEvent & { distanceKm?: number };
  isSaved: boolean;
  onBack: () => void;
  onDirections: (event: CultureEvent) => void;
  onReportReview: (reviewId: string) => void;
  onReservation: (event: CultureEvent) => void;
  onRetryReviews: () => void;
  onToggleSaved: (eventId: string) => void;
  onWriteReview: () => void;
  recentReviews: ReviewItem[];
  reviewsError: string;
  reviewsLoading: boolean;
}) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <View style={styles.detailShell}>
      <ScrollView
        contentContainerStyle={[
          styles.detailContent,
          { paddingBottom: DETAIL_BOTTOM_ACTION_HEIGHT + bottomInset + 16 },
        ]}
      >
        <View style={styles.heroImageWrap}>
          <Image source={{ uri: event.images[0] }} style={styles.heroImage} />
          <View style={styles.detailTopBar}>
            <IconButton dark label="뒤로" onPress={onBack} icon="chevron-back" />
            <View style={styles.detailTopActions}>
              <IconButton
                dark
                label="공유"
                onPress={() => Alert.alert('공유', '공유 기능은 MVP 후속 범위입니다.')}
                icon="share-social-outline"
              />
              <IconButton
                dark
                label={isSaved ? '저장 해제' : '저장'}
                onPress={() => onToggleSaved(event.id)}
                icon={isSaved ? 'bookmark' : 'bookmark-outline'}
              />
            </View>
          </View>
        </View>

        <View style={styles.detailBody}>
          <FreeBadge label={event.priceLabel} />
          <Text style={styles.detailTitle}>{event.title}</Text>
          <Text style={styles.detailSubtitle}>
            {event.subtitle} · {formatEventDistance(event.distanceKm)}
          </Text>
          <Text style={styles.ratingText}>
            ★ {event.rating.toFixed(1)} ({event.favoriteCount}) · 리뷰 {event.reviewCount.toLocaleString()}
          </Text>

          <View style={styles.infoGrid}>
            <InfoCell label="입장료" value={event.priceLabel} />
            <InfoCell
              label="예약"
              value={event.reservationRequired ? '예약 필요' : '현장 참여'}
            />
            <InfoCell label="운영" value={event.schedule.operatingHours} />
          </View>

          <Text style={styles.detailDescription}>{event.description}</Text>
          <View style={styles.detailReviewSection}>
            <View style={styles.detailReviewTitleRow}>
              <Text style={styles.detailReviewTitle}>최근 후기</Text>
              <Pressable
                accessibilityRole="button"
                onPress={onWriteReview}
                style={styles.outlineSmallButton}
              >
                <Text style={styles.outlineSmallButtonText}>후기 남기기</Text>
              </Pressable>
            </View>
            {reviewsLoading ? (
              <View style={styles.detailReviewLoadingRow}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={styles.detailReviewMetaText}>후기를 불러오는 중이에요.</Text>
              </View>
            ) : null}
            {!reviewsLoading && reviewsError ? (
              <View style={styles.detailReviewMessageCard}>
                <Text style={styles.detailReviewMetaText}>{reviewsError}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onRetryReviews}
                  style={styles.outlineSmallButton}
                >
                  <Text style={styles.outlineSmallButtonText}>다시 시도</Text>
                </Pressable>
              </View>
            ) : null}
            {!reviewsLoading && !reviewsError && recentReviews.length === 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={onWriteReview}
                style={styles.detailReviewMessageCard}
              >
                <Text style={styles.detailReviewMetaText}>
                  아직 등록된 후기가 없어요. 탭해서 첫 후기를 남겨보세요.
                </Text>
              </Pressable>
            ) : null}
            {!reviewsLoading && !reviewsError && recentReviews.length > 0
              ? recentReviews.slice(0, 3).map((review) => (
                  <View key={review.id} style={styles.detailReviewItem}>
                    <View style={styles.detailReviewHeader}>
                      <Text style={styles.detailReviewAuthor}>
                        사용자 후기
                      </Text>
                      <View style={styles.detailReviewActions}>
                        <Text style={styles.detailReviewRating}>★ {review.rating.toFixed(1)}</Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => onReportReview(review.id)}
                          style={styles.outlineTinyButton}
                        >
                          <Text style={styles.outlineTinyButtonText}>신고</Text>
                        </Pressable>
                      </View>
                    </View>
                    {review.comment ? (
                      <Text style={styles.detailReviewComment}>{review.comment}</Text>
                    ) : (
                      <Text style={styles.detailReviewMetaText}>
                        코멘트 없이 별점만 등록된 후기예요.
                      </Text>
                    )}
                  </View>
                ))
              : null}
          </View>
          <View style={styles.hashRow}>
            {event.hashtags.map((tag) => (
              <Text key={tag} style={styles.hashTag}>#{tag}</Text>
            ))}
          </View>

          <View style={styles.mapPreview}>
            <Text style={styles.mapAddress}>{event.location.address}</Text>
            <View style={styles.mapPreviewCanvas}>
              <DetailMapPreview event={event} />
            </View>
            <View style={styles.mapPreviewFooter}>
              <Text style={styles.mapDistance}>
                {formatEventDistance(event.distanceKm)} · 도보 이동 추천
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => onDirections(event)}
                style={styles.outlineSmallButton}
              >
                <Text style={styles.outlineSmallButtonText}>길찾기</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomActions, { paddingBottom: 16 + bottomInset }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onToggleSaved(event.id)}
          style={styles.saveAction}
        >
          <Text style={styles.saveActionText}>{isSaved ? '저장됨' : '저장하기'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onReservation(event)}
          style={styles.reserveAction}
        >
          <Text style={styles.reserveActionText}>예약하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DetailMapPreview({ event }: { event: CultureEvent & { distanceKm?: number } }) {
  const [mapSize, setMapSize] = useState({ height: 0, width: 0 });
  const mapRegion = createEventMapRegion([event], event, {
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  });
  const useNativeMap = shouldUseNativeMap() && hasValidEventCoordinate(event);
  const mapCanvasSize = getMapCanvasSize(mapSize);
  const MapViewComponent = NativeMapView;
  const MarkerComponent = NativeMarker;

  const handleLayout = useCallback((layoutEvent: LayoutChangeEvent) => {
    const { height, width } = layoutEvent.nativeEvent.layout;

    setMapSize((current) => {
      if (current.height === height && current.width === width) {
        return current;
      }

      return { height, width };
    });
  }, []);

  if (!hasValidEventCoordinate(event)) {
    return (
      <View style={styles.mapPreviewFallback}>
        <View style={styles.mapPreviewPin}>
          <Text style={styles.mapPreviewPinText}>0</Text>
        </View>
      </View>
    );
  }

  return (
    <View onLayout={handleLayout} style={styles.mapPreviewSurface}>
      {useNativeMap && MapViewComponent && MarkerComponent ? (
        <MapViewComponent
          customMapStyle={DARK_MAP_STYLE}
          initialRegion={mapRegion}
          mapType="standard"
          provider={NativeMapProvider}
          pitchEnabled={false}
          rotateEnabled={false}
          scrollEnabled={false}
          showsCompass={false}
          showsMyLocationButton={false}
          style={styles.nativeMap}
          toolbarEnabled={false}
          userInterfaceStyle="dark"
          zoomEnabled={false}
        >
          <MarkerComponent
            coordinate={{
              latitude: event.location.lat,
              longitude: event.location.lng,
            }}
            tracksViewChanges={false}
          >
            <View style={[styles.detailMapMarker, { borderColor: getCategoryColor(event.category) }]}>
              <Image source={{ uri: event.thumbnail }} style={styles.detailMapMarkerImage} />
            </View>
          </MarkerComponent>
        </MapViewComponent>
      ) : Platform.OS === 'web' ? (
        <WebMapSurface
          compact
          events={[event]}
          mapRegion={mapRegion}
          onSelectEvent={() => undefined}
          selectedEvent={event}
          size={mapCanvasSize}
        />
      ) : (
        <WebTileMap
          compact
          events={[event]}
          mapRegion={mapRegion}
          onSelectEvent={() => undefined}
          selectedEvent={event}
          size={mapCanvasSize}
        />
      )}
    </View>
  );
}

function MapScreen({
  events,
  onCategoryChange,
  onEventPress,
  onSearchPress,
  onSelectEvent,
  onToggleSaved,
  savedIds,
  selectedCategory,
  selectedEvent,
}: {
  events: Array<CultureEvent & { distanceKm?: number }>;
  onCategoryChange: (category: Category) => void;
  onEventPress: (event: CultureEvent) => void;
  onSearchPress: () => void;
  onSelectEvent: (eventId: string) => void;
  onToggleSaved: (eventId: string) => void;
  savedIds: string[];
  selectedCategory: Category;
  selectedEvent: CultureEvent & { distanceKm?: number };
}) {
  const mapEvents = events.filter(hasValidEventCoordinate).slice(0, 40);
  const useNativeMap = shouldUseNativeMap() && mapEvents.length > 0;
  const mapRegion = createEventMapRegion(mapEvents, selectedEvent);
  const MapViewComponent = NativeMapView;
  const MarkerComponent = NativeMarker;
  const [webMapSize, setWebMapSize] = useState({ height: 0, width: 0 });
  const mapCanvasSize = getMapCanvasSize(webMapSize);
  const { tabBarHeight, adBannerHeight } = useTabBarLayout();

  const handleMapLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;

    setWebMapSize((current) => {
      if (current.height === height && current.width === width) {
        return current;
      }

      return { height, width };
    });
  }, []);

  return (
    <View style={styles.mapScreen}>
      <View onLayout={handleMapLayout} style={styles.mapCanvas}>
        {useNativeMap && MapViewComponent && MarkerComponent ? (
          <MapViewComponent
            customMapStyle={DARK_MAP_STYLE}
            initialRegion={mapRegion}
            mapType="standard"
            provider={NativeMapProvider}
            showsCompass={false}
            showsMyLocationButton={false}
            showsUserLocation
            style={styles.nativeMap}
            toolbarEnabled={false}
            userInterfaceStyle="dark"
          >
            {mapEvents.map((event) => (
              <MarkerComponent
                coordinate={{
                  latitude: event.location.lat,
                  longitude: event.location.lng,
                }}
                key={event.id}
                onPress={() => onSelectEvent(event.id)}
                tracksViewChanges={false}
              >
                <View
                  style={[
                    styles.mapMarker,
                    { borderColor: getCategoryColor(event.category) },
                    selectedEvent.id === event.id && styles.mapMarkerActive,
                  ]}
                >
                  <Image source={{ uri: event.thumbnail }} style={styles.mapMarkerImage} />
                </View>
              </MarkerComponent>
            ))}
          </MapViewComponent>
        ) : Platform.OS === 'web' && mapEvents.length > 0 ? (
          <WebMapSurface
            events={mapEvents}
            mapRegion={mapRegion}
            onSelectEvent={onSelectEvent}
            selectedEvent={selectedEvent}
            size={mapCanvasSize}
          />
        ) : mapEvents.length > 0 ? (
          <View style={styles.mapTileSurface}>
            <WebTileMap
              events={mapEvents}
              mapRegion={mapRegion}
              onSelectEvent={onSelectEvent}
              selectedEvent={selectedEvent}
              size={mapCanvasSize}
            />
          </View>
        ) : (
          <>
            <View style={styles.mapGridLineOne} />
            <View style={styles.mapGridLineTwo} />
            {events.slice(0, 8).map((event, index) => (
              <Pressable
                accessibilityRole="button"
                key={event.id}
                onPress={() => onSelectEvent(event.id)}
                style={[
                  styles.mapPin,
                  {
                    left: `${12 + ((index * 19) % 70)}%`,
                    top: `${22 + ((index * 13) % 52)}%`,
                    borderColor: getCategoryColor(event.category),
                  },
                  selectedEvent.id === event.id && styles.mapPinActive,
                ]}
              >
                <Image source={{ uri: event.thumbnail }} style={styles.mapPinImage} />
              </Pressable>
            ))}
          </>
        )}
      </View>

      <View style={styles.mapOverlayTop}>
        <Pressable accessibilityRole="button" onPress={onSearchPress} style={styles.mapSearchBar}>
          <Text style={styles.mapSearchPlaceholder}>지역, 장소, 키워드 검색</Text>
        </Pressable>
        <View style={styles.mapCategorySpacer}>
          <CategoryRow compact selected={selectedCategory} onSelect={onCategoryChange} />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => onEventPress(selectedEvent)}
        style={[styles.mapBottomCard, { bottom: tabBarHeight + adBannerHeight + 20 }]}
      >
        <Image source={{ uri: selectedEvent.thumbnail }} style={styles.mapBottomImage} />
        <View style={styles.mapBottomInfo}>
          <Text numberOfLines={1} style={styles.mapBottomTitle}>{selectedEvent.title}</Text>
          <Text style={styles.mapBottomMeta}>
            {formatEventDistance(selectedEvent.distanceKm)} · {selectedEvent.schedule.operatingHours}
          </Text>
          <Text style={styles.mapBottomCategory}>{selectedEvent.category}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => onToggleSaved(selectedEvent.id)}
          style={styles.smallSaveButton}
        >
          <Text style={styles.smallSaveText}>
            {savedIds.includes(selectedEvent.id) ? '★' : '☆'}
          </Text>
        </Pressable>
      </Pressable>
    </View>
  );
}

function WebMapSurface({
  compact = false,
  events,
  mapRegion,
  onSelectEvent,
  selectedEvent,
  size,
}: {
  compact?: boolean;
  events: Array<CultureEvent & { distanceKm?: number }>;
  mapRegion: MapRegion;
  onSelectEvent: (eventId: string) => void;
  selectedEvent: CultureEvent;
  size: { height: number; width: number };
}) {
  if (KAKAO_MAP_APP_KEY) {
    return (
      <KakaoWebMap
        compact={compact}
        events={events}
        mapRegion={mapRegion}
        onSelectEvent={onSelectEvent}
        selectedEvent={selectedEvent}
      />
    );
  }

  if (NAVER_MAP_CLIENT_ID) {
    return (
      <NaverWebMap
        compact={compact}
        events={events}
        mapRegion={mapRegion}
        onSelectEvent={onSelectEvent}
        selectedEvent={selectedEvent}
      />
    );
  }

  return (
    <WebTileMap
      compact={compact}
      events={events}
      mapRegion={mapRegion}
      onSelectEvent={onSelectEvent}
      selectedEvent={selectedEvent}
      size={size}
    />
  );
}

function KakaoWebMap({
  compact = false,
  events,
  mapRegion,
  onSelectEvent,
  selectedEvent,
}: {
  compact?: boolean;
  events: Array<CultureEvent & { distanceKm?: number }>;
  mapRegion: MapRegion;
  onSelectEvent: (eventId: string) => void;
  selectedEvent: CultureEvent;
}) {
  const containerRef = useRef<View | null>(null);
  const mapRef = useRef<{
    setCenter: (position: unknown) => void;
    setLevel: (level: number) => void;
  } | null>(null);
  const markersRef = useRef<Array<{ setMap: (map: unknown | null) => void; setZIndex: (z: number) => void }>>(
    [],
  );
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !KAKAO_MAP_APP_KEY) {
      return undefined;
    }

    let mounted = true;

    loadKakaoMaps(KAKAO_MAP_APP_KEY)
      .then(() => {
        if (mounted) {
          setReady(true);
          setFailed(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setFailed(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || failed || mapRef.current || Platform.OS !== 'web') {
      return undefined;
    }

    const kakaoMaps = window.kakao?.maps;
    const element = containerRef.current as unknown as HTMLElement | null;

    if (!kakaoMaps || !element) {
      return undefined;
    }

    mapRef.current = new kakaoMaps.Map(element, {
      center: new kakaoMaps.LatLng(mapRegion.latitude, mapRegion.longitude),
      draggable: !compact,
      level: getKakaoMapLevel(mapRegion.longitudeDelta),
      zoomable: !compact,
    });

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      mapRef.current = null;
    };
  }, [compact, failed, mapRegion.latitude, mapRegion.longitude, mapRegion.longitudeDelta, ready]);

  useEffect(() => {
    const kakaoMaps = window.kakao?.maps;
    const map = mapRef.current;

    if (!kakaoMaps || !map) {
      return;
    }

    map.setCenter(new kakaoMaps.LatLng(mapRegion.latitude, mapRegion.longitude));
    map.setLevel(getKakaoMapLevel(mapRegion.longitudeDelta));
  }, [mapRegion.latitude, mapRegion.longitude, mapRegion.longitudeDelta]);

  useEffect(() => {
    const kakaoMaps = window.kakao?.maps;
    const map = mapRef.current;

    if (!kakaoMaps || !map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = events.map((event) => {
      const marker = new kakaoMaps.Marker({
        map,
        position: new kakaoMaps.LatLng(event.location.lat, event.location.lng),
      });

      marker.setZIndex(selectedEvent.id === event.id ? 20 : 10);
      kakaoMaps.event.addListener(marker, 'click', () => onSelectEvent(event.id));

      return marker;
    });
  }, [events, onSelectEvent, selectedEvent.id]);

  if (failed) {
    return (
      <WebTileMap
        compact={compact}
        events={events}
        mapRegion={mapRegion}
        onSelectEvent={onSelectEvent}
        selectedEvent={selectedEvent}
        size={{ height: 320, width: 320 }}
      />
    );
  }

  return <View ref={containerRef} style={styles.naverMapSurface} />;
}

function NaverWebMap({
  compact = false,
  events,
  mapRegion,
  onSelectEvent,
  selectedEvent,
}: {
  compact?: boolean;
  events: Array<CultureEvent & { distanceKm?: number }>;
  mapRegion: MapRegion;
  onSelectEvent: (eventId: string) => void;
  selectedEvent: CultureEvent;
}) {
  const containerRef = useRef<View | null>(null);
  const mapRef = useRef<NaverMapInstance | null>(null);
  const markersRef = useRef<NaverMarkerInstance[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || !NAVER_MAP_CLIENT_ID) {
      return undefined;
    }

    let mounted = true;

    loadNaverMaps(NAVER_MAP_CLIENT_ID)
      .then(() => {
        if (mounted) {
          setReady(true);
          setFailed(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setFailed(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || failed || mapRef.current || Platform.OS !== 'web') {
      return undefined;
    }

    const naverMaps = window.naver?.maps;
    const element = containerRef.current as unknown as HTMLElement | null;

    if (!naverMaps || !element) {
      return undefined;
    }

    mapRef.current = new naverMaps.Map(element, {
      center: new naverMaps.LatLng(mapRegion.latitude, mapRegion.longitude),
      draggable: !compact,
      keyboardShortcuts: !compact,
      logoControl: true,
      mapDataControl: true,
      mapTypeControl: false,
      pinchZoom: !compact,
      scaleControl: !compact,
      scrollWheel: !compact,
      zoom: getNaverMapZoom(mapRegion.longitudeDelta),
      zoomControl: !compact,
    });

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };
  }, [compact, failed, mapRegion.latitude, mapRegion.longitude, mapRegion.longitudeDelta, ready]);

  useEffect(() => {
    const naverMaps = window.naver?.maps;
    const map = mapRef.current;

    if (!naverMaps || !map) {
      return;
    }

    map.setCenter(new naverMaps.LatLng(mapRegion.latitude, mapRegion.longitude));
    map.setZoom(getNaverMapZoom(mapRegion.longitudeDelta));
  }, [mapRegion.latitude, mapRegion.longitude, mapRegion.longitudeDelta]);

  useEffect(() => {
    const naverMaps = window.naver?.maps;
    const map = mapRef.current;

    if (!naverMaps || !map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = events.map((event) => {
      const size = compact ? 44 : 54;
      const imageSize = compact ? 38 : 48;
      const borderWidth = selectedEvent.id === event.id ? 3 : 2;
      const marker = new naverMaps.Marker({
        icon: {
          anchor: new naverMaps.Point(size / 2, size / 2),
          content: createNaverMarkerHtml({
            borderColor: getCategoryColor(event.category),
            borderWidth,
            imageSize,
            size,
            thumbnail: event.thumbnail,
          }),
          size: new naverMaps.Size(size, size),
        },
        map,
        position: new naverMaps.LatLng(event.location.lat, event.location.lng),
        zIndex: selectedEvent.id === event.id ? 20 : 10,
      });

      naverMaps.Event.addListener(marker, 'click', () => onSelectEvent(event.id));

      return marker;
    });
  }, [compact, events, onSelectEvent, selectedEvent.id]);

  if (failed) {
    return (
      <WebTileMap
        compact={compact}
        events={events}
        mapRegion={mapRegion}
        onSelectEvent={onSelectEvent}
        selectedEvent={selectedEvent}
        size={{ height: 320, width: 320 }}
      />
    );
  }

  return <View ref={containerRef} style={styles.naverMapSurface} />;
}

function loadNaverMaps(clientId: string): Promise<void> {
  if (Platform.OS !== 'web') {
    return Promise.reject(new Error('Naver Maps JavaScript SDK is web-only.'));
  }

  if (window.naver?.maps) {
    return Promise.resolve();
  }

  if (window.__zeroWonNaverMapPromise) {
    return window.__zeroWonNaverMapPromise;
  }

  window.__zeroWonNaverMapPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(NAVER_MAP_SCRIPT_ID);

    window.__zeroWonNaverMapsLoaded = () => {
      if (window.naver?.maps) {
        resolve();
        return;
      }

      reject(new Error('Naver Maps SDK loaded without map namespace.'));
    };

    if (existingScript) {
      return;
    }

    const script = document.createElement('script');

    script.async = true;
    script.defer = true;
    script.id = NAVER_MAP_SCRIPT_ID;
    script.onerror = () => reject(new Error('Failed to load Naver Maps SDK.'));
    script.src =
      `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}` +
      `&callback=${NAVER_MAP_CALLBACK}`;

    document.head.appendChild(script);
  });

  return window.__zeroWonNaverMapPromise;
}

function loadKakaoMaps(appKey: string): Promise<void> {
  if (Platform.OS !== 'web') {
    return Promise.reject(new Error('Kakao Maps JavaScript SDK is web-only.'));
  }

  if (window.kakao?.maps) {
    return Promise.resolve();
  }

  if (window.__zeroWonKakaoMapPromise) {
    return window.__zeroWonKakaoMapPromise;
  }

  window.__zeroWonKakaoMapPromise = new Promise((resolve, reject) => {
    const completeLoad = () => {
      if (!window.kakao?.maps?.load) {
        reject(new Error('Kakao Maps SDK loaded without map namespace.'));
        return;
      }

      window.kakao.maps.load(() => resolve());
    };

    const existingScript = document.getElementById(KAKAO_MAP_SCRIPT_ID);

    if (existingScript) {
      completeLoad();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.id = KAKAO_MAP_SCRIPT_ID;
    script.onerror = () => reject(new Error('Failed to load Kakao Maps SDK.'));
    script.onload = () => completeLoad();
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    document.head.appendChild(script);
  });

  return window.__zeroWonKakaoMapPromise;
}

function createNaverMarkerHtml({
  borderColor,
  borderWidth,
  imageSize,
  size,
  thumbnail,
}: {
  borderColor: string;
  borderWidth: number;
  imageSize: number;
  size: number;
  thumbnail: string;
}): string {
  const imageOffset = Math.max(0, (size - imageSize) / 2 - borderWidth);

  return `
    <div style="
      width:${size}px;
      height:${size}px;
      border:${borderWidth}px solid ${escapeHtml(borderColor)};
      border-radius:999px;
      background:#0F1115;
      overflow:hidden;
      box-sizing:border-box;
      box-shadow:0 4px 14px rgba(0,0,0,.32);
    ">
      <img
        alt=""
        src="${escapeHtml(thumbnail)}"
        style="
          display:block;
          width:${imageSize}px;
          height:${imageSize}px;
          margin:${imageOffset}px;
          border-radius:999px;
          object-fit:cover;
        "
      />
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function getNaverMapZoom(longitudeDelta: number): number {
  if (longitudeDelta <= 0.014) {
    return 16;
  }

  if (longitudeDelta <= 0.035) {
    return 14;
  }

  if (longitudeDelta <= 0.08) {
    return 12;
  }

  return 10;
}

function getKakaoMapLevel(longitudeDelta: number): number {
  if (longitudeDelta <= 0.014) {
    return 2;
  }

  if (longitudeDelta <= 0.035) {
    return 4;
  }

  if (longitudeDelta <= 0.08) {
    return 6;
  }

  return 8;
}

function WebTileMap({
  compact = false,
  events,
  mapRegion,
  onSelectEvent,
  selectedEvent,
  size,
}: {
  compact?: boolean;
  events: Array<CultureEvent & { distanceKm?: number }>;
  mapRegion: MapRegion;
  onSelectEvent: (eventId: string) => void;
  selectedEvent: CultureEvent;
  size: { height: number; width: number };
}) {
  const zoom = getWebMapZoom(mapRegion.longitudeDelta);
  const centerPoint = projectCoordinate(mapRegion.latitude, mapRegion.longitude, zoom);
  const left = centerPoint.x - size.width / 2;
  const top = centerPoint.y - size.height / 2;
  const tiles = createWebMapTiles(left, top, size, zoom);

  return (
    <View style={[styles.webTileMap, compact && styles.webTileMapCompact]}>
      {tiles.map((tile) => (
        <Image
          key={`${tile.zoom}-${tile.x}-${tile.y}`}
          source={{ uri: getWebTileUrl(tile.zoom, tile.x, tile.y) }}
          style={[
            styles.webMapTile,
            {
              height: WEB_MAP_TILE_SIZE,
              left: tile.left,
              top: tile.top,
              width: WEB_MAP_TILE_SIZE,
            },
          ]}
        />
      ))}

      <View pointerEvents="none" style={styles.webMapShade} />

      {events.map((event) => {
        const point = projectCoordinate(event.location.lat, event.location.lng, zoom);
        const markerOffset = compact ? 22 : 27;

        return (
          <Pressable
            accessibilityRole="button"
            key={event.id}
            onPress={() => onSelectEvent(event.id)}
            style={[
              compact ? styles.webMapMarkerCompact : styles.webMapMarker,
              {
                borderColor: getCategoryColor(event.category),
                left: point.x - left - markerOffset,
                top: point.y - top - markerOffset,
              },
              selectedEvent.id === event.id &&
                (compact ? styles.webMapMarkerCompactActive : styles.webMapMarkerActive),
            ]}
          >
            <Image
              source={{ uri: event.thumbnail }}
              style={compact ? styles.webMapMarkerImageCompact : styles.webMapMarkerImage}
            />
          </Pressable>
        );
      })}

      <Text style={compact ? styles.webMapAttributionCompact : styles.webMapAttribution}>
        © OpenStreetMap © CARTO
      </Text>
    </View>
  );
}

function formatAuthError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : '인증 처리 중 문제가 발생했습니다.';

  if (/network request failed/i.test(message)) {
    return '인증 서버에 연결하지 못했어요. Supabase 프로젝트 URL·키가 맞는지 확인하고, 에뮬레이터 인터넷 연결 후 Expo를 다시 시작해 주세요.';
  }

  if (/취소/.test(message)) {
    return message;
  }

  if (/카카오 로그인 세션/.test(message)) {
    return message;
  }

  if (/invalid login credentials/i.test(message)) {
    return '이메일 또는 비밀번호가 맞지 않아요.';
  }

  if (/user already registered/i.test(message)) {
    return '이미 가입된 이메일이에요. 로그인해 주세요.';
  }

  if (/password should be at least/i.test(message)) {
    return '비밀번호는 6자 이상이어야 해요.';
  }

  if (/email address.*invalid/i.test(message)) {
    return '이메일 형식을 확인해 주세요.';
  }

  return message;
}

function getReviewSubmitErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : '후기 등록 중 문제가 발생했습니다.';
  const errorCode = typeof error === 'object' && error && 'code' in error ? error.code : '';
  const normalizedCode = typeof errorCode === 'string' ? errorCode : '';

  if (normalizedCode === 'UNAUTHORIZED' || /로그인이 필요/.test(message)) {
    return '로그인 후 후기를 남길 수 있어요.';
  }

  if (normalizedCode === 'REVIEW_DUPLICATED') {
    return '이미 이 행사에 후기를 남겼어요.';
  }

  if (normalizedCode === 'INVALID_REVIEW_PAYLOAD') {
    return '별점은 1~5점, 후기는 500자 이하로 입력해 주세요.';
  }

  if (normalizedCode === 'REVIEW_RATE_LIMITED') {
    return '요청이 너무 빨라요. 잠시 후 다시 시도해 주세요.';
  }

  if (/network request failed/i.test(message)) {
    return '서버에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.';
  }

  if (/EXPO_PUBLIC_APP_URL/.test(message)) {
    return '앱 서버 주소가 설정되지 않았어요. 최신 버전으로 업데이트해 주세요.';
  }

  return message;
}

function hasValidEventCoordinate(event: CultureEvent): boolean {
  return Number.isFinite(event.location.lat) && Number.isFinite(event.location.lng);
}

function shouldUseNativeMap(): boolean {
  if (!NativeMapView || !NativeMarker) {
    return false;
  }

  if (Platform.OS === 'ios') {
    return true;
  }

  if (Platform.OS === 'android') {
    return Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim());
  }

  return false;
}

function getMapCanvasSize(measured: { height: number; width: number }): {
  height: number;
  width: number;
} {
  if (measured.width > 0 && measured.height > 0) {
    return measured;
  }

  const { height, width } = Dimensions.get('window');
  return { width, height: Math.max(Math.round(height * 0.72), 480) };
}

function createEventMapRegion(
  events: Array<CultureEvent & { distanceKm?: number }>,
  selectedEvent: CultureEvent,
  fallbackDelta = {
    latitudeDelta: 0.08,
    longitudeDelta: 0.06,
  },
): MapRegion {
  const validEvents = events.filter(hasValidEventCoordinate);
  const selectedCoordinate = hasValidEventCoordinate(selectedEvent)
    ? selectedEvent.location
    : validEvents[0]?.location;

  if (validEvents.length === 0 || !selectedCoordinate) {
    return {
      latitude: SEOUL_CITY_HALL.latitude,
      longitude: SEOUL_CITY_HALL.longitude,
      latitudeDelta: fallbackDelta.latitudeDelta,
      longitudeDelta: fallbackDelta.longitudeDelta,
    };
  }

  const latitudes = validEvents.map((event) => event.location.lat);
  const longitudes = validEvents.map((event) => event.location.lng);
  const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
  const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);

  return {
    latitude: selectedCoordinate.lat,
    longitude: selectedCoordinate.lng,
    latitudeDelta: Math.max(fallbackDelta.latitudeDelta, latitudeSpan * 1.6),
    longitudeDelta: Math.max(fallbackDelta.longitudeDelta, longitudeSpan * 1.6),
  };
}

function projectCoordinate(latitude: number, longitude: number, zoom: number) {
  const sinLatitude = Math.sin((latitude * Math.PI) / 180);
  const scale = WEB_MAP_TILE_SIZE * 2 ** zoom;

  return {
    x: ((longitude + 180) / 360) * scale,
    y:
      (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) *
      scale,
  };
}

function createWebMapTiles(
  left: number,
  top: number,
  size: { height: number; width: number },
  zoom: number,
) {
  if (size.height <= 0 || size.width <= 0) {
    return [];
  }

  const maxTile = 2 ** zoom;
  const startX = Math.floor(left / WEB_MAP_TILE_SIZE);
  const endX = Math.floor((left + size.width) / WEB_MAP_TILE_SIZE);
  const startY = Math.floor(top / WEB_MAP_TILE_SIZE);
  const endY = Math.floor((top + size.height) / WEB_MAP_TILE_SIZE);
  const tiles: Array<{ left: number; top: number; x: number; y: number; zoom: number }> = [];

  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      if (y < 0 || y >= maxTile) {
        continue;
      }

      tiles.push({
        left: x * WEB_MAP_TILE_SIZE - left,
        top: y * WEB_MAP_TILE_SIZE - top,
        x: ((x % maxTile) + maxTile) % maxTile,
        y,
        zoom,
      });
    }
  }

  return tiles;
}

function getWebMapZoom(longitudeDelta: number): number {
  const zoom = Math.round(Math.log2(360 / Math.max(longitudeDelta, 0.03)));

  return Math.min(WEB_MAP_MAX_ZOOM, Math.max(WEB_MAP_MIN_ZOOM, zoom));
}

function getWebTileUrl(zoom: number, x: number, y: number): string {
  return `https://a.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${y}.png`;
}

function SearchScreen({
  onCancel,
  onEventPress,
  onRecentClear,
  onRecentPick,
  onSubmit,
  query,
  recentSearches,
  results,
  setQuery,
}: {
  onCancel: () => void;
  onEventPress: (event: CultureEvent) => void;
  onRecentClear: () => void;
  onRecentPick: (query: string) => void;
  onSubmit: () => void;
  query: string;
  recentSearches: string[];
  results: Array<CultureEvent & { distanceKm?: number }>;
  setQuery: (query: string) => void;
}) {
  const hasQuery = query.trim().length >= 2;

  return (
    <View style={styles.overlay}>
      <OverlaySafeArea>
        <View style={styles.searchTop}>
          <TextInput
            autoFocus
            onChangeText={setQuery}
            onSubmitEditing={() => onSubmit()}
            placeholder="장소·전시·공연 검색"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>취소</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.overlayContent}>
          {!hasQuery ? (
            <>
              <SectionHeader actionLabel="지우기" onAction={onRecentClear} title="최근 검색" />
              <View style={styles.wrapRow}>
                {recentSearches.map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    key={item}
                    onPress={() => onRecentPick(item)}
                    style={styles.recentChip}
                  >
                    <Text style={styles.recentChipText}>{item}</Text>
                  </Pressable>
                ))}
              </View>

              <SectionHeader title="추천 검색어" />
              <View style={styles.trendingList}>
                {TRENDING_SEARCHES.map((item, index) => (
                  <Pressable
                    accessibilityRole="button"
                    key={item}
                    onPress={() => onRecentPick(item)}
                    style={styles.trendingRow}
                  >
                    <Text style={styles.trendingRank}>{index + 1}</Text>
                    <Text style={styles.trendingText}>{item}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              {results.length > 0 ? (
                <>
                  <SectionHeader title="검색 결과" />
                  <View style={styles.resultList}>
                    {results.map((event) => (
                      <ListEventCard
                        event={event}
                        key={event.id}
                        onPress={() => onEventPress(event)}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <EmptyState
                  description="다른 키워드나 더 넓은 필터로 다시 검색해보세요."
                  title="검색 결과가 없어요"
                />
              )}
            </>
          )}
        </ScrollView>
      </OverlaySafeArea>
    </View>
  );
}

function FilterScreen({
  draft,
  onApply,
  onBack,
  onChange,
  onReset,
  resultCount,
}: {
  draft: CultureFilters;
  onApply: () => void;
  onBack: () => void;
  onChange: (filters: CultureFilters) => void;
  onReset: () => void;
  resultCount: number;
}) {
  return (
    <View style={styles.overlay}>
      <OverlaySafeArea>
        <TopBar onBack={onBack} rightLabel="초기화" onRight={onReset} title="필터" />
        <ScrollView contentContainerStyle={styles.filterContent}>
          <FilterSection title={`지역 · 반경 ${draft.radiusKm}km`}>
            <View style={styles.radiusRow}>
              {[1, 5, 10, 20, 30].map((radius) => (
                <SelectableChip
                  key={radius}
                  label={`${radius}km`}
                  selected={draft.radiusKm === radius}
                  onPress={() => onChange({ ...draft, radiusKm: radius })}
                />
              ))}
            </View>
            <ChipGrid
              items={REGIONS}
              selected={draft.region}
              onSelect={(region) => onChange({ ...draft, region })}
            />
          </FilterSection>

          <FilterSection title="카테고리">
            <ChipGrid
              items={CATEGORIES}
              selected={draft.category}
              onSelect={(category) => onChange({ ...draft, category })}
            />
          </FilterSection>

          <FilterSection title="가격">
            <ChipGrid
              items={PRICES}
              selected={draft.price}
              onSelect={(price) => onChange({ ...draft, price })}
            />
          </FilterSection>

          <FilterSection title="날짜">
            <ChipGrid
              items={DATES}
              selected={draft.date}
              onSelect={(date) => onChange({ ...draft, date })}
            />
          </FilterSection>
        </ScrollView>
        <View style={styles.filterBottom}>
          <Pressable accessibilityRole="button" onPress={onApply} style={styles.applyButton}>
            <Text style={styles.applyButtonText}>결과 {resultCount}개 보기</Text>
          </Pressable>
        </View>
      </OverlaySafeArea>
    </View>
  );
}

function AuthScreen({
  authConfigured,
  errorMessage,
  kakaoConfigured,
  loading,
  mode,
  onBack,
  onKakaoPress,
  onModeChange,
  onSubmit,
}: {
  authConfigured: boolean;
  errorMessage: string;
  kakaoConfigured: boolean;
  loading: boolean;
  mode: AuthMode;
  onBack: () => void;
  onKakaoPress: () => void;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const isSignIn = mode === 'signIn';
  const canSubmit = email.trim().includes('@') && password.length >= 6 && !loading;
  const canUseKakao = authConfigured && kakaoConfigured;
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.overlay}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        style={styles.overlayKeyboard}
      >
        <OverlaySafeArea>
          <TopBar onBack={onBack} showClose title="시작하기" />
          <ScrollView
            contentContainerStyle={[
              styles.authContent,
              { paddingBottom: Math.max(insets.bottom, 16) + 32 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
          <View style={styles.authCard}>
            <BrandTitle />
            <Text style={styles.authTitle}>3초 만에 시작하기</Text>
            <Text style={styles.authDescription}>
              카카오로 로그인하면 저장함·일정·관심 설정을 이 기기와 계정에 연결할 수 있어요.
            </Text>

            {!authConfigured ? (
              <View style={styles.authNotice}>
                <Text style={styles.authNoticeTitle}>Auth 환경변수 필요</Text>
                <Text style={styles.authNoticeText}>
                  `.env.local`에 Supabase URL·키를 넣고, Supabase 대시보드에서 Kakao
                  provider를 켜 주세요.
                </Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!canUseKakao || loading}
              onPress={onKakaoPress}
              style={[styles.kakaoButton, (!canUseKakao || loading) && styles.disabledButton]}
            >
              {loading ? (
                <ActivityIndicator color="#191600" size="small" />
              ) : (
                <Text style={styles.kakaoButtonText}>카카오로 시작하기</Text>
              )}
            </Pressable>

            {errorMessage ? <Text style={styles.authError}>{errorMessage}</Text> : null}

            {__DEV__ && canUseKakao ? (
              <Text selectable style={styles.authRedirectHint}>
                Supabase Redirect URLs에 추가: {getKakaoRedirectUri()}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => setShowEmailLogin((current) => !current)}
              style={styles.authSwitchButton}
            >
              <Text style={styles.authSwitchText}>
                {showEmailLogin ? '카카오 로그인으로 돌아가기' : '이메일로 로그인 (선택)'}
              </Text>
            </Pressable>

            {showEmailLogin ? (
              <>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="이메일"
                  placeholderTextColor={colors.textMuted}
                  style={styles.authInput}
                  value={email}
                />
                <TextInput
                  autoCapitalize="none"
                  onChangeText={setPassword}
                  placeholder="비밀번호 6자 이상"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  style={styles.authInput}
                  value={password}
                />

                <Pressable
                  accessibilityRole="button"
                  disabled={!canSubmit || !authConfigured}
                  onPress={() => onSubmit(email.trim(), password)}
                  style={[
                    styles.authPrimaryButton,
                    (!canSubmit || !authConfigured) && styles.disabledButton,
                  ]}
                >
                  <Text style={styles.authPrimaryButtonText}>
                    {isSignIn ? '이메일로 로그인' : '이메일로 회원가입'}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => onModeChange(isSignIn ? 'signUp' : 'signIn')}
                  style={styles.authSwitchButton}
                >
                  <Text style={styles.authSwitchText}>
                    {isSignIn ? '처음이라면 이메일 회원가입' : '이미 계정이 있다면 이메일 로그인'}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </View>
          </ScrollView>
        </OverlaySafeArea>
      </KeyboardAvoidingView>
    </View>
  );
}

function ProfileScreen({
  defaultAvatarUri,
  defaultDistrict,
  defaultInterests,
  defaultMarketingConsent,
  defaultNickname,
  errorMessage,
  loading,
  onBack,
  onSubmit,
}: {
  defaultAvatarUri: string | null;
  defaultDistrict: string;
  defaultInterests: string[];
  defaultMarketingConsent: boolean;
  defaultNickname: string;
  errorMessage: string;
  loading: boolean;
  onBack: () => void;
  onSubmit: (input: {
    avatarUri: string | null;
    district: string;
    interests: string[];
    marketingConsent: boolean;
    nickname: string;
  }) => void;
}) {
  const { bottom } = useSafeAreaInsets();
  const [nickname, setNickname] = useState(defaultNickname);
  const [district, setDistrict] = useState(defaultDistrict);
  const [interests, setInterests] = useState<string[]>(defaultInterests);
  const [marketingConsent, setMarketingConsent] = useState(defaultMarketingConsent);
  const [avatarUri, setAvatarUri] = useState<string | null>(defaultAvatarUri);
  const interestOptions = CATEGORIES.filter((category) => category !== '전체');
  const canSubmit = nickname.trim().length >= 2 && !loading;

  function toggleInterest(category: string) {
    setInterests((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [category, ...current],
    );
  }

  async function pickAvatar() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('사진 권한 필요', '프로필 사진을 바꾸려면 설정에서 사진 접근을 허용해 주세요.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        mediaTypes: ['images'],
        quality: 0.6,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('사진 불러오기 실패', '이미지를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  return (
    <View style={styles.overlay}>
      <OverlaySafeArea>
        <TopBar onBack={onBack} title="프로필 편집" />
        <ScrollView contentContainerStyle={[styles.filterContent, { paddingBottom: 120 }]}>
          <View style={styles.profilePhotoSection}>
            <Pressable
              accessibilityLabel="프로필 사진 변경"
              accessibilityRole="button"
              onPress={pickAvatar}
              style={styles.profilePhotoAvatar}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.profilePhotoImage} />
              ) : (
                <Ionicons color={colors.textSecondary} name="person" size={36} />
              )}
              <View style={styles.profilePhotoBadge}>
                <Ionicons color={colors.onAccent} name="camera" size={14} />
              </View>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={pickAvatar}>
              <Text style={styles.profilePhotoAction}>사진 변경</Text>
            </Pressable>
            {avatarUri ? (
              <Pressable accessibilityRole="button" onPress={() => setAvatarUri(null)}>
                <Text style={styles.profilePhotoRemove}>사진 삭제</Text>
              </Pressable>
            ) : null}
          </View>

          <FilterSection title="기본 정보">
            <TextInput
              onChangeText={setNickname}
              placeholder="닉네임"
              placeholderTextColor={colors.textMuted}
              style={styles.authInput}
              value={nickname}
            />
            <TextInput
              onChangeText={setDistrict}
              placeholder="기본 지역"
              placeholderTextColor={colors.textMuted}
              style={styles.authInput}
              value={district}
            />
          </FilterSection>

          <FilterSection title="관심 카테고리">
            <View style={styles.chipGrid}>
              {interestOptions.map((category) => (
                <SelectableChip
                  key={category}
                  label={category}
                  selected={interests.includes(category)}
                  onPress={() => toggleInterest(category)}
                />
              ))}
            </View>
          </FilterSection>

          <SettingsSection title="동의">
            <SettingToggle
              label="마케팅 정보 수신"
              value={marketingConsent}
              onValueChange={setMarketingConsent}
            />
          </SettingsSection>

          {errorMessage ? <Text style={styles.authError}>{errorMessage}</Text> : null}
        </ScrollView>
        <View style={[styles.filterBottom, { paddingBottom: 16 + bottom }]}>
          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={() =>
              onSubmit({
                avatarUri,
                district,
                interests,
                marketingConsent,
                nickname,
              })
            }
            style={[styles.applyButton, !canSubmit && styles.disabledButton]}
          >
            {loading ? (
              <ActivityIndicator color={colors.onAccent} size="small" />
            ) : (
              <Text style={styles.applyButtonText}>프로필 저장</Text>
            )}
          </Pressable>
        </View>
      </OverlaySafeArea>
    </View>
  );
}

const GUIDE_STEPS: Array<{ icon: IoniconsName; title: string; body: string }> = [
  {
    icon: 'home-outline',
    title: '피드에서 발견하기',
    body: '내 위치 주변의 무료·저렴한 전시, 공연, 클래스, 행사를 거리순으로 추천해 드려요. 카테고리 칩으로 원하는 종류만 골라볼 수 있어요.',
  },
  {
    icon: 'map-outline',
    title: '지도로 둘러보기',
    body: '지도 탭에서 주변 장소를 한눈에 확인하세요. 핀을 누르면 하단 카드에서 거리·운영시간·카테고리를 바로 볼 수 있어요.',
  },
  {
    icon: 'bookmark-outline',
    title: '저장하고 다시 보기',
    body: '관심 있는 곳은 저장하면 저장함에서 모아볼 수 있어요. 로그인하면 여러 기기에서 저장함이 함께 동기화돼요.',
  },
  {
    icon: 'create-outline',
    title: '후기 남기기',
    body: '가운데 글쓰기 버튼이나 상세 화면의 “후기 남기기”로 별점과 한 줄 후기를 남길 수 있어요. 다른 사람에게 큰 도움이 돼요.',
  },
  {
    icon: 'person-outline',
    title: '내 취향 맞추기',
    body: '마이 → 프로필 편집에서 닉네임·기본 지역·관심 카테고리·프로필 사진을 설정하면 더 잘 맞는 추천을 받을 수 있어요.',
  },
];

function GuideScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.overlay}>
      <OverlaySafeArea>
        <TopBar onBack={onBack} showClose title="이용 안내" />
        <ScrollView contentContainerStyle={styles.guideContent}>
          <Text style={styles.guideHeroTitle}>0원으로 즐기는 문화생활</Text>
          <Text style={styles.guideHeroText}>
            0원의품격은 무료이거나 저렴한 전시·공연·클래스·행사·문화공간을 가까운 곳에서
            찾아주는 앱이에요. 아래 5단계만 알면 충분해요.
          </Text>

          {GUIDE_STEPS.map((step, index) => (
            <View key={step.title} style={styles.guideStep}>
              <View style={styles.guideStepIcon}>
                <Ionicons color={colors.accent} name={step.icon} size={20} />
              </View>
              <View style={styles.guideStepBody}>
                <Text style={styles.guideStepTitle}>
                  {index + 1}. {step.title}
                </Text>
                <Text style={styles.guideStepText}>{step.body}</Text>
              </View>
            </View>
          ))}

          <View style={styles.guideTipBox}>
            <Text style={styles.guideTipTitle}>알아두면 좋아요</Text>
            <Text style={styles.guideTipText}>
              · 표시되는 정보는 공공데이터를 기반으로 하며 실제 운영과 다를 수 있어요. 방문 전
              공식 채널에서 한 번 더 확인해 주세요.{'\n'}
              · 위치 권한을 허용하면 더 정확한 주변 추천을 받을 수 있어요.{'\n'}
              · 문의나 제안은 마이 → 문의하기로 보내주시면 빠르게 반영할게요.
            </Text>
          </View>
        </ScrollView>
      </OverlaySafeArea>
    </View>
  );
}

function SavedScreen({
  events,
  isSignedIn,
  onAuthPress,
  onBrowse,
  onEventPress,
  onToggleSaved,
}: {
  events: CultureEvent[];
  isSignedIn: boolean;
  onAuthPress: () => void;
  onBrowse: () => void;
  onEventPress: (event: CultureEvent) => void;
  onToggleSaved: (eventId: string) => void;
}) {
  const [category, setCategory] = useState<Category>('전체');
  const filtered = events.filter(
    (event) => category === '전체' || event.category === category,
  );
  const { scrollPaddingBottom } = useTabBarLayout();

  return (
    <ScrollView
      contentContainerStyle={[styles.tabContent, { paddingBottom: scrollPaddingBottom }]}
    >
      <View style={styles.simpleHeader}>
        <Text style={styles.screenTitle}>저장함</Text>
        <Text style={styles.headerTextButton}>편집</Text>
      </View>
      {!isSignedIn ? (
        <EmptyState
          ctaLabel="로그인하기"
          description="로그인하면 저장한 문화생활을 여러 기기에서 이어볼 수 있어요."
          onCta={onAuthPress}
          title="로그인이 필요한 공간이에요"
        />
      ) : (
        <>
      <CategoryRow compact selected={category} onSelect={setCategory} />
      {filtered.length > 0 ? (
        <View style={styles.savedGrid}>
          {filtered.map((event) => (
            <SavedCard
              event={event}
              key={event.id}
              onPress={() => onEventPress(event)}
              onRemove={() => onToggleSaved(event.id)}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          ctaLabel="콘텐츠 둘러보기"
          description="마음에 드는 콘텐츠를 저장하고 나만의 리스트를 만들어보세요."
          onCta={onBrowse}
          title="저장한 콘텐츠가 아직 없어요"
        />
      )}
        </>
      )}
    </ScrollView>
  );
}

function MyScreen({
  authConfigured,
  avatarUri,
  isSignedIn,
  onAuthPress,
  onGuidePress,
  onItineraryPress,
  onNotificationsPress,
  onProfilePress,
  onSettingsPress,
  profileName,
  reviewCount,
  savedCount,
  userEmail,
  viewerError,
  viewerLoading,
}: {
  authConfigured: boolean;
  avatarUri: string | null;
  isSignedIn: boolean;
  onAuthPress: () => void;
  onGuidePress: () => void;
  onItineraryPress: () => void;
  onNotificationsPress: () => void;
  onProfilePress: () => void;
  onSettingsPress: () => void;
  profileName: string | null;
  reviewCount: number;
  savedCount: number;
  userEmail: string;
  viewerError: string;
  viewerLoading: boolean;
}) {
  const { scrollPaddingBottom } = useTabBarLayout();

  return (
    <ScrollView
      contentContainerStyle={[styles.tabContent, { paddingBottom: scrollPaddingBottom }]}
    >
      <View style={styles.simpleHeader}>
        <Text style={styles.screenTitle}>마이</Text>
        <View style={styles.headerActions}>
          <IconButton label="알림" onPress={onNotificationsPress} icon="notifications-outline" />
          <IconButton label="설정" onPress={onSettingsPress} icon="settings-outline" />
        </View>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {isSignedIn && avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{isSignedIn ? 'U' : '0'}</Text>
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {isSignedIn ? profileName ?? '나의 품격 계정' : '로그인하고 저장함을 이어가세요'}
          </Text>
          <Text style={styles.profileHandle}>
            {isSignedIn
              ? `${userEmail} · 서버 동기화 준비됨`
              : authConfigured
                ? '저장함, 일정, 관심 설정을 계정에 연결할 수 있어요.'
                : 'Supabase Auth 환경변수 설정 후 로그인이 활성화됩니다.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={
              isSignedIn
                ? onProfilePress
                : onAuthPress
            }
          >
            <Text style={styles.profileEdit}>
              {isSignedIn ? '프로필 편집' : '로그인 / 회원가입'}
            </Text>
          </Pressable>
        </View>
      </View>

      {viewerLoading ? (
        <View style={styles.syncPill}>
          <ActivityIndicator color={colors.accent} size="small" />
          <Text style={styles.syncPillText}>계정 데이터를 동기화하는 중</Text>
        </View>
      ) : null}

      {viewerError ? (
        <Text style={styles.dataSourceWarning}>{viewerError}</Text>
      ) : null}

      <View style={styles.profileStats}>
        <ProfileStat label="저장한 콘텐츠" value={savedCount} />
        <ProfileStat label="방문한 곳" value={isSignedIn ? MOCK_USER.visitedCount : 0} />
        <ProfileStat label="후기" value={reviewCount} />
      </View>

      <View style={styles.menuList}>
        <MenuRow label="나의 문화생활" onPress={onItineraryPress} />
        <MenuRow label="알림" onPress={onNotificationsPress} />
        <MenuRow label="이용 안내" onPress={onGuidePress} />
        <MenuRow label="문의하기" onPress={() => openExternalUrl(`mailto:${SUPPORT_EMAIL}`)} />
      </View>
    </ScrollView>
  );
}

function formatVisitDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function MyCultureScreen({
  onBack,
  onBrowse,
  onOpenEvent,
  reviews,
}: {
  onBack: () => void;
  onBrowse: () => void;
  onOpenEvent: (eventId: string) => void;
  reviews: ReviewItem[];
}) {
  return (
    <View style={styles.overlay}>
      <OverlaySafeArea>
        <TopBar onBack={onBack} title="나의 문화생활" />
        <ScrollView contentContainerStyle={styles.overlayContent}>
          <Text style={styles.myCultureLead}>
            후기를 남긴 곳을 다녀온 문화생활로 모아봤어요. 지금까지 총 {reviews.length}곳을 기록했어요.
          </Text>
          {reviews.length > 0 ? (
            <View style={styles.myCultureList}>
              {reviews.map((review) => {
                const visitDate = formatVisitDate(review.createdAt);

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={review.id}
                    onPress={() => onOpenEvent(review.eventId)}
                    style={styles.myCultureItem}
                  >
                    <View style={styles.myCultureItemHeader}>
                      <Text numberOfLines={1} style={styles.myCultureTitle}>
                        {review.eventTitle}
                      </Text>
                      <Text style={styles.myCultureRating}>★ {review.rating.toFixed(1)}</Text>
                    </View>
                    {review.comment ? (
                      <Text numberOfLines={2} style={styles.myCultureComment}>
                        {review.comment}
                      </Text>
                    ) : (
                      <Text style={styles.myCultureMeta}>별점만 남긴 후기예요.</Text>
                    )}
                    {visitDate ? (
                      <Text style={styles.myCultureDate}>{visitDate} 방문</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <EmptyState
              ctaLabel="콘텐츠 둘러보기"
              description="다녀온 곳에 후기를 남기면 나만의 문화생활 기록이 차곡차곡 쌓여요."
              onCta={onBrowse}
              title="아직 기록한 문화생활이 없어요"
            />
          )}
        </ScrollView>
      </OverlaySafeArea>
    </View>
  );
}

function NotificationsScreen({
  notifications,
  onBack,
  onEventPress,
  onSettingsPress,
}: {
  notifications: typeof MOCK_NOTIFICATIONS;
  onBack: () => void;
  onEventPress: (eventId: string) => void;
  onSettingsPress: () => void;
}) {
  return (
    <View style={styles.overlay}>
      <OverlaySafeArea>
        <TopBar onBack={onBack} onRight={onSettingsPress} rightLabel="설정" title="알림" />
        <ScrollView contentContainerStyle={styles.overlayContent}>
          {notifications.length > 0 ? (
            <>
              <Text style={styles.groupLabel}>오늘</Text>
              {notifications.map((notification) => (
                <Pressable
                  accessibilityRole="button"
                  key={notification.id}
                  onPress={() => notification.eventId && onEventPress(notification.eventId)}
                  style={styles.notificationRow}
                >
                  <View style={[styles.unreadDot, notification.read && styles.unreadDotRead]} />
                  <View style={styles.notificationBody}>
                    <Text style={styles.notificationTag}>{notification.type}</Text>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                    <Text style={styles.notificationText}>{notification.body}</Text>
                  </View>
                </Pressable>
              ))}
            </>
          ) : (
            <EmptyState
              description="저장한 콘텐츠의 마감과 추천 소식을 이곳에서 알려드릴게요."
              title="아직 알림이 없어요"
            />
          )}
        </ScrollView>
      </OverlaySafeArea>
    </View>
  );
}

function SettingsScreen({
  authConfigured,
  defaultRegion,
  eventPushEnabled,
  isSignedIn,
  marketingEnabled,
  onAuthPress,
  onBack,
  onDefaultRegionChange,
  onEventPushEnabledChange,
  onManageInterests,
  onMarketingEnabledChange,
  onPushEnabledChange,
  onRadiusChange,
  onSignOut,
  pushEnabled,
  radiusKm,
  signingOut,
  syncing,
  userEmail,
  userInterests,
}: {
  authConfigured: boolean;
  defaultRegion: string;
  eventPushEnabled: boolean;
  isSignedIn: boolean;
  marketingEnabled: boolean;
  onAuthPress: () => void;
  onBack: () => void;
  onDefaultRegionChange: (region: string) => void;
  onEventPushEnabledChange: (enabled: boolean) => void;
  onManageInterests: () => void;
  onMarketingEnabledChange: (enabled: boolean) => void;
  onPushEnabledChange: (enabled: boolean) => void;
  onRadiusChange: (radiusKm: number) => void;
  onSignOut: () => void;
  pushEnabled: boolean;
  radiusKm: number;
  signingOut: boolean;
  syncing: boolean;
  userEmail: string;
  userInterests: string[];
}) {
  const regionOptions = REGIONS.filter((region) => region !== '기타');
  const currentRegionIndex = Math.max(regionOptions.indexOf(defaultRegion), 0);
  const nextRegion = regionOptions[(currentRegionIndex + 1) % regionOptions.length];
  const radiusOptions = [1, 5, 10, 20, 30];
  const currentRadiusIndex = Math.max(radiusOptions.indexOf(radiusKm), 0);
  const nextRadius = radiusOptions[(currentRadiusIndex + 1) % radiusOptions.length];

  return (
    <View style={styles.overlay}>
      <OverlaySafeArea>
        <TopBar onBack={onBack} title="설정" />
        <ScrollView contentContainerStyle={styles.overlayContent}>
          <SettingsSection title="계정">
            {isSignedIn ? (
              <>
                <MenuRow label="로그인 계정" value={userEmail} onPress={() => undefined} />
                <Pressable
                  accessibilityRole="button"
                  disabled={signingOut}
                  onPress={onSignOut}
                  style={styles.signOutRow}
                >
                  {signingOut ? (
                    <ActivityIndicator color={colors.textSecondary} size="small" />
                  ) : (
                    <Text style={styles.signOutText}>로그아웃</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <MenuRow
                  label="로그인 / 회원가입"
                  value={authConfigured ? '사용 가능' : '환경변수 필요'}
                  onPress={onAuthPress}
                />
                <Text style={styles.settingsHelpText}>
                  로그인하면 저장함과 관심 설정을 서버에 연결할 수 있어요.
                </Text>
              </>
            )}
          </SettingsSection>
          <SettingsSection title="알림">
            <MenuRow label="알림 설정" onPress={() => Alert.alert('알림 설정', 'MVP에서는 토글로 관리합니다.')} />
            <MenuRow
              label="관심 카테고리 관리"
              value={userInterests.length > 0 ? userInterests.join(', ') : '미설정'}
              onPress={onManageInterests}
            />
            <MenuRow
              label="기본 지역 설정"
              value={defaultRegion}
              onPress={() => onDefaultRegionChange(nextRegion)}
            />
            <MenuRow
              label="탐색 반경"
              value={`${radiusKm}km`}
              onPress={() => onRadiusChange(nextRadius)}
            />
          </SettingsSection>
          <SettingsSection title="토글">
            <SettingToggle label="푸시 알림" value={pushEnabled} onValueChange={onPushEnabledChange} />
            <SettingToggle label="이벤트 알림" value={eventPushEnabled} onValueChange={onEventPushEnabledChange} />
            <SettingToggle label="마케팅 정보 수신" value={marketingEnabled} onValueChange={onMarketingEnabledChange} />
            {syncing ? (
              <View style={styles.settingsSyncRow}>
                <ActivityIndicator color={colors.accent} size="small" />
                <Text style={styles.settingsHelpText}>설정을 서버에 저장하는 중</Text>
              </View>
            ) : null}
          </SettingsSection>
          <SettingsSection title="정보">
            <MenuRow label="앱 정보" value="버전 1.0.0" onPress={() => undefined} />
            <MenuRow label="개인정보 처리" onPress={() => openExternalUrl(PRIVACY_POLICY_URL)} />
          </SettingsSection>
        </ScrollView>
      </OverlaySafeArea>
    </View>
  );
}

function ReviewWriteScreen({
  defaultEventId,
  events,
  onBack,
  onSubmit,
  pinnedEvent,
}: {
  defaultEventId: string;
  events: CultureEvent[];
  onBack: () => void;
  onSubmit: (input: {
    comment: string;
    eventId: string;
    eventTitle: string;
    rating: number;
  }) => Promise<void>;
  pinnedEvent: CultureEvent | null;
}) {
  const isPinnedMode = Boolean(pinnedEvent);
  const [selectedEventId, setSelectedEventId] = useState(
    pinnedEvent?.id ?? events.find((event) => event.id === defaultEventId)?.id ?? events[0]?.id ?? '',
  );
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const selectedEvent =
    pinnedEvent ??
    events.find((event) => event.id === selectedEventId) ??
    events[0] ??
    null;

  const canSubmit = Boolean(selectedEvent) && rating >= 1;

  async function handleSubmit() {
    if (!selectedEvent) {
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      await onSubmit({
        comment: comment.trim(),
        eventId: selectedEvent.id,
        eventTitle: selectedEvent.title,
        rating,
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : '후기 등록에 실패했어요. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.overlay}>
      <OverlaySafeArea>
        <TopBar
          onBack={onBack}
          showClose
          title="빠른 후기"
        />
        <ScrollView
          contentContainerStyle={styles.reviewContent}
          keyboardShouldPersistTaps="handled"
        >
          {selectedEvent ? (
            <>
              <View style={styles.reviewQuickCard}>
                <Image source={{ uri: selectedEvent.thumbnail }} style={styles.reviewQuickImage} />
                <View style={styles.reviewQuickInfo}>
                  <Text numberOfLines={2} style={styles.reviewQuickTitle}>
                    {selectedEvent.title}
                  </Text>
                  <Text style={styles.reviewQuickMeta}>
                    {selectedEvent.category} · {selectedEvent.priceLabel}
                  </Text>
                </View>
              </View>

              <Text style={styles.reviewQuickHint}>현재 지도/선택 기준 장소에 바로 남겨요.</Text>

              {!isPinnedMode ? (
                <FilterSection title="현재 위치 기준 주변 장소">
                  {events.length > 0 ? (
                    <View style={styles.reviewEventList}>
                      {events.map((event) => (
                        <SelectableChip
                          key={event.id}
                          label={event.title}
                          selected={selectedEvent?.id === event.id}
                          onPress={() => setSelectedEventId(event.id)}
                        />
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.reviewHint}>
                      현재 위치 근처 장소를 찾지 못했어요. 잠시 후 다시 시도해 주세요.
                    </Text>
                  )}
                </FilterSection>
              ) : null}

              <View style={styles.reviewStarRowCentered}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Pressable
                    accessibilityLabel={`${value}점`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: rating >= value }}
                    key={value}
                    onPress={() => setRating(value)}
                    style={styles.reviewStarButton}
                  >
                    <Text style={[styles.reviewStarLarge, rating >= value && styles.reviewStarActive]}>
                      ★
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                onChangeText={setComment}
                placeholder="한 줄만 적어도 좋아요 (선택)"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                style={styles.reviewQuickInput}
                value={comment}
              />

              <Pressable
                accessibilityRole="button"
                disabled={!canSubmit || submitting}
                onPress={handleSubmit}
                style={[styles.reviewQuickSubmit, (!canSubmit || submitting) && styles.disabledButton]}
              >
                <Text style={styles.authPrimaryButtonText}>
                  {submitting ? '등록 중...' : '후기 남기기'}
                </Text>
              </Pressable>
              {submitError ? <Text style={styles.reviewErrorText}>{submitError}</Text> : null}
            </>
          ) : (
            <Text style={styles.reviewHint}>표시할 행사가 없어요. 피드/지도에서 먼저 선택해 주세요.</Text>
          )}
        </ScrollView>
      </OverlaySafeArea>
    </View>
  );
}

function ReviewSuccessModal({
  onConfirm,
  payload,
}: {
  onConfirm: () => void;
  payload: ReviewSuccessPayload;
}) {
  return (
    <View style={styles.successModalBackdrop}>
      <OverlaySafeArea>
        <View style={styles.successModalContainer}>
          <View style={styles.successModalCard}>
            <Text accessibilityRole="image" style={styles.successModalEmoji}>
              🎉
            </Text>
            <Text style={styles.successModalTitle}>후기 등록 완료!</Text>
            <Text style={styles.successModalBody}>
              {payload.eventTitle}에 남긴 {payload.rating}점 후기가 저장됐어요. 좋은 시간을 기록해줘서 고마워요!
            </Text>
            <Pressable accessibilityRole="button" onPress={onConfirm} style={styles.authPrimaryButton}>
              <Text style={styles.authPrimaryButtonText}>확인</Text>
            </Pressable>
          </View>
        </View>
      </OverlaySafeArea>
    </View>
  );
}

function BottomTabBar({
  activeTab,
  onFabPress,
  onTabPress,
}: {
  activeTab: TabKey;
  onFabPress: () => void;
  onTabPress: (tab: TabKey) => void;
}) {
  const { tabBarStyle } = useTabBarLayout();

  return (
    <View style={[styles.tabBar, tabBarStyle]}>
      <TabButton
        active={activeTab === 'feed'}
        icon="home-outline"
        label="피드"
        onPress={() => onTabPress('feed')}
      />
      <TabButton
        active={activeTab === 'map'}
        icon="map-outline"
        label="지도"
        onPress={() => onTabPress('map')}
      />
      <Pressable
        accessibilityLabel="후기 작성"
        accessibilityRole="button"
        onPress={onFabPress}
        style={styles.centerFab}
      >
        <Ionicons color={colors.onAccent} name="create-outline" size={28} />
      </Pressable>
      <TabButton
        active={activeTab === 'saved'}
        icon="bookmark-outline"
        label="저장함"
        onPress={() => onTabPress('saved')}
      />
      <TabButton
        active={activeTab === 'my'}
        icon="person-outline"
        label="마이"
        onPress={() => onTabPress('my')}
      />
    </View>
  );
}

function TabButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: IoniconsName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.tabButton}>
      <Ionicons
        color={active ? colors.accent : colors.textMuted}
        name={icon}
        size={22}
      />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function BrandTitle({ large }: { large?: boolean }) {
  return (
    <Text style={[styles.brandTitle, large && styles.brandTitleLarge]}>
      <Text style={styles.brandZero}>0</Text>원의 품격
    </Text>
  );
}

function CategoryRow({
  compact,
  onSelect,
  selected,
}: {
  compact?: boolean;
  onSelect: (category: Category) => void;
  selected: Category;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.categoryRow, compact && styles.categoryRowCompact]}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {CATEGORIES.map((category) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: selected === category }}
          key={category}
          onPress={() => onSelect(category)}
          style={[styles.categoryItem, selected === category && styles.categoryItemActive]}
        >
          <View
            style={[
              styles.categoryIcon,
              selected === category && styles.categoryIconActive,
            ]}
          >
            <Text style={[styles.categoryIconText, selected === category && styles.categoryIconTextActive]}>
              {category === '전체' ? 'A' : category.slice(0, 1)}
            </Text>
          </View>
          <Text style={[styles.categoryLabel, selected === category && styles.categoryLabelActive]}>
            {category}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function SectionHeader({
  actionLabel,
  onAction,
  title,
}: {
  actionLabel?: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel ? (
        <Pressable accessibilityRole="button" onPress={onAction}>
          <Text style={styles.sectionAction}>{actionLabel} &gt;</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FeaturedCard({
  event,
  isSaved,
  onPress,
  onToggleSaved,
}: {
  event: CultureEvent & { distanceKm?: number };
  isSaved: boolean;
  onPress: () => void;
  onToggleSaved: (eventId: string) => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.featuredCard}>
      <Image source={{ uri: event.thumbnail }} style={styles.featuredImage} />
      <View style={styles.featuredBadgeRow}>
        <FreeBadge label={event.priceLabel} />
        <Pressable
          accessibilityRole="button"
          onPress={() => onToggleSaved(event.id)}
          style={styles.imageIconButton}
        >
          <Text style={styles.imageIconText}>{isSaved ? '★' : '☆'}</Text>
        </Pressable>
      </View>
      <View style={styles.featuredBody}>
        <Text style={styles.featuredTitle}>{event.title}</Text>
        <Text style={styles.featuredMeta}>
          {event.subtitle} · {formatEventDistance(event.distanceKm)}
        </Text>
        <Text style={styles.featuredLikes}>♥ {event.favoriteCount.toLocaleString()}</Text>
      </View>
    </Pressable>
  );
}

function StatCard({
  description,
  highlight,
  label,
  value,
}: {
  description: string;
  highlight?: boolean;
  label: string;
  value: number;
}) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={[styles.statLabel, highlight && styles.statLabelHighlight]}>{label}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <Text style={[styles.statDesc, highlight && styles.statDescHighlight]}>{description}</Text>
    </View>
  );
}

function NearbyCard({
  event,
  isSaved,
  onPress,
  onToggleSaved,
}: {
  event: CultureEvent & { distanceKm?: number };
  isSaved: boolean;
  onPress: () => void;
  onToggleSaved: (eventId: string) => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.nearbyCard}>
      <Image source={{ uri: event.thumbnail }} style={styles.nearbyImage} />
      <FreeBadge compact label={event.priceLabel} />
      <Pressable
        accessibilityRole="button"
        onPress={() => onToggleSaved(event.id)}
        style={styles.nearbySave}
      >
        <Text style={styles.nearbySaveText}>{isSaved ? '★' : '☆'}</Text>
      </Pressable>
      <View style={styles.nearbyBody}>
        <Text numberOfLines={2} style={styles.nearbyTitle}>{event.title}</Text>
        <Text numberOfLines={1} style={styles.nearbyMeta}>{event.subtitle}</Text>
        <Text style={styles.nearbyDistance}>{formatEventDistance(event.distanceKm)}</Text>
      </View>
    </Pressable>
  );
}

function SavedCard({
  event,
  onPress,
  onRemove,
}: {
  event: CultureEvent;
  onPress: () => void;
  onRemove: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.savedCard}>
      <Image source={{ uri: event.thumbnail }} style={styles.savedImage} />
      <FreeBadge compact label={event.reservationRequired ? '예약' : event.priceLabel} />
      <View style={styles.savedBody}>
        <Text numberOfLines={2} style={styles.savedTitle}>{event.title}</Text>
        <Text numberOfLines={1} style={styles.savedMeta}>{event.subtitle}</Text>
        <View style={styles.savedFooter}>
          <Text style={styles.savedLikes}>♥ {event.favoriteCount}</Text>
          <Pressable accessibilityRole="button" onPress={onRemove}>
            <Text style={styles.removeText}>삭제</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function ListEventCard({
  event,
  onPress,
}: {
  event: CultureEvent & { distanceKm?: number };
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.listEventCard}>
      <Image source={{ uri: event.thumbnail }} style={styles.listEventImage} />
      <View style={styles.listEventBody}>
        <Text style={styles.listEventTitle}>{event.title}</Text>
        <Text style={styles.listEventMeta}>
          {event.subtitle} · {formatEventDistance(event.distanceKm)}
        </Text>
        <Text style={styles.listEventTag}>{event.priceLabel} · {event.category}</Text>
      </View>
    </Pressable>
  );
}

function FreeBadge({
  compact,
  label,
}: {
  compact?: boolean;
  label: string;
}) {
  return (
    <View style={[styles.freeBadge, compact && styles.freeBadgeCompact]}>
      <Text style={[styles.freeBadgeText, compact && styles.freeBadgeTextCompact]}>
        {label}
      </Text>
    </View>
  );
}

function EmptyState({
  ctaLabel,
  description,
  onCta,
  title,
}: {
  ctaLabel?: string;
  description: string;
  onCta?: () => void;
  title: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIllustration}>
        <Text style={styles.emptyIllustrationText}>0</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {ctaLabel && onCta ? (
        <Pressable accessibilityRole="button" onPress={onCta} style={styles.emptyCta}>
          <Text style={styles.emptyCtaText}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCell}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

function IconButton({
  dark,
  icon,
  label,
  onPress,
  symbol,
}: {
  dark?: boolean;
  icon?: IoniconsName;
  label: string;
  onPress: () => void;
  symbol?: string;
}) {
  const iconColor = colors.textPrimary;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.iconButton, dark && styles.iconButtonDark]}
    >
      {icon ? (
        <Ionicons color={iconColor} name={icon} size={20} />
      ) : (
        <Text style={[styles.iconButtonText, dark && styles.iconButtonTextDark]}>{symbol}</Text>
      )}
    </Pressable>
  );
}

function OverlaySafeArea({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaOverlay edges={['left', 'right', 'top']} style={styles.overlaySafe}>
      {children}
    </SafeAreaOverlay>
  );
}

function TopBar({
  onBack,
  onRight,
  rightLabel,
  showClose = false,
  title,
}: {
  onBack: () => void;
  onRight?: () => void;
  rightLabel?: string;
  showClose?: boolean;
  title: string;
}) {
  const rightAction = onRight ?? (showClose ? onBack : undefined);
  const resolvedRightLabel = rightLabel ?? (showClose ? '닫기' : undefined);

  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityLabel="뒤로"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={styles.topBack}
      >
        <Ionicons color={colors.textPrimary} name="chevron-back" size={22} />
      </Pressable>
      <Text numberOfLines={1} style={styles.topTitle}>
        {title}
      </Text>
      {resolvedRightLabel && rightAction ? (
        <Pressable
          accessibilityLabel="닫기"
          accessibilityRole="button"
          hitSlop={8}
          onPress={rightAction}
          style={styles.topRight}
        >
          <Text style={styles.topRightText}>{resolvedRightLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.topRight} />
      )}
    </View>
  );
}

function FilterSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChipGrid<T extends string>({
  items,
  onSelect,
  selected,
}: {
  items: readonly T[];
  onSelect: (item: T) => void;
  selected: T;
}) {
  return (
    <View style={styles.chipGrid}>
      {items.map((item) => (
        <SelectableChip
          key={item}
          label={item}
          selected={selected === item}
          onPress={() => onSelect(item)}
        />
      ))}
    </View>
  );
}

function SelectableChip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.selectableChip, selected && styles.selectableChipActive]}
    >
      <Text style={[styles.selectableChipText, selected && styles.selectableChipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ProfileStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.profileStat}>
      <Text style={styles.profileStatValue}>{value}</Text>
      <Text style={styles.profileStatLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({
  label,
  onPress,
  value,
}: {
  label: string;
  onPress: () => void;
  value?: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.menuRow}>
      <Text style={styles.menuLabel}>{label}</Text>
      <View style={styles.menuRight}>
        {value ? <Text style={styles.menuValue}>{value}</Text> : null}
        <Text style={styles.menuChevron}>&gt;</Text>
      </View>
    </Pressable>
  );
}

function SettingsSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.settingsSection}>
      <Text style={styles.settingsSectionTitle}>{title}</Text>
      <View style={styles.settingsCard}>{children}</View>
    </View>
  );
}

function SettingToggle({
  label,
  onValueChange,
  value,
}: {
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.menuLabel}>{label}</Text>
      <Switch
        ios_backgroundColor={colors.bgRaised}
        onValueChange={onValueChange}
        thumbColor={value ? colors.textPrimary : colors.textMuted}
        trackColor={{ false: colors.bgRaised, true: colors.accent }}
        value={value}
      />
    </View>
  );
}

function getCategoryColor(category: CultureEvent['category']) {
  if (category === '공연') {
    return colors.violet;
  }

  if (category === '클래스') {
    return colors.pink;
  }

  if (category === '행사') {
    return colors.warning;
  }

  return colors.accent;
}

const colors = {
  bg: '#0F0F0F',
  bgElevated: '#1A1A1A',
  bgRaised: '#252525',
  bgHover: '#2A2A2A',
  border: '#2E2E2E',
  borderSubtle: '#202020',
  textPrimary: '#FFFFFF',
  textSecondary: '#B5B5B5',
  textMuted: '#7A7A7A',
  textDisabled: '#4D4D4D',
  accent: '#D4FF00',
  accentHover: '#C5F500',
  onAccent: '#0F0F0F',
  violet: '#8B5CF6',
  pink: '#EC4899',
  success: '#7BD389',
  warning: '#F5C518',
  danger: '#FF5252',
  scrim: 'rgba(0,0,0,0.7)',
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  appShell: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  bootScreen: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bootText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  bootPill: {
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bootPillText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  onboarding: {
    backgroundColor: colors.bg,
    flex: 1,
    overflow: 'hidden',
  },
  onboardingGlowTop: {
    backgroundColor: colors.accent,
    borderRadius: 120,
    height: 240,
    opacity: 0.16,
    position: 'absolute',
    right: -80,
    top: -50,
    width: 240,
  },
  onboardingGlowBottom: {
    backgroundColor: colors.pink,
    borderRadius: 160,
    bottom: -90,
    height: 320,
    left: -120,
    opacity: 0.2,
    position: 'absolute',
    width: 320,
  },
  skipButton: {
    alignSelf: 'flex-end',
    marginRight: 20,
    marginTop: 12,
    padding: 10,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  onboardingContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  onboardingTitle: {
    color: colors.textPrimary,
    fontSize: 35,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 43,
  },
  onboardingBody: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: 24,
  },
  interestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 28,
  },
  interestChip: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  interestText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  onboardingFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    backgroundColor: colors.bgRaised,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 26,
  },
  nextFab: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  nextFabText: {
    color: colors.onAccent,
    fontSize: 18,
    fontWeight: '900',
  },
  tabContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 28 : 14,
  },
  feedHeader: {
    marginBottom: 16,
  },
  headerTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  brandTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
  },
  brandTitleLarge: {
    fontSize: 32,
  },
  brandZero: {
    color: colors.accent,
  },
  feedSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 8,
  },
  locationPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    marginTop: 14,
    minHeight: 34,
    paddingHorizontal: 12,
  },
  locationDot: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  locationText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  locationMessage: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 8,
  },
  dataSourceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  dataSourcePill: {
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderSubtle,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 30,
    paddingHorizontal: 10,
  },
  dataSourceDot: {
    backgroundColor: colors.success,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  dataSourceText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  dataSourceTime: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  dataSourceWarning: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 17,
    marginTop: 6,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    minWidth: 40,
    paddingHorizontal: 10,
  },
  iconButtonDark: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  iconButtonText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  iconButtonTextDark: {
    color: colors.textPrimary,
  },
  categoryRow: {
    gap: 12,
    paddingBottom: 18,
  },
  categoryRowCompact: {
    paddingBottom: 12,
  },
  categoryItem: {
    alignItems: 'center',
    gap: 6,
    minWidth: 54,
  },
  categoryItemActive: {},
  categoryIcon: {
    alignItems: 'center',
    backgroundColor: colors.bgRaised,
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  categoryIconActive: {
    backgroundColor: colors.accent,
  },
  categoryIconText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
  },
  categoryIconTextActive: {
    color: colors.onAccent,
  },
  categoryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  categoryLabelActive: {
    color: colors.textPrimary,
    fontWeight: '900',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionAction: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  featuredCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  featuredImage: {
    aspectRatio: 16 / 10,
    backgroundColor: colors.bgRaised,
    width: '100%',
  },
  featuredBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 12,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  imageIconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  imageIconText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  featuredBody: {
    padding: 14,
  },
  featuredTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
  },
  featuredMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  featuredLikes: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
  },
  freeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  freeBadgeCompact: {
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    position: 'absolute',
    top: 8,
  },
  freeBadgeText: {
    color: colors.onAccent,
    fontSize: 11,
    fontWeight: '900',
  },
  freeBadgeTextCompact: {
    fontSize: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minHeight: 94,
    padding: 12,
  },
  statCardHighlight: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  statLabelHighlight: {
    color: colors.onAccent,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 6,
  },
  statValueHighlight: {
    color: colors.onAccent,
  },
  statDesc: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  statDescHighlight: {
    color: colors.onAccent,
  },
  nearbyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  nearbyCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    minHeight: 210,
    overflow: 'hidden',
    width: '30.9%',
  },
  nearbyImage: {
    aspectRatio: 1,
    backgroundColor: colors.bgRaised,
    width: '100%',
  },
  nearbySave: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 26,
  },
  nearbySaveText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  nearbyBody: {
    padding: 8,
  },
  nearbyTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 16,
  },
  nearbyMeta: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  nearbyDistance: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  detailShell: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  detailContent: {},
  heroImageWrap: {
    backgroundColor: colors.bgRaised,
  },
  heroImage: {
    aspectRatio: 4 / 3,
    width: '100%',
  },
  detailTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 16,
    position: 'absolute',
    right: 16,
    top: Platform.OS === 'android' ? 26 : 14,
  },
  detailTopActions: {
    flexDirection: 'row',
    gap: 8,
  },
  detailBody: {
    padding: 20,
  },
  detailTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 32,
    marginTop: 14,
  },
  detailSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  ratingText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 10,
  },
  infoGrid: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 18,
    padding: 14,
  },
  infoCell: {
    flex: 1,
    gap: 5,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  detailDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: 20,
  },
  detailReviewSection: {
    gap: 10,
    marginTop: 20,
  },
  detailReviewTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  detailReviewTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  detailReviewLoadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  detailReviewMessageCard: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  detailReviewItem: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  detailReviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailReviewAuthor: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    marginRight: 8,
  },
  detailReviewRating: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  detailReviewActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  detailReviewComment: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  detailReviewMetaText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  hashRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  hashTag: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  mapPreview: {
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    marginTop: 22,
    padding: 14,
  },
  mapAddress: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
  },
  mapPreviewCanvas: {
    alignItems: 'center',
    backgroundColor: colors.bgRaised,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 180,
    justifyContent: 'center',
    marginTop: 12,
    overflow: 'hidden',
  },
  mapPreviewSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPreviewFallback: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  mapPreviewPin: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  mapPreviewPinText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '900',
  },
  mapPreviewFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  mapDistance: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  outlineSmallButton: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  outlineSmallButtonText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '900',
  },
  outlineTinyButton: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  outlineTinyButtonText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  bottomActions: {
    backgroundColor: colors.bg,
    borderColor: colors.borderSubtle,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    left: 0,
    padding: 16,
    position: 'absolute',
    right: 0,
  },
  saveAction: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
  },
  saveActionText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  reserveAction: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 14,
    flex: 2,
    justifyContent: 'center',
    minHeight: 54,
  },
  reserveActionText: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '900',
  },
  mapScreen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  mapCanvas: {
    backgroundColor: '#E8ECF1',
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  mapTileSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  nativeMap: {
    ...StyleSheet.absoluteFillObject,
  },
  webTileMap: {
    flex: 1,
    backgroundColor: '#E8ECF1',
    overflow: 'hidden',
    width: '100%',
  },
  webTileMapCompact: {
    minHeight: 180,
  },
  naverMapSurface: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bgRaised,
  },
  webMapTile: {
    position: 'absolute',
  },
  webMapShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  webMapAttribution: {
    bottom: 154,
    color: 'rgba(40, 44, 52, 0.6)',
    fontSize: 10,
    fontWeight: '700',
    left: 22,
    position: 'absolute',
  },
  mapGridLineOne: {
    backgroundColor: '#20242B',
    height: 2,
    left: -40,
    position: 'absolute',
    top: '36%',
    transform: [{ rotate: '-18deg' }],
    width: '130%',
  },
  mapGridLineTwo: {
    backgroundColor: '#20242B',
    height: '120%',
    left: '55%',
    position: 'absolute',
    top: -60,
    transform: [{ rotate: '28deg' }],
    width: 2,
  },
  mapPin: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 28,
    borderWidth: 2,
    height: 54,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
    width: 54,
  },
  mapPinActive: {
    borderColor: colors.accent,
    transform: [{ scale: 1.12 }],
  },
  mapPinImage: {
    height: 48,
    width: 48,
  },
  mapMarker: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 28,
    borderWidth: 2,
    height: 54,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 54,
  },
  mapMarkerActive: {
    borderColor: colors.accent,
    borderWidth: 3,
    transform: [{ scale: 1.12 }],
  },
  mapMarkerImage: {
    borderRadius: 24,
    height: 48,
    width: 48,
  },
  detailMapMarker: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 24,
    borderWidth: 2,
    height: 46,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 46,
  },
  detailMapMarkerImage: {
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  webMapMarker: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 28,
    borderWidth: 2,
    height: 54,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
    width: 54,
  },
  webMapMarkerActive: {
    borderColor: colors.accent,
    borderWidth: 3,
    transform: [{ scale: 1.12 }],
  },
  webMapMarkerImage: {
    borderRadius: 24,
    height: 48,
    width: 48,
  },
  webMapMarkerCompact: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: 24,
    borderWidth: 2,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
    width: 44,
  },
  webMapMarkerCompactActive: {
    borderColor: colors.accent,
    borderWidth: 3,
  },
  webMapMarkerImageCompact: {
    borderRadius: 19,
    height: 38,
    width: 38,
  },
  webMapAttributionCompact: {
    bottom: 8,
    color: 'rgba(40, 44, 52, 0.6)',
    fontSize: 10,
    fontWeight: '700',
    left: 10,
    position: 'absolute',
  },
  mapOverlayTop: {
    left: 20,
    position: 'absolute',
    right: 20,
    top: Platform.OS === 'android' ? 28 : 16,
  },
  mapCategorySpacer: {
    marginTop: 12,
  },
  mapSearchBar: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  mapSearchPlaceholder: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  mapBottomCard: {
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    left: 20,
    padding: 12,
    position: 'absolute',
    right: 20,
  },
  mapBottomImage: {
    backgroundColor: colors.bgRaised,
    borderRadius: 10,
    height: 64,
    width: 64,
  },
  mapBottomInfo: {
    flex: 1,
  },
  mapBottomTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  mapBottomMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  mapBottomCategory: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 6,
  },
  smallSaveButton: {
    alignItems: 'center',
    backgroundColor: colors.bgRaised,
    borderRadius: 999,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  smallSaveText: {
    color: colors.accent,
    fontSize: 17,
    fontWeight: '900',
  },
  overlay: {
    backgroundColor: colors.bg,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 20,
  },
  overlayKeyboard: {
    flex: 1,
  },
  overlaySafe: {
    flex: 1,
  },
  successModalBackdrop: {
    backgroundColor: colors.scrim,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 30,
  },
  successModalContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  successModalCard: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 420,
    padding: 22,
    width: '100%',
  },
  successModalEmoji: {
    fontSize: 44,
    marginBottom: 10,
    textAlign: 'center',
  },
  successModalTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 32,
    textAlign: 'center',
  },
  successModalBody: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 23,
    marginBottom: 18,
    marginTop: 10,
    textAlign: 'center',
  },
  overlayContent: {
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  searchTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchInput: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.textPrimary,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  recentChip: {
    backgroundColor: colors.bgElevated,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recentChipText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  trendingList: {
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    overflow: 'hidden',
  },
  trendingRow: {
    alignItems: 'center',
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  trendingRank: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
    width: 18,
  },
  trendingText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  resultList: {
    gap: 10,
  },
  searchPlaceLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  searchPlaceLoadingText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  searchPlaceErrorText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  searchPlaceList: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  searchPlaceItem: {
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: 1,
    gap: 4,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchPlaceTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  searchPlaceMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  authContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  authCard: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  authTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 30,
    marginTop: 24,
  },
  authDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 21,
    marginBottom: 20,
    marginTop: 8,
  },
  authNotice: {
    backgroundColor: colors.bgRaised,
    borderColor: colors.warning,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  authNoticeTitle: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '900',
  },
  authNoticeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 6,
  },
  authInput: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  authError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 10,
  },
  authPrimaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 50,
  },
  kakaoButton: {
    alignItems: 'center',
    backgroundColor: '#FEE500',
    borderRadius: 14,
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 56,
  },
  kakaoButtonText: {
    color: '#191600',
    fontSize: 15,
    fontWeight: '900',
  },
  authRedirectHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: 8,
  },
  authPrimaryButtonText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '900',
  },
  authSwitchButton: {
    alignItems: 'center',
    marginTop: 14,
    padding: 8,
  },
  authSwitchText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  reviewContent: {
    paddingBottom: 48,
    paddingHorizontal: 20,
  },
  reviewLead: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginBottom: 20,
  },
  reviewEventList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 8,
  },
  reviewStarRow: {
    flexDirection: 'row',
    gap: 4,
  },
  reviewStarButton: {
    padding: 4,
  },
  reviewStar: {
    color: colors.textMuted,
    fontSize: 34,
    fontWeight: '400',
  },
  reviewStarActive: {
    color: colors.accent,
  },
  reviewInput: {
    marginBottom: 0,
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  reviewQuickCard: {
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    padding: 14,
  },
  reviewQuickImage: {
    backgroundColor: colors.bgRaised,
    borderRadius: 12,
    height: 72,
    width: 72,
  },
  reviewQuickInfo: {
    flex: 1,
  },
  reviewQuickTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  reviewQuickMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  reviewQuickHint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  reviewStarRowCentered: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 20,
  },
  reviewStarLarge: {
    color: colors.textMuted,
    fontSize: 42,
    fontWeight: '400',
  },
  reviewQuickInput: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  reviewQuickSubmit: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 14,
    justifyContent: 'center',
    marginBottom: 12,
    minHeight: 56,
  },
  reviewChangePlace: {
    alignItems: 'center',
    padding: 10,
  },
  reviewChangePlaceText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  reviewErrorText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.45,
  },
  listEventCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  listEventImage: {
    backgroundColor: colors.bgRaised,
    borderRadius: 10,
    height: 76,
    width: 76,
  },
  listEventBody: {
    flex: 1,
    justifyContent: 'center',
  },
  listEventTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },
  listEventMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  listEventTag: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 7,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 8,
  },
  topBack: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 56,
  },
  topBackText: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
  },
  topTitle: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  topRight: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 56,
  },
  topRightText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  filterContent: {
    paddingBottom: 112,
    paddingHorizontal: 20,
  },
  filterSection: {
    marginBottom: 28,
  },
  filterSectionTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  radiusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectableChip: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  selectableChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  selectableChipText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  selectableChipTextActive: {
    color: colors.onAccent,
  },
  filterBottom: {
    backgroundColor: colors.bg,
    borderTopColor: colors.borderSubtle,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    padding: 16,
    position: 'absolute',
    right: 0,
  },
  applyButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 56,
  },
  applyButtonText: {
    color: colors.onAccent,
    fontSize: 15,
    fontWeight: '900',
  },
  simpleHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  screenTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
  },
  headerTextButton: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },
  savedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  savedCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    overflow: 'hidden',
    width: '48%',
  },
  savedImage: {
    aspectRatio: 5 / 4,
    backgroundColor: colors.bgRaised,
    width: '100%',
  },
  savedBody: {
    padding: 12,
  },
  savedTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
  },
  savedMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  savedFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  savedLikes: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
  },
  removeText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  emptyIllustration: {
    alignItems: 'center',
    backgroundColor: colors.bgRaised,
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    marginBottom: 18,
    width: 80,
  },
  emptyIllustrationText: {
    color: colors.accent,
    fontSize: 30,
    fontWeight: '900',
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 9,
    textAlign: 'center',
  },
  emptyCta: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyCtaText: {
    color: colors.onAccent,
    fontSize: 13,
    fontWeight: '900',
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 14,
    padding: 20,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.violet,
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 60,
  },
  avatarImage: {
    height: 60,
    width: 60,
  },
  profilePhotoSection: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 20,
    paddingTop: 4,
  },
  profilePhotoAvatar: {
    alignItems: 'center',
    backgroundColor: colors.bgRaised,
    borderRadius: 48,
    height: 96,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: 96,
  },
  profilePhotoImage: {
    height: 96,
    width: 96,
  },
  profilePhotoBadge: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.bg,
    borderRadius: 14,
    borderWidth: 2,
    bottom: 0,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 28,
  },
  profilePhotoAction: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  profilePhotoRemove: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  guideContent: {
    paddingBottom: 48,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  guideHeroTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
  },
  guideHeroText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginBottom: 20,
  },
  guideStep: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
    padding: 16,
  },
  guideStepIcon: {
    alignItems: 'center',
    backgroundColor: colors.bgRaised,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  guideStepBody: {
    flex: 1,
    gap: 4,
  },
  guideStepTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  guideStepText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  guideTipBox: {
    backgroundColor: 'rgba(212, 255, 0, 0.08)',
    borderColor: 'rgba(212, 255, 0, 0.25)',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    padding: 16,
  },
  guideTipTitle: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
  },
  guideTipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 21,
  },
  myCultureLead: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginBottom: 16,
  },
  myCultureList: {
    gap: 12,
  },
  myCultureItem: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  myCultureItemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  myCultureTitle: {
    color: colors.textPrimary,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  myCultureRating: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '900',
  },
  myCultureComment: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  myCultureMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  myCultureDate: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  profileHandle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  profileEdit: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 9,
  },
  syncPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    minHeight: 32,
    paddingHorizontal: 12,
  },
  syncPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  profileStats: {
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    flexDirection: 'row',
    marginTop: 14,
    paddingVertical: 18,
  },
  profileStat: {
    alignItems: 'center',
    flex: 1,
  },
  profileStatValue: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: '900',
  },
  profileStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 4,
  },
  menuList: {
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    marginTop: 14,
    overflow: 'hidden',
  },
  menuRow: {
    alignItems: 'center',
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  menuLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  menuRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  menuValue: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  menuChevron: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '900',
  },
  segmentRow: {
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 22,
    marginBottom: 18,
    paddingBottom: 10,
  },
  segmentActive: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  segmentInactive: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  itineraryList: {
    gap: 10,
  },
  groupLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    marginTop: 4,
  },
  itineraryRow: {
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  itineraryTime: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
    width: 74,
  },
  itineraryInfo: {
    flex: 1,
  },
  itineraryTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  itinerarySubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  notificationRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: 14,
  },
  unreadDot: {
    backgroundColor: colors.accent,
    borderRadius: 4,
    height: 8,
    marginTop: 7,
    width: 8,
  },
  unreadDotRead: {
    backgroundColor: colors.bgRaised,
  },
  notificationBody: {
    flex: 1,
  },
  notificationTag: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  notificationTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  notificationText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 5,
  },
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  settingsCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    overflow: 'hidden',
  },
  toggleRow: {
    alignItems: 'center',
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  signOutRow: {
    alignItems: 'center',
    borderBottomColor: colors.borderSubtle,
    borderBottomWidth: 1,
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  signOutText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '900',
  },
  settingsHelpText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    padding: 16,
  },
  settingsSyncRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  tabBar: {
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  tabIcon: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '900',
  },
  tabIconActive: {
    color: colors.accent,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  tabLabelActive: {
    color: colors.accent,
  },
  centerFab: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginTop: -30,
    width: 56,
  },
  centerFabText: {
    color: colors.onAccent,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
  },
});
