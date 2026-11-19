import React from 'react';

type AegisLogoProps = {
  size?: number;
  title?: string;
};

export const AegisLogo: React.FC<AegisLogoProps> = ({
  size = 40,
  title = 'Aegis Gözcü',
}) => {
  const gradId = React.useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="12"
          y1="8"
          x2="52"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F6C86E" />
          <stop offset="1" stopColor="#D99A35" />
        </linearGradient>
      </defs>

      <path
        d="M32 5 53 13v17c0 13-8.5 23.6-21 29C19.5 53.6 11 43 11 30V13L32 5Z"
        fill="#102A43"
        stroke={`url(#${gradId})`}
        strokeWidth="3"
      />

      <path
        d="M20 31c3.6-5.4 8-8.1 12-8.1S40.4 25.6 44 31c-3.6 5.4-8 8.1-12 8.1S23.6 36.4 20 31Z"
        fill="none"
        stroke="#6ED6C1"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <circle cx="32" cy="31" r="4" fill="#F6C86E" />

      <path
        d="M32 17v6M32 39v8"
        stroke="#6ED6C1"
        strokeWidth="2"
        strokeLinecap="round"
        opacity=".85"
      />
    </svg>
  );
};
