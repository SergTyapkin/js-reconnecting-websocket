import WS, { WSConfig } from ".";

/**
 * Vue 3 плагин для интеграции WebSocket-клиента
 */
export default {
  install(app: any, config: WSConfig): void {
    const wsClient = new WS(config);
    app.config.globalProperties.$ws = wsClient;
    
    // Добавляем поддержку Options API через inject
    app.provide('ws', wsClient);
  },
};
