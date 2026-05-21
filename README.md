# 🔄 Reconnecting WebSocket

![Static Badge](https://img.shields.io/badge/Vue.js-plugin-green)
![npm](https://img.shields.io/npm/dt/%40sergtyapkin%2Freconnecting-websocket)
[![npm version](https://img.shields.io/npm/v/@sergtyapkin/reconnecting-websocket.svg)](https://www.npmjs.com/package/@sergtyapkin/reconnecting-websocket)

Надёжный WebSocket-клиент на TypeScript с автоматическим переподключением, событийно-ориентированным API и поддержкой Vue 3.

## ✨ Возможности

- 🔁 **Автоматическое переподключение** с экспоненциальной задержкой (exponential backoff)
- 🎯 **Событийно-ориентированный API** — сообщения маршрутизируются по имени события
- 📦 **Два режима отправки** — `sendEventData()` для форматированных сообщений и `send()` для произвольных данных
- 🛡️ **Полная типизация** — написано на TypeScript с дженериками для данных
- 🧩 **Vue 3 плагин** — `$ws` в любом компоненте через глобальные свойства или inject
- 🔍 **Детальное логирование** с уровнями: debug, info, warn, error, none

## 📦 Установка

```bash
npm install @sergtyapkin/reconnecting-websocket
```

```bash
yarn add @sergtyapkin/reconnecting-websocket
```

```bash
pnpm add @sergtyapkin/reconnecting-websocket
```

```bash
bun add @sergtyapkin/reconnecting-websocket
```

## 🚀 Быстрый старт

### Базовое использование

```typescript
import WS from '@sergtyapkin/reconnecting-websocket';

// Создаём клиент с конфигурацией
const ws = new WS({
  url: 'wss://echo.websocket.org',
  autoOpen: true, // Автоматически открыть соединение
});

// Регистрируем обработчики событий
ws.on('message', (data) => {
  console.log('Получено сообщение:', data);
});

ws.on('userJoined', (user) => {
  console.log(`Пользователь ${user.name} присоединился`);
});

// Если не использовали autoOpen, открываем вручную
// await ws.open();

// Отправляем форматированные сообщения (event + data)
ws.sendEventData('chatMessage', { text: 'Привет всем!', userId: 42 });
ws.sendEventData('typing', { isTyping: true });

// Или отправляем произвольные данные
ws.send({ type: 'customEvent', payload: 'hello' });
ws.send('plain text message');

// Закрываем соединение, когда нужно
ws.close();
```

### Событийная модель

Клиент поддерживает два режима работы с сообщениями:

**1. Форматированные сообщения через `sendEventData()`:**

Отправка:
```typescript
ws.sendEventData('chatMessage', { text: 'Привет!', from: 'Анна' });
```

Приём (сервер должен отправлять JSON с полями event/data):
```json
{
  "type": "chatMessage",
  "data": {
    "text": "Привет!",
    "from": "Анна"
  }
}
```

**2. Произвольные сообщения через `send()`:**

```typescript
ws.send({ customField: 'value' });
ws.send('plain string');
```

### Обработчики событий

```typescript
// Регистрация обработчика с типизацией
const unsubscribe = ws.on<{ text: string; from: string }>('chatMessage', (data, fullMessage, originalEvent) => {
  console.log('Данные:', data);           // { text: 'Привет!', from: 'Анна' }
  console.log('Всё сообщение:', fullMessage); // { type: 'chatMessage', data: {...} }
  console.log('Исходный event:', originalEvent); // MessageEvent
});

// Проверка наличия обработчика
if (ws.hasHandler('chatMessage')) {
  console.log('Обработчик зарегистрирован');
}

// Удаление обработчика
ws.off('chatMessage');
// или через возвращаемую функцию
unsubscribe();

// Удаление всех обработчиков
ws.clearHandlers();
```

## ⚙️ Конфигурация

Все параметры передаются в едином объекте конфигурации:

```typescript
const ws = new WS({
  url: 'wss://example.com/ws',        // URL для подключения (обязательно)
  
  // Настройки соединения
  protocols: 'chat-v1',               // Подпротокол WebSocket
  autoOpen: false,                    // Автоматически открывать соединение
  connectTimeout: 2000,               // Таймаут на установку соединения (мс)
  
  // Настройки переподключения
  reconnectTimeout: 1000,             // Базовая задержка переподключения (мс)
  maxReconnectTimeout: 10000,         // Максимальная задержка (мс)
  backoffMultiplier: 2,               // Множитель увеличения задержки
  
  // Настройки формата сообщений
  eventFieldName: 'type',             // Имя поля с типом события (по умолчанию 'type')
  dataFieldName: 'data',              // Имя поля с данными (по умолчанию 'data')
  
  // Колбэки
  onOpen: (event) => console.log('Соединение открыто'),
  onClose: (event) => console.log('Соединение закрыто', event.code, event.reason),
  onError: (event) => console.error('Ошибка соединения'),
  
  // Логирование
  logLevel: 'info',                   // 'debug' | 'info' | 'warn' | 'error' | 'none'
});
```

### Алгоритм переподключения

После обрыва соединения клиент пытается переподключиться с возрастающей задержкой:

```
Попытка 1: 1000ms  ██
Попытка 2: 2000ms  ████
Попытка 3: 4000ms  ████████
Попытка 4: 8000ms  ████████████████
Попытка 5: 10000ms ████████████████████  ← capped at maxReconnectTimeout
```

При успешном соединении счётчик сбрасывается.

## 🧩 Интеграция с Vue 3

### Установка плагина

```typescript
// main.ts
import { createApp } from 'vue';
import WSPlugin from '@sergtyapkin/reconnecting-websocket/vue-plugin';
import App from './App.vue';

const app = createApp(App);

// Устанавливаем плагин с конфигурацией
app.use(WSPlugin, {
  url: 'wss://example.com/ws',
  autoOpen: false,
  logLevel: 'info',
});

app.mount('#app');
```

### Использование в Composition API

```vue
<template>
  <div>
    <button @click="sendMessage">Отправить сообщение</button>
    <p v-if="connected">🟢 Онлайн</p>
    <p v-else>🔴 Офлайн</p>
    <ul>
      <li v-for="msg in messages" :key="msg.id">{{ msg.text }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted } from 'vue';
import type WS from '@sergtyapkin/reconnecting-websocket';

const messages = ref<Array<{ id: number; text: string }>>([]);
const connected = ref(false);

// Получаем экземпляр WS через inject
const ws = inject<WS>('ws')!;

onMounted(async () => {
  // Настраиваем колбэки
  ws.config.onOpen = () => {
    connected.value = true;
    ws.sendEventData('join', { room: 'general' });
  };
  
  ws.config.onClose = () => {
    connected.value = false;
  };
  
  // Регистрируем обработчики
  ws.on('newMessage', (data: any) => {
    messages.value.push(data);
  });
  
  // Открываем соединение
  await ws.open();
});

onUnmounted(() => {
  ws.close();
});

function sendMessage() {
  ws.sendEventData('chatMessage', { text: 'Привет из Vue!', timestamp: Date.now() });
}
</script>
```

### Options API

```vue
<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  data() {
    return {
      messages: [] as any[],
      connected: false,
    };
  },
  mounted() {
    // Доступ через this.$ws
    this.$ws.config.onOpen = () => {
      this.connected = true;
    };
    
    this.$ws.config.onClose = () => {
      this.connected = false;
    };
    
    this.$ws.on('newMessage', (data: any) => {
      this.messages.push(data);
    });
    
    this.$ws.open();
  },
  beforeUnmount() {
    this.$ws.close();
  },
});
</script>
```

### Типизация для TypeScript

Создайте файл `env.d.ts` в корне Vue-проекта:

```typescript
/// <reference types="@sergtyapkin/reconnecting-websocket/vue" />
```

Теперь `this.$ws` и `inject('ws')` полностью типизированы во всех компонентах.

## 🔧 Продвинутое использование

### Асинхронное открытие соединения

```typescript
const ws = new WS({ url: 'wss://example.com' });

// Настраиваем обработчики до открытия
ws.on('auth', handleAuth);
ws.on('data', handleData);
ws.onAny(handleAll);

// open() возвращает Promise, который разрешится при успешном подключении
try {
  await ws.open();
  console.log('Соединение установлено');
  ws.sendEventData('auth', { token: 'jwt-token' });
} catch (error) {
  console.error('Не удалось подключиться');
}
```

### Проверка состояния соединения

```typescript
// Проверка, открыто ли соединение
if (ws.isConnected()) {
  // Соединение открыто и готово к отправке
}

// Проверка, создан ли экземпляр WebSocket
if (ws.isCreated()) {
  // Экземпляр существует (может быть в состоянии CONNECTING, OPEN, CLOSING, CLOSED)
}

// Получение конкретного состояния
const state = ws.getReadyState();
// WebSocket.CONNECTING (0), WebSocket.OPEN (1), WebSocket.CLOSING (2), WebSocket.CLOSED (3)
```

### Отправка разных типов сообщений

```typescript
// Форматированное сообщение с event и data полями
ws.sendEventData('update', { field: 'status', value: 'active' });

// Объект (будет сериализован в JSON)
ws.send({ type: 'custom', payload: { id: 1 } });

// Строка (будет отправлена как есть)
ws.send('plain text message');
```

### Получение полного сообщения

```typescript
ws.on('eventName', (data, fullMessage, originalEvent) => {
  // data - распарсенные данные из поля dataFieldName
  // fullMessage - полное распарсенное JSON-сообщение
  // originalEvent - оригинальный MessageEvent браузера
  console.log('Все поля сообщения:', Object.keys(fullMessage));
});

ws.onAny(fullMessage, originalEvent) => {
  // originalEvent - оригинальный MessageEvent браузера
  console.log('Все поля сообщения:', Object.keys(fullMessage));
});
```

## 🔌 Логирование

```typescript
// Подробное логирование для отладки
const ws = new WS({
  url: 'wss://example.com',
  logLevel: 'debug',
});
// [WS DEBUG] Sending message: ...
// [WS DEBUG] Received message: ...
// [WS INFO] Connected to wss://example.com
// [WS WARN] No handler for event: unknownEvent
```

```typescript
// Отключение логирования
const ws = new WS({
  url: 'wss://example.com',
  logLevel: 'none',
});
```

## 🧪 Тестирование

```typescript
// Мок для тестов
class MockWebSocket {
  readyState = 0; // CONNECTING
  onopen: Function | null = null;
  onclose: Function | null = null;
  onerror: Function | null = null;
  onmessage: Function | null = null;
  
  constructor(url: string) {
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.(new Event('open'));
    }, 10);
  }
  
  send(data: string) {}
  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.(new CloseEvent('close'));
  }
}

// Использование в тестах
(global as any).WebSocket = MockWebSocket;

import WS from '@sergtyapkin/reconnecting-websocket';

const ws = new WS({ url: 'wss://test', autoOpen: true });
// ...
```

## 📚 API

### `new WS(config)`

Создаёт новый WebSocket-клиент.

**Параметры конструктора:**

| Параметр | Тип | Обязательный | Описание |
|----------|-----|--------------|----------|
| `url` | `string` | Да | URL для подключения |
| `protocols` | `string | string[]` | Нет | Подпротоколы WebSocket |
| `autoOpen` | `boolean` | Нет | Автоматически открывать соединение (по умолчанию `false`) |
| `reconnectTimeout` | `number` | Нет | Базовая задержка переподключения в мс (по умолчанию `1000`) |
| `maxReconnectTimeout` | `number` | Нет | Максимальная задержка переподключения в мс (по умолчанию `10000`) |
| `backoffMultiplier` | `number` | Нет | Множитель увеличения задержки (по умолчанию `2`) |
| `connectTimeout` | `number` | Нет | Таймаут установки соединения в мс (по умолчанию `2000`) |
| `eventFieldName` | `string` | Нет | Имя поля события в сообщении (по умолчанию `'type'`) |
| `dataFieldName` | `string` | Нет | Имя поля данных в сообщении (по умолчанию `'data'`) |
| `onOpen` | `(event: Event) => void` | Нет | Колбэк при открытии соединения |
| `onClose` | `(event: CloseEvent) => void` | Нет | Колбэк при закрытии соединения |
| `onError` | `(event: Event) => void` | Нет | Колбэк при ошибке |
| `logLevel` | `'debug' | 'info' | 'warn' | 'error' | 'none'` | Нет | Уровень логирования (по умолчанию `'info'`) |

### Методы

| Метод | Возвращает | Описание |
|-------|------------|----------|
| `open()` | `Promise<void>` | Открыть соединение. Возвращает промис, который разрешается при успешном подключении |
| `close(code?, reason?)` | `void` | Закрыть соединение |
| `send(data)` | `void` | Отправить произвольные данные (объект или строку) |
| `sendEventData(event, data)` | `void` | Отправить форматированное сообщение с событием и данными |
| `on<T>(event, handler)` | `() => void` | Зарегистрировать обработчик события. Возвращает функцию для удаления |
| `onAny<T>(handler)` | `() => void` | Зарегистрировать обработчик на любое сообщение. Возвращает функцию для удаления |
| `off(event)` | `void` | Удалить обработчик события |
| `hasHandler(event)` | `boolean` | Проверить наличие обработчика для события |
| `clearHandlers()` | `void` | Удалить все обработчики событий |
| `isConnected()` | `boolean` | Проверяет, открыто ли соединение (readyState === OPEN) |
| `isCreated()` | `boolean` | Проверяет, создан ли экземпляр WebSocket |
| `getReadyState()` | `number | null` | Возвращает текущее состояние соединения |

## 📄 Лицензия

MIT © [Sergey Tyapkin](https://github.com/SergTyapkin)