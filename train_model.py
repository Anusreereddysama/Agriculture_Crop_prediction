import json
import pickle

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from features import ALL_FEATURE_NAMES, BASE_FEATURE_NAMES, add_engineered_features

# Load Dataset

df = pd.read_csv("cleaned_crop_data.csv")
df.columns = df.columns.str.strip().str.lower()

df = df[BASE_FEATURE_NAMES + ["label"]]

X_df = add_engineered_features(df.drop(columns=["label"]))
X = X_df[ALL_FEATURE_NAMES].to_numpy(dtype=float)
y = df["label"]

# Handle Missing Value

imputer = SimpleImputer(strategy="mean")
X_imputed = imputer.fit_transform(X)

# Scale Features

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X_imputed)


# Train-Test Split

X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y, test_size=0.2, random_state=42, stratify=y
)


# Model

model = RandomForestClassifier(
    n_estimators=500,
    max_depth=20,
    random_state=42,
    n_jobs=1,
)

model.fit(X_train, y_train)


# Accuracy

y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print("Model Accuracy:", round(accuracy * 100, 2), "%")
print("Feature count:", len(ALL_FEATURE_NAMES))


# Save Model

with open("model.pkl", "wb") as f:
    pickle.dump(model, f)
with open("scaler.pkl", "wb") as f:
    pickle.dump(scaler, f)
with open("imputer.pkl", "wb") as f:
    pickle.dump(imputer, f)

with open("feature_columns.json", "w", encoding="utf-8") as f:
    json.dump({"features": ALL_FEATURE_NAMES}, f, indent=2)

print("✅ Model trained and saved successfully!")
