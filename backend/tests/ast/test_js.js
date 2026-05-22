/**
 * Helper utility class.
 */
export class StringFormatter {
    /** * Formats the string by trimming whitespace.
     */
    formatText(str) {
        return str.trim();
    }
}

// Standard function declaration
export function initializeApp() {
    console.log("App started");
}

/** * Calculates the total of two numbers.
 * This tests the lexical_declaration -> variable_declarator logic.
 */
export const calculateTotal = (a, b) => {
    return a + b;
};

// Tests the destructuring fix! If your code doesn't crash here, it works.
const { config, env } = getEnvironmentVariables();
