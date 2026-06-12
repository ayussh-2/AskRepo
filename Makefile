dev:
	cd backend && fastapi dev

freeze:
	cd backend && pip freeze > requirements.txt

dev-frontend:
	cd frontend && bun dev