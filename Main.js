// main.js
let audioContext;
let mediaStream;
let mediaStreamSource;
let audioWorkletNode;
let audioBuffer = [];
let isRecording = false;
let socket;
const sampleRate = 44100; // Desired sample rate
const numChannels = 1; // Desired number of channels
const bufferSize = 1024; // Size of the audio buffer to process
const sendInterval = 5000; // 5 seconds

const recordButton = document.getElementById('record');
const stopButton = document.getElementById('stop');
const playback = document.getElementById('playback');

let sendIntervalId;

recordButton.addEventListener('click', async () => {
    socket = new WebSocket('ws://localhost:8080');
    socket.binaryType = 'arraybuffer';

    socket.onopen = async () => {
        // Initialize AudioContext with desired sample rate
        audioContext = new AudioContext({ sampleRate: sampleRate });
        await audioContext.audioWorklet.addModule('worklet-processor.js');
        
        // Get user media with specific constraints
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: sampleRate, channelCount: numChannels } });
        mediaStreamSource = audioContext.createMediaStreamSource(mediaStream);
        
        // Create an AudioWorkletNode
        audioWorkletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
        audioWorkletNode.port.onmessage = (event) => {
            if (event.data instanceof Float32Array) {
                audioBuffer.push(...event.data);
            }
        };
        
        mediaStreamSource.connect(audioWorkletNode).connect(audioContext.destination);
        isRecording = true;
        recordButton.disabled = true;
        stopButton.disabled = false;

        // Start interval to send audio data every 5 seconds
        sendIntervalId = setInterval(sendAudioData, sendInterval);
    };
    
    socket.onclose = () => {
        console.log('WebSocket connection closed');
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
});

stopButton.addEventListener('click', () => {
    mediaStream.getTracks().forEach(track => track.stop());
    audioContext.close();
    isRecording = false;

    if (socket) {
        socket.close();
    }

    // Clear the interval
    clearInterval(sendIntervalId);

    // Send remaining audio data
    if (audioBuffer.length > 0) {
        sendAudioData();
    }

    // Process and playback recorded audio
    const buffer = new Float32Array(audioBuffer);
    const audioBufferForPlayback = audioContext.createBuffer(numChannels, buffer.length, sampleRate);
    audioBufferForPlayback.copyToChannel(buffer, 0);

    const audioBlob = audioBufferToWave(audioBufferForPlayback, audioBufferForPlayback.length);
    playback.src = URL.createObjectURL(audioBlob);

    recordButton.disabled = false;
    stopButton.disabled = true;
});

function sendAudioData() {
    if (audioBuffer.length > 0 && socket.readyState === WebSocket.OPEN) {
        const buffer = new Float32Array(audioBuffer);
        socket.send(buffer.buffer);
        audioBuffer = []; // Clear the buffer after sending
    }
}

function audioBufferToWave(abuffer, len) {
    let numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    // write WAVE header
    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"

    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit (hardcoded in this demo)

    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length

    // write interleaved data
    for (i = 0; i < abuffer.numberOfChannels; i++)
        channels.push(abuffer.getChannelData(i));

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {             // interleave channels
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
            view.setInt16(pos, sample, true);          // write 16-bit sample
            pos += 2;
        }
        offset++                                     // next source sample
    }

    return new Blob([buffer], {type: "audio/wav"});

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}
