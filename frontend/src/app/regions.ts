/*
 * Historical Artemis III candidate landing regions (NASA, August 2022).
 *
 * Every value carries its basis and source. Nothing here is invented: when a value
 * could not be verified it is `null` with basis 'unknown'. See docs/TARGET_REGIONS.md.
 *
 * These are real geographic candidate regions for a crewed landing. They are NOT
 * detected water-ice deposits, and they are not NASA's current shortlist (NASA
 * published a revised set of nine regions on 28 October 2024).
 */

/** How a value is known. */
export type Basis =
  | 'measured'   // an instrument observation
  | 'derived'    // computed from measurements (e.g. a mosaic's center and footprint)
  | 'reported'   // an official statement (e.g. a region's name or NASA's 2024 list)
  | 'assumed'    // a simplification this game makes
  | 'unknown'    // not available from a verified source
  | 'fictional'  // part of the game's story

export const basisLabel: Record<Basis, string> = {
  measured: 'Measured', derived: 'Derived from data', reported: 'Official statement',
  assumed: 'Game assumption', unknown: 'Unknown', fictional: 'Fiction',
}

export interface Source { org: string; title: string; url: string; date?: string; version?: string }
export interface Fact<T> { value: T | null; basis: Basis; source?: Source; note?: string }
/** Planetocentric latitude and east-positive longitude in degrees (−180…180). */
export interface LatLon { lat: number; lon: number }
export interface Bounds { minLat: number; maxLat: number; minLon: number; maxLon: number }

export const sources = {
  nasa2022: {
    org: 'NASA', title: 'NASA Identifies Candidate Regions for Landing Next Americans on Moon (RELEASE 22-089)',
    url: 'https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-Moon/', date: '2022-08-19',
  },
  nasa2024: {
    org: 'NASA', title: 'NASA Provides Update on Artemis III Moon Landing Regions (RELEASE 24-136)',
    url: 'https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/', date: '2024-10-28',
  },
  svs5013: {
    org: 'NASA Scientific Visualization Studio', title: 'Artemis III Landing Region Candidates (SVS 5013)',
    url: 'https://svs.gsfc.nasa.gov/5013/', date: '2022-08-19',
  },
  svs4720: {
    org: 'NASA Scientific Visualization Studio', title: 'CGI Moon Kit (SVS 4720): lroc_color_2k.jpg, from the LROC WAC color mosaic with LOLA albedo filling the poles',
    url: 'https://svs.gsfc.nasa.gov/4720/', version: '2025 color map, 2048×1024',
  },
  usgsGrids: {
    org: 'USGS (McClernan, 2024)', title: 'LGRS Artemis III Candidate Landing Site Navigational Grids in ACC format',
    url: 'https://doi.org/10.5066/P13FD9ZD', date: '2024',
  },
} satisfies Record<string, Source>

const lroc = (product: string, title: string): Source => ({
  org: 'LROC team, Arizona State University (NASA Lunar Reconnaissance Orbiter)',
  title: `${product}: “${title}” (Henriksen et al., 2023)`,
  url: `https://data.lroc.im-ldi.com/lroc/view_rdr/${product}`,
  version: 'LRO-L-LROC-5-RDR-V1.0',
})

/**
 * LROC Narrow Angle Camera mosaics made for the Artemis III candidate regions.
 * Center and bounds are the values LROC publishes for each mosaic. The mosaic can be
 * larger than the ~15 × 15 km region itself.
 */
export interface Footprint {
  id: string
  center: Fact<LatLon>
  bounds: Fact<Bounds>
  regionIds: RegionId[]
}

const footprint = (id: string, product: string, title: string, center: LatLon, bounds: Bounds, regionIds: RegionId[], note?: string): Footprint => ({
  id, regionIds,
  center: { value: center, basis: 'derived', source: lroc(product, title), note: note ?? 'Center of the LROC mosaic of this region.' },
  bounds: { value: bounds, basis: 'derived', source: lroc(product, title), note: 'Extent of the LROC mosaic; it can be larger than the region.' },
})

export const footprints: Footprint[] = [
  footprint('faustini', 'NAC_ROI_FAUSTINILO1', 'Faustini Rim A low-Sun controlled NAC mosaic',
    { lat: -87.8, lon: 90.0 }, { minLat: -88.19, maxLat: -87.54, minLon: 79.51, maxLon: 100.49 }, ['faustini_rim_a']),
  footprint('shackleton_peak', 'NAC_ROI_SHKLTNPKLO1', 'Peak near Shackleton low-Sun controlled NAC mosaic',
    { lat: -88.8, lon: 124.7 }, { minLat: -89.17, maxLat: -88.44, minLon: 107.53, maxLon: 141.84 }, ['peak_near_shackleton']),
  footprint('de_gerlache_rim', 'NAC_ROI_DEGERRIMLO1', 'de Gerlache Rim low-Sun controlled NAC mosaic',
    { lat: -88.5, lon: -66.7 }, { minLat: -89.02, maxLat: -87.79, minLon: -83.18, maxLon: -41.31 }, ['de_gerlache_rim_1', 'de_gerlache_rim_2'],
    'Center of LROC’s “de Gerlache Rim” mosaic (published as 293.3° E). LROC does not say whether it shows Rim 1, Rim 2 or both.'),
  footprint('de_gerlache_kocher', 'NAC_ROI_DEGERKCHLO1', 'de Gerlache Kocher Massif low-Sun controlled NAC mosaic',
    { lat: -85.8, lon: -116.4 }, { minLat: -86.27, maxLat: -85.39, minLon: -122.59, maxLon: -110.48 }, ['de_gerlache_kocher_massif'],
    'Center of the LROC mosaic (published as 243.6° E).'),
  footprint('malapert', 'NAC_ROI_MALAPERTLO1', 'Malapert Massif low-Sun controlled NAC mosaic',
    { lat: -86.0, lon: 0.3 }, { minLat: -86.33, maxLat: -85.63, minLon: -5.66, maxLon: 5.15 }, ['malapert_massif']),
  footprint('nobile_2', 'NAC_ROI_NOBILE02LO1', 'Nobile Rim 2 low-Sun controlled NAC mosaic',
    { lat: -83.9, lon: 58.7 }, { minLat: -84.40, maxLat: -83.50, minLon: 54.46, maxLon: 63.02 }, ['nobile_rim_2']),
  footprint('amundsen', 'NAC_ROI_AMUNDRIMLO1', 'Amundsen Rim low-Sun controlled NAC mosaic',
    { lat: -84.2, lon: 69.3 }, { minLat: -84.65, maxLat: -83.80, minLon: 65.10, maxLon: 73.51 }, ['amundsen_rim']),
]

export type RegionId =
  | 'faustini_rim_a' | 'peak_near_shackleton' | 'connecting_ridge' | 'connecting_ridge_extension'
  | 'de_gerlache_rim_1' | 'de_gerlache_rim_2' | 'de_gerlache_kocher_massif' | 'haworth' | 'malapert_massif'
  | 'leibnitz_beta_plateau' | 'nobile_rim_1' | 'nobile_rim_2' | 'amundsen_rim'

export interface CandidateRegion {
  id: RegionId
  /** Official name as written in NASA's 2022 release. */
  name: string
  /** Plain-language description built only from the name and verified position. */
  summary: string
  footprintId: string | null
  /** Whether a region with this exact name appears in NASA's October 2024 list of nine. */
  in2024List: Fact<boolean>
}

const position = 'Position not yet verified: no published center was available to us. The authoritative geometry is the USGS 2024 grid release.'
const in2024 = (listed: boolean): Fact<boolean> => ({
  value: listed, basis: 'reported', source: sources.nasa2024,
  note: listed ? 'A region with this name appears in NASA’s October 2024 list of nine.'
    : 'No region with this name appears in NASA’s October 2024 list. NASA did not say whether regions were renamed or dropped.',
})

/** The 13 regions, in the order NASA listed them in August 2022. */
export const regions: CandidateRegion[] = [
  { id: 'faustini_rim_a', name: 'Faustini Rim A', footprintId: 'faustini', in2024List: in2024(false),
    summary: 'On the rim of Faustini crater, about 2 degrees of latitude from the south pole.' },
  { id: 'peak_near_shackleton', name: 'Peak Near Shackleton', footprintId: 'shackleton_peak', in2024List: in2024(false),
    summary: 'High ground beside Shackleton crater, about 1 degree of latitude from the south pole.' },
  { id: 'connecting_ridge', name: 'Connecting Ridge', footprintId: null, in2024List: in2024(false), summary: position },
  { id: 'connecting_ridge_extension', name: 'Connecting Ridge Extension', footprintId: null, in2024List: in2024(false), summary: position },
  { id: 'de_gerlache_rim_1', name: 'de Gerlache Rim 1', footprintId: 'de_gerlache_rim', in2024List: in2024(false),
    summary: 'On the rim of de Gerlache crater. LROC’s de Gerlache Rim mosaic covers this area, but we could not confirm the exact outline of Rim 1.' },
  { id: 'de_gerlache_rim_2', name: 'de Gerlache Rim 2', footprintId: 'de_gerlache_rim', in2024List: in2024(true),
    summary: 'On the rim of de Gerlache crater. LROC’s de Gerlache Rim mosaic covers this area, but we could not confirm the exact outline of Rim 2.' },
  { id: 'de_gerlache_kocher_massif', name: 'de Gerlache-Kocher Massif', footprintId: 'de_gerlache_kocher', in2024List: in2024(false),
    summary: 'A massif (a large mountain block) named for the nearby de Gerlache and Kocher craters.' },
  { id: 'haworth', name: 'Haworth', footprintId: null, in2024List: in2024(true), summary: position },
  { id: 'malapert_massif', name: 'Malapert Massif', footprintId: 'malapert', in2024List: in2024(true),
    summary: 'A massif (a large mountain block) near Malapert crater, about 4 degrees of latitude from the south pole.' },
  { id: 'leibnitz_beta_plateau', name: 'Leibnitz Beta Plateau', footprintId: null, in2024List: in2024(false), summary: position },
  { id: 'nobile_rim_1', name: 'Nobile Rim 1', footprintId: null, in2024List: in2024(true), summary: position },
  { id: 'nobile_rim_2', name: 'Nobile Rim 2', footprintId: 'nobile_2', in2024List: in2024(true),
    summary: 'On the rim of Nobile crater, about 6 degrees of latitude from the south pole.' },
  { id: 'amundsen_rim', name: 'Amundsen Rim', footprintId: 'amundsen', in2024List: in2024(false),
    summary: 'On the rim of Amundsen crater, about 6 degrees of latitude from the south pole.' },
]

/** Facts NASA stated for all 13 regions together (RELEASE 22-089). */
export const regionFacts: Fact<string>[] = [
  { value: 'Each region is approximately 15 by 15 kilometers.', basis: 'reported', source: sources.nasa2022 },
  { value: 'Each region is located within six degrees of latitude of the lunar South Pole.', basis: 'reported', source: sources.nasa2022 },
  { value: 'NASA evaluated regions on terrain slope, ease of communications with Earth, and lighting conditions.', basis: 'reported', source: sources.nasa2022 },
  { value: 'All 13 regions contain sites that provide continuous access to sunlight throughout a 6.5-day period.', basis: 'reported', source: sources.nasa2022 },
  { value: 'Specific landing sites are tightly coupled to the timing of the launch window.', basis: 'reported', source: sources.nasa2022 },
]

/** Per-region properties we looked for and could not verify. Shown as unknown, never estimated. */
export const unknownProperties: Fact<string>[] = [
  { value: null, basis: 'unknown', note: 'Illumination statistics for each region (e.g. percent of time in sunlight).' },
  { value: null, basis: 'unknown', note: 'Earth visibility (direct-to-Earth communication windows) for each region.' },
  { value: null, basis: 'unknown', note: 'Terrain slope and elevation for each region.' },
  { value: null, basis: 'unknown', note: 'Measured water-ice abundance in or near each region.' },
]

/**
 * Suggested first target. Chosen only on data completeness: it has its own verified LROC
 * position and its name is on NASA's 2024 list. It does not observe better in the game.
 */
export const recommended = {
  id: 'malapert_massif' as RegionId,
  why: 'It’s one of the few regions with its own verified position from an LROC mosaic and a place on NASA’s 2024 shortlist, so you can see exactly where you’re pointing. Every region runs the same simulation.',
}

export const regionById = (id: string | null | undefined) => regions.find(region => region.id === id)
export const footprintById = (id: string | null | undefined) => footprints.find(item => item.id === id)

export function formatLatLon({ lat, lon }: LatLon) {
  const ns = `${Math.abs(lat).toFixed(1)}° ${lat < 0 ? 'S' : 'N'}`
  const ew = `${Math.abs(lon).toFixed(1)}° ${lon < 0 ? 'W' : 'E'}`
  return `${ns}, ${ew}`
}

/** Kilometers from the south pole along the surface (mean lunar radius 1737.4 km, IAU). */
export const kmFromPole = (lat: number) => Math.round((90 + lat) * Math.PI / 180 * 1737.4)
