import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className, size = 24 }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      width={size}
      height={size}
      className={cn(className)}
    >
      <defs>
        <linearGradient id="logo-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="logo-accent" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>

      {/* Background circle */}
      <circle cx="256" cy="256" r="240" fill="url(#logo-glow)" opacity="0.12" />

      {/* Neural network paths */}
      <g stroke="url(#logo-accent)" strokeWidth="8" strokeLinecap="round" opacity="0.6">
        <line x1="256" y1="120" x2="152" y2="320" />
        <line x1="256" y1="120" x2="360" y2="320" />
        <line x1="152" y1="320" x2="360" y2="320" />
        <line x1="256" y1="120" x2="256" y2="68" />
        <line x1="152" y1="320" x2="96" y2="352" />
        <line x1="360" y1="320" x2="416" y2="352" />
        <line x1="256" y1="120" x2="360" y2="200" />
        <line x1="256" y1="120" x2="152" y2="200" />
        <line x1="152" y1="200" x2="152" y2="320" />
        <line x1="360" y1="200" x2="360" y2="320" />
        <line x1="152" y1="200" x2="360" y2="200" />
        <line x1="256" y1="260" x2="152" y2="200" />
        <line x1="256" y1="260" x2="360" y2="200" />
        <line x1="256" y1="260" x2="152" y2="320" />
        <line x1="256" y1="260" x2="360" y2="320" />
      </g>

      {/* Neural nodes */}
      <circle cx="256" cy="120" r="24" fill="url(#logo-accent)" />
      <circle cx="256" cy="120" r="12" fill="#1a1025" opacity="0.5" />
      <circle cx="152" cy="200" r="18" fill="url(#logo-accent)" />
      <circle cx="152" cy="200" r="9" fill="#1a1025" opacity="0.5" />
      <circle cx="360" cy="200" r="18" fill="url(#logo-accent)" />
      <circle cx="360" cy="200" r="9" fill="#1a1025" opacity="0.5" />
      <circle cx="256" cy="260" r="20" fill="url(#logo-accent)" />
      <circle cx="256" cy="260" r="10" fill="#1a1025" opacity="0.5" />
      <circle cx="152" cy="320" r="22" fill="url(#logo-accent)" />
      <circle cx="152" cy="320" r="11" fill="#1a1025" opacity="0.5" />
      <circle cx="360" cy="320" r="22" fill="url(#logo-accent)" />
      <circle cx="360" cy="320" r="11" fill="#1a1025" opacity="0.5" />

      {/* Terminal nodes */}
      <circle cx="256" cy="68" r="12" fill="url(#logo-accent)" opacity="0.8" />
      <circle cx="96" cy="352" r="12" fill="url(#logo-accent)" opacity="0.8" />
      <circle cx="416" cy="352" r="12" fill="url(#logo-accent)" opacity="0.8" />

      {/* Pulse rings */}
      <circle cx="256" cy="120" r="32" stroke="#a855f7" strokeWidth="2" fill="none" opacity="0.3" />
      <circle cx="256" cy="260" r="28" stroke="#a855f7" strokeWidth="2" fill="none" opacity="0.2" />
    </svg>
  );
}
