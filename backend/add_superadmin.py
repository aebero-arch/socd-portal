"""Create or update a portal account in MariaDB."""

import argparse
import os
import uuid

import bcrypt
from dotenv import load_dotenv
from sqlalchemy import create_engine, text


def get_arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--role", default="Division Administrator")
    parser.add_argument("--office", default="SOCD")
    parser.add_argument(
        "--portal-role",
        choices=["SuperAdmin", "RSSO", "PSO"],
        default="SuperAdmin",
    )
    return parser.parse_args()


def main():
    load_dotenv(dotenv_path=".env.local")
    load_dotenv(dotenv_path="../.env.local")
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is missing from .env.local")

    args = get_arguments()
    password_hash = bcrypt.hashpw(args.password.encode(), bcrypt.gensalt()).decode()
    engine = create_engine(database_url)

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
                        unit = :office, office = :office, portal_role = :portal_role
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
