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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MultimodalLiveAPIClientConnection,
  MultimodalLiveClient,
} from "../lib/multimodal-live-client";
import { STTClient } from "../lib/stt-client";
import { LiveConfig } from "../multimodal-live-types";
import { AudioStreamer } from "../lib/audio-streamer";
import { audioContext } from "../lib/utils";
import VolMeterWorket from "../lib/worklets/vol-meter";

export type UseLiveAPIResults = {
  client: MultimodalLiveClient;
  sttClient: STTClient;
  setConfig: (config: LiveConfig) => void;
  config: LiveConfig;
  connected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  volume: number;
};

export function useLiveAPI({
  url,
  apiKey,
}: MultimodalLiveAPIClientConnection): UseLiveAPIResults {
  const client = useMemo(
    () => new MultimodalLiveClient({ url, apiKey }),
    [url, apiKey],
  );

  // Create a dedicated STT client with the separate API key
  const sttClient = useMemo(
    () => new STTClient(),
    [],
  );

  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const [connected, setConnected] = useState(false);  const [config, setConfig] = useState<LiveConfig>({
    model: "models/gemini-2.0-flash-exp",
    generationConfig: {
      responseModalities: "audio",
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Fenrir", // Set default to male voice
          },
        },
      }
    },
    systemInstruction: {
      parts: [
        {
          text: `You are an AI interview coach conducting a mock interview. Your role is to:
after greating user hello start the interview please be focused on interview 
          1. Introduce yourself briefly as "Interview Coach" and explain that you'll be conducting a mock interview.
          2. Ask relevant interview questions one at a time, waiting for the user to respond.
          3. Start with common questions like "Tell me about yourself" and progress to more specific questions.
          4. Listen to the user's responses and provide brief, constructive feedback.
          5. Ask follow-up questions when appropriate.
          6. After 5-7 questions, conclude the interview with positive feedback and suggestions for improvement.



            strictly donot ask about stenghts and weaknesses instead ask about the projects and skills the user has          Keep your responses concise and professional. Maintain a supportive but realistic interview atmosphere.
          Don't ask for additional information before starting - just begin the interview process naturally.`,
        },
      ],
    }
  });
  const [volume, setVolume] = useState(0);

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: "audio-out" }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>("vumeter-out", VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .then(() => {
            // Successfully added worklet
          });
      });
    }
  }, [audioStreamerRef]);

  // Set up STT client event listeners
  useEffect(() => {
    // Listen for transcription events from the STT client
    const handleTranscription = (text: string) => {
      console.log("Received transcription from STT client:", text);
      // The transcription will be displayed by the TranscriptionDisplay component
      // which listens for the transcriptionEvent

      // Dispatch a custom event for the transcription
      try {
        const event = new CustomEvent('transcriptionEvent', { detail: text });
        window.dispatchEvent(event);
        console.log("Dispatched transcriptionEvent with:", text);
      } catch (error) {
        console.error("Error dispatching transcription event:", error);
      }
    };

    // Listen for errors from the STT client
    const handleError = (error: Error) => {
      console.error("STT client error:", error);
    };

    sttClient.on("transcription", handleTranscription);
    sttClient.on("error", handleError);

    return () => {
      sttClient.off("transcription", handleTranscription);
      sttClient.off("error", handleError);
    };
  }, [sttClient]);
  useEffect(() => {
    const onClose = () => {
      setConnected(false);
    };

    const stopAudioStreamer = () => {
      audioStreamerRef.current?.stop();
      // Process any remaining audio in the STT client
      sttClient.processAudioBuffer();
    };

    const onAudio = (data: ArrayBuffer) => {
      // Play the audio
      audioStreamerRef.current?.addPCM16(new Uint8Array(data));

      // Also send it to the STT client for transcription
      sttClient.addAudio(data);
    };
    
    const onModelText = (text: string) => {
      // Dispatch the model text as a custom event
      console.log("Interview coach says:", text);
      try {
        const event = new CustomEvent('modelTextEvent', { detail: text });
        window.dispatchEvent(event);
      } catch (error) {
        console.error("Error dispatching model text event:", error);
      }
    };

    const onTurnComplete = () => {
      // When turn is complete, process any collected audio in the STT client
      sttClient.processAudioBuffer();
    };    client
      .on("close", onClose)
      .on("interrupted", stopAudioStreamer)
      .on("audio", onAudio)
      .on("modeltext", onModelText)
      .on("turncomplete", onTurnComplete);

    return () => {
      client
        .off("close", onClose)
        .off("interrupted", stopAudioStreamer)
        .off("audio", onAudio)
        .off("modeltext", onModelText)
        .off("turncomplete", onTurnComplete);
    };
  }, [client, sttClient]);  

  const connect = useCallback(async () => {
    console.log("Connecting with config:", config);
    if (!config) {
      throw new Error("config has not been set");
    }
    
    // Make sure we always have the system instruction set and male voice
    const connectConfig = {
      ...config,
      generationConfig: {
        ...config.generationConfig,
        responseModalities: "audio" as "text" | "audio" | "image", // Type-safe assignment
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Fenrir", // Ensure male voice is used
            }
          },
        }
      },
      systemInstruction: config.systemInstruction || {
        parts: [
          {
            text: `You are an AI interview coach conducting a mock interview. Your role is to:
after greating user hello start the interview please be focused on interview 
            1. Introduce yourself briefly as "Interview Coach" and explain that you'll be conducting a mock interview.
            2. Ask relevant interview questions one at a time, waiting for the user to respond.
            3. Start with common questions like "Tell me about yourself" and progress to more specific questions.
            4. Listen to the user's responses and provide brief, constructive feedback.
            5. Ask follow-up questions when appropriate.
            6. After 5-7 questions, conclude the interview with positive feedback and suggestions for improvement.

            Keep your responses concise and professional. Maintain a supportive but realistic interview atmosphere.
            Don't ask for additional information before starting - just begin the interview process naturally.`,
          },
        ],
      }
    };
    
    client.disconnect();
    await client.connect(connectConfig);
    setConnected(true);
  }, [client, setConnected, config]);

  const disconnect = useCallback(async () => {
    client.disconnect();
    sttClient.dispose(); // Clean up the STT client
    setConnected(false);
  }, [setConnected, client, sttClient]);

  return {
    client,
    sttClient,
    config,
    setConfig,
    connected,
    connect,
    disconnect,
    volume,
  };
}
