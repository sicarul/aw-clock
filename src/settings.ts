import { HourlyForecast, TimeFormat } from './shared-types';
import $ from 'jquery';
import * as Cookies from 'js-cookie';
import { isChromium, isRaspbian, toBoolean } from '@tubular/util';

export const runningDev = (document.location.port === '4200');
export const localServer = (document.location.port &&
  document.location.port !== '80' && document.location.port !== '443');
export const updateTest = toBoolean(new URLSearchParams(window.location.search).get('ut'), false, true);

const apiParam = new URLSearchParams(window.location.search).get('api');
const apiPort = apiParam || (runningDev ? '4201' : document.location.port || '8080');
const apiHost = ((document.location.hostname || '').startsWith('192.') ? document.location.hostname : 'localhost');

// noinspection HttpUrlsUsage
export const apiServer = new URL(window.location.href).searchParams.get('weather_server') ||
  (runningDev ? `http://${apiHost}:${apiPort}` : '');
export const raspbianChromium = (isRaspbian() && isChromium()) || runningDev;

export function toTimeFormat(s: string, deflt = TimeFormat.UTC): TimeFormat {
  s = (s || '').toLowerCase();

  return s.startsWith('a') || s === 'true' ? TimeFormat.AMPM :
    (s.startsWith('u') ? TimeFormat.UTC :
      (s.includes('2') || s === 'false' ? TimeFormat.HR24 : deflt));
}

export class Settings {
  latitude = 40.75;
  longitude = -73.99;
  city = 'New York, NY';
  indoorOption = localServer ? 'D' : 'X';
  outdoorOption = 'F';
  userId = '';
  dimming = 0;
  dimmingStart = '23:00';
  dimmingEnd = '7:00';
  celsius = false;
  knots = false;
  timeFormat = /[a-z]/i.test(new Date().toLocaleTimeString()) ? TimeFormat.AMPM : TimeFormat.UTC;
  hideSeconds = false;
  hidePlanets = false;
  hourlyForecast = HourlyForecast.VERTICAL;
  onscreenKB = false;
  background = '#191970';
  clockFace = '#000000';

  public defaultsSet(): boolean {
    return !!(Cookies.get('indoor') || Cookies.get('outdoor') || Cookies.get('city'));
  }

  public load(): void {
    this.latitude = Number(Cookies.get('latitude')) || defaultSettings.latitude;
    this.longitude = Number(Cookies.get('longitude')) || defaultSettings.longitude;
    this.city = Cookies.get('city') || defaultSettings.city;
    this.indoorOption = Cookies.get('indoor') || this.indoorOption;
    this.outdoorOption = Cookies.get('outdoor') || 'F';
    this.userId = Cookies.get('id') || '';
    this.dimming = Number(Cookies.get('dimming')) || 0;
    this.dimmingStart = Cookies.get('dimming_start') || defaultSettings.dimmingStart;
    this.dimmingEnd = Cookies.get('dimming_end') || defaultSettings.dimmingEnd;
    this.celsius = toBoolean(Cookies.get('celsius'), false);
    this.knots = toBoolean(Cookies.get('knots'), false);
    this.timeFormat = toTimeFormat(Cookies.get('ampm'), defaultSettings.timeFormat);
    this.hideSeconds = toBoolean(Cookies.get('hides'), false);
    this.hidePlanets = toBoolean(Cookies.get('hidep'), false);
    this.hourlyForecast = (Cookies.get('hourly_forecast') as HourlyForecast) || defaultSettings.hourlyForecast;
    this.onscreenKB = toBoolean(Cookies.get('oskb'), false);
    this.background = Cookies.get('background') || defaultSettings.background;
    this.clockFace = Cookies.get('clock_face') || defaultSettings.clockFace;

    const body = $('body');

    body.css('--background-color', this.background);
    body.css('--clock-face-color', this.clockFace);
  }

  public save(): void {
    const expiration = { expires: 36525 }; // One century from now.

    Cookies.set('city', this.city, expiration);
    Cookies.set('latitude', this.latitude.toString(), expiration);
    Cookies.set('longitude', this.longitude.toString(), expiration);
    Cookies.set('indoor', this.indoorOption, expiration);
    Cookies.set('outdoor', this.outdoorOption, expiration);
    Cookies.set('id', this.userId, expiration);
    Cookies.set('dimming', this.dimming.toString(), expiration);
    Cookies.set('dimming_start', this.dimmingStart, expiration);
    Cookies.set('dimming_end', this.dimmingEnd, expiration);
    Cookies.set('celsius', this.celsius.toString(), expiration);
    Cookies.set('knots', this.knots.toString(), expiration);
    Cookies.set('ampm', ['24', 'ampm', 'utc'][this.timeFormat] ?? '24', expiration);
    Cookies.set('hides', this.hideSeconds.toString(), expiration);
    Cookies.set('hidep', this.hidePlanets.toString(), expiration);
    Cookies.set('hourly_forecast', this.hourlyForecast, expiration);
    Cookies.set('oskb', this.onscreenKB.toString(), expiration);
    Cookies.set('background', this.background, expiration);
    Cookies.set('clock_face', this.clockFace, expiration);

    const body = $('body');

    body.css('--background-color', this.background);
    body.css('--clock-face-color', this.clockFace);
  }

  public requiresWeatherReload(oldSettings: Settings) {
    return this.latitude !== oldSettings.latitude || this.longitude !== oldSettings.longitude;
  }
}

const defaultSettings = new Settings();
