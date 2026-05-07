import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  getInitialLibraryData,
  loadLibraryData,
} from './src/services/libraryApi';
import type { Library, UserCoordinate } from './src/types';
import {
  formatDistance,
  getDistanceKm,
  getLibraryStatus,
  hasWeekendHours,
} from './src/utils/library';

type FilterMode = 'all' | 'open' | 'weekend' | 'favorites';

const FAVORITES_KEY = 'zero-won-poomgyeok:favorites';
const SEOUL_CITY_HALL: UserCoordinate = {
  latitude: 37.5662952,
  longitude: 126.9779451,
};

const FILTERS: Array<{ label: string; value: FilterMode }> = [
  { label: '전체', value: 'all' },
  { label: '지금 열림', value: 'open' },
  { label: '주말 운영', value: 'weekend' },
  { label: '즐겨찾기', value: 'favorites' },
];

export default function App() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [userLocation, setUserLocation] =
    useState<UserCoordinate>(SEOUL_CITY_HALL);
  const [locationLabel, setLocationLabel] = useState('서울시청 기준');
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationMessage, setLocationMessage] = useState('');
  const [libraryData, setLibraryData] = useState(getInitialLibraryData);
  const [libraryDataLoading, setLibraryDataLoading] = useState(false);
  const [launchReady, setLaunchReady] = useState(false);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    const timer = setTimeout(() => setLaunchReady(true), 1200);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY)
      .then((value) => {
        if (value) {
          setFavorites(JSON.parse(value));
        }
      })
      .catch(() => {
        setFavorites([]);
      })
      .finally(() => setFavoritesReady(true));
  }, []);

  useEffect(() => {
    if (!favoritesReady) {
      return;
    }

    AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)).catch(
      () => undefined,
    );
  }, [favorites, favoritesReady]);

  const refreshCurrentLocation = useCallback(
    async ({
      shouldApply = () => true,
      showRefreshMessage = false,
    }: {
      shouldApply?: () => boolean;
      showRefreshMessage?: boolean;
    } = {}) => {
      setLocationLoading(true);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (!shouldApply()) {
          return;
        }

        if (status !== 'granted') {
          setUserLocation(SEOUL_CITY_HALL);
          setLocationLabel('서울시청 기준');
          setLocationMessage('위치 권한이 꺼져 있어 서울시청 기준으로 정렬합니다.');
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!shouldApply()) {
          return;
        }

        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationLabel('현재 위치 기준');
        setLocationMessage(
          showRefreshMessage
            ? '검색 결과를 현재 위치 기준 거리순으로 다시 정렬했습니다.'
            : '',
        );
      } catch {
        if (shouldApply()) {
          setLocationMessage('현재 위치를 가져오지 못해 기존 기준으로 정렬합니다.');
        }
      } finally {
        if (shouldApply()) {
          setLocationLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;

    refreshCurrentLocation({
      shouldApply: () => active,
    });

    return () => {
      active = false;
    };
  }, [refreshCurrentLocation]);

  useEffect(() => {
    let cancelled = false;

    async function loadRemoteLibraries() {
      setLibraryDataLoading(true);

      const nextLibraryData = await loadLibraryData();

      if (!cancelled) {
        setLibraryData(nextLibraryData);
        setLibraryDataLoading(false);
      }
    }

    loadRemoteLibraries();

    return () => {
      cancelled = true;
    };
  }, []);

  const libraryItems = useMemo(
    () =>
      libraryData.libraries.map((library) => {
      const status = getLibraryStatus(library, now);
      const distanceKm = getDistanceKm(userLocation, library);

      return {
        library,
        status,
        distanceKm,
      };
      }),
    [libraryData.libraries, now, userLocation],
  );

  const filterStats = useMemo(
    () => ({
      all: libraryItems.length,
      open: libraryItems.filter((item) => item.status.isOpen).length,
      weekend: libraryItems.filter((item) => hasWeekendHours(item.library)).length,
      favorites: libraryItems.filter((item) => favorites.includes(item.library.id))
        .length,
    }),
    [favorites, libraryItems],
  );

  const preparedLibraries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return libraryItems
      .filter(({ library, status }) => {
        if (filter === 'open' && !status.isOpen) {
          return false;
        }

        if (filter === 'weekend' && !hasWeekendHours(library)) {
          return false;
        }

        if (filter === 'favorites' && !favorites.includes(library.id)) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          library.name,
          library.city,
          library.district,
          library.type,
          library.address,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        if (a.status.isOpen !== b.status.isOpen) {
          return a.status.isOpen ? -1 : 1;
        }

        return a.distanceKm - b.distanceKm;
      });
  }, [favorites, filter, libraryItems, query]);

  const openCount = filterStats.open;

  function toggleFavorite(libraryId: string) {
    setFavorites((current) =>
      current.includes(libraryId)
        ? current.filter((id) => id !== libraryId)
        : [...current, libraryId],
    );
  }

  async function refreshLibraryData() {
    setLibraryDataLoading(true);
    setLibraryData(await loadLibraryData());
    setLibraryDataLoading(false);
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

  function callLibrary(phone: string) {
    openUrl(`tel:${phone.replaceAll('-', '')}`, '전화 앱을 열 수 없습니다.');
  }

  function openHomepage(homepage: string) {
    openUrl(homepage, '홈페이지를 열 수 없습니다.');
  }

  function openDirections(library: Library) {
    const destination = `${library.latitude},${library.longitude}`;
    const encodedName = encodeURIComponent(library.name);
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${destination}&q=${encodedName}`
        : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;

    openUrl(url, '지도 앱을 열 수 없습니다.');
  }

  if (!launchReady) {
    return <LaunchScreen />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.brandRow}>
            <LogoMark />
            <Text style={styles.brandName}>0원의품격</Text>
          </View>

          <Pressable
            accessibilityHint="현재 위치를 다시 가져와 검색 결과를 거리순으로 정렬합니다."
            accessibilityRole="button"
            disabled={locationLoading}
            onPress={() =>
              refreshCurrentLocation({
                showRefreshMessage: true,
              })
            }
            style={({ pressed }) => [
              styles.heroLocationPill,
              pressed && styles.heroLocationPillPressed,
              locationLoading && styles.heroLocationPillLoading,
            ]}
          >
            <View style={styles.locationDot} />
            {locationLoading ? (
              <ActivityIndicator color="#2563eb" size="small" />
            ) : null}
            <Text style={styles.heroLocationText}>{locationLabel}</Text>
          </Pressable>

          <Text style={styles.heroTitle}>
            오늘 무료로{'\n'}
            <Text style={styles.heroTitleAccent}>갈 수 있는 곳</Text>{' '}
            {openCount.toLocaleString()}곳을 찾았어요
          </Text>

          <View style={styles.summaryRow}>
            <Metric label="검색 결과" tone="default" value={`${preparedLibraries.length}곳`} />
            <Metric label="지금 열림" tone="open" value={`${openCount}곳`} />
            <Metric label="저장됨" tone="save" value={`${favorites.length}곳`} />
          </View>
        </View>

        {locationMessage ? (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeTitle}>위치 안내</Text>
            <Text style={styles.noticeText}>{locationMessage}</Text>
          </View>
        ) : null}

        <View style={styles.searchPanel}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={setQuery}
            placeholder="예: 무료, 전시, 도서관"
            placeholderTextColor="#8b948f"
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />

          <ScrollView
            contentContainerStyle={styles.filterRow}
            horizontal
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
          >
            {FILTERS.map((item) => {
              const selected = filter === item.value;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  hitSlop={6}
                  key={item.value}
                  onPress={() => setFilter(item.value)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    selected && styles.filterChipActive,
                    pressed && styles.filterChipPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selected && styles.filterChipTextActive,
                    ]}
                  >
                    {item.label}
                    <Text
                      style={[
                        styles.filterChipCount,
                        selected && styles.filterChipCountActive,
                      ]}
                    >
                      {' '}
                      {filterStats[item.value].toLocaleString()}
                    </Text>
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View
          style={[
            styles.sourceNotice,
            libraryData.warning && styles.sourceNoticeWarning,
          ]}
        >
          <View style={styles.sourceNoticeHeader}>
            <View style={styles.sourceNoticeTitleBlock}>
              <Text style={styles.sourceNoticeTitle}>
                {libraryData.sourceLabel}
              </Text>
              <Text style={styles.sourceNoticeText}>
                {formatUpdatedAt(libraryData.updatedAt)}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={libraryDataLoading}
              onPress={refreshLibraryData}
              style={[
                styles.sourceRefreshButton,
                libraryDataLoading && styles.sourceRefreshButtonDisabled,
              ]}
            >
              {libraryDataLoading ? (
                <ActivityIndicator color="#1a5f53" size="small" />
              ) : (
                <Text style={styles.sourceRefreshButtonText}>새로고침</Text>
              )}
            </Pressable>
          </View>

          {libraryData.warning ? (
            <Text style={styles.sourceWarningText}>{libraryData.warning}</Text>
          ) : null}
        </View>

        <View style={styles.libraryList}>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderTitle}>
              가까운 순 · <Text style={styles.listHeaderHighlight}>{preparedLibraries.length.toLocaleString()}곳</Text>
            </Text>
            <Text style={styles.listHeaderSort}>거리 ↓</Text>
          </View>

          {preparedLibraries.map(({ library, status, distanceKm }) => (
            <LibraryCard
              distanceKm={distanceKm}
              isFavorite={favorites.includes(library.id)}
              key={library.id}
              library={library}
              onCall={callLibrary}
              onDirections={openDirections}
              onFavorite={toggleFavorite}
              onHomepage={openHomepage}
              statusLabel={status.label}
              statusTone={status.tone}
            />
          ))}

          {preparedLibraries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>!</Text>
              <Text style={styles.emptyTitle}>조건에 맞는 장소가 없어요</Text>
              <Text style={styles.emptyText}>
                필터를 전체로 바꾸거나 다른 지역명을 검색해보세요.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setFilter('all')}
                style={styles.emptyButton}
              >
                <Text style={styles.emptyButtonText}>전체 보기</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LaunchScreen() {
  return (
    <SafeAreaView style={styles.launchScreen}>
      <StatusBar style="dark" />
      <View style={styles.launchOrb}>
        <LogoMark large />
      </View>
      <Text style={styles.launchTitle}>0원의품격</Text>
      <Text style={styles.launchSubtitle}>가까운 무료 문화공간을 불러오는 중</Text>
      <View style={styles.launchLoadingPill}>
        <ActivityIndicator color="#2563eb" size="small" />
        <Text style={styles.launchLoadingText}>공공데이터 연결 확인</Text>
      </View>
    </SafeAreaView>
  );
}

function LogoMark({ large }: { large?: boolean }) {
  return (
    <View style={[styles.logoMark, large && styles.logoMarkLarge]}>
      <View style={[styles.logoBook, large && styles.logoBookLarge]}>
        <View style={[styles.logoPage, large && styles.logoPageLarge]} />
        <View style={[styles.logoPage, large && styles.logoPageLarge]} />
      </View>
      <View style={[styles.logoPin, large && styles.logoPinLarge]}>
        <View style={[styles.logoPinCore, large && styles.logoPinCoreLarge]} />
      </View>
    </View>
  );
}

function Metric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'default' | 'open' | 'save';
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, styles[`metricValue_${tone}`]]}>
        {value}
      </Text>
    </View>
  );
}

function LibraryCard({
  distanceKm,
  isFavorite,
  library,
  onCall,
  onDirections,
  onFavorite,
  onHomepage,
  statusLabel,
  statusTone,
}: {
  distanceKm: number;
  isFavorite: boolean;
  library: Library;
  onCall: (phone: string) => void;
  onDirections: (library: Library) => void;
  onFavorite: (libraryId: string) => void;
  onHomepage: (homepage: string) => void;
  statusLabel: string;
  statusTone: 'open' | 'soon' | 'closed';
}) {
  return (
    <View style={styles.libraryCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.libraryType}>
            {library.city} {library.district} · {library.type}
          </Text>
          <Text style={styles.libraryName}>{library.name}</Text>
        </View>

        <Pressable
          accessibilityLabel={
            isFavorite ? `${library.name} 즐겨찾기 해제` : `${library.name} 즐겨찾기`
          }
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => onFavorite(library.id)}
          style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
        >
          <Text
            style={[
              styles.favoriteButtonText,
              isFavorite && styles.favoriteButtonTextActive,
            ]}
          >
            {isFavorite ? '♥' : '♡'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.cardMetaRow}>
        <View style={[styles.statusPill, styles[`statusPill_${statusTone}`]]}>
          <View style={[styles.statusDot, styles[`statusDot_${statusTone}`]]} />
          <Text style={[styles.statusText, styles[`statusText_${statusTone}`]]}>
            {statusLabel}
          </Text>
        </View>
        <Text style={styles.distanceText}>{formatDistance(distanceKm)}</Text>
      </View>

      <View style={styles.infoGrid}>
        <InfoCell label="평일" value={formatHours(library.weekdayHours)} />
        <InfoCell label="토" value={formatHours(library.saturdayHours)} />
        <InfoCell label="일" value={formatHours(library.sundayHours)} />
        <InfoCell label="좌석" value={`${library.seats.toLocaleString()}`} />
      </View>

      <Text style={styles.address}>{library.address}</Text>
      <Text style={styles.closedRule}>휴관 {library.closedRules.join(', ')}</Text>

      <View style={styles.actionRow}>
        <ActionButton label="전화" onPress={() => onCall(library.phone)} />
        <ActionButton label="홈페이지" onPress={() => onHomepage(library.homepage)} />
        <ActionButton label="길찾기" onPress={() => onDirections(library)} primary />
      </View>
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

function ActionButton({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.actionButton, primary && styles.actionButtonPrimary]}
    >
      <Text
        style={[
          styles.actionButtonText,
          primary && styles.actionButtonTextPrimary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function formatHours(hours: Library['weekdayHours']) {
  if (!hours) {
    return '휴관';
  }

  return `${hours.open}-${hours.close}`;
}

function formatUpdatedAt(updatedAt: string | null) {
  if (!updatedAt) {
    return '원격 캐시가 없을 때도 앱은 내장 데이터로 동작합니다.';
  }

  return `마지막 동기화: ${new Date(updatedAt).toLocaleString('ko-KR')}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f7f8fb',
  },
  content: {
    paddingBottom: 24,
  },
  launchScreen: {
    alignItems: 'center',
    backgroundColor: '#f7f8fb',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  launchOrb: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 34,
    borderWidth: 1,
    height: 132,
    justifyContent: 'center',
    marginBottom: 22,
    width: 132,
  },
  launchTitle: {
    color: '#0b1220',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
  },
  launchSubtitle: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  launchLoadingPill: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 26,
    minHeight: 40,
    paddingHorizontal: 16,
  },
  launchLoadingText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
  },
  hero: {
    backgroundColor: '#f7f8fb',
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 28 : 16,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    marginBottom: 14,
  },
  logoMark: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  logoMarkLarge: {
    borderRadius: 20,
    height: 82,
    width: 82,
  },
  logoBook: {
    alignItems: 'flex-end',
    bottom: 6,
    flexDirection: 'row',
    gap: 2,
    position: 'absolute',
  },
  logoBookLarge: {
    bottom: 18,
    gap: 4,
  },
  logoPage: {
    backgroundColor: '#ffffff',
    borderRadius: 2,
    height: 11,
    width: 8,
  },
  logoPageLarge: {
    borderRadius: 4,
    height: 26,
    width: 18,
  },
  logoPin: {
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    justifyContent: 'center',
    position: 'absolute',
    right: -3,
    top: -3,
    width: 16,
  },
  logoPinLarge: {
    borderRadius: 15,
    borderWidth: 4,
    height: 30,
    right: -7,
    top: -7,
    width: 30,
  },
  logoPinCore: {
    backgroundColor: '#ffffff',
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  logoPinCoreLarge: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  brandName: {
    color: '#0b1220',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0,
  },
  heroLocationPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    minHeight: 32,
    paddingHorizontal: 12,
  },
  heroLocationPillPressed: {
    opacity: 0.72,
  },
  heroLocationPillLoading: {
    opacity: 0.82,
  },
  locationDot: {
    backgroundColor: '#2563eb',
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  heroLocationText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#0b1220',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 32,
    marginBottom: 18,
  },
  heroTitleAccent: {
    color: '#059669',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    minHeight: 74,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  metricValue: {
    color: '#0b1220',
    fontSize: 22,
    fontWeight: '800',
  },
  metricValue_default: {
    color: '#0b1220',
  },
  metricValue_open: {
    color: '#059669',
  },
  metricValue_save: {
    color: '#db2777',
  },
  noticeBox: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 4,
    padding: 14,
  },
  noticeTitle: {
    color: '#92400e',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  noticeText: {
    color: '#b45309',
    fontSize: 13,
    lineHeight: 19,
  },
  searchPanel: {
    backgroundColor: 'transparent',
    marginHorizontal: 20,
    marginTop: 4,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    color: '#0b1220',
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  filterRow: {
    gap: 6,
    paddingBottom: 4,
    paddingTop: 10,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 13,
  },
  filterChipActive: {
    backgroundColor: '#0b1220',
    borderColor: '#0b1220',
  },
  filterChipPressed: {
    opacity: 0.72,
  },
  filterChipText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  filterChipCount: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
  filterChipCountActive: {
    color: '#ffffff',
  },
  sourceNotice: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 20,
    marginTop: 10,
    padding: 14,
  },
  sourceNoticeWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  sourceNoticeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sourceNoticeTitleBlock: {
    flex: 1,
  },
  sourceNoticeTitle: {
    color: '#0b1220',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  sourceNoticeText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
  },
  sourceWarningText: {
    color: '#b45309',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  sourceRefreshButton: {
    alignItems: 'center',
    borderColor: '#2563eb',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 82,
    paddingHorizontal: 12,
  },
  sourceRefreshButtonDisabled: {
    opacity: 0.65,
  },
  sourceRefreshButtonText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
  },
  libraryList: {
    gap: 10,
    marginHorizontal: 20,
    marginTop: 14,
  },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  listHeaderTitle: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '700',
  },
  listHeaderHighlight: {
    color: '#2563eb',
  },
  listHeaderSort: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  libraryCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardTitleBlock: {
    flex: 1,
  },
  libraryType: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  libraryName: {
    color: '#0b1220',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 22,
  },
  favoriteButton: {
    alignItems: 'center',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 30,
  },
  favoriteButtonActive: {
    backgroundColor: '#fce7f3',
  },
  favoriteButtonText: {
    color: '#94a3b8',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  favoriteButtonTextActive: {
    color: '#db2777',
  },
  cardMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statusPill: {
    alignItems: 'center',
    borderRadius: 6,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusPill_open: {
    backgroundColor: '#ecfdf5',
    borderColor: '#d1fae5',
    borderWidth: 1,
  },
  statusPill_soon: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
  },
  statusPill_closed: {
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
    borderWidth: 1,
  },
  statusDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  statusDot_open: {
    backgroundColor: '#047857',
  },
  statusDot_soon: {
    backgroundColor: '#d97706',
  },
  statusDot_closed: {
    backgroundColor: '#dc2626',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusText_open: {
    color: '#047857',
  },
  statusText_soon: {
    color: '#d97706',
  },
  statusText_closed: {
    color: '#dc2626',
  },
  distanceText: {
    color: '#0b1220',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  infoCell: {
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 3,
    textAlign: 'center',
  },
  infoValue: {
    color: '#0b1220',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  address: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 12,
  },
  closedRule: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  actionRow: {
    borderColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 38,
  },
  actionButtonPrimary: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  actionButtonText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  actionButtonTextPrimary: {
    color: '#ffffff',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 26,
  },
  emptyIcon: {
    backgroundColor: '#f1f5f9',
    borderRadius: 18,
    color: '#64748b',
    fontSize: 24,
    fontWeight: '900',
    height: 58,
    lineHeight: 58,
    marginBottom: 10,
    overflow: 'hidden',
    textAlign: 'center',
    width: 58,
  },
  emptyTitle: {
    color: '#0b1220',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 40,
    paddingHorizontal: 18,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
