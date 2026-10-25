import os
import tensorflow as tf

MODEL_PATH = "model/clothing_classifier.keras"
TFLITE_PATH = "model/clothing_classifier.tflite"

model = tf.keras.models.load_model(MODEL_PATH)
converter = tf.lite.TFLiteConverter.from_keras_model(model)
tflite_bytes = converter.convert()

with open(TFLITE_PATH, "wb") as f:
    f.write(tflite_bytes)

print(f"Saved {TFLITE_PATH} ({os.path.getsize(TFLITE_PATH) / 1_000_000:.1f} MB)")