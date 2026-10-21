import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOLD_DELAY_MS, RAMP_MS, repeatInterval, useHoldRepeat } from "../src/hooks/useHoldRepeat";

function Btn({ step, disabled = false }: { step: () => void; disabled?: boolean }) {
  const hold = useHoldRepeat(step, disabled);
  return <button {...hold} disabled={disabled}>go</button>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("repeatInterval", () => {
  it("speeds up from 5/sec to 30/sec over the ramp, then holds", () => {
    expect(repeatInterval(0)).toBeCloseTo(200);
    expect(repeatInterval(RAMP_MS)).toBeCloseTo(1000 / 30);
    expect(repeatInterval(RAMP_MS * 4)).toBeCloseTo(1000 / 30);
    expect(repeatInterval(RAMP_MS / 2)).toBeLessThan(repeatInterval(0));
  });
});

describe("useHoldRepeat", () => {
  it("steps once on press, and a following click does not step again", () => {
    const step = vi.fn();
    render(<Btn step={step} />);
    const b = screen.getByRole("button");
    fireEvent.pointerDown(b);
    fireEvent.pointerUp(b);
    fireEvent.click(b, { detail: 1 });
    expect(step).toHaveBeenCalledTimes(1);
  });

  it("steps on a keyboard click", () => {
    const step = vi.fn();
    render(<Btn step={step} />);
    fireEvent.click(screen.getByRole("button"), { detail: 0 });
    expect(step).toHaveBeenCalledTimes(1);
  });

  it("does not repeat before the hold delay", () => {
    const step = vi.fn();
    render(<Btn step={step} />);
    fireEvent.pointerDown(screen.getByRole("button"));
    act(() => { vi.advanceTimersByTime(HOLD_DELAY_MS - 1); });
    expect(step).toHaveBeenCalledTimes(1);
  });

  it("repeats while held, faster the longer it is held, and stops on release", () => {
    const step = vi.fn();
    render(<Btn step={step} />);
    const b = screen.getByRole("button");
    fireEvent.pointerDown(b);
    act(() => { vi.advanceTimersByTime(HOLD_DELAY_MS + 1000); });
    const early = step.mock.calls.length - 1;
    expect(early).toBeGreaterThan(1);
    step.mockClear();
    act(() => { vi.advanceTimersByTime(RAMP_MS); });
    const later = step.mock.calls.length;
    expect(later).toBeGreaterThan(early * 2);

    fireEvent.pointerUp(b);
    step.mockClear();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(step).not.toHaveBeenCalled();
  });

  it("stops when the pointer leaves or is cancelled", () => {
    const step = vi.fn();
    render(<Btn step={step} />);
    const b = screen.getByRole("button");
    for (const end of [fireEvent.pointerLeave, fireEvent.pointerCancel]) {
      fireEvent.pointerDown(b);
      end(b);
      step.mockClear();
      act(() => { vi.advanceTimersByTime(2000); });
      expect(step).not.toHaveBeenCalled();
    }
  });

  it("stops when the button becomes disabled mid-hold", () => {
    const step = vi.fn();
    const { rerender } = render(<Btn step={step} />);
    fireEvent.pointerDown(screen.getByRole("button"));
    act(() => { vi.advanceTimersByTime(HOLD_DELAY_MS + 300); });
    rerender(<Btn step={step} disabled />);
    step.mockClear();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(step).not.toHaveBeenCalled();
  });

  it("always calls the latest step callback", () => {
    const a = vi.fn(), b2 = vi.fn();
    const { rerender } = render(<Btn step={a} />);
    fireEvent.pointerDown(screen.getByRole("button"));
    rerender(<Btn step={b2} />);
    act(() => { vi.advanceTimersByTime(HOLD_DELAY_MS + 1); });
    expect(b2).toHaveBeenCalled();
    expect(a).toHaveBeenCalledTimes(1);
  });
});
