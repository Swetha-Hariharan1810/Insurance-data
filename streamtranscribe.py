            from fastapi import WebSocket, WebSocketDisconnect, APIRouter, HTTPException
from fastapi.responses import JSONResponse
import logging
import asyncio
from amazon_transcribe.client import TranscribeStreamingClient
from amazon_transcribe.handlers import TranscriptResultStreamHandler
from amazon_transcribe.model import TranscriptEvent
from app.routers.auth import verify_token  # Assuming this function verifies the token and retrieves the user

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()

class MyEventHandler(TranscriptResultStreamHandler):
    """
    Handles the transcription events from Amazon Transcribe.
    
    Attributes:
        output_stream: The output stream from Amazon Transcribe.
        websocket: The WebSocket connection to send transcription results.
        last_transcript: Keeps track of the last sent transcript to avoid duplicates.
    """
    def __init__(self, output_stream, websocket):
        """
        Initializes the MyEventHandler class with the given output stream and WebSocket.

        Args:
            output_stream: The output stream from Amazon Transcribe.
            websocket: The WebSocket connection to send transcription results.
        """
        super().__init__(output_stream)
        self.websocket = websocket
        self.last_transcript = ""

    async def handle_transcript_event(self, transcript_event: TranscriptEvent):
        """
        Handles the transcript event from Amazon Transcribe, sending the new transcript parts to the WebSocket.

        Args:
            transcript_event: The transcript event received from Amazon Transcribe.
        """
        results = transcript_event.transcript.results
        for result in results:
            for alt in result.alternatives:
                new_transcript = alt.transcript
                new_part = new_transcript.replace(self.last_transcript, "")
                if new_part:
                    self.last_transcript = new_transcript
                    logger.info(f"Transcription: {new_part}")
                    await self.websocket.send_text(new_part)

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for handling real-time transcription.

    This endpoint accepts a WebSocket connection, verifies the provided token,
    and sets up a transcription stream with Amazon Transcribe. Transcription results
    are sent back to the client via the WebSocket.

    Args:
        websocket: The WebSocket connection instance.

    Raises:
        JSONResponse: If the token is not provided or invalid, the connection is closed with an unauthorized status.
    """
    logger.info("WebSocket connection attempt")
    try:
        # Extract the token from the protocol headers
        protocol_headers = websocket.headers.get('sec-websocket-protocol')
        if protocol_headers:
            token = protocol_headers.split(",")[0].strip()
        else:
            logger.error("No protocol header found, closing connection")
            await websocket.close(code=1008)
            return JSONResponse(status_code=403, content={"message": "Unauthorized"})

        # Verify the token
        user = verify_token(token)  # Implement this function to verify the token and return the user
        if not user:
            logger.error("Invalid token, closing connection")
            await websocket.close(code=1008)
            return JSONResponse(status_code=403, content={"message": "Unauthorized"})

        await websocket.accept()
        logger.info("WebSocket connection accepted")
        
        client = TranscribeStreamingClient(region="us-east-1")
        stream = await client.start_stream_transcription(
            language_code="en-US",
            media_sample_rate_hz=16000,
            media_encoding="pcm",
            enable_partial_results_stabilization=True,
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
    except Exception as e:
        logger.error(f"WebSocket connection failed: {e}")

async def receive_audio(websocket: WebSocket, stream):
    """
    Receives audio data from the WebSocket and sends it to the Amazon Transcribe input stream.

    This function runs in an infinite loop, receiving audio data from the WebSocket
    and forwarding it to Amazon Transcribe. If no data is received, it sends silence.

    Args:
        websocket: The WebSocket connection instance.
        stream: The transcription stream instance from Amazon Transcribe.

    Raises:
        Exception: If there is an error receiving audio data or sending it to Amazon Trans
   
