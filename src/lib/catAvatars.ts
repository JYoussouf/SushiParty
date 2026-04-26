export const CAT_AVATARS = ['🐱', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'] as const;

export type CatAvatar = (typeof CAT_AVATARS)[number];

export const DEFAULT_CAT_AVATAR: CatAvatar = CAT_AVATARS[0];

export function pickRandomCatAvatar(): CatAvatar {
  return CAT_AVATARS[Math.floor(Math.random() * CAT_AVATARS.length)] ?? DEFAULT_CAT_AVATAR;
}
