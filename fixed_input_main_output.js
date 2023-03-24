import xapi from 'xapi';

xapi.Command.Video.Matrix.Assign({ Output: 1,  SourceId: 1 });
xapi.Config.Standby.Control.set('Off');
xapi.Command.Cameras.SpeakerTrack.Activate();