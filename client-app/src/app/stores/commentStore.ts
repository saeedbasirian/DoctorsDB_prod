import { makeAutoObservable, runInAction } from "mobx";
import { ChatComment } from "../models/comment";

import {HttpTransportType, HubConnection, HubConnectionBuilder, LogLevel} from "@microsoft/signalr";
import { store } from "./store";

export default class CommentStore {
    comments: ChatComment[] = [];
    hubConnection: HubConnection | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    createHubConnection = (doctorId: string) => {
        if (store.doctorStore.getSelectedDoctor && store.userStore.isLoggedIn){
            this.hubConnection = new HubConnectionBuilder().withUrl(process.env.REACT_APP_CHAT_URL + "?doctorId=" + doctorId, {
                accessTokenFactory: () => store.userStore.user!.token!,
                skipNegotiation:true,
                transport: HttpTransportType.WebSockets
            })
            .withAutomaticReconnect().configureLogging(LogLevel.Information).build();

            this.hubConnection.start().catch(error => console.log("Error establishing connection: ", error));

            this.hubConnection.on("LoadComments", (comments: ChatComment[]) => {
                runInAction(() => {
                    comments.forEach(comment => { comment.createdAt = new Date(comment.createdAt)
                    });
                    this.comments = comments})
            });

            this.hubConnection.on("ReceiveComment", (comment: ChatComment) => {
                runInAction(() => {
                    comment.createdAt = new Date(comment.createdAt);
                    this.comments.unshift(comment)})
            });

        }
    }

    stopHubConnection = () => {
        this.hubConnection?.stop().catch(error => console.log("Error stopping connection: ", error));
    }

    clearComments = () => {
        this.comments = [];
        this.stopHubConnection();
    }

    addComment = async (values: any) => {
        values.doctorId = store.doctorStore.getSelectedDoctor?.id;

        try {
            await this.hubConnection?.invoke("SendComment", values);
        } catch (error) {
            console.log(error);
        }
    }
}