import * as THREE from 'three'
import type { Bounds, LatLon } from '../app/regions'

/*
 * Geographic placement on a THREE.SphereGeometry textured with an equirectangular map
 * centered on 0° longitude (NASA SVS CGI Moon Kit): u = (lon + 180) / 360,
 * v = (lat + 90) / 180. The function below is the exact inverse of the
 * SphereGeometry vertex layout, so a marker lands on the texel for its lat/lon.
 * tests/frontend/geo.test.ts checks this against the geometry itself.
 */
export function latLonToVector({ lat, lon }: LatLon, radius = 1) {
  const phi = THREE.MathUtils.degToRad(lat)
  const lambda = THREE.MathUtils.degToRad(lon)
  return new THREE.Vector3(
    radius * Math.cos(phi) * Math.cos(lambda),
    radius * Math.sin(phi),
    -radius * Math.cos(phi) * Math.sin(lambda),
  )
}

/** Texture coordinate the equirectangular map uses for a lat/lon. */
export const latLonToUv = ({ lat, lon }: LatLon) => ({ u: (lon + 180) / 360, v: (lat + 90) / 180 })

/** Outline of a lat/lon box, sampled densely so it follows the curved surface. */
export function boundsOutline(b: Bounds, radius = 1.0015, steps = 24) {
  const points: THREE.Vector3[] = []
  const edge = (from: LatLon, to: LatLon) => {
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      points.push(latLonToVector({ lat: from.lat + (to.lat - from.lat) * t, lon: from.lon + (to.lon - from.lon) * t }, radius))
    }
  }
  edge({ lat: b.minLat, lon: b.minLon }, { lat: b.minLat, lon: b.maxLon })
  edge({ lat: b.minLat, lon: b.maxLon }, { lat: b.maxLat, lon: b.maxLon })
  edge({ lat: b.maxLat, lon: b.maxLon }, { lat: b.maxLat, lon: b.minLon })
  edge({ lat: b.maxLat, lon: b.minLon }, { lat: b.minLat, lon: b.minLon })
  points.push(points[0].clone())
  return points
}
