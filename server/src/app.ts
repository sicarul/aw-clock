// #!/usr/bin/env node
/*
  Copyright © 2018-2021 Kerry Shetline, kerry@shetline.com

  MIT license: https://opensource.org/licenses/MIT

  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
  documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
  rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
  persons to whom the Software is furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
  Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
  WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
  COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { router as adminRouter } from './admin-router';
import { requestJson } from 'by-request';
import { execSync } from 'child_process';
import compareVersions from 'compare-versions';
import cookieParser from 'cookie-parser';
import { Daytime, DaytimeData, DEFAULT_DAYTIME_SERVER } from './daytime';
import express, { Router } from 'express';
import { router as forecastRouter } from './forecast-router';
import fs from 'fs';
import * as http from 'http';
import os from 'os';
import { asLines, isString, toBoolean } from '@tubular/util';
import logger from 'morgan';
import { DEFAULT_NTP_SERVER } from './ntp';
import { NtpPoller } from './ntp-poller';
import * as path from 'path';
import * as requestIp from 'request-ip';
import { DEFAULT_LEAP_SECOND_URLS, TaiUtc } from './tai-utc';
import { router as tempHumidityRouter, cleanUp } from './temp-humidity-router';
import { hasGps, jsonOrJsonp, noCache, normalizePort, timeStamp, unref } from './awcs-util';
import { Gps } from './gps';
import { AWC_VERSION, AwcDefaults, GpsData } from './shared-types';

const debug = require('debug')('express:server');
const ENV_FILE = '../.vscode/.env';
const RASPBERRY_PI_CONFIG = '/etc/default/weatherService';

try {
  const files = [RASPBERRY_PI_CONFIG, ENV_FILE];

  for (const file of files) {
    if (fs.existsSync(file)) {
      const lines = asLines(fs.readFileSync(file).toString());

      for (const line of lines) {
        const $ = /^\s*(\w+)\s*=\s*([^#]+)/.exec(line);

        if ($)
          process.env[$[1]] = $[2].trim();
      }
    }
  }
}
catch (err) {
  console.error('Failed check for environment file.');
}

// Convert deprecated environment variables
if (!process.env.AWC_WIRED_TH_GPIO &&
    toBoolean(process.env.AWC_HAS_INDOOR_SENSOR) && process.env.AWC_TH_SENSOR_GPIO)
  process.env.AWC_WIRED_TH_GPIO = process.env.AWC_TH_SENSOR_GPIO;

let indoorModule: any;
let indoorRouter: Router;

if (process.env.AWC_WIRED_TH_GPIO || process.env.AWC_ALT_DEV_SERVER) {
  indoorModule = require('./indoor-router');
  indoorRouter = indoorModule.router;
}

// Poll for software updates
const UPDATE_POLL_INTERVAL = 10800000; // 3 hours
const UPDATE_POLL_RETRY_TIME = 60_000; // 10 minutes
let updatePollTimer: any;
let latestVersion = process.env.AWC_FAKE_UPDATE_VERSION ?? AWC_VERSION;

async function checkForUpdate() {
  updatePollTimer = undefined;

  let delay = UPDATE_POLL_INTERVAL;

  try {
    const repoInfo = await requestJson('https://api.github.com/repos/kshetline/aw-clock/releases/latest', {
      headers: {
        'User-Agent': 'Astronomy/Weather Clock ' + AWC_VERSION
      }
    });
    const currentVersion = repoInfo?.tag_name?.replace(/^\D+/, '');

    if (currentVersion) {
      if (!currentVersion.endsWith('_nu'))
        latestVersion = currentVersion;
    }
    else // noinspection ExceptionCaughtLocallyJS
      throw new Error('Could not parse tag_name');
  }
  catch (e) {
    delay = UPDATE_POLL_RETRY_TIME;

    if (os.uptime() > 90)
      console.error('%s: Update info request failed: %s', timeStamp(), e.message ?? e.toString());
  }

  updatePollTimer = unref(setTimeout(checkForUpdate, delay));
}

if (!process.env.AWC_FAKE_UPDATE_VERSION)
  // noinspection JSIgnoredPromiseFromCall
  checkForUpdate();

// Create HTTP server
const devMode = process.argv.includes('-d');
const allowAdmin = toBoolean(process.env.AWC_ALLOW_ADMIN);
const allowCors = toBoolean(process.env.AWC_ALLOW_CORS) || devMode;
const defaultPort = devMode ? 4201 : 8080;
const httpPort = normalizePort(process.env.AWC_PORT || defaultPort);
const app = getApp();
let httpServer: http.Server;
const MAX_START_ATTEMPTS = 3;
let startAttempts = 0;

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGUSR2', shutdown);
process.on('unhandledRejection', err => console.error(`${timeStamp()} -- Unhandled rejection:`, err));

createAndStartServer();

const ntpServer = process.env.AWC_NTP_SERVER || DEFAULT_NTP_SERVER;
const ntpPoller = new NtpPoller(ntpServer);
const daytimeServer = process.env.AWC_DAYTIME_SERVER || DEFAULT_DAYTIME_SERVER;
const daytime = new Daytime(daytimeServer);
const leapSecondsUrl = process.env.AWC_LEAP_SECONDS_URL || DEFAULT_LEAP_SECOND_URLS;
let taiUtc = new TaiUtc(leapSecondsUrl);
let gps: Gps;

if (process.env.AWC_DEBUG_TIME) {
  const parts = process.env.AWC_DEBUG_TIME.split(';'); // UTC-time [;optional-leap-second]
  ntpPoller.setDebugTime(new Date(parts[0]), Number(parts[1] || 0));
  const debugDelta = Date.now() - new Date(parts[0]).getTime();
  taiUtc = new TaiUtc(leapSecondsUrl, () => Date.now() - debugDelta);
}
// GPS time disabled when using AWC_DEBUG_TIME
else
  hasGps().then(hasIt => gps = hasIt ? new Gps(taiUtc) : null);

function createAndStartServer(): void {
  console.log(`*** Starting server on port ${httpPort} at ${timeStamp()} ***`);
  httpServer = http.createServer(app);
  httpServer.on('error', onError);
  httpServer.on('listening', onListening);
  httpServer.listen(httpPort);
}

function onError(error: any) {
  if (error.syscall !== 'listen')
    throw error;

  const bind = isString(httpPort) ? 'Pipe ' + httpPort : 'Port ' + httpPort;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');

      if (!canReleasePortAndRestart())
        process.exit(1);

      break;
    default:
      throw error;
  }
}

function onListening() {
  const addr = httpServer.address();
  const bind = isString(addr) ? 'pipe ' + addr : 'port ' + addr.port;

  debug('Listening on ' + bind);
}

function canReleasePortAndRestart(): boolean {
  if (process.env.USER !== 'root' || !toBoolean(process.env.AWC_LICENSED_TO_KILL) || ++startAttempts > MAX_START_ATTEMPTS)
    return false;

  try {
    const lines = asLines(execSync('netstat -pant').toString());

    for (const line of lines) {
      const $ = new RegExp(String.raw`^tcp.*:${httpPort}\b.*\bLISTEN\b\D*(\d+)\/node`).exec(line);

      if ($) {
        const signal = (startAttempts > 1 ? '-9 ' : '');

        console.warn('%s -- Killing process: %s', timeStamp(), $[1]);
        execSync(`kill ${signal}${$[1]}`);
        unref(setTimeout(createAndStartServer, 3000));

        return true;
      }
    }
  }
  catch (err) {
    console.log(`${timeStamp()} -- Failed to kill process using port ${httpPort}: ${err}`);
  }

  return false;
}

function shutdown(signal?: string) {
  if (devMode && signal === 'SIGTERM')
    return;

  if (updatePollTimer)
    clearTimeout(updatePollTimer);

  console.log(`\n*** ${signal ? signal + ': ' : ''}closing server at ${timeStamp()} ***`);
  // Make sure that if the orderly clean-up gets stuck, shutdown still happens.
  unref(setTimeout(() => process.exit(0), 5000));
  httpServer.close(() => process.exit(0));
  cleanUp();

  if (gps)
    gps.close();

  NtpPoller.closeAll();
}

function getApp() {
  const theApp = express();

  theApp.use(logger('[:date[iso]] :remote-addr - :remote-user ":method :url HTTP/:http-version" :status :res[content-length] :response-time'));
  theApp.use(express.json());
  theApp.use(express.urlencoded({ extended: false }));
  theApp.use(cookieParser());
  theApp.use(express.static(path.join(__dirname, 'public')));
  theApp.get('/', (req, res) => {
    res.send('Static home file not found');
  });

  if (allowCors) {
    // see: http://stackoverflow.com/questions/7067966/how-to-allow-cors-in-express-nodejs
    theApp.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      // intercept OPTIONS method
      if (req.method === 'OPTIONS')
        res.send(200);
      else {
        next();
      }
    });
  }

  if (allowAdmin)
    theApp.use('/admin', adminRouter);


  theApp.use('/forecast', forecastRouter);
  theApp.use('/wireless-th', tempHumidityRouter);

  if (indoorRouter)
    theApp.use('/indoor', indoorRouter);
  else {
    theApp.get('/indoor', (req, res) => {
      console.warn('%s: Indoor temp/humidity sensor not available.', timeStamp());
      jsonOrJsonp(req, res, { temperature: 0, humidity: -1, error: 'n/a' });
    });
  }

  theApp.get('/defaults', async (req, res) => {
    noCache(res);

    const ip = requestIp.getClientIp(req);
    const defaults: AwcDefaults = {
      indoorOption: (indoorModule?.hasWiredIndoorSensor() ? 'D' : 'X'),
      outdoorOption: (process.env.AWC_WIRELESS_TH_GPIO ? 'A' : 'F'),
      ip,
      allowAdmin: allowAdmin && /^(::1|::ffff:127\.0\.0\.1|127\.0\.0\.1|0\.0\.0\.0|localhost)$/i.test(ip),
      latestVersion,
      updateAvailable: /^\d+\.\d+\.\d+$/.test(latestVersion) &&
        compareVersions.compare(latestVersion, AWC_VERSION, '>')
    };

    if (gps) {
      let gpsInfo = gps.getGpsData();

      // Force a location update if city name not available yet.
      if (!gpsInfo.city) {
        await gps.checkLocation();
        gpsInfo = gps.getGpsData();
      }

      if (gpsInfo.latitude != null && gpsInfo.longitude != null) {
        defaults.latitude = Number(gpsInfo.latitude.toFixed(5));
        defaults.longitude = Number(gpsInfo.longitude.toFixed(5));
        defaults.city = gpsInfo.city || '';
      }
    }

    jsonOrJsonp(req, res, defaults);
  });

  theApp.get(/\/(ntp|time)/, (req, res) => {
    noCache(res);
    jsonOrJsonp(req, res, (gps || ntpPoller).getTimeInfo());
  });

  theApp.get('/daytime', async (req, res) => {
    noCache(res);

    let time: DaytimeData;

    try {
      time = await daytime.getDaytime();
    }
    catch (err) {
      res.status(500).send(err.toString());

      return;
    }

    if (req.query.callback)
      res.jsonp(time);
    else if (req.query.json != null)
      res.json(time);
    else
      res.send(time.text);
  });

  theApp.get('/tai-utc', async (req, res) => {
    noCache(res);
    jsonOrJsonp(req, res, await taiUtc.getCurrentDelta());
  });

  theApp.get('/ls-history', async (req, res) => {
    noCache(res);
    jsonOrJsonp(req, res, await taiUtc.getLeapSecondHistory());
  });

  theApp.get('/gps', async (req, res) => {
    noCache(res);

    let result: GpsData = { error: 'n/a', fix: 0, signalQuality: 0 };

    if (gps) {
      const coords = gps.getGpsData();

      if (coords?.fix === 0)
        result.error = 'no-signal';
      else if (coords?.latitude != null)
        result = coords;
    }

    jsonOrJsonp(req, res, result);
  });

  return theApp;
}
