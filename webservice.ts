import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { TokenService } from 'src/app/services/token.service';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private websocket: WebSocket;


  constructor(
    private tokenService: TokenService){}
  public connect(): void {
    let token = this.tokenService.getToken();
    const url = environment.websocket_url + 'ws'; 
    const protocolHeader = token.access_token;
    console.log("protocolHeader:",protocolHeader)
    this.websocket = new WebSocket(url,protocolHeader);

    this.websocket.onopen = () => {
      console.log('WebSocket connection opened');
    };

    this.websocket.onmessage = (event) => {
      console.log('Received message: ', event.data);
    };

    this.websocket.onerror = (error) => {
      console.error('WebSocket error: ', error);
    };

    this.websocket.onclose = () => {
      console.log('WebSocket connection closed');
    };
  }

  public send(data: ArrayBuffer): void {
    if (this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(data);
    }
  }

  public close(): void {
    if (this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.close();
    }
  }

  public setOnMessageHandler(handler: (event: MessageEvent) => void): void {
    this.websocket.onmessage = handler;
  }
}
