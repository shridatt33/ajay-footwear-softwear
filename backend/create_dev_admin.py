#!/usr/bin/env python3
"""
SWAMIDATT FOOTWEAR - Developer Super Admin Account Provisioning CLI
Use this utility to securely create or update the primary developer account.
Developer accounts are assigned role = 'developer_super_admin' and have exclusive
access to the Developer Super Admin Dashboard.
"""

import sys
import os
import argparse
import getpass
import secrets
import string
from dotenv import load_dotenv
import psycopg
from werkzeug.security import generate_password_hash

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))


def get_db_connection():
    return psycopg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "ajay_footwear"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "Dattu@1234"),
        connect_timeout=10,
    )


def validate_password_strength(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)
    if not (has_upper and has_lower and has_digit):
        return False, "Password must contain uppercase letters, lowercase letters, and at least one number."
    return True, ""


def generate_secure_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        valid, _ = validate_password_strength(pwd)
        if valid:
            return pwd


def provision_developer_account(username: str, full_name: str, password: str):
    username = username.strip().lower()
    full_name = full_name.strip()

    valid, err_msg = validate_password_strength(password)
    if not valid:
        print(f"[ERROR] Insecure password: {err_msg}", file=sys.stderr)
        sys.exit(1)

    password_hash = generate_password_hash(password)

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Ensure users and audit table exist
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        username VARCHAR(100) NOT NULL UNIQUE,
                        password_hash VARCHAR(255) NOT NULL,
                        full_name VARCHAR(200) NOT NULL DEFAULT 'Store Operator',
                        role VARCHAR(50) NOT NULL DEFAULT 'Admin',
                        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS developer_audit_logs (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        username VARCHAR(100),
                        action VARCHAR(100) NOT NULL,
                        details TEXT,
                        ip_address VARCHAR(50),
                        status VARCHAR(20) DEFAULT 'success',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    """
                )

                # Check if user already exists
                cur.execute("SELECT id, role FROM users WHERE LOWER(username) = LOWER(%s);", (username,))
                existing = cur.fetchone()

                if existing:
                    user_id = existing[0]
                    cur.execute(
                        """
                        UPDATE users
                        SET password_hash = %s,
                            full_name = %s,
                            role = 'developer_super_admin',
                            status = 'active',
                            updated_at = NOW()
                        WHERE id = %s;
                        """,
                        (password_hash, full_name, user_id)
                    )
                    action = "DEVELOPER_ACCOUNT_UPDATED"
                    print(f"[SUCCESS] Developer Super Admin '{username}' (ID: {user_id}) updated successfully.")
                else:
                    cur.execute(
                        """
                        INSERT INTO users (username, password_hash, full_name, role, status)
                        VALUES (%s, %s, %s, 'developer_super_admin', 'active')
                        RETURNING id;
                        """,
                        (username, password_hash, full_name)
                    )
                    user_id = cur.fetchone()[0]
                    action = "DEVELOPER_ACCOUNT_PROVISIONED"
                    print(f"[SUCCESS] Developer Super Admin '{username}' (ID: {user_id}) created successfully.")

                # Invalidate existing sessions so new credentials take effect
                cur.execute("DELETE FROM user_sessions WHERE user_id = %s;", (user_id,))

                # Log audit entry
                cur.execute(
                    """
                    INSERT INTO developer_audit_logs (user_id, username, action, details, ip_address, status)
                    VALUES (%s, %s, %s, 'CLI provisioning script executed', '127.0.0.1', 'success');
                    """,
                    (user_id, username, action)
                )

                conn.commit()

        print("\n=======================================================")
        print(" SWAMIDATT FOOTWEAR - DEVELOPER ACCOUNT CONFIGURED")
        print("=======================================================")
        print(f" Username : {username}")
        print(f" Full Name: {full_name}")
        print(f" Role     : developer_super_admin")
        print(f" Status   : active")
        print(f" Portal   : http://127.0.0.1:5173/#/developer-access")
        print("=======================================================\n")

    except Exception as e:
        print(f"[ERROR] Database error during provisioning: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Provision or update a Developer Super Admin account for SWAMIDATT FOOTWEAR."
    )
    parser.add_argument("--username", "-u", help="Developer username (e.g. dev_admin)")
    parser.add_argument("--name", "-n", help="Full display name (e.g. 'Lead Systems Developer')")
    parser.add_argument("--password", "-p", help="Strong password (or leave blank for interactive prompt)")
    parser.add_argument("--generate-password", action="store_true", help="Auto-generate a strong random password")

    args = parser.parse_args()

    print("\n=======================================================")
    print(" SWAMIDATT CONTROL - Developer Account Provisioning")
    print("=======================================================\n")

    username = args.username
    if not username:
        username = input("Enter developer username: ").strip()
        if not username:
            print("[ERROR] Username cannot be empty.", file=sys.stderr)
            sys.exit(1)

    name = args.name
    if not name:
        name = input("Enter developer full name [Lead Developer]: ").strip()
        if not name:
            name = "Lead Developer"

    if args.generate_password:
        password = generate_secure_password(18)
        print(f"\nGenerated Secure Password: {password}")
        print("Save this password securely immediately!\n")
    elif args.password:
        password = args.password
    else:
        password = getpass.getpass("Enter strong password: ")
        confirm_pwd = getpass.getpass("Confirm password: ")
        if password != confirm_pwd:
            print("[ERROR] Passwords do not match.", file=sys.stderr)
            sys.exit(1)

    provision_developer_account(username, name, password)


if __name__ == "__main__":
    main()
