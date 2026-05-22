"""Module-level orphan docstring."""

class DatabaseHandler:
    """
    Handles all database connections.
    Should be treated as a parent symbol.
    """

    def connect(self, uri: str):
        """Connects to the database securely."""
        self.uri = uri

    def _hidden(self):
        # This is just a standard comment, NOT a docstring.
        # Extractor should return "" for docstring here.
        pass