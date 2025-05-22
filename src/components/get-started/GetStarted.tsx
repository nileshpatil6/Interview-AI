/**
 * GetStarted component - Initial instructions and permission request
 */
import { useState } from "react";
import "./get-started.scss";

interface GetStartedProps {
  onStart: () => void;
}

export default function GetStarted({ onStart }: GetStartedProps) {
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    
    try {
      // Request camera permission
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      onStart();
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("Camera access is required for the interview. Please allow camera access and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="get-started-container">
      <div className="get-started-card">
        <h1>Mock Interview Assistant</h1>
        <div className="get-started-content">
          <h2>Welcome to your interview preparation</h2>
          <p>
            This AI-powered interview simulator will help you practice for your upcoming interviews.
            The system will ask you questions and provide feedback on your responses.
          </p>
          
          <div className="instructions">
            <h3>How it works:</h3>
            <ol>
              <li>Click "Start Interview" below</li>
              <li>Allow camera and microphone access when prompted</li>
              <li>The AI interviewer will begin asking you questions</li>
              <li>Respond naturally as you would in a real interview</li>
              <li>Receive feedback after the interview session</li>
            </ol>
          </div>
          
          <button 
            className="start-button" 
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? "Setting up..." : "Start Interview"}
          </button>
        </div>
      </div>
    </div>
  );
}
