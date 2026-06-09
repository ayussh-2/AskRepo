from lib.ast_parser import parse_directory,save_ast_results_to_json

dir = "D:/Projects/Personal/repo-assistant/backend/tests/ast"

def test_ast():
    result = parse_directory(dir)
    save_ast_results_to_json(result,dir)
    print("ok")