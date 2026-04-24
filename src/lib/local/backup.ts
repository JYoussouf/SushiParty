import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionTemplate, SushiSession, User } from '../../types';
import { getOrCreateDeviceProfile, replaceDeviceProfile } from './deviceProfile';
import { getSessionTemplates } from './templates';

const SESSIONS_KEY = 'sushi-party/local-sessions';
const GROUP_SESSIONS_KEY = 'sushi-party/group-sessions';
const TEMPLATES_KEY = 'sushi-party/session-templates';

export interface BackupPayload {
  exportedAt: string;
  profile: User;
  sessions: SushiSession[];
  templates: SessionTemplate[];
}

export async function buildBackupPayload(): Promise<BackupPayload> {
  const [profile, sessionsRaw, templates] = await Promise.all([
    getOrCreateDeviceProfile(),
    AsyncStorage.getItem(SESSIONS_KEY),
    getSessionTemplates(),
  ]);

  let sessions: SushiSession[] = [];
  if (sessionsRaw) {
    try {
      sessions = JSON.parse(sessionsRaw) as SushiSession[];
    } catch {
      sessions = [];
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    profile,
    sessions,
    templates,
  };
}

export async function restoreBackupPayload(payload: BackupPayload): Promise<void> {
  if (!payload.profile || !Array.isArray(payload.sessions) || !Array.isArray(payload.templates)) {
    throw new Error('Backup file is missing required fields.');
  }

  await replaceDeviceProfile(payload.profile);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(payload.sessions));
  await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(payload.templates));
  await AsyncStorage.removeItem(GROUP_SESSIONS_KEY);
}
