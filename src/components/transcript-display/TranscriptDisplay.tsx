/**
 * TranscriptDisplay component - Shows the text of what the model is saying
 */
import { useEffect, useState, useRef } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import "./transcript-display.scss";

export default function TranscriptDisplay() {
  const { client } = useLiveAPIContext();
  const [transcript, setTranscript] = useState<string>("");
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [fadeOut, setFadeOut] = useState<boolean>(false);
  // Add a debug state to force visibility for testing
  const [debugMode, setDebugMode] = useState<boolean>(false);

  // Use a ref to track if we've received any text
  const hasReceivedText = useRef<boolean>(false);

  useEffect(() => {
    console.log("TranscriptDisplay mounted");

    // Listen for text from the model
    const handleModelText = (text: string) => {
      console.log("Received model text:", text);
      setTranscript(text);
      setIsVisible(true);
      setFadeOut(false);
      hasReceivedText.current = true;
    };

    // Listen for when the model stops speaking
    const handleTurnComplete = () => {
      console.log("Turn complete event received");
      // Start fade out animation
      setFadeOut(true);

      // Hide transcript after animation completes
      setTimeout(() => {
        setIsVisible(false);
      }, 1000); // Match this with the CSS transition duration
    };

    // For debugging - force show a transcript after 3 seconds
    const debugTimer = setTimeout(() => {
      if (!hasReceivedText.current) {
        console.log("Debug mode: Forcing transcript visibility");
        setTranscript("This is a test transcript to verify the display is working correctly.");
        setIsVisible(true);
        setDebugMode(true);
      }
    }, 3000);

    client.on("modeltext", handleModelText);
    client.on("turncomplete", handleTurnComplete);

    return () => {
      client.off("modeltext", handleModelText);
      client.off("turncomplete", handleTurnComplete);
      clearTimeout(debugTimer);
    };
  }, [client]);

  // Always render the component, but control visibility with CSS
  return (
    <div className={`transcript-container ${isVisible || debugMode ? 'visible' : ''} ${fadeOut && !debugMode ? 'fade-out' : ''}`}>
      <div className="transcript-bubble">
        <p className="transcript-text">{transcript || "No transcript available"}</p>
      </div>
    </div>
  );
}
