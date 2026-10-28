import React from 'react';
import { Pressable, View } from 'react-native';
import { Button, Text, useTheme } from '@castui/cast-ui';
import CastRoot from '../cast/CastRoot';

/** The hero's two calls to action. Hydrated so "Search" can open the header's search dialog. */
function Actions({ startHref, startLabel }: { startHref: string; startLabel: string }) {
  const { colors, spacing } = useTheme();
  const bold = colors.brand.bold;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {/* Cast's Button has no href; this anchor reuses its bold-brand colours and large size. */}
      <Pressable
        {...({ href: startHref } as object)}
        accessibilityRole="link"
        style={(s) => {
          const st = s as { hovered?: boolean; pressed?: boolean };
          const c = st.pressed ? bold.active : st.hovered ? bold.hover : bold.default;
          return { height: 48, paddingHorizontal: 20, borderRadius: 8, justifyContent: 'center', backgroundColor: c.bg };
        }}
      >
        <Text type="label-lg" color={bold.default.fg}>
          {startLabel}
        </Text>
      </Pressable>
      <Button size="large" leadingIcon="search" onPress={() => window.dispatchEvent(new Event('refdb:search'))}>
        Search the reference
      </Button>
    </View>
  );
}

export default function HomeActions(props: { startHref: string; startLabel: string }) {
  return (
    <CastRoot>
      <Actions {...props} />
    </CastRoot>
  );
}
