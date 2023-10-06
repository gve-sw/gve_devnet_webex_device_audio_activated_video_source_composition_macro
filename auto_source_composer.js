/*
Copyright (c) 2023 Cisco and/or its affiliates.
This software is licensed to you under the terms of the Cisco Sample
Code License, Version 1.1 (the "License"). You may obtain a copy of the
License at
               https://developer.cisco.com/docs/licenses
All use of the material herein must be in accordance with the terms of
the License. All rights not expressly granted by the License are
reserved. Unless required by applicable law or agreed to separately in
writing, software distributed under the License is distributed on an "AS
IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
or implied.
*/
/////////////////////////////////////////////////////////////////////////////////////////
// REQUIREMENTS
/////////////////////////////////////////////////////////////////////////////////////////

import xapi from 'xapi';


/////////////////////////////////////////////////////////////////////////////////////////
// INSTALLER SETTINGS
/////////////////////////////////////////////////////////////////////////////////////////


const config = {
  monitorMics: [1, 2, 3, 4, 5, 6, 7, 8], // input connectors associated to the microphones being used in the room
  ethernetMics: [11, 12, 13, 14], // IDs associated to Ethernet mics: e.j. 12 is Ethernet Mic 1, sub-ID 2
  usbMics: [101], // Mic input connectors associated to the USB microphones being used in the main codec: 101 is USB Mic 1
  compositions: [        // Create your array of compositions
    {
      name: 'Composition1',     // Name for your composition
      mics: [1, 2],             // Mics you want to associate with this composition
      connectors: [1, 2, 3, 4],    // Video input connector Ids to use
      layout: 'Prominent'       // Layout to use
    },
    {
      name: 'Composition2',     // Name for your composition
      mics: [3, 4],
      connectors: [2, 1, 3, 4],
      layout: 'Prominent'
    },
    {
      name: 'Composition3',     // Name for your composition
      mics: [5, 6],
      connectors: [3, 1, 2, 4],
      layout: 'Prominent'
    },
    {
      name: 'Composition4',     // Name for your composition
      mics: [7, 8],
      connectors: [4, 1, 2, 3],
      layout: 'Prominent'
    },
    {
      name: 'NoAudio',          // Name for your composition
      mics: [0],
      connectors: [1, 2, 3, 4],
      layout: 'Equal'
    }

  ]
}


/*
// Set the camera_positions constant below if you wish to pre set pre set camera positions as like this example:

const camera_positions = [
  {
    cameraID: 1,
    pan: 1000,
    tilt: 1000,
    zoom: 100
  },
  {
    cameraID: 3,
    pan: 1500,
    tilt: 1500,
    zoom: 150
  }
]
*/

const camera_positions = []  // remove this line if you set specific values as per example above



camera_positions.forEach(position => {
  xapi.Command.Camera.PositionSet(
    { CameraId: position.cameraID, Pan: position.pan, Tilt: position.tilt, Zoom: position.zoom });
})


const auto_top_speakers = {
  enabled: false, // if set to true, the macro will dynamically create composition of top speaker segments
  max_speakers: 2, // specify maximum number of top speaker segments to compose
  default_connectors: [1, 2, 3, 4], // specify connectos to use for top speakers composition in order
  layout: 'Equal'
}

const QUAD_CAM_ID = 1; // If the codec has a Quadcam, specify the connector ID here. Otherwise set to 0


/*
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
+ SECTION 2 - SECTION 2 - SECTION 2 - SECTION 2 - SECTION 2 - SECTION 2 +
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

TIMERS and THRESHOLDS
*/


// Time to wait for silence before setting Speakertrack Side-by-Side mode
const SIDE_BY_SIDE_TIME = 10000; // 10 seconds
// Time to wait before switching to a new speaker
const NEW_SPEAKER_TIME = 2000; // 2 seconds

/////////////////////////////////////////////////////////////////////////////////////////
// CONSTANTS/ENUMS
/////////////////////////////////////////////////////////////////////////////////////////


// Microphone High/Low Thresholds
const MICROPHONELOW = 6;
const MICROPHONEHIGH = 25;


/*
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
+ DO NOT EDIT ANYTHING BELOW THIS LINE                                  +
+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
*/



var top_speakers_connectors = [];
var mic_connectors_map = {}
// create a map of microphones to corresponding main video connector
config.compositions.forEach(compose => {
  compose.mics.forEach(mic => {
    mic_connectors_map[mic] = compose.connectors[0];
  })
});
var comp_sets_array = [] // array of top speaker compositions to keep track of for last speaker value



const PANEL_control =
  `<Extensions>
    <Panel>
      <Origin>local</Origin>
      <Location>HomeScreenAndCallControls</Location>
      <Icon>Camera</Icon>
      <Color>#07C1E4</Color>
      <Name>Auto Source Control</Name>
      <ActivityType>Custom</ActivityType>
      <Page>
        <Name>Auto Source Control</Name>
        <Row>
          <Name>Video Source Composing</Name>
          <Widget>
            <WidgetId>vid_source_text_manual</WidgetId>
            <Name>Manual</Name>
            <Type>Text</Type>
            <Options>size=1;fontSize=normal;align=center</Options>
          </Widget>
          <Widget>
            <WidgetId>widget_toggle_auto</WidgetId>
            <Type>ToggleButton</Type>
            <Options>size=1</Options>
          </Widget>
          <Widget>
            <WidgetId>vid_source_text_auto</WidgetId>
            <Name>Auto</Name>
            <Type>Text</Type>
            <Options>size=null;fontSize=normal;align=center</Options>
          </Widget>
        </Row>
        <Row>
          <Name>Test FullScreen Selfview</Name>
          <Widget>
            <WidgetId>vid_source_text_off</WidgetId>
            <Name>Off</Name>
            <Type>Text</Type>
            <Options>size=1;fontSize=normal;align=center</Options>
          </Widget>
          <Widget>
            <WidgetId>widget_FS_selfview</WidgetId>
            <Type>ToggleButton</Type>
            <Options>size=1</Options>
          </Widget>
          <Widget>
            <WidgetId>vid_source_text_on</WidgetId>
            <Name>On</Name>
            <Type>Text</Type>
            <Options>size=null;fontSize=normal;align=center</Options>
          </Widget>
        </Row>
        <PageId>panel_vid_source_control</PageId>
        <Options/>
      </Page>
    </Panel>
    </Extensions>`;

xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'panel_vid_source_control' }, PANEL_control);


/////////////////////////////////////////////////////////////////////////////////////////
// VARIABLES
/////////////////////////////////////////////////////////////////////////////////////////

let micArrays = {};
// Initialize our micArray variable
config.monitorMics.forEach(mic => micArrays[mic.toString()] = [0, 0, 0, 0])
for (var i in config.ethernetMics) {
  micArrays[config.ethernetMics[i].toString()] = [0, 0, 0, 0];
}
for (var i in config.usbMics) {
  micArrays[config.usbMics[i].toString()] = [0, 0, 0, 0];
}
let lowWasRecalled = false;
let lastActiveHighInput = 0;
let allowSideBySide = true;
let sideBySideTimer = null;
let allowCameraSwitching = false;
let allowNewSpeaker = true;
let newSpeakerTimer = null;
let manual_mode = true;

let micHandler = () => void 0;
let micHandlerEthernet = () => void 0;
let micHandlerUSB = () => void 0;


/////////////////////////////////////////////////////////////////////////////////////////
// INITIALIZATION
/////////////////////////////////////////////////////////////////////////////////////////


function evalFullScreen(value) {
  if (value == 'On') {
    setWidget('widget_FS_selfview', 'on');
  }
  else {
    setWidget('widget_FS_selfview', 'off');
  }
}

// evalFullScreenEvent is needed because we have to check when someone manually turns on full screen
// when self view is already selected... it will eventually check FullScreen again, but that should be
// harmless
function evalFullScreenEvent(value) {
  if (value == 'On') {
    xapi.Status.Video.Selfview.Mode.get().then(evalSelfView);
  }
  else {
    setWidget('widget_FS_selfview', 'off');
  }
}

function evalSelfView(value) {
  if (value == 'On') {
    xapi.Status.Video.Selfview.FullscreenMode.get().then(evalFullScreen);
  }
  else {
    setWidget('widget_FS_selfview', 'off');
  }
}

async function init() {
  console.log('init');

  // Stop any VuMeters that might have been left from a previous macro run with a 
  // different monitor mic configuration to prevent errors due to unhandled vuMeter events.
  xapi.Command.Audio.VuMeter.StopAll({});

  // register callback for processing manual mute setting on codec
  xapi.Status.Audio.Microphones.Mute.on((state) => {
    console.log(`handleMicMuteResponse: ${state}`);

    if (state == 'On') {
      stopSideBySideTimer();
      setTimeout(handleMicMuteOn, 2000);
    }
    else if (state == 'Off') {
      handleMicMuteOff();
    }
  });


  // register handler for Widget actions
  xapi.Event.UserInterface.Extensions.Widget.Action.on(processWidgets);

  //  set self-view toggle on custom panel depending on Codec status that might have been set manually
  xapi.Status.Video.Selfview.Mode.get().then(evalSelfView);

  // register to receive events when someone manually turns on self-view
  // so we can keep the custom toggle button in the right state
  xapi.Status.Video.Selfview.Mode.on(evalSelfView);

  // register to receive events when someone manually turns on full screen mode
  // so we can keep the custom toggle button in the right state if also in self view
  xapi.Status.Video.Selfview.FullscreenMode.on(evalFullScreenEvent);

  // next, set Automatic mode toggle switch on custom panel off since the macro starts that way
  setWidget('widget_toggle_auto', 'off')

}


/////////////////////////////////////////////////////////////////////////////////////////
// START/STOP AUTOMATION FUNCTIONS
/////////////////////////////////////////////////////////////////////////////////////////

async function startAutomation() {
  console.log('startAutomation');
  //setting overall manual mode to false
  manual_mode = false;
  allowCameraSwitching = true;

  //registering vuMeter event handler
  if (config.monitorMics.length > 0)
    micHandler = xapi.Event.Audio.Input.Connectors.Microphone.on(event => {
      //adding protection for mis-configured mics
      if (typeof micArrays[event.id[0]] != 'undefined') {
        micArrays[event.id[0]].shift();
        micArrays[event.id[0]].push(event.VuMeter);

        // checking on manual_mode might be unnecessary because in manual mode,
        // audio events should not be triggered
        if (manual_mode == false) {
          // invoke main logic to check mic levels ans switch to correct camera input
          checkMicLevelsToSwitchCamera();
        }
      }
    });


  //registering vuMeter event handler for Ethernet mics
  if (config.ethernetMics.length > 0)
    micHandlerEthernet = xapi.event.on('Audio Input Connectors Ethernet', (event) => {
      //console.log(event)
      event.SubId.forEach(submic => {
        if (typeof micArrays[event.id + submic.id] != 'undefined') {
          micArrays[event.id + submic.id].shift();
          micArrays[event.id + submic.id].push(submic.VuMeter);
          if (manual_mode == false) {
            // invoke main logic to check mic levels ans switch to correct camera input
            checkMicLevelsToSwitchCamera();
          }
        }
      })

    });


  //registering vuMeter event handler for USB mics
  if (config.usbMics.length > 0)
    micHandlerUSB = xapi.event.on('Audio Input Connectors USBMicrophone', (event) => {
      //console.log(event)
      if (typeof micArrays['10' + event.id] != 'undefined') {
        micArrays['10' + event.id].shift();
        micArrays['10' + event.id].push(event.VuMeter);

        // checking on manual_mode might be unnecessary because in manual mode,
        // audio events should not be triggered
        if (manual_mode == false) {
          // invoke main logic to check mic levels ans switch to correct camera input
          checkMicLevelsToSwitchCamera();
        }
      }
    });

  // start VuMeter monitoring
  console.log(`Turning on VuMeter monitoring for mics [${config.monitorMics}]`)

  config.monitorMics.forEach(mic => {
    xapi.Command.Audio.VuMeter.Start(
      { ConnectorId: mic, ConnectorType: 'Microphone', IntervalMs: 500, Source: 'AfterAEC' });
  })


  let ethernetMicsStarted = [];
  for (var i in config.ethernetMics) {
    if (!ethernetMicsStarted.includes(parseInt(config.ethernetMics[i] / 10))) {
      ethernetMicsStarted.push(parseInt(config.ethernetMics[i] / 10));
      xapi.Command.Audio.VuMeter.Start(
        {
          ConnectorId: parseInt(config.ethernetMics[i] / 10),
          ConnectorType: 'Ethernet',
          IncludePairingQuality: 'Off',
          IntervalMs: 500,
          Source: 'AfterAEC'
        });
    }
  }


  for (var i in config.usbMics) {
    xapi.Command.Audio.VuMeter.Start(
      {
        ConnectorId: config.usbMics[i] - 100,
        ConnectorType: 'USBMicrophone',
        IncludePairingQuality: 'Off',
        IntervalMs: 500,
        Source: 'AfterAEC'
      });
  }


  // set toggle button on custom panel to reflect that automation is turned on.
  setWidget('widget_toggle_auto', 'on')
}

function stopAutomation() {
  //setting overall manual mode to true
  manual_mode = true;
  stopSideBySideTimer();
  stopNewSpeakerTimer();
  lastActiveHighInput = 0;
  lowWasRecalled = true;
  console.log("Stopping all VuMeters...");
  xapi.Command.Audio.VuMeter.StopAll({});

  // Get the default main video source and apply it as current
  xapi.Config.Video.DefaultMainSource.get()
    .then(result => {
      console.log(`Switching MainVideoSource to Default Source [${result}]`);
      xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: result });
    })

  // using proper way to de-register handlers
  micHandler();
  micHandler = () => void 0;
  micHandlerEthernet();
  micHandlerEthernet = () => void 0;
  micHandlerUSB();
  micHandlerUSB = () => void 0;

  // set toggle button on custom panel to reflect that automation is turned off.
  setWidget('widget_toggle_auto', 'off')

}

/////////////////////////////////////////////////////////////////////////////////////////
// MICROPHONE DETECTION AND CAMERA SWITCHING LOGIC FUNCTIONS
/////////////////////////////////////////////////////////////////////////////////////////

function checkMicLevelsToSwitchCamera() {

  // make sure we've gotten enough samples from each mic in order to do averages
  if (allowCameraSwitching) {
    // figure out which of the inputs has the highest average level then perform logic for that input *ONLY* if allowCameraSwitching is true

    // first let's check for top N mics with topNMicValue() which will also fill out needed
    // composition to use to set main video source 
    let topMics = topNMicValue();
    let input = topMics[0];
    let average = topMics[1]

    // someone is speaking
    if (average > MICROPHONEHIGH) {
      // start timer to prevent Side-by-Side mode too quickly
      restartSideBySideTimer();
      if (input != 0) {
        lowWasRecalled = false;
        // no one was talking before
        if (lastActiveHighInput === 0) {
          //makeCameraSwitch(input, average);
          makeCompositionSwitch(input, average);
          lastActiveHighInput = input;
          restartNewSpeakerTimer();
        }
        // the same person is talking
        else if (lastActiveHighInput === input) {
          restartNewSpeakerTimer();
        }
        // a different person is talking
        else if (lastActiveHighInput !== input) {
          if (allowNewSpeaker) {
            //makeCameraSwitch(input, average);
            makeCompositionSwitch(input, average);
            lastActiveHighInput = input;
            restartNewSpeakerTimer();
          }
        }
      }
    }
    // no one is speaking
    else if (average < MICROPHONELOW) {
      // only trigger if enough time has elapsed since someone spoke last
      if (allowSideBySide) {
        if (input > 0 && !lowWasRecalled) {
          lastActiveHighInput = 0;
          lowWasRecalled = true;
          makeCompositionSwitch(0, average);

        }
      }
    }
  }
}

async function makeCompositionSwitch(activeMic, average) {
  if (activeMic > 0) {
    console.log("-------------------------------------------------");
    console.log("High Triggered: ");
    console.log(`Input = ${activeMic} | Average = ${average}`);
    console.log("-------------------------------------------------");
  }
  else if (activeMic == 0) {
    console.log("-------------------------------------------------");
    console.log("Low Triggered");
    console.log(`Average = ${average}`);
    console.log("-------------------------------------------------");
  }
  else {
    console.log("-------------------------------------------------");
    console.log("Multi-High Triggered");
    console.log(`Input = ${activeMic} | Average = ${average}`);
    console.log("-------------------------------------------------");
  }

  if (activeMic >= 0) {
    // Apply the composition for active mic. Continue doing this if there is only one ActiveMic with positive value
    config.compositions.forEach(compose => {
      if (compose.mics.includes(activeMic)) {
        console.log(`Switching to composition = ${compose.name}`);
        console.log(`Setting Video Input to connectors [${compose.connectors}]  and Layout: ${compose.layout}`)
        if (QUAD_CAM_ID != 0) pauseSpeakerTrack();
        xapi.Command.Video.Input.SetMainVideoSource(
          {
            ConnectorId: compose.connectors,
            Layout: compose.layout
          });
        if (QUAD_CAM_ID != 0)
          if (compose.connectors.length == 1 && compose.connectors.includes(QUAD_CAM_ID)) resumeSpeakerTrack();
        return;
      }
    })
  }
  else {
    // Here we switch to the previously prepared composition that corresponds to 
    // the top N active speakers. 
    console.log(`Switching to auto-generated top N speakers composition.`);
    console.log(`Setting Video Input to connectors [${top_speakers_connectors}]  and Layout: ${auto_top_speakers.layout}`)
    xapi.Command.Video.Input.SetMainVideoSource(
      {
        ConnectorId: top_speakers_connectors,
        Layout: auto_top_speakers.layout
      });

  }

}


function topNMicValue() {
  let theAverage = 0;
  let averagesMap = {}
  let input = 0;
  let average = 0;

  //NOTE: micArrays is indexed with string representations of integers that are the mic connector ID
  config.monitorMics.forEach(mic => {
    theAverage = averageArray(micArrays[mic.toString()]);
    averagesMap[mic] = theAverage;
  })

  config.ethernetMics.forEach(mic => {
    theAverage = averageArray(micArrays[mic.toString()]);
    averagesMap[mic] = theAverage;
  })

  config.usbMics.forEach(mic => {
    theAverage = averageArray(micArrays[mic.toString()]);
    averagesMap[mic] = theAverage;
  })

  let entries = Object.entries(averagesMap)
  let sorted = entries.sort((a, b) => a[1] - b[1]);

  //capture top mic and average in case we need to return just that below
  input = parseInt(sorted[sorted.length - 1][0])
  average = parseInt(sorted[sorted.length - 1][1])

  // check for auto_top_speakers disabled or less than 2 max_speakers to just return top mic and value
  if (sorted.length > 0) {
    if (!auto_top_speakers.enabled || auto_top_speakers.max_speakers < 2) return [input, average]
  } else { return [0, 0]; }

  // now that we know that auto_top_speakers is enabled and looking for 2 or more top speaker segments,
  // we iterate through averages focusing only on those above MICROPHONEHIGH
  // and map those to the corresponding connector and remove duplciates
  // then check to see if more than one top speakers are active to calculate the new layout
  let sorted_high_connectors = []
  let theSet = new Set()
  for (let i = sorted.length - 1; i >= 0; i--) {
    let mic_id = sorted[i][0]
    let mic_avg = sorted[i][1]
    let connector = mic_connectors_map[mic_id]
    if (mic_avg > MICROPHONEHIGH) {
      // push connector only if not already there
      if (!sorted_high_connectors.includes(connector)) {
        sorted_high_connectors.push(connector)
        theSet.add(connector)
      };
    }
  }

  // if after removing duplicates we have less than 2 entries, just return the originally expected values
  // of highest input and it's average
  if (sorted_high_connectors.length < 2) return [input, average]

  // now set the top_speakers_connectors gobal variable as a filtered version of auto_top_speakers.default_connectors
  top_speakers_connectors = []
  auto_top_speakers.default_connectors.forEach(connector => {
    if (sorted_high_connectors.includes(connector)) top_speakers_connectors.push(connector)
  })

  // now calculate and return a negative value
  // that corresponds with the unique unordered set of connectors that are being used
  let comp_index = 0

  for (let i = 0; i < comp_sets_array.length; i++) {
    if (difference(comp_sets_array[i], theSet).size == 0) { comp_index = -(i + 1); break; }
  }
  if (comp_index == 0) {
    comp_sets_array.push(theSet)
    comp_index = -(comp_sets_array.length);
  }
  input = comp_index

  return [input, average]
}

function difference(setA, setB) {
  const _difference = new Set(setA);
  for (const elem of setB) {
    _difference.delete(elem);
  }
  return _difference;
}

function averageArray(arrayIn) {
  let sum = 0;
  for (var i = 0; i < arrayIn.length; i++) {
    sum = sum + parseInt(arrayIn[i], 10);
  }
  let avg = (sum / arrayIn.length);
  return avg;
}

function setWidget(widgetId, value) {
  console.log(`Setting Widget [${widgetId}] to [${value}]`)
  xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: value, WidgetId: widgetId });
}

function setSelfview(fsMode, mode, monitorRole) {
  console.log(`Setting Selfview to fsMode: [${fsMode}] | mode: [${mode}] | monitorRole: [${monitorRole}]`)
  xapi.Command.Video.Selfview.Set({ FullscreenMode: fsMode, Mode: mode, OnMonitorRole: monitorRole });
}

function resumeSpeakerTrack() {
  console.log(`resuming speakertrack....`)
  xapi.Command.Cameras.SpeakerTrack.BackgroundMode.Deactivate().catch(handleError);
}

function pauseSpeakerTrack() {
  console.log(`pausing speakertrack....`)
  xapi.Command.Cameras.SpeakerTrack.BackgroundMode.Activate().catch(handleError);
}

/////////////////////////////////////////////////////////////////////////////////////////
// TOUCH 10 UI FUNCTION HANDLERS
/////////////////////////////////////////////////////////////////////////////////////////

function processWidgets(event) {
  switch (event.WidgetId) {
    case 'widget_toggle_auto':
      console.log(`Video Source Control to [${event.Value}]`);
      event.Value === 'off' ? stopAutomation() : startAutomation();
      break;
    case 'widget_FS_selfview':
      console.log(`Selfview toggle set to [${event.Value}]`);
      event.Value === 'off' ? setSelfview('Off', 'Off', 'First') : setSelfview('On', 'On', 'First')
      break;
  }
}


/////////////////////////////////////////////////////////////////////////////////////////
// OTHER FUNCTIONAL HANDLERS
/////////////////////////////////////////////////////////////////////////////////////////

function handleError(error) {
  console.log(error);
}

function handleMicMuteOn() {
  console.log('handleMicMuteOn');
  lastActiveHighInput = 0;
  lowWasRecalled = true;
  //recallSideBySideMode();
  makeCompositionSwitch(0, 0);
}

function handleMicMuteOff() {
  console.log('handleMicMuteOff');
}


/////////////////////////////////////////////////////////////////////////////////////////
// VARIOUS TIMER HANDLER FUNCTIONS
/////////////////////////////////////////////////////////////////////////////////////////

function startSideBySideTimer() {
  if (sideBySideTimer == null) {
    allowSideBySide = false;
    sideBySideTimer = setTimeout(onSideBySideTimerExpired, SIDE_BY_SIDE_TIME);
  }
}

function stopSideBySideTimer() {
  if (sideBySideTimer != null) {
    clearTimeout(sideBySideTimer);
    sideBySideTimer = null;
  }
}

function restartSideBySideTimer() {
  stopSideBySideTimer();
  startSideBySideTimer();
}

function onSideBySideTimerExpired() {
  console.log('onSideBySideTimerExpired');
  allowSideBySide = true;
  //recallSideBySideMode();
  makeCompositionSwitch(0, 0);
}

function startNewSpeakerTimer() {
  if (newSpeakerTimer == null) {
    allowNewSpeaker = false;
    newSpeakerTimer = setTimeout(onNewSpeakerTimerExpired, NEW_SPEAKER_TIME);
  }
}

function stopNewSpeakerTimer() {
  if (newSpeakerTimer != null) {
    clearTimeout(newSpeakerTimer);
    newSpeakerTimer = null;
  }
}

function restartNewSpeakerTimer() {
  stopNewSpeakerTimer();
  startNewSpeakerTimer();
}

function onNewSpeakerTimerExpired() {
  allowNewSpeaker = true;
}

// if the Speakertrack Camera becomes available after FW upgrade, we must re-init so
// we register that action as an event handler
xapi.Status.Cameras.SpeakerTrack.Availability
  .on((value) => {
    console.log("Event received for SpeakerTrack Availability: ", value)
    if (value == "Available") {
      stopAutomation();
      init();
    }
  });


/////////////////////////////////////////////////////////////////////////////////////////
// INVOCATION OF INIT() TO START THE MACRO
/////////////////////////////////////////////////////////////////////////////////////////

init();