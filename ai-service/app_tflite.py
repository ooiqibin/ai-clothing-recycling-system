import io
import os
import threading

import numpy as np
from flask import Flask, request, jsonify
from PIL import Image

try:
    from ai_edge_litert.interpreter import Interpreter
except ImportError:
    from tflite_runtime.interpreter import Interpreter

MODEL_PATH = "model/clothing_classifier.tflite"
CLASS_NAMES_PATH = "model/class_names.txt"
IMG_SIZE = (224, 224)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 15 * 1024 * 1024  # refuse photos over 15 MB

print("Loading model...")
interpreter = Interpreter(model_path=MODEL_PATH, num_threads=1)
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()[0]
output_details = interpreter.get_output_details()[0]

with open(CLASS_NAMES_PATH, "r") as f:
    class_names = [line.strip() for line in f.readlines() if line.strip()]

print(f"Model loaded. Classes: {class_names}")

# The interpreter can only run one prediction at a time.
lock = threading.Lock()


def prepare_image(image_bytes):
    """Raw bytes -> the float32 batch the model expects (0-255 pixels, the model rescales them itself)."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(IMG_SIZE)
    arr = np.array(img, dtype=np.float32)
    return np.expand_dims(arr, axis=0)


@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "AI service is running", "classes": class_names})


@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    image_bytes = request.files["image"].read()

    try:
        batch = prepare_image(image_bytes)

        with lock:
            interpreter.set_tensor(input_details["index"], batch)
            interpreter.invoke()
            probs = interpreter.get_tensor(output_details["index"])[0].copy()

        idx = int(np.argmax(probs))
        return jsonify({
            "category": class_names[idx],
            "confidence": round(float(probs[idx]), 4),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 6000)), debug=False)