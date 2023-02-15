/*
Copyright (c) 2021 Cisco and/or its affiliates.
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
  compositions: [        // Create your array of compositions
    {
      name: 'Composition1',     // Name for your composition
      mics: [1, 2],             // Mics you want to associate with this composition
      connectors: [1,2,3,4],    // Video input connector Ids to use
      layout: 'Prominent'       // Layout to use
    },
    {
      name: 'Composition2',     // Name for your composition
      mics: [3, 4],
      connectors: [2,1,3,4],
      layout: 'Prominent'
    },
    {
      name: 'Composition3',     // Name for your composition
      mics: [5, 6],
      connectors: [3,1,2,4],
      layout: 'Prominent'
    },
    {
      name: 'Composition4',     // Name for your composition
      mics: [7, 8],
      connectors: [4,1,2,3],
      layout: 'Prominent'
    },
    {
      name: 'NoAudio',          // Name for your composition
      mics: [0],
      connectors: [1,2,3,4],
      layout: 'Equal'
    }
  ]
}

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
config.monitorMics.forEach( mic => micArrays[mic.toString()] = [0, 0, 0, 0])

let lowWasRecalled = false;
let lastActiveHighInput = 0;
let allowSideBySide = true;
let sideBySideTimer = null;
let allowCameraSwitching = false;
let allowNewSpeaker = true;
let newSpeakerTimer = null;
let manual_mode = true;

let micHandler = () => void 0;


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
  micHandler = xapi.Event.Audio.Input.Connectors.Microphone.on( event => {
    //adding protection for mis-configured mics
    if (typeof micArrays[event.id[0]] != 'undefined') {
      micArrays[event.id[0]].pop();
      micArrays[event.id[0]].push(event.VuMeter);

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

  config.monitorMics.forEach(mic=>{
    xapi.Command.Audio.VuMeter.Start(
    { ConnectorId: mic, ConnectorType: 'Microphone', IntervalMs: 500, Source: 'AfterAEC' });
  })
  
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

  //TODO: check to see if when we stop automation we really want to switch to connectorID 1

  // Get the default main video source and apply it as current
  xapi.Config.Video.DefaultMainSource.get()
  .then(result => {
    console.log(`Switching MainVideoSource to Default Source [${result}]`);
    xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: result });
  })
  
  // using proper way to de-register handlers
  micHandler();
  micHandler = () => void 0;

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
    let array_key = largestMicValue();
    let array = [];
    array = micArrays[array_key];
    // get the average level for the currently active input
    let average = averageArray(array);
    //get the input number as an int since it is passed as a string (since it is a key to a dict)
    let input = parseInt(array_key);
    // someone is speaking
    if (average > MICROPHONEHIGH) {
      // start timer to prevent Side-by-Side mode too quickly
      restartSideBySideTimer();
      if (input > 0) {
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
  else {
    console.log("-------------------------------------------------");
    console.log("Low Triggered");
    console.log(`Average = ${average}`);
    console.log("-------------------------------------------------");
  }

  // Apply the composition for active mic
  config.compositions.forEach(compose =>{
    if(compose.mics.includes(activeMic)){
      console.log(`Switching to composition = ${compose.name}`);
      console.log(`Setting Video Input to connectors [${compose.connectors}]  and Layout: ${compose.layout}`)
      xapi.Command.Video.Input.SetMainVideoSource(
        {
          ConnectorId: compose.connectors,
          Layout: compose.layout
        });
        return;
    }
  })

}

function largestMicValue() {
  // figure out which of the inputs has the highest average level and return the corresponding key
  let currentMaxValue = 0;
  let currentMaxKey = '';
  let theAverage = 0;

  config.monitorMics.forEach(mic => {
    theAverage = averageArray(micArrays[mic.toString()]); 
    if (theAverage >= currentMaxValue) {
      currentMaxKey = mic.toString();
      currentMaxValue = theAverage;
    }
  })

  return currentMaxKey;
}

function averageArray(arrayIn) {
  let sum = 0;
  for (var i = 0; i < arrayIn.length; i++) {
    sum = sum + parseInt(arrayIn[i], 10);
  }
  let avg = (sum / arrayIn.length) * arrayIn.length;
  return avg;
}

function setWidget(widgetId, value){
  console.log(`Setting Widget [${widgetId}] to [${value}]`)
  xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: value, WidgetId: widgetId });
}

function setSelfview(fsMode, mode, monitorRole){
  console.log(`Setting Selfview to fsMode: [${fsMode}] | mode: [${mode}] | monitorRole: [${monitorRole}]`)
  xapi.Command.Video.Selfview.Set({ FullscreenMode: fsMode, Mode: mode, OnMonitorRole: monitorRole });
}


/////////////////////////////////////////////////////////////////////////////////////////
// TOUCH 10 UI FUNCTION HANDLERS
/////////////////////////////////////////////////////////////////////////////////////////

function processWidgets(event) {
  switch (event.WidgetId){
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


/////////////////////////////////////////////////////////////////////////////////////////
// INVOCATION OF INIT() TO START THE MACRO
/////////////////////////////////////////////////////////////////////////////////////////

init();