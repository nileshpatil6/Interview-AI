/**
 * InterviewAvatar component - Displays a realistic human avatar for the interview
 */
import { useEffect, useRef, useState } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import TranscriptionDisplay from "../transcription-display/TranscriptionDisplay";
import "./interview-avatar.scss";
import humanAvatarSvg from "../../assets/human-avatar.svg";

interface InterviewAvatarProps {
  faceDetected?: boolean; // Optional prop to track face detection status
}

export default function InterviewAvatar({ faceDetected = true }: InterviewAvatarProps) {
  const { volume, connected, client } = useLiveAPIContext();
  const avatarRef = useRef<HTMLObjectElement>(null);
  const [speaking, setSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState<string>("");
  const audioStreamerRef = useRef<any>(null);

  // Get reference to the audio streamer gain node for volume control
  useEffect(() => {
    // Access the audioStreamer from the client if available
    if (client && (client as any).audioStreamer) {
      audioStreamerRef.current = (client as any).audioStreamer;
    }
  }, [client]);

  // Control volume based on face detection status
  useEffect(() => {
    // If we have access to the audio streamer's gain node
    if (audioStreamerRef.current && audioStreamerRef.current.gainNode) {
      if (!faceDetected) {
        // Face not detected - instantly mute audio
        audioStreamerRef.current.gainNode.gain.value = 0;
        console.log("Face not detected, muting audio");
      } else {
        // Face detected - restore normal volume
        audioStreamerRef.current.gainNode.gain.value = 1;
        console.log("Face detected, restoring audio volume");
      }
    } else if ((client as any).setAudioVolume) {
      // Alternative approach if direct gainNode access isn't available
      (client as any).setAudioVolume(faceDetected ? 1 : 0);
    }
  }, [faceDetected, client]);

  // Detect when the AI is speaking based on volume
  useEffect(() => {
    if (volume > 0.05 && faceDetected) {
      setSpeaking(true);
    } else {
      setSpeaking(false);
    }
  }, [volume, faceDetected]);

  // Add a direct listener for model text as a fallback
  useEffect(() => {
    console.log("Setting up direct modeltext listener in InterviewAvatar");

    const handleModelText = (text: string) => {
      console.log("InterviewAvatar received model text:", text);
      setCurrentText(text);
    };

    const handleTurnComplete = () => {
      // Clear text after a delay
      setTimeout(() => {
        setCurrentText("");
      }, 2000);
    };

    client.on("modeltext", handleModelText);
    client.on("turncomplete", handleTurnComplete);

    return () => {
      client.off("modeltext", handleModelText);
      client.off("turncomplete", handleTurnComplete);
    };
  }, [client]);

  // Advanced lip sync levels based on audio volume
  const updateMouth = () => {
    if (avatarRef.current && avatarRef.current.contentDocument) {
      const svgDoc = avatarRef.current.contentDocument;
      const mouthClosed = svgDoc.getElementById('mouth-closed');
      const mouthSlightlyOpen = svgDoc.getElementById('mouth-slightly-open');
      const mouthMediumOpen = svgDoc.getElementById('mouth-medium-open');
      const mouthOpen = svgDoc.getElementById('mouth-open');
      const mouthSmile = svgDoc.getElementById('mouth-smile');
      
      // Hide all mouth states first
      if (mouthClosed) mouthClosed.style.display = 'none';
      if (mouthSlightlyOpen) mouthSlightlyOpen.style.display = 'none';
      if (mouthMediumOpen) mouthMediumOpen.style.display = 'none';
      if (mouthOpen) mouthOpen.style.display = 'none';
      if (mouthSmile) mouthSmile.style.display = 'none';
      
      if (!speaking) {
        // Not speaking - show default closed mouth
        if (mouthClosed) mouthClosed.style.display = 'block';
      } else {
        // Speaking - show dynamic mouth based on volume level
        if (volume < 0.1) {
          // Very low volume - slightly open
          if (mouthSlightlyOpen) mouthSlightlyOpen.style.display = 'block';
        } else if (volume < 0.25) {
          // Low volume - slightly open or smile randomly
          if (Math.random() > 0.7) {
            if (mouthSmile) mouthSmile.style.display = 'block';
          } else {
            if (mouthSlightlyOpen) mouthSlightlyOpen.style.display = 'block';
          }
        } else if (volume < 0.4) {
          // Medium volume - medium open
          if (mouthMediumOpen) mouthMediumOpen.style.display = 'block';
        } else {
          // High volume - fully open
          if (mouthOpen) mouthOpen.style.display = 'block';
        }
      }
    }
  };

  // Handle SVG load event
  useEffect(() => {
    const handleLoad = () => {
      console.log("SVG loaded, setting up mouth animation");
      updateMouth();
    };

    const avatarElement = avatarRef.current;
    if (avatarElement) {
      avatarElement.addEventListener('load', handleLoad);
      return () => {
        avatarElement.removeEventListener('load', handleLoad);
      };
    }
  }, [avatarRef]);

  // Update mouth more frequently for smoother lip sync
  useEffect(() => {
    // Initialize update
    updateMouth();
    
    // Only set up dynamic updates when speaking
    if (speaking) {
      // Update the mouth animation at a high frequency for smoother motion
      const mouthAnimationInterval = setInterval(() => {
        updateMouth();
      }, 100); // Update every 100ms for smoother mouth movement
      
      return () => {
        clearInterval(mouthAnimationInterval);
      };
    }
  }, [speaking, volume]);

  return (
    <div className="interview-avatar-container">
      {/* Speech transcription display */}
      <TranscriptionDisplay />

      <div className={`interview-avatar-wrapper ${speaking ? 'speaking' : ''} ${connected ? 'active' : ''} ${!faceDetected ? 'paused' : ''}`}>
        {/* Human avatar using SVG */}
        <object
          ref={avatarRef}
          type="image/svg+xml"
          data={humanAvatarSvg}
          className="human-avatar"
          aria-label="Human avatar"
        />
      </div>
      <div className="avatar-name">Interview Assistant</div>
      {!faceDetected && (
        <div className="avatar-status">Interview Paused</div>
      )}
    </div>
  );
}
