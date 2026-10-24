-include backend/api/.env
-include .env

DOCKER_USER ?= ayush91101
DOCKER_IMAGE ?= askrepo-api
DOCKER_TAG ?= latest
FULL_IMAGE = $(DOCKER_USER)/$(DOCKER_IMAGE):$(DOCKER_TAG)

.PHONY: dev dev-api dev-worker deploy-embed dev-web eval migrate docker-build docker-push docker-run test-api test-ast

dev: dev-api

dev-api:
	cd backend/api && python -m uvicorn main:app --reload --port 8000

dev-worker:
	cd backend/worker && python cli.py --repo-url $(repo)

deploy-embed:
	cd backend/embed-service && python -m modal deploy embed_app.py

dev-web:
	cd web && bun dev

eval:
	python backend/evals/run_eval.py

migrate:
	python backend/scripts/migrate.py

test-api:
	python -m pytest backend/api/tests/test_rag_pure.py -v

test-ast:
	python backend/worker/scripts/test_ast.py

docker-build:
	docker build -t $(FULL_IMAGE) ./backend/api

docker-push: docker-build
	docker push $(FULL_IMAGE)

docker-run:
	docker run -d -p 8000:8000 --env-file backend/api/.env --name askrepo-api $(FULL_IMAGE)
