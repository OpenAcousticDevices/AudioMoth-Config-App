/****************************************************************************
 * app.js
 * openacousticdevices.info
 * June 2017
 *****************************************************************************/

'use strict';

/*global document, Uint8Array*/
/*jslint bitwise: true*/

var audiomoth = require('audiomoth-hid');

var ui = require('./ui.js');
var timeHandler = require('./timePeriods.js');
var saveLoad = require('./saveLoad.js');
var lifeDisplay = require('./lifeDisplay.js');

var electron = require('electron');
var dialog = electron.remote.dialog;

/* UI components */

var ledCheckbox = document.getElementById('led-checkbox');

var recordingDurationInput = document.getElementById('recording-duration-input');
var sleepDurationInput = document.getElementById('sleep-duration-input');

var configureButton = document.getElementById('configure-button');

var startTimeInput = document.getElementById('start-time-input');
var endTimeInput = document.getElementById('end-time-input');

/* Setting parameters */

var AM_HFRCO_21MHZ = 4;
var AM_HFRCO_28MHZ = 5;
var AM_HFXO = 6;

var configurations = [{
    sampleRate: 8000,
    clockBand: AM_HFRCO_21MHZ,
    clockDivider: 2,
    acquisitionCycles: 8,
    oversampleRate: 64,
    current: 5.6
}, {
    sampleRate: 16000,
    clockBand: AM_HFRCO_21MHZ,
    clockDivider: 2,
    acquisitionCycles: 8,
    oversampleRate: 32,
    current: 6.1
}, {
    sampleRate: 32000,
    clockBand: AM_HFRCO_21MHZ,
    clockDivider: 2,
    acquisitionCycles: 8,
    oversampleRate: 16,
    current: 7.1
}, {
    sampleRate: 48000,
    clockBand: AM_HFRCO_21MHZ,
    clockDivider: 2,
    acquisitionCycles: 2,
    oversampleRate: 16,
    current: 7.6
}, {
    sampleRate: 96000,
    clockBand: AM_HFRCO_21MHZ,
    clockDivider: 2,
    acquisitionCycles: 1,
    oversampleRate: 8,
    current: 10.4
}, {
    sampleRate: 192000,
    clockBand: AM_HFRCO_21MHZ,
    clockDivider: 2,
    acquisitionCycles: 1,
    oversampleRate: 4,
    current: 18.1
}];

function errorOccurred(err) {

    console.error(err);

    ui.disableDisplay();

}

/* Request, receive and handle AudioMoth information packet */

function getAudioMothPacket() {

    var id, date, batteryState;

    audiomoth.getPacket(function (err, packet) {

        if (err) {

            errorOccurred(err);

        } else if (packet === null) {

            ui.disableDisplay();

        } else {

            date = audiomoth.convertFourBytesFromBufferToDate(packet, 1);

            id = audiomoth.convertEightBytesFromBufferToID(packet, 1 + 4);

            batteryState = audiomoth.convertOneByteFromBufferToBatteryState(packet, 1 + 4 + 8);

            ui.enableDisplayAndShowTime(date);

            ui.updateIdDisplay(id);

            ui.updateBatteryDisplay(batteryState);

        }

        setTimeout(getAudioMothPacket, 1000);

    });

}

/* Write bytes into a buffer for transmission */

function writeLittleEndianBytes(buffer, start, byteCount, value) {
    var i;

    for (i = 0; i < byteCount; i += 1) {
        buffer[start + i] = (value >> (i * 8)) & 255;
    }
}

/* Submit configuration packet and configure device */

function configureDevice() {

    var packet, index, date, configuration, i, timePeriods;

    /* Build configuration packet */

    packet = new Uint8Array(62);
    index = 0;

    date = new Date();
    writeLittleEndianBytes(packet, index, 4, date.valueOf() / 1000);
    index += 4;

    packet[index] = parseInt(ui.getSelectedRadioValue("gain-radio"), 10);
    index += 1;

    configuration = configurations[parseInt(ui.getSelectedRadioValue("sample-rate-radio"), 10)];

    packet[index] = configuration.clockBand;
    index += 1;
    packet[index] = configuration.clockDivider;
    index += 1;
    packet[index] = configuration.acquisitionCycles;
    index += 1;
    packet[index] = configuration.oversampleRate;
    index += 1;
    writeLittleEndianBytes(packet, index, 4, configuration.sampleRate);
    index += 4;

    writeLittleEndianBytes(packet, index, 2, sleepDurationInput.value);
    index += 2;
    writeLittleEndianBytes(packet, index, 2, recordingDurationInput.value);
    index += 2;

    if (ledCheckbox.checked) {

        packet[index] = 0x01;

    } else {

        packet[index] = 0x00;

    }
    index += 1;

    timePeriods = timeHandler.getTimePeriods();
    packet[index] = timePeriods.length;
    index += 1;

    for (i = 0; i < timePeriods.length; i += 1) {

        writeLittleEndianBytes(packet, index, 2, timePeriods[i].startMins);
        index += 2;
        writeLittleEndianBytes(packet, index, 2, timePeriods[i].endMins);
        index += 2;

    }

    /* Send packet to device */

    audiomoth.setPacket(packet, function (err, data) {

        var j, matches, showError;

        showError = function () {
            dialog.showErrorBox("Configuration failed.", "Configuration was not applied to AudioMoth\nPlease reconnect device and try again.");
        };

        if (err || data === null || data.length === 0) {

            showError();

        } else {

            matches = true;

            for (j = 0; j < Math.min(packet.length, data.length - 1); j += 1) {
                if (packet[j] !== data[j + 1]) {
                    console.log(packet[j] + ' - ' + data[j + 1]);
                    matches = false;
                    break;
                }
            }

            if (matches) {

                configureButton.style.color = "green";
                setTimeout(function () {
                    configureButton.style.color = "";
                }, 1000);

            } else {

                showError();

            }

        }

    });

}

/* Initiliase lifeDisplay configuration data */

lifeDisplay.setConfigurationData(configurations);

/* Initialise UI elements */

ui.drawTimeLabels();

timeHandler.updateTimeList();

ui.updateCanvasTimer();

ui.disableDisplay();

ui.initialiseDisplay();

ui.addRadioButtonListeners();

setTimeout(getAudioMothPacket, 1000);

configureButton.addEventListener('click', function () {
    ui.checkInputs(configureDevice);
});