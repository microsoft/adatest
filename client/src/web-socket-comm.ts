import JSON5 from 'json5';
import autoBind from 'auto-bind';
import { defer, debounce } from 'lodash';
import { CommData } from './CommData';

export default class WebSocketComm {
  interfaceId: any;
  websocketServer: any;
  callbackMap: {};
  data: {};
  pendingData: {};
  onopen: any;
  reconnectDelay: number;
  debouncedSendPendingData500: any;
  debouncedSendPendingData1000: any;
  wcomm: WebSocket;

  constructor(interfaceId, websocketServer, onopen) {
    autoBind(this);
    this.interfaceId = interfaceId;
    this.websocketServer = websocketServer;
    this.callbackMap = {};
    this.data = {};
    this.pendingData = {};
    this.onopen = onopen;
    this.reconnectDelay = 100;

    this.debouncedSendPendingData500 = debounce(this.sendPendingData, 500);
    this.debouncedSendPendingData1000 = debounce(this.sendPendingData, 1000);

    this.connect();
  }

  send(keys, data) {
    this.addPendingData(keys, data);
    this.sendPendingData();
  }

  sendCommData(commData: CommData) {
    this.addPendingData("event_id", commData.event_id);
    this.addPendingData("data", commData.data);
    this.sendPendingData();
  }

  debouncedSend500(keys, data) {
    this.addPendingData(keys, data);
    this.debouncedSendPendingData500();
  }

  debouncedSend1000(keys, data) {
    this.addPendingData(keys, data);
    this.debouncedSendPendingData1000();
  }

  addPendingData(keys, data) {
    // console.log("addPendingData", keys, data);
    if (!Array.isArray(keys)) keys = [keys];
    for (const i in keys) {
      const k = keys[i];
      this.pendingData[k] = data;
      this.data[k] = Object.assign(this.data[k] || {}, data); // pretend it has already changed in our data cache
    }
  }

  connect() {
    let wsUri = (window.location.protocol=='https:' ? 'wss://' : 'ws://') + (this.websocketServer.startsWith("/") ? window.location.host : "") + this.websocketServer;
    this.wcomm = new WebSocket(wsUri);
    this.wcomm.onopen = this.onopen;
    this.wcomm.onmessage = this.updateData;
    this.wcomm.onerror = this.onError;
    this.wcomm.onclose = this.onClose;
  }

  updateData(e) {
    // console.log("updateData", e)
    let data = JSON5.parse(e.data);
    console.log("updateData", data)
    for (const k in data) {
      // console.log("data[k]", data[k])
      this.data[k] = Object.assign(this.data[k] || {}, data[k]);
      if (k in this.callbackMap) {
        this.callbackMap[k](data[k]);
      }
    }
  }

  onError(e) {
    console.log("Websocket error", e);
  }

  onClose(e) {
    console.log('Socket is closed. Reconnect will be attempted...', e.reason);
    setTimeout(this.connect, this.reconnectDelay);
    this.reconnectDelay += 1000;
  }

  subscribe(key, callback) {
    this.callbackMap[key] = callback;
    defer(_ => this.callbackMap[key](this.data[key]));
  }

  sendPendingData() {
    console.log("sending", this.pendingData);
    this.wcomm.send(JSON.stringify(this.pendingData));
    this.pendingData = {};
  }
}