# Reconnecting WebSocket
![Static Badge](https://img.shields.io/badge/Vue.js-plugin-green)
![npm](https://img.shields.io/npm/dt/%40sergtyapkin%2Freconnecting-websocket)


WebSocket that will try to reconnects to server when lost connection.

First reconnection attempt after `reconnectTimeout` milliseconds.
With each subsequent reconnection, the timeout will increase by `x2` but max reconnection timeout is `maxReconnectTimeout`.

Default values:
```JS
reconnectTimeout = 1000
maxReconnectTimeout = 4000
```

----
Example without Vue framework:
```JS
import WS from "@sergtyapkin/reconnecting-websocket";

WS.handlers.some_event = (jsonData) => {console.log(jsonData)};
// WS.onopen = (event) => {};
// WS.onerror = (event) => {};
// WS.onclose = (event) => {};

// to disable some handler
delete WS.handlers.some_event;
```

Example entrypoint using **Vue.js**:
```JS 
// index.js

import { createApp } from 'vue';
import App from './App.vue';
import WS from "@sergtyapkin/reconnecting-websocket";

const app = createApp(App)
  .use(WS, `wss://${location.host}/ws`)
  .mount('#app');

// Now WS class available in any child component by:
// this.$ws
```
