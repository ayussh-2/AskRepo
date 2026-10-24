import os
import sys

# Ensure worker/ is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from lib.ast_parser import parse_directory, save_ast_results_to_json

utils_dir = os.path.dirname(os.path.abspath(__file__))
dir = os.path.abspath(os.path.join(utils_dir, "..", "tests", "ast"))

def test_ast():
    ast_results, text_results = parse_directory(dir)
    save_ast_results_to_json(ast_results, dir)
    print("ok")

if __name__ == "__main__":
    test_ast()
