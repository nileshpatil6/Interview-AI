/**
 * TranscriptionDisplay component - Shows the transcribed text from Gemini
 */
import { useEffect, useState } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import "./transcription-display.scss";

export default function TranscriptionDisplay() {
  const { client } = useLiveAPIContext();
  const [transcription, setTranscription] = useState<string>("");
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    console.log("TranscriptionDisplay mounted");

    // Listen for transcription events
    const handleTranscription = (text: string) => {
      console.log("Received transcription:", text);
      setTranscription(text);
      setVisible(true);

      // Keep visible for a while
      setTimeout(() => {
        setVisible(false);
      }, 10000); // Keep visible for 10 seconds
    };

    // Listen for custom transcription events
    const handleTranscriptionEvent = (event: CustomEvent) => {
      const text = event.detail;
      console.log("Received transcription event:", text);
      setTranscription(text);
      setVisible(true);

      // Keep visible for a while
      setTimeout(() => {
        setVisible(false);
      }, 10000); // Keep visible for 10 seconds
    };

    // Listen for both direct client events and custom window events
    client.on("transcription", handleTranscription);
    window.addEventListener('transcriptionEvent' as any, handleTranscriptionEvent as any);

    return () => {
      client.off("transcription", handleTranscription);
      window.removeEventListener('transcriptionEvent' as any, handleTranscriptionEvent as any);
    };
  }, [client]);

  if (!visible && !transcription) {
    return null;
  }

  return (
    <div className={`transcription-container ${visible ? 'visible' : ''}`}>
      <div className="transcription-content">
        <p>{transcription}</p>
      </div>
    </div>
  );
}
