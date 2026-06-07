import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    />
  );
}

/* ── Oculs Logo Mark (eye + pupil) ── */
export function OculsMark({ size = 20, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M10 4C6.2 4 2.8 6.8 2 10C2.8 13.2 6.2 16 10 16C13.8 16 17.2 13.2 18 10C17.2 6.8 13.8 4 10 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" fill="currentColor" />
      <circle cx="10" cy="10" r="1" fill="white" />
    </svg>
  );
}

/* ── Arrow Right ── */
export function ArrowRight(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M3 8H13M13 8L9 4M13 8L9 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/* ── Check ── */
export function Check(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M3 8L6.5 11.5L13 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/* ── Menu (hamburger) ── */
export function Menu(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M2 4H14M2 8H14M2 12H14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/* ── Close (X) ── */
export function Close(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M3 3L13 13M13 3L3 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/* ── Git Branch / Push ── */
export function GitBranch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="4" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="4" cy="12.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 5V11M4 5C4 5 9 5.5 10.5 5.5C11 5.5 11 5.5 11 5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 7V5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/* ── Sparkles / AI ── */
export function Sparkles(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M8 2L9.2 5.8L13 7L9.2 8.2L8 12L6.8 8.2L3 7L6.8 5.8L8 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M13 10L13.8 12.2L16 13L13.8 13.8L13 16L12.2 13.8L10 13L12.2 12.2L13 10Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/* ── Code / Patch ── */
export function CodePatch(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M5 5L2 8L5 11M11 5L14 8L11 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 3L7 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="1.5 2"
      />
    </Icon>
  );
}

/* ── Shield ── */
export function Shield(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M8 2L13.5 4.5V8.5C13.5 11.5 11 13.8 8 14.5C5 13.8 2.5 11.5 2.5 8.5V4.5L8 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 8L7 9.5L10.5 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/* ── External Link ── */
export function ExternalLink(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M10 2H14V6M14 2L7 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 3H3V13H13V9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/* ── Layout Grid (overview/home) ── */
export function LayoutGrid(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M2 2H7V7H2V2ZM9 2H14V7H9V2ZM2 9H7V14H2V9ZM9 9H14V14H9V9Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/* ── Scan / Activity ── */
export function ScanIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M2 5H14M2 8H14M2 11H8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M13.4 12.4L15 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/* ── Alert Triangle (findings) ── */
export function AlertTriangle(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M8 2L14.5 13H1.5L8 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 6V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
    </Icon>
  );
}

/* ── Cog (settings) ── */
export function Cog(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.2 3.2L4.3 4.3M11.7 11.7L12.8 12.8M3.2 12.8L4.3 11.7M11.7 4.3L12.8 3.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/* ── Log Out ── */
export function LogOut(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M6 2H3C2.45 2 2 2.45 2 3V13C2 13.55 2.45 14 3 14H6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 5L13.5 8L10 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 8H6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/* ── Plus ── */
export function Plus(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M8 3V13M3 8H13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/* ── GitHub logo mark ── */
export function GitHub({ size = 16, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}
