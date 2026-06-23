/**
 * ENGINE B: Emotion Intensity Scorer (AI-Powered)
 * Uses Hugging Face's emotion classification model to detect real emotions.
 * Falls back to keyword matching if the API is unavailable.
 *
 * Model: j-hartmann/emotion-english-distilroberta-base
 * Outputs: anger, disgust, fear, joy, sadness, surprise, neutral
 *
 * Schema Mapping:
 *   Model Output  →  Your Schema
 *   anger         →  anger
 *   fear          →  fear
 *   sadness       →  sadness + despair (despair = deep sadness, derived)
 *   joy           →  joy
 *   disgust       →  disgust (replaces old "annoyance")
 *   surprise      →  surprise (new)
 *   neutral       →  neutral (new)
 */

const axios = require('axios');

// ── Hugging Face Config ──────────────────────────────────────────────────────
const HF_EMOTION_URL =
    'https://router.huggingface.co/hf-inference/models/j-hartmann/emotion-english-distilroberta-base';

// ── Fallback: Legacy keyword dictionaries ────────────────────────────────────
const EMOTION_KEYWORDS = {
    anger: [
        'furious', 'angry', 'rage', 'kill', 'hate', 'livid', 'outraged',
        'mad', 'infuriated', 'violent', 'destroy', 'murder', 'burn',
    ],
    fear: [
        'scared', 'terrified', 'afraid', 'fear', 'panic', 'horrified',
        'threat', 'danger', 'unsafe', 'following me', 'help me', 'please help',
    ],
    sadness: [
        'sad', 'cry', 'crying', 'tears', 'heartbroken', 'depressed',
        'lonely', 'alone', 'miss', 'grief', 'hurt', 'pain',
    ],
    despair: [
        'hopeless', 'worthless', 'no point', 'give up', 'end it all',
        'can\'t go on', 'no reason', 'tired of everything', 'broken',
        'done with life', 'want to die', 'nothing matters', 'don\'t want to live',
        'tired', 'exhausted', 'live anymore',
    ],
    disgust: [
        'disgusting', 'revolting', 'sick', 'vile', 'gross', 'nasty',
        'annoying', 'irritating', 'frustrated', 'ugh', 'stupid',
        'ridiculous', 'absurd', 'useless', 'pathetic',
    ],
    joy: [
        'happy', 'love', 'great', 'amazing', 'fantastic', 'wonderful',
        'grateful', 'awesome', 'excited', 'glad',
    ],
    surprise: [
        'shocked', 'unbelievable', 'unexpected', 'wow', 'omg',
        'can\'t believe', 'what the', 'no way', 'sudden',
    ],
    neutral: [],
};

// VOLATILITY_THRESHOLD: score above this is considered "high risk"
const HIGH_RISK_THRESHOLD = 0.65;

// ── Despair Derivation Keywords ──────────────────────────────────────────────
// When sadness is high AND these phrases are present, inflate the despair score
const DESPAIR_AMPLIFIERS = [
    'don\'t want to live', 'want to die', 'end it all', 'no point',
    'give up', 'can\'t go on', 'done with life', 'nothing matters',
    'no reason to live', 'hopeless', 'worthless', 'live anymore',
    'tired of everything', 'kill myself', 'suicide',
];

/**
 * Derives a "despair" score from sadness + contextual amplifiers.
 * Despair = deep, existential sadness — critical for self-harm detection.
 *
 * @param {number} sadnessScore - The model's sadness probability
 * @param {string} text - Original cleaned text
 * @returns {number} - Despair score (0.0 → 1.0)
 */
const deriveDespairScore = (sadnessScore, text) => {
    const lowerText = text.toLowerCase();
    const amplifierHits = DESPAIR_AMPLIFIERS.filter((phrase) =>
        lowerText.includes(phrase)
    ).length;

    if (amplifierHits === 0) {
        // No despair language found → despair is just a fraction of sadness
        return parseFloat((sadnessScore * 0.3).toFixed(2));
    }

    // Scale despair based on sadness intensity + number of amplifier matches
    // More amplifier hits = higher despair multiplier (capped at 1.0)
    const amplifierBoost = Math.min(amplifierHits * 0.2, 0.5);
    const despairScore = Math.min(sadnessScore + amplifierBoost, 1.0);

    return parseFloat(despairScore.toFixed(2));
};

/**
 * PRIMARY METHOD: Calls Hugging Face emotion classification API.
 * The model understands actual emotional content — not just keywords.
 *
 * @param {string} text - Cleaned post text
 * @returns {Promise<{ emotions, dominantEmotion, dominantEmotionScore, volatilityFlag, analysisMethod }>}
 */
const scoreEmotionsWithNLP = async (text) => {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
        throw new Error('HUGGINGFACE_API_KEY is not set in .env');
    }

    const response = await axios.post(
        HF_EMOTION_URL,
        { inputs: text },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        }
    );

    // Response format: [[{label: "sadness", score: 0.92}, {label: "anger", score: 0.03}, ...]]
    const data = response.data;
    let predictions = [];

    if (Array.isArray(data) && Array.isArray(data[0])) {
        predictions = data[0]; // Nested array format
    } else if (Array.isArray(data)) {
        predictions = data; // Flat array format
    } else {
        throw new Error('Unexpected API response format');
    }

    // Build scores object from model output
    const modelScores = {};
    for (const pred of predictions) {
        modelScores[pred.label.toLowerCase()] = parseFloat(pred.score.toFixed(2));
    }

    // Map model outputs to our schema
    const emotions = {
        anger:    modelScores['anger'] || 0,
        fear:     modelScores['fear'] || 0,
        sadness:  modelScores['sadness'] || 0,
        despair:  deriveDespairScore(modelScores['sadness'] || 0, text),
        disgust:  modelScores['disgust'] || 0,
        joy:      modelScores['joy'] || 0,
        surprise: modelScores['surprise'] || 0,
        neutral:  modelScores['neutral'] || 0,
    };

    // Find dominant emotion (exclude neutral from dominance — neutral isn't "dominant")
    const emotionalScores = { ...emotions };
    delete emotionalScores.neutral;

    const dominantEmotion = Object.keys(emotionalScores).reduce((a, b) =>
        emotionalScores[a] > emotionalScores[b] ? a : b
    );
    const dominantEmotionScore = emotionalScores[dominantEmotion];

    // Volatility: 2+ emotions above threshold
    const highRiskCount = Object.values(emotionalScores).filter(
        (s) => s >= HIGH_RISK_THRESHOLD
    ).length;
    const volatilityFlag = highRiskCount >= 2;

    return {
        emotions,
        dominantEmotion,
        dominantEmotionScore,
        volatilityFlag,
        analysisMethod: 'nlp',
    };
};

/**
 * FALLBACK METHOD: Original keyword matching (used if API fails).
 * @param {string} cleanedText
 * @returns {{ emotions, dominantEmotion, dominantEmotionScore, volatilityFlag, analysisMethod }}
 */
const scoreEmotionsWithKeywords = (cleanedText) => {
    const scores = {};

    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
        if (keywords.length === 0) {
            scores[emotion] = 0;
            continue;
        }
        let matchCount = 0;
        for (const kw of keywords) {
            if (cleanedText.includes(kw)) matchCount++;
        }
        scores[emotion] = parseFloat(Math.min(matchCount / 4, 1.0).toFixed(2));
    }

    // Find dominant emotion (exclude neutral)
    const emotionalScores = { ...scores };
    delete emotionalScores.neutral;

    const dominantEmotion = Object.keys(emotionalScores).reduce((a, b) =>
        emotionalScores[a] > emotionalScores[b] ? a : b
    );
    const dominantEmotionScore = emotionalScores[dominantEmotion];

    const highRiskCount = Object.values(emotionalScores).filter(
        (s) => s >= HIGH_RISK_THRESHOLD
    ).length;
    const volatilityFlag = highRiskCount >= 2;

    return {
        emotions: scores,
        dominantEmotion,
        dominantEmotionScore,
        volatilityFlag,
        analysisMethod: 'keyword_fallback',
    };
};

/**
 * Main emotion scoring function.
 * Tries NLP first, falls back to keywords if API is unavailable.
 *
 * @param {string} cleanedText - Preprocessed text
 * @returns {Promise<{ emotions, dominantEmotion, dominantEmotionScore, volatilityFlag, analysisMethod }>}
 */
const scoreEmotions = async (cleanedText) => {
    try {
        const result = await scoreEmotionsWithNLP(cleanedText);
        console.log(`[EmotionScorer] NLP detected: "${result.dominantEmotion}" (score: ${result.dominantEmotionScore})`);
        return result;
    } catch (error) {
        console.warn(`[EmotionScorer] NLP API failed, using keyword fallback. Reason: ${error.message}`);
        return scoreEmotionsWithKeywords(cleanedText);
    }
};

module.exports = { scoreEmotions };
