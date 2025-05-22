import { useEffect, useRef, useState } from 'react';
import './face-detection.scss';

interface FaceDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  onFaceDetected: (detected: boolean) => void;
}

export default function FaceDetection({ videoRef, onFaceDetected }: FaceDetectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFaceDetected, setIsFaceDetected] = useState(true);
  const [faceDetectionError, setFaceDetectionError] = useState<string | null>(null);
  
  // Track last successful face detection
  const lastDetectionRef = useRef<number>(Date.now());
  // Time threshold before considering the face as not detected (2 seconds)
  const detectionThreshold = 2000; 

  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const detectFace = async () => {
      if (!video || !canvas || !ctx) return;

      // Only process if video has data and is playing
      if (video.readyState >= 2 && !video.paused && !video.ended) {
        // Set canvas dimensions to match video, maintaining aspect ratio
        const aspectRatio = video.videoWidth / video.videoHeight;
        
        // Get the container dimensions
        const containerWidth = canvas.offsetWidth;
        const containerHeight = canvas.offsetHeight;
        
        // Calculate dimensions that maintain aspect ratio and fit in container
        let canvasWidth, canvasHeight;
        
        if (containerWidth / aspectRatio <= containerHeight) {
          // Width is the limiting factor
          canvasWidth = containerWidth;
          canvasHeight = containerWidth / aspectRatio;
        } else {
          // Height is the limiting factor
          canvasHeight = containerHeight;
          canvasWidth = containerHeight * aspectRatio;
        }
        
        // Set canvas dimensions
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // Draw the current video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get the image data as base64
        const imageData = canvas.toDataURL('image/jpeg', 0.8); // Reduced quality for better performance

        try {
          // Send the image to the backend for face detection
          const response = await fetch('http://localhost:5001/api/detect-face', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageData }),
          });

          if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
          }

          const result = await response.json();
          
          if (result.error) {
            setFaceDetectionError(result.error);
            console.error("Face detection error:", result.error);
          } else {
            setFaceDetectionError(null);
            
            const detected = result.faces_detected > 0;
            
            if (detected) {
              // Update the last detection time
              lastDetectionRef.current = Date.now();
              
              // Draw face rectangles
              if (result.faces) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                result.faces.forEach((face: number[]) => {
                  const [x, y, w, h] = face;
                  // Scale face coordinates to match canvas size
                  const scaleX = canvas.width / video.videoWidth;
                  const scaleY = canvas.height / video.videoHeight;
                  
                  // Draw rectangle with green border
                  ctx.strokeStyle = '#00ff00';
                  ctx.lineWidth = 3;
                  ctx.strokeRect(
                    x * scaleX, 
                    y * scaleY, 
                    w * scaleX, 
                    h * scaleY
                  );
                  
                  // Add a semi-transparent green fill
                  ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
                  ctx.fillRect(
                    x * scaleX, 
                    y * scaleY, 
                    w * scaleX, 
                    h * scaleY
                  );
                  
                  // Add label
                  ctx.fillStyle = '#00ff00';
                  ctx.font = '14px Arial';
                  ctx.fillText(
                    'Face Detected', 
                    x * scaleX, 
                    (y * scaleY) - 5
                  );
                });
              }
            }
            
            // Check if we've gone too long without detecting a face
            const currentlyDetected = Date.now() - lastDetectionRef.current < detectionThreshold;
            
            // Only update state if it's changing
            if (currentlyDetected !== isFaceDetected) {
              setIsFaceDetected(currentlyDetected);
              onFaceDetected(currentlyDetected);
            }
          }
        } catch (error) {
          console.error('Face detection network error:', error);
          setFaceDetectionError('Connection to face detection service failed');
        }
      }

      // Continue the detection loop
      animationFrameId = requestAnimationFrame(detectFace);
    };

    // Start face detection, more frequently (every 300ms) for smoother UI
    let detectionInterval = setInterval(() => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        if (!animationFrameId) {
          animationFrameId = requestAnimationFrame(detectFace);
        }
      }
    }, 300);

    return () => {
      clearInterval(detectionInterval);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [videoRef, onFaceDetected, isFaceDetected, detectionThreshold]);

  return (
    <div className={`face-detection ${isFaceDetected ? 'face-detected' : 'no-face'}`}>
      <canvas ref={canvasRef} className="face-detection-canvas" />
      
      {isFaceDetected && (
        <div className="face-detection-status face-detected-status">
          <span className="material-symbols-outlined">check_circle</span>
          <p>Face detected</p>
        </div>
      )}
      
      {!isFaceDetected && (
        <div className="face-detection-warning">
          <span className="material-symbols-outlined">warning</span>
          <p>Face not detected!</p>
        </div>
      )}
      
      {faceDetectionError && (
        <div className="face-detection-warning">
          <span className="material-symbols-outlined">error</span>
          <p>Detection error</p>
        </div>
      )}
    </div>
  );
}