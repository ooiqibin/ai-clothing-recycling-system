import tensorflow as tf
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix

DATASET_DIR = "dataset"
IMG_SIZE = (224, 224)
BATCH_SIZE = 16
MODEL_PATH = "model/clothing_classifier.keras"

# Load the same validation split used during training (same seed = same split)
val_ds = tf.keras.utils.image_dataset_from_directory(
    DATASET_DIR,
    validation_split=0.2,
    subset="validation",
    seed=42,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
)

class_names = val_ds.class_names
print(f"Classes: {class_names}\n")

# Load the trained model
model = tf.keras.models.load_model(MODEL_PATH)

# Collect true labels and predictions across the whole validation set
y_true = []
y_pred = []

for images, labels in val_ds:
    predictions = model.predict(images, verbose=0)
    predicted_classes = np.argmax(predictions, axis=1)
    y_true.extend(labels.numpy())
    y_pred.extend(predicted_classes)

y_true = np.array(y_true)
y_pred = np.array(y_pred)

# ----- PER-CATEGORY REPORT -----
print("=" * 60)
print("PER-CATEGORY PERFORMANCE")
print("=" * 60)
print(classification_report(y_true, y_pred, target_names=class_names))

# ----- CONFUSION MATRIX -----
print("=" * 60)
print("CONFUSION MATRIX")
print("=" * 60)
print("Rows = actual category, Columns = predicted category\n")

cm = confusion_matrix(y_true, y_pred)
header = "        " + "  ".join([f"{name[:8]:>8}" for name in class_names])
print(header)
for i, row in enumerate(cm):
    row_str = "  ".join([f"{val:>8}" for val in row])
    print(f"{class_names[i][:8]:>8}  {row_str}")

print("\nHow to read this: the diagonal (top-left to bottom-right) shows correct")
print("predictions. Anything off the diagonal is a mistake - e.g. row 'damaged',")
print("column 'recyclable' means an actually-damaged item got predicted as recyclable.")