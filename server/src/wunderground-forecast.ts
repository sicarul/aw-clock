import { purgeCache, requestJson, requestText } from './request-cache';
import { Request, Router } from 'express';
import { max } from '@tubular/math';
import { isObject, toNumber } from '@tubular/util';
import { Alert, ForecastData, PressureTrend } from './shared-types';
import { autoHpa, autoInHg, checkForecastIntegrity, filterError } from './awcs-util';

export const router = Router();

export async function getForecast(req: Request): Promise<ForecastData | Error> {
  const url = `https://www.wunderground.com/forecast/${req.query.lat},${req.query.lon}`;

  try {
    const items = await getContent(req, url);

    if (!items) {
      purgeCache(url);
      return { source: 'wunderground', unavailable: true };
    }

    const celsius = (req.query.du === 'c');
    const intermediateForecast: any = { alerts: [] };
    const itemsArray = Object.keys(items).map(key => items[key]);

    for (const item of itemsArray) {
      if (!item.value || !item.url)
        continue;

      if (/\/location\/point\?/.test(item.url))
        intermediateForecast.location = item.value?.location ?? item.value;
      else if (/\/wx\/observations\/current\?/.test(item.url))
        await adjustUnits(intermediateForecast, item, 'currently', celsius);
      else if (/\/wx\/forecast\/hourly\/15day\?/.test(item.url))
        await adjustUnits(intermediateForecast, item, 'hourly', celsius);
      else if (/\/wx\/forecast\/daily\/10day\?/.test(item.url))
        await adjustUnits(intermediateForecast, item, 'daily', celsius);
      else if (/\/alerts\/detail\?/.test(item.url) && item.value?.alertDetail)
        intermediateForecast.alerts.push(item.value?.alertDetail);
    }

    if (!intermediateForecast.location)
      return new Error('Error parsing Weather Underground data');

    const forecast = convertForecast(intermediateForecast, celsius);

    if (checkForecastIntegrity(forecast))
      return forecast;

    purgeCache(url);
    return new Error('Error retrieving Weather Underground data');
  }
  catch (err) {
    purgeCache(url);
    return new Error('Error connecting to Weather Underground: ' + filterError(err));
  }
}

async function getContent(req: Request, url: string): Promise<any> {
  let result: any = null;
  const content = await requestText(240, url, {
    followRedirects: true,
    headers: {
      'Accept-Language': 'en-US,en;q=0.5',
      'User-Agent': req.headers['user-agent']
    }
  });
  const $ = /<script\b.+\bid="app-root-state"[^>]*>(.+?)<\/script>/is.exec(content);

  if ($) {
    result = JSON.parse(decodeWeirdJson($[1]))['wu-next-state-key'];
    result = (isObject(result) ? result : null);
  }

  return result;
}

function decodeWeirdJson(s: string): string {
  // What would otherwise be normal JSON data is weirdly encoded using something like HTML entities, but all
  // single letter codes, for ampersands, double quotes, '>', and '<'. The quotes in particular make the content
  // unreadable as JSON without first being decoded.
  return s.split(/(&\w;)/g).map((s, i) => {
    if (i % 2 === 0)
      return s;

    switch (s) {
      case '&a;': return '&';
      case '&q;': return '"';
      case '&g;': return '>';
      case '&l;': return '<';
      case '&s;': return '’'; // right single quote
      default: return s;
    }
  }).join('');
}

async function adjustUnits(forecast: any, item: any, category: string, celsius: boolean): Promise<void> {
  if (/&units=e&/.test(item.url)) {
    if (celsius)
      forecast[category] = await requestJson(240, item.url.replace('&units=e&', '&units=m&'));
    else
      forecast[category] = item.value;
  }
  else if (celsius)
    forecast[category] = item.value;
  else
    forecast[category] = await requestJson(240, item.url.replace('&units=m&', '&units=e&'));
}

function getIcon(iconCode: number): string {
  if (0 <= iconCode && iconCode <= 47)
    return iconCode.toString().padStart(2, '0');
  else
    return 'unknown';
}

function convertForecast(wuForecast: any, isMetric: boolean): ForecastData {
  const forecast: ForecastData = { source: 'wunderground' } as ForecastData;

  forecast.latitude = wuForecast.location.latitude;
  forecast.longitude = wuForecast.location.longitude;
  forecast.timezone = wuForecast.location.ianaTimeZone;
  forecast.isMetric = isMetric;

  if (!wuForecast.currently || !wuForecast.hourly || !wuForecast.daily) {
    forecast.unavailable = true;
    return forecast;
  }

  const wc = wuForecast.currently;
  const wh = wuForecast.hourly;
  const location = wuForecast.location;

  forecast.city = location && `${location.city}, ${location.adminDistrictCode}, ${location.countryCode}`;
  convertCurrent(forecast, wc, wh, isMetric);
  convertHourly(forecast, wh, isMetric);
  convertDaily(forecast, wc, wuForecast.daily);
  convertAlerts(forecast, wuForecast.alerts);

  if (forecast.daily?.data?.length > 0) {
    const daily = forecast.daily.data;

    if (daily[0].narrativeDay)
      forecast.daily.summary = `Today: ${daily[0].narrativeDay}.`;
    else if (!forecast.daily.summary.endsWith('.'))
      forecast.daily.summary += '.';

    if (daily[0].narrativeEvening)
      forecast.daily.summary += ` Evening: ${daily[0].narrativeEvening}.`;

    if (daily.length > 1 && daily[1].narrativeDay)
      forecast.daily.summary += ` Tomorrow: ${daily[1].narrativeDay}.`;
  }

  return forecast;
}

function pressureTrendFromString(trend: string): PressureTrend {
  trend = (trend || '').toLowerCase();

  if (trend === 'falling')
    return PressureTrend.FALLING;
  else if (trend === 'rising')
    return PressureTrend.RISING;
  else
    return PressureTrend.STEADY;
}

function extractGust(baseSpeed: number, ...phrases: string[]): number {
  let gust: number = null;

  for (const phrase of phrases) {
    const $ = /gust[^.]*?\s+(\d+)/i.exec(phrase ?? '');

    if ($)
      gust = max(gust ?? 0, toNumber($[1]));
  }

  return gust > baseSpeed ? gust : null;
}

function convertCurrent(forecast: ForecastData, wc: any, wh: any, isMetric: boolean): void {
  // For some strange reason pressure is always metric for current conditions, but changes to inches of mercury
  // (inHg) for the hourly imperial values. As I don't trust this inconsistency so I'll use the numeric range of
  // the input values to decide on what conversion to do.
  forecast.currently = {
    time: wc.validTimeUtc,
    summary: wc.wxPhraseMedium,
    icon: getIcon(wc.iconCode),
    humidity: wc.relativeHumidity / 100,
    cloudCover: wh.cloudCover[0] / 100,
    precipProbability: wh.precipChance[0] / 100,
    precipType: wh.precipType[0],
    pressure: isMetric ? autoHpa(wc.pressureMeanSeaLevel) : autoInHg(wc.pressureMeanSeaLevel),
    pressureTrend: pressureTrendFromString(wc.pressureTendencyTrend),
    temperature: wc.temperature,
    feelsLikeTemperature: wc.temperatureFeelsLike,
    windDirection: wc.windDirection,
    windGust: wc.windGust,
    windSpeed: wc.windSpeed
  };
}

function convertHourly(forecast: ForecastData, wh: any, isMetric: boolean): void {
  forecast.hourly = [];

  const length = Math.min(36, wh.iconCode?.length ?? 0, wh.precipType?.length ?? 0, wh.qpf?.length ?? 0,
                          wh.qpfSnow?.length ?? 0, wh.temperature?.length ?? 0, wh.validTimeUtc?.length ?? 0);

  for (let i = 0; i < length; ++i) {
    const pressure = wh.pressureMeanSeaLevel[i];
    let precipType = wh.precipType[i];

    if (wh.qpfSnow[i] > 0 && precipType === 'precip')
      precipType = 'snow';

    forecast.hourly.push({
      icon: getIcon(wh.iconCode[i]),
      temperature: wh.temperature[i],
      precipProbability: wh.precipChance[i] / 100,
      precipType,
      pressure: isMetric ? autoHpa(pressure) : autoInHg(pressure),
      time: wh.validTimeUtc[i],
      windDirection: wh.windDirection[i],
      windGust: wh.windGust[i],
      windSpeed: wh.windSpeed[i]
    });
  }
}

function convertDaily(forecast: ForecastData, wc: any, wd: any): void {
  const daily: any[] = [];
  const wddp = wd.daypart && wd.daypart[0];
  const length = Math.min(10, (wddp?.iconCode?.length ?? 0) / 2, (wddp?.precipChance?.length ?? 0) / 2,
    (wddp?.precipType?.length ?? 0) / 2, wd.qpf?.length ?? 0, wd.qpfSnow?.length ?? 0,
    wd.temperatureMax?.length ?? 0, wd.temperatureMin?.length ?? 0, wd.validTimeUtc?.length ?? 0);

  for (let i = 0; i < length; ++i) {
    let precipType = wddp?.precipType[i * 2];
    const precipTypeNight = wddp?.precipType[i * 2 + 1];

    if (!precipType || precipTypeNight === 'snow')
      precipType = precipTypeNight;

    let precipAccumulation = wd.qpf[i];

    if (precipType === 'snow' || (wd.qpfSnow[i] > 0 && precipType === 'precip')) {
      precipType = 'snow';
      precipAccumulation = wd.qpfSnow[i];
    }

    const windIndex = wddp?.windSpeed[i * 2] != null ? i * 2 : i * 2 + 1;
    const windSpeed = wddp?.windSpeed[windIndex];

    daily.push({
      icon: getIcon(wddp?.iconCode[i * 2] ?? wddp?.iconCode[i * 2 + 1] ?? -1),
      narrativeDay: wddp?.narrative[i * 2],
      narrativeEvening: wddp?.narrative[i * 2 + 1],
      precipAccumulation,
      precipIntensityMax: 0,
      precipProbability: Math.max(wddp?.precipChance[i * 2] ?? 0, wddp?.precipChance[i * 2 + 1] ?? 0) / 100,
      precipType,
      summary: wd.narrative[i],
      temperatureHigh: wd.temperatureMax[i] ?? wc.temperatureMax24Hour,
      temperatureLow: wd.temperatureMin[i] ?? wc.temperatureMin24Hour,
      time: wd.validTimeUtc[i],
      windDirection: wddp?.windDirection[windIndex],
      windGust: extractGust(windSpeed, wddp?.windPhrase[windIndex], wddp?.narrative[i * 2], wddp?.narrative[i * 2 + 1]),
      windPhrase: combineWindPhrases(wddp?.windPhrase[i * 2], wddp?.windPhrase[i * 2 + 1]),
      windSpeed
    });
  }

  forecast.daily = {
    summary: (wd.narrative && wd.narrative[0]) ?? '',
    data: daily
  };
}

function combineWindPhrases(day: string, night: string): string {
  // eslint-disable-next-line eqeqeq
  if (day == night)
    return day;
  else if (!night)
    return day;
  else if (!day)
    return night;

  return (day + ', ' + night).replace('., Winds', ', evening').replace('.,', ',');
}

function convertAlerts(forecast: ForecastData, wa: any): void {
  forecast.alerts = wa.map((wuAlert: any) => {
    const alert: Alert = {} as Alert;

    alert.description = '';
    alert.expires = wuAlert.expireTimeUTC;
    alert.severity = 'advisory';
    alert.time = Math.floor(Date.parse(wuAlert.issueTimeLocal) / 1000);
    alert.title = wuAlert.headlineText;

    if (wuAlert.texts && wuAlert.texts[0]) {
      const text = wuAlert.texts[0];

      alert.description = ((text.overview ?? '') + ' ' + (text.description ?? '')).trim();
    }

    if (!/advisory/i.test(wuAlert.headlineText)) {
      if (/observed/i.test(wuAlert.certainty) || /warning/i.test(wuAlert.headlineText))
        alert.severity = 'warning';
      else if (/likely/i.test(wuAlert.certainty) || /watch/i.test(wuAlert.headlineText))
        alert.severity = 'watch';
    }

    return alert;
  });
}
