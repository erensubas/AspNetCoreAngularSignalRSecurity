import { Subscription } from 'rxjs';

import { HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { HubConnection } from '@microsoft/signalr';
import { Store } from '@ngrx/store';
import * as directMessagesActions from './store/directmessages.action';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { OnlineUser } from './models/online-user';
import * as signalR from '@microsoft/signalr';

@Injectable()
export class DirectMessagesService {

    private _hubConnection: HubConnection | undefined;
    private headers: HttpHeaders | undefined;

    isAuthorizedSubscription: Subscription | undefined;
    isAuthorized = false;

    constructor(
        private store: Store<any>,
        private oidcSecurityService: OidcSecurityService
    ) {
        this.headers = new HttpHeaders();
        this.headers = this.headers.set('Content-Type', 'application/json');
        this.headers = this.headers.set('Accept', 'application/json');

        this.init();
    }

    sendDirectMessage(message: string, userId: string): string {

        if (this._hubConnection) {
            this._hubConnection.invoke('SendDirectMessage', message, userId);
        }
        return message;
    }

    leave(): void {
        if (this._hubConnection) {
            this._hubConnection.invoke('Leave');
        }
    }

    join(): void {
        console.log('send join');
        if (this._hubConnection) {
            this._hubConnection.invoke('Join');
        }
    }

    private init() {
        this.isAuthorizedSubscription = this.oidcSecurityService.getIsAuthorized().subscribe(
            (isAuthorized: boolean) => {
                this.isAuthorized = isAuthorized;
                if (this.isAuthorized) {
                    this.initHub();
                }
            });
        console.log('IsAuthorized:' + this.isAuthorized);
    }

    private initHub() {
        console.log('initHub');
        const token = this.oidcSecurityService.getToken();
        let tokenValue = '';
        if (token !== '') {
            tokenValue = '?token=' + token;
        }
        const url = 'https://localhost:44390/';

        this._hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(`${url}usersdm${tokenValue}`)
            .configureLogging(signalR.LogLevel.Information)
            .build();

        this._hubConnection.start().catch(err => console.error(err.toString()));

        this._hubConnection.on('NewOnlineUser', (onlineUser: OnlineUser) => {
            console.log('NewOnlineUser received');
            console.log(onlineUser);
            this.store.dispatch(new directMessagesActions.ReceivedNewOnlineUser(onlineUser));
        });

        this._hubConnection.on('OnlineUsers', (onlineUsers: OnlineUser[]) => {
            console.log('OnlineUsers received');
            console.log(onlineUsers);
            this.store.dispatch(new directMessagesActions.ReceivedOnlineUsers(onlineUsers));
        });

        this._hubConnection.on('Joined', (onlineUser: OnlineUser) => {
            console.log('Joined received');
            this.store.dispatch(new directMessagesActions.JoinSent());
            console.log(onlineUser);
        });

        this._hubConnection.on('SendDM', (message: string, onlineUser: OnlineUser) => {
            console.log('SendDM received');
            this.store.dispatch(new directMessagesActions.ReceivedDirectMessage(message, onlineUser));
        });

        this._hubConnection.on('UserLeft', (name: string) => {
            console.log('UserLeft received');
            this.store.dispatch(new directMessagesActions.ReceivedUserLeft(name));
        });
    }
}
