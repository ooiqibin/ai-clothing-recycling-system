
import tensorflow as tf
from tensorflow.keras import layers, models
from tensorflow.keras.applications import MobileNetV2
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import classification_report, confusion_matrix, ConfusionMatrixDisplay
import numpy as np
import matplotlib.pyplot as plt
import json
import os

# ----- CONFIG -----
DATASET_DIR = "dataset"
IMG_SIZE = (224, 224)
BATCH_SIZE = 16

INITIAL_EPOCHS = 10
FINE_TUNE_EPOCHS = 10
FINE_TUNE_LAYERS = 30

MODEL_SAVE_PATH = "model/clothing_classifier.keras"

os.makedirs("model", exist_ok=True)
tf.keras.utils.set_random_seed(42)

# ----- LOAD DATASET -----
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

with open("model/class_names.txt", "w") as f:
    f.write("\n".join(class_names))

# ----- CLASS WEIGHTS -----
all_labels = np.concatenate([
    y.numpy() for _, y in train_ds.unbatch().batch(1000)
])

class_weights_array = compute_class_weight(
    class_weight="balanced",
    classes=np.unique(all_labels),
    y=all_labels
)

class_weights = dict(enumerate(class_weights_array))
print(f"Class weights: {class_weights}\n")

# ----- DATA AUGMENTATION -----
data_augmentation = tf.keras.Sequential([
    layers.RandomFlip("horizontal"),
    layers.RandomRotation(0.15),
    layers.RandomZoom(0.15),
    layers.RandomContrast(0.15),
])

# ----- DATASET PERFORMANCE -----
AUTOTUNE = tf.data.AUTOTUNE

train_ds = train_ds.cache().shuffle(200).prefetch(
    buffer_size=AUTOTUNE
)

val_ds = val_ds.cache().prefetch(
    buffer_size=AUTOTUNE
)

# ----- BUILD MODEL -----
preprocess_input = tf.keras.applications.mobilenet_v2.preprocess_input

base_model = MobileNetV2(
    input_shape=IMG_SIZE + (3,),
    include_top=False,
    weights="imagenet"
)

base_model.trainable = False

inputs = tf.keras.Input(shape=IMG_SIZE + (3,))
x = data_augmentation(inputs)
x = preprocess_input(x)
x = base_model(x, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dropout(0.3)(x)
outputs = layers.Dense(
    len(class_names),
    activation="softmax"
)(x)

model = models.Model(inputs, outputs)

# ----- STAGE 1: TRAIN CLASSIFICATION HEAD -----
print("\n========== STAGE 1: TRAIN CLASSIFICATION HEAD ==========\n")

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"]
)

model.summary()

stage1_callbacks = [
    tf.keras.callbacks.EarlyStopping(
        monitor="val_loss",
        patience=4,
        restore_best_weights=True
    )
]

history1 = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=INITIAL_EPOCHS,
    class_weight=class_weights,
    callbacks=stage1_callbacks
)

# ----- STAGE 2: FINE-TUNE LAST MOBILE NET LAYERS -----
print("\n========== STAGE 2: FINE-TUNING ==========\n")

base_model.trainable = True

# Freeze all but the final selected layers
for layer in base_model.layers[:-FINE_TUNE_LAYERS]:
    layer.trainable = False

# Keep Batch Normalization layers frozen for stability
for layer in base_model.layers:
    if isinstance(layer, layers.BatchNormalization):
        layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.00001),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"]
)

stage2_callbacks = [
    tf.keras.callbacks.EarlyStopping(
        monitor="val_loss",
        patience=4,
        restore_best_weights=True
    ),
    tf.keras.callbacks.ModelCheckpoint(
        MODEL_SAVE_PATH,
        monitor="val_loss",
        save_best_only=True
    )
]

history2 = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=FINE_TUNE_EPOCHS,
    class_weight=class_weights,
    callbacks=stage2_callbacks
)

# ----- LOAD BEST FINE-TUNED MODEL -----
if os.path.exists(MODEL_SAVE_PATH):
    model = tf.keras.models.load_model(MODEL_SAVE_PATH)
else:
    model.save(MODEL_SAVE_PATH)

print(f"\nBest model saved to: {MODEL_SAVE_PATH}")

# ----- COMBINE TRAINING HISTORY -----
history = {}

for key in history1.history:
    history[key] = (
        history1.history[key] + history2.history[key]
    )

with open("model/training_history.json", "w") as f:
    json.dump(
        {k: [float(v) for v in vals] for k, vals in history.items()},
        f
    )

# ----- TRAINING CURVES -----
acc = history["accuracy"]
val_acc = history["val_accuracy"]
loss = history["loss"]
val_loss = history["val_loss"]

epochs_range = range(1, len(acc) + 1)

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))

ax1.plot(epochs_range, acc, label="Training accuracy")
ax1.plot(epochs_range, val_acc, label="Validation accuracy")
ax1.axvline(len(history1.history["accuracy"]), linestyle="--",
            label="Fine-tuning starts")
ax1.set_title("Model accuracy")
ax1.set_xlabel("Epoch")
ax1.set_ylabel("Accuracy")
ax1.legend()

ax2.plot(epochs_range, loss, label="Training loss")
ax2.plot(epochs_range, val_loss, label="Validation loss")
ax2.axvline(len(history1.history["loss"]), linestyle="--",
            label="Fine-tuning starts")
ax2.set_title("Model loss")
ax2.set_xlabel("Epoch")
ax2.set_ylabel("Loss")
ax2.legend()

plt.tight_layout()
plt.savefig("model/training_curves.png", dpi=200, bbox_inches="tight")
plt.close(fig)

# ----- FINAL EVALUATION -----
print("\n========== FINAL EVALUATION ==========\n")

y_true = []
y_pred = []

for images, labels in val_ds:
    probs = model.predict(images, verbose=0)
    y_true.extend(labels.numpy())
    y_pred.extend(np.argmax(probs, axis=1))

print(classification_report(
    y_true,
    y_pred,
    target_names=class_names
))

ConfusionMatrixDisplay(
    confusion_matrix(y_true, y_pred),
    display_labels=class_names
).plot(cmap="Greens")

plt.savefig(
    "model/confusion_matrix.png",
    dpi=200,
    bbox_inches="tight"
)
plt.show()
