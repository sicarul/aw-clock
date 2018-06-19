/*
  Copyright © 2018 Kerry Shetline, kerry@shetline.com

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

import * as $ from 'jquery';
import { domAlert, htmlEncode, popKeydownListener, pushKeydownListener } from './util';

let dialog: JQuery;
let currentCity: JQuery;
let latitude: JQuery;
let longitude: JQuery;
let userId: JQuery;
let dimming: JQuery;
let dimmingStart: JQuery;
let dimmingTo: JQuery;
let dimmingEnd: JQuery;
let temperature: JQuery;
let hours: JQuery;
let seconds: JQuery;
let planets: JQuery;
let searchCity: JQuery;
let searchFieldFocused = false;
let searchButtonFocused = false;
let submitSearch: JQuery;
let searching: JQuery;
let searchMessage: JQuery;
let cityTableWrapper: JQuery;
let cityTable: JQuery;
let okButton: JQuery;
let cancelButton: JQuery;
let reloadButton: JQuery;

interface SearchLocation {
  city: string;
  displayName: string;
  county: string;
  showCounty: boolean;
  state: string;
  showState: boolean;
  country: string;
  longCountry: string;
  latitude: number;
  longitude: number;
  zone: string;
  rank: number;
}

interface SearchResults {
  matches?: SearchLocation[];
  warning?: string;
  error?: string;
  info?: string;
  limitReached: boolean;
}

export interface Settings {
  latitude: number;
  longitude: number;
  city: string;
  userId?: string;
  dimming: number;
  dimmingStart: string;
  dimmingEnd: string;
  celsius: boolean;
  amPm: boolean;
  hideSeconds: boolean;
  hidePlanets: boolean;
}

export function initSettings() {
  dialog = $('#settings-dialog');
  currentCity = $('#current-city');
  latitude = $('#latitude');
  longitude = $('#longitude');
  userId = $('#user-id');
  dimming = $('#dimming');
  dimmingStart = $('#dimming-start');
  dimmingTo = $('#dimming-to');
  dimmingEnd = $('#dimming-end');
  temperature = $('#temperature-option');
  hours = $('#hours-option');
  seconds = $('#seconds-option');
  planets = $('#planets-option');
  searchCity = $('#search-city');
  submitSearch = $('#submit-search');
  searching = $('.searching');
  searchMessage = $('#search-message');
  cityTableWrapper = $('.city-table-wrapper');
  cityTable = $('#city-table');
  okButton = $('#settings-ok');
  cancelButton = $('#settings-cancel');
  reloadButton = $('#settings-reload');

  searchCity.on('focus', () => searchFieldFocused = true);
  searchCity.on('blur', () => searchFieldFocused = false);
  submitSearch.on('focus', () => searchButtonFocused = true);
  submitSearch.on('blur', () => searchButtonFocused = false);

  dimming.on('change', () => {
    enableDimmingRange(dimming.val() !== '0');
  });

  hours.on('change', () => {
    const amPm = hours.val() === 'AMPM';

    fillInTimeChoices(dimmingStart, amPm);
    fillInTimeChoices(dimmingEnd, amPm);
  });

  $('#search').on('submit', event => {
    event.preventDefault();
    const query = $.trim(searchCity.val() as string);

    if (query.length === 0)
      domAlert('Please enter a city or partial city name.');
    else {
      (searchCity as any).enable(false);
      (submitSearch as any).enable(false);
      searching.css('visibility', 'visible');
      searchMessage.html('&nbsp;');
      searchMessage.css('background-color', 'white');
      cityTableWrapper.hide();
      cityTable.html('');

      doSearch(query).then(response => {
        let rows = '<tr id="header"><th>&#x2605;</th><th>City</th><th>Latitude</th><th>Longitude</th><tr>\n';

        response.matches.forEach((city, index) => {
          rows += '<tr data-lat="' + city.latitude +
             '" data-lon="' + city.longitude + '"' +
            (response.matches.length > 6 && Math.floor(index / 3) % 2 === 0 ? ' class=rowguide' : '') +
            '><td>' + city.rank +
            '</td><td class="name">' + htmlEncode(city.displayName) +
            '</td><td class="coordinates">' + formatDegrees(city.latitude, 'NS', 2) +
            '</td><td class="coordinates">' + formatDegrees(city.longitude, 'EW', 3) +
            '</td></tr>\n';
        });

        cityTable.html(rows);
        setTimeout(() => cityTableWrapper.scrollTop(0));
        cityTableWrapper.show();
        (submitSearch as any).enable(true);
        (searchCity as any).enable(true);
        searching.css('visibility', 'hidden');

        if (response.error) {
          searchMessage.text(response.error);
          searchMessage.css('background-color', '#FCC');
        }
        else if (response.warning) {
          searchMessage.text(response.warning);
          searchMessage.css('background-color', '#FFC');
        }
        else if (response.limitReached) {
          searchMessage.text('Some matches are not displayed because the result limit was exceeded.');
          searchMessage.css('background-color', '#FC9');
        }

        cityTable.find('tr').each(function(index) {
          if (index !== 0) {
            const $this = $(this);

            $this.on('click', () => {
              currentCity.val($this.find('td.name').text().replace(/ \([^)]+\)/g, ''));
              latitude.val($this.data('lat'));
              longitude.val($this.data('lon'));
            });

            $this.on('dblclick', () => {
              okButton.trigger('click');
            });
          }
        });
      }).catch(reason => {
        (submitSearch as any).enable(true);
        (searchCity as any).enable(true);
        searching.css('visibility', 'hidden');
        domAlert(reason || 'Unable to access geographic database.');
      });
    }
  });
}

function fillInTimeChoices(selectElem: JQuery, amPm: boolean) {
  const savedValue = selectElem.val();

  selectElem.empty();

  let options = '<option value="SR">Sunrise</option><option value="SS">Sunset</option>';

  for (let i = 0; i < 48; ++i) {
    const hour = Math.floor(i / 2);
    const minute = (i % 2 === 0 ? '00' : '30');
    let displayHour = hour.toString();
    let suffix = '';

    if (amPm) {
      if (hour < 12) {
        displayHour = (hour === 0 ? 12 : hour).toString();
        suffix = ' AM';
      }
      else {
        displayHour = (hour === 12 ? 12 : hour - 12).toString();
        suffix = ' PM';
      }
    }

    options += `<option value="${hour}:${minute}">${displayHour}:${minute}${suffix}</option>`;
  }

  selectElem.html(options);
  selectElem.val(savedValue);
}

function enableDimmingRange(enable: boolean) {
  if (enable) {
    dimmingStart.removeAttr('disabled');
    dimmingTo.css('opacity', '1');
    dimmingEnd.removeAttr('disabled');
  }
  else {
    dimmingStart.attr('disabled', 'disabled');
    dimmingTo.css('opacity', '0.33');
    dimmingEnd.attr('disabled', 'disabled');
  }
}

export function openSettings(previousSettings: Settings, callback: (Settings) => void) {
  currentCity.val(previousSettings.city);
  latitude.val(previousSettings.latitude);
  longitude.val(previousSettings.longitude);
  userId.val(previousSettings.userId);
  temperature.val(previousSettings.celsius ? 'C' : 'F');
  hours.val(previousSettings.amPm ? 'AMPM' : '24');
  seconds.val(previousSettings.hideSeconds ? 'H' : 'S');
  planets.val(previousSettings.hidePlanets ? 'H' : 'S');
  (submitSearch as any).enable(true);
  (searchCity as any).enable(true);
  searchCity.val('');
  searchMessage.html('&nbsp;');
  searchMessage.css('background-color', 'white');
  cityTableWrapper.hide();
  searching.css('visibility', 'hidden');
  dialog.css('display', 'block');
  setTimeout(() => searchCity.trigger('focus'));

  fillInTimeChoices(dimmingStart, previousSettings.amPm);
  fillInTimeChoices(dimmingEnd, previousSettings.amPm);
  enableDimmingRange(!!previousSettings.dimming);
  dimming.val(previousSettings.dimming.toString());
  dimmingStart.val(previousSettings.dimmingStart);
  dimmingEnd.val(previousSettings.dimmingEnd);

  pushKeydownListener((event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      event.preventDefault();
      cancelButton.trigger('click');
    }
    else if (event.code === 'Enter' && !searchFieldFocused && !searchButtonFocused) {
      event.preventDefault();
      okButton.trigger('click');
    }
  });

  const doOK = () => {
    const newSettings: Settings = {
      city: (currentCity.val() as string).trim(),
      latitude: Number(latitude.val()),
      longitude: Number(longitude.val()),
      userId: userId.val() as string,
      dimming: +dimming.val(),
      dimmingStart: dimmingStart.val() as string,
      dimmingEnd: dimmingEnd.val() as string,
      celsius: (temperature.val() as string) === 'C',
      amPm: (hours.val() as string) === 'AMPM',
      hideSeconds: (seconds.val() as string) === 'H',
      hidePlanets: (planets.val() as string) === 'H'
    };

    if (!newSettings.city) {
      domAlert('Current city must be specified.');
      currentCity.trigger('focus');
    }
    else if (isNaN(newSettings.latitude) || newSettings.latitude < -90 || newSettings.latitude > 90) {
      domAlert('A valid latitude must be provided from -90 to 90 degrees.');
      latitude.trigger('focus');
    }
    else if (isNaN(newSettings.longitude) || newSettings.longitude < -180 || newSettings.longitude > 180) {
      domAlert('A valid longitude must be provided from -180 to 180 degrees.');
      longitude.trigger('focus');
    }
    else {
      popKeydownListener();
      okButton.off('click', doOK);
      dialog.css('display', 'none');
      callback(newSettings);
    }
  };

  okButton.on('click', doOK);

  cancelButton.one('click', () => {
    popKeydownListener();
    okButton.off('click', doOK);
    dialog.css('display', 'none');
    callback(null);
  });

  reloadButton.one('click', () => {
    window.location.reload(true);
  });
}

function doSearch(query: string): Promise<SearchResults> {
  const url = 'https://weather.shetline.com/atlasdb/atlas';

  return new Promise((resolve, reject) => {
    $.ajax({
      url: url,
      dataType: 'jsonp',
      data: {
        q: query,
        client: 'web'
      },
      success: (data: SearchResults) => {
        resolve(data);
      },
      error: (jqXHR: JQueryXHR, textStatus: string, errorThrown: string) => {
        reject(errorThrown);
      }
    });
  });
}

function formatDegrees(angle, compassPointsPosNeg, degreeDigits) {
  const compass = compassPointsPosNeg.charAt(angle < 0 ? 1 : 0);
  angle = Math.abs(angle);
  const degrees = angle.toFixed(3);
  angle = Number(degrees.split('.')[0]);

  return (degreeDigits > 2 && angle < 100 ? '\u2007' : '') +
    (degreeDigits > 1 && angle < 10 ? '\u2007' : '') + degrees + '\u00B0' + compass;
}
