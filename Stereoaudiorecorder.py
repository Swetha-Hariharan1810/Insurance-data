class StereoAudioRecorder {
  constructor(mediaStream, config) {
    this.mediaStream = mediaStream;
    this.config = config || {};
    this.sampleRate = this.config.sampleRate || 44100;
    this.bufferSize = this.config.bufferSize || 4096;
    this.numberOfAudioChannels = this.config.numberOfAudioChannels || 2;
    this.leftChannel = [];
    this.rightChannel = [];
    this.recordingLength = 0;
    this.context = new (window.AudioContext || window.webkitAudioContext)();
  }

  record() {
    this.audioInput = this.context.createMediaStreamSource(this.mediaStream);
    this.recorder = this.context.createScriptProcessor(this.bufferSize, this.numberOfAudioChannels, this.numberOfAudioChannels);

    this.recorder.onaudioprocess = (event) => {
      let left = event.inputBuffer.getChannelData(0);
      let right = event.inputBuffer.getChannelData(1);
      this.leftChannel.push(new Float32Array(left));
      this.rightChannel.push(new Float32Array(right));
      this.recordingLength += this.bufferSize;
    };

    this.audioInput.connect(this.recorder);
    this.recorder.connect(this.context.destination);
  }

  stop(callback) {
    this.recorder.disconnect();
    this.audioInput.disconnect();

    let leftBuffer = this.mergeBuffers(this.leftChannel, this.recordingLength);
    let rightBuffer = this.mergeBuffers(this.rightChannel, this.recordingLength);
    let interleaved = this.interleave(leftBuffer, rightBuffer);

    let audioBlob = new Blob([interleaved], { type: 'audio/pcm' });
    callback(audioBlob);
  }

  mergeBuffers(channelBuffer, recordingLength) {
    let result = new Float32Array(recordingLength);
    let offset = 0;
    channelBuffer.forEach(buffer => {
      result.set(buffer, offset);
      offset += buffer.length;
    });
    return result;
  }

  interleave(leftChannel, rightChannel) {
    let length = leftChannel.length + rightChannel.length;
    let result = new Float32Array(length);

    let inputIndex = 0;
    for (let index = 0; index < length;) {
      result[index++] = leftChannel[inputIndex];
      result[index++] = rightChannel[inputIndex];
      inputIndex++;
    }
    return result;
  }
}

export default StereoAudioRecorder;
