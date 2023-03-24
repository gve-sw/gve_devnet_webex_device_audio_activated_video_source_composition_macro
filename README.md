# GVE Devnet Webex Device Audio Activated Video Source Composition Macro

Macro to set main video source input composition on a Webex device based on which microphones detect audio activity.

3/23/23 Updates:

- Added Auto Top N composition feature
- Added sample macros to install on Webex devices being used as video inputs (i.e. Webex Room Bar) so that they stay in full-screen self-view while speakertracking and never go standby.
- Added QuadCam support.
- Support for re-initializing the macro after a camera firmware update

## Contacts

- Gerardo Chaves (gchaves@cisco.com)
- William Mills (wimills@cisco.com)

## Solution Components

- Webex
- Webex Devices
- xAPI

## Prerequisites

- Devices must be running RoomOS 10.8 or later

## Installation/Configuration

1. Load the Javascript code included in the auto_source_composer.js file in this repository into a new Macro in the Macro editor of the Cisco Webex device you wish to use.
2. Before activating the macro, modify the `config` constant if needed as follows:

`monitorMics` is an array that should contain all microphones connected to the codec that we want to consider for the automatic switching logic. Default is all 8 mics in a Codec Pro but you can reduce it to only those being used for which the macro will turn on VuMeters and monitor.

`compositions` is an array of objects that specify which connectors to use to compose the video inputs and which microphones need to have activity detected to trigger the new composition. Below is an example:

```
    {
      name: 'Composition1',     // Name for your composition
      mics: [1, 2],             // Mics you want to associate with this composition
      connectors: [1,2,3,4],    // Video input connector Ids to use
      layout: 'Prominent'       // Layout to use
    }
```

You can have as many compositions as you want, but the Codec Pro only has 8 mic connectors so you would only make sense to specify a maximum of 8. The default in the code is four compositions each triggered by 2 microphones. You can change the content of the `mics` array to specify which microphones are associated to a particular composition. That array can also have up to 8 values but it is more typical it will have 1 or 2.  
The value for the `connectors` key in the object is an array of connector IDs to use in the `xapi.Command.Video.Input.SetMainVideoSource()` command. They will be specified when issuing the command to change layouts in the same order as you configure here. There is a maximum of 4 connector IDs you can specify.
The value for the `layout` key in the object specifies the type of layout to select when using the `xapi.Command.Video.Input.SetMainVideoSource()` command to set the new composition as the main video source.  
Do not change the names of any of the keys in the object nor the number of keys since the macro looks for the ones described here explicitely.

You also need to specify at least one coposition that contains microphone index 0 which the macro uses to handle silence conditions or the mute button being pressed.
This is an example that has been configured by default for you to specify what happens when there is no audio:

```
    {
      name: 'NoAudio',          // Name for your composition
      mics: [0],
      connectors: [1,2,3,4],
      layout: 'Equal'
    }
```

If you wish to enable the automatic composition of the top N video sources where people are speaking, you need to modify the `auto_top_speakers` constant and set it's `enabled` attribute to `true`. You also need to specify the maximum amount of segments to consider as top speakers (maximum of 4) in the `max_speakers` attribute as well as the video connectors to compose from _in the proper order_ you want them layed out on the screen. You use the `default_connectos` for this and the macro will automatically use that list of connectors and the layout specified in the `layout` attribute to set the main video source, but it will eliminate the video connectors for the segments where there is not enough noise to go above the `MICROPHONE_HIGH` threshold explained below.  
This is an example that has been configured by default for you to modify if you want to turn on top N automatic composition:

```
const auto_top_speakers = {
  enabled: false, // if set to true, the macro will dynamically create composition of top speaker segments
  max_speakers: 2, // specify maximum number of top speaker segments to compose
  default_connectors: [1, 2, 3, 4], // specify connectos to use for top speakers composition in order
  layout: 'Equal'
}
```

You also might want to modify the following constants:

`QUAD_CAM_ID` is the connector ID of where the QuadCam is connected on this codec. If no QuadCam, set to 0. Default is 1.

`SIDE_BY_SIDE_TIME` is the time to wait for silence before setting composition for silent mode. Defaut is 10000ms (10 seconds)

`NEW_SPEAKER_TIME` is the time to wait before switching to a new speaker. Defautl is 2000ms (2 seconds)

`MICROPHONELOW` represents the microphone low threshold for vuMeter readings. You can see the average value it is calculating to trigger the behavior
in the console messages for the macro when it reports 'Low Triggered'. Adjust higher if the macro is having trouble detecting silence. Default value is 6.

`MICROPHONEHIGH` represents the microphone high threshold for vuMeter readings. You can see the average value it is calculating to trigger the behavior
in the console messages for the macro when it reports 'High Triggered'. Adjust lower if the macro is having trouble detecting audio activity. Default value is 25.

3. If any of the connector inputs you are using correspond to video coming from another Cisco Room device such as a Room Bar, you might want to install the macro included in the `fixed_input_main_output.js` file on that codec and enable it so that it is always sending over HDMI output 1 the input from it's main camera and never goes on standby. It also turns on SpeakerTrack on that device. As long as you keep that macro running , it will fix those settings everytime the device restarts/reboots. If you wish to revert the effects of that macro, just install the macro in file `reset_fixed_input.js` and run it once on that device, and make sure you turn off the fixed_input_main_output macro.

4. Activate the macro

5. On the Touch 10 or Navigator device of you codec, touch the "Auto Source Control" custom panel button and set the "Video Source Composing" toggle button to "Auto". You can always come back to the custom panel and turn it off.

> If you are unfamiliar with Cisco Room device macros, [this](https://help.webex.com/en-us/np8b6m6/Use-of-Macros-with-Room-and-Desk-Devices-and-Webex-Boards) is a good article to get started.

> For some sample code to show you how to automate the deployment of this macro, wallpapers, touch 10 UI controls and others to multiple Webex devices, you can visit [this repository](https://github.com/voipnorm/CE-Deploy)

> For information on deploying the macros, you can read the [Awesome xAPI GitHub repository](https://github.com/CiscoDevNet/awesome-xapi#user-content-developer-tools). In addition to the deployment information, this repository also has tutorials for different macro uses, articles dedicated to different macro capabilities, libraries to help interacting with codecs, code samples illustrating the xAPI capabilities, and sandbox and testing resources for macro applications.

## Usage

# Screenshots

### LICENSE

Provided under Cisco Sample Code License, for details see [LICENSE](LICENSE.md)

### CODE_OF_CONDUCT

Our code of conduct is available [here](CODE_OF_CONDUCT.md)

### CONTRIBUTING

See our contributing guidelines [here](CONTRIBUTING.md)

#### DISCLAIMER:

<b>Please note:</b> This script is meant for demo purposes only. All tools/ scripts in this repo are released for use "AS IS" without any warranties of any kind, including, but not limited to their installation, use, or performance. Any use of these scripts and tools is at your own risk. There is no guarantee that they have been through thorough testing in a comparable environment and we are not responsible for any damage or data loss incurred with their use.
You are responsible for reviewing and testing any scripts you run thoroughly before use in any non-testing environment.
