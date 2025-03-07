## Astronomy/Weather Clock

![raspberry pi logo](https://shetline.com/readme/aw-clock/2.8.0/rpi_logo.svg)

This project is designed to create a desktop clock which provides weather and astronomical information. While primarily designed to run on a Raspberry Pi, the code generates a Node.js server and client web app which can be run on other computers and operating systems, albeit without the Raspberry Pi’s hardware-level support for wired and wireless temperature/humidity sensors. GPS support is also primarily aimed at the Raspberry Pi, but might work on other Linux variants if similarly configured.

The clock displays the time and date in both analog and digital form, in 12- or 24-hour format, and has a special display mode for the occasional leap second. The clock also displays current weather conditions, hourly conditions for 24 hours, a seven*-day forecast, sunrise and sunset times, moonrise and moonset times*, moon phases, equinoxes, solstices, and the positions of the Sun, Moon, and major planets along the ecliptic.

When displaying 24-hour time, that time can either be local time or UTC.

On a display which is narrower than a 16-by-9 aspect ratio, four forecast days can be seen at one time without scrolling. On 16-by-9 or wider displays, five days are visible at a glance.

*&#42;A touchscreen or mouse is required to display the last two or three days of the seven-day forecast, to switch the display from sunrise/sunset to moonrise/moonset, or to switch from hourly temperatures to hourly probability-of-precipitation.*

![finished project](https://shetline.com/readme/aw-clock/2.8.0/aw-clock-w-stand-12.jpg)

![app screenshot](https://shetline.com/readme/aw-clock/2.8.0/awc_screenshot.png)

![app dst animation](https://shetline.com/readme/aw-clock/2.8.0/spring-forward-480.gif)

<br/><br/>

### Getting started

The following instructions are primarily aimed at turning a Raspberry Pi into a _dedicated_ Astronomy/Weather Clock, meaning serving as a clock will be the Raspberry Pi’s primary, if not sole, function. The Pi will boot up directly into full-screen kiosk mode running the Astronomy/Weather Clock software.

The first step, if you want GPS support, is to install a GPS device according to the manufacturers instructions. This device must provide a PPS (Pulse Per Second) signal for precise time keeping (something USB dongles do not provide), and must be configured to work with `ntpd`. I recommend the [Adafruit Ultimate GPS HAT](https://www.adafruit.com/product/2324), not only because it works well, but because it’s the only GPS hardware I’ve tested.

In my own case, I needed to use an active GPS antenna to get a good signal, but you might not need one, depending on where you locate your device.

The next step (or the first, if you’re skipping GPS) is to clone the repository and perform the initial set-up:

```shell script
$ git clone https://github.com/kshetline/aw-clock.git
$ cd aw-clock
$ sudo ./build.sh -i
```

There will possibly be a long delay the first time you run this script while Node.js (if necessary) and various npm packages are installed as a prerequisite to running the rest of the installation procedure.

You’ll then be prompted in the console for the initial configuration you desire. If you leave the `-i` off the end of the `build.sh` command above, and add `--ddev`, an all-defaults installation will be performed automatically, with support for wired and wireless temperature/humidity sensors initially disabled, no alternative weather services beyond Weather Underground, and no geocoding support.

Respond `Y` to the prompt “Allow user to reboot, shutdown, update, etc.?” if you want to be able to use the clock’s Settings dialog to perform these basic administrative functions. This is especially convenient if you’re using a touchscreen, and don’t want to have to use SSH or VNC to perform these operations.

### Weather

As of v2.1.0 of this software no API key is required to get weather data. The default weather data, however, is now being acquired by “page scraping” [Weather Underground](https://www.wunderground.com/), not via a guaranteed stable API.

Having a back-up weather data source is still, therefore, a good idea. For that there are three options:

1. Get an API key for [Weatherbit.io via RapidAPI](https://rapidapi.com/weatherbit/api/weather). You can get a free key, but with a hard maximum of 125 API calls allowed per day, that will only be good for occasional back-up service, not full-time weather information (it takes multiple API calls to get a full forecast). The US$10/month Pro plan is more than sufficient, however. With a Weatherbit.io API key, you’ll also be able to handle geolocation (turning GPS latitude/longitude into city/place names) without needing to set up a Google API key.

2. *If you already have* a Dark Sky API key, you can use that. Unfortunately, Dark Sky has announced that they have joined Apple, and they will no long accept new sign-ups for API keys. Further, even if you currently have an API key, it will cease to work at the end of 2021. (This software will itself switch off access to Dark Sky in December 2021.) One reason I’m sad to see Dark Sky go away is that the free plan allows 1000 API calls per day, and one single API call is all that’s needed to get a full forecast.

3. There’s a limited capability in this software to fall back on using my personal RapidAPI/Weatherbit.io account, but depending on how much traffic I get, there’s no guarantee that this back-up will always be there.

### Time keeping

By default, this application uses GPS-synced system time, if available, or `pool.ntp.org` as an NTP time server (keeping its own time via NTP, rather than using the system clock). You can configure the use of a different time server, however, you should not choose a Google or Facebook time server, or any other NTP server that implements “leap second smearing”, if you want the Astronomy/Weather Clock to be able to accurately display leap seconds as shown below:

![Hypothetical leap second](https://shetline.com/readme/aw-clock/2.8.0/moment_of_leap_second.jpg)

_This image is hypothetical — the pictured moment in time is not guaranteed to be an actual leap second. Video here: <https://shetline.com/video/leap_second_display.mp4>_

### Web browser client options

As soon as you’ve got the Astronomy/Weather Clock up and running the first time, you might want to click on the gear icon in the lower right corner of the web browser display to adjust the various user options which aren’t queried as part of the initial set-up.

Your city might be filled in automatically by using your IP address &mdash; but then again, it might not. If you’re using this clock in a bedroom you might find the **Dimming** options very useful, as they establish a schedule during which the display will be reduced in brightness.

![app screenshot](https://shetline.com/readme/aw-clock/2.8.0/awc_dlog.png)

To close the web browser while it’s running in full-screen kiosk mode, press `Alt-F4`, or use the Settings/Quit button if available. To get out of full screen mode, but leave the browser running, press `Alt-F11`.

### Hardware set-up for temperature/humidity sensors

If you are running the server on a Raspberry Pi you have the option to display indoor temperature and humidity using a direct-wired DHT22/AM2302 sensor, as seen here: <https://www.amazon.com/HiLetgo-Temperature-Humidity-Electronic-Practice/dp/B01N9BA0O4/>. The wiring I describe below is specifically for the AM2302 version of the DHT22, with a built-in pull-up resistor.

With your Raspberry Pi shut down and disconnected from power, connect the DHT22/AM2302 sensor. The code defaults to assuming the signal lead (“out”) of the sensor is connected to GPIO 17* (physical pin 11 on the 40-pin J8 header). The `+` lead from the sensor needs to be connected to 5V (I chose pin 2 on the 40-pin J8 header) and the `-` lead needs to be connected to ground (I chose pin 9). In the image below, the signal lead is orange, the ground is brown, and +5 is the upper red wire.

*&#42;This default was GPIO 4 (physical pin 7) before version 2.4.0, but the Adafruit GPS HAT is pre-wired to use that pin, hence the new default.*

![Picture of wiring to GPS HAT](https://shetline.com/readme/aw-clock/2.8.0/rpi_with_gps_hat.jpg)

Also for the Raspberry Pi you have the option to provide wireless indoor conditions and outdoor weather data using [433 MHz Acu Rite 06002M wireless temperature and humidity sensors](https://www.amazon.com/gp/product/B00T0K8NXC/) paired with a [433 MHz receiver module](https://www.amazon.com/gp/product/B00HEDRHG6/).

You can use one wireless sensor in lieu of a wired DHT22/AM2302 for indoor temperature and humidity, and you can use one or two wireless sensors for outdoor temperature and humidity. (When using multiple sensors, each must be set to a different channel — A, B, or C.)

An outdoor two-sensor set-up is useful when it’s difficult to find a single location for a sensor that isn’t overly warmed by the sun for at least part of the day. When you have two sensors, and signal is available from both, values from the cooler of the two sensors will be displayed.

With either one or two outdoor sensors the temperature displayed (in the largest text) will be pinned to be within ±2°C (±4°F) of the temperature supplied by the online weather service (a yellow tint of the temperature value indicates pinning is in effect). The “Feels like” temperature always comes from the weather service, not from your wireless sensors.

In small, gray print you can see the individual temperature values for each wireless sensor and from the forecast, regardless of what is displayed in large format. If any of your wireless sensors are running low on battery power, a red indicator will appear in the upper right corner of the display.

When connecting the 433 MHz receiver module follow the same precautions as specified for connecting the DHT22/AM2302. For my own set-up, I’ve connected the receiver’s +5V lead to physical pin 4 of the 40-pin J8 connector, ground to pin 14, and data to pin 13 (GPIO 27, the set-up default value). These correspond to the lower red wire in the picture above, the black wire (hard to see, to the right of the blue wire), and the blue wire.

### Touchscreen/mouse features

* Swipe left or right on the daily forecast to view the full seven-day forecast. You can also tap/click on the left/right arrows on either side of the forecast. *After one minute, the display reverts to the first four (or five) days.*
* Tap/click on a forecast day, and a textual summary (if available) of that day’s weather will appear.
* Tap/click on the rise/set icon, or the rise/set times, to switch between sun and moon rise and set times. *After one minute, the display reverts to sunrise/sunset.*
* Tap/click on the hourly weather icons, or the hourly temperatures, to see hourly probabilities of precipitation and wind speed. Tap/click again to toggle back to weather icons and temperatures. *After one minute, the display reverts to weather icons and hourly temperatures.*
* Tap/click on the (sometimes) scrolling banner at the bottom of the screen to see the full text of alert messages without having to wait for them to scroll by.
* Tap/click on the gear icon in the lower right corner of the display to bring up the Settings dialog. An onscreen keyboard option is available. If you answered “Yes” to the set-up question “Allow user to reboot, shutdown, update, etc.?”, extra options for managing your Raspberry Pi will be available.

### Wind speed

<img src="https://shetline.com/readme/aw-clock/2.8.0/wind_barbs.png" width=820 height=55 alt="wind barbs">

Wind speed is displayed using *wind barbs*. When using imperial units, the wind barbs represent wind speed in knots, rounded to the nearest multiple of 5 knots, up to a maximum of 100 knots. In metric mode the wind barbs, by default, represent wind speed in meters per second, in increments of 2.5 m/s (in the diagram above, divide the captions by 2 for m/s).

In the Settings dialog, however, you can choose to display wind speed in knots while still using metric (°C, cm) for temperature and precipitation. When using imperial units (°F, in) wind speed (apart from wind barbs) is by default shown in mph, but you can optionally use knots for the textual display of wind speed as well.

| &nbsp;    | Imperial | Metric  |
| --------- | -------- | ------- |
| Half barb | 5 knots  | 2.5 m/s |
| Full barb | 10 knots | 5 m/s   |
| Pennant   | 50 knots | 25 m/s  |

The barbed ends of the wind barbs point in the direction from which the wind is blowing, with north being upward. Wind gust speed is represented by a red wind barb drawn underneath the non-gust wind barb, such that only the excess gust speed is seen, peeking out from behind.

Current wind speed is also shown as an arc along the edge of the clock face, changing in size and color (from cyan to green, to yellow, to orange, and to red) as wind speed increases. If there is a gust speed, that will show as a second thinner but wider arc. These arcs are centered on the direction from which the wind is coming, with an inward pointer pointing in the direction toward which the wind is blowing. There are no arcs drawn for wind below 2.5 knots (or 1.25 m/s).

### How the planet display works

The circular tracks around the center of the clock face display the ecliptic longitude of the Sun, the Moon, Mercury, Venus, Mars, Jupiter, and Saturn (in that order, from the innermost track outward), starting with 0° (the First Point of Aries) at three o’clock, and increasing *counterclockwise* from there. Over time the planets will slowly move around the clock face, mostly moving counterclockwise, but occasionally clockwise when retrograde.

When the symbol for a planet is drawn larger, and it appears on top of one of the green and/or purple arcs along the planet tracks, this indicates the planet is above the local horizon. Otherwise, it is below the horizon. The green/purple arcs turn clockwise, so the clockwise end of each arc represents when a planet rises, and the counter-clockwise end represents when a planet sets. When a planet is on top of the purple portion of an arc, this indicates that the sun is below the horizon at that time &mdash; the planet is therefore in the night sky, and likely visible if twilight doesn’t overpower it.

For roughly half an hour after a planet sets, its horizon arcs will be colored blue, indicating that the rise-to-set period being displayed is in the past. Arcs in green and purple represent the current or upcoming rise/set period.

If an arc becomes a full circle, that means the corresponding planet on that track is above the horizon all day. If there is no arc at all, the planet is below the horizon all day. (These two situations only occur at extreme northern or southern latitudes.)
<br><br>

### Construction with 3D-Printed Stand

#### Rearview of stand

The 3D model for this stand is provided by the project file `raspberry_pi_setup/monitor_stand.stl`. Below is how that model came out when printed using black ABS, 20% infill, at a cost of about $33 USD.

![3D stand rear view](https://shetline.com/readme/aw-clock/2.8.0/aw-clock-w-stand-01.jpg)

I’m reasonably happy with the results using this stand, but if I did it over again, I’d:

* Make the stand about 0.75" (19 cm) shorter, all of that taken from below the stand-offs for mounting the Raspberry Pi.
* Move the wire pass-through hole for the temperature/humidity sensor forward, so that it was roughly below the hole for the GPS antenna connector — I hadn’t left as much room for the connectors at the ends of the jumpers as I would have liked.
* Move the 433 MHz receiver clip outward, away from the surface of the side panel, to allow more room for the hex nut used to secure the temperature/humidity sensor.
* Add an opening in the side panel for easier access to the SD card slot.

<br>

#### Front view

For some reason there was a glossy texture on the front of the stand when it was printed, something that looked like a thin film of plastic, the kind you often see as shipping protection, meant to be peeled off. It wouldn’t peel off, however, and it had some unattractive dimples and bubbles that made me want to remove it. I settled for sanding it off on the bottom of the stand.

![3D stand front view](https://shetline.com/readme/aw-clock/2.8.0/aw-clock-w-stand-02.jpg)

<br>

#### Side mounting panel

The side panel has a place to attach a quarter-wave 433 MHz antenna, a clip to hold a 433 MHz receiving module, a hole for a female SMA coaxial connector for GPS, and (on the reverse side) a mounting position for a DHT22/AM2302 temperature/humidity sensor.

![3D stand side panel](https://shetline.com/readme/aw-clock/2.8.0/aw-clock-w-stand-03.jpg)

<br>

#### Original monitor stand

This is the original stand that came with the 2560x1600 ELECROW 10.1" touchscreen monitor. It’s not a bad stand in general, but, with the Raspberry Pi attached to the back of the monitor, the cables and wires were an awkward fit. The stand had to be skewed off-center quite a bit for it to work at all.

![Original monitor stand](https://shetline.com/readme/aw-clock/2.8.0/aw-clock-w-stand-04.jpg)

<br>

#### Stand attached to monitor

The stand is attached using 4 M3 x 10 mm wafer-head machine screws. Please note that M4 is the typical size screw for a VESA mount of this size (75 mm square spacing), so it’s a little unusual M3s were needed instead.

![Stand attached to monitor](https://shetline.com/readme/aw-clock/2.8.0/aw-clock-w-stand-05.jpg)

<br>

#### Stand attached to monitor, side view

![Stand attached to monitor, side view](https://shetline.com/readme/aw-clock/2.8.0/aw-clock-w-stand-06.jpg)

<br>

#### Side panel with components attached

The long arm that reaches out from the side panel is designed so the temperature/humidity sensor can be placed at a distance from the heat generated by the Raspberry Pi. The open design is also to prevent heat build-up that an enclosure might cause, which could also skew indoor temperature readings.

![Side panel with components attached](https://shetline.com/readme/aw-clock/2.8.0/aw-clock-w-stand-07.jpg)

<br>

#### Raspberry Pi Model 4 attached to stand-offs

I was a bit uncertain how well machine screws would work with the stand-offs that I’d designed, since I wanted them to function like self-tapping screws. As it turned out, the four M2.5 x 6 mm pan-head machine screws fit quite nicely and snugly, without being difficult to turn. If the Pi were to be repeatedly removed and reattached, however, this design might not be durable enough. For my current purposes, it’s just fine.

![Raspberry Pi Model 4 attached to stand-offs](https://shetline.com/readme/aw-clock/2.8.0/aw-clock-w-stand-08.jpg)

<br>

#### GPS HAT added, and components wired together

![GPS HAT added, and components wired together](https://shetline.com/readme/aw-clock/2.8.0/aw-clock-w-stand-09.jpg)

<br>

#### Monitor connections for HDMI video and USB touchscreen

I was able to find a [single, short HDMI cable](https://www.amazon.com/gp/product/B07BLX88H4/) with a 90°-down micro HDMI connector on one end. This is great for use with the Pi 4, replacing the two separate cables plugged together I started out with when I got the 4: a short dual HDMI male cable combined with an HDMI-to-micro-HDMI adapter cable.

I couldn’t find a right-angle USB-C cable for hooking up the touchscreen, but I did find a [right-angle adapter](https://www.amazon.com/gp/product/B07JK1G6W2/) and a short [male USB C to male USB A 2.0 cable](https://www.amazon.com/gp/product/B012V56D2A/).

![Monitor connections for HDMI video and USB touchscreen](https://shetline.com/readme/aw-clock/2.8.0/aw-clock-w-stand-10.jpg)

<br>

#### Rearview of completed clock project

![finished project](https://shetline.com/readme/aw-clock/2.8.0/aw-clock-w-stand-11.jpg)

<br>

### Parts

* Raspberry Pi 4 with 2 GB RAM
* [Adafruit Ultimate GPS HAT](https://www.adafruit.com/product/2324) (connected using a stacking header, so it was still easy to attach the leads for the temperature/humidity sensor and the RF receiver)
* [Active GPS antenna](https://www.amazon.com/gp/product/B07NY16GH5/)
* 2560x1600 ELECROW 10.1" touchscreen (in pixel doubling mode)
* Custom-printed 3D stand
* Wired DHT22/AM2302 sensor
* 2 x 433 MHz Acu Rite 06002M wireless temperature and humidity sensors
* 433 MHz receiver module
* [¼-wave 433 MHz antenna](https://www.digikey.com/en/products/detail/linx-technologies-inc/ANT-433-PW-RA/340122)
* Miscellaneous jumper wires, cables, machine screws (some specifics listed above), etc.
* Suggested: SD extension cable for easier access to SD card.

<br>

### Info for code development, testing, and non-Raspberry Pi use

To build and run this project you can use the following commands:

* “`sudo ./build.sh` &#x5B; _various-options_ &#x5D;” to run the installer.
* “`npm run first-install`” to install all npm packages needed for both the client and the server (a separate, inner project) with one command.
* “`npm run build` &#x5B;‑‑ _various-options_ &#x5D;” to build. (Please note the `‑‑` (double-dash) all by itself, which must come before all other options.)
* “`npm run start-server`” to start the data server for this project (except on Windows) on `localhost:4201`. (You may need to make this precede this command with `sudo`.) The server will be automatically restarted whenever you edit the code.
* “`npm run start-server-win`” to start the data server for this project (on Windows) on `localhost:4201`.
* “`npm start`” to serve the web client using webpack-dev-server on `localhost:4200`. The client will be automatically restarted whenever you edit the code. _(Note that for development and testing, two different ports are used (4200, 4201), but that when the server is deployed, all content and data is served on a single port, by default 8080.)_

To build the server along with the web client, use `npm run build`, possibly followed by `‑‑` and other options listed below:

| &nbsp;           | &nbsp;                                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `‑‑acu`          | Install support for wireless temperature/humidity sensors using a 433 MHz receiver module.                                                                                                                        |
| `‑‑acu‑`         | Clears saved `‑‑acu` setting when not using interactive mode.                                                                                                                                                     |
| `‑‑admin`        | Enables the user actions “Update”, “Shut down”, “Reboot”, and “Quit” in the Settings dialog.                                                                                                                      |
| `‑‑admin-`       | Clears the `--admin` setting.                                                                                                                                                                                     |
| `‑‑ddev`         | This stands for “dedicated device”. This is for setting up a Raspberry Pi to primarily serve as an Astronomy/Weather Clock, automatically booting as a clock in full-screen mode. This implies the `‑‑sd` option. |
| `‑‑dht`          | Install support for a wired DHT22/AM2302 temperature/humidity sensor.                                                                                                                                             |
| `‑‑dht‑`         | Clears saved `‑‑dht` setting when not using interactive mode.                                                                                                                                                     |
| `‑‑help`         | Display brief help message.                                                                                                                                                                                       |
| `‑i`             | Interactive mode. This prompts you to enter various configuration options, and implies the `‑‑ddev` option.                                                                                                       |
| `‑‑launch`       | When installation is finished, launch the software.                                                                                                                                                               |
| `‑‑kiosk`        | Start web browser in kiosk mode (this is the default).                                                                                                                                                            |
| `‑‑kiosk-`       | Do not start web  browser in kiosk mode.                                                                                                                                                                          |
| `‑‑pt`           | This stands for “plain text”. It defeats console colors and animation.                                                                                                                                            |
| `‑‑reboot`       | When installation is finished, reboot your system.                                                                                                                                                                |
| `‑‑sd`           | This stands for “standard deployment”. It causes the generated code to be moved to the `~/weather` directory, first deleting whatever might have already been there first.                                        |
| `‑‑skip‑upgrade` | This disables the `apt-get` update and upgrade normally performed as a standard part of the dedicated device set-up                                                                                               |
| `‑‑tarp`         | This stands for “treat as Raspberry Pi”. This option can be used on a Linux Debian system, using the LXDE desktop, to simulate most Raspberry Pi functionality.                                                   |

### Server configuration

The following environment variables affect how the server part of this software runs. They are defined in the file `etc/defaults/weatherService` for the purposes of the dedicated device set-up.

* `AWC_ALLOW_ADMIN`: If `true`, an app user on localhost will be able to perform update, shut down, reboot, and quit operations via the Settings dialog.
* `AWC_ALLOW_CORS`: CORS stands for “Cross-Origin Resource Sharing”, and is an HTTP security feature. Most HTTP servers disable CORS by default. This software, however, turns CORS on by default (by setting this environment variable to `true`) to allow data sharing when the server is running on port 4201 and the client on port 4200 during development testing. When running the clock as a deployed service, however, you can disable CORS by deleting `AWC_ALLOW_CORS` from the `etc/defaults/weatherService` file, or by setting it to `false`.
* `AWC_DARK_SKY_API_KEY`: If you want to use Dark Sky either as a primary or back-up weather data service, this must be set to a valid Dark Sky API key. (See <https://darksky.net/> for further details.). *Please note that new Dark Sky API keys are no longer available, and the API service will end at the end of 2021.*
* `AWC_GIT_REPO_PATH`: The path to your aw-clock Git repository.
* `AWC_GOOGLE_API_KEY`: An API key for Google geocoding, used to convert GPS latitude/longitude into city and place names. As an alternative, or in addition, you can set up `AWC_WEATHERBIT_API_KEY` for both geocoding and weather data.
* `AWC_KIOSK_MODE`: `true` or `false` for whether or not the dedicated-device web browser is launched in kiosk mode (the default) or not.
* `AWC_LOG_CACHE_ACTIVITY`: As a debugging/development aid, set to `true` to enable additional logging of the server’s web cache behavior.
* `AWC_NTP_SERVER`: NTP server used by this software. (See previous comments about selecting alternate servers.)
* `AWC_PORT`: By default the deployed server runs on localhost port 8080, but you can use a different port if you prefer.
* `AWC_PREFERRED_WS`: Your preferred weather service, `weatherbit`, `wunderground`, or `darksky`. `wunderground` is the default.
* `AWC_WEATHERBIT_API_KEY`: A RapidAPI API key for the Weatherbit.io weather service. This will also function for geocoding (see `AWC_GOOGLE_API_KEY`).
* `AWC_WIRED_TH_GPIO`: The GPIO number for a wired indoor temperature/humidity sensor, if any. Delete (or do not define) this entry if you don’t have the wired sensor hardware connected.
* `AWC_WIRELESS_TH_GPIO`:  The GPIO number for the 433 MHz RF module that receives wireless temperature/humidity data, if any. Delete (or do not define) this entry if you don’t have the RF module connected, or the necessary wireless sensors.

Don’t forget to run `sudo update-rc.d weatherService defaults` after editing the `weatherService` file.

### Installation details

For reference, here’s a break down of the steps performed by a full installation:

1. Node.js is installed if not present, or updated if earlier than version 14. Switch to Node 14 using nvm (Node Version Manager) may occur if nvm is installed.
1. If Node.js is greater than version 14, nvm will be used to step down to version 14, installing nvm if necessary to do so.
1. For Node.js version 14, substitute version 12 in the descriptions above for a Raspberry Pi with less than 2 GB RAM.
1. An `npm install` is performed to bootstrap the rest of the installation process, which is written in TypeScript and requires Node.js and several npm packages to function. This can be very slow the first time.
1. A check for GPS configuration is performed.
1. If running in interactive mode (`‑i`), the user is queried about various configuration and installation options.
1. If the `weatherService` service is running, it’s stopped.
1. `apt-get update` and `apt-get upgrade` are executed, unless defeated with the `‑‑skip‑upgrade` option.
1. The following packages are installed, if not already present: `pigpio`, `chromium-browser` (just plain `chromium` on Debian), `unclutter`, `forever` (a global npm package, not via apt-get), and a few fonts as well.
1. `xscreensaver` is then disabled. Why install a screen saver just to turn around and disable it? To make sure no other screen saver blanks the screen - the display of the clock is intended to stay on 24/7.
1. The application client is built.
1. The application server is built.
1. If you’re running `build.sh`, your Git branch was clean before running the installer, and the only thing that changes as far as Git is concerned are your `package-lock.json` files, a `git --reset hard` will be performed to revert those changes and keep your branch clean.
1. If specified, server options for wired and/or wireless sensors are installed.
1. A combined client/server distribution directory is created.
1. If any of the options `‑‑ddev`, `‑i`, or `‑‑sd` are used, the distribution is copied to the `~/weather` directory (typically `/home/pi/weather`), deleting anything which might have previously been present in that directory.

    _No further steps listed below are performed except as part of dedicated device set-up (options `‑‑ddev` or `‑i`)_.
1. The file `weatherService` (located in the `raspberry_pi_setup` folder) is copied to `/etc/init.d/`, and changed to root ownership.
1. Server set-up options are saved to `/etc/defaults/weatherService`, which is also owned by root. Rather than re-running the installer to change the server set-up, you can edit this file directly, update the service with `sudo update-rc.d weatherService defaults`, then restart the server either by rebooting your system, or using the command `sudo service weatherService restart`.
1. The commands `sudo update-rc.d weatherService defaults` and `sudo systemctl enable weatherService` are performed to establish and enable the service.
1. An `autostart` file is created in `~/.config/lxsession/LXDE-pi/` (no `-pi` on the end for Debian), or the existing `autostart` file is modified, to launch the Chromium web browser in kiosk mode, displaying the Astronomy/Weather Clock.
1. The included file `autostart_extra.sh` is also copied to the above directory. This adds code to make sure Chromium doesn’t launch complaining it was shut down improperly, which could interfere with an otherwise smooth automatic start-up.
1. The options `‑‑launch` or `‑‑reboot` are performed if specified.

### Developer notes

To greatly improve the speed and reliability of automated installations and updates, the often troublesome node-sass has been moved into a separate `sass` directory. To set up node-sass, `cd` into the `sass` directory and enter `npm i`. This prepares you for translating the source file `styles.scss` into `styles.css`.

Once this is set up, you can use `npm run build:sass` to make sure any changes you make to `styles.scss` are carried over into `styles.css`. `styles.css` is also automatically updated any time you use `npm start`.

To update any changes made to `build.ts`, use `npm run build:build`
