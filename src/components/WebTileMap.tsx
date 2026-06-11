import { useMemo } from 'react';
import {
  Image,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';

import type { CultureEvent } from '../types';

export const WEB_MAP_TILE_SIZE = 256;
const WEB_MAP_MIN_ZOOM = 13;
const WEB_MAP_MAX_ZOOM = 18;
const TILE_SUBDOMAINS = ['a', 'b', 'c', 'd'] as const;
const MAP_TILE_BACKGROUND = '#D8DEE6';

export type MapRegion = {
  latitude: number;
  latitudeDelta: number;
  longitude: number;
  longitudeDelta: number;
};

type MapTile = {
  left: number;
  top: number;
  x: number;
  y: number;
  zoom: number;
};

type WebTileMapProps = {
  compact?: boolean;
  events: Array<CultureEvent & { distanceKm?: number }>;
  mapRegion: MapRegion;
  onSelectEvent: (eventId: string) => void;
  selectedEvent: CultureEvent;
  size: { height: number; width: number };
  getCategoryColor: (category: CultureEvent['category']) => string;
};

export function WebTileMap({
  compact = false,
  events,
  mapRegion,
  onSelectEvent,
  selectedEvent,
  size,
  getCategoryColor,
}: WebTileMapProps) {
  const zoom = getWebMapZoom(mapRegion.longitudeDelta);
  const layout = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) {
      return null;
    }

    const centerPoint = projectCoordinate(mapRegion.latitude, mapRegion.longitude, zoom);
    const left = centerPoint.x - size.width / 2;
    const top = centerPoint.y - size.height / 2;
    const tiles = createWebMapTiles(left, top, size, zoom);

    return {
      left,
      tiles,
      top,
      zoom,
    };
  }, [
    mapRegion.latitude,
    mapRegion.longitude,
    mapRegion.longitudeDelta,
    size.height,
    size.width,
    zoom,
  ]);

  if (!layout) {
    return <View style={[styles.surface, compact && styles.surfaceCompact, styles.placeholder]} />;
  }

  const { left, tiles, top } = layout;
  const markerOffset = 22;

  return (
    <View
      style={[styles.surface, compact && styles.surfaceCompact]}
      collapsable={false}
      renderToHardwareTextureAndroid
    >
      {tiles.map((tile) => (
        <MapTileImage key={`${tile.zoom}-${tile.x}-${tile.y}`} tile={tile} />
      ))}

      <View pointerEvents="none" style={styles.shade} />

      {events.map((event) => {
        const point = projectCoordinate(event.location.lat, event.location.lng, zoom);

        return (
          <Pressable
            accessibilityRole="button"
            key={event.id}
            onPress={() => onSelectEvent(event.id)}
            style={[
              compact ? styles.markerCompact : styles.marker,
              {
                borderColor: getCategoryColor(event.category),
                left: PixelRatio.roundToNearestPixel(point.x - left - markerOffset),
                top: PixelRatio.roundToNearestPixel(point.y - top - markerOffset),
              },
              selectedEvent.id === event.id &&
                (compact ? styles.markerCompactActive : styles.markerActive),
            ]}
          >
            <Image
              source={{ uri: event.thumbnail }}
              style={compact ? styles.markerImageCompact : styles.markerImage}
            />
          </Pressable>
        );
      })}

      <Text style={compact ? styles.attributionCompact : styles.attribution}>
        © OpenStreetMap © CARTO
      </Text>
    </View>
  );
}

function MapTileImage({ tile }: { tile: MapTile }) {
  const tileStyle: StyleProp<ImageStyle> = {
    height: WEB_MAP_TILE_SIZE,
    left: PixelRatio.roundToNearestPixel(tile.left),
    top: PixelRatio.roundToNearestPixel(tile.top),
    width: WEB_MAP_TILE_SIZE,
  };

  return (
    <Image
      fadeDuration={0}
      resizeMode="stretch"
      source={{ uri: getWebTileUrl(tile.zoom, tile.x, tile.y) }}
      style={[styles.tile, tileStyle]}
    />
  );
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
  const maxTile = 2 ** zoom;
  const startX = Math.floor(left / WEB_MAP_TILE_SIZE) - 1;
  const endX = Math.ceil((left + size.width) / WEB_MAP_TILE_SIZE);
  const startY = Math.floor(top / WEB_MAP_TILE_SIZE) - 1;
  const endY = Math.ceil((top + size.height) / WEB_MAP_TILE_SIZE);
  const tiles: MapTile[] = [];

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
  const zoom = Math.round(Math.log2(360 / Math.max(longitudeDelta, 0.0005)));

  return Math.min(WEB_MAP_MAX_ZOOM, Math.max(WEB_MAP_MIN_ZOOM, zoom));
}

function getWebTileUrl(zoom: number, x: number, y: number): string {
  const subdomain = TILE_SUBDOMAINS[(x + y + zoom) % TILE_SUBDOMAINS.length];

  return `https://${subdomain}.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${y}.png`;
}

const styles = StyleSheet.create({
  surface: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MAP_TILE_BACKGROUND,
    overflow: 'hidden',
  },
  surfaceCompact: {
    minHeight: 180,
    position: 'relative',
    top: undefined,
    right: undefined,
    bottom: undefined,
    left: undefined,
  },
  placeholder: {
    backgroundColor: MAP_TILE_BACKGROUND,
  },
  tile: {
    position: 'absolute',
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  attribution: {
    bottom: 154,
    color: 'rgba(40, 44, 52, 0.6)',
    fontSize: 10,
    fontWeight: '700',
    left: 22,
    position: 'absolute',
  },
  attributionCompact: {
    bottom: 8,
    color: 'rgba(40, 44, 52, 0.6)',
    fontSize: 9,
    fontWeight: '700',
    left: 10,
    position: 'absolute',
  },
  marker: {
    alignItems: 'center',
    backgroundColor: '#F7F8FB',
    borderRadius: 22,
    borderWidth: 2,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
    width: 44,
  },
  markerActive: {
    borderColor: '#D4FF00',
    borderWidth: 3,
    transform: [{ scale: 1.12 }],
  },
  markerCompact: {
    alignItems: 'center',
    backgroundColor: '#F7F8FB',
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
    width: 36,
  },
  markerCompactActive: {
    borderColor: '#D4FF00',
    borderWidth: 3,
  },
  markerImage: {
    borderRadius: 20,
    height: 36,
    width: 36,
  },
  markerImageCompact: {
    borderRadius: 14,
    height: 28,
    width: 28,
  },
});
