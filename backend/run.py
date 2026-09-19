import uvicorn
from backend.config import API_HOST, API_PORT

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True,
        reload_dirs=["backend"],
        reload_excludes=["*.db", "*.db-*", "*.json", "data/*", "backend/data/*"],
    )
