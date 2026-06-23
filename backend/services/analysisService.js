/**
 * Analysis Service — Master Orchestrator
 * Runs the full 4-Phase pipeline on a given post text.
 * This is what the controller calls: it returns the complete analysis object.
 *
 * Updated: Both scoreEmotions() and runFilters() are now async (AI-powered).
 */

const { preprocessText } = require('../utils/preprocessor');
const { classifyTopic } = require('../ai-engine/engines/topicClassifier');
const { scoreEmotions } = require('../ai-engine/engines/emotionScorer');
const { runFilters } = require('../ai-engine/filters/filterLayer');
const { calculateSeverity } = require('../ai-engine/filters/riskEngine');

/**
 * Full AI analysis pipeline for a single post.
 * @param {string} rawText - The original social media post
 * @returns {object} - Complete analysis result ready to be stored in MongoDB
 */
const analyzePost = async (rawText) => {
    // ── PHASE 1: Preprocessing ───────────────────────────────────────────────
    const { cleanedText, tokens } = preprocessText(rawText);

    // ── PHASE 2: Dual Engine Assessment (Both are now AI-powered) ───────────
    // Run topic classification and emotion scoring in parallel for speed
    const [topicResult, emotionResult] = await Promise.all([
        classifyTopic(cleanedText, tokens),
        scoreEmotions(cleanedText),
    ]);

    const { primaryTopic, topicConfidence } = topicResult;
    const {
        emotions,
        dominantEmotion,
        dominantEmotionScore,
        volatilityFlag,
        analysisMethod: emotionMethod,
    } = emotionResult;

    // ── PHASE 3: Filter Layer (Now AI-powered) ──────────────────────────────
    const {
        isHyperbole,
        hasEmergencyEntity,
        hasSpecificTarget,
        detectedEntities,
        filterMethod,
    } = await runFilters(cleanedText);

    // ── PHASE 4: Severity Calculation ────────────────────────────────────────
    const { severityLevel, severityScore } = calculateSeverity({
        primaryTopic,
        topicConfidence,
        dominantEmotion,
        dominantEmotionScore,
        volatilityFlag,
        isHyperbole,
        hasEmergencyEntity,
        hasSpecificTarget,
    });

    // Determine overall analysis method
    const analysisMethod = emotionMethod === 'nlp' && filterMethod === 'nlp'
        ? 'nlp'
        : emotionMethod === 'nlp' || filterMethod === 'nlp'
            ? 'partial_nlp'
            : 'keyword_fallback';

    // ── Return full analysis result ──────────────────────────────────────────
    return {
        originalText: rawText,
        cleanedText,
        tokens,
        primaryTopic,
        topicConfidence,
        emotions,
        dominantEmotion,
        dominantEmotionScore,
        volatilityFlag,
        isHyperbole,
        hasEmergencyEntity,
        hasSpecificTarget,
        detectedEntities,
        severityLevel,
        severityScore,
        analysisMethod,
    };
};

module.exports = { analyzePost };
