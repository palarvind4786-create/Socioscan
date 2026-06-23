/**
 * ENGINE A: Topic Classifier
 * Determines the primary subject category of a social media post.
 * PHASE 2 — The "What" engine.
 *
 * Uses Hugging Face zero-shot classification (facebook/bart-large-mnli)
 * to understand actual meaning instead of simple keyword matching.
 * Falls back to keyword matching if the API is unavailable.
 */

const axios = require('axios');

// ── Hugging Face Config ──────────────────────────────────────────────────────
const HF_API_URL =
    'https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli';

// The candidate labels the model will classify against
const CANDIDATE_LABELS = [
    'Civic Issue',
    'Crime / Violence',
    'Self-Harm / Depression',
    'Cyberbullying / Harassment',
    'Emergency / Disaster',
];

// ── Fallback: Legacy keyword dictionaries (used when API is down) ────────────
const TOPIC_KEYWORDS = {
    'Self-Harm / Depression': [
        'suicide', 'kill myself', 'end it all', 'give up', 'no reason to live',
        'want to die', 'can\'t go on', 'hopeless', 'worthless', 'bridge',
        'overdose', 'cutting', 'self harm', 'depression', 'nothing to live for',
        'don\'t want to live', 'live anymore',
    ],
    'Crime / Violence': [
        'murder', 'kill', 'shoot', 'stab', 'attack', 'assault', 'robbery',
        'theft', 'gun', 'weapon', 'knife', 'threat', 'violence', 'gang',
        'kidnap', 'abduct', 'rape', 'molest',
    ],
    'Emergency / Disaster': [
        'crash', 'fire', 'explosion', 'earthquake', 'flood', 'accident',
        'ambulance', 'bleeding', 'injured', 'hospital', 'trapped', 'rescue',
        'shooter', 'bomb', 'disaster',
    ],
    'Cyberbullying / Harassment': [
        'bully', 'bullying', 'harass', 'threatening', 'stalking', 'stalk',
        'following me', 'creep', 'abuse', 'abusive', 'toxic', 'blackmail',
        'threaten', 'scare', 'intimidate',
    ],
    'Civic Issue': [
        'pothole', 'road', 'street', 'municipality', 'water', 'electricity',
        'sewage', 'garbage', 'corrupt', 'authority', 'government', 'police',
        'complaint', 'broken', 'infrastructure', 'traffic', 'lights',
    ],
    'General Complaint': [], // Catch-all
};

/**
 * PRIMARY METHOD: Calls Hugging Face zero-shot classification API.
 * The model understands meaning, context, and nuance — not just keywords.
 *
 * @param {string} text - Cleaned post text
 * @returns {Promise<{ primaryTopic: string, topicConfidence: number }>}
 */
const classifyWithNLP = async (text) => {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
        throw new Error('HUGGINGFACE_API_KEY is not set in .env');
    }

    const response = await axios.post(
        HF_API_URL,
        {
            inputs: text,
            parameters: {
                candidate_labels: CANDIDATE_LABELS,
            },
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000, // 15s timeout (model may cold-start on first call)
        }
    );

    // HF router returns an array of objects: [{ label: "...", score: 0.94 }, ...]
    const data = response.data;
    let topLabel = 'General Complaint';
    let topScore = 0;

    if (Array.isArray(data) && data.length > 0) {
        // The results are already sorted by score conceptually, but we can verify or just take data[0]
        topLabel = data[0].label;
        topScore = data[0].score;
    } else if (data && data.labels && data.scores) {
        // Fallback for old formatting just in case
        topLabel = data.labels[0];
        topScore = data.scores[0];
    }

    // If the model isn't confident about any specific topic, default it to General Complaint.
    if (topScore < 0.35) {
        topLabel = 'General Complaint';
    }

    return {
        primaryTopic: topLabel,
        topicConfidence: parseFloat(topScore.toFixed(2)),
    };
};

/**
 * FALLBACK METHOD: Original keyword matching (used if API fails).
 * @param {string} cleanedText
 * @param {string[]} tokens
 * @returns {{ primaryTopic: string, topicConfidence: number }}
 */
const classifyWithKeywords = (cleanedText, tokens) => {
    let bestTopic = 'General Complaint';
    let highestScore = 0;

    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
        if (keywords.length === 0) continue;

        let matchCount = 0;
        for (const keyword of keywords) {
            if (cleanedText.includes(keyword)) matchCount++;
        }

        if (matchCount > highestScore) {
            highestScore = matchCount;
            bestTopic = topic;
        }
    }

    const confidence = Math.min(highestScore / 3, 1.0);
    return {
        primaryTopic: bestTopic,
        topicConfidence: parseFloat(confidence.toFixed(2)),
    };
};

/**
 * Main classification function.
 * Tries NLP first, falls back to keywords if API is unavailable.
 *
 * @param {string} cleanedText - Preprocessed text
 * @param {string[]} tokens - Tokenized text (used by fallback only)
 * @returns {Promise<{ primaryTopic: string, topicConfidence: number }>}
 */
const classifyTopic = async (cleanedText, tokens) => {
    try {
        const result = await classifyWithNLP(cleanedText);
        console.log(`[TopicClassifier] NLP classified: "${result.primaryTopic}" (confidence: ${result.topicConfidence})`);
        return result;
    } catch (error) {
        console.warn(`[TopicClassifier] NLP API failed, using keyword fallback. Reason: ${error.message}`);
        return classifyWithKeywords(cleanedText, tokens);
    }
};

module.exports = { classifyTopic };
