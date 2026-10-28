// Small building blocks shared by the shell islands, made from Cast UI tokens and react-native-web primitives.
// Cast's ListItem and Card take onPress only; on a static site navigation must be a real <a href> (it works before
// hydration, opens in a new tab, and is announced as a link), so these rows render Pressable with href.
import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Icon, Text, useTheme } from '@castui/cast-ui';

type LinkRowProps = {
  href: string;
  label: string;
  current?: boolean;
  /** Trailing icon (Material Symbols name). */
  trailingIcon?: string;
  /** Spoken in place of the label, e.g. to say where an archive link goes. */
  accessibilityLabel?: string;
  muted?: boolean;
  indent?: number;
  size?: 'sm' | 'md';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** A navigation row: list-item styling from Cast's list tokens, rendered as an anchor. */
export function LinkRow({ href, label, current, trailingIcon, accessibilityLabel, muted, indent = 0, size = 'md', onPress, style }: LinkRowProps) {
  const { scheme, spacing } = useTheme();
  const item = scheme.list.item;
  return (
    <Pressable
      // react-native-web renders Pressable with href as <a>.
      {...({ href } as object)}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel}
      {...(current ? { 'aria-current': 'page' } : {})}
      style={(state) => {
        const hovered = (state as { hovered?: boolean }).hovered;
        const c = current ? (hovered ? item.selectedHover : item.selected) : hovered ? item.hover : item.default;
        return [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            minHeight: size === 'sm' ? 30 : 34,
            paddingVertical: 5,
            paddingLeft: spacing.sm + indent,
            paddingRight: spacing.sm,
            borderRadius: 6,
            backgroundColor: c.bg,
          },
          style,
        ];
      }}
    >
      {(state) => {
        const hovered = (state as { hovered?: boolean }).hovered;
        const c = current ? (hovered ? item.selectedHover : item.selected) : hovered ? item.hover : item.default;
        const color = muted && !current && !hovered ? scheme.text.description : c.fg;
        return (
          <>
            <Text type={size === 'sm' ? 'body-sm' : 'label-md'} color={color} style={{ flex: 1, fontWeight: current ? '600' : '400' }}>
              {label}
            </Text>
            {trailingIcon ? <Icon name={trailingIcon} size="small" color={scheme.text.description} /> : null}
          </>
        );
      }}
    </Pressable>
  );
}

/** Small uppercase heading above a group of rows. */
export function GroupLabel({ children }: { children: string }) {
  const { scheme, spacing } = useTheme();
  return (
    <Text
      type="label-sm"
      color={scheme.text.description}
      style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.xs, letterSpacing: 0.8, textTransform: 'uppercase' }}
    >
      {children}
    </Text>
  );
}

/** Square icon-only button (Cast's Button always has a text label). */
export function IconButton({
  icon,
  label,
  onPress,
  href,
  style,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
  href?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const n = colors.neutral.subtle;
  return (
    <Pressable
      {...(href ? ({ href } as object) : {})}
      onPress={onPress}
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={label}
      style={(state) => {
        const s = state as { hovered?: boolean; pressed?: boolean };
        const c = s.pressed ? n.active : s.hovered ? n.hover : n.default;
        return [
          { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
          style,
        ];
      }}
    >
      {(state) => {
        const s = state as { hovered?: boolean; pressed?: boolean };
        const c = s.pressed ? n.active : s.hovered ? n.hover : n.default;
        return <Icon name={icon} size="large" color={c.fg} />;
      }}
    </Pressable>
  );
}

/** Horizontal row with a gap. */
export function Row({ children, gap, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  const { spacing } = useTheme();
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: gap ?? spacing.sm }, style]}>{children}</View>;
}
