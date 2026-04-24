import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionMode, SessionTemplate } from '../../types';

const TEMPLATES_KEY = 'sushi-party/session-templates';

function createTemplateId(): string {
  return `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readTemplates(): Promise<SessionTemplate[]> {
  const raw = await AsyncStorage.getItem(TEMPLATES_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as SessionTemplate[];
  } catch {
    return [];
  }
}

async function writeTemplates(templates: SessionTemplate[]): Promise<void> {
  await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

export async function getSessionTemplates(): Promise<SessionTemplate[]> {
  return readTemplates();
}

export async function createSessionTemplate(params: {
  name: string;
  mode: SessionMode;
  restaurantId?: string;
  restaurantName?: string;
  useGlobalMenu: boolean;
}): Promise<SessionTemplate> {
  const template: SessionTemplate = {
    id: createTemplateId(),
    name: params.name.trim(),
    mode: params.mode,
    useGlobalMenu: params.useGlobalMenu,
    createdAt: new Date().toISOString(),
  };
  if (params.restaurantId) {
    template.restaurantId = params.restaurantId;
  }
  if (params.restaurantName) {
    template.restaurantName = params.restaurantName;
  }

  const templates = await readTemplates();
  await writeTemplates([template, ...templates]);
  return template;
}

export async function deleteSessionTemplate(templateId: string): Promise<void> {
  const templates = await readTemplates();
  await writeTemplates(templates.filter((template) => template.id !== templateId));
}
