export default function Logo({ className = 'h-9 w-9' }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      role="img"
      aria-label="Doccure Dental logo"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="doccure-dental-grad" x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14B8C8" />
          <stop offset="1" stopColor="#0A7F8B" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill="url(#doccure-dental-grad)" />
      <path
        d="M20 10.5c-2.2-1.6-5.6-1.9-7.7.2-2.2 2.2-1.7 6 .1 9.1 1 1.8 1.3 3.8 1.6 6 .2 1.4.6 3.7 1.9 3.7 1.5 0 1.5-2.6 1.9-4.3.3-1.2.7-2.2 2.2-2.2s1.9 1 2.2 2.2c.4 1.7.4 4.3 1.9 4.3 1.3 0 1.7-2.3 1.9-3.7.3-2.2.6-4.2 1.6-6 1.8-3.1 2.3-6.9.1-9.1-2.1-2.1-5.5-1.8-7.7-.2z"
        fill="#ffffff"
      />
      <path
        d="M27.5 8.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"
        fill="#C7F4F8"
      />
    </svg>
  );
}
