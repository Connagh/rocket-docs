import React from 'react';
import { View } from 'react-native';
import { Accordion, AccordionItem, Divider, Text, useTheme } from '@castui/cast-ui';
import CastRoot from '../cast/CastRoot';
import { GroupLabel, LinkRow } from '../cast/ui';
import type { NavLink, NavSection } from '../data/nav';

export type SideNavProps = {
  start: NavLink[];
  sections: NavSection[];
  currentSection: string | null;
  classicHref: string;
  legacyHref: string;
  /** Called after a link is chosen (the mobile drawer closes itself). */
  onNavigate?: () => void;
};

function Section({ section, onNavigate }: { section: NavSection; onNavigate?: () => void }) {
  const { scheme, spacing } = useTheme();
  const rebuilt = section.links.filter((l) => !l.archived);
  const archived = section.links.filter((l) => l.archived);
  return (
    <View style={{ gap: 2, paddingBottom: spacing.sm }}>
      <Text type="body-sm" color={scheme.text.description} style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.xs }}>
        {section.summary}
      </Text>
      {rebuilt.map((l) => (
        <LinkRow key={l.href} href={l.href} label={l.label} current={l.current} onPress={onNavigate} />
      ))}
      {archived.length > 0 ? (
        <>
          <GroupLabel>In the v1 archive</GroupLabel>
          {archived.map((l) => (
            <LinkRow
              key={l.href}
              href={l.href}
              label={l.label}
              muted
              size="sm"
              trailingIcon="history"
              accessibilityLabel={`${l.label} (opens the v1 archive)`}
              onPress={onNavigate}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

/** The topic tree: "Start here", then the eight design phases as expandable sections. */
export function SideNavTree({ start, sections, currentSection, classicHref, legacyHref, onNavigate }: SideNavProps) {
  const { spacing } = useTheme();
  return (
    <View accessibilityRole={'navigation' as never} accessibilityLabel="Topics" style={{ gap: spacing.xs }}>
      <GroupLabel>Start here</GroupLabel>
      {start.map((l) => (
        <LinkRow key={l.href} href={l.href} label={l.label} current={l.current} onPress={onNavigate} />
      ))}
      <GroupLabel>Design phases</GroupLabel>
      <Accordion type="multiple" defaultValue={currentSection ? [currentSection] : []} size="small">
        {sections.map((s) => (
          <AccordionItem key={s.key} value={s.key} title={s.label} leadingIcon={s.icon}>
            <Section section={s} onNavigate={onNavigate} />
          </AccordionItem>
        ))}
      </Accordion>
      <Divider style={{ marginVertical: spacing.sm }} />
      <LinkRow href={classicHref} label="Classic site" trailingIcon="history" size="sm" muted />
      <LinkRow href={legacyHref} label="Original v1 reference" trailingIcon="history" size="sm" muted />
    </View>
  );
}

export default function SideNav(props: SideNavProps) {
  return (
    <CastRoot>
      <SideNavTree {...props} />
    </CastRoot>
  );
}
