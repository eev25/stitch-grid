/* ============================================================
   icons.tsx — inline SVG icon set, 24x24 stroke icons.
   Exported as named React components.
   ============================================================ */
import type { ReactNode, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
  sw?: number;
}

function S({ size = 20, sw = 1.9, children, fill = "none", ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round"
      strokeLinejoin="round" {...rest}>{children}</svg>
  );
}

// Yarn-ball wordmark
export function Yarn(p: IconProps) {
  return (
    <S {...p} sw={1.7}>
      <circle cx="12" cy="12" r="9" />
      <path d="M5 9c3 2 11 2 14 0M4.5 14c4 2.5 10.5 2.5 15 0" />
      <path d="M9 3.6C6.5 6 6 11 8 20.4M15 3.6c2.5 2.4 3 7.4 1 16.8" />
    </S>
  );
}

// Modes
export function Paint(p: IconProps) {
  return (
    <S {...p}>
      <path d="M15.5 5.5 18.5 8.5" />
      <path d="M4 20s1-3.5 2.5-5L15 6.5a2 2 0 0 1 2.8 0l-.3-.3a2 2 0 0 1 0 2.8L9 17.5C7.5 19 4 20 4 20Z" />
    </S>
  );
}

export function Pan(p: IconProps) {
  return (
    <S {...p}>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 11V6a1.5 1.5 0 0 1 3 0v7c0 3.5-2 7-6 7-2.5 0-3.8-.8-5.2-2.6L4.5 14a1.6 1.6 0 0 1 2.5-2L9 14" />
    </S>
  );
}

export function Select(p: IconProps) {
  return (
    <S {...p}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" strokeDasharray="0.1 4.2" strokeWidth={2.4} />
    </S>
  );
}

// Tools
export function Pencil(p: IconProps) {
  return (
    <S {...p}>
      <path d="M16.5 4.5 19.5 7.5" />
      <path d="M4 20l1-4L16 5a1.8 1.8 0 0 1 2.6 0l.4.4a1.8 1.8 0 0 1 0 2.6L8 19l-4 1Z" />
    </S>
  );
}

export function Eraser(p: IconProps) {
  return (
    <S {...p}>
      <path d="M8.5 19.5 4 15a2 2 0 0 1 0-2.8l7-7a2 2 0 0 1 2.8 0l4.2 4.2a2 2 0 0 1 0 2.8l-7.7 7.3Z" />
      <path d="M9 20h11M8.5 12.5l5 5" />
    </S>
  );
}

export function Bucket(p: IconProps) {
  return (
    <S {...p}>
      <path d="M5.5 10.5 12 4l6.5 6.5a1.5 1.5 0 0 1 0 2.1L13 18a1.5 1.5 0 0 1-2.1 0l-5.4-5.4a1.5 1.5 0 0 1 0-2.1Z" />
      <path d="M9 7.5 5.5 10.5h13" />
      <path d="M20 15.5c1 1.5 1 3 0 3.8s-2 0-2-1.4 1-2.4 2-2.4Z" fill="currentColor" stroke="none" />
    </S>
  );
}

export function Eyedropper(p: IconProps) {
  return (
    <S {...p}>
      <path d="M19.5 4.5a2.1 2.1 0 0 0-3 0l-2.2 2.2-1-1-1.4 1.4 1 1L5.5 15.6c-.3.3-.5.7-.6 1.1L4 20l3.3-.9c.4-.1.8-.3 1.1-.6l6.5-6.4 1 1 1.4-1.4-1-1 2.2-2.2a2.1 2.1 0 0 0 0-3Z" />
    </S>
  );
}

export function Line(p: IconProps) {
  return (
    <S {...p}>
      <path d="M5 19 19 5" />
      <circle cx="5" cy="19" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1.8" fill="currentColor" stroke="none" />
    </S>
  );
}

export function Rect(p: IconProps) {
  return (
    <S {...p}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
    </S>
  );
}

// Top bar utils
export function Undo(p: IconProps) {
  return (
    <S {...p}>
      <path d="M9 7 4.5 11.5 9 16" />
      <path d="M4.5 11.5H14a4.5 4.5 0 0 1 0 9h-3.5" />
    </S>
  );
}

export function Redo(p: IconProps) {
  return (
    <S {...p}>
      <path d="M15 7l4.5 4.5L15 16" />
      <path d="M19.5 11.5H10a4.5 4.5 0 0 0 0 9h3.5" />
    </S>
  );
}

export function Home(p: IconProps) {
  return (
    <S {...p}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9.5h12V10" />
      <circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none" />
    </S>
  );
}

export function Add(p: IconProps) {
  return (<S {...p} sw={2.1}><path d="M12 6v12M6 12h12" /></S>);
}

export function Edit(p: IconProps) {
  return (
    <S {...p}>
      <path d="M14.5 5.5 18.5 9.5" />
      <path d="M4.5 19.5l.8-3.2L15 6.6a1.6 1.6 0 0 1 2.3 0l.1.1a1.6 1.6 0 0 1 0 2.3L7.7 18.7l-3.2.8Z" />
    </S>
  );
}

export function Trash(p: IconProps) {
  return (
    <S {...p}>
      <path d="M5 7h14M9.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="M6.5 7l.8 11a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7" />
      <path d="M10.5 11v5M13.5 11v5" />
    </S>
  );
}

export function Drag(p: IconProps) {
  return (
    <S {...p} sw={0} fill="currentColor">
      <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
    </S>
  );
}

export function Check(p: IconProps) {
  return (<S {...p} sw={2.4}><path d="M5 12.5 10 17.5 19 6.5" /></S>);
}

export function X(p: IconProps) {
  return (<S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>);
}

export function Scissors(p: IconProps) {
  return (
    <S {...p}>
      <circle cx="6.5" cy="6.5" r="2.5" /><circle cx="6.5" cy="17.5" r="2.5" />
      <path d="M8.7 8.2 20 19M8.7 15.8 20 5M12 12l-3.4 2.4" />
    </S>
  );
}

export function Begin(p: IconProps) {
  return (
    <S {...p}>
      <path d="M12 3.5c-2 2.5-5 4-5 8a5 5 0 0 0 10 0c0-4-3-5.5-5-8Z" />
      <path d="M12 12.5v6" />
    </S>
  );
}

export function Exit(p: IconProps) {
  return (
    <S {...p}>
      <path d="M14 5H6.5a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 6.5 19H14" />
      <path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5" />
    </S>
  );
}

export function Chevron(p: IconProps) {
  return (<S {...p}><path d="M9 6l6 6-6 6" /></S>);
}

export function ChevronUp(p: IconProps) {
  return (<S {...p}><path d="M6 15l6-6 6 6" /></S>);
}

/** Icon component reference, for props like `icon={Pencil}`. */
export type IconComponent = (p: IconProps) => ReactNode;
