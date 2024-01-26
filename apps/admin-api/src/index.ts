import dotenv from 'dotenv'
import { setLoggerConfig, getLogger } from 'protolib/base/logger';
setLoggerConfig({ name: "admin-api" })
require('events').EventEmitter.defaultMaxListeners = 100;

// get config vars
dotenv.config({ path: '../../.env' });

import aedes from 'aedes';
import http from 'http';
import WebSocket, { Server } from 'ws';
import net from 'net';
import getApp from './api'
import { generateEvent } from 'app/bundles/library'

const logger = getLogger()
const isProduction = process.env.NODE_ENV === 'production';

const start = async () => {
  const aedesInstance = new aedes();
  const server = http.createServer(await getApp());

  // Crea un WebSocket server
  const wss = new Server({ noServer: true });

  wss.on('connection', (ws: WebSocket) => {
    const stream = WebSocket.createWebSocketStream(ws, { decodeStrings: false });
    aedesInstance.handle(stream as any);
  });

  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/websocket') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  const PORT = isProduction ? 4002 : 3002

  server.listen(PORT, () => {
    logger.info({ service: { protocol: "http", port: PORT } }, "Service started: HTTP")
  });

  const mqttServer = net.createServer((socket) => {
    aedesInstance.handle(socket);
  });

  const mqttPort = isProduction ? 8883 : 1883
  mqttServer.listen(mqttPort, () => {
    logger.info({ service: { protocol: "mqtt", port: mqttPort } }, "Service started: MQTT")
  });

  // generateEvent({
  //   path: 'services/start/adminapi', //event type: / separated event category: files/create/file, files/create/dir, devices/device/online
  //   from: 'api', // system entity where the event was generated (next, api, cmd...)
  //   user: 'system', // the original user that generates the action, 'system' if the event originated in the system itself
  //   payload: {}, // event payload, event-specific data
  // })
}

start()