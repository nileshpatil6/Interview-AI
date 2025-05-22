/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Content, GenerativeContentBlob, Part } from "@google/generative-ai";
import { EventEmitter } from "eventemitter3";
import { difference } from "lodash";
import {
  ClientContentMessage,
  isInterrupted,
  isModelTurn,
  isServerContentMessage,
  isSetupCompleteMessage,
  isToolCallCancellationMessage,
  isToolCallMessage,
  isTurnComplete,
  LiveIncomingMessage,
  ModelTurn,
  RealtimeInputMessage,
  ServerContent,
  SetupMessage,
  StreamingLog,
  ToolCall,
  ToolCallCancellation,
  ToolResponseMessage,
  type LiveConfig,
} from "../multimodal-live-types";
import { blobToJSON, base64ToArrayBuffer } from "./utils";

/**
 * the events that this client will emit
 */
interface MultimodalLiveClientEventTypes {
  open: () => void;
  log: (log: StreamingLog) => void;
  close: (event: CloseEvent) => void;
  audio: (data: ArrayBuffer) => void;
  content: (data: ServerContent) => void;
  interrupted: () => void;
  setupcomplete: () => void;
  turncomplete: () => void;
  toolcall: (toolCall: ToolCall) => void;
  toolcallcancellation: (toolcallCancellation: ToolCallCancellation) => void;
  modeltext: (text: string) => void;
  transcription: (text: string) => void;
}

export type MultimodalLiveAPIClientConnection = {
  url?: string;
  apiKey: string;
};

/**
 * A event-emitting class that manages the connection to the websocket and emits
 * events to the rest of the application.
 * If you dont want to use react you can still use this.
 */
export class MultimodalLiveClient extends EventEmitter<MultimodalLiveClientEventTypes> {
  public ws: WebSocket | null = null;
  protected config: LiveConfig | null = null;
  public url: string = "";
  public getConfig() {
    return { ...this.config };
  }

  constructor({ url, apiKey }: MultimodalLiveAPIClientConnection) {
    super();
    url =
      url ||
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;
    url += `?key=${apiKey}`;
    this.url = url;
    this.send = this.send.bind(this);
  }

  log(type: string, message: StreamingLog["message"]) {
    const log: StreamingLog = {
      date: new Date(),
      type,
      message,
    };
    this.emit("log", log);
  }

  connect(config?: LiveConfig): Promise<boolean> {
    // If config is provided, update the stored config
    if (config) {
      this.config = config;
    }

    // If we don't have a config, we can't connect
    if (!this.config) {
      return Promise.reject(new Error("No config available for connection"));
    }

    // If we already have an open connection, disconnect it first
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        console.log("Already have an active WebSocket, disconnecting first");
        this.disconnect(this.ws);
      }
    }

    console.log("Connecting to WebSocket...");
    const ws = new WebSocket(this.url);

    ws.addEventListener("message", async (evt: MessageEvent) => {
      if (evt.data instanceof Blob) {
        this.receive(evt.data);
      } else {
        console.log("non blob message", evt);
      }
    });

    return new Promise((resolve, reject) => {
      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          this.disconnect(ws);
          const message = `Connection timeout to "${this.url}"`;
          this.log(`server.timeout`, message);
          reject(new Error(message));
        }
      }, 10000); // 10 second timeout

      const onError = (ev: Event) => {
        clearTimeout(connectionTimeout);
        this.disconnect(ws);
        const message = `Could not connect to "${this.url}"`;
        this.log(`server.${ev.type}`, message);
        reject(new Error(message));
      };

      ws.addEventListener("error", onError);

      ws.addEventListener("open", (ev: Event) => {
        clearTimeout(connectionTimeout);

        if (!this.config) {
          reject("Invalid config sent to `connect(config)`");
          return;
        }

        this.log(`client.${ev.type}`, `connected to socket`);
        this.emit("open");

        this.ws = ws;

        try {
          const setupMessage: SetupMessage = {
            setup: this.config,
          };

          // Use a direct send here to avoid the _sendDirect method which might try to reconnect
          const str = JSON.stringify(setupMessage);
          ws.send(str);

          this.log("client.send", "setup");
        } catch (error) {
          console.error("Error sending setup message:", error);
          this.disconnect(ws);
          reject(new Error("Failed to send setup message"));
          return;
        }

        ws.removeEventListener("error", onError);

        ws.addEventListener("close", (ev: CloseEvent) => {
          this.disconnect(ws);
          let reason = ev.reason || "";
          if (reason.toLowerCase().includes("error")) {
            const prelude = "ERROR]";
            const preludeIndex = reason.indexOf(prelude);
            if (preludeIndex > 0) {
              reason = reason.slice(
                preludeIndex + prelude.length + 1,
                Infinity
              );
            }
          }

          this.log(
            `server.${ev.type}`,
            `disconnected ${reason ? `with reason: ${reason}` : ``}`
          );

          this.emit("close", ev);

          // Attempt to reconnect if the close wasn't intentional
          if (ev.code !== 1000) {
            console.log("WebSocket closed unexpectedly, attempting to reconnect in 3 seconds...");
            setTimeout(() => {
              this.connect();
            }, 3000);
          }
        });

        resolve(true);
      });
    });
  }

  disconnect(ws?: WebSocket) {
    // could be that this is an old websocket and theres already a new instance
    // only close it if its still the correct reference
    if ((!ws || this.ws === ws) && this.ws) {
      this.ws.close();
      this.ws = null;
      this.log("client.close", `Disconnected`);
      return true;
    }
    return false;
  }

  protected async receive(blob: Blob) {
    const response: LiveIncomingMessage = (await blobToJSON(
      blob
    )) as LiveIncomingMessage;
    if (isToolCallMessage(response)) {
      this.log("server.toolCall", response);
      this.emit("toolcall", response.toolCall);
      return;
    }
    if (isToolCallCancellationMessage(response)) {
      this.log("receive.toolCallCancellation", response);
      this.emit("toolcallcancellation", response.toolCallCancellation);
      return;
    }

    if (isSetupCompleteMessage(response)) {
      this.log("server.send", "setupComplete");
      this.emit("setupcomplete");
      return;
    }

    // this json also might be `contentUpdate { interrupted: true }`
    // or contentUpdate { end_of_turn: true }
    if (isServerContentMessage(response)) {
      const { serverContent } = response;
      if (isInterrupted(serverContent)) {
        this.log("receive.serverContent", "interrupted");
        this.emit("interrupted");
        return;
      }
      if (isTurnComplete(serverContent)) {
        this.log("server.send", "turnComplete");
        this.emit("turncomplete");
        //plausible theres more to the message, continue
      }

      if (isModelTurn(serverContent)) {
        let parts: Part[] = serverContent.modelTurn.parts;

        // Debug: Log all parts to see what's coming from the server
        console.log("DEBUG - All model parts:", JSON.stringify(parts, null, 2));

        // Debug: Check for text parts
        const textPartsDebug = parts.filter(p => p.text);
        console.log("DEBUG - Text parts found:", textPartsDebug.length, textPartsDebug.map(p => p.text));

        // when its audio that is returned for modelTurn
        const audioParts = parts.filter(
          (p) => p.inlineData && p.inlineData.mimeType.startsWith("audio/pcm")
        );
        const base64s = audioParts.map((p) => p.inlineData?.data);

        // strip the audio parts out of the modelTurn
        const otherParts = difference(parts, audioParts);

        // Extract text from parts for speech-to-text display
        const textParts = otherParts.filter(p => p.text);
        if (textParts.length > 0) {
          const combinedText = textParts.map(p => p.text).join(' ');
          if (combinedText.trim()) {
            console.log("Emitting modeltext event with text:", combinedText);

            // Check if this is likely a transcription response
            const isTranscription = this.isLikelyTranscription(combinedText);

            if (isTranscription) {
              console.log("This appears to be a transcription response");
              this.emit("transcription", combinedText);
              this.log(`server.transcription`, combinedText);

              // Dispatch a transcription event
              try {
                const event = new CustomEvent('transcriptionEvent', { detail: combinedText });
                window.dispatchEvent(event);
                console.log("Dispatched transcriptionEvent with:", combinedText);
              } catch (error) {
                console.error("Error dispatching transcription event:", error);
              }
            } else {
              // Regular model text
              this.emit("modeltext", combinedText);
              this.log(`server.modeltext`, combinedText);

              // Also dispatch a custom event for global listeners
              try {
                const event = new CustomEvent('modelTextEvent', { detail: combinedText });
                window.dispatchEvent(event);
                console.log("Dispatched modelTextEvent with:", combinedText);
              } catch (error) {
                console.error("Error dispatching custom event:", error);
              }
            }
          }
        } else {
          // If no text parts found, check if there are any parts with text
          const allTextParts = parts.filter(p => p.text);
          if (allTextParts.length > 0) {
            const allCombinedText = allTextParts.map(p => p.text).join(' ');
            if (allCombinedText.trim()) {
              console.log("Emitting modeltext event from all parts:", allCombinedText);

              // Check if this is likely a transcription response
              const isTranscription = this.isLikelyTranscription(allCombinedText);

              if (isTranscription) {
                console.log("This appears to be a transcription response");
                this.emit("transcription", allCombinedText);
                this.log(`server.transcription`, allCombinedText);

                // Dispatch a transcription event
                try {
                  const event = new CustomEvent('transcriptionEvent', { detail: allCombinedText });
                  window.dispatchEvent(event);
                  console.log("Dispatched transcriptionEvent with:", allCombinedText);
                } catch (error) {
                  console.error("Error dispatching transcription event:", error);
                }
              } else {
                // Regular model text
                this.emit("modeltext", allCombinedText);
                this.log(`server.modeltext`, allCombinedText);

                // Also dispatch a custom event for global listeners
                try {
                  const event = new CustomEvent('modelTextEvent', { detail: allCombinedText });
                  window.dispatchEvent(event);
                  console.log("Dispatched modelTextEvent with:", allCombinedText);
                } catch (error) {
                  console.error("Error dispatching custom event:", error);
                }
              }
            }
          }
        }

        base64s.forEach((b64) => {
          if (b64) {
            const data = base64ToArrayBuffer(b64);
            this.emit("audio", data);
            this.log(`server.audio`, `buffer (${data.byteLength})`);
          }
        });
        if (!otherParts.length) {
          return;
        }

        parts = otherParts;

        const content: ModelTurn = { modelTurn: { parts } };
        this.emit("content", content);
        this.log(`server.content`, response);

        // Additional direct text extraction as a fallback
        try {
          // Try to extract text from any part that might have text
          const allPossibleTextParts = parts.filter(p => p.text ||
            (p as any).textPart ||
            (typeof p === 'object' && p !== null && 'text' in p));

          if (allPossibleTextParts.length > 0) {
            const extractedTexts = allPossibleTextParts.map(p => {
              if (p.text) return p.text;
              if ((p as any).textPart) return (p as any).textPart;
              if (typeof p === 'object' && p !== null && 'text' in p) return (p as any).text;
              return '';
            }).filter(Boolean);

            if (extractedTexts.length > 0) {
              const combinedText = extractedTexts.join(' ');
              console.log("DIRECT TEXT EXTRACTION:", combinedText);
              this.emit("modeltext", combinedText);

              // Also dispatch a custom event for global listeners
              try {
                const event = new CustomEvent('modelTextEvent', { detail: combinedText });
                window.dispatchEvent(event);
                console.log("Dispatched modelTextEvent from direct extraction with:", combinedText);
              } catch (error) {
                console.error("Error dispatching custom event:", error);
              }
            }
          }
        } catch (error) {
          console.error("Error in direct text extraction:", error);
        }
      }
    } else {
      console.log("received unmatched message", response);
    }
  }

  /**
   * send realtimeInput, this is base64 chunks of "audio/pcm" and/or "image/jpg"
   */
  sendRealtimeInput(chunks: GenerativeContentBlob[]) {
    // Check WebSocket state first - don't even try if not connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`Cannot send realtime input - WebSocket not open (state: ${this.ws ? this.ws.readyState : 'null'})`);

      // Try to reconnect if the socket is closed
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        console.log("WebSocket is closed, attempting to reconnect...");
        this.connect().catch(err => {
          console.error("Failed to reconnect WebSocket:", err);
        });
      }

      // Don't try to send data if the connection isn't ready
      return;
    }

    let hasAudio = false;
    let hasVideo = false;
    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i];
      if (ch.mimeType.includes("audio")) {
        hasAudio = true;
      }
      if (ch.mimeType.includes("image")) {
        hasVideo = true;
      }
      if (hasAudio && hasVideo) {
        break;
      }
    }
    const message =
      hasAudio && hasVideo
        ? "audio + video"
        : hasAudio
        ? "audio"
        : hasVideo
        ? "video"
        : "unknown";

    const data: RealtimeInputMessage = {
      realtimeInput: {
        mediaChunks: chunks,
      },
    };

    try {
      this._sendDirect(data);
      this.log(`client.realtimeInput`, message);
    } catch (error) {
      console.error("Error sending realtime input:", error);

      // If this was a WebSocket error, try to reconnect
      if (error instanceof Error && error.message.includes("WebSocket")) {
        console.log("WebSocket error, attempting to reconnect...");
        this.connect().catch(err => {
          console.error("Failed to reconnect WebSocket after error:", err);
        });
      }
    }
  }

  /**
   *  send a response to a function call and provide the id of the functions you are responding to
   */
  sendToolResponse(toolResponse: ToolResponseMessage["toolResponse"]) {
    const message: ToolResponseMessage = {
      toolResponse,
    };

    this._sendDirect(message);
    this.log(`client.toolResponse`, message);
  }

  /**
   * send normal content parts such as { text }
   */
  send(parts: Part | Part[], turnComplete: boolean = true) {
    parts = Array.isArray(parts) ? parts : [parts];
    const content: Content = {
      role: "user",
      parts,
    };

    const clientContentRequest: ClientContentMessage = {
      clientContent: {
        turns: [content],
        turnComplete,
      },
    };

    try {
      this._sendDirect(clientContentRequest);
      this.log(`client.send`, clientContentRequest);
    } catch (error) {
      console.error("Error in send method:", error);

      // Try to reconnect and send again after a short delay
      setTimeout(() => {
        try {
          console.log("Retrying send after error...");
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this._sendDirect(clientContentRequest);
            this.log(`client.send.retry`, clientContentRequest);
          } else {
            console.error("WebSocket still not ready after retry delay");
          }
        } catch (retryError) {
          console.error("Error during retry:", retryError);
        }
      }, 1000);
    }
  }

  /**
   *  used internally to send all messages
   *  don't use directly unless trying to send an unsupported message type
   */
  _sendDirect(request: object) {
    if (!this.ws) {
      console.error("WebSocket is not connected, attempting to reconnect...");
      this.connect();
      throw new Error("WebSocket is not connected");
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error(`WebSocket is not open (state: ${this.ws.readyState}), attempting to reconnect...`);

      // Only try to reconnect if the socket is fully closed
      if (this.ws.readyState === WebSocket.CLOSED) {
        this.connect();
      }

      throw new Error(`WebSocket is not open (state: ${this.ws.readyState})`);
    }

    try {
      const str = JSON.stringify(request);
      this.ws.send(str);
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * Determines if a text response is likely to be a transcription
   * rather than a normal model response
   */
  isLikelyTranscription(text: string): boolean {
    // If the text contains any of these markers, it's probably not a transcription
    const nonTranscriptionMarkers = [
      "```",           // Code blocks
      "**",            // Bold markdown
      "*",             // Italic markdown
      "#",             // Headers
      "- ",            // List items
      "1. ",           // Numbered list
      "http",          // URLs
      "www.",          // URLs
      "I'll transcribe", // Explanation text
      "Here's the transcription", // Explanation text
      "The transcription is", // Explanation text
    ];

    // Check for markers that would indicate this is not a transcription
    for (const marker of nonTranscriptionMarkers) {
      if (text.includes(marker)) {
        return false;
      }
    }

    // If the text is very short, it's more likely to be a transcription
    if (text.length < 200) {
      return true;
    }

    // If the text has multiple paragraphs, it's less likely to be a transcription
    const paragraphs = text.split("\n\n").filter(p => p.trim().length > 0);
    if (paragraphs.length > 2) {
      return false;
    }

    // If we get here, it's likely a transcription
    return true;
  }
}
