import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import get_db_connection

with get_db_connection() as conn:
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, bill_no, subtotal, discount_percent, discount_amount, delivery_charges, round_off, total_amount, amount_received
            FROM bills
            ORDER BY id DESC LIMIT 3;
        """)
        for row in cur.fetchall():
            print(row)
