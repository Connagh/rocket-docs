import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Accordion, AccordionItem, Text, useTheme } from '@castui/cast-ui';
import CastRoot from '../cast/CastRoot';

export type TocHeading = { depth: number; slug: string; text: string };

/** Track the heading nearest the top of the viewport. */
function useActive(slugs: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = slugs.map((s) => document.getElementById(s)).filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const update = () => {
      const y = 96; // below the sticky header
      let cur: string | null = els[0].id;
      for (const el of els) if (el.getBoundingClientRect().top - y <= 0) cur = el.id;
      setActive(cur);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [slugs.join('|')]);
  return active;
}

function TocLink({ h, active }: { h: TocHeading; active: boolean }) {
  const { scheme, colors, spacing } = useTheme();
  return (
    <Pressable
      {...({ href: `#${h.slug}` } as object)}
      accessibilityRole="link"
      {...(active ? { 'aria-current': 'location' } : {})}
      style={{
        paddingVertical: 4,
        paddingLeft: spacing.sm + (h.depth - 2) * 12,
        borderLeftWidth: 2,
        borderLeftColor: active ? colors.brand.bold.default.bg : 'transparent',
      }}
    >
      {(state) => (
        <Text
          type="body-sm"
          color={active ? colors.brand.default.default.fg : (state as { hovered?: boolean }).hovered ? scheme.text.primary : scheme.text.description}
          style={{ fontSize: 13, lineHeight: 18 }}
        >
          {h.text}
        </Text>
      )}
    </Pressable>
  );
}

export function TocList({ headings }: { headings: TocHeading[] }) {
  const active = useActive(headings.map((h) => h.slug));
  const { scheme } = useTheme();
  return (
    <View style={{ borderLeftWidth: 1, borderLeftColor: scheme.list.separator }}>
      {headings.map((h) => (
        <TocLink key={h.slug} h={h} active={active === h.slug} />
      ))}
    </View>
  );
}

/** "On this page": the page's sections, with the one being read highlighted. */
export default function PageToc({ headings }: { headings: TocHeading[] }) {
  return (
    <CastRoot>
      <View accessibilityRole={'navigation' as never} accessibilityLabel="On this page" style={{ gap: 8 }}>
        <Heading />
        <TocList headings={headings} />
      </View>
    </CastRoot>
  );
}

function Heading() {
  const { scheme } = useTheme();
  return (
    <Text type="label-sm" color={scheme.text.description} style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
      On this page
    </Text>
  );
}

/** Narrow screens: the same list, folded into one expandable row above the article. */
export function PageTocCollapsible({ headings }: { headings: TocHeading[] }) {
  return (
    <CastRoot>
      <View accessibilityRole={'navigation' as never} accessibilityLabel="On this page">
        <Accordion type="single" size="small">
          <AccordionItem value="toc" title="On this page" leadingIcon="toc">
            <TocList headings={headings} />
          </AccordionItem>
        </Accordion>
      </View>
    </CastRoot>
  );
}
