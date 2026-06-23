/**
 * PHASE 4: Risk Assessment & Severity Engine
 * Combines Topic + Emotion + Filter results to produce the final severity level.
 *
 * Updated: Now handles expanded emotion schema (8 emotions including despair, disgust, surprise, neutral).
 */

const THREAT_TOPICS = [
    'Crime / Violence',
    'Self-Harm / Depression',
    'Emergency / Disaster',
    'Cyberbullying / Harassment',
];

const CIVIC_TOPICS = ['Civic Issue', 'General Complaint'];

// High-risk emotions for severity escalation
const HIGH_RISK_EMOTIONS = ['anger', 'fear', 'despair', 'sadness', 'disgust'];
const EMOTION_HIGH_THRESHOLD = 0.65;

// Critical emotions specifically tied to self-harm / violence
const CRITICAL_EMOTIONS = ['despair', 'fear', 'anger'];

/**
 * Core rules engine — applies the Full Severity Matrix.
 * @param {object} params
 * @returns {{ severityLevel: string, severityScore: number }}
 */
const calculateSeverity = ({
    primaryTopic,
    topicConfidence,
    dominantEmotion,
    dominantEmotionScore,
    volatilityFlag,
    isHyperbole,
    hasEmergencyEntity,
    hasSpecificTarget,
}) => {
    // ── RULE 1: Emergency Entity Bypass ─────────────────────────────────────
    // A factual emergency keyword + location = CRITICAL regardless of emotion.
    if (hasEmergencyEntity) {
        return { severityLevel: 'Critical', severityScore: 4 };
    }

    // ── RULE 2: Positive / Neutral Emotion = LOW (Early Exit) ─────────────
    // If the dominant emotion is joy, surprise, or neutral — no threat.
    if (['joy', 'surprise', 'neutral'].includes(dominantEmotion)) {
        return { severityLevel: 'Low', severityScore: 1 };
    }

    // ── RULE 3: Threat Topic + Hyperbole = Downgrade to LOW ─────────────────
    // e.g., "My wifi is so bad I want to kill someone" → Not a real threat.
    if (isHyperbole && THREAT_TOPICS.includes(primaryTopic)) {
        return { severityLevel: 'Low', severityScore: 1 };
    }

    // ── RULE 4: Civic Complaint + Very High *Negative* Emotion = MEDIUM ─────
    // e.g., "I'm furious, the road has been broken for weeks!"
    if (CIVIC_TOPICS.includes(primaryTopic)) {
        if (
            HIGH_RISK_EMOTIONS.includes(dominantEmotion) &&
            dominantEmotionScore >= EMOTION_HIGH_THRESHOLD
        ) {
            return { severityLevel: 'Medium', severityScore: 2 };
        }
        return { severityLevel: 'Low', severityScore: 1 };
    }

    // ── RULE 5: Self-Harm Topic + Despair = CRITICAL ────────────────────────
    // e.g., "I am very tired and don't want to live anymore"
    // Despair is specifically derived for self-harm detection scenarios.
    if (
        primaryTopic === 'Self-Harm / Depression' &&
        (dominantEmotion === 'despair' || dominantEmotion === 'sadness') &&
        dominantEmotionScore >= 0.50  // Lower threshold for self-harm
    ) {
        return { severityLevel: 'Critical', severityScore: 4 };
    }

    // ── RULE 6: Threat Topic + High Emotion + Specific Target = CRITICAL ────
    // e.g., "I know where he lives and I'm going to hurt him tonight."
    if (
        THREAT_TOPICS.includes(primaryTopic) &&
        HIGH_RISK_EMOTIONS.includes(dominantEmotion) &&
        dominantEmotionScore >= EMOTION_HIGH_THRESHOLD &&
        hasSpecificTarget
    ) {
        return { severityLevel: 'Critical', severityScore: 4 };
    }

    // ── RULE 7: Volatility Multiplier — 2+ High Emotions = CRITICAL ─────────
    // e.g., Fear(0.90) + Anger(0.88) both found = emotionally volatile
    if (
        THREAT_TOPICS.includes(primaryTopic) &&
        HIGH_RISK_EMOTIONS.includes(dominantEmotion) &&
        dominantEmotionScore >= EMOTION_HIGH_THRESHOLD &&
        volatilityFlag
    ) {
        return { severityLevel: 'Critical', severityScore: 4 };
    }

    // ── RULE 8: Threat Topic + Critical Emotion (High) = HIGH ────────────────
    // e.g., High despair + self-harm topic but no specific target
    if (
        THREAT_TOPICS.includes(primaryTopic) &&
        CRITICAL_EMOTIONS.includes(dominantEmotion) &&
        dominantEmotionScore >= EMOTION_HIGH_THRESHOLD
    ) {
        return { severityLevel: 'High', severityScore: 3 };
    }

    // ── RULE 9: Threat Topic + Any High Emotion = HIGH ──────────────────────
    // e.g., High disgust + crime topic
    if (
        THREAT_TOPICS.includes(primaryTopic) &&
        HIGH_RISK_EMOTIONS.includes(dominantEmotion) &&
        dominantEmotionScore >= EMOTION_HIGH_THRESHOLD
    ) {
        return { severityLevel: 'High', severityScore: 3 };
    }

    // ── RULE 10: Threat Topic + Moderate Emotion = MEDIUM ───────────────────
    if (THREAT_TOPICS.includes(primaryTopic)) {
        return { severityLevel: 'Medium', severityScore: 2 };
    }

    // ── DEFAULT: Low ──────────────────────────────────────────────────────────
    return { severityLevel: 'Low', severityScore: 1 };
};

module.exports = { calculateSeverity };
