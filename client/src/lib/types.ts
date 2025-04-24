// Define types for the application

export interface Video {
  id: number;
  videoId: string;
  title: string;
  url: string;
  quality: string;
  scrapedAt: string;
  lastAccessed: string;
  accessCount: number;
}

export interface Domain {
  id: number;
  domain: string;
  active: boolean;
  addedAt: string;
}

export interface Log {
  id: number;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  source: string;
  message: string;
}

export interface ScraperSettings {
  timeout: number;
  autoRetry: boolean;
  cacheEnabled: boolean;
  cacheTTL: number;
}

export interface TelegramStatus {
  active: boolean;
  botToken: boolean;
}

export interface SystemStats {
  totalRequests: number;
  cacheHitRate: number;
  uniqueVideos: number;
  cacheEnabled: boolean;
  scrapingTimeout: number;
  autoRetry: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedLogs {
  logs: Log[];
  total: number;
}
