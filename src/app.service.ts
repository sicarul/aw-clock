import { Settings } from './settings';

export interface AppService {
  getCurrentTime(): number;
  isTimeAccelerated(): boolean;
  updateTime(hour: number, minute: number, forceRefresh: boolean): void;
  updateSettings(newSettings: Settings);
  forecastHasBeenUpdated(): void;
  updateSunriseAndSunset(rise: string, set: string);
  updateMarqueeState(isScrolling: boolean);
}