import { Telegraf, Context } from 'telegraf';
import { Domain, Video, Log, ScraperSettings, InsertVideo, InsertDomain, InsertLog } from '@shared/schema';
import type { IStorage } from './storage';

// We'll set storage instance and videoScraper later to avoid circular dependency
let storageInstance: IStorage | null = null;
let videoScraperInstance: any = null;

// Create a new bot instance if TELEGRAM_BOT_TOKEN is provided
// Interface for the Telegram channel database
interface TelegramDB {
  channelId: string | undefined;
  enabled: boolean;
}

export class TelegramBot {
  private bot: Telegraf | null = null;
  private isRunning: boolean = false;
  private adminUsers: Set<number> = new Set();
  
  // Handler methods for button callbacks
  private async handleStats(ctx: any) {
    if (!videoScraperInstance || !storageInstance) {
      await ctx.reply('⚠️ System statistics not available');
      return;
    }
    
    try {
      const settings = await storageInstance.getScraperSettings();
      const videos = await storageInstance.getRecentVideos(1000);
      const domains = await storageInstance.getAllDomains();
      
      const stats = {
        totalVideos: videos.length,
        totalDomains: domains.length,
        activeDomains: domains.filter(d => d.active).length,
        cacheEnabled: settings.cacheEnabled,
        cacheTTL: settings.cacheTTL
      };
      
      await ctx.reply(
        '📊 *System Statistics*\n\n' +
        `Total Videos: ${stats.totalVideos}\n` +
        `Total Domains: ${stats.totalDomains}\n` +
        `Active Domains: ${stats.activeDomains}\n` +
        `Cache Enabled: ${stats.cacheEnabled ? 'Yes' : 'No'}\n` +
        `Cache TTL: ${stats.cacheTTL} minutes`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "Back to Menu", callback_data: "menu" }]
            ]
          }
        }
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await ctx.reply(`⚠️ Error fetching statistics: ${errorMessage}`);
    }
  }
  
  private async handleSettings(ctx: any) {
    if (!storageInstance) {
      await ctx.reply('⚠️ Settings not available');
      return;
    }
    
    try {
      const settings = await storageInstance.getScraperSettings();
      
      await ctx.reply(
        '⚙️ *Current Settings*\n\n' +
        `Timeout: ${settings.timeout} seconds\n` +
        `Auto Retry: ${settings.autoRetry ? 'Enabled' : 'Disabled'}\n` +
        `Cache: ${settings.cacheEnabled ? 'Enabled' : 'Disabled'}\n` +
        `Cache TTL: ${settings.cacheTTL} minutes\n\n` +
        'To change settings, use these commands:\n' +
        '/settings timeout <seconds>\n' +
        '/settings retry <on/off>\n' +
        '/settings cache <on/off>\n' +
        '/settings ttl <minutes>',
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Enable Cache", callback_data: "settings_cache_on" },
                { text: "Disable Cache", callback_data: "settings_cache_off" }
              ],
              [{ text: "Back to Menu", callback_data: "menu" }]
            ]
          }
        }
      );
    } catch (error) {
      await ctx.reply(`⚠️ Error fetching settings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  private async handleDomains(ctx: any) {
    if (!storageInstance) {
      await ctx.reply('⚠️ Domain management not available');
      return;
    }
    
    try {
      const domains = await storageInstance.getAllDomains();
      
      if (domains.length === 0) {
        await ctx.reply(
          '🌐 *Whitelisted Domains*\n\n' +
          'No domains have been added yet.\n\n' +
          'Use /domains add <domain> to add a new domain',
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: "Back to Menu", callback_data: "menu" }]
              ]
            }
          }
        );
        return;
      }
      
      const domainsText = domains.map(d => 
        `${d.id}. ${d.domain} - ${d.active ? '✅ Active' : '❌ Inactive'}`
      ).join('\n');
      
      await ctx.reply(
        '🌐 *Whitelisted Domains*\n\n' +
        `${domainsText}\n\n` +
        'Use these commands to manage domains:\n' +
        '/domains add <domain> - Add a new domain\n' +
        '/domains toggle <id> - Toggle domain status\n' +
        '/domains delete <id> - Delete a domain',
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: "Back to Menu", callback_data: "menu" }]
            ]
          }
        }
      );
    } catch (error) {
      await ctx.reply(`⚠️ Error fetching domains: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  private async handleCache(ctx: any) {
    if (!videoScraperInstance || !storageInstance) {
      await ctx.reply('⚠️ Cache management not available');
      return;
    }
    
    try {
      const settings = await storageInstance.getScraperSettings();
      const videos = await storageInstance.getRecentVideos(5);
      
      let videosText = '';
      if (videos.length > 0) {
        videosText = '\n\n*Recent Videos in Cache:*\n' + 
          videos.map(v => `- ${v.videoId}: ${v.title || 'Untitled'}`).join('\n');
      }
      
      await ctx.reply(
        '🗄️ *Video Cache*\n\n' +
        `Status: ${settings.cacheEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
        `TTL: ${settings.cacheTTL} minutes\n` +
        `${videosText}\n\n` +
        'Use these commands to manage cache:\n' +
        '/cache clear - Clear the entire cache\n' +
        '/cache refresh <videoId> - Refresh a specific video',
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Clear Cache", callback_data: "cache_clear" },
              ],
              [{ text: "Back to Menu", callback_data: "menu" }]
            ]
          }
        }
      );
    } catch (error) {
      await ctx.reply(`⚠️ Error fetching cache info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  private async handleLogs(ctx: any) {
    if (!storageInstance) {
      await ctx.reply('⚠️ Logs not available');
      return;
    }
    
    try {
      const { logs } = await storageInstance.getLogs(10, 0);
      
      if (logs.length === 0) {
        await ctx.reply(
          '📝 *System Logs*\n\n' +
          'No logs available.',
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: "Back to Menu", callback_data: "menu" }]
              ]
            }
          }
        );
        return;
      }
      
      const logsText = logs.map(log => 
        `[${log.level}] ${log.source}: ${log.message.substring(0, 50)}${log.message.length > 50 ? '...' : ''}`
      ).join('\n');
      
      await ctx.reply(
        '📝 *System Logs*\n\n' +
        `${logsText}`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Clear Logs", callback_data: "logs_clear" }
              ],
              [{ text: "Back to Menu", callback_data: "menu" }]
            ]
          }
        }
      );
    } catch (error) {
      await ctx.reply(`⚠️ Error fetching logs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  private async handleChannel(ctx: any) {
    const channelStatus = this.isChannelStorageEnabled() 
      ? `✅ Enabled (ID: ${this.channelStorage.channelId})` 
      : '❌ Disabled';
    
    await ctx.reply(
      '📢 *Channel Storage*\n\n' +
      `Status: ${channelStatus}\n\n` +
      'Channel storage allows the bot to save data in a Telegram channel.\n' +
      'This is useful for backup and cross-device synchronization.',
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Verify Channel ID", callback_data: "verify_channel" }
            ],
            [
              { text: "Disable Storage", callback_data: "channel_disable" }
            ],
            [{ text: "Back to Menu", callback_data: "menu" }]
          ]
        }
      }
    );
  }
  
  private async handleHelp(ctx: any) {
    await ctx.reply(
      '❓ *Help Information*\n\n' +
      'This bot allows you to manage your WovIeX service.\n\n' +
      '*Features:*\n' +
      '• View system statistics\n' +
      '• Manage scraper settings\n' +
      '• Control domain whitelist\n' +
      '• Manage video cache\n' +
      '• View system logs\n' +
      '• Configure channel storage\n\n' +
      '*Channel Storage:*\n' +
      'The bot can use a Telegram channel as database backup.\n' +
      'Use the Channel Storage menu to configure this feature.\n\n' +
      '*Admin Authentication:*\n' +
      'Use /admin <password> to authenticate as admin.',
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "Back to Menu", callback_data: "menu" }]
          ]
        }
      }
    );
  }
  
  // Telegram channel storage configuration
  private channelStorage: TelegramDB = {
    channelId: process.env.TELEGRAM_CHANNEL_ID,
    enabled: process.env.TELEGRAM_CHANNEL_ID ? true : false // Auto-enable if channel ID is provided
  };
  
  constructor() {
    // We'll initialize the bot when storage is set
  }
  
  /**
   * Set the storage instance after initialization to avoid circular dependency
   */
  setStorage(storage: IStorage) {
    storageInstance = storage;
    console.log('Storage instance set in TelegramBot');
    
    // Now we can initialize the bot if token is provided
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token && token.length > 10) {
      this.initializeBot(token);
    }
  }
  
  /**
   * Set the video scraper instance after initialization to avoid circular dependency
   */
  setVideoScraper(scraper: any) {
    videoScraperInstance = scraper;
    console.log('WovIeX instance set in TelegramBot');
  }
  
  private initializeBot(token: string) {
    try {
      this.bot = new Telegraf(token);
      console.log('Telegram bot created with token');
      
      // Make sure the bot was created successfully
      if (!this.bot) {
        throw new Error('Failed to create Telegram bot instance');
      }
      
      // Add admin verification middleware to all commands
      this.bot.use(async (ctx, next) => {
        if (ctx.from && this.isAdminUser(ctx.from.id)) {
          return next();
        } else if (ctx.from && ctx.message) {
          // Verify password if provided
          if ('text' in ctx.message && ctx.message.text?.startsWith('/admin ')) {
            const password = ctx.message.text.split(' ')[1];
            if (password && this.verifyAdminPassword(password)) {
              this.adminUsers.add(ctx.from.id);
              await ctx.reply('✅ You are now authorized as admin.');
              return;
            }
          }
          await ctx.reply('⚠️ You are not authorized. Use /admin <password> to authenticate.');
        }
      });

      // Register command handlers
      this.registerCommands();
      
      // Only log if storage is set
      if (storageInstance) {
        storageInstance.createLog({
          level: 'INFO',
          source: 'Telegram',
          message: 'Telegram bot initialized'
        });
      }
    } catch (error) {
      console.error('Failed to initialize Telegram bot:', error);
      // Explicitly set bot to null on error
      this.bot = null;
      
      if (storageInstance) {
        storageInstance.createLog({
          level: 'ERROR',
          source: 'Telegram',
          message: `Failed to initialize Telegram bot: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
  }
  
  /**
   * Register command handlers for the bot
   */
  private registerCommands() {
    if (!this.bot) return;
    
    // Start command - shows welcome message and menu
    this.bot.command('start', async (ctx) => {
      await ctx.reply(
        '🤖 *WovIeX Bot*\n\n' +
        'Welcome to the admin interface for the WovIeX service.\n' +
        'Use the commands below to manage the service:\n\n' +
        '/menu - Show this menu\n' +
        '/stats - Show system statistics\n' +
        '/settings - Show current settings\n' +
        '/domains - Manage whitelisted domains\n' +
        '/cache - Manage video cache\n' +
        '/logs - View recent logs\n' +
        '/channel - Configure channel storage\n' +
        '/help - Show help information',
        { parse_mode: 'Markdown' }
      );
    });
    
    // Menu command - shows available commands
    this.bot.command('menu', async (ctx) => {
      await ctx.reply(
        '📋 *WovIeX Bot Menu*\n\n' +
        'Please select an option below:',
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: "📊 Statistics", callback_data: "stats" },
                { text: "⚙️ Settings", callback_data: "settings" }
              ],
              [
                { text: "🌐 Domains", callback_data: "domains" },
                { text: "🗄️ Cache", callback_data: "cache" }
              ],
              [
                { text: "📝 Logs", callback_data: "logs" },
                { text: "📢 Channel Storage", callback_data: "channel" }
              ],
              [
                { text: "❓ Help", callback_data: "help" }
              ],
              [
                { text: "🔍 Verify Channel ID", callback_data: "verify_channel" }
              ]
            ]
          }
        }
      );
    });
    
    // Stats command - shows system statistics
    this.bot.command('stats', async (ctx) => {
      if (!videoScraperInstance || !storageInstance) {
        await ctx.reply('⚠️ System statistics not available');
        return;
      }
      
      try {
        const settings = await storageInstance.getScraperSettings();
        const videos = await storageInstance.getRecentVideos(1000); // Get all videos up to 1000
        const domains = await storageInstance.getAllDomains();
        
        const stats = {
          totalVideos: videos.length,
          totalDomains: domains.length,
          activeDomains: domains.filter(d => d.active).length,
          cacheEnabled: settings.cacheEnabled,
          cacheTTL: settings.cacheTTL
        };
        
        await ctx.reply(
          '📊 *System Statistics*\n\n' +
          `Total Videos: ${stats.totalVideos}\n` +
          `Total Domains: ${stats.totalDomains}\n` +
          `Active Domains: ${stats.activeDomains}\n` +
          `Cache Enabled: ${stats.cacheEnabled ? 'Yes' : 'No'}\n` +
          `Cache TTL: ${stats.cacheTTL} minutes\n`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await ctx.reply(`⚠️ Error fetching statistics: ${errorMessage}`);
      }
    });
    
    // Settings command - shows and manages settings
    this.bot.command('settings', async (ctx) => {
      if (!storageInstance) {
        await ctx.reply('⚠️ Settings not available');
        return;
      }
      
      try {
        const settings = await storageInstance.getScraperSettings();
        
        await ctx.reply(
          '⚙️ *Current Settings*\n\n' +
          `Timeout: ${settings.timeout} seconds\n` +
          `Auto Retry: ${settings.autoRetry ? 'Enabled' : 'Disabled'}\n` +
          `Cache: ${settings.cacheEnabled ? 'Enabled' : 'Disabled'}\n` +
          `Cache TTL: ${settings.cacheTTL} minutes\n\n` +
          'To change settings, use:\n' +
          '/settings timeout <seconds>\n' +
          '/settings retry <on/off>\n' +
          '/settings cache <on/off>\n' +
          '/settings ttl <minutes>',
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        await ctx.reply(`⚠️ Error fetching settings: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    // Domains command - list and manage whitelisted domains
    this.bot.command('domains', async (ctx) => {
      if (!storageInstance) {
        await ctx.reply('⚠️ Domain management not available');
        return;
      }
      
      try {
        const domains = await storageInstance.getAllDomains();
        
        if (domains.length === 0) {
          await ctx.reply(
            '🌐 *Whitelisted Domains*\n\n' +
            'No domains have been added yet.\n\n' +
            'Commands:\n' +
            '/domains add <domain> - Add a new domain\n' +
            '/domains list - List all domains',
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        const domainsText = domains.map(d => 
          `${d.id}. ${d.domain} - ${d.active ? '✅ Active' : '❌ Inactive'}`
        ).join('\n');
        
        await ctx.reply(
          '🌐 *Whitelisted Domains*\n\n' +
          `${domainsText}\n\n` +
          'Commands:\n' +
          '/domains add <domain> - Add a new domain\n' +
          '/domains toggle <id> - Toggle domain status\n' +
          '/domains delete <id> - Delete a domain',
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        await ctx.reply(`⚠️ Error fetching domains: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    // Cache command - manage video cache
    this.bot.command('cache', async (ctx) => {
      if (!videoScraperInstance || !storageInstance) {
        await ctx.reply('⚠️ Cache management not available');
        return;
      }
      
      try {
        const settings = await storageInstance.getScraperSettings();
        const videos = await storageInstance.getRecentVideos(5); // Get 5 most recent videos
        
        let videosText = '';
        if (videos.length > 0) {
          videosText = '\n\n*Recent Videos in Cache:*\n' + 
            videos.map(v => `- ${v.videoId}: ${v.title || 'Untitled'}`).join('\n');
        }
        
        await ctx.reply(
          '🗄️ *Video Cache*\n\n' +
          `Status: ${settings.cacheEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
          `TTL: ${settings.cacheTTL} minutes\n` +
          `${videosText}\n\n` +
          'Commands:\n' +
          '/cache clear - Clear the entire cache\n' +
          '/cache refresh <videoId> - Refresh a specific video\n' +
          '/settings cache on/off - Enable/disable cache',
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        await ctx.reply(`⚠️ Error fetching cache info: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    // Logs command - view system logs
    this.bot.command('logs', async (ctx) => {
      if (!storageInstance) {
        await ctx.reply('⚠️ Logs not available');
        return;
      }
      
      try {
        const { logs } = await storageInstance.getLogs(10, 0); // Get 10 most recent logs
        
        if (logs.length === 0) {
          await ctx.reply(
            '📝 *System Logs*\n\n' +
            'No logs available.\n\n' +
            'Commands:\n' +
            '/logs clear - Clear all logs',
            { parse_mode: 'Markdown' }
          );
          return;
        }
        
        const logsText = logs.map(log => 
          `[${log.level}] ${log.source}: ${log.message.substring(0, 50)}${log.message.length > 50 ? '...' : ''}`
        ).join('\n');
        
        await ctx.reply(
          '📝 *System Logs*\n\n' +
          `${logsText}\n\n` +
          'Commands:\n' +
          '/logs clear - Clear all logs',
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        await ctx.reply(`⚠️ Error fetching logs: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    // Handle button callbacks
    this.bot.on('callback_query', async (ctx) => {
      try {
        if (!ctx.callbackQuery) return;
        const callbackData = ctx.callbackQuery.data;
        if (!callbackData) return;
        
        // Answer the callback query to stop loading animation
        await ctx.answerCbQuery();
        
        // Special case for menu
        if (callbackData === 'menu') {
          await ctx.reply(
            '📋 *WovIeX Bot Menu*\n\n' +
            'Please select an option below:',
            { 
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "📊 Statistics", callback_data: "stats" },
                    { text: "⚙️ Settings", callback_data: "settings" }
                  ],
                  [
                    { text: "🌐 Domains", callback_data: "domains" },
                    { text: "🗄️ Cache", callback_data: "cache" }
                  ],
                  [
                    { text: "📝 Logs", callback_data: "logs" },
                    { text: "📢 Channel Storage", callback_data: "channel" }
                  ],
                  [
                    { text: "❓ Help", callback_data: "help" }
                  ],
                  [
                    { text: "🔍 Verify Channel ID", callback_data: "verify_channel" }
                  ]
                ]
              }
            }
          );
          return;
        }
        
        switch (callbackData) {
          case 'stats':
            // Show statistics
            if (!videoScraperInstance || !storageInstance) {
              await ctx.reply('⚠️ System statistics not available');
              return;
            }
            
            try {
              const settings = await storageInstance.getScraperSettings();
              const videos = await storageInstance.getRecentVideos(1000);
              const domains = await storageInstance.getAllDomains();
              
              const stats = {
                totalVideos: videos.length,
                totalDomains: domains.length,
                activeDomains: domains.filter(d => d.active).length,
                cacheEnabled: settings.cacheEnabled,
                cacheTTL: settings.cacheTTL
              };
              
              await ctx.reply(
                '📊 *System Statistics*\n\n' +
                `Total Videos: ${stats.totalVideos}\n` +
                `Total Domains: ${stats.totalDomains}\n` +
                `Active Domains: ${stats.activeDomains}\n` +
                `Cache Enabled: ${stats.cacheEnabled ? 'Yes' : 'No'}\n` +
                `Cache TTL: ${stats.cacheTTL} minutes`,
                { 
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: "Back to Menu", callback_data: "menu" }]
                    ]
                  }
                }
              );
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              await ctx.reply(`⚠️ Error fetching statistics: ${errorMessage}`);
            }
            break;
            
          case 'settings':
            // Show settings
            if (!storageInstance) {
              await ctx.reply('⚠️ Settings not available');
              return;
            }
            
            try {
              const settings = await storageInstance.getScraperSettings();
              
              await ctx.reply(
                '⚙️ *Current Settings*\n\n' +
                `Timeout: ${settings.timeout} seconds\n` +
                `Auto Retry: ${settings.autoRetry ? 'Enabled' : 'Disabled'}\n` +
                `Cache: ${settings.cacheEnabled ? 'Enabled' : 'Disabled'}\n` +
                `Cache TTL: ${settings.cacheTTL} minutes\n\n` +
                'To change settings, use these commands:\n' +
                '/settings timeout <seconds>\n' +
                '/settings retry <on/off>\n' +
                '/settings cache <on/off>\n' +
                '/settings ttl <minutes>',
                { 
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "Enable Cache", callback_data: "settings_cache_on" },
                        { text: "Disable Cache", callback_data: "settings_cache_off" }
                      ],
                      [{ text: "Back to Menu", callback_data: "menu" }]
                    ]
                  }
                }
              );
            } catch (error) {
              await ctx.reply(`⚠️ Error fetching settings: ${error instanceof Error ? error.message : String(error)}`);
            }
            break;
            
          case 'domains':
            // Show domains
            if (!storageInstance) {
              await ctx.reply('⚠️ Domain management not available');
              return;
            }
            
            try {
              const domains = await storageInstance.getAllDomains();
              
              if (domains.length === 0) {
                await ctx.reply(
                  '🌐 *Whitelisted Domains*\n\n' +
                  'No domains have been added yet.\n\n' +
                  'Use /domains add <domain> to add a new domain',
                  { 
                    parse_mode: 'Markdown',
                    reply_markup: {
                      inline_keyboard: [
                        [{ text: "Back to Menu", callback_data: "menu" }]
                      ]
                    }
                  }
                );
                return;
              }
              
              const domainsText = domains.map(d => 
                `${d.id}. ${d.domain} - ${d.active ? '✅ Active' : '❌ Inactive'}`
              ).join('\n');
              
              await ctx.reply(
                '🌐 *Whitelisted Domains*\n\n' +
                `${domainsText}\n\n` +
                'Use these commands to manage domains:\n' +
                '/domains add <domain> - Add a new domain\n' +
                '/domains toggle <id> - Toggle domain status\n' +
                '/domains delete <id> - Delete a domain',
                { 
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: "Back to Menu", callback_data: "menu" }]
                    ]
                  }
                }
              );
            } catch (error) {
              await ctx.reply(`⚠️ Error fetching domains: ${error instanceof Error ? error.message : String(error)}`);
            }
            break;
            
          case 'cache':
            // Show cache info
            if (!videoScraperInstance || !storageInstance) {
              await ctx.reply('⚠️ Cache management not available');
              return;
            }
            
            try {
              const settings = await storageInstance.getScraperSettings();
              const videos = await storageInstance.getRecentVideos(5);
              
              let videosText = '';
              if (videos.length > 0) {
                videosText = '\n\n*Recent Videos in Cache:*\n' + 
                  videos.map(v => `- ${v.videoId}: ${v.title || 'Untitled'}`).join('\n');
              }
              
              await ctx.reply(
                '🗄️ *Video Cache*\n\n' +
                `Status: ${settings.cacheEnabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                `TTL: ${settings.cacheTTL} minutes\n` +
                `${videosText}\n\n` +
                'Use these commands to manage cache:\n' +
                '/cache clear - Clear the entire cache\n' +
                '/cache refresh <videoId> - Refresh a specific video',
                { 
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "Clear Cache", callback_data: "cache_clear" },
                      ],
                      [{ text: "Back to Menu", callback_data: "menu" }]
                    ]
                  }
                }
              );
            } catch (error) {
              await ctx.reply(`⚠️ Error fetching cache info: ${error instanceof Error ? error.message : String(error)}`);
            }
            break;
            
          case 'logs':
            // Show logs
            if (!storageInstance) {
              await ctx.reply('⚠️ Logs not available');
              return;
            }
            
            try {
              const { logs } = await storageInstance.getLogs(10, 0);
              
              if (logs.length === 0) {
                await ctx.reply(
                  '📝 *System Logs*\n\n' +
                  'No logs available.',
                  { 
                    parse_mode: 'Markdown',
                    reply_markup: {
                      inline_keyboard: [
                        [{ text: "Back to Menu", callback_data: "menu" }]
                      ]
                    }
                  }
                );
                return;
              }
              
              const logsText = logs.map(log => 
                `[${log.level}] ${log.source}: ${log.message.substring(0, 50)}${log.message.length > 50 ? '...' : ''}`
              ).join('\n');
              
              await ctx.reply(
                '📝 *System Logs*\n\n' +
                `${logsText}`,
                { 
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: "Clear Logs", callback_data: "logs_clear" }
                      ],
                      [{ text: "Back to Menu", callback_data: "menu" }]
                    ]
                  }
                }
              );
            } catch (error) {
              await ctx.reply(`⚠️ Error fetching logs: ${error instanceof Error ? error.message : String(error)}`);
            }
            break;
            
          case 'channel':
            // Show channel info
            const channelStatus = this.isChannelStorageEnabled() 
              ? `✅ Enabled (ID: ${this.channelStorage.channelId})` 
              : '❌ Disabled';
            
            await ctx.reply(
              '📢 *Channel Storage*\n\n' +
              `Status: ${channelStatus}\n\n` +
              'Channel storage allows the bot to save data in a Telegram channel.\n' +
              'This is useful for backup and cross-device synchronization.',
              { 
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: "Verify Channel ID", callback_data: "verify_channel" }
                    ],
                    [
                      { text: "Disable Storage", callback_data: "channel_disable" }
                    ],
                    [{ text: "Back to Menu", callback_data: "menu" }]
                  ]
                }
              }
            );
            break;
            
          case 'help':
            // Show help info
            await ctx.reply(
              '❓ *Help Information*\n\n' +
              'This bot allows you to manage your WovIeX service.\n\n' +
              '*Features:*\n' +
              '• View system statistics\n' +
              '• Manage scraper settings\n' +
              '• Control domain whitelist\n' +
              '• Manage video cache\n' +
              '• View system logs\n' +
              '• Configure channel storage\n\n' +
              '*Channel Storage:*\n' +
              'The bot can use a Telegram channel as database backup.\n' +
              'Use the Channel Storage menu to configure this feature.\n\n' +
              '*Admin Authentication:*\n' +
              'Use /admin <password> to authenticate as admin.',
              { 
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "Back to Menu", callback_data: "menu" }]
                  ]
                }
              }
            );
            break;
            
          case 'verify_channel':
            // Show channel verification form
            await ctx.reply(
              '🔍 *Verify Channel ID*\n\n' +
              'Please enter a channel ID to verify if the bot has access to it.\n\n' +
              'To get your channel ID:\n' +
              '1. Add the bot to your channel as admin\n' +
              '2. Forward a message from your channel to @username_to_id_bot\n' +
              '3. Copy the ID (usually starts with -100...)\n\n' +
              'Enter the command: /verify_channel [channel_id]',
              { parse_mode: 'Markdown' }
            );
            break;
        }
      } catch (error) {
        console.error('Error handling callback query:', error);
        await ctx.reply(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    // Command to verify channel access
    this.bot.command('verify_channel', async (ctx) => {
      try {
        const text = ctx.message.text;
        const args = text.split(' ');
        
        if (args.length < 2) {
          await ctx.reply(
            '❌ Please provide a channel ID to verify.\n\n' +
            'Example: /verify_channel -1001234567890'
          );
          return;
        }
        
        const channelId = args[1].trim();
        
        // Format the channel ID
        const formattedChannelId = this.formatChannelId(channelId);
        
        await ctx.reply(
          `🔍 *Verifying Channel ID*\n\n` +
          `Original ID: \`${channelId}\`\n` +
          `Formatted ID: \`${formattedChannelId}\`\n\n` +
          `Attempting to verify access...`,
          { parse_mode: 'Markdown' }
        );
        
        try {
          // Now try to send a test message to the channel
          await this.bot.telegram.sendMessage(
            formattedChannelId, 
            'CHANNEL_VERIFICATION: This is a test message to verify bot access to this channel.',
            { disable_notification: true }
          );
          
          // If we get here, the message was sent successfully
          await ctx.reply(
            `✅ *Verification Successful!*\n\n` +
            `The bot has successfully sent a message to the channel with ID: \`${formattedChannelId}\`\n\n` +
            `You can now use this channel for storage with:\n` +
            `/channel enable ${formattedChannelId}`,
            { 
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ 
                    text: "Enable Channel Storage", 
                    callback_data: `channel_enable:${formattedChannelId}` 
                  }],
                  [{ text: "Back to Menu", callback_data: "menu" }]
                ]
              }
            }
          );
        } catch (error) {
          // Failed to send the message
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          let troubleshooting = "";
          if (errorMessage.includes("chat not found")) {
            troubleshooting = 
              "Possible reasons:\n" +
              "1. The channel ID is incorrect\n" +
              "2. The bot is not a member of the channel\n" +
              "3. Make sure you added the bot as an admin to the channel";
          } else if (errorMessage.includes("forbidden")) {
            troubleshooting = 
              "The bot doesn't have permission to post in this channel.\n" +
              "Make sure the bot is an admin with the permission to post messages.";
          }
          
          await ctx.reply(
            `❌ *Verification Failed*\n\n` +
            `Error: ${errorMessage}\n\n` +
            `${troubleshooting}\n\n` +
            `Try with another channel ID or check the bot's permissions.`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (error) {
        console.error('Error in verify_channel command:', error);
        await ctx.reply(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    // Add a verifychannel command (alternative to verify_channel)
    this.bot.command('verifychannel', async (ctx) => {
      try {
        const text = ctx.message.text;
        const args = text.split(' ');
        
        if (args.length < 2) {
          await ctx.reply(
            '❌ Please provide a channel ID to verify.\n\n' +
            'Example: /verifychannel -1001234567890'
          );
          return;
        }
        
        const channelId = args[1].trim();
        
        // Format the channel ID
        const formattedChannelId = this.formatChannelId(channelId);
        
        await ctx.reply(
          `🔍 *Verifying Channel ID*\n\n` +
          `Original ID: \`${channelId}\`\n` +
          `Formatted ID: \`${formattedChannelId}\`\n\n` +
          `Attempting to verify access...`,
          { parse_mode: 'Markdown' }
        );
        
        try {
          // Now try to send a test message to the channel
          await this.bot.telegram.sendMessage(
            formattedChannelId, 
            'CHANNEL_VERIFICATION: This is a test message to verify bot access to this channel.',
            { disable_notification: true }
          );
          
          // If we get here, the message was sent successfully
          await ctx.reply(
            `✅ *Verification Successful!*\n\n` +
            `The bot has successfully sent a message to the channel with ID: \`${formattedChannelId}\`\n\n` +
            `You can now use this channel for storage with:\n` +
            `/channel enable ${formattedChannelId}`,
            { 
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ 
                    text: "Enable Channel Storage", 
                    callback_data: `channel_enable:${formattedChannelId}` 
                  }],
                  [{ text: "Back to Menu", callback_data: "menu" }]
                ]
              }
            }
          );
        } catch (error) {
          // Failed to send the message
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          let troubleshooting = "";
          if (errorMessage.includes("chat not found")) {
            troubleshooting = 
              "Possible reasons:\n" +
              "1. The channel ID is incorrect\n" +
              "2. The bot is not a member of the channel\n" +
              "3. Make sure you added the bot as an admin to the channel";
          } else if (errorMessage.includes("forbidden")) {
            troubleshooting = 
              "The bot doesn't have permission to post in this channel.\n" +
              "Make sure the bot is an admin with the permission to post messages.";
          }
          
          await ctx.reply(
            `❌ *Verification Failed*\n\n` +
            `Error: ${errorMessage}\n\n` +
            `${troubleshooting}\n\n` +
            `Try with another channel ID or check the bot's permissions.`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (error) {
        console.error('Error in verifychannel command:', error);
        await ctx.reply(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    
    // Help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        '❓ *Help Information*\n\n' +
        'This bot allows you to manage your WovIeX service.\n\n' +
        '*Commands:*\n' +
        '/menu - Show main menu\n' +
        '/stats - Show system statistics\n' +
        '/settings - Show and change settings\n' +
        '/domains - Manage whitelisted domains\n' +
        '/cache - Manage video cache\n' +
        '/logs - View recent logs\n' +
        '/channel - Configure channel storage\n' +
        '/verifychannel <channelId> - Verify channel access\n\n' +
        '*Channel Storage:*\n' +
        'The bot can use a Telegram channel as database backup.\n' +
        'Use /channel to configure this feature.\n' +
        'Before enabling storage, use /verifychannel to test connectivity.\n\n' +
        '*Admin Authentication:*\n' +
        'Use /admin <password> to authenticate as admin.',
        { parse_mode: 'Markdown' }
      );
    });
    
    // Channel command - configures channel storage
    this.bot.command('channel', async (ctx) => {
      const channelStatus = this.isChannelStorageEnabled() 
        ? `✅ Enabled (ID: ${this.channelStorage.channelId})` 
        : '❌ Disabled';
      
      await ctx.reply(
        '📢 *Channel Storage*\n\n' +
        `Status: ${channelStatus}\n\n` +
        'Commands:\n' +
        '/channel enable <channelId> - Enable channel storage\n' +
        '/channel disable - Disable channel storage\n' +
        '/channel status - Show current status',
        { parse_mode: 'Markdown' }
      );
    });
    
    // Process command arguments for settings, channel, etc.
    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text;
      
      // Handle settings command with arguments
      if (text.startsWith('/settings ')) {
        const args = text.split(' ');
        if (args.length >= 3) {
          const setting = args[1].toLowerCase();
          const value = args[2].toLowerCase();
          
          try {
            const currentSettings = await storageInstance?.getScraperSettings();
            if (!currentSettings) {
              await ctx.reply('⚠️ Failed to get current settings');
              return;
            }
            
            let updatedSettings: Partial<ScraperSettings> = {};
            
            if (setting === 'timeout' && !isNaN(parseInt(value))) {
              updatedSettings.timeout = parseInt(value);
            } else if (setting === 'retry') {
              updatedSettings.autoRetry = (value === 'on' || value === 'true');
            } else if (setting === 'cache') {
              updatedSettings.cacheEnabled = (value === 'on' || value === 'true');
            } else if (setting === 'ttl' && !isNaN(parseInt(value))) {
              updatedSettings.cacheTTL = parseInt(value);
            } else {
              await ctx.reply('⚠️ Invalid setting or value format');
              return;
            }
            
            const newSettings = await storageInstance?.updateScraperSettings(updatedSettings);
            await ctx.reply(`✅ Settings updated successfully:\n${JSON.stringify(newSettings, null, 2)}`);
          } catch (error) {
            await ctx.reply(`⚠️ Error updating settings: ${error instanceof Error ? error.message : String(error)}`);
          }
          return;
        }
      }
      
      // Handle channel command with arguments
      if (text.startsWith('/channel ')) {
        const args = text.split(' ');
        if (args.length >= 2) {
          const action = args[1].toLowerCase();
          
          if (action === 'enable' && args.length >= 3) {
            const channelId = args[2];
            
            // Validate the channel ID format
            if (!channelId.startsWith('-') || !/^-\d+$/.test(channelId)) {
              await ctx.reply('❌ Invalid channel ID format. Channel ID should start with "-" followed by numbers (e.g., -1001234567890)');
              return;
            }
            
            try {
              // First, try to validate the channel by sending a test message
              try {
                if (!this.bot) {
                  throw new Error('Bot instance not available');
                }
                
                await this.bot.telegram.sendMessage(
                  channelId, 
                  'CHANNEL_TEST: Testing channel access...',
                  { disable_notification: true }
                );
                
                // If we get here, the message was sent successfully
                console.log(`Successfully sent test message to channel ${channelId}`);
              } catch (error) {
                const channelError = error as Error;
                console.error(`Failed to send test message to channel ${channelId}:`, channelError);
                await ctx.reply(`❌ Could not access channel with ID ${channelId}. Make sure:\n\n1. The channel ID is correct\n2. The bot is a member of the channel\n3. The bot has permission to send messages\n\nError: ${channelError.message}`);
                return;
              }
              
              // We can successfully message the channel, now enable storage
              console.log('Calling enableChannelStorage with channel ID:', channelId);
              const success = await this.enableChannelStorage(channelId);
              
              if (success) {
                await ctx.reply(`✅ Channel storage successfully enabled with ID: ${channelId}`);
              } else {
                await ctx.reply('❌ Failed to enable channel storage. Please check server logs for details.');
              }
            } catch (error) {
              const err = error as Error;
              console.error('Error enabling channel storage via bot command:', err);
              await ctx.reply(`❌ Error enabling channel storage: ${err.message}`);
            }
            return;
          } else if (action === 'disable') {
            this.disableChannelStorage();
            await ctx.reply('✅ Channel storage disabled');
            return;
          } else if (action === 'status') {
            const status = this.isChannelStorageEnabled() 
              ? `✅ Enabled (ID: ${this.channelStorage.channelId})` 
              : '❌ Disabled';
            await ctx.reply(`Channel storage status: ${status}`);
            return;
          } else {
            // Invalid command format
            await ctx.reply('❓ Invalid channel command. Use:\n/channel enable <channelId>\n/channel disable\n/channel status');
            return;
          }
        }
      }
      
      // Handle admin authentication
      if (text.startsWith('/admin ')) {
        const password = text.split(' ')[1];
        if (this.verifyAdminPassword(password)) {
          this.adminUsers.add(ctx.from.id);
          await ctx.reply('✅ Admin access granted');
        } else {
          await ctx.reply('❌ Invalid admin password');
        }
        return;
      }
      
      // Handle domains command with arguments
      if (text.startsWith('/domains ')) {
        const args = text.split(' ');
        if (args.length >= 2) {
          const action = args[1].toLowerCase();
          
          // Check if user is admin for actions that modify data
          if ((action === 'add' || action === 'toggle' || action === 'delete') && !this.isAdminUser(ctx.from.id)) {
            await ctx.reply('❌ Admin authentication required. Use /admin <password> to authenticate first.');
            return;
          }
          
          if (action === 'add' && args.length >= 3) {
            // Add domain
            const domain = args.slice(2).join(' ').trim();
            
            console.log(`Attempting to add domain: ${domain} by user ${ctx.from.id} (isAdmin: ${this.isAdminUser(ctx.from.id)})`);
            
            try {
              const newDomain = await storageInstance?.createDomain({
                domain,
                active: true
              });
              
              await ctx.reply(`✅ Domain added successfully: ${domain}`);
              return;
            } catch (error) {
              await ctx.reply(`⚠️ Error adding domain: ${error instanceof Error ? error.message : String(error)}`);
              return;
            }
          } else if (action === 'toggle' && args.length >= 3) {
            // Toggle domain status
            const id = parseInt(args[2]);
            if (isNaN(id)) {
              await ctx.reply('⚠️ Invalid domain ID');
              return;
            }
            
            try {
              const updatedDomain = await storageInstance?.toggleDomainStatus(id);
              if (!updatedDomain) {
                await ctx.reply(`⚠️ Domain with ID ${id} not found`);
                return;
              }
              
              await ctx.reply(`✅ Domain ${id} is now ${updatedDomain.active ? 'active' : 'inactive'}`);
              return;
            } catch (error) {
              await ctx.reply(`⚠️ Error toggling domain: ${error instanceof Error ? error.message : String(error)}`);
              return;
            }
          } else if (action === 'delete' && args.length >= 3) {
            // Delete domain
            const id = parseInt(args[2]);
            if (isNaN(id)) {
              await ctx.reply('⚠️ Invalid domain ID');
              return;
            }
            
            try {
              const success = await storageInstance?.deleteDomain(id);
              if (!success) {
                await ctx.reply(`⚠️ Domain with ID ${id} not found`);
                return;
              }
              
              await ctx.reply(`✅ Domain ${id} deleted successfully`);
              return;
            } catch (error) {
              await ctx.reply(`⚠️ Error deleting domain: ${error instanceof Error ? error.message : String(error)}`);
              return;
            }
          } else if (action === 'list') {
            // Trigger the /domains command to show the list
            if (this.bot) {
              await this.bot.handleUpdate({
                update_id: 0,
                message: {
                  message_id: 0,
                  date: 0,
                  chat: ctx.chat,
                  from: ctx.from,
                  text: '/domains'
                }
              });
            } else {
              await ctx.reply('⚠️ Cannot list domains: Bot instance not available');
            }
            return;
          }
        }
      }
      
      // Handle cache command with arguments
      if (text.startsWith('/cache ')) {
        const args = text.split(' ');
        if (args.length >= 2) {
          const action = args[1].toLowerCase();
          
          if (action === 'clear') {
            // Clear the entire cache
            try {
              await videoScraperInstance?.clearCache();
              
              await ctx.reply('✅ Cache cleared successfully');
              return;
            } catch (error) {
              await ctx.reply(`⚠️ Error clearing cache: ${error instanceof Error ? error.message : String(error)}`);
              return;
            }
          } else if (action === 'refresh' && args.length >= 3) {
            // Refresh a specific video
            const videoId = args[2];
            
            try {
              const refreshedVideo = await videoScraperInstance?.refreshCache(videoId);
              
              if (!refreshedVideo) {
                await ctx.reply(`⚠️ Failed to refresh video: ${videoId}`);
                return;
              }
              
              await ctx.reply(`✅ Video refreshed successfully: ${videoId}`);
              return;
            } catch (error) {
              await ctx.reply(`⚠️ Error refreshing video: ${error instanceof Error ? error.message : String(error)}`);
              return;
            }
          }
        }
      }
      
      // Handle logs command with arguments
      if (text.startsWith('/logs ')) {
        const args = text.split(' ');
        if (args.length >= 2) {
          const action = args[1].toLowerCase();
          
          if (action === 'clear') {
            // Clear all logs
            try {
              await storageInstance?.clearLogs();
              
              await ctx.reply('✅ Logs cleared successfully');
              return;
            } catch (error) {
              await ctx.reply(`⚠️ Error clearing logs: ${error instanceof Error ? error.message : String(error)}`);
              return;
            }
          }
        }
      }
      
      // Fallback for unrecognized commands
      if (text.startsWith('/') && 
          !['/start', '/menu', '/stats', '/settings', '/domains', '/cache', '/logs', '/channel', '/help', '/admin']
            .some(cmd => text.startsWith(cmd))) {
        await ctx.reply(
          '⚠️ Unknown command. Use /menu to see available commands.',
          {
            reply_markup: {
              keyboard: [[{ text: '/menu' }]],
              resize_keyboard: true
            }
          }
        );
      }
    });
  }
  
  /**
   * Check if user ID is in admin list
   */
  private isAdminUser(userId: number): boolean {
    return this.adminUsers.has(userId);
  }
  
  /**
   * Verify admin password
   */
  private verifyAdminPassword(password: string): boolean {
    const adminPassword = process.env.TELEGRAM_ADMIN_PASSWORD;
    return !!adminPassword && password === adminPassword;
  }
  
  /**
   * Start the bot
   */
  async start() {
    try {
      // If already running, just return
      if (this.isRunning) {
        console.log('Telegram bot is already running');
        return;
      }
      
      // If we have an existing bot instance, stop it first to avoid conflicts
      if (this.bot) {
        try {
          await this.bot.stop();
          console.log('Stopped existing Telegram bot instance');
        } catch (stopError) {
          console.warn('Could not stop existing bot instance:', stopError);
        }
        
        // Wait a moment before restarting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Initialize or re-initialize the bot
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token || token.length < 10) {
        console.log('No valid Telegram bot token found');
        return;
      }
      
      this.initializeBot(token);
      
      if (!this.bot) {
        throw new Error('Failed to initialize bot');
      }
      
      // Try to launch the bot with retry logic for conflict errors
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          // Determine if we're running in a VPS/cloud environment 
          // This detects Koyeb/Cloudflare/similar serverless environments
          const isServerlessEnv = process.env.KOYEB_APP_NAME || 
                                 process.env.CF_PAGES || 
                                 process.env.VERCEL || 
                                 process.env.NETLIFY;
          
          // Use webhook mode in cloud/VPS environments, polling in development
          if (isServerlessEnv) {
            // For webhook mode, we need a public URL
            const webhookDomain = process.env.PUBLIC_URL || process.env.APP_URL;
            
            if (webhookDomain) {
              const webhookUrl = `${webhookDomain}/api/telegram-webhook`;
              console.log(`Starting Telegram bot in webhook mode: ${webhookUrl}`);
              
              // Set webhook and launch in webhook mode
              await this.bot.telegram.setWebhook(webhookUrl);
              
              // For webhook mode, we'll handle the updates through the Express route
              console.log('Webhook set successfully, waiting for updates via HTTP endpoint');
            } else {
              console.log('No webhook domain found, falling back to polling mode');
              await this.bot.launch({
                dropPendingUpdates: true
              });
            }
          } else {
            // Standard polling mode for development
            console.log('Starting Telegram bot in polling mode');
            await this.bot.launch({
              dropPendingUpdates: true
            });
          }
          
          this.isRunning = true;
          console.log('Telegram bot started successfully');
          
          if (storageInstance) {
            storageInstance.createLog({
              level: 'INFO',
              source: 'Telegram',
              message: 'Telegram bot started'
            });
          }
          
          // If channel ID is set, enable storage
          if (this.channelStorage.channelId) {
            // Use async/await within an IIFE
            (async () => {
              try {
                console.log(`Trying to enable channel storage with ID: ${this.channelStorage.channelId}`);
                const success = await this.enableChannelStorage(this.channelStorage.channelId);
                console.log(`Channel storage ${success ? 'successfully enabled' : 'failed to enable'} with ID: ${this.channelStorage.channelId}`);
              } catch (error) {
                console.error('Error enabling channel storage on bot start:', error);
              }
            })();
          }
          
          return;
        } catch (launchError) {
          retryCount++;
          
          // Check if this is a conflict error
          const isConflictError = 
            typeof launchError === 'object' && 
            launchError !== null && 
            'message' in launchError && 
            typeof launchError.message === 'string' && 
            (launchError.message.includes('Conflict') || 
             launchError.message.includes('409'));
          
          if (isConflictError && retryCount < maxRetries) {
            console.log(`Bot conflict detected (attempt ${retryCount}/${maxRetries}), waiting before retry...`);
            
            // Wait longer between retries
            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          } else {
            // For non-conflict errors or if we've reached max retries, log and throw
            throw launchError;
          }
        }
      }
      
      throw new Error(`Failed to start bot after ${maxRetries} retries`);
    } catch (error) {
      console.error('Failed to start Telegram bot:', error);
      this.isRunning = false;
      
      if (storageInstance) {
        storageInstance.createLog({
          level: 'ERROR',
          source: 'Telegram',
          message: `Failed to start Telegram bot: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
  }
  
  /**
   * Stop the bot
   */
  async stop() {
    if (!this.bot || !this.isRunning) return;
    
    try {
      this.bot.stop();
      this.isRunning = false;
      
      if (storageInstance) {
        storageInstance.createLog({
          level: 'INFO',
          source: 'Telegram',
          message: 'Telegram bot stopped'
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to stop Telegram bot:', error);
      if (storageInstance) {
        storageInstance.createLog({
          level: 'ERROR',
          source: 'Telegram',
          message: `Failed to stop Telegram bot: ${error instanceof Error ? error.message : String(error)}`
        });
      }
      
      return false;
    }
  }
  
  /**
   * Check if the bot is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
  
  /**
   * Get the bot instance for direct access (e.g., webhook handling)
   */
  getBot(): Telegraf | null {
    return this.bot;
  }
  
  /**
   * Verify if a channel ID is valid and the bot has access to it
   * @param channelId - The ID to verify
   * @returns Promise<{valid: boolean, message: string}> - Result of verification
   */
  /**
   * Format channel ID correctly for Telegram API
   * @param channelId 
   * @returns Properly formatted channel ID
   */
  private formatChannelId(channelId: string): string {
    // If it's already properly formatted, return as is
    if (channelId.startsWith('-100') && channelId.length > 5) {
      return channelId;
    }
    
    // If it's a regular channel ID with just a dash prefix
    if (channelId.startsWith('-') && !channelId.startsWith('-100')) {
      return `-100${channelId.substring(1)}`;
    }
    
    // If it's just a numeric ID without any prefix
    if (/^\d+$/.test(channelId)) {
      return `-100${channelId}`;
    }
    
    // If it contains the @ symbol (username), we can't format it
    if (channelId.includes('@')) {
      return channelId; // Can't convert usernames to IDs
    }
    
    // Default case - return as is
    return channelId;
  }

  async verifyChannelAccess(channelId: string): Promise<{valid: boolean, message: string, correctedId?: string}> {
    if (!this.bot) {
      return { valid: false, message: "Bot is not active" };
    }
    
    try {
      // Format the channel ID properly
      const formattedChannelId = this.formatChannelId(channelId);
      
      console.log(`Verifying channel access for ID: ${channelId} (formatted as: ${formattedChannelId})`);
      
      // Attempt to send a test message to verify access
      await this.bot.telegram.sendMessage(
        formattedChannelId,
        'CHANNEL_ACCESS_TEST: Verifying channel access...',
        { disable_notification: true }
      );
      
      return { 
        valid: true, 
        message: "Channel access verified successfully",
        correctedId: formattedChannelId !== channelId ? formattedChannelId : undefined
      };
    } catch (error) {
      console.error('Channel verification error:', error);
      
      // More informative error message
      let errorMessage = error instanceof Error ? error.message : String(error);
      let troubleshootingSteps = "";
      
      if (errorMessage.includes("chat not found")) {
        troubleshootingSteps = "\n\nPossible causes:\n1. The channel ID is incorrect\n2. The bot is not a member of the channel\n3. The bot needs to be added as an administrator to the channel";
      } else if (errorMessage.includes("forbidden")) {
        troubleshootingSteps = "\n\nThe bot doesn't have permission to post in this channel. Make sure the bot is an admin with posting privileges.";
      }
      
      return { 
        valid: false, 
        message: `Channel verification failed: ${errorMessage}${troubleshootingSteps}`
      };
    }
  }

  /**
   * Enable Telegram channel as database storage
   * @param channelId - The ID of the Telegram channel to use for storage
   * @returns Promise<boolean> - True if channel storage was successfully enabled
   */
  async enableChannelStorage(channelId?: string): Promise<boolean> {
    console.log('Enabling channel storage with ID:', channelId || 'none provided');
    console.log('Current storage state:', JSON.stringify(this.channelStorage));
    console.log('Bot instance available:', !!this.bot);
    console.log('Bot running:', this.isRunning);
    
    try {
      // If bot is not running, try to start it
      if (!this.isRunning || !this.bot) {
        console.log('Bot not running. Attempting to start bot before enabling channel storage...');
        try {
          await this.start();
          console.log('Bot started successfully. Continuing with channel storage setup.');
        } catch (err) {
          console.error('Failed to start bot for channel storage:', err);
          
          if (storageInstance) {
            storageInstance.createLog({
              level: 'ERROR',
              source: 'Telegram',
              message: `Failed to start bot for channel storage: ${err instanceof Error ? err.message : String(err)}`
            });
          }
          return false;
        }
      }
      
      // Format and validate the channel ID
      let formattedChannelId: string;
      
      if (channelId) {
        // Format the provided ID properly
        formattedChannelId = this.formatChannelId(channelId);
        console.log('Processing provided channel ID:', channelId);
        console.log('Formatted as:', formattedChannelId);
        
        this.channelStorage.channelId = formattedChannelId;
      } else if (process.env.TELEGRAM_CHANNEL_ID) {
        // Format ID from environment variable if available
        const envChannelId = process.env.TELEGRAM_CHANNEL_ID;
        formattedChannelId = this.formatChannelId(envChannelId);
        console.log('Using channel ID from environment variable:', envChannelId);
        console.log('Formatted as:', formattedChannelId);
        
        this.channelStorage.channelId = formattedChannelId;
      } else {
        // No channel ID available
        console.error('Cannot enable channel storage: No channel ID provided and none stored');
        return false;
      }
      
      // Verify channel access with a test message before enabling
      try {
        if (!this.bot) {
          console.error('Bot instance not available even after start attempt');
          return false;
        }
        
        console.log('Verifying channel access by sending test message to:', this.channelStorage.channelId);
        
        // Try to verify channel access
        const verificationResult = await this.verifyChannelAccess(this.channelStorage.channelId);
        
        if (!verificationResult.valid) {
          console.error('Channel verification failed:', verificationResult.message);
          
          if (storageInstance) {
            storageInstance.createLog({
              level: 'ERROR',
              source: 'Telegram',
              message: `Channel verification failed: ${verificationResult.message}`
            });
          }
          return false;
        }
        
        // If verification returned a corrected ID, update it
        if (verificationResult.correctedId) {
          console.log('Using corrected channel ID:', verificationResult.correctedId);
          this.channelStorage.channelId = verificationResult.correctedId;
        }
        
        console.log('Channel verification successful');
      } catch (err) {
        const error = err as Error;
        console.error('Failed to verify channel access:', error);
        
        if (storageInstance) {
          storageInstance.createLog({
            level: 'ERROR',
            source: 'Telegram',
            message: `Failed to connect to channel: ${error.message || 'Unknown error'}`
          });
        }
        return false;
      }
      
      // If we reach here, the channel is accessible
      this.channelStorage.enabled = true;
      
      // Verify it was properly enabled
      const isEnabled = this.isChannelStorageEnabled();
      console.log('Channel storage status:', 
        isEnabled ? 'Enabled' : 'Not enabled',
        'with channel ID:', this.channelStorage.channelId || 'none');
      
      // Send confirmation message to the channel
      if (isEnabled && this.bot) {
        try {
          await this.bot.telegram.sendMessage(
            this.channelStorage.channelId, 
            '✅ CHANNEL STORAGE ENABLED: This channel will now be used for database storage.',
            { disable_notification: true }
          );
          
          // Log successful channel connection
          if (storageInstance) {
            storageInstance.createLog({
              level: 'INFO',
              source: 'Telegram',
              message: `Connected to Telegram channel with ID: ${this.channelStorage.channelId}`
            });
          }
          
          return true;
        } catch (error) {
          console.error('Failed to send confirmation message to channel:', error);
          return isEnabled; // Still return true if we enabled it
        }
      }
      
      return isEnabled;
    } catch (error) {
      console.error('Unexpected error enabling channel storage:', error);
      
      if (storageInstance) {
        storageInstance.createLog({
          level: 'ERROR',
          source: 'Telegram',
          message: `Unexpected error enabling channel storage: ${error instanceof Error ? error.message : String(error)}`
        });
      }
      
      return false;
    }
  }
  
  /**
   * Disable Telegram channel as database storage
   */
  disableChannelStorage(): void {
    this.channelStorage.enabled = false;
  }
  
  /**
   * Save data to Telegram channel
   * This method serializes data to JSON and sends it as a message to the configured Telegram channel
   */
  async saveToChannel<T>(key: string, data: T): Promise<boolean> {
    console.log('Attempting to save data to Telegram channel:', {
      channelId: this.channelStorage.channelId,
      botActive: !!this.bot && this.isRunning,
      storageEnabled: this.channelStorage.enabled,
      isChannelStorageEnabled: this.isChannelStorageEnabled()
    });

    // Check if storage is enabled
    if (!this.isChannelStorageEnabled()) {
      console.log('Telegram channel storage is disabled - not saving data for key:', key);
      return false;
    }
    
    if (!this.channelStorage.channelId) {
      console.log('No channel ID configured - not saving data for key:', key);
      return false;
    }
    
    // Don't try to auto-start the bot during a save - this creates circular dependencies
    if (!this.bot || !this.isRunning) {
      console.log('Telegram bot not running - not saving data for key:', key);
      return false;
    }
    
    try {
      const messageText = `DATA:${key}\n${JSON.stringify(data, null, 2)}`;
      console.log(`Sending message to channel ${this.channelStorage.channelId}`);
      
      // Use sendMessage directly to the channel
      await this.bot.telegram.sendMessage(this.channelStorage.channelId, messageText);
      console.log(`Successfully saved data to Telegram channel for key: ${key}`);
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to save data to Telegram channel: ${errorMessage}`);
      
      // Provide detailed diagnostic info
      console.error('Channel storage failure details:', {
        channelId: this.channelStorage.channelId,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorStack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      // Disable channel storage after consistent failures
      if (error instanceof Error && error.message && 
          (error.message.includes('chat not found') || 
           error.message.includes('Bad Request') || 
           error.message.includes('chat_id is undefined'))) {
        console.log('Disabling Telegram channel storage due to persistent errors');
        this.disableChannelStorage();
      }
      
      if (storageInstance) {
        storageInstance.createLog({
          level: 'ERROR',
          source: 'Telegram',
          message: `Failed to save data to channel: ${errorMessage}`
        });
      }
      
      return false;
    }
  }
  
  /**
   * Save a video to the Telegram channel
   */
  async saveVideo(video: Video): Promise<boolean> {
    return this.saveToChannel(`video:${video.videoId}`, video);
  }
  
  /**
   * Save a domain to the Telegram channel
   */
  async saveDomain(domain: Domain): Promise<boolean> {
    return this.saveToChannel(`domain:${domain.id}`, domain);
  }
  
  /**
   * Save a log to the Telegram channel
   */
  async saveLog(log: Log): Promise<boolean> {
    return this.saveToChannel(`log:${log.id}`, log);
  }
  
  /**
   * Save settings to the Telegram channel
   */
  async saveSettings(settings: ScraperSettings): Promise<boolean> {
    return this.saveToChannel('settings', settings);
  }
  
  /**
   * Check if channel storage is enabled
   */
  isChannelStorageEnabled(): boolean {
    return !!this.channelStorage.enabled && !!this.channelStorage.channelId;
  }

  /**
   * Get the current channel ID for storage
   */
  getChannelId(): string | null {
    return this.channelStorage.channelId || null;
  }
}

export const telegramBot = new TelegramBot();