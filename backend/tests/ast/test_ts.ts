/**
 * Interface representing a user.
 */
export interface User {
    id: string;
}

/**
 * Manages user state.
 */
export class UserManager {
    /** Creates a new user object. */
    public createUser(): User {
        return { id: "1" };
    }
}

// Arrow function mapped to a lexical_declaration
// The extractor should capture "fetchData" as the name
export const fetchData = async () => {
    return true;
};
