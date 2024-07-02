let websocket;

document.getElementById('start-btn').addEventListener('click', () => {
    websocket = new WebSocket("ws://localhost:8000/ws");
    websocket.onmessage = function(event) {
        const transcriptionDiv = document.getElementById('transcription');
        transcriptionDiv.innerHTML += `<p>${event.data}</p>`;
    };
    document.getElementById('start-btn').disabled = true;
    document.getElementById('stop-btn').disabled = false;
});

document.getElementById('stop-btn').addEventListener('click', () => {
    if (websocket) {
        websocket.close();
    }
    document.getElementById('start-btn').disabled = false;
    document.getElementById('stop-btn').disabled = true;
});
