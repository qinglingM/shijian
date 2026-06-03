import { POI_PROVIDER } from '@/lib/env'
import { createAmapPoiProvider } from '@/lib/poi/amap-provider'
import { createEdgePoiProvider } from '@/lib/poi/edge-provider'
import { MockPoiProvider } from '@/lib/poi/mock-provider'
import type { PoiProvider } from '@/lib/poi/types'

export type { PoiCandidate, PoiProvider, PoiSearchParams, PoiSource } from '@/lib/poi/types'

let _provider: PoiProvider | null = null

export function getPoiProvider(): PoiProvider {
  if (_provider) return _provider
  switch (POI_PROVIDER) {
    case 'amap':
      _provider = createAmapPoiProvider()
      return _provider
    case 'edge':
      _provider = createEdgePoiProvider()
      return _provider
    case 'mock':
    default:
      _provider = new MockPoiProvider()
      return _provider
  }
}
