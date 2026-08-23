export const THREE_D_ENTER_ZOOM = 17;
export const THREE_D_EXIT_ZOOM = 16.5;
export const ZOOM_DEBOUNCE_MS = 140;

export function resolveThreeDState(current: boolean, zoom: number): boolean {
  if (current) return zoom < THREE_D_EXIT_ZOOM ? false : true;
  return zoom >= THREE_D_ENTER_ZOOM;
}

export function cameraTransitionDuration(reducedMotion: boolean): number {
  return reducedMotion ? 0 : 320;
}

export function transitionMapTilt(
  map: google.maps.Map,
  targetTilt: number,
  reducedMotion: boolean,
): () => void {
  const startTilt = map.getTilt() ?? 0;
  const heading = map.getHeading() ?? 0;
  const duration = cameraTransitionDuration(reducedMotion);
  if (duration === 0 || Math.abs(startTilt - targetTilt) < 0.5) {
    map.moveCamera({ tilt: targetTilt, heading });
    return () => undefined;
  }

  let frame = 0;
  const startedAt = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    map.moveCamera({ tilt: startTilt + (targetTilt - startTilt) * eased, heading });
    if (progress < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

