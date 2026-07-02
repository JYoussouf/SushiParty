/* eslint-disable @typescript-eslint/no-require-imports -- static require() is required for Metro asset bundling */
import type { ImageSourcePropType } from 'react-native';

// Selectable profile characters. Avatars are stored/transmitted as the string
// `id` (e.g. 'panda'); every client resolves the id to its bundled image here.
// Legacy profiles saved before this (raw emoji strings) still render via the
// <Avatar> text fallback until the user picks one of these characters.
//
// Each character will later gain alternate-emotion variants — see the tracking
// issue for the emotion sheet.
export interface AvatarCharacter {
  id: string;
  name: string;
  source: ImageSourcePropType;
}

export const AVATAR_CHARACTERS = [
  { id: 'panda', name: 'Onigiri Panda', source: require('../../assets/avatars/panda.png') },
  { id: 'salmon', name: 'Salmon Nigiri', source: require('../../assets/avatars/salmon.png') },
  { id: 'edamame', name: 'Edamame Trio', source: require('../../assets/avatars/edamame.png') },
  { id: 'dragon', name: 'Dragon Roll', source: require('../../assets/avatars/dragon.png') },
] as const satisfies readonly AvatarCharacter[];

const byId = new Map<string, AvatarCharacter>(AVATAR_CHARACTERS.map((c) => [c.id, c]));

export function getAvatarCharacter(id: string | undefined): AvatarCharacter | undefined {
  return id ? byId.get(id) : undefined;
}

export const DEFAULT_AVATAR: string = AVATAR_CHARACTERS[0].id;

export function pickRandomAvatar(): string {
  return AVATAR_CHARACTERS[Math.floor(Math.random() * AVATAR_CHARACTERS.length)]?.id ?? DEFAULT_AVATAR;
}
