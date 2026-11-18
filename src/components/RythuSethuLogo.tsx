import React from 'react';

interface RythuSethuLogoProps {
  size?: number;
  className?: string;
}

/**
 * Kakatiya Kala Thoranam arch in warm sandstone framing a Telangana paddy-green leaf crest.
 */
export const RythuSethuLogo: React.FC<RythuSethuLogoProps> = ({size = 38, className = ''}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Background rounded crest */}
      <rect x="2" y="2" width="60" height="60" rx="14" fill="#FEFCE8" stroke="#D97706" strokeWidth="2" />

      {/* Kakatiya Kala Thoranam Top Kalasha / Crown Finial */}
      <path d="M32 6L35.5 11.5H28.5L32 6Z" fill="#B45309" />
      <rect x="13" y="13" width="38" height="4.5" rx="1.5" fill="#B45309" />
      <rect x="10" y="17.5" width="44" height="3.5" rx="1" fill="#D97706" />

      {/* Ornate side makara scroll motifs */}
      <circle cx="11" cy="15" r="2.2" fill="#92400E" />
      <circle cx="53" cy="15" r="2.2" fill="#92400E" />

      {/* Twin Stepped Stone Pillars */}
      <rect x="14.5" y="21" width="5.5" height="29" rx="1" fill="#B45309" />
      <rect x="13" y="25" width="8.5" height="2.2" fill="#F59E0B" />
      <rect x="13" y="38" width="8.5" height="2.2" fill="#F59E0B" />
      <rect x="12" y="50" width="10.5" height="4.5" rx="1" fill="#92400E" />

      <rect x="44" y="21" width="5.5" height="29" rx="1" fill="#B45309" />
      <rect x="42.5" y="25" width="8.5" height="2.2" fill="#F59E0B" />
      <rect x="42.5" y="38" width="8.5" height="2.2" fill="#F59E0B" />
      <rect x="41.5" y="50" width="10.5" height="4.5" rx="1" fill="#92400E" />

      {/* Inner Carved Arch */}
      <path
        d="M20 28C20 22.5 25.4 19.5 32 19.5C38.6 19.5 44 22.5 44 28"
        stroke="#D97706"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Base Plinth */}
      <rect x="10" y="54.5" width="44" height="3.5" rx="1.5" fill="#78350F" />

      {/* Central Paddy-Green Leaf Crest & Harvest Sun */}
      <circle cx="38.5" cy="27.5" r="3.2" fill="#F59E0B" />
      <path
        d="M23.5 49C23.5 37.5 30.5 29.5 41.5 28C40 39.5 33 47.5 23.5 49Z"
        fill="#15803D"
        stroke="#14532D"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M24 48.5L36.5 34.5" stroke="#DCFCE7" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
};
