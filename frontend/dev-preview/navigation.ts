// The preview renders presentation components only. No router or auth session is supplied.
export function usePathname() { return '/hotspots'; }
export function useRouter(): never { throw new Error('Query/route containers do not belong in the isolated preview.'); }
export function useSearchParams(): never { throw new Error('Query/route containers do not belong in the isolated preview.'); }
