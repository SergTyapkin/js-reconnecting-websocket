/**
 * @module
 * @description WebSocket-клиент с автоматическим переподключением,
 * типизированными обработчиками событий и event-data форматом сообщений
 */

/**
 * Обработчик для определенного типа входящего сообщения
 * @template T - тип данных, ожидаемых в сообщении
 */
export type WSEventHandler<T = unknown, TF = object> = (data: T, fullData: TF, event: MessageEvent) => void;
export type WSAllEventHandler<TF = object> = (fullData: TF, event: MessageEvent) => void;

/**
 * Конфигурация WebSocket-клиента
 */
export interface WSConfig {
  /** URL для подключения */
  url: string;
  /** Поддерживаемые протоколы */
  protocols?: string | string[];
  /** Имя поля с типом события в сообщении */
  eventFieldName?: string;
  /** Имя поля с данными в сообщении */
  dataFieldName?: string;
  /** Базовая задержка перед переподключением (мс) */
  reconnectTimeout?: number;
  /** Таймаут на установку соединения (мс) */
  connectTimeout?: number;
  /** Максимальная задержка перед переподключением (мс) */
  maxReconnectTimeout?: number;
  /** Множитель увеличения задержки переподключения */
  backoffMultiplier?: number;
  /** Автоматически открывать соединение после создания */
  autoOpen?: boolean;
  /** Колбэк при открытии соединения */
  onOpen?: (event: Event) => void;
  /** Колбэк при закрытии соединения */
  onClose?: (event: CloseEvent) => void;
  /** Колбэк при ошибке */
  onError?: (event: Event) => void;
  /** Уровень логирования */
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'none';
}

/**
 * Сообщение WebSocket
 */
interface WSMessage {
  [field: string]: any;
}

/**
 * Дефолтные значения конфигурации
 */
const DEFAULT_CONFIG: Required<Omit<WSConfig, 'url' | 'protocols' | 'onOpen' | 'onClose' | 'onError'>> = {
  eventFieldName: 'type',
  dataFieldName: 'data',
  reconnectTimeout: 1000,
  connectTimeout: 2000,
  maxReconnectTimeout: 10000,
  backoffMultiplier: 2,
  autoOpen: false,
  logLevel: 'info',
};

/**
 * Класс-менеджер WebSocket-соединения с автоматическим переподключением
 */
export default class WS {
  private ws: WebSocket | null = null;
  private readonly config: Required<Omit<WSConfig, 'protocols' | 'onOpen' | 'onClose' | 'onError'>> & Pick<WSConfig, 'protocols' | 'onOpen' | 'onClose' | 'onError'>;
  private handlers: Map<string, WSEventHandler> = new Map();
  private allMessagesHandlers: Set<WSAllEventHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentReconnectTimeout: number;
  private _closed = true;
  private resolveConnectionPromise: (() => void) | null = null;
  private rejectConnectionPromise: (() => void) | null = null;

  constructor(config: WSConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentReconnectTimeout = this.config.reconnectTimeout;

    if (this.config.autoOpen) {
      this.open();
    }
  }

  /**
   * Открывает WebSocket-соединение
   */
  open(): Promise<void> {
    const connectionPromise = new Promise<void>((resolve, reject) => {
        this.resolveConnectionPromise = resolve;
        this.rejectConnectionPromise = reject;
    });

    if (!this._closed) {
      this.log('warn', 'Connection already open or opening');

      this.rejectConnectionPromise!();
      return connectionPromise;
    }

    this._closed = false;
    this.cleanup();

    try {
      this.ws = new WebSocket(this.config.url, this.config.protocols);
    } catch (error) {
      this.log('error', 'Failed to create WebSocket:', error);
    }

    this.setupConnectTimeout();
    this.setupEventHandlers();
    return connectionPromise;
  }

  /**
   * Отправляет сообщение в открытое соединение
   */
  sendEventData(event: string, data: unknown = {}): void {
    if (!this.isConnected()) {
      this.log('warn', `Cannot send message - socket not connected. Event: ${event}`);
      return;
    }

    const message: WSMessage = {
      [this.config.eventFieldName]: event,
      [this.config.dataFieldName]: data,
    };

    this.log('debug', 'Sending message:', message);
    this.ws!.send(JSON.stringify(message));
  }

  /**
   * Отправляет сообщение в открытое соединение
   */
  send(data: object | string): void {
    if (!this.isConnected()) {
      this.log('warn', `Cannot send message - socket not connected. Data: ${data}`);
      return;
    }
    this.log('debug', 'Sending message:', data);
    
    try {
        const message = typeof data === 'object' ? JSON.stringify(data) : data;
        
        this.ws!.send(message);
    } catch (e) {
        this.log('error', 'Failed to send message:', e);
    }
  }

  /**
   * Регистрирует обработчик для указанного события
   */
  on<T = unknown>(event: string, handler: WSEventHandler<T>): () => void {
    this.handlers.set(event, handler as WSEventHandler);
    
    // Возвращаем функцию для отписки
    return () => {
      this.off(event);
    };
  }

  /**
   * Регистрирует обработчик для любого события
   */
  onAny<T = object>(handler: WSAllEventHandler<T>): () => void {
    this.allMessagesHandlers.add(handler as WSAllEventHandler);
    
    // Возвращаем функцию для отписки
    return () => {
      this.offAny(handler);
    };
  }

  /**
   * Удаляет обработчик для любого события
   */
  offAny<T = object>(handler: WSAllEventHandler<T>) {
    this.allMessagesHandlers.delete(handler as WSAllEventHandler);
  }

  /**
   * Удаляет обработчик для указанного события
   */
  off(event: string): void {
    this.handlers.delete(event);
  }

  /**
   * Проверяет, зарегистрирован ли обработчик для события
   */
  hasHandler(event: string): boolean {
    return this.handlers.has(event);
  }

  /**
   * Закрывает соединение
   */
  close(code?: number, reason?: string): void {
    this._closed = true;
    this.cleanup();

    if (this.ws) {
      this.ws.close(code, reason);
      this.ws = null;
    }
  }

  /**
   * Удаляет все обработчики событий
   */
  clearHandlers(): void {
    this.handlers.clear();
    this.allMessagesHandlers.clear();
  }

  /**
   * Проверяет, открыто ли соединение
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Проверяет, создан ли экземпляр WebSocket
   */
  isCreated(): boolean {
    return this.ws !== null;
  }

  /**
   * Возвращает текущее состояние соединения
   */
  getReadyState(): number | null {
    return this.ws?.readyState ?? null;
  }

  private setupConnectTimeout(): void {
    this.connectTimer = setTimeout(() => {
      if (this.ws?.readyState === WebSocket.CONNECTING) {
        this.log('warn', 'Connection timeout, closing socket');
        this.ws.close();
      }
    }, this.config.connectTimeout);
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = (event: Event) => {
      this.resolveConnectionPromise!();
      this.log('info', `Connected to ${this.config.url}`);
      this.currentReconnectTimeout = this.config.reconnectTimeout;
      this.clearTimer(this.connectTimer);
      this.config.onOpen?.(event);
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.log('info', `Connection closed: ${event.code} ${event.reason}`);
      this.config.onClose?.(event);
      
      if (!this._closed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event: Event) => {
      this.log('error', 'WebSocket error occurred');
      this.config.onError?.(event);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event);
    };
  }

  private handleMessage(event: MessageEvent): void {
    let message: WSMessage;
    
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      this.log('error', 'Failed to parse message:', event.data);
      return;
    }

    this.log('debug', 'Received message:', message);

    // Вызываем обработчики для всех событий
    this.allMessagesHandlers.forEach(handler => {
      handler(message, event);
    });

    // Вызываем обработчики для событий
    const eventName = message[this.config.eventFieldName];
    
    if (eventName === undefined) {
      this.log('warn', `Message missing event field "${this.config.eventFieldName}"`);
      return;
    }

    const handler = this.handlers.get(eventName);
    
    if (!handler) {
      this.log('warn', `No handler for event: ${eventName}`, 'Available handlers:', this.getHandlerNames());
      return;
    }

    try {
      handler(message[this.config.dataFieldName], message, event);
    } catch (error) {
      this.log('error', `Handler error for event "${eventName}":`, error);
    }
  }

  private scheduleReconnect(): void {
    this.clearTimer(this.reconnectTimer);
    
    this.reconnectTimer = setTimeout(() => {
      if (this._closed || this.isConnected()) return;
      
      this.log('info', `Reconnecting (delay: ${this.currentReconnectTimeout}ms)...`);
      this.open();
      
      this.currentReconnectTimeout = Math.min(
        this.currentReconnectTimeout * this.config.backoffMultiplier,
        this.config.maxReconnectTimeout
      );
    }, this.currentReconnectTimeout);
  }

  private cleanup(): void {
    this.clearTimer(this.connectTimer);
    this.clearTimer(this.reconnectTimer);
  }

  private clearTimer(timer: ReturnType<typeof setTimeout> | null): void {
    if (timer) {
      clearTimeout(timer);
    }
  }

  private getHandlerNames(): string[] {
    return Array.from(this.handlers.keys());
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', ...args: unknown[]): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };
    const configLevel = this.config.logLevel;
    
    if (levels[level] >= levels[configLevel]) {
      const prefix = `[WS ${level.toUpperCase()}]`;
      
      switch (level) {
        case 'debug':
          console.debug(prefix, ...args);
          break;
        case 'info':
          console.info(prefix, ...args);
          break;
        case 'warn':
          console.warn(prefix, ...args);
          break;
        case 'error':
          console.error(prefix, ...args);
          break;
      }
    }
  }
}
