/* ============================================================
   useHoldRepeat — press-and-hold repeat for a button. A press
   fires one step straight away; holding past HOLD_DELAY_MS then
   repeats it, speeding up from SLOW_RATE to FAST_RATE per second
   over RAMP_MS. Keyboard activation (Enter / Space) is a plain click.
   ============================================================ */
import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

export const HOLD_DELAY_MS = 400;
export const RAMP_MS = 2500;
const SLOW_RATE = 5;
const FAST_RATE = 30;

/** Time to wait before the next repeat, `held` ms into the repeating. */
export function repeatInterval(held: number): number {
  const t = Math.min(held / RAMP_MS, 1);
  return 1000 / (SLOW_RATE + (FAST_RATE - SLOW_RATE) * t);
}

export interface HoldRepeatHandlers {
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onPointerLeave: () => void;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLButtonElement>) => void;
}

/** Handlers to spread on a button. `disabled` also ends a hold in progress. */
export function useHoldRepeat(step: () => void, disabled: boolean): HoldRepeatHandlers {
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const onPointerDown = useCallback((e: PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    stop();
    stepRef.current();
    let held = 0;
    const tick = () => {
      stepRef.current();
      const wait = repeatInterval(held);
      held += wait;
      timer.current = setTimeout(tick, wait);
    };
    timer.current = setTimeout(tick, HOLD_DELAY_MS);
  }, [stop]);

  // A pointer press already stepped in onPointerDown; only a click with no
  // pointer behind it (detail 0: keyboard) still needs to.
  const onClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) stepRef.current();
  }, []);

  // Long-press on touch would otherwise open the context menu mid-hold.
  const onContextMenu = useCallback((e: MouseEvent<HTMLButtonElement>) => e.preventDefault(), []);

  useEffect(() => { if (disabled) stop(); }, [disabled, stop]);
  useEffect(() => stop, [stop]);

  return { onPointerDown, onPointerUp: stop, onPointerCancel: stop, onPointerLeave: stop, onClick, onContextMenu };
}
