-include api/.env
-include .env

DOCKER_USER ?= ayush91101
DOCKER_IMAGE ?= askrepo-api
DOCKER_TAG ?= latest
FULL_IMAGE = $(DOCKER_USER)/$(DOCKER_IMAGE):$(DOCKER_TAG)

.PHONY: dev dev-api dev-worker deploy-embed dev-web eval migrate docker-build docker-push docker-run

dev: dev-api

dev-api:
	cd api && python -m uvicorn main:app --reload --port 8000

dev-worker:
	cd worker && python cli.py --repo-url $(repo)

deploy-embed:
	cd embed-service && python -m modal deploy embed_app.py

dev-web:
	cd web && bun dev

eval:
	python evals/run_eval.py

migrate:

	python scripts/migrate.py

docker-build:
	docker build -t $(FULL_IMAGE) ./api

docker-push: docker-build
	docker push $(FULL_IMAGE)

docker-run:
	docker run -d -p 8000:8000 --env-file api/.env --name askrepo-api-container $(FULL_IMAGE)

	