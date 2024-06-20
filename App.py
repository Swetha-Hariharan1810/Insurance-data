import streamlit as st
from whisper import transcribe
import websockets

# Replace with your backend server address
SERVER_URL = "ws://localhost:8000/record"

recording_state = st.button("Start Recording")
stop_recording_button = st.button("Stop Recording")
transcribe_button = st.button("Transcribe")

is_recording = {"value": False}  # Shared recording state (matches backend)

async def send_audio():
    async with websockets.connect(SERVER_URL) as websocket:
        while is_recording.value:
            if audio_buffer:  # Check if audio data is available
                data = audio_buffer.pop(0)  # Remove first element
                await websocket.send(data)
            await asyncio.sleep(0.1)  # Adjust sleep time as needed

if recording_state:
    is_recording["value"] = True  # Update shared recording state
    st.write("Recording...")
    asyncio.run(send_audio())
    is_recording["value"] = False  # Update shared recording state (stop recording)

if stop_recording_button:
    is_recording["value"] = False  # Stop recording on button click

if transcribe_button and audio_buffer:
    transcript = transcribe(b''.join(audio_buffer))  # Transcribe from collected buffer
    st.write("Transcript:", transcript)

