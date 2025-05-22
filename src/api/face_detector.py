import cv2
import numpy as np
import os
import urllib.request
import base64

class FaceDetector:
    """
    A class for detecting faces in images using OpenCV's Haar Cascade Classifier.
    """
    
    def __init__(self, cascade_path=None, scale_factor=1.1, min_neighbors=5, min_size=(30, 30)):
        """
        Initialize the face detector.
        
        Args:
            cascade_path (str, optional): Path to the Haar cascade XML file.
                If None, the default OpenCV face cascade will be downloaded and used.
            scale_factor (float): Parameter specifying how much the image size is reduced at each image scale.
            min_neighbors (int): Parameter specifying how many neighbors each candidate rectangle should have.
            min_size (tuple): Minimum possible object size. Objects smaller than this are ignored.
        """
        self.scale_factor = scale_factor
        self.min_neighbors = min_neighbors
        self.min_size = min_size
        
        # If no cascade file is provided, download and use the default one
        if cascade_path is None:
            models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')
            os.makedirs(models_dir, exist_ok=True)
            cascade_path = os.path.join(models_dir, 'haarcascade_frontalface_default.xml')
            
            if not os.path.exists(cascade_path):
                print("Downloading face detection model...")
                url = "https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml"
                urllib.request.urlretrieve(url, cascade_path)
                print(f"Model downloaded to {cascade_path}")
        
        # Load the face cascade
        self.face_cascade = cv2.CascadeClassifier(cascade_path)
        
        # Check if the cascade loaded successfully
        if self.face_cascade.empty():
            raise ValueError(f"Error loading cascade classifier from {cascade_path}")
    
    def detect_faces_from_array(self, image):
        """
        Detect faces in an image array.
        
        Args:
            image (numpy.ndarray): Input image as a numpy array.
            
        Returns:
            list: List of detected faces as (x, y, w, h) tuples.
        """
        # Convert to grayscale
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Detect faces
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=self.scale_factor,
            minNeighbors=self.min_neighbors,
            minSize=self.min_size
        )
        
        return faces
    
    def detect_faces_from_base64(self, base64_image):
        """
        Detect faces in a base64 encoded image.
        
        Args:
            base64_image (str): Base64 encoded image string.
            
        Returns:
            dict: Dictionary containing face detection results.
        """
        try:
            # Decode the base64 image
            image_data = base64.b64decode(base64_image.split(',')[1] if ',' in base64_image else base64_image)
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                return {"error": "Could not decode image"}
            
            # Detect faces
            faces = self.detect_faces_from_array(image)
            
            # Draw faces on the image for debugging
            result_image = self.draw_faces_on_array(image, faces)
            
            # Encode the result image to base64
            _, buffer = cv2.imencode('.jpg', result_image)
            result_base64 = base64.b64encode(buffer).decode('utf-8')
            
            return {
                "success": True,
                "faces_detected": len(faces),
                "faces": faces.tolist() if len(faces) > 0 else [],
                "result_image": f"data:image/jpeg;base64,{result_base64}"
            }
        except Exception as e:
            return {"error": str(e)}
    
    def draw_faces_on_array(self, image, faces, color=(0, 255, 0), thickness=2):
        """
        Draw bounding boxes around detected faces on an image array.
        
        Args:
            image (numpy.ndarray): Input image as a numpy array.
            faces (list): List of detected faces as (x, y, w, h) tuples.
            color (tuple): BGR color for the bounding box.
            thickness (int): Thickness of the bounding box lines.
            
        Returns:
            numpy.ndarray: The image with bounding boxes drawn.
        """
        # Create a copy of the image
        result = image.copy()
        
        # Draw rectangles around the faces
        for (x, y, w, h) in faces:
            cv2.rectangle(result, (x, y), (x+w, y+h), color, thickness)
        
        return result 