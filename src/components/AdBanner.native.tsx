import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import {
  AD_BANNER_HEIGHT,
  getBannerAdUnitId,
  getConfiguredBannerAdUnitId,
  isAdMobEnabled,
  isValidBannerAdUnitId,
  TEST_ANDROID_BANNER,
  TEST_IOS_BANNER,
} from '../services/admob';

type AdsModule = typeof import('react-native-google-mobile-ads');

export function AdBanner() {
  const [adsModule, setAdsModule] = useState<AdsModule | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [unitId, setUnitId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdMobEnabled()) {
      return undefined;
    }

    let mounted = true;

    async function boot() {
      try {
        const module = await import('react-native-google-mobile-ads');
        await module.default().initialize();

        if (!mounted) {
          return;
        }

        setAdsModule(module);
        setUnitId(__DEV__ ? module.TestIds.BANNER : getBannerAdUnitId());
        setReady(true);
      } catch {
        if (mounted) {
          setFailed(true);
        }
      }
    }

    boot();

    return () => {
      mounted = false;
    };
  }, []);

  function handleAdFailedToLoad() {
    const configured = getConfiguredBannerAdUnitId();
    const fallback = Platform.OS === 'ios' ? TEST_IOS_BANNER : TEST_ANDROID_BANNER;

    if (isValidBannerAdUnitId(configured) && unitId === configured) {
      setUnitId(fallback);
      return;
    }

    setFailed(true);
  }

  if (!isAdMobEnabled() || !ready || failed || !adsModule || !unitId) {
    return null;
  }

  const { BannerAd, BannerAdSize } = adsModule;

  return (
    <View style={styles.wrap}>
      <BannerAd
        onAdFailedToLoad={handleAdFailedToLoad}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        unitId={unitId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    borderTopColor: '#2E2E2E',
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: AD_BANNER_HEIGHT,
    width: '100%',
  },
});
