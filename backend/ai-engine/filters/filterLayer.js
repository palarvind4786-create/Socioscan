/**
 * PHASE 3: Filter & Context Layer (AI-Powered)
 * Uses Hugging Face zero-shot classification (bart-large-mnli) to detect:
 *   - Hyperbole vs genuine distress
 *   - Real emergency vs casual mention
 *   - Targeted threat vs general frustration
 *
 * Falls back to keyword matching if the API is unavailable.
 */

const axios = require('axios');

// ── Hugging Face Config (same model as topicClassifier) ──────────────────────
const HF_API_URL =
    'https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli';

// ── Fallback: Legacy keyword dictionaries ────────────────────────────────────
const TRIVIAL_CONTEXT_WORDS = [
    'internet', 'wifi', 'game', 'gaming', 'lag', 'connection', 'score',
    'match', 'exam', 'assignment', 'food', 'pizza', 'traffic', 'delay',
    'boss', 'coworker', 'colleague', 'professor', 'teacher', 'lecture',
];

const EMERGENCY_ENTITIES = [
    'crash', 'fire', 'explosion', 'shooting', 'shooter', 'stabbing',
    'flood', 'earthquake', 'tsunami', 'bleeding', 'unconscious', 'trapped',
    'bomb', 'ambulance', 'school bus', 'building collapsed',
];

const SPECIFIC_TARGET_INDICATORS = [
    'tonight', 'right now', 'on my way', 'going to his', 'going to her',
    'at school', 'at the office', 'at his house', 'at her house', 'outside',
    'following me right now', 'behind me',
];

// ── NLP Classification Thresholds ────────────────────────────────────────────
const HYPERBOLE_THRESHOLD = 0.55;   // If "exaggeration" label > 55%, it's hyperbole
const EMERGENCY_THRESHOLD = 0.60;   // If "real emergency" label > 60%, it's an emergency
const TARGET_THRESHOLD = 0.55;      // If "threatening a person" label > 55%, has target

/**
 * Calls Hugging Face zero-shot classification with custom hypothesis labels.
 * Reuses the same bart-large-mnli model from topicClassifier.
 *
 * @param {string} text - The text to classify
 * @param {string[]} candidateLabels - Labels to classify against
 * @returns {Promise<Object>} - { labels: [...], scores: [...] }
 */
const classifyZeroShot = async (text, candidateLabels) => {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
        throw new Error('HUGGINGFACE_API_KEY is not set in .env');
    }

    const response = await axios.post(
        HF_API_URL,
        {
            inputs: text,
            parameters: {
                candidate_labels: candidateLabels,
            },
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        }
    );

    const data = response.data;

    // Normalize response format
    if (data && data.labels && data.scores) {
        return data;
    }
    if (Array.isArray(data) && data.length > 0 && data[0].label) {
        return {
            labels: data.map((d) => d.label),
            scores: data.map((d) => d.score),
        };
    }

    throw new Error('Unexpected zero-shot API response format');
};

/**
 * NLP-based hyperbole detection.
 * Asks the model: "Is this text exaggeration/venting or genuine distress?"
 */
const detectHyperboleNLP = async (text) => {
    const result = await classifyZeroShot(text, [
        'exaggeration or venting about everyday problems',
        'genuine emotional distress or real crisis',
    ]);

    const exaggerationIndex = result.labels.indexOf(
        'exaggeration or venting about everyday problems'
    );
    const exaggerationScore = exaggerationIndex >= 0
        ? result.scores[exaggerationIndex]
        : 0;

    return exaggerationScore >= HYPERBOLE_THRESHOLD;
};

/**
 * NLP-based emergency detection.
 * Asks the model: "Is this reporting a real emergency or casual conversation?"
 */
const detectEmergencyNLP = async (text) => {
    const result = await classifyZeroShot(text, [
        'reporting a real emergency or dangerous situation happening now',
        'casual conversation or general discussion',
        'expressing personal feelings or emotions',
    ]);

    const emergencyIndex = result.labels.indexOf(
        'reporting a real emergency or dangerous situation happening now'
    );
    const emergencyScore = emergencyIndex >= 0
        ? result.scores[emergencyIndex]
        : 0;

    return {
        hasEmergency: emergencyScore >= EMERGENCY_THRESHOLD,
        emergencyScore,
    };
};

/**
 * NLP-based specific target detection.
 * Asks the model: "Is this threatening a specific person or general frustration?"
 */
const detectTargetNLP = async (text) => {
    const result = await classifyZeroShot(text, [
        'threatening or planning to harm a specific person',
        'expressing general frustration or anger',
        'describing a past event or situation',
    ]);

    const targetIndex = result.labels.indexOf(
        'threatening or planning to harm a specific person'
    );
    const targetScore = targetIndex >= 0
        ? result.scores[targetIndex]
        : 0;

    return targetScore >= TARGET_THRESHOLD;
};

/**
 * PRIMARY METHOD: AI-powered filter analysis.
 * Runs all three checks using NLP zero-shot classification.
 *
 * @param {string} cleanedText
 * @returns {Promise<{ isHyperbole, hasEmergencyEntity, hasSpecificTarget, detectedEntities, filterMethod }>}
 */
const runFiltersWithNLP = async (cleanedText) => {
    // Run all three NLP checks in parallel for speed
    const [isHyperbole, emergencyResult, hasSpecificTarget] = await Promise.all([
        detectHyperboleNLP(cleanedText),
        detectEmergencyNLP(cleanedText),
        detectTargetNLP(cleanedText),
    ]);

    // Entity extraction: still use keyword matching for entity names
    // (NLP tells us IF there's an emergency; keywords tell us WHAT entities)
    const detectedEntities = [];
    for (const entity of EMERGENCY_ENTITIES) {
        if (cleanedText.includes(entity)) {
            detectedEntities.push(entity);
        }
    }

    // Location pattern detection (kept from original)
    const locationPattern = /\b(highway|street|road|bridge|avenue|school|hospital)\b/;
    const hasLocation = locationPattern.test(cleanedText);
    if (hasLocation) detectedEntities.push('location_entity_detected');

    return {
        isHyperbole,
        hasEmergencyEntity: emergencyResult.hasEmergency || detectedEntities.length > 0,
        hasSpecificTarget,
        detectedEntities,
        filterMethod: 'nlp',
    };
};

/**
 * FALLBACK METHOD: Original keyword matching (used if API fails).
 * @param {string} cleanedText
 * @returns {{ isHyperbole, hasEmergencyEntity, hasSpecificTarget, detectedEntities, filterMethod }}
 */
const runFiltersWithKeywords = (cleanedText) => {
    const isHyperbole = TRIVIAL_CONTEXT_WORDS.some((word) =>
        cleanedText.includes(word)
    );

    const detectedEntities = [];
    const hasEmergencyEntity = EMERGENCY_ENTITIES.some((entity) => {
        if (cleanedText.includes(entity)) {
            detectedEntities.push(entity);
            return true;
        }
        return false;
    });

    const locationPattern = /\b(highway|street|road|bridge|avenue|school|hospital)\b/;
    const hasLocation = locationPattern.test(cleanedText);
    if (hasLocation) detectedEntities.push('location_entity_detected');

    const hasSpecificTarget = SPECIFIC_TARGET_INDICATORS.some((indicator) =>
        cleanedText.includes(indicator)
    );

    return {
        isHyperbole,
        hasEmergencyEntity: hasEmergencyEntity || (hasEmergencyEntity && hasLocation),
        hasSpecificTarget,
        detectedEntities,
        filterMethod: 'keyword_fallback',
    };
};

/**
 * Main filter function.
 * Tries NLP first, falls back to keywords if API is unavailable.
 *
 * @param {string} cleanedText - Preprocessed text
 * @returns {Promise<{ isHyperbole, hasEmergencyEntity, hasSpecificTarget, detectedEntities, filterMethod }>}
 */
const runFilters = async (cleanedText) => {
    try {
        const result = await runFiltersWithNLP(cleanedText);
        console.log(`[FilterLayer] NLP analysis — Hyperbole: ${result.isHyperbole}, Emergency: ${result.hasEmergencyEntity}, Target: ${result.hasSpecificTarget}`);
        return result;
    } catch (error) {
        console.warn(`[FilterLayer] NLP API failed, using keyword fallback. Reason: ${error.message}`);
        return runFiltersWithKeywords(cleanedText);
    }
};

module.exports = { runFilters };
