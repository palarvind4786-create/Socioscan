/**
 * PHASE 1: Text Preprocessor
 * Cleans and tokenizes raw social media text before NLP analysis.
 */

const STOP_WORDS = new Set([
    'i', 'me', 'my', 'the', 'a', 'an', 'is', 'it', 'to',
    'and', 'or', 'for', 'of', 'in', 'on', 'at', 'with', 'are',
    'was', 'this', 'that', 'they', 'we', 'you', 'he', 'she',
    'not', 'but', 'so', 'as', 'by', 'from', 'be', 'have', 'has',
]);

/**
 * Cleans the raw text by removing URLs, special characters, emojis.
 * @param {string} text - Raw post text
 * @returns {string} - Cleaned text
 */
const cleanText = (text) => {
    return text
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, '')       // Remove URLs
        .replace(/[^\w\s]/g, ' ')             // Remove punctuation & emojis
        .replace(/\s+/g, ' ')                 // Collapse multiple spaces
        .trim();
};

/**
 * Tokenizes and removes stop words from cleaned text.
 * @param {string} cleanedText
 * @returns {string[]} - Array of meaningful tokens
 */
const tokenize = (cleanedText) => {
    return cleanedText
        .split(' ')
        .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
};

/**
 * Full preprocessing pipeline.
 * @param {string} rawText
 * @returns {{ cleanedText: string, tokens: string[] }}
 */
const preprocessText = (rawText) => {
    const cleanedText = cleanText(rawText);
    const tokens = tokenize(cleanedText);
    return { cleanedText, tokens };
};

module.exports = { preprocessText, cleanText, tokenize };
