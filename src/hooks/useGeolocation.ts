import { useEffect, useState } from 'react'

interface GeoState {
  lat: number | null
  lng: number | null
  status: 'idle' | 'loading' | 'granted' | 'denied' | 'unsupported'
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ lat: null, lng: null, status: 'idle' })

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState({ lat: null, lng: null, status: 'unsupported' })
      return
    }
    setState((s) => ({ ...s, status: 'loading' }))
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ lat: pos.coords.latitude, lng: pos.coords.longitude, status: 'granted' }),
      () => setState({ lat: null, lng: null, status: 'denied' }),
      { timeout: 8000 },
    )
  }, [])

  return state
}
