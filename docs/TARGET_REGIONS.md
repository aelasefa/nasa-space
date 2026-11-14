# Observation target: NASA's 13 historical Artemis III candidate regions

> **Historical dataset.** On 19 August 2022 NASA named 13 candidate landing regions for
> Artemis III. On 28 October 2024 NASA published a revised set of nine. LUNA‑01 uses the
> 2022 set as a historical dataset. These are candidate *landing regions*, not detected
> water-ice deposits.

LUNA‑01 is an orbiter. Choosing a region means choosing where the instrument points
during the shadow pass, not where to land.

## Rules this data follows

- Nothing is invented. A value we could not verify is `null` with basis `unknown`.
- Every value records its **basis**:

| Basis | Meaning | Example |
|---|---|---|
| `measured` | Instrument observation | (none per region yet) |
| `derived` | Computed from measurements | Center and footprint of an LROC NAC mosaic |
| `reported` | Official statement, not a measurement | A region's name; whether it is on NASA's 2024 list |
| `assumed` | A game simplification | The globe is lit from the viewer |
| `unknown` | Not available from a verified source | Per-region illumination statistics |
| `fictional` | Part of the story | The "ice signature" premise, Mission Control dialogue |

Data and types live in `frontend/src/app/regions.ts`. Players see it in the
"Science behind this" panel on the target screen.

## Sources

| Source | Used for |
|---|---|
| NASA RELEASE 22‑089, 19 Aug 2022 ([link](https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-Moon/)) | The 13 names and their order. Region facts: ~15 × 15 km, within 6° of the pole, selection on terrain slope, Earth communications and lighting, sites with continuous sunlight for 6.5 days |
| NASA RELEASE 24‑136, 28 Oct 2024 ([link](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/)) | Which 2022 names reappear in the nine: Haworth, Malapert Massif, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2. NASA did not say whether the others were renamed or dropped. |
| NASA SVS 5013 ([link](https://svs.gsfc.nasa.gov/5013/)) | Confirms the 13 names. It has videos only, with no coordinates or shapefiles. |
| LROC NAC ROI mosaics, PDS `LRO-L-LROC-5-RDR-V1.0` (Henriksen et al., 2023) | Center and bounding box for 7 regions (table below) |
| NASA SVS 4720 CGI Moon Kit ([link](https://svs.gsfc.nasa.gov/4720/)) | Globe texture `lroc_color_2k.jpg`. NASA: "optimized for aesthetics, not science." |
| USGS LGRS grids, McClernan 2024, [doi:10.5066/P13FD9ZD](https://doi.org/10.5066/P13FD9ZD) | Authoritative geometry for all 13. **Not yet ingested** (see Limitations). |

### Positions used (LROC mosaic metadata)

| Region | LROC product | Center | Mosaic extent (lat; lon, °E) |
|---|---|---|---|
| Faustini Rim A | NAC_ROI_FAUSTINILO1 | 87.8° S, 90.0° E | −88.19…−87.54; 79.51…100.49 |
| Peak Near Shackleton | NAC_ROI_SHKLTNPKLO1 | 88.8° S, 124.7° E | −89.17…−88.44; 107.53…141.84 |
| de Gerlache Rim (1 / 2, not distinguished) | NAC_ROI_DEGERRIMLO1 | 88.5° S, 66.7° W (293.3° E) | −89.02…−87.79; −83.18…−41.31 |
| de Gerlache-Kocher Massif | NAC_ROI_DEGERKCHLO1 | 85.8° S, 116.4° W (243.6° E) | −86.27…−85.39; −122.59…−110.48 |
| Malapert Massif | NAC_ROI_MALAPERTLO1 | 86.0° S, 0.3° E | −86.33…−85.63; −5.66…5.15 |
| Nobile Rim 2 | NAC_ROI_NOBILE02LO1 | 83.9° S, 58.7° E | −84.40…−83.50; 54.46…63.02 |
| Amundsen Rim | NAC_ROI_AMUNDRIMLO1 | 84.2° S, 69.3° E | −84.65…−83.80; 65.10…73.51 |

All seven products are 1 m/px "low-Sun controlled NAC mosaics". LROC describes each one as
"a preliminary mosaic of an Artemis III candidate landing site", with an estimated absolute
positional accuracy of 5–20 m. A mosaic can extend beyond the ~15 × 15 km region.

**No verified position:** Connecting Ridge, Connecting Ridge Extension, Haworth,
Leibnitz Beta Plateau, Nobile Rim 1. LROC has no mosaic for these (we searched the full
NAC_ROI catalog), and none of the papers we checked publishes region centers. They are
listed and selectable, marked "Position not yet verified", and have no marker.

## Placement validation

- `tests/frontend/geo.test.ts` checks the lat/lon → 3D mapping against
  `THREE.SphereGeometry`'s own vertices and UVs (to float32 precision). A marker therefore
  sits on the texel the NASA map shows for that coordinate.
- `tests/frontend/target.test.tsx` checks that each center lies inside its published LROC
  bounding box, that every center is within NASA's polar band, and that the 2022 and 2024
  name lists match the releases.
- We could **not** cross-check centers against the IAU/USGS Gazetteer: its search page
  returned the unfiltered catalog. Visually, the markers converge on the pole of the NASA map.

## Gameplay connection

- `Save.targetId` stores the choice. It is shown in the builder, at arrival in Mission
  Control, and in the debrief. Players can change it from the builder.
- **No target-dependent effects.** Engine v0.1.0 (`backend/src/domain`) models one fixed
  observation scenario. The UI says the choice "does not change power, data or score".

### Backend integration needed for real effects

Add to the engine, each with provenance:

1. `MissionInput.targetRegionId?: TargetRegionId` (type in `frontend/src/app/contracts.ts`).
2. Per-region scenario data derived from LOLA products:
   - illumination during the observation window: sunlit fraction and shadow duration, which drive the E1 energy budget;
   - direct-to-Earth visibility, which drives the downlink window;
   - slope and elevation where relevant.
3. Region geometry from the USGS LGRS release, to replace the LROC centers and fill in the five missing regions.
4. Engine tests that pin each per-region value to its source.

Until then, the frontend must not derive power, comms or science effects from the region.

## Known limitations

- **Imagery:** the 2k map (~5 km/px) blurs at close zoom, so zoom is capped at 1.6 lunar
  radii. Near the pole the equirectangular projection pinches into radial streaks. A
  polar-stereographic tile or the 8k map would fix this.
- **Terrain:** the globe is a smooth textured sphere. No elevation or relief is shown.
- **Lighting:** the globe is lit from the viewer so every region is visible. It is not the
  real illumination at the pole.
- **de Gerlache Rim 1 and 2:** they share one LROC footprint, and the marker asks the player
  which one they mean.
- **Background Moon:** the decorative Moon in the background (`src/space/scene.ts`) is
  procedural art. It is hidden on the target screen so it never competes with the real globe.
