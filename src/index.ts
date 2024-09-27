/**
 * @module
 * @description вебсокет-клиент с переподключением через заданное время,
 * удобным назначением коллбэков и event-data форматом сообщений
 */

import './additionToVueApp.ts';

/**
 * Хэндлер, который можно добавить на определенный тип входящего сообщения
 * @callback CallbackWSHandler
 * @param receivedData - данные из входящего сообщения, взятые из поля для данных
 */
type CallbackWSHandler = (receivedData: any, event: MessageEvent<any>) => void
/**
 * Объект с парами "имя_события": коллбэк.
 * При получении сообщения коллбэк для его обработки ищется в этом объекте
 */
type CallbackWSHandlersObject = {
    [index: string]: CallbackWSHandler
}


// Make Vue plugin: vue.use(<imported WS>);
export default {
    install: (app: any, url: string) => {
        app.config.globalProperties.$ws = new WS(url);
    }
}

/**
 * Имя по умолчанию для поля типа события в каждом сообщении
 * @type {string}
 */
const DEFAULT_EVENT_FIELD_NAME = 'event';
/**
 * Имя по умолчанию для поля данных сообщения в каждом сообщении
 * @type {string}
 */
const DEFAULT_DATA_FIELD_NAME = 'data';

/**
 * Время между неудачныыми попытками подключения по умолчанию
 * @type {number}
 */
const CONNECT_TIMEOUT = 2000;

/**
 * Время переподключения после разрыва соединения по умолчанию
 * @type {number}
 */
const BASE_RECONNECT_TIMEOUT = 1000;
/**
 * После неудачных попыток соединения подряд, время переподключения увеличивается в 2 раза
 * Это максимальное время переподключения по умолчанию
 * @type {number}
 */
const MAX_RECONNECT_TIMEOUT = 4 * 1000;


/**
 * @class
 * @description Класс-менеджер вебсокет-соединения
 */
export class WS {
    /**
     * Объект браузерного вебсокет-соединения
     */
    ws?: WebSocket
    /**
     * URL, по которому открывается соединение
     */
    url: string
    /**
     * Поддерживаемые протоколы соединения.
     * Если не указано, то используются стандартные для объекта WebSocket
     */
    protocols?: string
    /**
     * Имя поля, отвечающего за название типа каждого сообщения
     */
    eventFieldName: string
    /**
     * Имя поля, отвечающего за данные, отправляемые с каждым сообщением
     */
    dataFieldName: string
    /**
     * Через сколько времени в миллисекундах будет произведена попытка переподключения после разрыва соединения
     */
    reconnectTimeout: number

    /**
     * Коллбэк, вызывающийся при успешном открытии соединения.
     * По умолчанию выводит сообщение об открытии
     */
    onopen = (e: Event) => {console.log(`WS connection to ${this.url} opened`, e)};
    /**
     * Коллбэк, вызывающийся при закрытии соединения по любой причине.
     * По умолчанию выводит сообщение о закрытии
     */
    onclose = (e: Event) => {console.log(`WS connection to ${this.url} closed`, e)};
    /**
     * Коллбэк, вызывающийся при ошибки во время соединения.
     * По умолчанию выводит сообщение об ошибке
     */
    onerror = (e: Event) => {console.log(`WS error in ${this.url}`, e)};

    /**
     * Объект с парами "имя_события": коллбэк.
     * При получении сообщения коллбэк для его обработки ищется в этом объекте
     */
    handlers: CallbackWSHandlersObject = {
        // some_event: (receivedData) => {...},
        // ...
        // more events that will come from server
    }
    /**
     * Закрыто ли соединение в данный момент
     */
    closed: boolean = true;

    /**
     * @param url - полный адрес, по которому открывается соединение
     * @param reconnectTimeout - время переподключения после разрыва соединения в миллисекундах
     * @param eventFieldName - имя поля в каждом сообщении, определяющее тип события
     * @param dataFieldName - имя поля в каждом сообщении, в котором передаются данные сообщения
     * @param protocols - список доступных протоколов подключения. По умолчанию используется стандартный для браузерного WebSocket
     */
    constructor(url: string, reconnectTimeout: number = BASE_RECONNECT_TIMEOUT, eventFieldName: string = DEFAULT_EVENT_FIELD_NAME, dataFieldName: string = DEFAULT_DATA_FIELD_NAME, protocols?: string) {
        this.url = url;
        this.protocols = protocols;
        this.eventFieldName = eventFieldName;
        this.dataFieldName = dataFieldName;

        this.reconnectTimeout = reconnectTimeout;
    }

    /**
     * Открывает вебсокет-соединение с заданными в конструкторе параметрами
     */
    open() {
        this.closed = false;
        this.ws = new WebSocket(this.url, this.protocols); // Открываем браузерное соединение
        setTimeout(function(this: WS) { // Через `CONNECT_TIMEOUT` проверяем, открылось ли соединение. Если нет - закрываем
            if (!this.isCreated()) {
                return;
            }
            if (this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close();
            }
        }.bind(this), CONNECT_TIMEOUT);

        this.ws.onopen = (e) => { // при успешном открытии возвращаем время реконнекта к изначальнмоу
            this.reconnectTimeout = BASE_RECONNECT_TIMEOUT;
            this.onopen(e);
        }
        this.ws.onerror = (e) => {
            this.onerror(e);
        }
        this.ws.onclose = (e) => {
            this.onclose(e);

            setTimeout(function (this: WS) { // через `this.reconnectTimeout` коннектимся заново
                if (!this.isCreated() || (this.ws.readyState === WebSocket.OPEN) || (this.closed)) { // Если уже открыто или вообще открывать не надо - выходим из функции
                    return;
                }
                this.open();
                if (this.reconnectTimeout < MAX_RECONNECT_TIMEOUT) { // Увеличиваем время реконнекта в 2 раза
                    this.reconnectTimeout *= 2;
                } else {
                    this.reconnectTimeout = MAX_RECONNECT_TIMEOUT; // Но время реконнекта не больше максимального времени
                }
            }.bind(this), this.reconnectTimeout);
        }
        this.ws.onmessage = (event) => { // При получении сообщения
            const message = JSON.parse(event.data); // Парсим через JSON всё из поля для данных
            console.log("WS GOT MESSAGE:", message);

            const eventName = message[this.eventFieldName]; // Берем название типа сообщения
            if (eventName === undefined) {
                return;
            }
            if (this.handlers[eventName] === undefined) { // Обработчика на такое событие нет
                console.log(`WS WARNING: unknown event: ${eventName}`);
                console.log("Active handlers:", this.handlers);
                return;
            }
            this.handlers[eventName](message[this.dataFieldName], event); // Вызываем обработчик по этому событию, передавая ему данные
        }
    }

    /**
     * Отправить сообщение в открытие соединение
     * @param event - название события
     * @param data - данные сообщения
     */
    send(event: string, data: object | string) {
        if (!this.isCreated()) {
            return;
        }
        if (this.ws.readyState !== WebSocket.OPEN) {
            console.log(`WS WARNING: trying to send message but WS is not opened: event: ${event}, data: ${data}`);
            return;
        }
        console.log("WS SEND MESSAGE:", event, data);
        const message = {
            [this.eventFieldName]: event,
            [this.dataFieldName]: data,
        };
        this.ws.send(JSON.stringify(message));
    }
    /**
     * Закрыть соединение
     * @param status - код закрытия соединения
     * @param reason - строка-описание, почему закрыто соединение
     */
    close(status?: number, reason?: string) {
        this.ws?.close(status, reason);
        this.closed = true;
    }

    /**
     * Очистить все записанные хэндлеры
     */
    clearHandlers() {
        this.handlers = {};
    }

    isCreated(): this is {ws: WebSocket} {
        return this.ws !== undefined;
    }
}
