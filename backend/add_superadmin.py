"""Create or update a portal account in the database.

The password is asked for at the prompt (not passed on the command line, where
it would stay in the shell history):

    python backend/add_superadmin.py --name "Juan Dela Cruz" --email juan@psa.gov.ph
"""

import argparse
import getpass
import os
import uuid

import bcrypt
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

MIN_LENGTH = 10


def get_arguments():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--name", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--role", default="Division Administrator")
    parser.add_argument("--office", default="SOCD")
    parser.add_argument(
        "--portal-role",
        choices=["SuperAdmin", "RSSO", "PSO"],
        default="SuperAdmin",
    )
    return parser.parse_args()


def ask_password() -> str:
    while True:
        first = getpass.getpass("Password: ")
        if len(first) < MIN_LENGTH:
            print(f"Use at least {MIN_LENGTH} characters.")
            continue
        if getpass.getpass("Repeat password: ") != first:
            print("The passwords don't match.")
            continue
        return first


def main():
    load_dotenv(dotenv_path=".env.local")
    load_dotenv(dotenv_path="../.env.local")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is missing from .env.local")

    args = get_arguments()
    password = ask_password()
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
    # Same connection rules as backend/main.py: PyMySQL, and SSL for TiDB Cloud.
    scheme, sep, rest = database_url.partition("://")
    if sep and scheme in ("mysql", "mysql+mysqlconnector", "mysql+mysqldb", "mysql+mariadbconnector"):
        database_url = f"mysql+pymysql://{rest}"
    connect_args = {}
    if "tidbcloud.com" in database_url:
        import ssl
        connect_args["ssl"] = ssl.create_default_context()
    engine = create_engine(database_url, connect_args=connect_args)

    with engine.begin() as connection:
        existing = connection.execute(
            text("SELECT id FROM personnel WHERE email = :email"),
            {"email": args.email},
        ).fetchone()

        values = {
            "name": args.name,
            "email": args.email,
            "password_hash": password_hash,
            "role": args.role,
            "office": args.office,
            "portal_role": args.portal_role,
        }
        if existing:
            connection.execute(
                text("""
                    UPDATE personnel
                    SET name = :name, password_hash = :password_hash, role = :role,
                        unit = :office, office = :office, portal_role = :portal_role,
                        sessions_valid_after = UTC_TIMESTAMP()
                    WHERE email = :email
                """),
                values,
            )
        else:
            values["id"] = str(uuid.uuid4())
            connection.execute(
                text("""
                    INSERT INTO personnel
                    (id, name, email, password_hash, role, unit, office, portal_role, status)
                    VALUES (:id, :name, :email, :password_hash, :role, :office, :office,
                            :portal_role, 'in-office')
                """),
                values,
            )

    print(f"{args.portal_role} account ready for {args.email}")


if __name__ == "__main__":
    main()
