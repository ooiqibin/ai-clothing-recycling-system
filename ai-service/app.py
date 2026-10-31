from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np
from PIL import Image
import io

app = Flask(__name__)

# LOAD MODEL AND CLASS NAMES ONCE AT STARTUP (not per-request, for speed)
MODEL_PATH = "model/clothing_classifier.keras"
CLASS_NAMES_PATH = "model/class_names.txt"
IMG_SIZE = (224, 224)

print("Loading model...")
model = tf.keras.models.load_model(MODEL_PATH)

with open(CLASS_NAMES_PATH, "r") as f:
    class_names = [line.strip() for line in f.readlines()]

print(f"Model loaded. Classes: {class_names}")

preprocess_input = tf.keras.applications.mobilenet_v2.preprocess_input


def prepare_image(image_bytes):
    """Converts raw uploaded image bytes into the format the model expects."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(IMG_SIZE)
    img_array = np.array(img)
    img_array = np.expand_dims(img_array, axis=0)  # model expects a batch dimension
    return img_array


@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "AI service is running", "classes": class_names})


@app.route("/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files["image"]
    image_bytes = file.read()

    try:
        processed_image = prepare_image(image_bytes)
        predictions = model.predict(processed_image, verbose=0)[0]

        predicted_index = int(np.argmax(predictions))
        predicted_category = class_names[predicted_index]
        confidence = float(predictions[predicted_index])

        return jsonify({
            "category": predicted_category,
            "confidence": round(confidence, 4)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=6000, debug=True)