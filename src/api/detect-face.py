from flask import Flask, request, jsonify
from face_detector import FaceDetector
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize the face detector
face_detector = FaceDetector()

@app.route('/api/detect-face', methods=['POST'])
def detect_face_route():
    data = request.get_json()
    if 'image' not in data:
        return jsonify({"error": "No image data provided"}), 400
    
    base64_image = data['image']
    
    # Perform face detection
    result = face_detector.detect_faces_from_base64(base64_image)
    
    if "error" in result:
        return jsonify(result), 500
        
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True, port=5001) # Changed port to 5001 to avoid conflict with React dev server
