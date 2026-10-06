from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import cv2
import numpy as np
import base64
import mediapipe as mp
import math
from deepface import DeepFace

app = FastAPI(title="Advanced AI Proctoring")

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=3, 
    refine_landmarks=True, 
    min_detection_confidence=0.4,
    min_tracking_confidence=0.4
)

# Tambahkan profilebase64
class ImagePayload(BaseModel):
    imagebase64: str
    profilebase64: str = None 

def calculate_distance(p1, p2):
    return math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2)

@app.post("/analyze-frame")
async def analyze_frame(payload: ImagePayload):
    try:
        image_binary = base64.b64decode(payload.imagebase64)
        np_arr = np.frombuffer(image_binary, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        violation = False
        violation_type = None
        confidence = 100.0
        
        gray_img = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        if np.mean(gray_img) < 20:
            return {"status": "success", "violation": True, "violation_type": "camera_dark", "confidence_score": 95.0}

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(img_rgb)
        
        face_count = len(results.multi_face_landmarks) if results.multi_face_landmarks else 0
        
        if face_count == 0:
            violation = True
            violation_type = "no_face"
        elif face_count > 1:
            violation = True
            violation_type = "multiple_faces"
        else:
            if payload.profilebase64:
                try:
                    prof_binary = base64.b64decode(payload.profilebase64)
                    prof_arr = np.frombuffer(prof_binary, np.uint8)
                    prof_img = cv2.imdecode(prof_arr, cv2.IMREAD_COLOR)

                    verification = DeepFace.verify(
                        img1_path=img_rgb, 
                        img2_path=prof_img, 
                        model_name="Facenet", 
                        enforce_detection=False,
                        anti_spoofing=True
                    )
                    
                    if not verification.get("is_real", True):
                        violation = True
                        violation_type = "spoofing"
                        confidence = 96.0
                    
                    elif not verification["verified"]:
                        violation = True
                        violation_type = "unmatched_face"
                        confidence = (1.0 - verification["distance"]) * 100
                except Exception as e:
                    print(f"DeepFace Error: {e}")

            if not violation:
                landmarks = results.multi_face_landmarks[0].landmark
                lip_distance = calculate_distance(landmarks[13], landmarks[14])
                dist_left = calculate_distance(landmarks[33], landmarks[1])
                dist_right = calculate_distance(landmarks[263], landmarks[1])
                turn_ratio = dist_left / dist_right if dist_right != 0 else 0
                
                print(f"Turn Ratio Wajah: {turn_ratio:.2f} | Jarak Bibir: {lip_distance:.3f}")

                if lip_distance > 0.05:
                    violation, violation_type, confidence = True, "talking", 88.0
                elif turn_ratio > 2.2 or turn_ratio < 0.45:
                    violation, violation_type, confidence = True, "looking_away", 90.0
                
        return {
            "status": "success",
            "faces_detected": face_count,
            "violation": violation,
            "violation_type": violation_type,
            "confidence_score": confidence
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))