import numpy as np
import tensorflow as tf

DATASET_DIR = "dataset"
IMG_SIZE = (224, 224)

keras_model = tf.keras.models.load_model("model/clothing_classifier.keras")
class_names = [line.strip() for line in open("model/class_names.txt")]

interpreter = tf.lite.Interpreter(model_path="model/clothing_classifier.tflite")
interpreter.allocate_tensors()
inp = interpreter.get_input_details()[0]
out = interpreter.get_output_details()[0]

# Same split settings as training, one image at a time.
val_ds = tf.keras.utils.image_dataset_from_directory(
    DATASET_DIR,
    validation_split=0.2,
    subset="validation",
    seed=42,
    image_size=IMG_SIZE,
    batch_size=1,
)
assert val_ds.class_names == class_names, "Class order differs from the saved model"

total, same, worst = 0, 0, 0.0

for images, _ in val_ds:
    x = images.numpy().astype(np.float32)

    keras_probs = keras_model.predict(x, verbose=0)[0]

    interpreter.set_tensor(inp["index"], x)
    interpreter.invoke()
    lite_probs = interpreter.get_tensor(out["index"])[0]

    total += 1
    same += int(np.argmax(keras_probs) == np.argmax(lite_probs))
    worst = max(worst, float(np.max(np.abs(keras_probs - lite_probs))))

print(f"Images checked: {total}")
print(f"Same predicted class: {same}/{total}")
print(f"Largest difference in any probability: {worst:.6f}")