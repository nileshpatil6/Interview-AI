/**
 * TextDisplay component - Shows the text of what the model is saying in a fixed position
 */
import { useEffect, useState } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import "./text-display.scss";

export default function TextDisplay() {
  const { client } = useLiveAPIContext();
  const [text, setText] = useState<string>("INITIALIZING...");
  const [visible, setVisible] = useState<boolean>(true); // Start visible

  useEffect(() => {
    console.log("TextDisplay mounted - ALWAYS VISIBLE FOR TESTING");

    // Force display a test message immediately
    setText("TEXT DISPLAY IS WORKING. Waiting for model responses...");
    setVisible(true);

    // Add a periodic test message to ensure display is working
    const periodicTimer = setInterval(() => {
      const timestamp = new Date().toLocaleTimeString();
      setText(`Text display check at ${timestamp}. Waiting for model responses...`);
      setVisible(true);
    }, 10000); // Every 10 seconds

    const handleModelText = (text: string) => {
      console.log("TextDisplay received text:", text);
      setText(`MODEL SAID: ${text}`);
      setVisible(true);

      // Keep this message visible for a while
      clearInterval(periodicTimer);

      // Resume periodic messages after a while
      setTimeout(() => {
        setText(`Last model message at ${new Date().toLocaleTimeString()}: ${text.substring(0, 50)}...`);
      }, 15000);
    };

    const handleTurnComplete = () => {
      // Add a marker to the text when turn completes
      setText(prev => `${prev} [TURN COMPLETE]`);
      // Keep text visible
    };

    client.on("modeltext", handleModelText);
    client.on("turncomplete", handleTurnComplete);

    // Also listen for content events as a fallback
    client.on("content", (data: any) => {
      console.log("Content event received:", data);
      try {
        // Check if this is a ModelTurn
        if (data && typeof data === 'object' && 'modelTurn' in data) {
          const modelTurn = data.modelTurn;
          if (modelTurn && modelTurn.parts && Array.isArray(modelTurn.parts)) {
            const textParts = modelTurn.parts.filter((p: any) => p && p.text);
            if (textParts.length > 0) {
              const combinedText = textParts.map((p: any) => p.text).join(' ');
              if (combinedText.trim()) {
                console.log("Extracted text from content event:", combinedText);
                setText(`CONTENT EVENT: ${combinedText}`);
                setVisible(true);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error processing content event:", error);
      }
    });

    return () => {
      client.off("modeltext", handleModelText);
      client.off("turncomplete", handleTurnComplete);
      client.off("content");
      clearInterval(periodicTimer);
    };
  }, [client]);

  // Always visible for testing
  return (
    <div className="text-display visible">
      <div className="text-content">
        <p>{text || "No text available"}</p>
      </div>
    </div>
  );
}
