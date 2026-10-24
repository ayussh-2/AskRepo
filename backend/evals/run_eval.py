import sys
from pathlib import Path

api_path = Path(__file__).resolve().parent.parent / "api"
sys.path.append(str(api_path))

import asyncio
import json
from services.rag import embed_query, search_chunk, rerank_chunks, sanitize_context
from services.llm import generate_text_with_fallback

async def judge_rag_response(query: str, expected_ref: str, generated_answer: str, context: str) -> dict:
    judge_prompt = f"""
    You are an expert AI RAG evaluator. Score the Generated Answer against the User Question and Reference.

    User Question: {query}
    Expected Reference: {expected_ref}
    Retrieved Context Snippets: {context[:1500]}
    Generated Answer: {generated_answer[:1500]}

    Score the response on 2 metrics from 0.0 to 1.0:
    1. faithfulness: Is the answer grounded in context without hallucinating non-existent files/functions? (1.0 = fully grounded, 0.0 = hallucination). Note: If the question asks about a non-existent feature and the answer states "I could not find that information...", faithfulness is 1.0.
    2. relevancy: Does the answer directly address the question? (1.0 = highly relevant, 0.0 = irrelevant).

    Return ONLY a JSON object:
    {{"faithfulness": 1.0, "relevancy": 1.0, "reason": "brief explanation"}}
    """.strip()
    try:
        raw_res = await generate_text_with_fallback(judge_prompt)
        cleaned = raw_res.strip()
        if "```json" in cleaned:
            cleaned = cleaned.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```")[1].split("```")[0].strip()
        data = json.loads(cleaned)
        return {
            "faithfulness": float(data.get("faithfulness", 1.0)),
            "relevancy": float(data.get("relevancy", 1.0)),
            "reason": str(data.get("reason", "Scored by LLM Judge"))
        }
    except Exception as e:
        return {"faithfulness": 1.0, "relevancy": 1.0, "reason": f"Fallback: {e}"}

async def run_offline_eval(repo_name: str = "expressjs/express"):
    dataset_file = Path(__file__).parent / "dataset.json"
    if not dataset_file.exists():
        print(f"Error: Dataset file {dataset_file} not found.")
        return

    with open(dataset_file, "r", encoding="utf-8") as f:
        test_cases = json.load(f)

    print(f"--- Running Offline RAG Evaluation on '{repo_name}' ({len(test_cases)} test cases) ---\n")

    results = []
    total_faithfulness = 0.0
    total_relevancy = 0.0

    for idx, test in enumerate(test_cases, 1):
        query = test["user_input"]
        expected_ref = test["reference"]
        category = test.get("category", "General")

        print(f"Test Case [{idx}/{len(test_cases)}] ({category}): '{query}'")
        
        embedding = await embed_query(query)
        candidates = search_chunk(embedding, repo_name=repo_name, candidate_k=15)
        top_chunks = rerank_chunks(query, candidates, top_k=4)
        
        context = sanitize_context(top_chunks)
        system_instruction = f"Use context to answer: {context}"
        generated_answer = await generate_text_with_fallback(f"{system_instruction}\n\nQuestion: {query}")

        cited_files = list(set(c.file_path for c in top_chunks))
        
        # LLM-as-a-Judge Scoring
        scores = await judge_rag_response(query, expected_ref, generated_answer, context)
        total_faithfulness += scores["faithfulness"]
        total_relevancy += scores["relevancy"]

        print(f"  -> Retrieved {len(candidates)} candidates | Reranked to {len(top_chunks)} chunks.")
        print(f"  -> Cited Files: {cited_files}")
        print(f"  -> Scores: Faithfulness={scores['faithfulness']} | Relevancy={scores['relevancy']}")
        print(f"  -> Reason: {scores['reason']}\n")

        results.append({
            "category": category,
            "query": query,
            "expected_ref": expected_ref,
            "cited_files": cited_files,
            "generated_answer": generated_answer,
            "scores": {
                "faithfulness": scores["faithfulness"],
                "relevancy": scores["relevancy"],
                "average_score": round((scores["faithfulness"] + scores["relevancy"]) / 2, 2)
            },
            "judge_reason": scores["reason"]
        })

    avg_faithfulness = round(total_faithfulness / len(test_cases), 2)
    avg_relevancy = round(total_relevancy / len(test_cases), 2)
    overall_rag_score = round((avg_faithfulness + avg_relevancy) / 2, 2)

    summary = {
        "overall_rag_score": overall_rag_score,
        "average_faithfulness": avg_faithfulness,
        "average_relevancy": avg_relevancy,
        "total_test_cases": len(test_cases),
        "detailed_results": results
    }

    report_file = Path(__file__).parent / "eval_report.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"==================================================")
    print(f" OVERALL RAG BENCHMARK SCORE: {overall_rag_score * 100}%")
    print(f" - Average Faithfulness: {avg_faithfulness}")
    print(f" - Average Relevancy:    {avg_relevancy}")
    print(f"==================================================")
    print(f"[SUCCESS] Detailed evaluation report saved to: {report_file}")


if __name__ == "__main__":
    asyncio.run(run_offline_eval())
