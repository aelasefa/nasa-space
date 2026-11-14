import * as THREE from 'three'
import { expect, it } from 'vitest'
import { latLonToUv, latLonToVector } from '../../src/target/geo'

// A marker must land on the texel the NASA equirectangular map shows for its lat/lon.
// Compare against THREE.SphereGeometry's own vertices and UVs on a 1° grid.
it('places lat/lon exactly where SphereGeometry maps the equirectangular texture', () => {
  const sphere = new THREE.SphereGeometry(1, 360, 180)
  const pos = sphere.attributes.position
  const uv = sphere.attributes.uv
  const samples = [[-87, 90], [-89, 125], [-86, 0], [-84, 69], [-88, -67], [-86, -116], [0, 0], [45, -120]] as const
  for (const [lat, lon] of samples) {
    const ix = lon + 180
    const iy = 90 - lat
    const index = iy * 361 + ix
    const vertex = new THREE.Vector3().fromBufferAttribute(pos, index)
    // Geometry buffers are float32, so compare to float32 precision (~1e-7).
    expect(latLonToVector({ lat, lon }).distanceTo(vertex)).toBeLessThan(1e-6)
    const expected = latLonToUv({ lat, lon })
    expect(uv.getX(index)).toBeCloseTo(expected.u, 6)
    expect(uv.getY(index)).toBeCloseTo(expected.v, 6)
  }
})
