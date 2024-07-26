// worklet-processor.js
class PCMProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            this.port.postMessage(input[0]);
        }
        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);
