/*
 * Global namespace representing physics engine.
 */
namespace Physics {

    /**
     * Represents a 3D vector.
     */
    struct Vector3 {
        float x, y, z;

        // Calculates magnitude.
        float magnitude() {
            return 0.0f;
        }
    };

    /// Calculates the dot product returning a pointer to avoid copies.
    /// Tests the pointer_declarator name bug!
    float* calculateDotProduct(Vector3* a, Vector3* b) {
        return nullptr;
    }
}