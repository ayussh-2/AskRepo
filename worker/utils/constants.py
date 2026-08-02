ENCODER_MODEL = "cl100k_base"
MAX_TOKENS = 500
OVERLAP = 50


TEXT_EXTENSIONS = {".md", ".mdx", ".txt", ".rst", ".json", ".yaml", ".yml", ".toml", ".lock"}

IGNORED_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv",
    "venv", "dist", "build", ".next", "coverage",
    "vendor", "target", ".cache", ".turbo", ".idea", ".vscode"
}

# Only ignore binary files that cannot be converted to meaningful text embeddings
IGNORED_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".mov",
    ".zip", ".tar", ".gz", ".pdf", ".exe", ".bin"
}


