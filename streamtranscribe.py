from fastapi import HTTPException,APIRouter, File, UploadFile, Depends, Request
from fastapi.responses import JSONResponse
from uuid import uuid4
import boto3
from botocore.exceptions import BotoCoreError, NoCredentialsError
import time

from icp.ocr.textract_utils import aws_clients
from app.routers.auth import get_current_user_ws
    
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio
import logging
from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.model import TranscriptEvent

from fastapi.security import OAuth2PasswordBearer
from app.routers.auth import oauth2_scheme

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


router = APIRouter()


class MyEventHandler(TranscriptResultStreamHandler):
    def __init__(self, output_stream, websocket):
        super().__init__(output_stream)
        self.websocket = websocket
        self.last_transcript = ""

    async def handle_transcript_event(self, transcript_event: TranscriptEvent):
        results = transcript_event.transcript.results
        for result in results:
            for alt in result.alternatives:
                new_transcript = alt.transcript
                new_part = new_transcript.replace(self.last_transcript,"")
                if new_part:
                    self.last_transcript = new_transcript
                    logger.info(f"Transcription: {new_part}")
                    await self.websocket.send_text(new_part)

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    user = await get_current_user_ws(websocket)
    if not user:
        return JSONResponse(status_code=403, content={"message":"Unauthorized"})
    print("headers:",websocket.headers)
    await websocket.accept()
    logger.info("WebSocket connection accepted")
    client = TranscribeStreamingClient(region="us-east-1")
    stream = await client.start_stream_transcription(
        language_code="en-US",
        media_sample_rate_hz=16000,
        media_encoding="pcm",
        enable_partial_results_stabilization = True,
        partial_results_stability="low",
    )
    handler = MyEventHandler(stream.output_stream, websocket)
    try:
        await asyncio.gather(handler.handle_events(), receive_audio(websocket, stream))
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
        await stream.input_stream.end_stream()
    finally:
        logger.info("WebSocket closed")

async def receive_audio(websocket: WebSocket, stream):
    while True:
        data = await websocket.receive_bytes()
        if data:
            logger.info(f"Received audio data of size: {len(data)} bytes")
            await stream.input_stream.send_audio_event(audio_chunk=data)
        else:
            logger.info("Received empty data, sending silence")
            await stream.input_stream.send_audio_event(audio_chunk=b'\x00' * 320)  # 16000 Hz * 0.02s * 2 bytes/sample = 320 bytes of silence
