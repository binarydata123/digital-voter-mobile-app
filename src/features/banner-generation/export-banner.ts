import type { RefObject } from 'react';
import type { View } from 'react-native';
export async function exportBanner(_ref: RefObject<View | null>, _action: 'save' | 'share', _width: number, _height: number): Promise<void> {
  throw new Error('Banner export is unavailable on this platform.');
}
