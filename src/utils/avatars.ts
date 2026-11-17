export interface AvatarOption {
  id: string;
  label: string;
  imageSrc: string | null;
  accentBg: string;
  initials: string;
}

export const HERO_BACKDROP_SRC = '/src/assets/images/xludo_hero_backdrop_1794902707800.jpg';
export const APP_ICON_SRC = '/src/assets/images/xludo_app_icon_1794902708319.jpg';

export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: 'royal',
    label: 'Maharaja',
    imageSrc: '/src/assets/images/xludo_avatar_royal_1794902709226.jpg',
    accentBg: 'from-amber-600 to-red-800',
    initials: 'MR',
  },
  {
    id: 'queen',
    label: 'Maharani',
    imageSrc: '/src/assets/images/xludo_avatar_queen_1794902711885.jpg',
    accentBg: 'from-emerald-600 to-blue-900',
    initials: 'MQ',
  },
  {
    id: 'warrior',
    label: 'Senapati',
    imageSrc: null,
    accentBg: 'from-red-600 to-amber-700',
    initials: 'SP',
  },
  {
    id: 'sage',
    label: 'Chanakya',
    imageSrc: null,
    accentBg: 'from-blue-600 to-indigo-900',
    initials: 'CK',
  },
];

export function getAvatarOption(id: string): AvatarOption {
  return AVATAR_OPTIONS.find((a) => a.id === id) || AVATAR_OPTIONS[0];
}
