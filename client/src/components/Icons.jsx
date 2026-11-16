// Line icons copied from the mockups. All decorative: aria-hidden.
const base = {
  'aria-hidden': true,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const SearchIcon = ({ size = 21 }) => (
  <svg {...base} width={size} height={size} strokeWidth="1.8">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
)

export const AccountIcon = ({ size = 21 }) => (
  <svg {...base} width={size} height={size} strokeWidth="1.8">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
)

export const BagIcon = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} strokeWidth="1.8">
    <path d="M5 8h14l-1 12H6L5 8z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
)

export const ArrowIcon = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const MenuIcon = ({ size = 24 }) => (
  <svg {...base} width={size} height={size} strokeWidth="1.8">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)

export const CloseIcon = ({ size = 24 }) => (
  <svg {...base} width={size} height={size} strokeWidth="1.8">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const WhatsAppIcon = ({ size = 20 }) => (
  <svg {...base} width={size} height={size} strokeWidth="1.8">
    <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z" />
  </svg>
)

export const CheckIcon = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

export const PlusIcon = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const DeliveryIcon = ({ size = 28 }) => (
  <svg {...base} width={size} height={size} strokeWidth="1.6">
    <path d="M3 7h11v9H3z" />
    <path d="M14 10h4l3 3v3h-7z" />
    <circle cx="7" cy="18" r="1.6" />
    <circle cx="17" cy="18" r="1.6" />
  </svg>
)

export const PhoneIcon = ({ size = 28 }) => (
  <svg {...base} width={size} height={size} strokeWidth="1.6">
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
    <path d="M10.5 18h3" />
  </svg>
)

export const ShieldIcon = ({ size = 28 }) => (
  <svg {...base} width={size} height={size} strokeWidth="1.6">
    <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)
