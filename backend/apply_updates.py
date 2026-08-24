import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

def main():
    load_dotenv(dotenv_path=".env.local")
    load_dotenv(dotenv_path="../.env.local")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is missing from .env.local")

    engine = create_engine(database_url)
    
    print("Reading schema_update.sql...")
    sql_file = os.path.join(os.path.dirname(__file__), "schema_update.sql")
    with open(sql_file, "r") as f:
        sql = f.read()

    # Split by semicolon to execute separate statements
    statements = [stmt.strip() for stmt in sql.split(";") if stmt.strip()]

    print(f"Connecting to database and executing {len(statements)} statements...")
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
            
    print("Database updates applied successfully!")

if __name__ == "__main__":
    main()
