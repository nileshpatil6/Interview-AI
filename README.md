# Interview System with Face Detection

This is an interview system that includes face detection to ensure the interviewee remains visible during the session. The system will automatically pause the interview if no face is detected.

## Features

- Real-time face detection
- Automatic interview pausing when face is not detected
- Split-screen view showing both the original video and face detection
- Warning overlay when face is not visible
- Modern and responsive UI

## Setup

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory and add your API key:
```
REACT_APP_GEMINI_API_KEY=your_api_key_here
```

3. Start the development server:
```bash
npm start
```

### Backend Setup

1. Create a Python virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Start the Flask server:
```bash
python src/api/detect-face.py
```

## Usage

1. Open the application in your browser (default: http://localhost:3000)
2. Click "Start Interview" and allow camera access
3. The system will show two video feeds:
   - Left: Face detection view with green rectangles around detected faces
   - Right: Original video feed
4. If your face is not detected, the interview will automatically pause and show a warning
5. Position yourself in front of the camera to resume the interview

## Technical Details

- Frontend: React with TypeScript
- Backend: Flask with OpenCV for face detection
- Face Detection: OpenCV's Haar Cascade Classifier
- Real-time video processing using Canvas API
- WebSocket communication for interview control

## Security Notes

- The face detection is performed locally on the backend
- No video data is stored or transmitted to external servers
- All communication is done over secure WebSocket connections
