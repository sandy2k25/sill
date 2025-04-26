import { apiRequest } from '@/lib/queryClient';
import type { 
  Video, 
  Domain, 
  Log, 
  ScraperSettings,

  TelegramStatus,
  SystemStats,
  PaginatedLogs
} from './types';

// Video API
export const getVideo = async (id: string): Promise<Video> => {
  const res = await fetch(`/api/video/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch video: ${res.statusText}`);
  }
  const data = await res.json();
  return data.data;
};

export const getRecentVideos = async (limit = 10): Promise<Video[]> => {
  const res = await fetch(`/api/videos/recent?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch recent videos: ${res.statusText}`);
  }
  const data = await res.json();
  return data.data;
};

// Cache API
export const clearCache = async (): Promise<void> => {
  await apiRequest('POST', '/api/cache/clear');
};

export const refreshCache = async (id: string): Promise<Video> => {
  const res = await apiRequest('POST', `/api/cache/refresh/${id}`);
  const data = await res.json();
  return data.data;
};

// Settings API
export const getSettings = async (): Promise<ScraperSettings> => {
  const res = await fetch('/api/settings');
  if (!res.ok) {
    throw new Error(`Failed to fetch settings: ${res.statusText}`);
  }
  const data = await res.json();
  return data.data;
};

export const updateSettings = async (settings: Partial<ScraperSettings>): Promise<ScraperSettings> => {
  const res = await apiRequest('PUT', '/api/settings', settings);
  const data = await res.json();
  return data.data;
};

// Domain API
export const getDomains = async (): Promise<Domain[]> => {
  const res = await fetch('/api/domains');
  if (!res.ok) {
    throw new Error(`Failed to fetch domains: ${res.statusText}`);
  }
  const data = await res.json();
  return data.data;
};

export const addDomain = async (domain: string): Promise<Domain> => {
  const res = await apiRequest('POST', '/api/domains', { domain, active: true });
  const data = await res.json();
  return data.data;
};

export const toggleDomainStatus = async (id: number): Promise<Domain> => {
  const res = await apiRequest('PUT', `/api/domains/${id}`);
  const data = await res.json();
  return data.data;
};

export const deleteDomain = async (id: number): Promise<void> => {
  await apiRequest('DELETE', `/api/domains/${id}`);
};

// Logs API
export const getLogs = async (
  limit = 20, 
  offset = 0, 
  level?: string
): Promise<PaginatedLogs> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString()
  });
  
  if (level) {
    params.append('level', level);
  }
  
  const res = await apiRequest('GET', `/api/logs?${params.toString()}`);
  const data = await res.json();
  return data.data;
};

export const addLog = async (log: { level: string; source: string; message: string }): Promise<Log> => {
  const res = await apiRequest('POST', '/api/logs', log);
  const data = await res.json();
  return data.data;
};

export const clearLogs = async (): Promise<void> => {
  await apiRequest('DELETE', '/api/logs');
};

// System stats API
export const getSystemStats = async (): Promise<SystemStats> => {
  const res = await fetch('/api/stats');
  if (!res.ok) {
    throw new Error(`Failed to fetch system stats: ${res.statusText}`);
  }
  const data = await res.json();
  return data.data;
};

// Telegram bot API
export const getTelegramStatus = async (): Promise<TelegramStatus> => {
  const res = await apiRequest('GET', '/api/telegram/status');
  const data = await res.json();
  return data.data;
};

export const startTelegramBot = async (): Promise<void> => {
  await apiRequest('POST', '/api/telegram/start');
};

export const stopTelegramBot = async (): Promise<void> => {
  await apiRequest('POST', '/api/telegram/stop');
};

// Telegram channel storage API
export const enableChannelStorage = async (channelId: string): Promise<void> => {
  await apiRequest('POST', '/api/telegram/channel/enable', { channelId });
};

export const disableChannelStorage = async (): Promise<void> => {
  await apiRequest('POST', '/api/telegram/channel/disable');
};
