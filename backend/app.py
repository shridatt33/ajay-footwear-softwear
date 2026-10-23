import os
import random
import base64
import secrets
import collections
import functools
import json
import platform
import sys
import time
from datetime import datetime, timedelta, timezone

from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
from dotenv import load_dotenv
import psycopg
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

app = Flask(__name__)
CORS(app)

INVOICES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "invoices"))
os.makedirs(INVOICES_DIR, exist_ok=True)

BACKUPS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "backups"))
os.makedirs(BACKUPS_DIR, exist_ok=True)

SERVER_START_TIME = datetime.now(timezone.utc)
RECENT_SYSTEM_ERRORS = collections.deque(maxlen=100)

LOW_STOCK_THRESHOLD = 5
DEFAULT_SIZES = list(range(1, 16))



def get_db_connection():
    database_url = os.getenv("DATABASE_URL")

    if database_url:
        return psycopg.connect(
            database_url,
            connect_timeout=15,
        )

    return psycopg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME", "ajay_footwear"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        connect_timeout=10,
    )



def calculate_stock_status(sizes, total_stock):
    if not sizes or total_stock <= 0:
        return "Out of Stock"
    if total_stock <= LOW_STOCK_THRESHOLD:
        return "Low Stock"
    return "In Stock"


def normalize_datetime(value):
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def serialize_product(product_row, sizes_list):
    """
    product_row: (id, product_name, category_id, category_name, selling_price, barcode, status, created_at, updated_at, [product_code, purchase_price, description])
    sizes_list: list of dicts: [{"size": int, "stock_quantity": int}, ...]
    """
    if len(product_row) >= 12:
        p_id, p_name, cat_id, cat_name, price, barcode, status, c_at, u_at, p_code, pur_price, desc = product_row[:12]
    else:
        p_id, p_name, cat_id, cat_name, price, barcode, status, c_at, u_at = product_row[:9]
        p_code = f"FW-{p_id:04d}"
        pur_price = 0.0
        desc = ""

    sorted_sizes = sorted(sizes_list, key=lambda x: x["size"])
    formatted_sizes = [
        {
            "size": s["size"],
            "stock": s.get("stock_quantity", s.get("stock", 0)),
            "stock_quantity": s.get("stock_quantity", s.get("stock", 0)),
        }
        for s in sorted_sizes
    ]
    total_stock = sum(s["stock_quantity"] for s in formatted_sizes)
    stock_status = calculate_stock_status(formatted_sizes, total_stock)

    return {
        "id": p_id,
        "product_name": p_name,
        "product_code": p_code or f"FW-{p_id:04d}",
        "category": cat_name or "Unassigned",
        "category_id": cat_id,
        "category_name": cat_name or "Unassigned",
        "selling_price": float(price),
        "purchase_price": float(pur_price or 0.0),
        "cost_price": float(pur_price or 0.0),
        "description": desc or "",
        "barcode": str(barcode),
        "status": status or "active",
        "sizes": formatted_sizes,
        "total_stock": total_stock,
        "stock_status": stock_status,
        "created_at": normalize_datetime(c_at),
        "updated_at": normalize_datetime(u_at),
    }


def ensure_database_schema():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # 1. Categories
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS categories (
                    id SERIAL PRIMARY KEY,
                    category_name VARCHAR(200) NOT NULL UNIQUE,
                    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )

            # 2. Category sizes
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS category_sizes (
                    id SERIAL PRIMARY KEY,
                    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                    size INTEGER NOT NULL CHECK (size BETWEEN 1 AND 15),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE (category_id, size)
                );
                """
            )

            # 3. Products
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS products (
                    id SERIAL PRIMARY KEY,
                    product_name VARCHAR(200) NOT NULL,
                    category_id INTEGER REFERENCES categories(id),
                    selling_price NUMERIC(10,2) NOT NULL CHECK (selling_price > 0),
                    barcode VARCHAR(50) NOT NULL UNIQUE,
                    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )

            # Add product extended columns safely
            cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code VARCHAR(50);")
            cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10,2) DEFAULT 0;")
            cur.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;")

            # 4. Product sizes
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS product_sizes (
                    id SERIAL PRIMARY KEY,
                    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                    size INTEGER NOT NULL CHECK (size BETWEEN 1 AND 15),
                    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE (product_id, size)
                );
                """
            )

            # 5. Customers
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS customers (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(200) NOT NULL,
                    phone VARCHAR(50) UNIQUE,
                    email VARCHAR(200),
                    address TEXT,
                    outstanding_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )

            # 6. Suppliers
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS suppliers (
                    id SERIAL PRIMARY KEY,
                    supplier_name VARCHAR(200) NOT NULL,
                    contact_person VARCHAR(200),
                    phone VARCHAR(50),
                    email VARCHAR(200),
                    address TEXT,
                    gst_number VARCHAR(50),
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )

            # 7. Purchases & Purchase Items
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS purchases (
                    id SERIAL PRIMARY KEY,
                    purchase_no VARCHAR(50) NOT NULL UNIQUE,
                    supplier_id INTEGER REFERENCES suppliers(id),
                    supplier_name VARCHAR(200) NOT NULL,
                    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                    payment_status VARCHAR(50) DEFAULT 'Paid',
                    payment_mode VARCHAR(50) DEFAULT 'Bank Transfer',
                    notes TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS purchase_items (
                    id SERIAL PRIMARY KEY,
                    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
                    product_id INTEGER REFERENCES products(id),
                    product_name VARCHAR(200) NOT NULL,
                    size INTEGER NOT NULL,
                    quantity INTEGER NOT NULL CHECK (quantity > 0),
                    purchase_price NUMERIC(10,2) NOT NULL,
                    total_price NUMERIC(10,2) NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )

            # 8. Bills & Bill items
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS bills (
                    id SERIAL PRIMARY KEY,
                    bill_no VARCHAR(50) NOT NULL UNIQUE,
                    customer_name VARCHAR(200) DEFAULT 'Walk-in Customer',
                    customer_phone VARCHAR(50) DEFAULT '',
                    payment_mode VARCHAR(50) DEFAULT 'Cash',
                    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'Paid',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )

            # Add extended columns to bills safely
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS discount NUMERIC(10,2) DEFAULT 0;")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS tax NUMERIC(10,2) DEFAULT 0;")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS amount_received NUMERIC(10,2) DEFAULT 0;")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS change_returned NUMERIC(10,2) DEFAULT 0;")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS pdf_path TEXT;")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS billing_address TEXT;")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS state_of_supply VARCHAR(100) DEFAULT '27-Maharashtra';")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS terms_conditions TEXT;")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS description TEXT;")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS round_off NUMERIC(10,2) DEFAULT 0;")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0;")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0;")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS delivery_charges NUMERIC(10,2) DEFAULT 0;")

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS bill_items (
                    id SERIAL PRIMARY KEY,
                    bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
                    product_id INTEGER REFERENCES products(id),
                    product_name VARCHAR(200) NOT NULL,
                    size INTEGER NOT NULL,
                    quantity INTEGER NOT NULL CHECK (quantity > 0),
                    selling_price NUMERIC(10,2) NOT NULL,
                    total_price NUMERIC(10,2) NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )

            cur.execute("ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0;")
            cur.execute("ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;")
            cur.execute("ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS tax_percent NUMERIC(5,2) DEFAULT 0;")
            cur.execute("ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) DEFAULT 0;")
            cur.execute("ALTER TABLE bill_items ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);")

            # Populate missing product codes
            cur.execute(
                """
                UPDATE products
                SET product_code = CONCAT('FW-', LPAD(id::text, 4, '0'))
                WHERE product_code IS NULL OR product_code = '';
                """
            )

            # Clean up old columns if present
            cur.execute(
                """
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'products' AND column_name = 'size';
                """
            )
            if cur.fetchone() is not None:
                cur.execute("DROP INDEX IF EXISTS idx_products_name_size;")
                cur.execute("ALTER TABLE products DROP COLUMN IF EXISTS size;")
                cur.execute("ALTER TABLE products DROP COLUMN IF EXISTS stock_quantity;")

            # Safe migration: ensure all existing products have a unique 13-digit barcode
            cur.execute("SELECT id FROM products WHERE barcode IS NULL OR barcode = ''")
            missing_barcodes = cur.fetchall()
            for (p_id,) in missing_barcodes:
                b_code = generate_unique_barcode(cur)
                cur.execute("UPDATE products SET barcode = %s WHERE id = %s", (b_code, p_id))

            # Indexes and database constraints
            cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);")
            cur.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_prod_per_cat
                ON products (LOWER(TRIM(product_name)), category_id)
                WHERE status = 'active';
                """
            )
            cur.execute("CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_product_sizes_product_id ON product_sizes (product_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_category_sizes_category_id ON category_sizes (category_id);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills (created_at DESC);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases (created_at DESC);")

            # 9. Users & Authentication
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

            # 10. User Sessions
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id SERIAL PRIMARY KEY,
                    token VARCHAR(128) NOT NULL UNIQUE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    expires_at TIMESTAMPTZ NOT NULL,
                    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )

            cur.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users (LOWER(username));")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions (token);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions (expires_at);")

            # Extended Shop Account & Billing Status Schema Migrations
            cur.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;")
            cur.execute("ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive', 'archived'));")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_name VARCHAR(200);")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_status VARCHAR(20) NOT NULL DEFAULT 'active';")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(200);")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS gst_number VARCHAR(50);")
            cur.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_billing_status_check;")
            cur.execute("ALTER TABLE users ADD CONSTRAINT users_billing_status_check CHECK (billing_status IN ('active', 'suspended'));")

            cur.execute("UPDATE users SET shop_name = 'SWAMIDATT FOOTWEAR - Main Branch' WHERE shop_name IS NULL AND role != 'developer_super_admin';")
            cur.execute("UPDATE users SET shop_name = 'System Control Operations' WHERE shop_name IS NULL AND role = 'developer_super_admin';")

            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;")
            cur.execute("ALTER TABLE bills ADD COLUMN IF NOT EXISTS shop_name VARCHAR(200);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills (user_id);")
            cur.execute("UPDATE bills SET shop_name = 'SWAMIDATT FOOTWEAR - Main Branch' WHERE shop_name IS NULL;")

            # 11. Developer Security Audit Logs
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
            cur.execute("CREATE INDEX IF NOT EXISTS idx_dev_audit_created_at ON developer_audit_logs (created_at DESC);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_dev_audit_action ON developer_audit_logs (action);")

            # 12. Login Attempts Tracking (for Rate Limiting & Account Lockout)
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS login_attempts (
                    id SERIAL PRIMARY KEY,
                    ip_address VARCHAR(50),
                    username VARCHAR(100),
                    attempt_type VARCHAR(50) DEFAULT 'shop',
                    success BOOLEAN NOT NULL DEFAULT FALSE,
                    attempt_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
            cur.execute("CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON login_attempts (username, attempt_type, attempt_time DESC);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts (ip_address, attempt_type, attempt_time DESC);")

            # 13. System Database Backups Tracking
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS system_backups (
                    id SERIAL PRIMARY KEY,
                    filename VARCHAR(255) NOT NULL UNIQUE,
                    file_size_bytes BIGINT NOT NULL DEFAULT 0,
                    backup_type VARCHAR(50) NOT NULL DEFAULT 'manual',
                    status VARCHAR(50) NOT NULL DEFAULT 'completed',
                    error_message TEXT,
                    created_by VARCHAR(100),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )
            cur.execute("CREATE INDEX IF NOT EXISTS idx_system_backups_created_at ON system_backups (created_at DESC);")

            # Seed initial administrator and store accounts if no users exist
            cur.execute("SELECT COUNT(*) FROM users;")
            user_count = cur.fetchone()[0]
            if user_count == 0:
                admin_username = os.getenv("DEFAULT_ADMIN_USER", "admin").strip().lower()
                admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")
                admin_hash = generate_password_hash(admin_password)
                cur.execute(
                    """
                    INSERT INTO users (username, password_hash, full_name, role, status)
                    VALUES (%s, %s, %s, %s, 'active');
                    """,
                    (admin_username, admin_hash, "Administrator", "Admin")
                )

                # Also create an initial "ajay" account for store owner
                if admin_username != "ajay":
                    ajay_hash = generate_password_hash("admin123")
                    cur.execute(
                        """
                        INSERT INTO users (username, password_hash, full_name, role, status)
                        VALUES ('ajay', %s, 'Ajay (Store Owner)', 'Admin', 'active');
                        """,
                        (ajay_hash,)
                    )

            conn.commit()


def calculate_ean13_checksum(code12: str) -> str:
    """
    Computes standard GS1 / EAN-13 modulo-10 check digit for a 12-digit string.
    Odd-positioned digits (1st, 3rd, 5th, 7th, 9th, 11th; 0-indexed 0, 2, 4, 6, 8, 10) weight = 1
    Even-positioned digits (2nd, 4th, 6th, 8th, 10th, 12th; 0-indexed 1, 3, 5, 7, 9, 11) weight = 3
    Check digit = (10 - (total % 10)) % 10
    """
    total = sum(int(ch) * (1 if idx % 2 == 0 else 3) for idx, ch in enumerate(code12))
    return str((10 - (total % 10)) % 10)


def generate_unique_barcode(cur=None):
    """
    Generates a unique 13-digit numeric barcode compatible with EAN-13 standards.
    Uses '890' (GS1 India prefix) + 9 random digits + 1 calculated check digit = 13 digits.
    Guarantees database uniqueness across all products (including inactive products).
    """
    def check_exists(code):
        if cur is not None:
            cur.execute("SELECT 1 FROM products WHERE barcode = %s", (code,))
            return cur.fetchone() is not None
        with get_db_connection() as conn:
            with conn.cursor() as c:
                c.execute("SELECT 1 FROM products WHERE barcode = %s", (code,))
                return c.fetchone() is not None

    for _ in range(5000):
        code12 = f"890{random.randint(0, 999999999):09d}"
        checksum = calculate_ean13_checksum(code12)
        candidate = f"{code12}{checksum}"
        if not check_exists(candidate):
            return candidate

    raise RuntimeError("Failed to generate unique 13-digit EAN-13 barcode after 5000 attempts.")


def validate_sizes_list(sizes):
    values = []
    try:
        for value in sizes:
            size = int(value)
            if size not in DEFAULT_SIZES:
                raise ValueError
            values.append(size)
    except (TypeError, ValueError):
        raise ValueError("Sizes must be between 1 and 15.")

    return sorted(set(values))


def normalize_size_stock_entries(payload):
    raw_entries = (
        payload.get("size_stock")
        or payload.get("sizes")
        or payload.get("variants")
        or payload.get("size_quantities")
        or []
    )

    if isinstance(raw_entries, dict):
        raw_entries = [
            {"size": key, "stock_quantity": value}
            for key, value in raw_entries.items()
        ]

    if not isinstance(raw_entries, list):
        raise ValueError("Size stock entries are required.")

    normalized = []
    for entry in raw_entries:
        if not isinstance(entry, dict):
            raise ValueError("Each size entry must be an object.")

        size_value = entry.get("size")
        stock_value = entry.get("stock_quantity", entry.get("stock", 0))

        if size_value is None:
            raise ValueError("Each size must include a valid size value.")

        size = int(size_value)
        if size not in DEFAULT_SIZES:
            raise ValueError("Size is invalid.")

        stock_quantity = int(stock_value)
        if stock_quantity < 0:
            raise ValueError("Stock quantity cannot be negative.")

        normalized.append({"size": size, "stock_quantity": stock_quantity})

    deduplicated = {}
    for item in normalized:
        deduplicated[item["size"]] = item["stock_quantity"]

    return [
        {"size": size, "stock_quantity": deduplicated[size]}
        for size in sorted(deduplicated)
    ]


def validate_product_payload(payload, is_update=False):
    errors = []

    product_name = (payload.get("product_name") or "").strip()
    if not product_name:
        errors.append("Product name cannot be empty.")

    try:
        category_id = int(payload.get("category_id"))
    except (TypeError, ValueError):
        category_id = None

    if category_id is None or category_id <= 0:
        errors.append("Category is required.")

    try:
        selling_price = float(payload.get("selling_price"))
    except (TypeError, ValueError):
        selling_price = None

    if selling_price is None or selling_price <= 0:
        errors.append("Selling price must be greater than 0.")

    purchase_price = 0.0
    if payload.get("purchase_price") not in (None, ""):
        try:
            purchase_price = float(payload.get("purchase_price"))
            if purchase_price < 0:
                errors.append("Purchase price cannot be negative.")
        except (TypeError, ValueError):
            errors.append("Invalid purchase price.")

    product_code = (payload.get("product_code") or "").strip()
    description = (payload.get("description") or "").strip()

    status = (payload.get("status") or "active").strip() or "active"
    if status not in ("active", "inactive"):
        errors.append("Invalid product status.")

    return {
        "product_name": product_name,
        "product_code": product_code,
        "category_id": category_id,
        "selling_price": selling_price,
        "purchase_price": purchase_price,
        "description": description,
        "status": status,
    }, errors


@app.before_request
def init_database():
    ensure_database_schema()


@app.route("/")
def home():
    return jsonify({
        "status": "success",
        "message": "AJAY FW API is running"
    })


@app.route("/api/health")
def health():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")

        return jsonify({
            "status": "ok",
            "backend": "Flask",
            "database": "PostgreSQL",
            "database_connection": "connected"
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "database_connection": "failed",
            "error": str(e)
        }), 500


# ==========================================
# ==========================================
# AUTHENTICATION API (SHOP & TERMINAL)
# ==========================================

def get_client_ip():
    """Extract real client IP considering forward headers if present."""
    if request.headers.get("X-Forwarded-For"):
        return request.headers.get("X-Forwarded-For").split(",")[0].strip()
    return request.remote_addr or "127.0.0.1"


def record_audit_log(action, user_id=None, username=None, details=None, ip_address=None, status="success"):
    """Persist an audit log entry for security and administrative actions."""
    try:
        ip = ip_address or get_client_ip()
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO developer_audit_logs (user_id, username, action, details, ip_address, status)
                    VALUES (%s, %s, %s, %s, %s, %s);
                    """,
                    (user_id, username, action, details, ip, status)
                )
                conn.commit()
    except Exception as e:
        print(f"[AUDIT LOG ERROR] Failed to record audit log: {e}")


def record_login_attempt(username, ip_address, attempt_type, success):
    """Record an authentication attempt for rate limiting and lockout enforcement."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO login_attempts (ip_address, username, attempt_type, success)
                    VALUES (%s, %s, %s, %s);
                    """,
                    (ip_address, username, attempt_type, success)
                )
                conn.commit()
    except Exception as e:
        print(f"[LOGIN ATTEMPT ERROR] Failed to record login attempt: {e}")


def check_developer_rate_limit(username, ip_address):
    """
    Enforces rate limiting and account lockout.
    Blocks if 5 or more failed developer login attempts occurred within the past 15 minutes.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT COUNT(*)
                    FROM login_attempts
                    WHERE (LOWER(username) = LOWER(%s) OR ip_address = %s)
                      AND attempt_type = 'developer'
                      AND success = FALSE
                      AND attempt_time > NOW() - INTERVAL '15 minutes';
                    """,
                    (username, ip_address)
                )
                failed_count = cur.fetchone()[0]
                if failed_count >= 5:
                    return False, "Too many failed attempts. Developer access is temporarily locked for 15 minutes."
                return True, ""
    except Exception as e:
        print(f"[RATE LIMIT ERROR] {e}")
        return True, ""


def developer_required(f):
    """
    Enforces server-side Role-Based Access Control (RBAC).
    Guarantees only active users with role == 'developer_super_admin' can access endpoints.
    Returns 401 for unauthenticated requests and 403 for unauthorized users (including shop users).
    """
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        elif request.headers.get("X-Auth-Token"):
            token = request.headers.get("X-Auth-Token").strip()

        if not token:
            return jsonify({"success": False, "message": "Authentication required. Missing developer session token."}), 401

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT s.token, s.expires_at, u.id, u.username, u.full_name, u.role, u.status
                    FROM user_sessions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.token = %s;
                    """,
                    (token,)
                )
                row = cur.fetchone()

                if not row:
                    return jsonify({"success": False, "message": "Invalid or expired developer session. Please log in again."}), 401

                s_token, s_expires, u_id, u_username, u_name, u_role, u_status = row

                now_utc = datetime.now(timezone.utc)
                if s_expires < now_utc:
                    cur.execute("DELETE FROM user_sessions WHERE token = %s;", (token,))
                    conn.commit()
                    return jsonify({"success": False, "message": "Developer session has expired. Please log in again."}), 401

                if u_status != "active":
                    return jsonify({"success": False, "message": "Developer account is inactive or disabled."}), 403

                # CRITICAL RBAC CHECK: role must be developer_super_admin
                if u_role != "developer_super_admin":
                    record_audit_log(
                        action="UNAUTHORIZED_DEV_ENDPOINT_ACCESS",
                        user_id=u_id,
                        username=u_username,
                        details=f"User with role '{u_role}' attempted to access developer endpoint {request.path}",
                        ip_address=get_client_ip(),
                        status="blocked"
                    )
                    return jsonify({
                        "success": False,
                        "message": "Access forbidden: Developer Super Admin privileges required."
                    }), 403

                # Touch active session
                cur.execute("UPDATE user_sessions SET last_active_at = NOW() WHERE token = %s;", (token,))
                conn.commit()

        current_dev_user = {
            "id": u_id,
            "username": u_username,
            "full_name": u_name,
            "role": u_role
        }
        return f(current_user=current_dev_user, *args, **kwargs)
    return decorated_function


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    client_ip = get_client_ip()
    try:
        data = request.get_json(silent=True) or {}
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", "")).strip()

        if not username and not password:
            return jsonify({"success": False, "message": "Please enter both username and password."}), 400
        if not username:
            return jsonify({"success": False, "message": "Username is required."}), 400
        if not password:
            return jsonify({"success": False, "message": "Password is required."}), 400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, username, password_hash, full_name, role, status, shop_name, billing_status
                    FROM users
                    WHERE LOWER(username) = LOWER(%s);
                    """,
                    (username,)
                )
                user_row = cur.fetchone()

                if not user_row:
                    record_login_attempt(username, client_ip, "shop", False)
                    return jsonify({"success": False, "message": "Invalid username or password."}), 401

                u_id, u_username, u_hash, u_name, u_role, u_status, u_shop_name, u_billing_status = user_row

                # Prevent developer account from logging in via standard shop login
                if u_role == "developer_super_admin":
                    record_login_attempt(username, client_ip, "shop", False)
                    record_audit_log(
                        action="SHOP_LOGIN_BLOCKED_FOR_DEV",
                        user_id=u_id,
                        username=u_username,
                        details="Developer attempted login via standard shop login",
                        ip_address=client_ip,
                        status="blocked"
                    )
                    return jsonify({
                        "success": False,
                        "message": "Developer accounts cannot log in through the shop terminal. Please use the developer portal."
                    }), 403

                if u_status == "archived":
                    record_login_attempt(username, client_ip, "shop", False)
                    return jsonify({
                        "success": False,
                        "message": "This shop account has been archived. Access is restricted under compliance retention policy."
                    }), 403

                if u_status != "active":
                    record_login_attempt(username, client_ip, "shop", False)
                    return jsonify({"success": False, "message": "This account is inactive. Please contact store manager."}), 403

                if not check_password_hash(u_hash, password):
                    record_login_attempt(username, client_ip, "shop", False)
                    return jsonify({"success": False, "message": "Invalid username or password."}), 401

                session_token = secrets.token_hex(32)
                expires_at = datetime.now(timezone.utc) + timedelta(days=30)

                cur.execute(
                    """
                    INSERT INTO user_sessions (token, user_id, expires_at, last_active_at)
                    VALUES (%s, %s, %s, NOW());
                    """,
                    (session_token, u_id, expires_at)
                )
                conn.commit()

                record_login_attempt(username, client_ip, "shop", True)

        return jsonify({
            "success": True,
            "token": session_token,
            "user": {
                "id": u_id,
                "username": u_username,
                "full_name": u_name,
                "role": u_role,
                "shop_name": u_shop_name or "SWAMIDATT FOOTWEAR - Main Branch",
                "billing_status": u_billing_status or "active"
            },
            "message": "Login successful"
        }), 200
    except Exception as e:
        RECENT_SYSTEM_ERRORS.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
            "endpoint": "/api/auth/login",
            "method": "POST"
        })
        return jsonify({"success": False, "message": f"Authentication server error: {str(e)}"}), 500


@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    try:
        auth_header = request.headers.get("Authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        elif request.headers.get("X-Auth-Token"):
            token = request.headers.get("X-Auth-Token").strip()

        if not token:
            return jsonify({"authenticated": False, "message": "No authorization token provided."}), 401

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT s.token, s.expires_at, u.id, u.username, u.full_name, u.role, u.status, u.shop_name, u.billing_status
                    FROM user_sessions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.token = %s;
                    """,
                    (token,)
                )
                row = cur.fetchone()

                if not row:
                    return jsonify({"authenticated": False, "message": "Session not found."}), 401

                s_token, s_expires, u_id, u_username, u_name, u_role, u_status, u_shop_name, u_billing_status = row

                now_utc = datetime.now(timezone.utc)
                if s_expires < now_utc:
                    cur.execute("DELETE FROM user_sessions WHERE token = %s;", (token,))
                    conn.commit()
                    return jsonify({"authenticated": False, "message": "Session expired. Please log in again."}), 401

                if u_status == "archived":
                    return jsonify({"authenticated": False, "message": "This shop account has been archived."}), 403

                if u_status != "active":
                    return jsonify({"authenticated": False, "message": "Account deactivated."}), 403

                cur.execute("UPDATE user_sessions SET last_active_at = NOW() WHERE token = %s;", (token,))
                conn.commit()

        return jsonify({
            "authenticated": True,
            "user": {
                "id": u_id,
                "username": u_username,
                "full_name": u_name,
                "role": u_role,
                "shop_name": u_shop_name or "SWAMIDATT FOOTWEAR - Main Branch",
                "billing_status": u_billing_status or "active"
            }
        }), 200
    except Exception as e:
        return jsonify({"authenticated": False, "message": f"Auth check failed: {str(e)}"}), 500


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    try:
        auth_header = request.headers.get("Authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        elif request.headers.get("X-Auth-Token"):
            token = request.headers.get("X-Auth-Token").strip()

        if token:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM user_sessions WHERE token = %s;", (token,))
                    conn.commit()

        return jsonify({"success": True, "message": "Logged out successfully"}), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Logout error: {str(e)}"}), 500


# ==========================================
# DEVELOPER SUPER ADMIN API ENDPOINTS
# ==========================================

@app.route("/api/developer/auth/login", methods=["POST"])
def developer_auth_login():
    """
    Dedicated developer authentication endpoint.
    Enforces rate limiting, role validation, session generation, and security auditing.
    """
    client_ip = get_client_ip()
    try:
        data = request.get_json(silent=True) or {}
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", "")).strip()

        if not username or not password:
            return jsonify({"success": False, "message": "Developer username and password are required."}), 400

        # Rate Limiting & Account Lockout check
        allowed, lockout_msg = check_developer_rate_limit(username, client_ip)
        if not allowed:
            record_audit_log(
                action="DEVELOPER_LOGIN_RATE_LIMITED",
                username=username,
                details=f"Rate limit triggered from IP {client_ip}",
                ip_address=client_ip,
                status="blocked"
            )
            return jsonify({"success": False, "message": lockout_msg}), 429

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, username, password_hash, full_name, role, status
                    FROM users
                    WHERE LOWER(username) = LOWER(%s);
                    """,
                    (username,)
                )
                user_row = cur.fetchone()

                if not user_row:
                    record_login_attempt(username, client_ip, "developer", False)
                    record_audit_log(
                        action="DEVELOPER_LOGIN_FAILED",
                        username=username,
                        details="Username not found",
                        ip_address=client_ip,
                        status="failed"
                    )
                    return jsonify({"success": False, "message": "Invalid developer credentials."}), 401

                u_id, u_username, u_hash, u_name, u_role, u_status = user_row

                if not check_password_hash(u_hash, password):
                    record_login_attempt(username, client_ip, "developer", False)
                    record_audit_log(
                        action="DEVELOPER_LOGIN_FAILED",
                        user_id=u_id,
                        username=u_username,
                        details="Password mismatch",
                        ip_address=client_ip,
                        status="failed"
                    )
                    return jsonify({"success": False, "message": "Invalid developer credentials."}), 401

                if u_role != "developer_super_admin":
                    record_login_attempt(username, client_ip, "developer", False)
                    record_audit_log(
                        action="DEVELOPER_LOGIN_DENIED_ROLE",
                        user_id=u_id,
                        username=u_username,
                        details=f"Account has role '{u_role}', not 'developer_super_admin'",
                        ip_address=client_ip,
                        status="blocked"
                    )
                    return jsonify({
                        "success": False,
                        "message": "Access denied: Account does not have Developer Super Admin privileges."
                    }), 403

                if u_status != "active":
                    record_login_attempt(username, client_ip, "developer", False)
                    record_audit_log(
                        action="DEVELOPER_LOGIN_INACTIVE",
                        user_id=u_id,
                        username=u_username,
                        details="Developer account is inactive",
                        ip_address=client_ip,
                        status="blocked"
                    )
                    return jsonify({"success": False, "message": "Developer account is deactivated."}), 403

                # Successful login: 8 hours session duration
                session_token = secrets.token_hex(48)
                expires_at = datetime.now(timezone.utc) + timedelta(hours=8)

                cur.execute(
                    """
                    INSERT INTO user_sessions (token, user_id, expires_at, last_active_at)
                    VALUES (%s, %s, %s, NOW());
                    """,
                    (session_token, u_id, expires_at)
                )
                conn.commit()

                record_login_attempt(username, client_ip, "developer", True)
                record_audit_log(
                    action="DEVELOPER_LOGIN_SUCCESS",
                    user_id=u_id,
                    username=u_username,
                    details="Developer Super Admin authenticated successfully",
                    ip_address=client_ip,
                    status="success"
                )

        return jsonify({
            "success": True,
            "token": session_token,
            "user": {
                "id": u_id,
                "username": u_username,
                "full_name": u_name,
                "role": u_role
            },
            "message": "Developer Super Admin authenticated"
        }), 200
    except Exception as e:
        RECENT_SYSTEM_ERRORS.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
            "endpoint": "/api/developer/auth/login",
            "method": "POST"
        })
        return jsonify({"success": False, "message": f"Developer auth error: {str(e)}"}), 500


@app.route("/api/developer/auth/me", methods=["GET"])
@developer_required
def developer_auth_me(current_user):
    """Verify active developer session."""
    return jsonify({
        "authenticated": True,
        "user": current_user
    }), 200


@app.route("/api/developer/auth/logout", methods=["POST"])
@developer_required
def developer_auth_logout(current_user):
    """Invalidate developer session and record audit event."""
    try:
        auth_header = request.headers.get("Authorization", "")
        token = auth_header[7:].strip() if auth_header.startswith("Bearer ") else request.headers.get("X-Auth-Token", "").strip()

        if token:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM user_sessions WHERE token = %s;", (token,))
                    conn.commit()

        record_audit_log(
            action="DEVELOPER_LOGOUT",
            user_id=current_user["id"],
            username=current_user["username"],
            details="Developer session ended via logout",
            ip_address=get_client_ip(),
            status="success"
        )
        return jsonify({"success": True, "message": "Developer session terminated successfully."}), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Logout error: {str(e)}"}), 500


@app.route("/api/developer/overview", methods=["GET"])
@developer_required
def developer_overview(current_user):
    """
    Returns authentic system metrics, PostgreSQL telemetry, user statistics,
    recent audit activity, and real backup status.
    """
    try:
        uptime_seconds = int((datetime.now(timezone.utc) - SERVER_START_TIME).total_seconds())

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # 1. PostgreSQL Version & DB Size
                cur.execute("SELECT version();")
                pg_version_raw = cur.fetchone()[0]
                pg_version_short = pg_version_raw.split(",")[0] if pg_version_raw else "PostgreSQL"

                cur.execute("SELECT pg_database_size('ajay_footwear');")
                db_size_bytes = cur.fetchone()[0] or 0
                db_size_mb = round(db_size_bytes / (1024 * 1024), 2)

                # 2. Database Connection Count
                cur.execute("SELECT count(*) FROM pg_stat_activity WHERE datname = 'ajay_footwear';")
                active_db_connections = cur.fetchone()[0] or 1

                # 3. Shop Users Breakdown
                cur.execute(
                    """
                    SELECT 
                        COUNT(*) FILTER (WHERE role != 'developer_super_admin') AS total_shop_users,
                        COUNT(*) FILTER (WHERE role != 'developer_super_admin' AND status = 'active') AS active_shop_users,
                        COUNT(*) FILTER (WHERE role != 'developer_super_admin' AND status = 'inactive') AS inactive_shop_users,
                        COUNT(*) FILTER (WHERE role = 'developer_super_admin') AS dev_users
                    FROM users;
                    """
                )
                u_stats = cur.fetchone()
                total_shop_users = u_stats[0] or 0
                active_shop_users = u_stats[1] or 0
                inactive_shop_users = u_stats[2] or 0
                dev_users_count = u_stats[3] or 0

                # 4. Core Shop Telemetry
                cur.execute("SELECT COUNT(*) FROM products;")
                total_products = cur.fetchone()[0] or 0

                cur.execute("SELECT COALESCE(SUM(stock_quantity), 0) FROM product_sizes;")
                total_stock_units = cur.fetchone()[0] or 0

                cur.execute("SELECT COUNT(*) FROM bills;")
                total_bills = cur.fetchone()[0] or 0

                cur.execute("SELECT COUNT(*) FROM customers;")
                total_customers = cur.fetchone()[0] or 0

                # 5. Recent Login Activity (Real login attempts)
                cur.execute(
                    """
                    SELECT username, ip_address, attempt_type, success, attempt_time
                    FROM login_attempts
                    ORDER BY attempt_time DESC
                    LIMIT 8;
                    """
                )
                recent_logins = [
                    {
                        "username": row[0],
                        "ip_address": row[1],
                        "attempt_type": row[2],
                        "success": bool(row[3]),
                        "time": normalize_datetime(row[4])
                    }
                    for row in cur.fetchall()
                ]

                # 6. Last Successful Backup
                cur.execute(
                    """
                    SELECT filename, file_size_bytes, backup_type, status, created_at
                    FROM system_backups
                    WHERE status = 'completed'
                    ORDER BY created_at DESC
                    LIMIT 1;
                    """
                )
                last_backup_row = cur.fetchone()
                last_backup = None
                if last_backup_row:
                    last_backup = {
                        "filename": last_backup_row[0],
                        "size_mb": round((last_backup_row[1] or 0) / (1024 * 1024), 2),
                        "type": last_backup_row[2],
                        "status": last_backup_row[3],
                        "created_at": normalize_datetime(last_backup_row[4])
                    }

        return jsonify({
            "success": True,
            "application": {
                "name": "SWAMIDATT FOOTWEAR ERP & POS",
                "status": "Operational",
                "version": "1.2.0",
                "started_at": SERVER_START_TIME.isoformat(),
                "uptime_seconds": uptime_seconds,
                "uptime_formatted": f"{uptime_seconds // 3600}h {(uptime_seconds % 3600) // 60}m {uptime_seconds % 60}s"
            },
            "database": {
                "status": "Connected",
                "engine": "PostgreSQL",
                "version": pg_version_short,
                "database_name": "ajay_footwear",
                "size_mb": db_size_mb,
                "active_connections": active_db_connections
            },
            "users": {
                "total_shop_users": total_shop_users,
                "active_shop_users": active_shop_users,
                "inactive_shop_users": inactive_shop_users,
                "developer_super_admins": dev_users_count
            },
            "store_metrics": {
                "products": total_products,
                "stock_units": total_stock_units,
                "bills": total_bills,
                "customers": total_customers
            },
            "recent_logins": recent_logins,
            "recent_errors": list(RECENT_SYSTEM_ERRORS)[-5:],
            "last_backup": last_backup
        }), 200
    except Exception as e:
        RECENT_SYSTEM_ERRORS.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
            "endpoint": "/api/developer/overview",
            "method": "GET"
        })
        return jsonify({"success": False, "message": f"Overview query failed: {str(e)}"}), 500


@app.route("/api/developer/users", methods=["GET"])
@developer_required
def developer_get_users(current_user):
    """
    Returns full list of shop and user accounts with shop_name, username, role,
    account status, billing status, creation date, last login, active sessions,
    and total bills. Plaintext passwords or hashes are NEVER exposed.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT 
                        u.id, 
                        u.username, 
                        COALESCE(u.shop_name, 'SWAMIDATT FOOTWEAR - Main Branch') AS shop_name,
                        u.full_name, 
                        COALESCE(u.phone, '') AS phone,
                        COALESCE(u.email, '') AS email,
                        COALESCE(u.address, '') AS address,
                        COALESCE(u.gst_number, '') AS gst_number,
                        u.role, 
                        u.status, 
                        COALESCE(u.billing_status, 'active') AS billing_status,
                        u.created_at, 
                        u.updated_at,
                        (SELECT COUNT(*) FROM user_sessions s WHERE s.user_id = u.id AND s.expires_at > NOW()) AS active_sessions,
                        (SELECT MAX(s.last_active_at) FROM user_sessions s WHERE s.user_id = u.id) AS last_active,
                        (SELECT COUNT(*) FROM bills b WHERE b.user_id = u.id) AS total_bills
                    FROM users u
                    ORDER BY 
                        CASE WHEN u.role = 'developer_super_admin' THEN 0 ELSE 1 END,
                        u.id ASC;
                    """
                )
                users = []
                for row in cur.fetchall():
                    users.append({
                        "id": row[0],
                        "username": row[1],
                        "shop_name": row[2],
                        "full_name": row[3],
                        "phone": row[4],
                        "email": row[5],
                        "address": row[6],
                        "gst_number": row[7],
                        "role": row[8],
                        "status": row[9],
                        "billing_status": row[10],
                        "created_at": normalize_datetime(row[11]),
                        "updated_at": normalize_datetime(row[12]),
                        "active_sessions": int(row[13] or 0),
                        "last_active": normalize_datetime(row[14]),
                        "total_bills": int(row[15] or 0)
                    })

        return jsonify({"success": True, "users": users}), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to load accounts: {str(e)}"}), 500


@app.route("/api/developer/users", methods=["POST"])
@developer_required
def developer_create_user(current_user):
    """
    Allows Developer Super Admin to create a new shop account with credentials,
    shop name, address, contact details, and role.
    """
    try:
        payload = request.get_json(silent=True) or {}
        username = str(payload.get("username", "")).strip()
        shop_name = str(payload.get("shop_name", "")).strip()
        full_name = str(payload.get("full_name", "")).strip()
        password = str(payload.get("password", "")).strip()
        role = str(payload.get("role", "Admin")).strip()
        phone = str(payload.get("phone", "")).strip()
        email = str(payload.get("email", "")).strip()
        address = str(payload.get("address", "")).strip()
        gst_number = str(payload.get("gst_number", "")).strip()

        if not username:
            return jsonify({"success": False, "message": "Username is required."}), 400
        if len(username) < 3:
            return jsonify({"success": False, "message": "Username must be at least 3 characters."}), 400
        if not shop_name:
            shop_name = f"{username.capitalize()} Store"
        if not full_name:
            full_name = shop_name
        if not password or len(password) < 6:
            return jsonify({"success": False, "message": "Password must be at least 6 characters."}), 400

        valid_roles = ("Admin", "Manager", "Cashier", "developer_super_admin")
        if role not in valid_roles:
            return jsonify({"success": False, "message": f"Invalid role. Choose from {', '.join(valid_roles)}"}), 400

        password_hash = generate_password_hash(password)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM users WHERE LOWER(username) = LOWER(%s);", (username,))
                if cur.fetchone() is not None:
                    return jsonify({"success": False, "message": f"Username '{username}' is already in use."}), 409

                cur.execute(
                    """
                    INSERT INTO users (
                        username, password_hash, full_name, role, status,
                        shop_name, phone, email, address, gst_number, billing_status
                    )
                    VALUES (%s, %s, %s, %s, 'active', %s, %s, %s, %s, %s, 'active')
                    RETURNING id;
                    """,
                    (username, password_hash, full_name, role, shop_name, phone, email, address, gst_number)
                )
                new_id = cur.fetchone()[0]
                conn.commit()

        record_audit_log(
            action="SHOP_ACCOUNT_CREATED",
            user_id=current_user["id"],
            username=current_user["username"],
            details=f"Created shop account '{shop_name}' (Username: {username}, ID: {new_id}, Role: {role})",
            ip_address=get_client_ip(),
            status="success"
        )

        return jsonify({
            "success": True,
            "message": f"Shop account '{shop_name}' created successfully.",
            "user_id": new_id
        }), 201
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to create shop account: {str(e)}"}), 500


@app.route("/api/developer/users/<int:user_id>", methods=["PUT"])
@developer_required
def developer_update_shop_details(current_user, user_id):
    """
    Updates shop details (shop_name, full_name, phone, email, address, gst_number, role, status).
    """
    try:
        payload = request.get_json(silent=True) or {}
        shop_name = str(payload.get("shop_name", "")).strip()
        full_name = str(payload.get("full_name", "")).strip()
        phone = str(payload.get("phone", "")).strip()
        email = str(payload.get("email", "")).strip()
        address = str(payload.get("address", "")).strip()
        gst_number = str(payload.get("gst_number", "")).strip()
        role = str(payload.get("role", "")).strip()
        status = str(payload.get("status", "")).strip().lower()

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, username, role, status, shop_name FROM users WHERE id = %s;", (user_id,))
                row = cur.fetchone()
                if not row:
                    return jsonify({"success": False, "message": "User not found."}), 404

                t_id, t_username, t_role, t_status, t_shop_name = row

                # Safety: prevent removing developer_super_admin role from developer
                if t_role == "developer_super_admin" and role and role != "developer_super_admin":
                    return jsonify({"success": False, "message": "Cannot demote a Developer Super Admin account."}), 400

                update_fields = []
                params = []

                if shop_name:
                    update_fields.append("shop_name = %s")
                    params.append(shop_name)
                if full_name:
                    update_fields.append("full_name = %s")
                    params.append(full_name)
                if "phone" in payload:
                    update_fields.append("phone = %s")
                    params.append(phone)
                if "email" in payload:
                    update_fields.append("email = %s")
                    params.append(email)
                if "address" in payload:
                    update_fields.append("address = %s")
                    params.append(address)
                if "gst_number" in payload:
                    update_fields.append("gst_number = %s")
                    params.append(gst_number)
                if role and role in ("Admin", "Manager", "Cashier", "developer_super_admin"):
                    update_fields.append("role = %s")
                    params.append(role)
                if status and status in ("active", "inactive", "archived"):
                    if t_role == "developer_super_admin" and status != "active":
                        return jsonify({"success": False, "message": "Developer Super Admin cannot be deactivated."}), 400
                    update_fields.append("status = %s")
                    params.append(status)
                    if status != "active":
                        cur.execute("DELETE FROM user_sessions WHERE user_id = %s;", (user_id,))

                if not update_fields:
                    return jsonify({"success": False, "message": "No valid fields provided for update."}), 400

                update_fields.append("updated_at = NOW()")
                params.append(user_id)

                cur.execute(f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s;", tuple(params))
                conn.commit()

        record_audit_log(
            action="SHOP_DETAILS_UPDATED",
            user_id=current_user["id"],
            username=current_user["username"],
            details=f"Updated shop details for '{t_username}' (ID: {user_id})",
            ip_address=get_client_ip(),
            status="success"
        )

        return jsonify({"success": True, "message": f"Shop details for '{t_username}' updated successfully."}), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to update shop details: {str(e)}"}), 500


@app.route("/api/developer/users/<int:user_id>/credentials", methods=["PUT"])
@developer_required
def developer_update_user_credentials(current_user, user_id):
    """
    Sets or resets credentials (username and/or password) for a shop account.
    Hashes password securely and immediately revokes all existing sessions.
    """
    try:
        payload = request.get_json(silent=True) or {}
        new_username = str(payload.get("username", "")).strip()
        new_password = str(payload.get("password", "")).strip()

        if not new_username and not new_password:
            return jsonify({"success": False, "message": "Please provide a new username or password."}), 400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, username, role FROM users WHERE id = %s;", (user_id,))
                target = cur.fetchone()
                if not target:
                    return jsonify({"success": False, "message": "User not found."}), 404

                t_id, current_target_username, t_role = target

                updates = []
                params = []

                if new_username and new_username.lower() != current_target_username.lower():
                    if len(new_username) < 3:
                        return jsonify({"success": False, "message": "Username must be at least 3 characters."}), 400
                    cur.execute("SELECT 1 FROM users WHERE LOWER(username) = LOWER(%s) AND id != %s;", (new_username, user_id))
                    if cur.fetchone() is not None:
                        return jsonify({"success": False, "message": f"Username '{new_username}' is already taken."}), 409
                    updates.append("username = %s")
                    params.append(new_username)

                if new_password:
                    if len(new_password) < 6:
                        return jsonify({"success": False, "message": "Password must be at least 6 characters."}), 400
                    new_hash = generate_password_hash(new_password)
                    updates.append("password_hash = %s")
                    params.append(new_hash)

                if updates:
                    updates.append("updated_at = NOW()")
                    params.append(user_id)
                    cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s;", tuple(params))

                # Immediately revoke all active sessions for security
                cur.execute("DELETE FROM user_sessions WHERE user_id = %s;", (user_id,))
                conn.commit()

        record_audit_log(
            action="SHOP_CREDENTIALS_RESET",
            user_id=current_user["id"],
            username=current_user["username"],
            details=f"Reset login credentials for shop user '{current_target_username}' (ID: {user_id}). Active sessions revoked.",
            ip_address=get_client_ip(),
            status="success"
        )

        return jsonify({
            "success": True,
            "message": f"Login credentials for user '{new_username or current_target_username}' updated successfully. All existing sessions were revoked."
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to update credentials: {str(e)}"}), 500


@app.route("/api/developer/users/<int:user_id>/billing-status", methods=["PUT"])
@developer_required
def developer_update_billing_status(current_user, user_id):
    """
    Sets shop billing status to 'active' or 'suspended'.
    When suspended, revokes all active sessions immediately and prevents creating new invoices.
    """
    try:
        payload = request.get_json(silent=True) or {}
        new_billing_status = str(payload.get("billing_status", "")).strip().lower()

        if new_billing_status not in ("active", "suspended"):
            return jsonify({"success": False, "message": "Billing status must be 'active' or 'suspended'."}), 400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, username, role, shop_name, billing_status FROM users WHERE id = %s;", (user_id,))
                row = cur.fetchone()
                if not row:
                    return jsonify({"success": False, "message": "Shop account not found."}), 404

                t_id, t_username, t_role, t_shop_name, current_billing_status = row

                # Prevent suspending developer super admin
                if t_role == "developer_super_admin":
                    return jsonify({"success": False, "message": "Developer Super Admin cannot be suspended from billing."}), 400

                cur.execute(
                    "UPDATE users SET billing_status = %s, updated_at = NOW() WHERE id = %s;",
                    (new_billing_status, user_id)
                )

                # If suspended, purge sessions to force re-auth and ensure immediate policy enforcement
                if new_billing_status == "suspended":
                    cur.execute("DELETE FROM user_sessions WHERE user_id = %s;", (user_id,))

                conn.commit()

        action_name = "BILLING_SUSPENDED" if new_billing_status == "suspended" else "BILLING_RESUMED"
        record_audit_log(
            action=action_name,
            user_id=current_user["id"],
            username=current_user["username"],
            details=f"Billing status for shop '{t_shop_name or t_username}' (ID: {user_id}) set to {new_billing_status.upper()}",
            ip_address=get_client_ip(),
            status="success"
        )

        msg = (
            f"Billing for '{t_shop_name or t_username}' has been SUSPENDED. New POS checkout and invoice generation are blocked."
            if new_billing_status == "suspended"
            else f"Billing for '{t_shop_name or t_username}' has been RESUMED. Shop users can now generate invoices."
        )

        return jsonify({
            "success": True,
            "billing_status": new_billing_status,
            "message": msg
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to update billing status: {str(e)}"}), 500


@app.route("/api/developer/users/<int:user_id>/status", methods=["PUT"])
@developer_required
def developer_update_user_status(current_user, user_id):
    """
    Activates or deactivates a user account.
    If deactivating, immediately revokes all active sessions for that account.
    """
    try:
        payload = request.get_json(silent=True) or {}
        new_status = str(payload.get("status", "")).strip().lower()

        if new_status not in ("active", "inactive"):
            return jsonify({"success": False, "message": "Status must be 'active' or 'inactive'."}), 400

        # Safety: disallow deactivating self
        if user_id == current_user["id"]:
            return jsonify({"success": False, "message": "You cannot deactivate your own Developer account."}), 400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT username, role, status FROM users WHERE id = %s;", (user_id,))
                target_user = cur.fetchone()
                if not target_user:
                    return jsonify({"success": False, "message": "User not found."}), 404

                t_username, t_role, current_status = target_user

                cur.execute("UPDATE users SET status = %s, updated_at = NOW() WHERE id = %s;", (new_status, user_id))

                # If deactivated, purge all active sessions immediately
                if new_status == "inactive":
                    cur.execute("DELETE FROM user_sessions WHERE user_id = %s;", (user_id,))

                conn.commit()

        record_audit_log(
            action="USER_STATUS_CHANGE",
            user_id=current_user["id"],
            username=current_user["username"],
            details=f"Changed status of user '{t_username}' (ID: {user_id}) from '{current_status}' to '{new_status}'",
            ip_address=get_client_ip(),
            status="success"
        )

        return jsonify({
            "success": True,
            "message": f"User '{t_username}' status updated to {new_status}."
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to update status: {str(e)}"}), 500


@app.route("/api/developer/users/<int:user_id>/reset-password", methods=["POST"])
@developer_required
def developer_reset_user_password(current_user, user_id):
    """
    Resets account access for a user.
    Invalidates all existing sessions, forcing re-authentication.
    """
    try:
        payload = request.get_json(silent=True) or {}
        new_password = str(payload.get("new_password", "")).strip()

        # If not supplied, generate a strong random temporary password
        auto_generated = False
        if not new_password:
            new_password = f"Swamidatt@{secrets.token_hex(4)}"
            auto_generated = True
        elif len(new_password) < 6:
            return jsonify({"success": False, "message": "New password must be at least 6 characters."}), 400

        new_hash = generate_password_hash(new_password)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT username FROM users WHERE id = %s;", (user_id,))
                row = cur.fetchone()
                if not row:
                    return jsonify({"success": False, "message": "User not found."}), 404

                target_username = row[0]

                cur.execute("UPDATE users SET password_hash = %s, updated_at = NOW() WHERE id = %s;", (new_hash, user_id))
                # Invalidate existing sessions for security
                cur.execute("DELETE FROM user_sessions WHERE user_id = %s;", (user_id,))
                conn.commit()

        record_audit_log(
            action="USER_PASSWORD_RESET",
            user_id=current_user["id"],
            username=current_user["username"],
            details=f"Reset password for user '{target_username}' (ID: {user_id})",
            ip_address=get_client_ip(),
            status="success"
        )

        resp = {
            "success": True,
            "message": f"Password for user '{target_username}' reset successfully. Active sessions revoked."
        }
        if auto_generated:
            resp["temporary_password"] = new_password

        return jsonify(resp), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to reset password: {str(e)}"}), 500


@app.route("/api/developer/users/<int:user_id>", methods=["DELETE"])
@developer_required
def developer_delete_user(current_user, user_id):
    """
    Safely and permanently deletes a shop account:
    - Developer account can never be deleted.
    - Developer Super Admin accounts (role == 'developer_super_admin' or username == 'dev_admin') cannot be deleted.
    - Revokes all active sessions for the user.
    - Preserves statutory and financial records:
        * Any bills linked to this user (bills.user_id) are safely detached (user_id = NULL)
          to preserve invoices, line items, payments, customer records, taxes, and accounting ledger.
        * Audit logs (developer_audit_logs.user_id) are safely detached (user_id = NULL),
          preserving the username string and complete history.
    - Transactionally deletes the user from PostgreSQL with rollback on error.
    - Records an audit log in developer_audit_logs for statutory tracking.
    """
    try:
        if user_id == current_user["id"]:
            return jsonify({"success": False, "message": "You cannot delete your own Developer account."}), 400

        with get_db_connection() as conn:
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id, username, role, shop_name, status, billing_status FROM users WHERE id = %s;",
                        (user_id,)
                    )
                    row = cur.fetchone()
                    if not row:
                        return jsonify({"success": False, "message": "Shop account not found."}), 404

                    target_id, target_username, target_role, target_shop_name, target_status, target_billing_status = row

                    if target_role == "developer_super_admin" or target_username == "dev_admin":
                        return jsonify({"success": False, "message": "Developer Super Admin accounts cannot be deleted."}), 400

                    # 1. Count associated bills that will be safely detached & preserved
                    cur.execute("SELECT COUNT(*) FROM bills WHERE user_id = %s;", (user_id,))
                    bills_count = cur.fetchone()[0] or 0

                    # 2. Revoke active sessions immediately
                    cur.execute("DELETE FROM user_sessions WHERE user_id = %s;", (user_id,))

                    # 3. Preserve financial invoices: detach user_id (set to NULL)
                    # All invoices, invoice numbers, amounts, items, taxes, customers, and shop names are 100% retained!
                    cur.execute("UPDATE bills SET user_id = NULL WHERE user_id = %s;", (user_id,))

                    # 4. Preserve audit logs: detach foreign key
                    cur.execute("UPDATE developer_audit_logs SET user_id = NULL WHERE user_id = %s;", (user_id,))

                    # 5. Permanently delete the user row from users table
                    cur.execute("DELETE FROM users WHERE id = %s;", (user_id,))

                    # 6. Record statutory developer audit log
                    cur.execute(
                        """
                        INSERT INTO developer_audit_logs (user_id, username, action, details, ip_address, status)
                        VALUES (%s, %s, %s, %s, %s, %s);
                        """,
                        (
                            current_user["id"],
                            current_user["username"],
                            "SHOP_ACCOUNT_PERMANENTLY_DELETED",
                            f"Permanently deleted account '{target_username}' (ID: {user_id}, Shop: '{target_shop_name}'). {bills_count} associated invoice(s) detached and preserved for statutory tax/financial compliance.",
                            get_client_ip(),
                            "success"
                        )
                    )

                conn.commit()

                return jsonify({
                    "success": True,
                    "action_taken": "deleted",
                    "deleted_user_id": user_id,
                    "deleted_username": target_username,
                    "bills_preserved": bills_count,
                    "message": f"Shop account '{target_username}' ({target_shop_name}) has been permanently deleted from the database. All active sessions have been revoked. Any associated invoice records ({bills_count}) remain preserved in historical accounts."
                }), 200

            except Exception as tx_err:
                conn.rollback()
                raise tx_err
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to permanently delete shop account: {str(e)}"}), 500


@app.route("/api/developer/system", methods=["GET"])
@developer_required
def developer_system_diagnostics(current_user):
    """
    Provides detailed system monitoring, database telemetry, configuration audits,
    and recent error records.
    """
    try:
        start_ping = time.time()
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
                cur.fetchone()
                db_latency_ms = round((time.time() - start_ping) * 1000, 2)

                # PostgreSQL Server Stats
                cur.execute(
                    """
                    SELECT numbackends, xact_commit, xact_rollback, conflicts, deadlocks
                    FROM pg_stat_database
                    WHERE datname = 'ajay_footwear';
                    """
                )
                db_stats_row = cur.fetchone()
                db_stats = {
                    "active_connections": db_stats_row[0] if db_stats_row else 1,
                    "commits": db_stats_row[1] if db_stats_row else 0,
                    "rollbacks": db_stats_row[2] if db_stats_row else 0,
                    "conflicts": db_stats_row[3] if db_stats_row else 0,
                    "deadlocks": db_stats_row[4] if db_stats_row else 0,
                }

                cur.execute("SELECT pg_database_size('ajay_footwear');")
                db_size_bytes = cur.fetchone()[0] or 0

        # Configuration Checks (Sensitive credentials safely masked)
        config_status = {
            "DB_HOST": {"value": os.getenv("DB_HOST", "localhost"), "status": "Configured"},
            "DB_PORT": {"value": os.getenv("DB_PORT", "5432"), "status": "Configured"},
            "DB_NAME": {"value": os.getenv("DB_NAME", "ajay_footwear"), "status": "Configured"},
            "DB_USER": {"value": os.getenv("DB_USER", "postgres"), "status": "Configured"},
            "DB_PASSWORD": {"value": "••••••••••••", "status": "Protected (Masked)"},
            "INVOICES_DIRECTORY": {
                "value": INVOICES_DIR,
                "exists": os.path.isdir(INVOICES_DIR),
                "writable": os.access(INVOICES_DIR, os.W_OK)
            },
            "BACKUPS_DIRECTORY": {
                "value": BACKUPS_DIR,
                "exists": os.path.isdir(BACKUPS_DIR),
                "writable": os.access(BACKUPS_DIR, os.W_OK)
            }
        }

        uptime_seconds = int((datetime.now(timezone.utc) - SERVER_START_TIME).total_seconds())

        return jsonify({
            "success": True,
            "environment": {
                "python_version": sys.version.split()[0],
                "platform": platform.platform(),
                "os": platform.system(),
                "node_name": platform.node(),
                "server_started_at": SERVER_START_TIME.isoformat(),
                "uptime_seconds": uptime_seconds,
            },
            "database_diagnostics": {
                "status": "Healthy",
                "ping_latency_ms": db_latency_ms,
                "size_mb": round(db_size_bytes / (1024 * 1024), 2),
                "stats": db_stats
            },
            "configuration": config_status,
            "system_errors": list(RECENT_SYSTEM_ERRORS)
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Diagnostics failed: {str(e)}"}), 500


@app.route("/api/developer/security/logs", methods=["GET"])
@developer_required
def developer_security_logs(current_user):
    """
    Returns paginated audit logs and recent login attempts.
    """
    try:
        limit = min(int(request.args.get("limit", 100)), 200)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # 1. Audit logs
                cur.execute(
                    """
                    SELECT id, user_id, username, action, details, ip_address, status, created_at
                    FROM developer_audit_logs
                    ORDER BY created_at DESC
                    LIMIT %s;
                    """,
                    (limit,)
                )
                audit_logs = [
                    {
                        "id": row[0],
                        "user_id": row[1],
                        "username": row[2] or "System",
                        "action": row[3],
                        "details": row[4],
                        "ip_address": row[5],
                        "status": row[6],
                        "created_at": normalize_datetime(row[7])
                    }
                    for row in cur.fetchall()
                ]

                # 2. Login activity history
                cur.execute(
                    """
                    SELECT id, username, ip_address, attempt_type, success, attempt_time
                    FROM login_attempts
                    ORDER BY attempt_time DESC
                    LIMIT 50;
                    """,
                )
                login_attempts = [
                    {
                        "id": row[0],
                        "username": row[1],
                        "ip_address": row[2],
                        "attempt_type": row[3],
                        "success": bool(row[4]),
                        "attempt_time": normalize_datetime(row[5])
                    }
                    for row in cur.fetchall()
                ]

        return jsonify({
            "success": True,
            "audit_logs": audit_logs,
            "login_attempts": login_attempts
        }), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to retrieve security logs: {str(e)}"}), 500


@app.route("/api/developer/backups", methods=["GET"])
@developer_required
def developer_get_backups(current_user):
    """
    Returns list of backup records from the database and verifies disk storage.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, filename, file_size_bytes, backup_type, status, error_message, created_by, created_at
                    FROM system_backups
                    ORDER BY created_at DESC;
                    """
                )
                backups = []
                for row in cur.fetchall():
                    filepath = os.path.join(BACKUPS_DIR, row[1])
                    disk_exists = os.path.isfile(filepath)
                    backups.append({
                        "id": row[0],
                        "filename": row[1],
                        "file_size_bytes": row[2],
                        "file_size_formatted": f"{round(row[2] / (1024 * 1024), 2)} MB" if row[2] > 1024*1024 else f"{round(row[2] / 1024, 1)} KB",
                        "backup_type": row[3],
                        "status": row[4],
                        "error_message": row[5],
                        "created_by": row[6],
                        "created_at": normalize_datetime(row[7]),
                        "disk_verified": disk_exists
                    })

        return jsonify({"success": True, "backups": backups}), 200
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to load backups: {str(e)}"}), 500


@app.route("/api/developer/backups", methods=["POST"])
@developer_required
def developer_create_backup(current_user):
    """
    Creates a secure, complete JSON snapshot of all system tables.
    Stored outside frontend web root in backend/backups/.
    """
    try:
        timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"swamidatt_backup_{timestamp_str}.json"
        filepath = os.path.join(BACKUPS_DIR, filename)

        tables_data = {}
        total_records = 0

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Tables to snapshot in order
                target_tables = [
                    "categories",
                    "category_sizes",
                    "products",
                    "product_sizes",
                    "customers",
                    "suppliers",
                    "purchases",
                    "purchase_items",
                    "bills",
                    "bill_items",
                    "users"
                ]

                for tbl in target_tables:
                    cur.execute(f"SELECT * FROM {tbl};")
                    col_names = [desc[0] for desc in cur.description]
                    rows = cur.fetchall()
                    serialized_rows = []
                    for row in rows:
                        row_dict = {}
                        for idx, col in enumerate(col_names):
                            val = row[idx]
                            if hasattr(val, "isoformat"):
                                val = val.isoformat()
                            elif hasattr(val, "__float__"):
                                val = float(val)
                            row_dict[col] = val
                        serialized_rows.append(row_dict)
                    tables_data[tbl] = serialized_rows
                    total_records += len(serialized_rows)

        backup_payload = {
            "application": "SWAMIDATT FOOTWEAR ERP",
            "version": "1.0",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_user["username"],
            "total_records": total_records,
            "tables": tables_data
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(backup_payload, f, indent=2, ensure_ascii=False)

        file_size = os.path.getsize(filepath)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO system_backups (filename, file_size_bytes, backup_type, status, created_by)
                    VALUES (%s, %s, 'manual', 'completed', %s);
                    """,
                    (filename, file_size, current_user["username"])
                )
                conn.commit()

        record_audit_log(
            action="BACKUP_CREATED",
            user_id=current_user["id"],
            username=current_user["username"],
            details=f"Created backup '{filename}' ({round(file_size / 1024, 1)} KB, {total_records} records)",
            ip_address=get_client_ip(),
            status="success"
        )

        return jsonify({
            "success": True,
            "message": f"Backup created successfully: {filename}",
            "backup": {
                "filename": filename,
                "file_size_bytes": file_size,
                "total_records": total_records,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        }), 201
    except Exception as e:
        record_audit_log(
            action="BACKUP_FAILED",
            user_id=current_user["id"],
            username=current_user["username"],
            details=f"Backup generation failed: {str(e)}",
            ip_address=get_client_ip(),
            status="failed"
        )
        return jsonify({"success": False, "message": f"Backup failed: {str(e)}"}), 500


@app.route("/api/developer/backups/restore", methods=["POST"])
@developer_required
def developer_restore_backup(current_user):
    """
    Restores the database from a verified JSON backup snapshot.
    Requires explicit server-side confirmation: {"confirm_restore": true, "filename": "..."}.
    Executes in a single database transaction with automatic rollback on error.
    """
    try:
        payload = request.get_json(silent=True) or {}
        filename = os.path.basename(str(payload.get("filename", "")).strip())
        confirm = bool(payload.get("confirm_restore", False))

        if not confirm:
            return jsonify({
                "success": False,
                "message": "Destructive restore requires explicit confirmation: confirm_restore must be true."
            }), 400

        if not filename or not filename.endswith(".json"):
            return jsonify({"success": False, "message": "Invalid backup filename."}), 400

        filepath = os.path.join(BACKUPS_DIR, filename)
        if not os.path.isfile(filepath):
            return jsonify({"success": False, "message": f"Backup file '{filename}' does not exist on disk."}), 404

        with open(filepath, "r", encoding="utf-8") as f:
            backup_data = json.load(f)

        tables = backup_data.get("tables", {})
        if not tables:
            return jsonify({"success": False, "message": "Backup file does not contain valid table data."}), 400

        # Execute restoration in a transaction
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Truncate tables in reverse dependency order
                cur.execute(
                    """
                    TRUNCATE bill_items, bills, purchase_items, purchases, 
                             product_sizes, products, category_sizes, categories, 
                             customers, suppliers CASCADE;
                    """
                )

                # 1. Categories
                for r in tables.get("categories", []):
                    cur.execute(
                        "INSERT INTO categories (id, category_name, status, created_at, updated_at) VALUES (%s, %s, %s, %s, %s);",
                        (r["id"], r["category_name"], r.get("status", "active"), r["created_at"], r["updated_at"])
                    )

                # 2. Category sizes
                for r in tables.get("category_sizes", []):
                    cur.execute(
                        "INSERT INTO category_sizes (id, category_id, size, created_at) VALUES (%s, %s, %s, %s);",
                        (r["id"], r["category_id"], r["size"], r["created_at"])
                    )

                # 3. Products
                for r in tables.get("products", []):
                    cur.execute(
                        """
                        INSERT INTO products (id, product_name, category_id, selling_price, barcode, status, created_at, updated_at, product_code, purchase_price, description)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                        """,
                        (r["id"], r["product_name"], r.get("category_id"), r["selling_price"], r["barcode"], r.get("status", "active"), r["created_at"], r["updated_at"], r.get("product_code"), r.get("purchase_price", 0), r.get("description", ""))
                    )

                # 4. Product sizes
                for r in tables.get("product_sizes", []):
                    cur.execute(
                        "INSERT INTO product_sizes (id, product_id, size, stock_quantity, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s);",
                        (r["id"], r["product_id"], r["size"], r["stock_quantity"], r["created_at"], r["updated_at"])
                    )

                # 5. Customers
                for r in tables.get("customers", []):
                    cur.execute(
                        "INSERT INTO customers (id, name, phone, email, address, outstanding_amount, status, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);",
                        (r["id"], r["name"], r.get("phone"), r.get("email"), r.get("address"), r.get("outstanding_amount", 0), r.get("status", "active"), r["created_at"], r["updated_at"])
                    )

                # 6. Suppliers
                for r in tables.get("suppliers", []):
                    cur.execute(
                        "INSERT INTO suppliers (id, supplier_name, contact_person, phone, email, address, gst_number, status, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);",
                        (r["id"], r["supplier_name"], r.get("contact_person"), r.get("phone"), r.get("email"), r.get("address"), r.get("gst_number"), r.get("status", "active"), r["created_at"], r["updated_at"])
                    )

                # 7. Purchases
                for r in tables.get("purchases", []):
                    cur.execute(
                        "INSERT INTO purchases (id, purchase_no, supplier_id, supplier_name, total_amount, payment_status, payment_mode, notes, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);",
                        (r["id"], r["purchase_no"], r.get("supplier_id"), r["supplier_name"], r["total_amount"], r.get("payment_status", "Paid"), r.get("payment_mode", "Bank Transfer"), r.get("notes"), r["created_at"])
                    )

                # 8. Purchase items
                for r in tables.get("purchase_items", []):
                    cur.execute(
                        "INSERT INTO purchase_items (id, purchase_id, product_id, product_name, size, quantity, purchase_price, total_price, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);",
                        (r["id"], r["purchase_id"], r.get("product_id"), r["product_name"], r["size"], r["quantity"], r["purchase_price"], r["total_price"], r["created_at"])
                    )

                # 9. Bills
                for r in tables.get("bills", []):
                    cur.execute(
                        """
                        INSERT INTO bills (id, bill_no, customer_name, customer_phone, payment_mode, total_amount, status, created_at, customer_id, discount, tax, amount_received, change_returned, pdf_path, billing_address, state_of_supply, terms_conditions, description, round_off, subtotal)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                        """,
                        (r["id"], r["bill_no"], r.get("customer_name"), r.get("customer_phone"), r.get("payment_mode"), r["total_amount"], r.get("status"), r["created_at"], r.get("customer_id"), r.get("discount", 0), r.get("tax", 0), r.get("amount_received", 0), r.get("change_returned", 0), r.get("pdf_path"), r.get("billing_address"), r.get("state_of_supply"), r.get("terms_conditions"), r.get("description"), r.get("round_off", 0), r.get("subtotal", 0))
                    )

                # 10. Bill items
                for r in tables.get("bill_items", []):
                    cur.execute(
                        """
                        INSERT INTO bill_items (id, bill_id, product_id, product_name, size, quantity, selling_price, total_price, created_at, discount_percent, discount_amount, tax_percent, tax_amount, barcode)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                        """,
                        (r["id"], r["bill_id"], r.get("product_id"), r["product_name"], r["size"], r["quantity"], r["selling_price"], r["total_price"], r["created_at"], r.get("discount_percent", 0), r.get("discount_amount", 0), r.get("tax_percent", 0), r.get("tax_amount", 0), r.get("barcode"))
                    )

                # Reset sequence IDs to prevent duplicate key errors on future inserts
                seq_tables = [
                    ("categories", "categories_id_seq"),
                    ("category_sizes", "category_sizes_id_seq"),
                    ("products", "products_id_seq"),
                    ("product_sizes", "product_sizes_id_seq"),
                    ("customers", "customers_id_seq"),
                    ("suppliers", "suppliers_id_seq"),
                    ("purchases", "purchases_id_seq"),
                    ("purchase_items", "purchase_items_id_seq"),
                    ("bills", "bills_id_seq"),
                    ("bill_items", "bill_items_id_seq"),
                ]
                for tbl, seq in seq_tables:
                    cur.execute(f"SELECT setval('{seq}', COALESCE((SELECT MAX(id) FROM {tbl}), 1));")

                conn.commit()

        record_audit_log(
            action="BACKUP_RESTORED",
            user_id=current_user["id"],
            username=current_user["username"],
            details=f"Database restored from backup snapshot '{filename}'",
            ip_address=get_client_ip(),
            status="success"
        )

        return jsonify({
            "success": True,
            "message": f"Database successfully restored from '{filename}'."
        }), 200
    except Exception as e:
        record_audit_log(
            action="BACKUP_RESTORE_FAILED",
            user_id=current_user["id"],
            username=current_user["username"],
            details=f"Database restoration failed: {str(e)}",
            ip_address=get_client_ip(),
            status="failed"
        )
        return jsonify({"success": False, "message": f"Restore failed: {str(e)}"}), 500


@app.route("/api/developer/backups/download/<path:filename>", methods=["GET"])
@developer_required
def developer_download_backup(current_user, filename):
    """Safely serves backup files strictly from BACKUPS_DIR."""
    safe_filename = os.path.basename(filename)
    if not safe_filename.endswith(".json") and not safe_filename.endswith(".sql"):
        return jsonify({"success": False, "message": "Invalid file format."}), 400

    target_path = os.path.join(BACKUPS_DIR, safe_filename)
    if not os.path.isfile(target_path):
        return jsonify({"success": False, "message": "File not found."}), 404

    return send_file(target_path, as_attachment=True, download_name=safe_filename)


# ==========================================
# CATEGORIES API
# ==========================================


@app.route("/api/categories", methods=["GET"])
def get_categories():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT c.id, c.category_name, c.status,
                           COALESCE(array_agg(cs.size ORDER BY cs.size), ARRAY[]::INTEGER[]) AS sizes
                    FROM categories c
                    LEFT JOIN category_sizes cs ON cs.category_id = c.id
                    GROUP BY c.id, c.category_name, c.status
                    ORDER BY c.category_name ASC
                    """
                )
                rows = cur.fetchall()

        categories = []
        for row in rows:
            categories.append({
                "id": row[0],
                "category_name": row[1],
                "status": row[2],
                "sizes": sorted(list(row[3] or [])),
            })

        return jsonify({"categories": categories})
    except Exception:
        return jsonify({"message": "Failed to load categories."}), 500


@app.route("/api/categories", methods=["POST"])
def create_category():
    try:
        payload = request.get_json(silent=True) or {}
        category_name = (payload.get("category_name") or "").strip()
        sizes = validate_sizes_list(payload.get("sizes") or [])

        if not category_name:
            return jsonify({"message": "Category name is required."}), 400

        if not sizes:
            return jsonify({"message": "At least one size must be selected."}), 400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM categories WHERE LOWER(category_name) = LOWER(%s)",
                    (category_name,),
                )
                if cur.fetchone():
                    return jsonify({"message": "Category name must be unique."}), 409

                cur.execute(
                    "INSERT INTO categories (category_name, status) VALUES (%s, 'active') RETURNING id, category_name, status",
                    (category_name,),
                )
                category = cur.fetchone()

                for size in sizes:
                    cur.execute(
                        "INSERT INTO category_sizes (category_id, size) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (category[0], size),
                    )

                conn.commit()

        return jsonify({
            "message": "Category added successfully.",
            "category": {"id": category[0], "category_name": category[1], "status": category[2], "sizes": sizes}
        }), 201
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except psycopg.Error as e:
        print(f"Database error creating category: {e}")
        return jsonify({"message": f"Database error: {str(e)}"}), 500
    except Exception as e:
        print(f"Unexpected error creating category: {e}")
        return jsonify({"message": f"Failed to add category: {str(e)}"}), 500


@app.route("/api/categories/<int:category_id>", methods=["GET"])
def get_category(category_id):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT c.id, c.category_name, c.status,
                           COALESCE(array_agg(cs.size ORDER BY cs.size), ARRAY[]::INTEGER[]) AS sizes
                    FROM categories c
                    LEFT JOIN category_sizes cs ON cs.category_id = c.id
                    WHERE c.id = %s
                    GROUP BY c.id, c.category_name, c.status
                    """,
                    (category_id,),
                )
                row = cur.fetchone()

        if row is None:
            return jsonify({"message": "Category not found."}), 404

        return jsonify({
            "id": row[0],
            "category_name": row[1],
            "status": row[2],
            "sizes": sorted(list(row[3] or [])),
        })
    except Exception:
        return jsonify({"message": "Failed to load category."}), 500


@app.route("/api/categories/<int:category_id>", methods=["PUT"])
def update_category(category_id):
    try:
        payload = request.get_json(silent=True) or {}
        category_name = (payload.get("category_name") or "").strip()
        new_sizes = validate_sizes_list(payload.get("sizes") or [])

        if not category_name:
            return jsonify({"message": "Category name is required."}), 400

        if not new_sizes:
            return jsonify({"message": "At least one size must be selected."}), 400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, category_name FROM categories WHERE id = %s", (category_id,))
                category = cur.fetchone()
                if category is None:
                    return jsonify({"message": "Category not found."}), 404

                cur.execute(
                    "SELECT id FROM categories WHERE LOWER(category_name) = LOWER(%s) AND id != %s",
                    (category_name, category_id),
                )
                if cur.fetchone():
                    return jsonify({"message": "Category name must be unique."}), 409

                cur.execute("SELECT size FROM category_sizes WHERE category_id = %s ORDER BY size ASC", (category_id,))
                current_sizes = [int(item[0]) for item in cur.fetchall()]
                removed_sizes = sorted(set(current_sizes) - set(new_sizes))

                for size in removed_sizes:
                    cur.execute(
                        """
                        SELECT 1 FROM product_sizes ps
                        JOIN products p ON p.id = ps.product_id
                        WHERE p.category_id = %s AND ps.size = %s AND p.status = 'active'
                        LIMIT 1
                        """,
                        (category_id, size),
                    )
                    if cur.fetchone():
                        return jsonify({
                            "message": f"Size {size} is already used by existing products in this category and cannot be removed."
                        }), 409

                cur.execute(
                    "UPDATE categories SET category_name = %s, updated_at = NOW() WHERE id = %s",
                    (category_name, category_id),
                )

                cur.execute("DELETE FROM category_sizes WHERE category_id = %s", (category_id,))
                for size in new_sizes:
                    cur.execute(
                        "INSERT INTO category_sizes (category_id, size) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (category_id, size),
                    )

                conn.commit()

        return jsonify({
            "message": "Category updated successfully.",
            "category": {"id": category_id, "category_name": category_name, "sizes": new_sizes, "status": "active"}
        })
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except psycopg.Error as e:
        print(f"Database error updating category: {e}")
        return jsonify({"message": f"Database error: {str(e)}"}), 500
    except Exception as e:
        print(f"Unexpected error updating category: {e}")
        return jsonify({"message": f"Failed to update category: {str(e)}"}), 500


@app.route("/api/categories/<int:category_id>", methods=["DELETE"])
def delete_category(category_id):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, category_name FROM categories WHERE id = %s", (category_id,))
                cat_row = cur.fetchone()
                if not cat_row:
                    return jsonify({"message": "Category not found."}), 404

                cat_name = cat_row[1]

                # Safe unlink: preserve all product records by setting category_id to NULL
                cur.execute("UPDATE products SET category_id = NULL WHERE category_id = %s", (category_id,))

                # Delete allowed sizes associated with this category
                cur.execute("DELETE FROM category_sizes WHERE category_id = %s", (category_id,))

                # Delete the category
                cur.execute("DELETE FROM categories WHERE id = %s RETURNING id, category_name", (category_id,))
                row = cur.fetchone()
                conn.commit()

        if row is None:
            return jsonify({"message": "Category not found."}), 404

        return jsonify({
            "message": f"Category '{cat_name}' deleted successfully.",
            "category": {"id": row[0], "category_name": row[1]},
        })
    except psycopg.Error as e:
        print(f"Database error deleting category {category_id}: {e}")
        return jsonify({"message": f"Database error: {str(e)}"}), 500
    except Exception as e:
        print(f"Unexpected error deleting category {category_id}: {e}")
        return jsonify({"message": f"Failed to delete category: {str(e)}"}), 500


@app.route("/api/categories/<int:category_id>/sizes", methods=["GET"])
def get_category_sizes(category_id):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT size FROM category_sizes WHERE category_id = %s ORDER BY size ASC",
                    (category_id,),
                )
                rows = cur.fetchall()

        sizes = [int(row[0]) for row in rows]
        return jsonify({"sizes": sizes})
    except Exception:
        return jsonify({"message": "Failed to load category sizes."}), 500


# ==========================================
# PRODUCTS API (Grouped: 1 Product = 1 Row = 1 Barcode)
# ==========================================


def fetch_product_with_sizes(cur, product_id):
    cur.execute(
        """
        SELECT p.id, p.product_name, p.category_id, c.category_name,
               p.selling_price, p.barcode, p.status, p.created_at, p.updated_at,
               COALESCE(p.product_code, CONCAT('FW-', LPAD(p.id::text, 4, '0'))),
               COALESCE(p.purchase_price, 0),
               COALESCE(p.description, '')
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.id = %s
        """,
        (product_id,),
    )
    product_row = cur.fetchone()
    if not product_row:
        return None

    cur.execute(
        """
        SELECT size, stock_quantity
        FROM product_sizes
        WHERE product_id = %s
        ORDER BY size ASC
        """,
        (product_id,),
    )
    sizes = [{"size": row[0], "stock_quantity": row[1]} for row in cur.fetchall()]
    return serialize_product(product_row, sizes)


@app.route("/api/products", methods=["GET"])
def get_products():
    try:
        search_term = (request.args.get("search") or "").strip()
        barcode_param = (request.args.get("barcode") or "").strip()

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                query = """
                    SELECT p.id, p.product_name, p.category_id, c.category_name,
                           p.selling_price, p.barcode, p.status, p.created_at, p.updated_at,
                           COALESCE(p.product_code, CONCAT('FW-', LPAD(p.id::text, 4, '0'))),
                           COALESCE(p.purchase_price, 0),
                           COALESCE(p.description, '')
                    FROM products p
                    LEFT JOIN categories c ON c.id = p.category_id
                    WHERE p.status = 'active'
                """
                params = []

                if barcode_param:
                    query += " AND (p.barcode = %s OR p.product_code = %s OR LOWER(p.barcode) = LOWER(%s) OR LOWER(p.product_code) = LOWER(%s))"
                    params.extend([barcode_param, barcode_param, barcode_param, barcode_param])
                elif search_term:
                    query += """
                        AND (
                            LOWER(p.product_name) LIKE %s OR
                            LOWER(COALESCE(p.product_code, '')) LIKE %s OR
                            LOWER(COALESCE(c.category_name, '')) LIKE %s OR
                            LOWER(p.barcode) LIKE %s OR
                            EXISTS (
                                SELECT 1 FROM product_sizes ps
                                WHERE ps.product_id = p.id
                                  AND CAST(ps.size AS TEXT) = %s
                            )
                        )
                    """
                    search_pattern = f"%{search_term.lower()}%"
                    params.extend([search_pattern, search_pattern, search_pattern, search_pattern, search_term])

                query += " ORDER BY p.created_at DESC, p.id DESC"
                cur.execute(query, params)
                product_rows = cur.fetchall()

                if not product_rows:
                    return jsonify({"products": []})

                product_ids = [row[0] for row in product_rows]
                cur.execute(
                    """
                    SELECT product_id, size, stock_quantity
                    FROM product_sizes
                    WHERE product_id = ANY(%s)
                    ORDER BY product_id, size ASC
                    """,
                    (product_ids,),
                )
                sizes_by_product = {}
                for p_id, size, stock in cur.fetchall():
                    if p_id not in sizes_by_product:
                        sizes_by_product[p_id] = []
                    sizes_by_product[p_id].append({"size": size, "stock_quantity": stock})

                products = [
                    serialize_product(row, sizes_by_product.get(row[0], []))
                    for row in product_rows
                ]

        return jsonify({"products": products})
    except Exception as e:
        return jsonify({"message": f"Failed to load products: {str(e)}"}), 500


@app.route("/api/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                product = fetch_product_with_sizes(cur, product_id)

        if product is None:
            return jsonify({"message": "Product not found."}), 404

        return jsonify({"product": product})
    except Exception as e:
        return jsonify({"message": f"Failed to load product: {str(e)}"}), 500


@app.route("/api/products/barcode/<barcode>", methods=["GET"])
def get_product_by_barcode(barcode):
    try:
        import re
        cleaned_barcode = barcode.strip()
        encoded_size = None

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # 1. Try direct exact match
                cur.execute(
                    """
                    SELECT id FROM products 
                    WHERE (barcode = %s OR product_code = %s OR LOWER(barcode) = LOWER(%s) OR LOWER(product_code) = LOWER(%s))
                      AND status = 'active'
                    LIMIT 1;
                    """,
                    (cleaned_barcode, cleaned_barcode, cleaned_barcode, cleaned_barcode),
                )
                row = cur.fetchone()

                # 2. If not found, check if barcode encodes a size suffix (e.g. FW-0033-8, 890398596302-8, FW-0033/8)
                if not row:
                    m = re.match(r"^(.+?)[-_/\s]+([0-9]{1,2})$", cleaned_barcode)
                    if m:
                        base_code = m.group(1).strip()
                        encoded_size = int(m.group(2))
                        cur.execute(
                            """
                            SELECT id FROM products 
                            WHERE (barcode = %s OR product_code = %s OR LOWER(barcode) = LOWER(%s) OR LOWER(product_code) = LOWER(%s))
                              AND status = 'active'
                            LIMIT 1;
                            """,
                            (base_code, base_code, base_code, base_code),
                        )
                        row = cur.fetchone()

                if not row:
                    return jsonify({"message": "Product not found for this barcode."}), 404

                product = fetch_product_with_sizes(cur, row[0])
                if product and encoded_size is not None:
                    product["scanned_size"] = encoded_size

        return jsonify({"product": product})
    except Exception as e:
        return jsonify({"message": f"Failed to load product: {str(e)}"}), 500


@app.route("/api/products", methods=["POST"])
def create_product():
    try:
        payload = request.get_json(silent=True) or {}
        validated, errors = validate_product_payload(payload)

        if errors:
            return jsonify({"message": errors[0]}), 400

        size_entries = normalize_size_stock_entries(payload)
        if not size_entries:
            return jsonify({"message": "No sizes available for this category. Configure sizes from Categories."}), 400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM categories WHERE id = %s AND status = 'active'", (validated["category_id"],))
                if cur.fetchone() is None:
                    return jsonify({"message": "Category is invalid or inactive."}), 400

                cur.execute(
                    "SELECT size FROM category_sizes WHERE category_id = %s ORDER BY size ASC",
                    (validated["category_id"],),
                )
                allowed_sizes = {int(row[0]) for row in cur.fetchall()}
                if not allowed_sizes:
                    return jsonify({"message": "No sizes available for this category. Configure sizes from Categories."}), 400

                invalid_size = next((entry["size"] for entry in size_entries if entry["size"] not in allowed_sizes), None)
                if invalid_size is not None:
                    return jsonify({"message": f"Size {invalid_size} is not available for this category."}), 400

                # Check for duplicate product name in same category
                cur.execute(
                    "SELECT id FROM products WHERE LOWER(product_name) = LOWER(%s) AND category_id = %s AND status = 'active'",
                    (validated["product_name"], validated["category_id"]),
                )
                if cur.fetchone():
                    return jsonify({"message": "Product already exists in this category."}), 409

                # Generate product_code if not supplied
                product_code = validated.get("product_code")
                if not product_code:
                    cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM products")
                    next_pid = cur.fetchone()[0]
                    product_code = f"FW-{next_pid:04d}"

                # Generate ONE barcode for the entire product
                try:
                    barcode = generate_unique_barcode(cur)
                    cur.execute(
                        """
                        INSERT INTO products (product_name, product_code, category_id, selling_price, purchase_price, description, barcode, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id, product_name, category_id, selling_price, barcode, status, created_at, updated_at
                        """,
                        (
                            validated["product_name"],
                            product_code,
                            validated["category_id"],
                            validated["selling_price"],
                            validated.get("purchase_price", 0.0),
                            validated.get("description", ""),
                            barcode,
                            validated["status"],
                        ),
                    )
                    new_product_row = cur.fetchone()
                    product_id = new_product_row[0]
                except psycopg.errors.UniqueViolation as uv:
                    conn.rollback()
                    return jsonify({"message": f"Product with this name or barcode already exists: {str(uv)}"}), 409

                # Insert sizes into product_sizes
                for entry in size_entries:
                    cur.execute(
                        """
                        INSERT INTO product_sizes (product_id, size, stock_quantity)
                        VALUES (%s, %s, %s)
                        """,
                        (product_id, entry["size"], entry["stock_quantity"]),
                    )

                conn.commit()

                product_data = fetch_product_with_sizes(cur, product_id)

        return jsonify({
            "message": "Product added successfully.",
            "product": product_data,
        }), 201
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except psycopg.Error as exc:
        return jsonify({"message": f"Database error: {str(exc)}"}), 500
    except Exception as exc:
        return jsonify({"message": f"Failed to add product: {str(exc)}"}), 500


@app.route("/api/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    try:
        payload = request.get_json(silent=True) or {}
        validated, errors = validate_product_payload(payload, is_update=True)

        if errors:
            return jsonify({"message": errors[0]}), 400

        size_entries = normalize_size_stock_entries(payload)
        if not size_entries:
            return jsonify({"message": "No sizes available for this category. Configure sizes from Categories."}), 400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, barcode FROM products WHERE id = %s
                    """,
                    (product_id,),
                )
                current_row = cur.fetchone()
                if current_row is None:
                    return jsonify({"message": "Product not found."}), 404

                category_id = validated["category_id"]
                cur.execute("SELECT 1 FROM categories WHERE id = %s AND status = 'active'", (category_id,))
                if cur.fetchone() is None:
                    return jsonify({"message": "Category is invalid or inactive."}), 400

                cur.execute(
                    "SELECT size FROM category_sizes WHERE category_id = %s ORDER BY size ASC",
                    (category_id,),
                )
                allowed_sizes = {int(row[0]) for row in cur.fetchall()}
                if not allowed_sizes:
                    return jsonify({"message": "No sizes available for this category. Configure sizes from Categories."}), 400

                invalid_size = next((entry["size"] for entry in size_entries if entry["size"] not in allowed_sizes), None)
                if invalid_size is not None:
                    return jsonify({"message": f"Size {invalid_size} is not available for this category."}), 400

                # Check duplicate name/category on another product
                cur.execute(
                    """
                    SELECT id FROM products
                    WHERE LOWER(product_name) = LOWER(%s)
                      AND category_id = %s
                      AND id != %s
                      AND status = 'active'
                    LIMIT 1
                    """,
                    (validated["product_name"], category_id, product_id),
                )
                if cur.fetchone():
                    return jsonify({"message": "Another active product already has this name in this category."}), 409

                product_code = validated.get("product_code")
                if not product_code:
                    product_code = f"FW-{product_id:04d}"

                # Update product WITHOUT changing barcode
                cur.execute(
                    """
                    UPDATE products
                    SET product_name = %s,
                        product_code = %s,
                        category_id = %s,
                        selling_price = %s,
                        purchase_price = %s,
                        description = %s,
                        status = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (
                        validated["product_name"],
                        product_code,
                        category_id,
                        validated["selling_price"],
                        validated.get("purchase_price", 0.0),
                        validated.get("description", ""),
                        validated["status"],
                        product_id,
                    ),
                )

                # Upsert size stocks
                submitted_sizes = set()
                for entry in size_entries:
                    size = entry["size"]
                    stock_quantity = entry["stock_quantity"]
                    submitted_sizes.add(size)

                    cur.execute(
                        """
                        INSERT INTO product_sizes (product_id, size, stock_quantity, updated_at)
                        VALUES (%s, %s, %s, NOW())
                        ON CONFLICT (product_id, size)
                        DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity, updated_at = NOW()
                        """,
                        (product_id, size, stock_quantity),
                    )

                # Delete sizes no longer in submitted list
                cur.execute(
                    """
                    DELETE FROM product_sizes
                    WHERE product_id = %s AND NOT (size = ANY(%s))
                    """,
                    (product_id, list(submitted_sizes)),
                )

                conn.commit()

                product_data = fetch_product_with_sizes(cur, product_id)

        return jsonify({
            "message": "Product updated successfully.",
            "product": product_data,
        })
    except ValueError as exc:
        return jsonify({"message": str(exc)}), 400
    except psycopg.Error as exc:
        return jsonify({"message": f"Database error: {str(exc)}"}), 500
    except Exception as exc:
        return jsonify({"message": f"Failed to update product: {str(exc)}"}), 500


@app.route("/api/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE products SET status = 'inactive', updated_at = NOW() WHERE id = %s RETURNING id, product_name, status",
                    (product_id,),
                )
                row = cur.fetchone()
                conn.commit()

        if row is None:
            return jsonify({"message": "Product not found."}), 404

        return jsonify({
            "message": "Product deleted/deactivated.",
            "product": {"id": row[0], "product_name": row[1], "status": row[2]},
        })
    except psycopg.Error:
        return jsonify({"message": "Database connection error."}), 500
    except Exception:
        return jsonify({"message": "Failed to delete product."}), 500


# ==========================================
# BILLING API (Workflow: Scan Barcode -> Select Size -> Reduce Stock for Size)
# ==========================================


@app.route("/api/billing/next-number", methods=["GET"])
def get_next_invoice_number():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COALESCE(MAX(id), 0) + 1024 FROM bills")
                next_num = cur.fetchone()[0]
                return jsonify({"next_bill_no": f"SW-{next_num}"})
    except Exception as e:
        return jsonify({"next_bill_no": "SW-1031", "error": str(e)}), 200


@app.route("/api/billing/checkout", methods=["POST"])
def billing_checkout():
    try:
        # Extract and verify authentication session
        auth_header = request.headers.get("Authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
        elif request.headers.get("X-Auth-Token"):
            token = request.headers.get("X-Auth-Token").strip()

        if not token:
            return jsonify({
                "success": False,
                "message": "Authentication required to generate bills. Please log in."
            }), 401

        payload = request.get_json(silent=True) or {}
        items = payload.get("items") or []
        customer_id = payload.get("customer_id")
        customer_name = (payload.get("customer_name") or "Walk-in Customer").strip()
        customer_phone = (payload.get("customer_phone") or "").strip()
        billing_address = (payload.get("billing_address") or "").strip()
        state_of_supply = (payload.get("state_of_supply") or "27-Maharashtra").strip()
        terms_conditions = (payload.get("terms_conditions") or "").strip()
        description = (payload.get("description") or "").strip()
        payment_mode = (payload.get("payment_mode") or "Cash").strip()
        discount = max(0.0, float(payload.get("discount") or 0.0))
        discount_percent = max(0.0, min(100.0, float(payload.get("discount_percent") or 0.0)))
        delivery_charges = max(0.0, float(payload.get("delivery_charges") or 0.0))
        tax = max(0.0, float(payload.get("tax") or 0.0))
        round_off = float(payload.get("round_off") or 0.0)
        subtotal_in = max(0.0, float(payload.get("subtotal") or 0.0))
        amount_received = max(0.0, float(payload.get("amount_received") or 0.0))
        change_returned = max(0.0, float(payload.get("change_returned") or 0.0))

        if not items or not isinstance(items, list):
            return jsonify({"message": "Bill must contain at least one item."}), 400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # 1. Authorize user session & verify billing status in live database
                cur.execute(
                    """
                    SELECT u.id, u.username, u.shop_name, u.billing_status, u.status
                    FROM user_sessions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.token = %s AND s.expires_at > NOW();
                    """,
                    (token,)
                )
                auth_user = cur.fetchone()
                if not auth_user:
                    return jsonify({
                        "success": False,
                        "message": "Session expired or invalid. Please log in again."
                    }), 401

                auth_user_id, auth_username, auth_shop_name, auth_billing_status, auth_status = auth_user

                if auth_status == "archived":
                    return jsonify({
                        "success": False,
                        "message": "This shop account has been archived. Billing operations are permanently restricted under retention policy."
                    }), 403

                if auth_status != "active":
                    return jsonify({
                        "success": False,
                        "message": "This shop account is currently deactivated. Billing operations are blocked."
                    }), 403

                if auth_billing_status == "suspended":
                    return jsonify({
                        "success": False,
                        "billing_suspended": True,
                        "message": f"Billing operations are currently SUSPENDED for shop '{auth_shop_name or auth_username}'. You cannot create new invoices or complete POS checkout. Please contact the administrator to resume billing."
                    }), 403

                # Generate Bill No: e.g. SW-1001, SW-1002...
                cur.execute("SELECT COALESCE(MAX(id), 0) + 1024 FROM bills")
                next_num = cur.fetchone()[0]
                bill_no = f"SW-{next_num}"

                calc_subtotal = 0.0
                processed_items = []

                # Phase 1: Aggregate requested quantities per (product_id, size)
                item_demand = {}
                for it in items:
                    pid = it.get("product_id")
                    sz = it.get("size")
                    try:
                        q = int(it.get("quantity") or 0)
                    except (ValueError, TypeError):
                        q = 0
                    if not pid or sz is None or q <= 0:
                        return jsonify({"message": "Invalid product, size, or quantity in bill item."}), 400
                    key = (int(pid), int(sz))
                    item_demand[key] = item_demand.get(key, 0) + q

                # Phase 2: Lock stock rows and validate available quantities for ALL items
                stock_info = {}
                for (pid, sz), total_req in item_demand.items():
                    cur.execute(
                        """
                        SELECT ps.stock_quantity, p.product_name, p.selling_price, p.barcode
                        FROM product_sizes ps
                        JOIN products p ON p.id = ps.product_id
                        WHERE ps.product_id = %s AND ps.size = %s AND p.status = 'active'
                        FOR UPDATE
                        """,
                        (pid, sz),
                    )
                    stock_row = cur.fetchone()
                    if not stock_row:
                        return jsonify({"message": f"Size {sz} not found for product ID {pid}."}), 404

                    current_stock, p_name, db_price, db_barcode = stock_row
                    if current_stock < total_req:
                        return jsonify({
                            "message": f"Insufficient stock for {p_name} (Size {sz}). Available: {current_stock}, Requested: {total_req}"
                        }), 400

                    stock_info[(pid, sz)] = {
                        "current_stock": current_stock,
                        "product_name": p_name,
                        "db_price": float(db_price),
                        "db_barcode": db_barcode or "",
                    }

                # Phase 3: ALL items passed validation! Now deduct stock and build line items
                for (pid, sz), total_req in item_demand.items():
                    cur.execute(
                        """
                        UPDATE product_sizes
                        SET stock_quantity = stock_quantity - %s, updated_at = NOW()
                        WHERE product_id = %s AND size = %s
                        """,
                        (total_req, pid, sz),
                    )

                for item in items:
                    pid = int(item.get("product_id"))
                    sz = int(item.get("size"))
                    qty = int(item.get("quantity") or 1)
                    user_price = item.get("selling_price")
                    item_barcode = (item.get("barcode") or "").strip()
                    disc_pct = float(item.get("discount_percent") or 0.0)
                    disc_amt = float(item.get("discount_amount") or 0.0)
                    tax_pct = float(item.get("tax_percent") or 0.0)
                    tax_amt = float(item.get("tax_amount") or 0.0)

                    s_meta = stock_info[(pid, sz)]
                    p_name = s_meta["product_name"]
                    db_price = s_meta["db_price"]
                    db_barcode = s_meta["db_barcode"]

                    price_to_use = float(user_price) if user_price is not None and float(user_price) > 0 else db_price
                    item_barcode_to_use = item_barcode if item_barcode else db_barcode

                    line_base = price_to_use * qty
                    calc_subtotal += line_base
                    line_final = max(0.0, line_base - disc_amt + tax_amt)

                    processed_items.append({
                        "product_id": pid,
                        "product_name": p_name,
                        "size": sz,
                        "quantity": qty,
                        "selling_price": price_to_use,
                        "barcode": item_barcode_to_use,
                        "discount_percent": disc_pct,
                        "discount_amount": disc_amt,
                        "tax_percent": tax_pct,
                        "tax_amount": tax_amt,
                        "total_price": line_final,
                    })

                subtotal = round(calc_subtotal if calc_subtotal > 0 else subtotal_in, 2)
                if discount_percent > 0:
                    discount_amount = round(subtotal * (discount_percent / 100.0), 2)
                elif discount > 0:
                    discount_amount = min(subtotal, round(discount, 2))
                    discount_percent = round((discount_amount / subtotal) * 100.0, 2) if subtotal > 0 else 0.0
                else:
                    discount_amount = 0.0
                    discount_percent = 0.0

                delivery_charges = round(delivery_charges, 2)
                total_before_round_off = round(subtotal - discount_amount + delivery_charges + tax, 2)

                is_round_off = bool(payload.get("is_round_off", True)) if "is_round_off" in payload else (abs(round_off) > 0.0001 or round_off != 0.0)
                if is_round_off:
                    grand_total = max(0.0, float(round(total_before_round_off)))
                    round_off = round(grand_total - total_before_round_off, 2)
                else:
                    grand_total = max(0.0, total_before_round_off)
                    round_off = 0.0

                is_account_sale = payment_mode in ["Add in Account", "Credit"]

                if is_account_sale:
                    if not customer_id:
                        return jsonify({"message": "Please select a registered customer to add this bill to their account."}), 400
                    dues_amount = max(0.0, grand_total - amount_received)
                    bill_status = "Unpaid" if dues_amount > 0 else "Paid"
                else:
                    bill_status = "Paid"
                    dues_amount = 0.0

                effective_shop_name = auth_shop_name or "SWAMIDATT FOOTWEAR - Main Branch"

                # Insert bill with user_id and shop_name
                cur.execute(
                    """
                    INSERT INTO bills (
                        bill_no, customer_id, customer_name, customer_phone, billing_address,
                        state_of_supply, terms_conditions, description, payment_mode, subtotal,
                        discount, discount_percent, discount_amount, delivery_charges, tax, round_off,
                        total_amount, amount_received, change_returned, status,
                        user_id, shop_name
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, bill_no, customer_name, customer_phone, payment_mode, total_amount, status, created_at,
                              discount, tax, amount_received, change_returned, pdf_path, billing_address, state_of_supply,
                              terms_conditions, description, round_off, subtotal, user_id, shop_name,
                              discount_percent, discount_amount, delivery_charges
                    """,
                    (
                        bill_no, customer_id if customer_id else None, customer_name, customer_phone,
                        billing_address, state_of_supply, terms_conditions, description, payment_mode,
                        subtotal, discount_amount, discount_percent, discount_amount, delivery_charges, tax, round_off,
                        grand_total, amount_received, change_returned, bill_status,
                        auth_user_id, effective_shop_name
                    ),
                )
                bill_row = cur.fetchone()
                bill_id = bill_row[0]

                # Insert bill items
                for it in processed_items:
                    cur.execute(
                        """
                        INSERT INTO bill_items (
                            bill_id, product_id, product_name, size, quantity, selling_price,
                            total_price, barcode, discount_percent, discount_amount, tax_percent, tax_amount
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            bill_id,
                            it["product_id"],
                            it["product_name"],
                            it["size"],
                            it["quantity"],
                            it["selling_price"],
                            it["total_price"],
                            it["barcode"],
                            it["discount_percent"],
                            it["discount_amount"],
                            it["tax_percent"],
                            it["tax_amount"],
                        ),
                    )

                if customer_id:
                    if is_account_sale and dues_amount > 0:
                        cur.execute(
                            """
                            UPDATE customers 
                            SET outstanding_amount = outstanding_amount + %s, updated_at = NOW() 
                            WHERE id = %s
                            """,
                            (dues_amount, customer_id),
                        )
                    else:
                        cur.execute("UPDATE customers SET updated_at = NOW() WHERE id = %s", (customer_id,))

                conn.commit()

        return jsonify({
            "message": "Bill created successfully.",
            "bill": {
                "id": bill_row[0],
                "bill_no": bill_row[1],
                "customer_name": bill_row[2],
                "customer_phone": bill_row[3],
                "payment_mode": bill_row[4],
                "total_amount": float(bill_row[5]),
                "status": bill_row[6],
                "created_at": normalize_datetime(bill_row[7]),
                "discount": float(bill_row[8] or 0),
                "tax": float(bill_row[9] or 0),
                "amount_received": float(bill_row[10] or 0),
                "change_returned": float(bill_row[11] or 0),
                "pdf_path": bill_row[12] or f"invoices/{bill_row[1]}.pdf",
                "billing_address": bill_row[13] or "",
                "state_of_supply": bill_row[14] or "27-Maharashtra",
                "terms_conditions": bill_row[15] or "",
                "description": bill_row[16] or "",
                "round_off": float(bill_row[17] or 0),
                "subtotal": float(bill_row[18] or subtotal),
                "user_id": bill_row[19],
                "shop_name": bill_row[20] or effective_shop_name,
                "discount_percent": float(bill_row[21] or discount_percent),
                "discount_amount": float(bill_row[22] or discount_amount),
                "delivery_charges": float(bill_row[23] or delivery_charges),
                "items": processed_items,
            }
        }), 201
    except Exception as e:
        return jsonify({"message": f"Checkout failed: {str(e)}"}), 500


@app.route("/api/bills/<int:bill_id>/save-pdf", methods=["POST"])
def save_bill_pdf(bill_id):
    try:
        payload = request.get_json(silent=True) or {}
        bill_no = (payload.get("bill_no") or "").strip()
        pdf_base64 = payload.get("pdf_base64")

        if not pdf_base64:
            return jsonify({"message": "PDF data is required."}), 400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if not bill_no:
                    cur.execute("SELECT bill_no FROM bills WHERE id = %s", (bill_id,))
                    row = cur.fetchone()
                    if not row:
                        return jsonify({"message": "Bill not found."}), 404
                    bill_no = row[0]

                filename = f"{bill_no}.pdf"
                target_path = os.path.join(INVOICES_DIR, filename)
                pdf_bytes = base64.b64decode(pdf_base64)
                with open(target_path, "wb") as f:
                    f.write(pdf_bytes)

                pdf_rel_path = f"invoices/{filename}"
                cur.execute(
                    "UPDATE bills SET pdf_path = %s WHERE id = %s",
                    (pdf_rel_path, bill_id),
                )
                conn.commit()

        return jsonify({
            "message": "PDF saved successfully.",
            "pdf_path": pdf_rel_path,
            "filename": filename,
        })
    except Exception as e:
        return jsonify({"message": f"Failed to save PDF: {str(e)}"}), 500


@app.route("/api/bills/<int:bill_id>/pdf", methods=["GET"])
def download_bill_pdf(bill_id):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT bill_no, pdf_path FROM bills WHERE id = %s", (bill_id,))
                row = cur.fetchone()
                if not row:
                    return jsonify({"message": "Bill not found."}), 404
                bill_no, pdf_path = row
                filename = f"{bill_no}.pdf"
                target_path = os.path.join(INVOICES_DIR, filename)
                if not os.path.exists(target_path):
                    return jsonify({"message": "PDF not generated yet."}), 404
                return send_from_directory(
                    INVOICES_DIR,
                    filename,
                    as_attachment=True,
                    download_name=filename,
                    mimetype="application/pdf",
                )
    except Exception as e:
        return jsonify({"message": f"Failed to fetch PDF: {str(e)}"}), 500


@app.route("/api/bills", methods=["GET"])
def get_bills():
    try:
        search = (request.args.get("search") or "").strip()
        limit = int(request.args.get("limit") or 100)
        customer_id = request.args.get("customer_id")

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                query = """
                    SELECT b.id, b.bill_no, b.customer_name, b.customer_phone,
                           b.payment_mode, b.total_amount, b.status, b.created_at,
                           COALESCE(COUNT(bi.id), 0) AS total_items,
                           COALESCE(b.discount, 0), COALESCE(b.tax, 0),
                           COALESCE(b.pdf_path, ''),
                           COALESCE(b.subtotal, b.total_amount),
                           COALESCE(b.discount_percent, 0),
                           COALESCE(b.discount_amount, b.discount, 0),
                           COALESCE(b.delivery_charges, 0),
                           COALESCE(b.round_off, 0)
                    FROM bills b
                    LEFT JOIN bill_items bi ON bi.bill_id = b.id
                    WHERE 1=1
                """
                params = []
                if search:
                    query += " AND (LOWER(b.bill_no) LIKE %s OR LOWER(b.customer_name) LIKE %s OR b.customer_phone LIKE %s)"
                    pat = f"%{search.lower()}%"
                    params.extend([pat, pat, pat])
                if customer_id:
                    query += " AND b.customer_id = %s"
                    params.append(int(customer_id))

                query += """
                    GROUP BY b.id, b.bill_no, b.customer_name, b.customer_phone, b.payment_mode, b.total_amount, b.status, b.created_at, b.discount, b.tax, b.pdf_path, b.subtotal, b.discount_percent, b.discount_amount, b.delivery_charges, b.round_off
                    ORDER BY b.created_at DESC
                    LIMIT %s
                """
                params.append(limit)
                cur.execute(query, params)
                rows = cur.fetchall()

        bills = [
            {
                "id": r[0],
                "bill_no": r[1],
                "customer": r[2],
                "phone": r[3],
                "payment": r[4],
                "amount": f"₹{float(r[5]):,.2f}",
                "raw_amount": float(r[5]),
                "status": r[6],
                "date": normalize_datetime(r[7]),
                "items": str(r[8]),
                "discount": float(r[9]),
                "tax": float(r[10]),
                "pdf_path": r[11],
                "subtotal": float(r[12]),
                "discount_percent": float(r[13]),
                "discount_amount": float(r[14]),
                "delivery_charges": float(r[15]),
                "round_off": float(r[16]),
            }
            for r in rows
        ]

        return jsonify({"bills": bills})
    except Exception as e:
        return jsonify({"message": f"Failed to load bills: {str(e)}"}), 500


@app.route("/api/bills/<int:bill_id>", methods=["GET"])
def get_bill_detail(bill_id):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT b.id, b.bill_no, b.customer_id, b.customer_name, b.customer_phone,
                           b.payment_mode, b.total_amount, b.status, b.created_at,
                           COALESCE(b.discount, 0), COALESCE(b.tax, 0),
                           COALESCE(b.amount_received, 0), COALESCE(b.change_returned, 0),
                           COALESCE(b.pdf_path, ''),
                           COALESCE(b.billing_address, ''),
                           COALESCE(b.subtotal, b.total_amount),
                           COALESCE(b.round_off, 0),
                           COALESCE(b.discount_percent, 0),
                           COALESCE(b.discount_amount, b.discount, 0),
                           COALESCE(b.delivery_charges, 0)
                    FROM bills b
                    WHERE b.id = %s
                    """,
                    (bill_id,),
                )
                bill_row = cur.fetchone()
                if not bill_row:
                    return jsonify({"message": "Bill not found"}), 404

                cur.execute(
                    """
                    SELECT bi.id, bi.product_id, bi.product_name, bi.size, bi.quantity,
                           bi.selling_price, bi.total_price, COALESCE(p.barcode, '')
                    FROM bill_items bi
                    LEFT JOIN products p ON p.id = bi.product_id
                    WHERE bi.bill_id = %s
                    ORDER BY bi.id ASC
                    """,
                    (bill_id,),
                )
                items = [
                    {
                        "id": r[0],
                        "product_id": r[1],
                        "product_name": r[2],
                        "size": r[3],
                        "quantity": r[4],
                        "selling_price": float(r[5]),
                        "total_price": float(r[6]),
                        "barcode": r[7],
                    }
                    for r in cur.fetchall()
                ]

        total_amount = float(bill_row[6])
        status = bill_row[7]
        payment_mode = bill_row[5]
        amount_received = float(bill_row[11])
        change_returned = float(bill_row[12])

        if status == "Unpaid" or payment_mode in ["Add in Account", "Credit"]:
            amount_paid = min(total_amount, max(0.0, amount_received - change_returned))
            outstanding_amount = max(0.0, total_amount - amount_paid)
        else:
            amount_paid = min(total_amount, max(0.0, amount_received - change_returned)) if amount_received > 0 else total_amount
            outstanding_amount = 0.0

        return jsonify({
            "bill": {
                "id": bill_row[0],
                "bill_no": bill_row[1],
                "customer_id": bill_row[2],
                "customer_name": bill_row[3],
                "customer_phone": bill_row[4],
                "payment_mode": payment_mode,
                "total_amount": total_amount,
                "status": status,
                "created_at": normalize_datetime(bill_row[8]),
                "discount": float(bill_row[9]),
                "tax": float(bill_row[10]),
                "amount_received": amount_received,
                "change_returned": change_returned,
                "amount_paid": amount_paid,
                "outstanding_amount": outstanding_amount,
                "pdf_path": bill_row[13] or f"invoices/{bill_row[1]}.pdf",
                "billing_address": bill_row[14],
                "subtotal": float(bill_row[15]),
                "round_off": float(bill_row[16]),
                "discount_percent": float(bill_row[17]),
                "discount_amount": float(bill_row[18]),
                "delivery_charges": float(bill_row[19]),
                "items": items,
            }
        })
    except Exception as e:
        return jsonify({"message": f"Failed to load bill: {str(e)}"}), 500


# ==========================================
# CUSTOMERS API
# ==========================================

@app.route("/api/customers", methods=["GET"])
def get_customers():
    try:
        search = (request.args.get("search") or "").strip()
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                query = """
                    SELECT c.id, c.name, c.phone, c.email, c.address, c.outstanding_amount, c.status, c.created_at,
                           COALESCE(COUNT(b.id), 0) AS total_bills,
                           COALESCE(SUM(b.total_amount), 0) AS total_spent,
                           MAX(b.created_at) AS last_purchase
                    FROM customers c
                    LEFT JOIN bills b ON b.customer_id = c.id
                    WHERE c.status = 'active'
                """
                params = []
                if search:
                    query += " AND (LOWER(c.name) LIKE %s OR c.phone LIKE %s)"
                    pat = f"%{search.lower()}%"
                    params.extend([pat, pat])
                query += " GROUP BY c.id ORDER BY c.name ASC"
                cur.execute(query, params)
                rows = cur.fetchall()

        customers = [
            {
                "id": r[0],
                "name": r[1],
                "phone": r[2] or "—",
                "email": r[3] or "—",
                "address": r[4] or "—",
                "outstanding_amount": float(r[5]),
                "status": r[6],
                "created_at": normalize_datetime(r[7]),
                "total_bills": r[8],
                "total_spent": float(r[9]),
                "last_purchase": normalize_datetime(r[10]) if r[10] else "Never",
            }
            for r in rows
        ]
        return jsonify({"customers": customers})
    except Exception as e:
        return jsonify({"message": f"Failed to load customers: {str(e)}"}), 500


@app.route("/api/customers", methods=["POST"])
def create_customer():
    try:
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        phone = (data.get("phone") or "").strip()
        email = (data.get("email") or "").strip()
        address = (data.get("address") or "").strip()
        outstanding = float(data.get("outstanding_amount") or 0.0)

        if not name:
            return jsonify({"message": "Customer name is required."}), 400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if phone:
                    cur.execute("SELECT id FROM customers WHERE phone = %s", (phone,))
                    if cur.fetchone():
                        return jsonify({"message": "A customer with this phone number already exists."}), 409

                cur.execute(
                    """
                    INSERT INTO customers (name, phone, email, address, outstanding_amount, status)
                    VALUES (%s, %s, %s, %s, %s, 'active')
                    RETURNING id, name, phone, email, address, outstanding_amount, status, created_at
                    """,
                    (name, phone or None, email or None, address or None, outstanding),
                )
                row = cur.fetchone()
                conn.commit()

        return jsonify({
            "message": "Customer added successfully.",
            "customer": {
                "id": row[0],
                "name": row[1],
                "phone": row[2] or "—",
                "email": row[3] or "—",
                "address": row[4] or "—",
                "outstanding_amount": float(row[5]),
                "status": row[6],
                "created_at": normalize_datetime(row[7]),
                "total_bills": 0,
                "total_spent": 0.0,
                "last_purchase": "Never",
            }
        }), 201
    except Exception as e:
        return jsonify({"message": f"Failed to create customer: {str(e)}"}), 500


@app.route("/api/customers/<int:customer_id>", methods=["GET"])
def get_customer_profile(customer_id):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, name, phone, email, address, outstanding_amount, status, created_at
                    FROM customers
                    WHERE id = %s
                    """,
                    (customer_id,),
                )
                c_row = cur.fetchone()
                if not c_row:
                    return jsonify({"message": "Customer not found."}), 404

                cur.execute(
                    """
                    SELECT 
                        b.id,
                        b.bill_no,
                        b.created_at,
                        COALESCE(items_stat.items_count, 0) AS items_count,
                        COALESCE(items_stat.pairs_count, 0) AS pairs_count,
                        b.total_amount,
                        b.payment_mode,
                        COALESCE(b.amount_received, 0) AS amount_received,
                        COALESCE(b.change_returned, 0) AS change_returned,
                        b.status,
                        COALESCE(b.pdf_path, '') AS pdf_path,
                        COALESCE(b.billing_address, '') AS billing_address,
                        COALESCE(b.subtotal, b.total_amount) AS subtotal,
                        COALESCE(b.discount, 0) AS discount,
                        COALESCE(b.tax, 0) AS tax
                    FROM bills b
                    LEFT JOIN (
                        SELECT bill_id, COUNT(id) AS items_count, SUM(quantity) AS pairs_count
                        FROM bill_items
                        GROUP BY bill_id
                    ) items_stat ON items_stat.bill_id = b.id
                    WHERE b.customer_id = %s
                    ORDER BY b.created_at DESC
                    """,
                    (customer_id,),
                )
                bills_raw = cur.fetchall()

        bills = []
        total_spent = 0.0
        total_paid = 0.0
        total_pairs = 0

        for r in bills_raw:
            b_id = r[0]
            bill_no = r[1]
            b_date = r[2]
            items_cnt = int(r[3])
            pairs_cnt = int(r[4])
            total_amt = float(r[5])
            pay_mode = r[6]
            rec_amt = float(r[7])
            chg_amt = float(r[8])
            b_status = r[9]
            pdf_path = r[10]
            b_address = r[11]
            subtotal = float(r[12])
            discount = float(r[13])
            tax = float(r[14])

            if pay_mode in ["Add in Account", "Credit"] and b_status == "Unpaid":
                amt_paid = min(total_amt, max(0.0, rec_amt - chg_amt))
                bill_outstanding = max(0.0, total_amt - amt_paid)
            else:
                amt_paid = min(total_amt, max(0.0, rec_amt - chg_amt)) if rec_amt > 0 else total_amt
                bill_outstanding = 0.0

            total_spent += total_amt
            total_paid += amt_paid
            total_pairs += pairs_cnt

            bills.append({
                "id": b_id,
                "bill_no": bill_no,
                "date": normalize_datetime(b_date),
                "items_count": items_cnt,
                "pairs_count": pairs_cnt,
                "total_amount": total_amt,
                "payment_mode": pay_mode,
                "amount_received": rec_amt,
                "change_returned": chg_amt,
                "amount_paid": amt_paid,
                "outstanding_amount": bill_outstanding,
                "status": b_status,
                "pdf_path": pdf_path or f"invoices/{bill_no}.pdf",
                "billing_address": b_address,
                "subtotal": subtotal,
                "discount": discount,
                "tax": tax,
            })

        total_bills = len(bills)
        last_purchase = bills[0]["date"] if bills else "Never"

        return jsonify({
            "customer": {
                "id": c_row[0],
                "name": c_row[1],
                "phone": c_row[2] or "—",
                "email": c_row[3] or "—",
                "address": c_row[4] or "—",
                "outstanding_amount": float(c_row[5]),
                "status": c_row[6],
                "created_at": normalize_datetime(c_row[7]),
                "total_bills": total_bills,
                "total_spent": total_spent,
                "total_paid": total_paid,
                "total_pairs": total_pairs,
                "last_purchase": last_purchase,
                "bills": bills,
            }
        })
    except Exception as e:
        return jsonify({"message": f"Failed to load customer profile: {str(e)}"}), 500


@app.route("/api/customers/<int:customer_id>", methods=["PUT"])
def update_customer(customer_id):
    try:
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        phone = (data.get("phone") or "").strip()
        email = (data.get("email") or "").strip()
        address = (data.get("address") or "").strip()
        outstanding = float(data.get("outstanding_amount") or 0.0)

        if not name:
            return jsonify({"message": "Customer name is required."}), 400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                if phone:
                    cur.execute("SELECT id FROM customers WHERE phone = %s AND id != %s", (phone, customer_id))
                    if cur.fetchone():
                        return jsonify({"message": "Phone number is already used by another customer."}), 409

                cur.execute(
                    """
                    UPDATE customers
                    SET name = %s, phone = %s, email = %s, address = %s, outstanding_amount = %s, updated_at = NOW()
                    WHERE id = %s
                    """,
                    (name, phone or None, email or None, address or None, outstanding, customer_id),
                )
                conn.commit()

        return jsonify({"message": "Customer updated successfully."})
    except Exception as e:
        return jsonify({"message": f"Failed to update customer: {str(e)}"}), 500


@app.route("/api/customers/<int:customer_id>", methods=["DELETE"])
def delete_customer(customer_id):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE customers SET status = 'inactive', updated_at = NOW() WHERE id = %s", (customer_id,))
                conn.commit()
        return jsonify({"message": "Customer deactivated."})
    except Exception as e:
        return jsonify({"message": f"Failed to delete customer: {str(e)}"}), 500


# ==========================================
# SUPPLIERS & PURCHASES API
# ==========================================

@app.route("/api/suppliers", methods=["GET"])
def get_suppliers():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, supplier_name, contact_person, phone, email, address, gst_number FROM suppliers WHERE status = 'active' ORDER BY supplier_name ASC")
                suppliers = [
                    {
                        "id": r[0],
                        "supplier_name": r[1],
                        "contact_person": r[2] or "",
                        "phone": r[3] or "",
                        "email": r[4] or "",
                        "address": r[5] or "",
                        "gst_number": r[6] or "",
                    }
                    for r in cur.fetchall()
                ]
        return jsonify({"suppliers": suppliers})
    except Exception as e:
        return jsonify({"message": f"Failed to load suppliers: {str(e)}"}), 500


@app.route("/api/suppliers", methods=["POST"])
def create_supplier():
    try:
        data = request.get_json(silent=True) or {}
        name = (data.get("supplier_name") or "").strip()
        contact = (data.get("contact_person") or "").strip()
        phone = (data.get("phone") or "").strip()
        email = (data.get("email") or "").strip()
        address = (data.get("address") or "").strip()
        gst = (data.get("gst_number") or "").strip()

        if not name:
            return jsonify({"message": "Supplier name is required."}), 400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, gst_number, status)
                    VALUES (%s, %s, %s, %s, %s, %s, 'active')
                    RETURNING id, supplier_name
                    """,
                    (name, contact, phone, email, address, gst),
                )
                new_s = cur.fetchone()
                conn.commit()

        return jsonify({"message": "Supplier added.", "supplier": {"id": new_s[0], "supplier_name": new_s[1]}}), 201
    except Exception as e:
        return jsonify({"message": f"Failed to create supplier: {str(e)}"}), 500


@app.route("/api/purchases", methods=["GET"])
def get_purchases():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT p.id, p.purchase_no, p.supplier_name, p.total_amount,
                           p.payment_status, p.payment_mode, p.notes, p.created_at,
                           COALESCE(COUNT(pi.id), 0) AS items_count
                    FROM purchases p
                    LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
                    GROUP BY p.id, p.purchase_no, p.supplier_name, p.total_amount, p.payment_status, p.payment_mode, p.notes, p.created_at
                    ORDER BY p.created_at DESC
                    LIMIT 50
                    """
                )
                rows = cur.fetchall()

        purchases = [
            {
                "id": r[0],
                "purchase_no": r[1],
                "supplier_name": r[2],
                "total_amount": f"₹{float(r[3]):,.2f}",
                "raw_total": float(r[3]),
                "payment_status": r[4],
                "payment_mode": r[5],
                "notes": r[6] or "",
                "created_at": normalize_datetime(r[7]),
                "items_count": r[8],
            }
            for r in rows
        ]
        return jsonify({"purchases": purchases})
    except Exception as e:
        return jsonify({"message": f"Failed to load purchases: {str(e)}"}), 500


@app.route("/api/purchases", methods=["POST"])
def create_purchase():
    try:
        payload = request.get_json(silent=True) or {}
        supplier_name = (payload.get("supplier_name") or "Direct Stock Inward").strip()
        supplier_id = payload.get("supplier_id")
        payment_mode = (payload.get("payment_mode") or "Bank Transfer").strip()
        payment_status = (payload.get("payment_status") or "Paid").strip()
        notes = (payload.get("notes") or "").strip()
        items = payload.get("items") or []

        if not items:
            return jsonify({"message": "Purchase must contain at least one item."}), 400

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COALESCE(MAX(id), 0) + 5001 FROM purchases")
                next_num = cur.fetchone()[0]
                purchase_no = f"PO-{next_num}"

                total_amount = 0
                processed_items = []

                for item in items:
                    product_id = item.get("product_id")
                    size = int(item.get("size"))
                    qty = int(item.get("quantity", 0))
                    purchase_price = float(item.get("purchase_price", 0))

                    if not product_id or qty <= 0:
                        return jsonify({"message": "Invalid product or quantity in purchase items."}), 400

                    # Verify product exists
                    cur.execute("SELECT product_name FROM products WHERE id = %s", (product_id,))
                    prod = cur.fetchone()
                    if not prod:
                        return jsonify({"message": f"Product ID {product_id} not found."}), 404

                    p_name = prod[0]
                    item_total = purchase_price * qty
                    total_amount += item_total

                    # IMPORTANT: Update stock quantity for that product & size!
                    cur.execute(
                        """
                        INSERT INTO product_sizes (product_id, size, stock_quantity, updated_at)
                        VALUES (%s, %s, %s, NOW())
                        ON CONFLICT (product_id, size)
                        DO UPDATE SET stock_quantity = product_sizes.stock_quantity + EXCLUDED.stock_quantity, updated_at = NOW()
                        """,
                        (product_id, size, qty),
                    )

                    # Update purchase_price on product if given
                    if purchase_price > 0:
                        cur.execute(
                            "UPDATE products SET purchase_price = %s, updated_at = NOW() WHERE id = %s",
                            (purchase_price, product_id),
                        )

                    processed_items.append({
                        "product_id": product_id,
                        "product_name": p_name,
                        "size": size,
                        "quantity": qty,
                        "purchase_price": purchase_price,
                        "total_price": item_total,
                    })

                cur.execute(
                    """
                    INSERT INTO purchases (purchase_no, supplier_id, supplier_name, total_amount, payment_status, payment_mode, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, purchase_no, supplier_name, total_amount, payment_status, created_at
                    """,
                    (purchase_no, supplier_id if supplier_id else None, supplier_name, total_amount, payment_status, payment_mode, notes),
                )
                p_row = cur.fetchone()
                purchase_id = p_row[0]

                for it in processed_items:
                    cur.execute(
                        """
                        INSERT INTO purchase_items (purchase_id, product_id, product_name, size, quantity, purchase_price, total_price)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """,
                        (purchase_id, it["product_id"], it["product_name"], it["size"], it["quantity"], it["purchase_price"], it["total_price"]),
                    )

                conn.commit()

        return jsonify({
            "message": "Purchase recorded successfully and stock updated!",
            "purchase": {
                "id": p_row[0],
                "purchase_no": p_row[1],
                "supplier_name": p_row[2],
                "total_amount": float(p_row[3]),
                "payment_status": p_row[4],
                "created_at": normalize_datetime(p_row[5]),
                "items": processed_items,
            }
        }), 201
    except Exception as e:
        return jsonify({"message": f"Purchase recording failed: {str(e)}"}), 500


# ==========================================
# REPORTS & DASHBOARD API
# ==========================================

@app.route("/api/reports/summary", methods=["GET"])
def get_reports_summary():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Total Sales
                cur.execute("SELECT COALESCE(SUM(total_amount), 0), COUNT(*) FROM bills")
                total_sales, total_bills = cur.fetchone()

                # Total Purchases
                cur.execute("SELECT COALESCE(SUM(total_amount), 0), COUNT(*) FROM purchases")
                total_purchases, total_pos = cur.fetchone()

                # Total Stock Units & Value
                cur.execute(
                    """
                    SELECT COALESCE(SUM(ps.stock_quantity), 0),
                           COALESCE(SUM(ps.stock_quantity * p.selling_price), 0),
                           COALESCE(SUM(ps.stock_quantity * COALESCE(p.purchase_price, 0)), 0)
                    FROM product_sizes ps
                    JOIN products p ON p.id = ps.product_id
                    WHERE p.status = 'active'
                    """
                )
                total_units, retail_value, cost_value = cur.fetchone()

                # Estimated Profit: Total Sales - Cost of Goods Sold
                cur.execute(
                    """
                    SELECT COALESCE(SUM(bi.quantity * COALESCE(p.purchase_price, 0)), 0)
                    FROM bill_items bi
                    LEFT JOIN products p ON p.id = bi.product_id
                    """
                )
                cogs = cur.fetchone()[0]
                est_profit = max(0.0, float(total_sales) - float(cogs))

                # Top selling products
                cur.execute(
                    """
                    SELECT bi.product_name, SUM(bi.quantity) as sold_qty, SUM(bi.total_price) as revenue
                    FROM bill_items bi
                    GROUP BY bi.product_name
                    ORDER BY sold_qty DESC
                    LIMIT 5
                    """
                )
                top_products = [
                    {"name": r[0], "sold": int(r[1]), "revenue": f"₹{float(r[2]):,.2f}"}
                    for r in cur.fetchall()
                ]

        return jsonify({
            "total_sales": float(total_sales),
            "total_sales_formatted": f"₹{float(total_sales):,.2f}",
            "total_bills": total_bills,
            "total_purchases": float(total_purchases),
            "total_purchases_formatted": f"₹{float(total_purchases):,.2f}",
            "total_pos": total_pos,
            "total_stock_units": total_units,
            "stock_retail_value": f"₹{float(retail_value):,.2f}",
            "stock_cost_value": f"₹{float(cost_value):,.2f}",
            "estimated_profit": f"₹{float(est_profit):,.2f}",
            "top_products": top_products,
        })
    except Exception as e:
        return jsonify({"message": f"Failed to generate reports summary: {str(e)}"}), 500


@app.route("/api/dashboard/stats", methods=["GET"])
def get_dashboard_stats():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # 1. Total active products
                cur.execute("SELECT COUNT(*) FROM products WHERE status = 'active'")
                total_products = cur.fetchone()[0]

                # 2. Total active customers & outstanding
                cur.execute("SELECT COUNT(*), COALESCE(SUM(outstanding_amount), 0) FROM customers WHERE status = 'active'")
                c_row = cur.fetchone()
                total_customers = c_row[0]
                outstanding_amount = float(c_row[1])

                # 3. Low stock product sizes
                cur.execute(
                    """
                    SELECT p.product_name, COALESCE(p.product_code, 'FW-GEN-001'), ps.size, ps.stock_quantity
                    FROM product_sizes ps
                    JOIN products p ON p.id = ps.product_id
                    WHERE p.status = 'active' AND ps.stock_quantity <= %s
                    ORDER BY ps.stock_quantity ASC
                    LIMIT 10
                    """,
                    (LOW_STOCK_THRESHOLD,),
                )
                low_stock_rows = cur.fetchall()
                low_stock_count = len(low_stock_rows)
                low_stock_list = [
                    {
                        "name": r[0],
                        "code": r[1],
                        "size": str(r[2]),
                        "stock": str(r[3]),
                        "status": "Critical" if r[3] <= 1 else "Low Stock",
                    }
                    for r in low_stock_rows
                ]

                # 4. Today's sales & bills
                cur.execute(
                    """
                    SELECT COALESCE(SUM(total_amount), 0), COUNT(*)
                    FROM bills
                    WHERE DATE(created_at) = CURRENT_DATE
                    """
                )
                today_sales, today_bills = cur.fetchone()

                # 5. Today's purchases
                cur.execute(
                    """
                    SELECT COALESCE(SUM(total_amount), 0), COUNT(*)
                    FROM purchases
                    WHERE DATE(created_at) = CURRENT_DATE
                    """
                )
                today_purchases, today_pos = cur.fetchone()

                # 6. Weekly sales breakdown (Last 7 days)
                cur.execute(
                    """
                    SELECT TO_CHAR(d, 'Dy') AS day_name,
                           COALESCE(SUM(b.total_amount), 0) AS day_total
                    FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) d
                    LEFT JOIN bills b ON DATE(b.created_at) = DATE(d)
                    GROUP BY d
                    ORDER BY d ASC
                    """
                )
                weekly_sales = [
                    {"day": r[0], "value": float(r[1])}
                    for r in cur.fetchall()
                ]

                # 7. Top selling products
                cur.execute(
                    """
                    SELECT bi.product_name, SUM(bi.quantity) as sold_qty, SUM(bi.total_price) as revenue
                    FROM bill_items bi
                    GROUP BY bi.product_name
                    ORDER BY sold_qty DESC
                    LIMIT 6
                    """
                )
                top_products = [
                    {"name": r[0], "sold": int(r[1]), "revenue": f"₹{float(r[2]):,.2f}"}
                    for r in cur.fetchall()
                ]

        return jsonify({
            "total_products": total_products,
            "total_customers": total_customers,
            "outstanding_amount": f"₹ {outstanding_amount:,.2f}",
            "raw_outstanding": outstanding_amount,
            "low_stock_count": low_stock_count,
            "today_sales": f"₹ {float(today_sales):,.2f}",
            "today_bills": str(today_bills),
            "today_purchases": f"₹ {float(today_purchases):,.2f}",
            "low_stock_products": low_stock_list,
            "weekly_sales": weekly_sales,
            "top_products": top_products,
        })
    except Exception as e:
        return jsonify({"message": f"Failed to load dashboard stats: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000, host="0.0.0.0")