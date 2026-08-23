# Google Maps manual configuration

The Command Center lazy-loads Maps JavaScript API with `AdvancedMarkerElement` and deck.gl `ScatterplotLayer`/`GeoJsonLayer`. It renders only approved administrative centroids or boundaries, never precise citizen pins. Without configuration, the accessible ranked list remains available.

No API was enabled, key or Map ID created, or billing modified. An owner must:

1. Approve billing and enable only Maps JavaScript API in `civicbridge-1`.
2. Create a browser key restricted to the exact production HTTPS hostname and approved local origins, with an API restriction allowing only Maps JavaScript API.
3. Create a vector Map ID and apply restrained CivicBridge-aligned styling.
4. Set Cloud Run runtime variables on `civicbridge-web`:

```env
NEXT_PUBLIC_GOOGLE_MAPS_ENABLED=true
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=RESTRICTED_BROWSER_KEY
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=VECTOR_MAP_ID
```

`/api/runtime-config/maps` returns only this explicit allowlist. Backend URLs, Google credentials, server keys, and arbitrary environment variables are excluded. The browser key is public by design and must have strict referrer/API restrictions.
