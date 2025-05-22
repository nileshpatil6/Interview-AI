/**
 * Mock Interview Application
 */

import { useRef, useState, useEffect } from "react";
import "./App.scss";
import { useLiveAPIContext } from "./contexts/LiveAPIContext";
import ControlTray from "./components/control-tray/ControlTray";
import cn from "classnames";
import GetStarted from "./components/get-started/GetStarted";
import InterviewAvatar from "./components/interview-avatar/InterviewAvatar";
import InterviewQuestions from "./components/interview-questions/InterviewQuestions";
import FaceDetection from './components/face-detection/FaceDetection';
import FullScreenWarning from './components/full-screen-warning/FullScreenWarning';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [modelText, setModelText] = useState<string>("");
  const [isFaceDetected, setIsFaceDetected] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [wasDisconnected, setWasDisconnected] = useState(false);
  const { client, connected, disconnect, connect } = useLiveAPIContext();
  const autoResumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleStartInterview = () => {
    setInterviewStarted(true);
    if (!connected) {
      connect();
    }
  };

  // Effect for handling interview pause/resume based on face detection
  useEffect(() => {
    if (interviewStarted) {
      // Log face detection status for debugging
      console.log(`Face detection status: ${isFaceDetected ? 'Face detected' : 'No face detected'}`);
      
      // Face is not detected - pause the interview and show warning immediately
      if (!isFaceDetected && connected) {
        console.log("Face not detected, pausing interview");
        disconnect();
        setWasDisconnected(true);
        
        // Clear any pending auto-resume timeouts
        if (autoResumeTimeoutRef.current) {
          clearTimeout(autoResumeTimeoutRef.current);
          autoResumeTimeoutRef.current = null;
        }
        
        // Show warning immediately - no delay
        setShowWarning(true);
      } 
      // Face is detected again - auto-resume the interview after a short delay
      else if (isFaceDetected && !connected && wasDisconnected) {
        console.log("Face detected again, preparing to auto-resume interview");
        
        // Hide warning immediately when face is detected
        setShowWarning(false);
        
        // Auto-resume after a short delay (1 second)
        // This prevents rapid connect/disconnect cycles if the face detection is unstable
        if (autoResumeTimeoutRef.current) {
          clearTimeout(autoResumeTimeoutRef.current);
        }
        
        autoResumeTimeoutRef.current = setTimeout(() => {
          if (isFaceDetected) { // Double-check face is still detected
            console.log("Auto-resuming interview");
            connect();
            setWasDisconnected(false);
            setModelText("Interview resumed - welcome back!");
          }
        }, 1000);
      }
    }
    
    // Cleanup timeouts on unmount
    return () => {
      if (autoResumeTimeoutRef.current) {
        clearTimeout(autoResumeTimeoutRef.current);
        autoResumeTimeoutRef.current = null;
      }
    };
  }, [isFaceDetected, connected, interviewStarted, connect, disconnect, wasDisconnected]);


  // Direct text display in the App component using a global event listener
  useEffect(() => {
    const handleModelText = (event: CustomEvent) => {
      const text = event.detail;
      if (!isFaceDetected && interviewStarted) {
        setModelText("Interview paused - face not detected.");
      } else {
        setModelText(`${text}`);
      }
    };

    window.addEventListener('modelTextEvent' as any, handleModelText as any);
    return () => {
      window.removeEventListener('modelTextEvent' as any, handleModelText as any);
    };
  }, [isFaceDetected, interviewStarted]);

  return (
    <div className="App">
      <div className="interview-app">
        {!interviewStarted ? (
          <GetStarted onStart={handleStartInterview} />
        ) : (
          <main className={cn("interview-main", { 'blur-background': !isFaceDetected && interviewStarted })}>
            <div className="interview-header">
              <h1>Mock Interview Session</h1>
              <div className="model-text-display">
                <p>{modelText}</p>
              </div>
            </div>

            <div className="interview-content">
              {/* Webcam feeds in corners */}
              <div className="corner-webcam corner-webcam-left">
                <p className="video-feed-label">Face Detection</p>
                <FaceDetection 
                  videoRef={videoRef} 
                  onFaceDetected={setIsFaceDetected} 
                />
              </div>
              
              <div className="corner-webcam corner-webcam-right">
                <p className="video-feed-label">Your Camera</p>
                <video
                  className={cn("user-video", {
                    hidden: !videoRef.current || !videoStream,
                  })}
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                />
              </div>

              {/* Center content with avatar and questions */}
              <div className="main-content">
                <div className="central-avatar-section">
                  <InterviewAvatar faceDetected={isFaceDetected} />
                </div>
                
                <div className="questions-section">
                  <InterviewQuestions />
                </div>
              </div>
            </div>

            <div className="interview-controls">
              <ControlTray
                videoRef={videoRef}
                supportsVideo={true}
                onVideoStreamChange={setVideoStream}
                enableEditingSettings={false}
              />
            </div>
          </main>
        )}
        <FullScreenWarning visible={!isFaceDetected && interviewStarted} />
      </div>
    </div>
  );
}

export default App;
