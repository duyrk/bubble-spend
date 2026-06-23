// Ambient room-lighting backdrop — soft radial color halos behind the bubble field.
// Uses real SVG radial gradients so the light fades smoothly to transparent. (A
// plain translucent circle has a hard edge and reads as a "fake bubble" instead.)

import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useResolvedTheme } from '@/hooks/useTheme';

export function AmbientBloom() {
  const { width, height } = useWindowDimensions();
  const theme = useResolvedTheme();

  // Center bloom uses the accent purple; the offset bloom a cool blue. Opacities
  // are tuned per theme — light backgrounds need a touch more to register.
  const centerOpacity = theme === 'light' ? 0.16 : 0.14;
  const offsetOpacity = theme === 'light' ? 0.13 : 0.1;

  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width={width}
      height={height}
    >
      <Defs>
        <RadialGradient id="bloomCenter" cx="50%" cy="34%" r="62%">
          <Stop offset="0" stopColor="#7C6AF7" stopOpacity={centerOpacity} />
          <Stop offset="1" stopColor="#7C6AF7" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="bloomOffset" cx="92%" cy="4%" r="55%">
          <Stop offset="0" stopColor="#64A0C8" stopOpacity={offsetOpacity} />
          <Stop offset="1" stopColor="#64A0C8" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#bloomCenter)" />
      <Rect x="0" y="0" width={width} height={height} fill="url(#bloomOffset)" />
    </Svg>
  );
}
