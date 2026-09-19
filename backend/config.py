import os

DATASET_BASE_PATH = os.getenv('DATASET_BASE_PATH', r'c:\projects\PC\dataset\data-and-readme')
SQLITE_DB_PATH = os.getenv('SQLITE_DB_PATH', r'c:\projects\PC\backend\data\pragya_chakshu.db')
NEO4J_URI = os.getenv('NEO4J_URI', 'bolt://localhost:7687')
NEO4J_USER = os.getenv('NEO4J_USER', 'neo4j')
NEO4J_PASSWORD = os.getenv('NEO4J_PASSWORD', 'pragya_chakshu')
API_HOST = os.getenv('API_HOST', '0.0.0.0')
API_PORT = int(os.getenv('API_PORT', 8000))
