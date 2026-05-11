import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
  CATEGORIES,
  CULTURE_EVENTS,
  MOCK_NOTIFICATIONS,
  MOCK_USER,
  TRENDING_SEARCHES,
} from './src/data/events';
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
import type {
  Category,
  CultureEvent,
  CultureFilters,
  PriceTier,
  UserCoordinate,
} from './src/types';

type TabKey = 'feed' | 'map' | 'saved' | 'my';
type OverlayKey =
  | 'auth'
  | 'search'
  | 'filter'
  | 'notifications'
  | 'itinerary'
  | 'profile'
  | 'settings';
type AuthMode = 'signIn' | 'signUp';

const ONBOARDING_KEY = 'zero-won-poomgyeok:onboarded';
const SAVED_KEY = 'zero-won-poomgyeok:saved-events';
const RECENT_SEARCH_KEY = 'zero-won-poomgyeok:recent-searches';

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

export default function App() {
  const [booting, setBooting] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>('feed');
  const [overlay, setOverlay] = useState<OverlayKey | null>(null);
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
  const authConfigured = isSupabaseAuthConfigured();
  const currentUser = authSession.user;
  const isSignedIn = Boolean(currentUser);
  const viewerEmail = currentUser?.email ?? '로그인 사용자';
  const viewerProfile = viewerData?.profile ?? null;

  useEffect(() => {
    let mounted = true;

    async function restore() {
      const [onboarded, saved, recent] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_KEY),
        AsyncStorage.getItem(SAVED_KEY),
        AsyncStorage.getItem(RECENT_SEARCH_KEY),
      ]);

      if (!mounted) {
        return;
      }

      setShowOnboarding(onboarded !== 'true');
      setSavedIds(saved ? JSON.parse(saved) : []);
      setRecentSearches(recent ? JSON.parse(recent) : ['전시', '무료공연', '이번 주말']);
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

      const nextViewerData = await loadViewerData();
      setViewerData(nextViewerData);
      setSavedIds(nextViewerData.savedEventIds);
    } catch (error) {
      setViewerData(previousViewerData);
      setSavedIds(previousSavedIds);
      Alert.alert(
        '저장 동기화 실패',
        error instanceof Error
          ? error.message
          : '저장함을 서버에 반영하지 못했습니다.',
      );
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
      setAuthError(
        error instanceof Error
          ? error.message
          : '인증 처리 중 문제가 발생했습니다.',
      );
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
      const nextViewerData = await updateViewerProfile(input);
      setViewerData(nextViewerData);
      setMarketingEnabled(nextViewerData.profile.marketingConsent);
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
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.appShell}>
        {selectedEvent ? (
          <DetailScreen
            event={selectedEvent}
            isSaved={visibleSavedIds.includes(selectedEvent.id)}
            onBack={() => setSelectedEvent(null)}
            onDirections={openDirections}
            onReservation={openReservation}
            onToggleSaved={toggleSaved}
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
                isSignedIn={isSignedIn}
                onAuthPress={() => openAuthGate('signIn')}
                onItineraryPress={() => setOverlay('itinerary')}
                onNotificationsPress={() => setOverlay('notifications')}
                onProfilePress={() => setOverlay('profile')}
                onSettingsPress={() => setOverlay('settings')}
                profileName={viewerProfile?.nickname ?? null}
                savedCount={savedEvents.length}
                userEmail={viewerEmail}
                viewerError={viewerError}
                viewerLoading={viewerLoading}
              />
            ) : null}

            <BottomTabBar activeTab={activeTab} onTabPress={openTab} />
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
          <ItineraryScreen
            events={savedEvents}
            onBack={() => setOverlay(null)}
            onBrowse={() => {
              setOverlay(null);
              openTab('feed');
            }}
            onEventPress={openEvent}
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
      </View>
    </SafeAreaView>
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

  return (
    <SafeAreaView style={styles.onboarding}>
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
      <View style={styles.onboardingFooter}>
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
    </SafeAreaView>
  );
}

function FeedScreen({
  cultureEventsLoading,
  dataSource,
  events,
  featured,
  filters,
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
  return (
    <ScrollView
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.feedHeader}>
        <View style={styles.headerTopRow}>
          <BrandTitle />
          <View style={styles.headerActions}>
            <IconButton label="검색" onPress={onSearchPress} symbol="S" />
            <IconButton label="알림" onPress={onNotificationsPress} symbol="B" />
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
  onReservation,
  onToggleSaved,
}: {
  event: CultureEvent & { distanceKm?: number };
  isSaved: boolean;
  onBack: () => void;
  onDirections: (event: CultureEvent) => void;
  onReservation: (event: CultureEvent) => void;
  onToggleSaved: (eventId: string) => void;
}) {
  return (
    <View style={styles.detailShell}>
      <ScrollView contentContainerStyle={styles.detailContent}>
        <View style={styles.heroImageWrap}>
          <Image source={{ uri: event.images[0] }} style={styles.heroImage} />
          <View style={styles.detailTopBar}>
            <IconButton dark label="뒤로" onPress={onBack} symbol="<" />
            <View style={styles.detailTopActions}>
              <IconButton dark label="공유" onPress={() => Alert.alert('공유', '공유 기능은 MVP 후속 범위입니다.')} symbol="SH" />
              <IconButton
                dark
                label={isSaved ? '저장 해제' : '저장'}
                onPress={() => onToggleSaved(event.id)}
                symbol={isSaved ? '★' : '☆'}
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
          <View style={styles.hashRow}>
            {event.hashtags.map((tag) => (
              <Text key={tag} style={styles.hashTag}>#{tag}</Text>
            ))}
          </View>

          <View style={styles.mapPreview}>
            <Text style={styles.mapAddress}>{event.location.address}</Text>
            <View style={styles.mapPreviewCanvas}>
              <View style={styles.mapPreviewPin}>
                <Text style={styles.mapPreviewPinText}>0</Text>
              </View>
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

      <View style={styles.bottomActions}>
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
  return (
    <View style={styles.mapScreen}>
      <View style={styles.mapCanvas}>
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
      </View>

      <View style={styles.mapOverlayTop}>
        <Pressable accessibilityRole="button" onPress={onSearchPress} style={styles.mapSearchBar}>
          <Text style={styles.mapSearchPlaceholder}>지역, 장소, 키워드 검색</Text>
        </Pressable>
        <CategoryRow compact selected={selectedCategory} onSelect={onCategoryChange} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => onEventPress(selectedEvent)}
        style={styles.mapBottomCard}
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
      <SafeAreaView style={styles.overlaySafe}>
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
          ) : results.length > 0 ? (
            <View style={styles.resultList}>
              {results.map((event) => (
                <ListEventCard
                  event={event}
                  key={event.id}
                  onPress={() => onEventPress(event)}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              description="다른 키워드나 더 넓은 필터로 다시 검색해보세요."
              title="검색 결과가 없어요"
            />
          )}
        </ScrollView>
      </SafeAreaView>
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
      <SafeAreaView style={styles.overlaySafe}>
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
      </SafeAreaView>
    </View>
  );
}

function AuthScreen({
  authConfigured,
  errorMessage,
  loading,
  mode,
  onBack,
  onModeChange,
  onSubmit,
}: {
  authConfigured: boolean;
  errorMessage: string;
  loading: boolean;
  mode: AuthMode;
  onBack: () => void;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const isSignIn = mode === 'signIn';
  const canSubmit = email.trim().includes('@') && password.length >= 6 && !loading;

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.overlaySafe}>
        <TopBar onBack={onBack} title={isSignIn ? '로그인' : '회원가입'} />
        <ScrollView contentContainerStyle={styles.authContent}>
          <View style={styles.authCard}>
            <BrandTitle />
            <Text style={styles.authTitle}>
              {isSignIn ? '나만의 문화 리스트로 이어가기' : '무료 문화생활을 내 계정에 저장하기'}
            </Text>
            <Text style={styles.authDescription}>
              저장함, 일정, 관심 설정은 로그인 후 여러 기기에서 이어집니다.
            </Text>

            {!authConfigured ? (
              <View style={styles.authNotice}>
                <Text style={styles.authNoticeTitle}>Auth 환경변수 필요</Text>
                <Text style={styles.authNoticeText}>
                  Vercel과 `.env.local`에 `EXPO_PUBLIC_SUPABASE_URL`,
                  `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 설정하면 실제 로그인이
                  활성화됩니다.
                </Text>
              </View>
            ) : null}

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

            {errorMessage ? (
              <Text style={styles.authError}>{errorMessage}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit || !authConfigured}
              onPress={() => onSubmit(email.trim(), password)}
              style={[
                styles.authPrimaryButton,
                (!canSubmit || !authConfigured) && styles.disabledButton,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.onAccent} size="small" />
              ) : (
                <Text style={styles.authPrimaryButtonText}>
                  {isSignIn ? '로그인' : '회원가입'}
                </Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => onModeChange(isSignIn ? 'signUp' : 'signIn')}
              style={styles.authSwitchButton}
            >
              <Text style={styles.authSwitchText}>
                {isSignIn ? '처음이라면 회원가입' : '이미 계정이 있다면 로그인'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ProfileScreen({
  defaultDistrict,
  defaultInterests,
  defaultMarketingConsent,
  defaultNickname,
  errorMessage,
  loading,
  onBack,
  onSubmit,
}: {
  defaultDistrict: string;
  defaultInterests: string[];
  defaultMarketingConsent: boolean;
  defaultNickname: string;
  errorMessage: string;
  loading: boolean;
  onBack: () => void;
  onSubmit: (input: {
    district: string;
    interests: string[];
    marketingConsent: boolean;
    nickname: string;
  }) => void;
}) {
  const [nickname, setNickname] = useState(defaultNickname);
  const [district, setDistrict] = useState(defaultDistrict);
  const [interests, setInterests] = useState<string[]>(defaultInterests);
  const [marketingConsent, setMarketingConsent] = useState(defaultMarketingConsent);
  const interestOptions = CATEGORIES.filter((category) => category !== '전체');
  const canSubmit = nickname.trim().length >= 2 && !loading;

  function toggleInterest(category: string) {
    setInterests((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [category, ...current],
    );
  }

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.overlaySafe}>
        <TopBar onBack={onBack} title="프로필 편집" />
        <ScrollView contentContainerStyle={styles.filterContent}>
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
        <View style={styles.filterBottom}>
          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={() =>
              onSubmit({
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
      </SafeAreaView>
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

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
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
  isSignedIn,
  onAuthPress,
  onItineraryPress,
  onNotificationsPress,
  onProfilePress,
  onSettingsPress,
  profileName,
  savedCount,
  userEmail,
  viewerError,
  viewerLoading,
}: {
  authConfigured: boolean;
  isSignedIn: boolean;
  onAuthPress: () => void;
  onItineraryPress: () => void;
  onNotificationsPress: () => void;
  onProfilePress: () => void;
  onSettingsPress: () => void;
  profileName: string | null;
  savedCount: number;
  userEmail: string;
  viewerError: string;
  viewerLoading: boolean;
}) {
  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <View style={styles.simpleHeader}>
        <Text style={styles.screenTitle}>마이</Text>
        <View style={styles.headerActions}>
          <IconButton label="알림" onPress={onNotificationsPress} symbol="B" />
          <IconButton label="설정" onPress={onSettingsPress} symbol="G" />
        </View>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{isSignedIn ? 'U' : '0'}</Text>
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
        <ProfileStat label="후기" value={isSignedIn ? MOCK_USER.reviewCount : 0} />
      </View>

      <View style={styles.menuList}>
        <MenuRow label="나의 일정" onPress={onItineraryPress} />
        <MenuRow label="최근 본 콘텐츠" onPress={() => Alert.alert('준비 중', '최근 본 콘텐츠는 다음 단계에서 연결합니다.')} />
        <MenuRow label="알림" onPress={onNotificationsPress} />
        <MenuRow label="이용 안내" onPress={() => Alert.alert('이용 안내', '무료 문화생활을 더 가까이 발견하는 앱입니다.')} />
        <MenuRow label="문의하기" onPress={() => Alert.alert('문의하기', 'contact@zero-won.local')} />
      </View>
    </ScrollView>
  );
}

function ItineraryScreen({
  events,
  onBack,
  onBrowse,
  onEventPress,
}: {
  events: CultureEvent[];
  onBack: () => void;
  onBrowse: () => void;
  onEventPress: (event: CultureEvent) => void;
}) {
  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.overlaySafe}>
        <TopBar onBack={onBack} title="나의 일정" />
        <ScrollView contentContainerStyle={styles.overlayContent}>
          <View style={styles.segmentRow}>
            <Text style={styles.segmentActive}>예정 ({events.length})</Text>
            <Text style={styles.segmentInactive}>지난 일정</Text>
          </View>
          {events.length > 0 ? (
            <View style={styles.itineraryList}>
              <Text style={styles.groupLabel}>다가오는 일정</Text>
              {events.slice(0, 5).map((event) => (
                <Pressable
                  accessibilityRole="button"
                  key={event.id}
                  onPress={() => onEventPress(event)}
                  style={styles.itineraryRow}
                >
                  <Text style={styles.itineraryTime}>{event.schedule.operatingHours}</Text>
                  <View style={styles.itineraryInfo}>
                    <Text style={styles.itineraryTitle}>{event.title}</Text>
                    <Text style={styles.itinerarySubtitle}>{event.subtitle}</Text>
                  </View>
                  <FreeBadge label={event.reservationRequired ? '예약' : event.priceLabel} />
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyState
              ctaLabel="콘텐츠 둘러보기"
              description="저장한 콘텐츠를 일정처럼 다시 확인할 수 있어요."
              onCta={onBrowse}
              title="예정된 일정이 없어요"
            />
          )}
        </ScrollView>
      </SafeAreaView>
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
      <SafeAreaView style={styles.overlaySafe}>
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
      </SafeAreaView>
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
      <SafeAreaView style={styles.overlaySafe}>
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
            <MenuRow label="관심 카테고리 관리" onPress={() => Alert.alert('관심 카테고리', userInterests.join(', '))} />
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
            <MenuRow label="개인정보 처리" onPress={() => Alert.alert('개인정보 처리', '계정 삭제와 개인정보 고지는 다음 단계에서 확정합니다.')} />
          </SettingsSection>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function BottomTabBar({
  activeTab,
  onTabPress,
}: {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
}) {
  return (
    <View style={styles.tabBar}>
      <TabButton active={activeTab === 'feed'} label="피드" onPress={() => onTabPress('feed')} symbol="H" />
      <TabButton active={activeTab === 'map'} label="지도" onPress={() => onTabPress('map')} symbol="P" />
      <Pressable
        accessibilityRole="button"
        onPress={() => Alert.alert('액션', '행사 제보와 후기 작성은 MVP 후속 범위입니다.')}
        style={styles.centerFab}
      >
        <Text style={styles.centerFabText}>+</Text>
      </Pressable>
      <TabButton active={activeTab === 'saved'} label="저장함" onPress={() => onTabPress('saved')} symbol="M" />
      <TabButton active={activeTab === 'my'} label="마이" onPress={() => onTabPress('my')} symbol="U" />
    </View>
  );
}

function TabButton({
  active,
  label,
  onPress,
  symbol,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  symbol: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.tabButton}>
      <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{symbol}</Text>
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

function IconButton({
  dark,
  label,
  onPress,
  symbol,
}: {
  dark?: boolean;
  label: string;
  onPress: () => void;
  symbol: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.iconButton, dark && styles.iconButtonDark]}
    >
      <Text style={[styles.iconButtonText, dark && styles.iconButtonTextDark]}>{symbol}</Text>
    </Pressable>
  );
}

function TopBar({
  onBack,
  onRight,
  rightLabel,
  title,
}: {
  onBack: () => void;
  onRight?: () => void;
  rightLabel?: string;
  title: string;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.topBack}>
        <Text style={styles.topBackText}>&lt;</Text>
      </Pressable>
      <Text style={styles.topTitle}>{title}</Text>
      {rightLabel ? (
        <Pressable accessibilityRole="button" onPress={onRight} style={styles.topRight}>
          <Text style={styles.topRightText}>{rightLabel}</Text>
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
    paddingBottom: 36,
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
    paddingBottom: 112,
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
  detailContent: {
    paddingBottom: 112,
  },
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
    backgroundColor: '#121418',
    flex: 1,
    overflow: 'hidden',
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
  mapOverlayTop: {
    left: 20,
    position: 'absolute',
    right: 20,
    top: Platform.OS === 'android' ? 28 : 16,
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
    bottom: 102,
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
  overlaySafe: {
    flex: 1,
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
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 14,
  },
  topBack: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  topBackText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  topTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  topRight: {
    alignItems: 'flex-end',
    minWidth: 58,
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
    width: 60,
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
    height: 82,
    justifyContent: 'space-around',
    left: 0,
    paddingBottom: 10,
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
