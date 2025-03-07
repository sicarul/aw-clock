import { requestJson } from 'by-request';
import { getForecast as getDsForecast, THE_END_OF_DAYS } from './darksky-forecast';
import { Request, Response, Router } from 'express';
import { filterError, jsonOrJsonp, noCache, timeStamp } from './awcs-util';
import { ForecastData } from './shared-types';
import { getForecast as getWbForecast } from './weatherbit-forecast';
import { getForecast as getWuForecast } from './wunderground-forecast';
import { toBoolean, toNumber } from '@tubular/util';

export const router = Router();

function forecastBad(forecast: Error | ForecastData): boolean {
  return forecast instanceof Error || forecast.unavailable;
}

const log = toBoolean(process.env.AWC_LOG_CACHE_ACTIVITY);

router.get('/', async (req: Request, res: Response) => {
  const frequent = (process.env.AWC_FREQUENT_ID && req.query.id === process.env.AWC_FREQUENT_ID);
  const promises: Promise<ForecastData | Error>[] = [];
  let darkSkyIndex = 1;
  let weatherBitIndex = 1;
  let sources = 'WU';

  noCache(res);
  res.setHeader('cache-control', 'max-age=' + (frequent ? '240' : '840'));
  req.query.lat = req.query.lat && toNumber(req.query.lat).toFixed(4);
  req.query.lon = req.query.lon && toNumber(req.query.lon).toFixed(4);
  promises.push(getWuForecast(req));

  if (process.env.AWC_WEATHERBIT_API_KEY) {
    promises.push(getWbForecast(req));
    sources += ',WB';
    ++darkSkyIndex;
  }
  else
    weatherBitIndex = 0;

  if (process.env.AWC_DARK_SKY_API_KEY && Date.now() < THE_END_OF_DAYS) {
    sources += ',DS';
    promises.push(getDsForecast(req));
  }
  else
    darkSkyIndex = 0;

  const forecasts = await Promise.all(promises);
  let usedIndex: number;
  let forecast = forecasts[usedIndex =
    ({ darksky: darkSkyIndex, weatherbit: weatherBitIndex } as any)[process.env.AWC_PREFERRED_WS] ?? 0];
  const darkSkyForecast = !(forecasts[darkSkyIndex] instanceof Error) && forecasts[darkSkyIndex] as ForecastData;

  for (let replaceIndex = 0; replaceIndex < forecasts.length && (!forecast || forecastBad(forecast)); ++replaceIndex)
    forecast = forecasts[usedIndex = replaceIndex];

  console.log(timeStamp(), sources, usedIndex, forecasts.map(f => forecastResultCode(f)).join(''));

  if (log) {
    for (const forecast of forecasts) {
      if (forecast instanceof Error)
        console.error('    ' + filterError(forecast));
      else if (forecast.unavailable)
        console.error('    unavailable');
    }
  }

  if (forecastBad(forecast) && !process.env.AWC_WEATHERBIT_API_KEY) {
    const url = `https://weather.shetline.com/wbproxy?lat=${req.query.lat}&lon=${req.query.lon}&du=${req.query.du || 'f'}` +
      (req.query.id ? `&id=${req.query.id}` : '');

    try {
      forecast = (await requestJson(url, { timeout: 60000 })) as ForecastData;
    }
    catch (e) {
      forecast = e;
    }
  }

  if (forecast instanceof Error)
    res.status(500).send(forecast.message);
  else if (forecast.unavailable)
    res.status(500).send('Forecast unavailable');
  else {
    // Even if Weather Underground is preferred, if Dark Sky is available, use its better summary.
    if (forecast === forecasts[0] && forecasts.length > 1 && darkSkyForecast?.daily?.summary)
      forecast.daily.summary = darkSkyForecast.daily.summary;

    jsonOrJsonp(req, res, forecast);
  }
});

function forecastResultCode(forecast: Error | ForecastData): string {
  if (forecast instanceof Error) {
    const msg = forecast.message ?? forecast.toString();

    if (/\btimeout\b'/i.test(msg))
      return 'T';
    else
      return 'X';
  }

  return forecast.unavailable ? '-' : '*';
}
