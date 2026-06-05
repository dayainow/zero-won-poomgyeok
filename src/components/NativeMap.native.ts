import { Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export const NativeMapView = MapView;
export const NativeMarker = Marker;
export const NativeMapProvider =
  Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;
