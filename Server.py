from fastapi import FastAPI, WebSocket
from whisper import transcribe
import pyaudio
import tempfile

app = FastAPI()

CHUNK = 1024  # Audio chunk size in bytes
FORMAT = pyaudio.paInt16  # Audio format
CHANNELS = 1  # Number of channels (mono)
RATE = 44100  # Sampling rate

@app.websocket("/record")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    try:
        # Create a temporary file for audio data
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
            temp_filename = temp_file.name

            while True:
                if not is_recording.value:  # Check if recording is stopped
                    break
                audio_data = await websocket.receive_bytes()

                # Write audio data to the temporary file
                with open(temp_filename, "ab") as f:
                    f.write(audio_data)

            # Transcribe the audio
            transcript = transcribe(temp_filename, model="base")  # Adjust model as needed

            # Delete the temporary file after transcription
            os.remove(temp_filename)

            # Send transcript back to client (optional)
            # await websocket.send_text(transcript["text"])

    except Exception as e:
        print(f"Error: {e}")

    finally:
        await websocket.close()

is_recording = FastAPI.get_app("main").extra["is_recording"]  # Shared flag

import os  # Import for file deletion

if __name__ == "__main__":
    is_recording = {"value": False}  # Global recording state
    import asyncio

    asyncio.run(uvicorn.run("main:app", host="0.0.0.0", port=8000))
