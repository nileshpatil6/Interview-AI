/**
 * Speech-to-Text client for transcribing audio using a separate API key
 */
import { Content, Part } from "@google/generative-ai";
import { MultimodalLiveClient } from "./multimodal-live-client";
import { EventEmitter } from "eventemitter3";

// The dedicated API key for STT
const STT_API_KEY = "AIzaSyCggw2-kZg6Wqfp4xmrVy6CmVI03SNcka4";

interface STTClientEventTypes {
  transcription: (text: string) => void;
  error: (error: Error) => void;
}

/**
 * A client specifically for speech-to-text transcription
 * Uses a separate API key from the main conversation
 */
export class STTClient extends EventEmitter<STTClientEventTypes> {
  private client: MultimodalLiveClient;
  private audioBuffer: ArrayBuffer[] = [];
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();

    // Create a dedicated client with the STT API key
    this.client = new MultimodalLiveClient({
      apiKey: STT_API_KEY
    });

    // Set up event listeners
    this.setupEventListeners();

    // Start the processing interval
    this.startProcessingInterval();
  }

  /**
   * Set up event listeners for the client
   */
  private setupEventListeners() {
    // Listen for transcription events
    this.client.on("transcription", (text: string) => {
      console.log("STT Client received transcription:", text);
      this.emit("transcription", text);
    });

    // Listen for model text events as a fallback
    this.client.on("modeltext", (text: string) => {
      console.log("STT Client received model text:", text);
      // Check if this looks like a transcription
      if (this.isLikelyTranscription(text)) {
        this.emit("transcription", text);
      }
    });

    // Listen for content events as another fallback
    this.client.on("content", (data: any) => {
      try {
        if (data && data.modelTurn && data.modelTurn.parts) {
          const textParts = data.modelTurn.parts.filter((p: any) => p.text);
          if (textParts.length > 0) {
            const combinedText = textParts.map((p: any) => p.text).join(' ');
            if (combinedText.trim() && this.isLikelyTranscription(combinedText)) {
              console.log("STT Client extracted text from content:", combinedText);
              this.emit("transcription", combinedText);
            }
          }
        }
      } catch (error) {
        console.error("Error processing content in STT client:", error);
      }
    });
  }

  /**
   * Start the interval for processing collected audio
   */
  private startProcessingInterval() {
    this.processingInterval = setInterval(() => {
      this.processAudioBuffer();
    }, 5000); // Process every 5 seconds
  }

  /**
   * Stop the processing interval
   */
  public stopProcessingInterval() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Add audio data to the buffer for processing
   */
  public addAudio(audioData: ArrayBuffer) {
    this.audioBuffer.push(audioData);
  }

  /**
   * Process the collected audio buffer
   */
  public async processAudioBuffer() {
    if (this.isProcessing || this.audioBuffer.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const audioToProcess = [...this.audioBuffer];
      this.audioBuffer = []; // Clear the buffer

      // Combine audio chunks
      const totalLength = audioToProcess.reduce((acc, buffer) => acc + buffer.byteLength, 0);
      const combinedBuffer = new Uint8Array(totalLength);

      let offset = 0;
      audioToProcess.forEach(buffer => {
        combinedBuffer.set(new Uint8Array(buffer), offset);
        offset += buffer.byteLength;
      });

      // Convert to base64
      const base64Audio = btoa(
        Array.from(combinedBuffer)
          .map(byte => String.fromCharCode(byte))
          .join('')
      );

      // Check WebSocket state and try to connect if needed
      let connectionAttempts = 0;
      const maxAttempts = 3;

      while ((!this.client.ws || this.client.ws.readyState !== WebSocket.OPEN) && connectionAttempts < maxAttempts) {
        console.log(`STT Client: WebSocket not open (state: ${this.client.ws ? this.client.ws.readyState : 'null'}), attempt ${connectionAttempts + 1}/${maxAttempts}`);

        try {
          await this.connect();
          // Wait a bit for the connection to stabilize
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`STT Client: Connection attempt ${connectionAttempts + 1} failed:`, error);
        }

        connectionAttempts++;
      }

      // If still not connected after attempts, throw error
      if (!this.client.ws || this.client.ws.readyState !== WebSocket.OPEN) {
        throw new Error(`STT Client: Failed to establish WebSocket connection after ${maxAttempts} attempts`);
      }

      // Create content parts with the audio
      const parts: Part[] = [
        {
          inlineData: {
            mimeType: "audio/pcm;rate=16000",
            data: base64Audio
          }
        },
        {
          text: "Transcribe this audio to text. Only return the transcription, nothing else."
        }
      ];

      // Send to Gemini for transcription
      this.client.send(parts);
      console.log("STT Client: Audio sent for transcription");
    } catch (error) {
      console.error("Error processing audio in STT client:", error);
      this.emit("error", error as Error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Connect to the Gemini API
   */
  private async connect() {
    try {
      await this.client.connect({
        model: "models/gemini-2.0-flash-exp",
        generationConfig: {
          temperature: 0,
          topP: 1,
          topK: 32,
        },
      });
      console.log("STT Client connected successfully");
    } catch (error) {
      console.error("Error connecting STT client:", error);
      this.emit("error", error as Error);
    }
  }

  /**
   * Determine if text is likely a transcription
   */
  private isLikelyTranscription(text: string): boolean {
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

    return true;
  }

  /**
   * Clean up resources
   */
  public dispose() {
    this.stopProcessingInterval();
    if (this.client && this.client.ws) {
      this.client.disconnect();
    }
  }
}
