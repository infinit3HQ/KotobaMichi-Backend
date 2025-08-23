# Enriched JLPT N5 Vocabulary Dataset

**Version:** 2.0
**Last Updated:** August 23, 2025

---

## 📖 Overview

This dataset contains a comprehensive list of Japanese Language Proficiency Test (JLPT) N5 level vocabulary, enriched with high-quality metadata and semantic vectors. The original dataset has been programmatically enhanced to include Romaji readings, JLPT level, grammatical information, thematic topics, and machine-readable vector embeddings.

The goal of this project is to transform a basic vocabulary list into a powerful, structured dataset suitable for developing intelligent language learning applications, conducting linguistic analysis, and building personalized study tools.

---

## ⚙️ Data Enrichment Process

The dataset was created through a multi-step pipeline using state-of-the-art Natural Language Processing (NLP) models:

1.  **Romaji Conversion:** The `pykakasi` library was used to convert the Hiragana readings into Hepburn-style Romaji.
2.  **Part of Speech (POS) Tagging:** The `sudachipy` library, a powerful Japanese morphological analyzer, was used to determine the grammatical role of each word (e.g., Noun, Verb, Adjective).
3.  **Topic Classification:** A `zero-shot-classification` pipeline from the Hugging Face `transformers` library was employed to categorize each word into a predefined list of thematic topics.
4.  **Vectorization:** The `sentence-transformers` library was used to generate semantic vector embeddings for each entry, capturing the contextual meaning of the words.

---

## 🗂️ Data Dictionary

The final dataset is in CSV format and contains the following columns in this specific order:

| Column Name | Data Type | Description | Example |
| :--- | :--- | :--- | :--- |
| **`Kanji`** | `string` | The Japanese word in Kanji. Can be empty. | `学校` |
| **`Hiragana`** | `string` | The phonetic reading in Hiragana. | `がっこう` |
| **`Romaji`** | `string` | The phonetic reading in Hepburn Romaji. | `gakkou` |
| **`English`** | `string` | The English translation or definition. | `school` |
| **`Level`** | `string` | The JLPT level of the vocabulary. | `N5` |
| **`PronunciationURL`**| `string` | A URL to an MP3 file of the pronunciation. | `.../0140_がっこう.mp3` |
| **`Topic`** | `string` | The assigned thematic category. | `Education` |
| **`Part_of_Speech`** | `string` | The grammatical part of speech in English. | `Noun` |
| **`Vector`** | `string` | A string representation of a 768-dimension vector. | `"[0.012, ... , 0.089]"` |
| **`vector_text`** | `string` | The source text used to generate the vector. | `"Japanese word: 学校..."` |

---

## 🚀 Potential Use Cases

This enriched dataset is ideal for a variety of applications, including:

* **Intelligent Flashcard Apps:** Create study decks filtered by topic (`Food`, `Animals`) or grammar (`Verbs`, `i-Adjectives`).
* **Personalized Learning Systems:** Recommend new words based on semantic similarity using the vector embeddings.
* **Quiz Generation:** Automatically generate quizzes that focus on a user's weak areas.
* **Linguistic Analysis:** Analyze the distribution of topics and parts of speech within the N5 vocabulary.

---

## 📝 Notes on Using the Data

* **Vector Format:** The `Vector` column is stored as a string. To use it for calculations, you will need to parse this string back into a list or array of floats (e.g., using `ast.literal_eval()` in Python).
* **Database Integration:** When importing into a database like PostgreSQL with the `pgvector` extension, ensure you convert the vector string into a numerical array that can be stored in the `VECTOR` data type.