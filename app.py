import os
import json
import re
import string
import numpy as np
from flask import Flask, request, jsonify, render_template

# Setup local NLTK directory to avoid permission issues in cloud environments like Render
import nltk

# Download required resources
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('wordnet')
base_dir = os.path.dirname(os.path.abspath(__file__))
nltk_data_path = os.path.join(base_dir, 'nltk_data')
if not os.path.exists(nltk_data_path):
    os.makedirs(nltk_data_path)

# Tell NLTK to use our local folder
nltk.data.path.append(nltk_data_path)

# Download resources silently
required_nltk_resources = ['punkt', 'stopwords', 'wordnet', 'omw-1.4']
for resource in required_nltk_resources:
    try:
        nltk.download(resource, download_dir=nltk_data_path, quiet=True)
    except Exception as e:
        print(f"Warning: Failed to download NLTK resource '{resource}': {e}")

from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)

# Initialize NLTK utilities
try:
    lemmatizer = WordNetLemmatizer()
    stop_words = set(stopwords.words('english'))
except Exception as e:
    print(f"Error loading lemmatizer/stopwords: {e}. Retrying downloads...")
    nltk.download('stopwords', download_dir=nltk_data_path, quiet=False)
    nltk.download('wordnet', download_dir=nltk_data_path, quiet=False)
    lemmatizer = WordNetLemmatizer()
    stop_words = set(stopwords.words('english'))

# Global variables for FAQ dataset and NLP model
faqs_data = []
faq_questions_preprocessed = []
vectorizer = None
faq_vectors = None

def preprocess_text(text):
    """
    NLP Text Preprocessing Pipeline:
    1. Lowercase conversion
    2. Punctuation removal (regex-based)
    3. Word tokenization
    4. Stopwords removal
    5. Lemmatization
    """
    if not text or not isinstance(text, str):
        return ""
    
    # 1. Convert to lowercase
    text_lower = text.lower()
    
    # 2. Remove punctuation
    text_clean = re.sub(r'[^\w\s]', '', text_lower)
    
    # 3. Tokenize
    try:
        tokens = word_tokenize(text_clean)
    except Exception:
        # Fallback if NLTK word_tokenize has issues
        tokens = text_clean.split()
        
    # 4 & 5. Remove stopwords and apply lemmatization
    processed_tokens = []
    for token in tokens:
        if token not in stop_words:
            lemma = lemmatizer.lemmatize(token)
            processed_tokens.append(lemma)
            
    return " ".join(processed_tokens)

def init_faq_model():
    """
    Loads FAQs from JSON and fits the TF-IDF Vectorizer.
    """
    global faqs_data, faq_questions_preprocessed, vectorizer, faq_vectors
    
    faqs_path = os.path.join(base_dir, 'data', 'faqs.json')
    try:
        with open(faqs_path, 'r', encoding='utf-8') as f:
            faqs_data = json.load(f)
    except Exception as e:
        print(f"Error loading FAQs JSON file: {e}")
        # Default fallback structure if file is missing
        faqs_data = [
            {
                "question": "What is Artificial Intelligence?",
                "answer": "Artificial Intelligence is the simulation of human intelligence in machines."
            }
        ]
        
    # Preprocess all FAQ questions
    faq_questions_preprocessed = [preprocess_text(faq['question']) for faq in faqs_data]
    
    # Fit the vectorizer on the FAQ questions
    vectorizer = TfidfVectorizer()
    faq_vectors = vectorizer.fit_transform(faq_questions_preprocessed)
    print(f"Successfully initialized NLP models with {len(faqs_data)} FAQs.")

# Run initialization
init_faq_model()

@app.route('/')
def home():
    """
    Renders the beautiful glassmorphism chatbot UI.
    """
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    """
    Processes user messages, computes TF-IDF similarity, and returns response.
    """
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({"error": "Invalid request: 'message' is required"}), 400
            
        user_message = data['message'].strip()
        if not user_message:
            return jsonify({
                "answer": "Please ask a question! I am here to help.",
                "confidence": 0.0
            })
            
        # Preprocess query
        processed_query = preprocess_text(user_message)
        
        # Check if preprocessed query is empty
        if not processed_query.strip():
            return jsonify({
                "answer": "I'm sorry, I couldn't find a relevant answer. Please try rephrasing your question.",
                "confidence": 0.0
            })
            
        # Convert user query to TF-IDF vector
        query_vector = vectorizer.transform([processed_query])
        
        # Calculate cosine similarity with all stored FAQs
        similarities = cosine_similarity(query_vector, faq_vectors)[0]
        
        # Find index of the highest similarity score
        best_match_idx = int(np.argmax(similarities))
        max_similarity = float(similarities[best_match_idx])
        
        # Calculate confidence percentage
        confidence = max_similarity * 100
        
        # Fallback threshold (0.25 similarity)
        if max_similarity < 0.25:
            return jsonify({
                "answer": "I'm sorry, I couldn't find a relevant answer. Please try rephrasing your question.",
                "confidence": round(confidence, 2)
            })
            
        # Return matched answer and confidence
        return jsonify({
            "answer": faqs_data[best_match_idx]["answer"],
            "confidence": round(confidence, 2)
        })
        
    except Exception as e:
        print(f"Error handling chat request: {e}")
        return jsonify({
            "answer": "I'm sorry, I encountered an internal error. Please try again.",
            "confidence": 0.0
        }), 500

@app.route('/api/faqs', methods=['GET'])
def get_faqs():
    """
    Returns the list of FAQs for frontend autocomplete/search panel.
    """
    try:
        # Return only questions to keep payload small
        questions = [{"id": i, "question": faq["question"]} for i, faq in enumerate(faqs_data)]
        return jsonify(questions)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Local development server with debug mode
    app.run(host='0.0.0.0', port=5000, debug=True)
