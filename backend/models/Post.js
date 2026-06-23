const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
    {
        // ── Raw Post Data ────────────────────────────────────────
        originalText: {
            type: String,
            required: true,
            trim: true,
        },
        cleanedText: {
            type: String,
        },
        tokens: [String],
        source: {
            type: String,
            enum: ['twitter', 'reddit', 'facebook', 'manual_upload', 'instagram'],
            default: 'manual_upload',
        },
        uploaderName: {
            type: String,
            trim: true,
        },
        uploaderLocation: {
            type: String,
            trim: true,
        },
        postUrl: {
            type: String,
            trim: true,
        },

        // ── Engine A: Topic Classification ───────────────────────
        primaryTopic: {
            type: String,
            enum: [
                'Civic Issue',
                'Crime / Violence',
                'Self-Harm / Depression',
                'Cyberbullying / Harassment',
                'Emergency / Disaster',
                'General Complaint',
            ],
        },
        topicConfidence: {
            type: Number, // 0.0 - 1.0
            min: 0,
            max: 1,
        },

        // ── Engine B: Emotion Intensity (AI-Powered) ─────────────
        // Expanded to 8 emotions matching the AI model output
        emotions: {
            anger:    { type: Number, default: 0, min: 0, max: 1 },
            fear:     { type: Number, default: 0, min: 0, max: 1 },
            sadness:  { type: Number, default: 0, min: 0, max: 1 },
            despair:  { type: Number, default: 0, min: 0, max: 1 }, // Derived from sadness + context
            disgust:  { type: Number, default: 0, min: 0, max: 1 }, // Replaces old "annoyance"
            joy:      { type: Number, default: 0, min: 0, max: 1 },
            surprise: { type: Number, default: 0, min: 0, max: 1 }, // New from AI model
            neutral:  { type: Number, default: 0, min: 0, max: 1 }, // New from AI model
        },
        dominantEmotion: {
            type: String, // e.g., "fear", "sadness", "despair"
        },
        dominantEmotionScore: {
            type: Number, // e.g., 0.92
            min: 0,
            max: 1,
        },
        // Multiple high emotions? Volatility multiplier is applied
        volatilityFlag: {
            type: Boolean,
            default: false,
        },

        // ── Filter Layer Results ─────────────────────────────────
        isHyperbole: { type: Boolean, default: false },
        hasEmergencyEntity: { type: Boolean, default: false },
        hasSpecificTarget: { type: Boolean, default: false },
        detectedEntities: [String], // e.g., ["Highway 44", "School bus"]

        // ── Final Severity Output ────────────────────────────────
        severityLevel: {
            type: String,
            enum: ['Low', 'Medium', 'High', 'Critical'],
        },
        severityScore: {
            type: Number, // 1=Low, 2=Medium, 3=High, 4=Critical
            min: 1,
            max: 4,
        },

        // ── AI Analysis Metadata ─────────────────────────────────
        analysisMethod: {
            type: String,
            enum: ['nlp', 'partial_nlp', 'keyword_fallback'],
            default: 'keyword_fallback',
        },

        // ── Admin Review Info ────────────────────────────────────
        reviewedByAdmin: { type: Boolean, default: false },
        adminNotes: { type: String },
        isResolved: { type: Boolean, default: false },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt automatically
    }
);

module.exports = mongoose.model('Post', postSchema);
