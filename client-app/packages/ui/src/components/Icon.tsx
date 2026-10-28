import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * The same icon set Electron draws (`electron/src/ui/components/Icon.tsx`),
 * re-expressed with react-native-svg so both clients look identical at the same
 * stroke weight. 24×24 viewBox, 1.8 stroke, round caps — do not drift from that.
 */
export type IconName =
  | 'arrow-left'
  | 'arrow-right'
  | 'camera'
  | 'check'
  | 'chevron-right'
  | 'clock'
  | 'copy'
  | 'heart'
  | 'image'
  | 'info'
  | 'mail'
  | 'monitor'
  | 'printer'
  | 'refresh'
  | 'sparkles'
  | 'ticket'
  | 'wallet'
  | 'wifi'
  | 'wifi-off'
  | 'x';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const common = {
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const Icon: React.FC<IconProps> = ({ name, size = 22, color = '#281637', strokeWidth = 1.8 }) => {
  const stroke = color;
  const props = { ...common, stroke, strokeWidth };

  const body = () => {
    switch (name) {
      case 'arrow-left':
        return (
          <>
            <Path d="m15 18-6-6 6-6" {...props} />
            <Path d="M9 12h10" {...props} />
          </>
        );
      case 'arrow-right':
        return (
          <>
            <Path d="m9 18 6-6-6-6" {...props} />
            <Path d="M5 12h10" {...props} />
          </>
        );
      case 'camera':
        return (
          <>
            <Path
              d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3z"
              {...props}
            />
            <Circle cx="12" cy="13" r="3.5" {...props} />
          </>
        );
      case 'check':
        return <Path d="m5 12 4 4L19 6" {...props} />;
      case 'chevron-right':
        return <Path d="m9 18 6-6-6-6" {...props} />;
      case 'clock':
        return (
          <>
            <Circle cx="12" cy="12" r="9" {...props} />
            <Path d="M12 7v5l3 2" {...props} />
          </>
        );
      case 'copy':
        return (
          <>
            <Rect x="8" y="8" width="11" height="11" rx="2" {...props} />
            <Path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" {...props} />
          </>
        );
      case 'heart':
        return (
          <Path
            d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.8l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"
            {...props}
          />
        );
      case 'image':
        return (
          <>
            <Rect x="3" y="4" width="18" height="16" rx="2" {...props} />
            <Circle cx="8.5" cy="9" r="1.5" {...props} />
            <Path d="m21 15-5-5L5 20" {...props} />
          </>
        );
      case 'info':
        return (
          <>
            <Circle cx="12" cy="12" r="9" {...props} />
            <Path d="M12 11v5M12 8h.01" {...props} />
          </>
        );
      case 'mail':
        return (
          <>
            <Rect x="3" y="5" width="18" height="14" rx="2" {...props} />
            <Path d="m3 7 9 6 9-6" {...props} />
          </>
        );
      case 'monitor':
        return (
          <>
            <Rect x="3" y="4" width="18" height="14" rx="2" {...props} />
            <Path d="M8 22h8M12 18v4" {...props} />
          </>
        );
      case 'printer':
        return (
          <>
            <Path d="M6 9V3h12v6" {...props} />
            <Rect x="6" y="14" width="12" height="7" {...props} />
            <Path
              d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
              {...props}
            />
          </>
        );
      case 'refresh':
        return (
          <>
            <Path d="M20 7v5h-5" {...props} />
            <Path d="M4 17v-5h5" {...props} />
            <Path d="M6.1 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 11.9-3" {...props} />
          </>
        );
      case 'sparkles':
        return (
          <>
            <Path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2z" {...props} />
            <Path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8zM5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8-2.3-.7 2.3-.7z" {...props} />
          </>
        );
      case 'ticket':
        return (
          <>
            <Path
              d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z"
              {...props}
            />
            <Path d="M13 5v14" {...props} />
          </>
        );
      case 'wallet':
        return (
          <>
            <Path d="M3 6a2 2 0 0 1 2-2h13v4H5a2 2 0 0 0 0 4h16v8H5a2 2 0 0 1-2-2z" {...props} />
            <Path d="M17 15h.01" {...props} />
          </>
        );
      case 'wifi':
        return (
          <>
            <Path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" {...props} />
            <Circle cx="12" cy="20" r="0.7" fill={stroke} stroke="none" />
          </>
        );
      case 'wifi-off':
        return (
          <>
            <Path d="M5 12.5a10 10 0 0 1 9-2.7M14.5 16a5 5 0 0 0-2.5-1" {...props} />
            <Circle cx="12" cy="20" r="0.7" fill={stroke} stroke="none" />
            <Path d="m3 3 18 18" {...props} />
          </>
        );
      case 'x':
        return <Path d="m6 6 12 12M18 6 6 18" {...props} />;
      default:
        return null;
    }
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityRole="image">
      {body()}
    </Svg>
  );
};
