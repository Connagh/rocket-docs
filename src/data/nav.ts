// The navigation model the shell renders: the zone plan (zones.mjs) turned into plain-language sections.
// Zone numbers stay in zones.mjs as the link to REF·DB v1; readers see topic names grouped by design phase.
import { getCollection } from 'astro:content';
import { PHASES, BRIEFING, route, hrefOf, toSlug } from './zones.mjs';

export type NavLink = {
  label: string;
  href: string;
  /** Not rebuilt yet: opens the v1 archive at that topic. */
  archived: boolean;
  current: boolean;
};
export type NavSection = {
  key: string;
  label: string;
  /** One line on what the phase is for. */
  summary: string;
  icon: string;
  /** Phase accent colour per mode, carried over from v1. */
  accent: { dark: string; light: string };
  links: NavLink[];
};
export type PageLink = { label: string; href: string; section: string };

/** Material Symbols name for each phase. */
const PHASE_ICON: Record<string, string> = {
  orient: 'explore',
  select: 'category',
  size: 'straighten',
  verify: 'verified',
  detail: 'architecture',
  feature: 'build',
  make: 'precision_manufacturing',
  spec: 'gavel',
};

const PHASE_LABEL: Record<string, string> = {
  orient: 'Orient',
  select: 'Select',
  size: 'Size',
  verify: 'Verify',
  detail: 'Detail',
  feature: 'Features',
  make: 'Make',
  spec: 'Specify',
};

/** Readable names for zones that only exist in the v1 archive so far (v1 labels are all caps). */
const ARCHIVE_LABEL: Record<string, string> = {
  reqs: 'Requirements & ICD',
  duty: 'Duty cycle',
  risk: 'Criticality',
  metal: 'Metallurgy',
  sandbox: 'Sandbox',
  worked: 'Worked example',
  read: 'Reading list',
  trade: 'Trade study',
  sheet: 'Datasheet',
  cryo: 'Cryogenic materials',
  density: 'Density',
  plastics: 'Plastics',
  elast: 'Silicone & polyurethane',
  coat: 'Coatings',
  access: 'Envelope & access',
  process: 'Process & additive manufacturing',
  cost: 'Cost',
  weld: 'Welding',
  ndt: 'NDT',
  leak: 'Leak testing',
  certs: 'Certificates & traceability',
  standards: 'Standards',
  guides: 'Design guides',
  drawing: 'Drawing frame & notes',
  release: 'Revision & sign-off',
  export: 'Archive & export',
};

const base = import.meta.env.BASE_URL;

/** Titles of every page in the collection, by slug ('' is home). */
async function titles(): Promise<Map<string, string>> {
  const docs = await getCollection('docs');
  return new Map(docs.map((d) => [d.id === 'index' ? '' : d.id, d.data.title]));
}

export async function navFor(pathname: string) {
  const here = toSlug(pathname, base);
  const t = await titles();
  const items = route();
  const link = (item: (typeof items)[number]): NavLink => ({
    label: item.slug !== null ? (t.get(item.slug) ?? item.label) : (ARCHIVE_LABEL[item.key] ?? item.label),
    href: hrefOf(item, base),
    archived: item.slug === null,
    current: item.slug !== null && item.slug === here,
  });

  const start: NavLink[] = [
    { label: 'Overview', href: base, archived: false, current: here === '' },
    ...BRIEFING.map((b) => ({ label: t.get(b.slug) ?? b.label, href: `${base}${b.slug}/`, archived: false, current: here === b.slug })),
  ];

  const sections: NavSection[] = PHASES.map((p) => ({
    key: p.k,
    label: PHASE_LABEL[p.k],
    summary: p.sub,
    icon: PHASE_ICON[p.k],
    accent: { dark: p.dark, light: p.light },
    // The topic "Overview" zone is the home page, already listed under Start here.
    links: items.filter((z) => z.phase === p.k && z.slug !== '').map(link),
  }));

  // Previous / next follow the route through rebuilt pages only, in design order.
  const pages: PageLink[] = items
    .filter((z) => z.slug !== null && z.slug !== '')
    .map((z) => ({ label: t.get(z.slug!) ?? z.label, href: hrefOf(z, base), section: PHASE_LABEL[z.phase] }));
  const at = pages.findIndex((p) => toSlug(p.href, base) === here);
  const currentSection = sections.find((s) => s.links.some((l) => l.current));

  return {
    start,
    sections,
    currentSection: currentSection?.key ?? null,
    prev: at > 0 ? pages[at - 1] : null,
    next: at >= 0 && at < pages.length - 1 ? pages[at + 1] : null,
    sectionLabel: currentSection ? `${currentSection.label}: ${currentSection.summary.toLowerCase()}` : null,
  };
}

export const phaseLabel = (k: string) => PHASE_LABEL[k];
export const phaseIcon = (k: string) => PHASE_ICON[k];
