import type { ComponentType } from 'react';

type NativeMapComponent = ComponentType<Record<string, unknown>> | null;

export const NativeMapView: NativeMapComponent = null;
export const NativeMarker: NativeMapComponent = null;
