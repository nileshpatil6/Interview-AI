import React, { useEffect, useState } from 'react';
import './full-screen-warning.scss';

interface FullScreenWarningProps {
  visible: boolean;
}

const FullScreenWarning: React.FC<FullScreenWarningProps> = ({ visible }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  // Add a slight delay before showing the warning to avoid flickering
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setIsVisible(true), 150);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [visible]);
  
  if (!isVisible) {
    return null;
  }
  return (
    <div className="full-screen-warning-overlay">
      <div className="full-screen-warning-content">
        <span className="material-symbols-outlined warning-icon">warning</span>
        <h1>Face Not Detected!</h1>
        <p>Your face is no longer visible in the camera.</p>
        <p>The interview is <strong>PAUSED</strong> until you return to view.</p>
        <p className="instruction">Please position yourself clearly in the center of the frame.</p>
        <div className="pulse-circle"></div>
      </div>
    </div>
  );
};

export default FullScreenWarning;
