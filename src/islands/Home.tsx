// Home page body. Rendered on the server only (no client directive): Cast components, zero JavaScript.
import React from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Icon, Text, useTheme } from '@castui/cast-ui';
import CastRoot from '../cast/CastRoot';

export type HomeTask = { q: string; d: string; href: string; topic: string; archived: boolean };
export type HomePhase = { n: number; key: string; label: string; summary: string; icon: string; href: string; count: number; archived: number };

function useHoverCard() {
  const { scheme, colors } = useTheme();
  return (hovered: boolean) => ({
    borderWidth: 1,
    borderColor: hovered ? colors.brand.default.default.fg : scheme.list.separator,
    backgroundColor: hovered ? scheme.surface.subtle : scheme.surface.base,
    borderRadius: 10,
  });
}

function TaskCard({ t }: { t: HomeTask }) {
  const { scheme, colors, spacing } = useTheme();
  const card = useHoverCard();
  return (
    <Pressable
      {...({ href: t.href } as object)}
      accessibilityRole="link"
      style={(s) => [card(!!(s as { hovered?: boolean }).hovered), { padding: spacing.md, gap: 6, flexGrow: 1, flexBasis: 260 }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text type="label-sm" color={colors.brand.default.default.fg} style={{ textTransform: 'uppercase', letterSpacing: 0.8, flexShrink: 1 }}>
          {t.topic}
        </Text>
        {t.archived ? <Badge size="small" variant="outline">v1 archive</Badge> : null}
      </View>
      <Text type="title-sm" color={scheme.text.primary}>
        {t.q}
      </Text>
      <Text type="body-md" color={scheme.text.description}>
        {t.d}
      </Text>
    </Pressable>
  );
}

function PhaseCard({ p }: { p: HomePhase }) {
  const { scheme, colors, spacing } = useTheme();
  const card = useHoverCard();
  return (
    <Pressable
      {...({ href: p.href } as object)}
      accessibilityRole="link"
      accessibilityLabel={`Phase ${p.n}, ${p.label}: ${p.summary}. ${p.count} topics.`}
      style={(s) => [card(!!(s as { hovered?: boolean }).hovered), { padding: spacing.md, gap: 8, flexGrow: 1, flexBasis: 220 }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: scheme.list.item.selected.bg,
          }}
        >
          <Icon name={p.icon} size="default" color={scheme.list.item.selected.fg} />
        </View>
        <Text type="label-sm" color={scheme.text.description} style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          {`PHASE ${p.n}/8`}
        </Text>
      </View>
      <Text type="title-md" color={scheme.text.primary}>
        {p.label}
      </Text>
      <Text type="body-md" color={scheme.text.description}>
        {p.summary}
      </Text>
      <Text type="body-sm" color={colors.brand.default.default.fg}>
        {`${p.count} topic${p.count === 1 ? '' : 's'}${p.archived ? ` · ${p.archived} in the v1 archive` : ''}`}
      </Text>
    </Pressable>
  );
}

export function TaskGrid({ tasks }: { tasks: HomeTask[] }) {
  return (
    <CastRoot>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {tasks.map((t) => (
          <TaskCard key={t.q} t={t} />
        ))}
      </View>
    </CastRoot>
  );
}

export function PhaseGrid({ phases }: { phases: HomePhase[] }) {
  return (
    <CastRoot>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {phases.map((p) => (
          <PhaseCard key={p.key} p={p} />
        ))}
      </View>
    </CastRoot>
  );
}
