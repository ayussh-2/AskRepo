import sys
import os
from pathlib import Path

# Add api directory to sys.path
api_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(api_dir))

import pytest
from db.models import RepoChunk
from services.rag import (
    sanitize_context,
    determine_dynamic_top_k,
    rerank_chunks_sync,
    build_retrieval_query,
    extract_query_identifiers,
    build_system_instruction,
    estimate_tokens,
)

def make_chunk(id_num: int, file_path: str, symbol_name: str, text: str) -> RepoChunk:
    return RepoChunk(
        id=id_num,
        repo_name="test/repo",
        commit_sha="abc1234",
        file_path=file_path,
        symbol_name=symbol_name,
        chunk_text=text,
        embedding=None,
    )

# ---------------------------------------------------------------------------
# 1. sanitize_context tests
# ---------------------------------------------------------------------------
def test_sanitize_context_empty():
    assert sanitize_context([]) == ""

def test_sanitize_context_does_not_break_on_large_first_file():
    # If first file has a huge snippet, it should truncate snippet rather than returning empty!
    chunk1 = make_chunk(1, "big_file.py", "BigClass", "A" * 15000)
    chunk2 = make_chunk(2, "small_file.py", "small_func", "def small_func(): return True")

    result = sanitize_context([chunk1, chunk2], max_chars=12000)
    assert len(result) > 0
    assert "[FILE] big_file.py" in result
    assert "[SYMBOLS] BigClass" in result
    assert "... [truncated]" in result
    assert len(result) <= 13000

def test_sanitize_context_packs_multiple_files_and_deduplicates():
    chunk1 = make_chunk(1, "file1.py", "func1", "def func1(): pass")
    chunk2 = make_chunk(2, "file1.py", "func2", "def func2(): pass")
    chunk3 = make_chunk(3, "file1.py", "func1", "def func1(): pass")  # duplicate snippet
    chunk4 = make_chunk(4, "file2.py", "func3", "def func3(): return 42")

    result = sanitize_context([chunk1, chunk2, chunk3, chunk4], max_chars=12000)
    assert "[FILE] file1.py" in result
    assert "[FILE] file2.py" in result
    assert "func1, func2" in result
    # Check deduplication: "def func1(): pass" appears only once in file1 section
    assert result.count("def func1(): pass") == 1

def test_sanitize_context_attaches_import_chunks():
    code_chunk = make_chunk(1, "app.py", "main", "def main(): app.run()")
    import_chunk = make_chunk(2, "app.py", "", "import os\nimport sys")
    unrelated_import = make_chunk(3, "other.py", "", "import numpy")

    result = sanitize_context([code_chunk], import_chunks=[import_chunk, unrelated_import], max_chars=12000)
    assert "import os" in result
    assert "import numpy" not in result  # other.py was not selected in code chunks

# ---------------------------------------------------------------------------
# 2. determine_dynamic_top_k tests
# ---------------------------------------------------------------------------
def test_determine_dynamic_top_k_with_explicit_user_k():
    assert determine_dynamic_top_k("explain the architecture", user_top_k=4) == (15, 4)
    assert determine_dynamic_top_k("how does login work?", user_top_k=8) == (24, 8)
    assert determine_dynamic_top_k("anything", user_top_k=2) == (15, 2)

def test_determine_dynamic_top_k_broad_queries():
    broad_queries = [
        "give me an overview of the codebase",
        "explain the architecture of this project",
        "what is the tech stack built with?",
        "what does this repo do?",
        "how does the system pipeline flow?",
        "describe the directory structure",
    ]
    for q in broad_queries:
        candidate_k, top_k = determine_dynamic_top_k(q, user_top_k=None)
        assert (candidate_k, top_k) == (35, 10), f"Failed for query: {q}"

def test_determine_dynamic_top_k_targeted_queries():
    targeted_queries = [
        "where is parse_jwt defined?",
        "how does calculate_tax handle negative amounts?",
        "fix typo in README",
    ]
    for q in targeted_queries:
        candidate_k, top_k = determine_dynamic_top_k(q, user_top_k=None)
        assert (candidate_k, top_k) == (15, 4), f"Failed for query: {q}"

# ---------------------------------------------------------------------------
# 3. rerank_chunks_sync per-file cap & bypass tests
# ---------------------------------------------------------------------------
def test_rerank_chunks_per_file_cap(monkeypatch):
    # Mock ranker returning chunks in original order
    chunks = [
        make_chunk(1, "fileA.py", "f1", "code A1"),
        make_chunk(2, "fileA.py", "f2", "code A2"),
        make_chunk(3, "fileA.py", "f3", "code A3"),
        make_chunk(4, "fileB.py", "f4", "code B1"),
        make_chunk(5, "fileB.py", "f5", "code B2"),
    ]

    class DummyRanker:
        def rerank(self, req):
            return [{"id": i, "score": 1.0 - i * 0.1} for i in range(len(req.passages))]

    import services.rag as rag_mod
    monkeypatch.setattr(rag_mod, "HAS_FLASHRANK", True)
    monkeypatch.setattr(rag_mod, "ranker", DummyRanker())

    # Query has no file name, multiple files exist -> max 2 chunks from fileA!
    results = rerank_chunks_sync("explain how auth works", chunks, top_k=3, max_per_file=2)
    assert len(results) == 3
    fileA_count = sum(1 for c in results if c.file_path == "fileA.py")
    fileB_count = sum(1 for c in results if c.file_path == "fileB.py")
    assert fileA_count == 2  # capped at 2!
    assert fileB_count == 1  # 3rd slot went to fileB!

def test_rerank_chunks_bypass_cap_when_query_names_file(monkeypatch):
    chunks = [
        make_chunk(1, "fileA.py", "f1", "code A1"),
        make_chunk(2, "fileA.py", "f2", "code A2"),
        make_chunk(3, "fileA.py", "f3", "code A3"),
        make_chunk(4, "fileB.py", "f4", "code B1"),
    ]

    class DummyRanker:
        def rerank(self, req):
            return [{"id": i, "score": 1.0 - i * 0.1} for i in range(len(req.passages))]

    import services.rag as rag_mod
    monkeypatch.setattr(rag_mod, "HAS_FLASHRANK", True)
    monkeypatch.setattr(rag_mod, "ranker", DummyRanker())

    # Query explicitly targets fileA.py -> cap is bypassed
    results = rerank_chunks_sync("what is in fileA.py?", chunks, top_k=3, max_per_file=2)
    assert len(results) == 3
    assert all(c.file_path == "fileA.py" for c in results)

def test_rerank_chunks_bypass_cap_when_single_file_results(monkeypatch):
    chunks = [
        make_chunk(1, "single.py", "f1", "code 1"),
        make_chunk(2, "single.py", "f2", "code 2"),
        make_chunk(3, "single.py", "f3", "code 3"),
    ]

    class DummyRanker:
        def rerank(self, req):
            return [{"id": i, "score": 1.0 - i * 0.1} for i in range(len(req.passages))]

    import services.rag as rag_mod
    monkeypatch.setattr(rag_mod, "HAS_FLASHRANK", True)
    monkeypatch.setattr(rag_mod, "ranker", DummyRanker())

    results = rerank_chunks_sync("how does this function work?", chunks, top_k=3, max_per_file=2)
    assert len(results) == 3

# ---------------------------------------------------------------------------
# 4. build_retrieval_query (follow-up contextualization) tests
# ---------------------------------------------------------------------------
def test_build_retrieval_query_contextualizes_short_pronoun_query():
    history = [
        {"role": "user", "content": "What is the UserService class?"},
        {"role": "model", "content": "UserService handles user authentication and registration."},
    ]
    query = "What does it return?"
    retrieval_query = build_retrieval_query(query, history)
    assert "UserService" in retrieval_query
    assert "What does it return?" in retrieval_query

def test_build_retrieval_query_leaves_standalone_query_alone():
    history = [
        {"role": "user", "content": "What is UserService?"},
        {"role": "model", "content": "UserService handles user authentication."},
    ]
    query = "Explain how PostgreSQL connection pooling is configured in db.py"
    retrieval_query = build_retrieval_query(query, history)
    assert retrieval_query == query

def test_build_retrieval_query_empty_history():
    assert build_retrieval_query("How does it work?", []) == "How does it work?"

# ---------------------------------------------------------------------------
# 5. extract_query_identifiers tests
# ---------------------------------------------------------------------------
def test_extract_query_identifiers():
    q1 = "How does `UserService.authenticate` work?"
    assert "authenticate" in extract_query_identifiers(q1) or "UserService" in extract_query_identifiers(q1)

    q2 = "Where is chat_stream_handler called?"
    assert "chat_stream_handler" in extract_query_identifiers(q2)

    q3 = "What does RepoChunk store?"
    assert "RepoChunk" in extract_query_identifiers(q3)

# ---------------------------------------------------------------------------
# 6. build_system_instruction tests
# ---------------------------------------------------------------------------
def test_build_system_instruction_contains_delimiters_and_rules():
    context = "[FILE] main.py\ndef run(): pass"
    prompt = build_system_instruction(context, summary="User previously asked about FastAPI")

    assert "<repository_context>" in prompt
    assert "</repository_context>" in prompt
    assert "[FILE] main.py" in prompt
    assert "Previous Conversation Context Summary:" in prompt
    assert "DO NOT USE MARKDOWN TABLES" in prompt
    assert "### Sources & Citations" in prompt
    assert not prompt.startswith("        ")  # verify inspect.cleandoc stripped leading indentation

# ---------------------------------------------------------------------------
# 7. estimate_tokens caching
# ---------------------------------------------------------------------------
def test_estimate_tokens():
    tokens = estimate_tokens("Hello world from askRepo!")
    assert isinstance(tokens, int)
    assert tokens > 0


# ---------------------------------------------------------------------------
# 8. Row / tuple unwrapping safeguard tests
# ---------------------------------------------------------------------------
def test_sanitize_context_handles_row_tuples():
    chunk1 = make_chunk(1, "app.py", "start", "def start(): pass")
    import_chunk = make_chunk(2, "app.py", "", "import os\nimport sys")

    # Pass as 1-tuples or 2-tuples mimicking raw SQLAlchemy Row objects
    row_chunk = (chunk1,)
    row_import = (import_chunk, 0.42)

    result = sanitize_context([row_chunk], import_chunks=[row_import], max_chars=12000)
    assert "[FILE] app.py" in result
    assert "import os" in result
    assert "def start(): pass" in result


def test_rerank_chunks_handles_row_tuples():
    chunk1 = make_chunk(1, "main.py", "main", "def main(): pass")
    chunk2 = make_chunk(2, "utils.py", "helper", "def helper(): pass")

    row_candidates = [(chunk1, 0.1), (chunk2, 0.2)]
    results = rerank_chunks_sync("tell me about main", row_candidates, top_k=2)
    assert len(results) == 2
    assert results[0].file_path in {"main.py", "utils.py"}
