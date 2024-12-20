import StereoAudioRecorder from './stereo-audio-recorder.js';
https://chatgpt.com/share/5d2b5a1a-8e2c-4f6c-8d32-5a86d8a5fae0
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
