import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { TokenService } from './token.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private ws: WebSocketSubject<any>;
  public messages$: Subject<unknown> = new Subject<unknown>();
  public status$: Subject<boolean> = new Subject<boolean>();

  constructor(private tokenService: TokenService) {}

  public connect(): void {
    this.create();
  }

  private create() {
    if (this.ws) {
      this.ws.complete();
    }

    const token = this.tokenService.getToken();
    const WS_ENDPOINT = environment.websocket_url +'ws';
    // Create a new WebSocket connection
    this.ws = webSocket({
      url: WS_ENDPOINT,
      protocol: token.id_token, 
      openObserver: {
        next: () => {
          this.status$.next(true);
        }
      },
      closeObserver: {
        next: () => {
          this.status$.next(false);
        }
      }
    });

    this.ws.subscribe(
      message => this.messages$.next(message),
      err => console.error('WebSocket error', err),
      () => console.log('WebSocket connection closed')
    );
  }

  close() {
    if (this.ws) {
      this.ws.complete();
    }
  }

  sendMessage(message: any) {
    this.ws.next(message);
  }
}
