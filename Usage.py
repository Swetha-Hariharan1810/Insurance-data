import StereoAudioRecorder from './stereo-audio-recorder.js';

navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
  let recorder = new StereoAudioRecorder(stream, {
    sampleRate: 44100,
    bufferSize: 4096,
    numberOfAudioChannels: 2
  });

  recorder.record();

  setTimeout(() => {
    recorder.stop(audioBlob => {
      let url = URL.createObjectURL(audioBlob);
      let audio = new Audio(url);
      audio.play();
      console.log("Audio Blob: ", audioBlob);
    });
  }, 5000); // Record for 5 seconds
}).catch(error => {
  console.error('Error accessing media devices.', error);
});
