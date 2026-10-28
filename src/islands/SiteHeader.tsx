import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text as RNText, View } from 'react-native';
import { Drawer, Icon, Input, Spinner, Text, useTheme } from '@castui/cast-ui';
import CastRoot from '../cast/CastRoot';
import { IconButton, Row } from '../cast/ui';
import { SideNavTree, type SideNavProps } from './SideNav';

type Props = {
  base: string;
  githubHref: string;
  nav: Omit<SideNavProps, 'onNavigate'>;
};

const MONO = "'IBM Plex Mono', ui-monospace, monospace";

function Logo({ href }: { href: string }) {
  const { scheme, colors } = useTheme();
  return (
    <Pressable {...({ href } as object)} accessibilityRole="link" accessibilityLabel="REF·DB home" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        aria-hidden
        style={{ width: 26, height: 14, borderWidth: 2, borderColor: colors.brand.default.default.fg, borderRadius: 3, justifyContent: 'center' }}
      >
        <View style={{ position: 'absolute', right: -6, top: 2, width: 4, height: 6, backgroundColor: colors.brand.default.default.fg, borderRadius: 1 }} />
      </View>
      <RNText style={{ fontFamily: MONO, fontWeight: '600', fontSize: 19, letterSpacing: 2, color: scheme.text.primary }}>
        REF<RNText style={{ color: colors.brand.default.default.fg }}>·</RNText>DB
      </RNText>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Search (Pagefind)

type Hit = { url: string; title: string; excerpt: string; section?: string };
type Pagefind = {
  options(o: object): Promise<void>;
  debouncedSearch(q: string, o?: object, ms?: number): Promise<{ results: { data(): Promise<PagefindData> }[] } | null>;
};
type PagefindData = {
  url: string;
  meta: { title?: string };
  excerpt: string;
  sub_results?: { url: string; title: string; excerpt: string }[];
};

let pagefind: Promise<Pagefind> | null = null;
const loadPagefind = (base: string) =>
  (pagefind ??= import(/* @vite-ignore */ `${base}pagefind/pagefind.js`).then(async (pf: Pagefind) => {
    await pf.options({ baseUrl: base, excerptLength: 22 });
    return pf;
  }));

/** Pagefind excerpts mark matches with <mark>; render those as highlighted runs, everything else as text. */
function Excerpt({ html }: { html: string }) {
  const { scheme, colors } = useTheme();
  const parts = html.split(/<mark>|<\/mark>/);
  const decode = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return (
    <RNText numberOfLines={2} style={{ fontSize: 13, lineHeight: 18, color: scheme.text.description }}>
      {parts.map((p, i) =>
        i % 2 ? (
          <RNText key={i} style={{ color: colors.brand.default.default.fg, fontWeight: '600' }}>
            {decode(p)}
          </RNText>
        ) : (
          decode(p)
        ),
      )}
    </RNText>
  );
}

function SearchDialog({ base, open, onClose }: { base: string; open: boolean; onClose: () => void }) {
  const { scheme, colors, spacing } = useTheme();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    // Cast's Input has no autoFocus prop; focus the field once the modal has mounted.
    const t = setTimeout(() => document.querySelector<HTMLInputElement>('[data-site-search] input')?.focus(), 30);
    loadPagefind(base).catch(() => setFailed(true));
    return () => clearTimeout(t);
  }, [open, base]);

  useEffect(() => {
    const term = q.trim();
    const n = ++seq.current;
    if (!term) {
      setHits([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    loadPagefind(base)
      .then(async (pf) => {
        const r = await pf.debouncedSearch(term, {}, 150);
        if (!r || n !== seq.current) return;
        const data = await Promise.all(r.results.slice(0, 8).map((x) => x.data()));
        if (n !== seq.current) return;
        setHits(
          data.map((d) => {
            const sub = d.sub_results?.find((s) => s.url !== d.url);
            return { url: sub?.url ?? d.url, title: d.meta.title ?? d.url, section: sub?.title, excerpt: sub?.excerpt ?? d.excerpt };
          }),
        );
        setSel(0);
        setBusy(false);
      })
      .catch(() => {
        setFailed(true);
        setBusy(false);
      });
  }, [q, base]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSel((s) => Math.min(s + 1, hits.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter' && hits[sel] && (e.target as HTMLElement).tagName === 'INPUT') {
        e.preventDefault();
        window.location.assign(hits[sel].url);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hits, sel]);

  if (!open) return null;
  const surface = scheme.surface.overlay;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close search"
        style={{ flex: 1, backgroundColor: 'rgba(2, 4, 10, 0.6)', alignItems: 'center', paddingTop: '10vh' as never, paddingHorizontal: spacing.md }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          accessibilityRole={'dialog' as never}
          accessibilityLabel="Search"
          {...({ 'aria-modal': true } as object)}
          style={{
            width: '100%',
            maxWidth: 640,
            maxHeight: '75vh' as never,
            backgroundColor: surface.bg,
            borderWidth: 1,
            borderColor: surface.border,
            borderRadius: 12,
            padding: spacing.md,
            gap: spacing.sm,
            cursor: 'auto' as never,
          }}
        >
          <View {...({ dataSet: { siteSearch: '' } } as object)}>
            <Input
              placeholder="Search topics, materials, standards, equations…"
              value={q}
              onChangeText={setQ}
              leadingIcon="search"
              trailingIcon={busy ? <Spinner size="small" /> : undefined}
              accessibilityLabel="Search the site"
              autoCapitalize="none"
              size="large"
            />
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 2 }}>
            {failed ? (
              <Text type="body-md" color={scheme.text.description} style={{ padding: spacing.sm }}>
                Search is only available on the built site (run npm run build, then npm run preview).
              </Text>
            ) : q.trim() && !busy && hits.length === 0 ? (
              <Text type="body-md" color={scheme.text.description} style={{ padding: spacing.sm }}>
                {`No results for “${q.trim()}”.`}
              </Text>
            ) : null}
            {hits.map((h, i) => (
              <Pressable
                key={h.url}
                {...({ href: h.url } as object)}
                accessibilityRole="link"
                onHoverIn={() => setSel(i)}
                style={{
                  padding: spacing.sm,
                  borderRadius: 8,
                  gap: 2,
                  backgroundColor: i === sel ? scheme.list.item.selected.bg : 'transparent',
                }}
              >
                <Row gap={6}>
                  <Text type="label-md" color={i === sel ? scheme.list.item.selected.fg : scheme.text.primary}>
                    {h.title}
                  </Text>
                  {h.section ? (
                    <>
                      <Icon name="chevron_right" size="small" color={scheme.text.description} />
                      <Text type="body-sm" color={scheme.text.description} numberOfLines={1} style={{ flexShrink: 1 }}>
                        {h.section}
                      </Text>
                    </>
                  ) : null}
                </Row>
                <Excerpt html={h.excerpt} />
              </Pressable>
            ))}
          </ScrollView>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text type="caption" color={scheme.text.description}>
              ↑ ↓ to choose · Enter to open · Esc to close
            </Text>
            <Text type="caption" color={colors.neutral.subtle.default.fg}>
              Search by Pagefind
            </Text>
          </Row>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SearchButton({ onPress }: { onPress: () => void }) {
  const { scheme, colors, spacing } = useTheme();
  const n = colors.neutral.default;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Search (press / or Ctrl+K)"
      {...({ dataSet: { searchButton: '' } } as object)}
      style={(s) => {
        const c = (s as { hovered?: boolean }).hovered ? n.hover : n.default;
        return {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          height: 40,
          paddingHorizontal: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: scheme.surface.base,
          minWidth: 0,
        };
      }}
    >
      <Icon name="search" size="default" color={scheme.text.description} />
      <Text type="body-md" color={scheme.text.description} style={{ flex: 1 }} numberOfLines={1}>
        Search
      </Text>
      <View {...({ dataSet: { kbd: '' } } as object)} style={{ flexDirection: 'row', gap: 4 }}>
        {['Ctrl', 'K'].map((k) => (
          <View key={k} style={{ borderWidth: 1, borderColor: scheme.list.separator, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
            <Text type="caption" color={scheme.text.description}>
              {k}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function Header({ base, githubHref, nav }: Props) {
  const { spacing } = useTheme();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [light, setLight] = useState(false);

  useEffect(() => setLight(document.documentElement.dataset.theme === 'light'), []);
  const toggleTheme = useCallback(() => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('refdb-theme', next);
    } catch {}
    setLight(next === 'light');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName) || (e.target as HTMLElement).isContentEditable;
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setSearch(true);
      }
    };
    document.addEventListener('keydown', onKey);
    // Anything on the page can open search, e.g. the home page's search card.
    const onOpen = () => setSearch(true);
    window.addEventListener('refdb:search', onOpen);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('refdb:search', onOpen);
    };
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, height: 60, paddingHorizontal: spacing.md }}>
      <View {...({ dataSet: { only: 'narrow' } } as object)}>
        <IconButton icon="menu" label="Open topics menu" onPress={() => setMenu(true)} />
      </View>
      <Logo href={base} />
      <View style={{ flex: 1, alignItems: 'flex-end' }} {...({ dataSet: { searchSlot: '' } } as object)}>
        <SearchButton onPress={() => setSearch(true)} />
      </View>
      <Row gap={4}>
        <IconButton icon={light ? 'dark_mode' : 'light_mode'} label={light ? 'Switch to dark mode' : 'Switch to light mode'} onPress={toggleTheme} />
        <View {...({ dataSet: { only: 'wide' } } as object)}>
          <IconButton icon="code" label="Source on GitHub" href={githubHref} />
        </View>
      </Row>
      <Drawer open={menu} onClose={() => setMenu(false)} anchor="left" title="Topics">
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
          <SideNavTree {...nav} onNavigate={() => setMenu(false)} />
        </ScrollView>
      </Drawer>
      <SearchDialog base={base} open={search} onClose={() => setSearch(false)} />
    </View>
  );
}

export default function SiteHeader(props: Props) {
  return (
    <CastRoot>
      <Header {...props} />
    </CastRoot>
  );
}
