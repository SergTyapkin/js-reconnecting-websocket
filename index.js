// Make Vue plugin: vue.use(<imported WS>);
export default {
    install: (app, url) => {
        app.config.globalProperties.$ws = new WS(url);
    }
}

const
    DEFAULT_EVENT_FIELD_NAME = 'event',
    DEFAULT_DATA_FIELD_NAME = 'data';

const CONNECT_TIMEOUT = 2000;

const BASE_RECONNECT_TIMEOUT = 1000;
const MAX_RECONNECT_TIMEOUT = 4 * 1000;


export class WS {
    ws = undefined;
    url = "";
    protocols = undefined;
    eventFieldName = '';
    dataFieldName = '';

    onopen = (e) => {console.log(`WS connection to ${this.url} opened`, e)};
    onclose = (e) => {console.log(`WS connection to ${this.url} closed`, e)};
    onerror = (e) => {console.log(`WS error in ${this.url}`, e)};
    handlers = {
        // some_event(received_data) => {...},
        // ...
        // more events that will come from server
    }
    closed = true;

    constructor(url, reconnectTimeout = BASE_RECONNECT_TIMEOUT, maxReconnectTimeout = MAX_RECONNECT_TIMEOUT, eventFieldName = DEFAULT_EVENT_FIELD_NAME, dataFieldName = DEFAULT_DATA_FIELD_NAME, protocols = undefined) {
        this.url = url;
        this.protocols = protocols;
        this.eventFieldName = eventFieldName;
        this.dataFieldName = dataFieldName;

        this.reconnectTimeout = reconnectTimeout;
        this.maxReconnectTimeout = maxReconnectTimeout;
    }

    open() {
        this.closed = false;
        this.ws = new WebSocket(this.url, this.protocols);
        setTimeout(function() {
            if (this.ws.readyState === 0) {
                this.ws.close();
            }
        }.bind(this), CONNECT_TIMEOUT);

        this.ws.onopen = (e) => {
            this.reconnectTimeout = BASE_RECONNECT_TIMEOUT;
            this.onopen(e);
        }
        this.ws.onerror = (e) => {
            this.onerror(e);
        }
        this.ws.onclose = (e) => {
            this.onclose(e);

            setTimeout(function() {
                if ((this.ws.readyState === 1) || (this.closed)) {
                    return;
                }
                this.open();
                if (this.reconnectTimeout < this.maxReconnectTimeout) {
                    this.reconnectTimeout *= 2;
                } else {
                    this.reconnectTimeout = this.maxReconnectTimeout;
                }
            }.bind(this), this.reconnectTimeout);
        }
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log("WS GOT MESSAGE:", message);

            const eventName = message[this.eventFieldName];
            if (eventName !== undefined) {
                if (this.handlers[eventName] === undefined) {
                    console.log(`WS WARNING: unknown event: ${eventName}`);
                    console.log("Active handlers:", this.handlers);
                    return;
                }
                this.handlers[eventName](message[this.dataFieldName], event);
            }
        }
    }

    send(event, data) {
        console.log("WS SEND MESSAGE:", event, data);
        const m = {};
        m[this.eventFieldName] = event;
        m[this.dataFieldName] = data;
        this.ws.send(JSON.stringify(m));
    }

    close(status, reason) {
        this.ws?.close(status, reason);
        this.closed = true;
    }

    clearHandlers() {
        this.handlers = {};
    }
}
