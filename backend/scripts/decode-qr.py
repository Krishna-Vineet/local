import sys
import os

img_path = r"C:\Users\visha\.gemini\antigravity-ide\brain\77243a7a-9447-4ad5-997d-c9d4ba4f9254\.user_uploaded\media_1791973961030.png"

try:
    import cv2
    img = cv2.imread(img_path)
    detector = cv2.QRCodeDetector()
    val, pts, qr_code = detector.detectAndDecode(img)
    if val:
        print("QR_CONTENT:", val)
    else:
        print("cv2 could not detect QR")
except Exception as e:
    print("cv2 error:", e)
