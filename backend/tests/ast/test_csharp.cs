using System;

/// <summary>
/// Root namespace for the application core.
/// </summary>
namespace App.Core
{
    /// <summary>
    /// Defines the base repository operations.
    /// </summary>
    public interface IRepository {
        void Save();
    }

    /**
     * Main data service implementation.
     */
    public class DataService : IRepository
    {
        // Creates the data service instance.
        public DataService() {
        }

        /// <summary>
        /// Saves the current state to the database.
        /// </summary>
        public void Save() {
            Console.WriteLine("Saving...");
        }
    }
}