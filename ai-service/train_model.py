import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.applications import MobileNetV2
from sklearn.utils.class_weight import compute_class_weight
import numpy as np
import os

# ----- CONFIG -----
DATASET_DIR = "dataset"
IMG_SIZE = (224, 224)      # MobileNetV2's expected input size
BATCH_SIZE = 16
EPOCHS = 20
MODEL_SAVE_PATH = "model/clothing_classifier.keras"

os.makedirs("model", exist_ok=True)

# ----- LOAD DATASET -----
# Automatically splits into train/validation, and reads class names from folder names
train_ds = tf.keras.utils.image_dataset_from_directory(
    DATASET_DIR,
    validation_split=0.2,
    subset="training",
    seed=42,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
)

val_ds = tf.keras.utils.image_dataset_from_directory(
    DATASET_DIR,
    validation_split=0.2,
    subset="validation",
    seed=42,
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
)

class_names = train_ds.class_names
print(f"\nClasses found: {class_names}\n")

# Save class names to a file so the Flask inference service knows the label order
with open("model/class_names.txt", "w") as f:
    f.write("\n".join(class_names))

# ----- COMPUTE CLASS WEIGHTS (to handle imbalance, e.g. 54 damaged vs 21 recyclable) -----
all_labels = np.concatenate([y.numpy() for _, y in train_ds.unbatch().batch(1000)])
class_weights_array = compute_class_weight(
    class_weight="balanced",
    classes=np.unique(all_labels),
    y=all_labels
)
class_weights = dict(enumerate(class_weights_array))
print(f"Class weights (to balance imbalanced dataset): {class_weights}\n")

# ----- DATA AUGMENTATION -----
# Since your dataset is small, augmentation artificially creates more variety
# (flips, rotations, zoom) to help the model generalize better and avoid overfitting.
data_augmentation = tf.keras.Sequential([
    layers.RandomFlip("horizontal"),
    layers.RandomRotation(0.15),
    layers.RandomZoom(0.15),
    layers.RandomContrast(0.15),
])

# ----- PREPROCESSING -----
preprocess_input = tf.keras.applications.mobilenet_v2.preprocess_input

AUTOTUNE = tf.data.AUTOTUNE
train_ds = train_ds.cache().shuffle(200).prefetch(buffer_size=AUTOTUNE)
val_ds = val_ds.cache().prefetch(buffer_size=AUTOTUNE)

# ----- BUILD THE MODEL -----
base_model = MobileNetV2(
    input_shape=IMG_SIZE + (3,),
    include_top=False,      # exclude MobileNet's original 1000-class output layer
    weights="imagenet"
)
base_model.trainable = False  # freeze pretrained layers - we only train our new head

inputs = tf.keras.Input(shape=IMG_SIZE + (3,))
x = data_augmentation(inputs)
x = preprocess_input(x)
x = base_model(x, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dropout(0.3)(x)
outputs = layers.Dense(len(class_names), activation="softmax")(x)

model = models.Model(inputs, outputs)

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"]
)

model.summary()

# ----- TRAIN -----
print("\nStarting training...\n")
history = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS,
    class_weight=class_weights,
)

# ----- SAVE THE MODEL -----
model.save(MODEL_SAVE_PATH)
print(f"\nModel saved to: {MODEL_SAVE_PATH}")

# ----- PRINT FINAL RESULTS -----
final_train_acc = history.history["accuracy"][-1]
final_val_acc = history.history["val_accuracy"][-1]
print(f"\nFinal training accuracy: {final_train_acc:.2%}")
print(f"Final validation accuracy: {final_val_acc:.2%}")