.PHONY: dev dev-api dev-worker deploy-embed dev-frontend dev-webapp migrate

dev: dev-api

dev-api:
	cd api && python -m uvicorn main:app --reload --port 8000

dev-worker:
	cd worker && python cli.py --repo-url $(repo)

deploy-embed:
	cd embed-service && python -m modal deploy embed_app.py

dev-extension:
	cd frontend/extension && bun dev

dev-web:
	cd frontend/web && bun dev

migrate:
	python scripts/migrate.py