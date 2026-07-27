.PHONY: dev dev-api dev-worker deploy-embed dev-frontend dev-webapp

dev: dev-api

dev-api:
	cd api && python -m uvicorn main:app --reload --port 8000

dev-worker:
	cd worker && python cli.py --repo-url $(repo)

deploy-embed:
	cd embed-service && python -m modal deploy embed_app.py

dev-frontend:
	cd frontend && bun dev

dev-webapp:
	cd webapp && npm start