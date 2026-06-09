dev:
	cd backend && fastapi dev

freeze:
	cd backend && pip freeze > requirements.txt
