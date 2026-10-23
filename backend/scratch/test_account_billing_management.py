import urllib.request
import urllib.error
import json
import sys

BASE_URL = "http://127.0.0.1:5000"

def api_request(method, path, body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            resp_body = resp.read().decode("utf-8")
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        parsed = json.loads(err_body) if err_body else {}
        return e.code, parsed

def run_tests():
    print("=================================================================")
    print("STARTING TEST SUITE: Customer Account, Billing Suspension & Deletion")
    print("=================================================================")

    # 1. Developer Login
    print("\n--- TEST 1: Developer Login ---")
    status, dev_data = api_request("POST", "/api/developer/auth/login", {
        "username": "dev_admin",
        "password": "Developer@Swamidatt2026!"
    })
    assert status == 200, f"Dev login failed ({status}): {dev_data}"
    dev_token = dev_data["token"]
    print("[OK] Developer login successful. Token acquired.")

    # 2. Unauthorized access protection
    print("\n--- TEST 2: Security & IDOR Protection ---")
    status, err_data = api_request("GET", "/api/developer/users")
    assert status == 401, f"Expected 401, got {status}: {err_data}"
    print("[OK] Unauthenticated request to /api/developer/users correctly blocked with 401.")

    # 3. List Accounts
    print("\n--- TEST 3: Developer Get Shop Accounts ---")
    status, users_res = api_request("GET", "/api/developer/users", token=dev_token)
    assert status == 200, f"Get users failed ({status}): {users_res}"
    users_list = users_res["users"]
    print(f"[OK] Retrieved {len(users_list)} existing accounts. Displaying fields:")
    sample = users_list[0]
    for k in ["id", "username", "shop_name", "status", "billing_status", "created_at", "last_active", "total_bills"]:
        assert k in sample, f"Missing field {k} in user payload"
        print(f"   {k}: {sample[k]}")

    # 4. Create New Shop Account
    print("\n--- TEST 4: Create New Shop Account ---")
    test_username = "test_shop_pune"
    for u in users_list:
        if u["username"] in (test_username, "pune_flagship_store"):
            api_request("DELETE", f"/api/developer/users/{u['id']}", token=dev_token)

    status, create_res = api_request("POST", "/api/developer/users", {
        "shop_name": "SWAMIDATT ENTERPRISES - Pune West Branch",
        "username": test_username,
        "password": "InitialPassword123!",
        "full_name": "Santosh Kulkarni",
        "role": "Admin",
        "phone": "+91 9822011223",
        "email": "pune@swamidatt.com",
        "address": "FC Road, Deccan, Pune - 411004",
        "gst_number": "27AAACS1234F1Z9"
    }, token=dev_token)
    assert status == 201, f"Create user failed ({status}): {create_res}"
    test_user_id = create_res["user_id"]
    print(f"[OK] Created test shop account ID: {test_user_id}")

    # 5. Edit Shop Details
    print("\n--- TEST 5: Edit Shop Details ---")
    status, edit_res = api_request("PUT", f"/api/developer/users/{test_user_id}", {
        "shop_name": "SWAMIDATT ENTERPRISES - Pune Flagship Outlet",
        "full_name": "Santosh V. Kulkarni",
        "phone": "+91 9822099999",
        "email": "pune.flagship@swamidatt.com",
        "address": "JM Road, Shivajinagar, Pune - 411005",
        "gst_number": "27AAACS1234F1Z9",
        "role": "Admin",
        "status": "active"
    }, token=dev_token)
    assert status == 200, f"Edit shop details failed ({status}): {edit_res}"
    print("[OK] Successfully updated shop details.")

    # 6. Set / Reset Login Credentials
    print("\n--- TEST 6: Set / Reset Login Credentials ---")
    status, cred_res = api_request("PUT", f"/api/developer/users/{test_user_id}/credentials", {
        "username": "pune_flagship_store",
        "password": "NewSecurePassword2026!"
    }, token=dev_token)
    assert status == 200, f"Credentials update failed ({status}): {cred_res}"
    print("[OK] Successfully updated username and reset password.")

    # Verify Shop login with new credentials
    status, shop_login_res = api_request("POST", "/api/auth/login", {
        "username": "pune_flagship_store",
        "password": "NewSecurePassword2026!"
    })
    assert status == 200, f"Shop login failed ({status}): {shop_login_res}"
    shop_token = shop_login_res["token"]
    shop_user = shop_login_res["user"]
    assert shop_user["billing_status"] == "active"
    assert shop_user["shop_name"] == "SWAMIDATT ENTERPRISES - Pune Flagship Outlet"
    print(f"[OK] Shop user logged in successfully. Shop Name: {shop_user['shop_name']}, Billing Status: {shop_user['billing_status']}")

    # 7. Stop Billing (Suspension)
    print("\n--- TEST 7: Stop Billing (Suspension) ---")
    status, suspend_res = api_request("PUT", f"/api/developer/users/{test_user_id}/billing-status", {
        "billing_status": "suspended"
    }, token=dev_token)
    assert status == 200, f"Billing suspension failed ({status}): {suspend_res}"
    print("[OK] Developer set shop billing_status to 'suspended'.")

    # 8. Verify Billing Suspension Enforced with HTTP 403
    print("\n--- TEST 8: Verify Billing Suspension Enforced with HTTP 403 ---")
    status, shop_relogin = api_request("POST", "/api/auth/login", {
        "username": "pune_flagship_store",
        "password": "NewSecurePassword2026!"
    })
    assert status == 200
    suspended_shop_token = shop_relogin["token"]

    status, prods_res = api_request("GET", "/api/products")
    prods = prods_res["products"]
    prod_to_buy = next(p for p in prods if p.get("sizes") and p["sizes"][0].get("stock_quantity", 0) > 0)
    size_to_buy = prod_to_buy["sizes"][0]["size"]

    checkout_payload = {
        "customer_name": "Test Customer Pune",
        "customer_phone": "9800000000",
        "payment_mode": "Cash",
        "items": [
            {
                "product_id": prod_to_buy["id"],
                "size": size_to_buy,
                "quantity": 1,
                "selling_price": prod_to_buy["selling_price"]
            }
        ]
    }

    status, blocked_data = api_request("POST", "/api/billing/checkout", checkout_payload, token=suspended_shop_token)
    assert status == 403, f"Expected 403 Forbidden for suspended shop, got {status}: {blocked_data}"
    assert blocked_data.get("billing_suspended") is True
    print(f"[OK] Checkout request correctly rejected with HTTP 403 Forbidden: {blocked_data['message']}")

    # 9. Resume Billing
    print("\n--- TEST 9: Resume Billing ---")
    status, resume_res = api_request("PUT", f"/api/developer/users/{test_user_id}/billing-status", {
        "billing_status": "active"
    }, token=dev_token)
    assert status == 200, f"Resume billing failed ({status}): {resume_res}"
    print("[OK] Developer resumed shop billing status to 'active'.")

    # Login and checkout
    status, shop_relogin_active = api_request("POST", "/api/auth/login", {
        "username": "pune_flagship_store",
        "password": "NewSecurePassword2026!"
    })
    active_shop_token = shop_relogin_active["token"]

    status, checkout_res = api_request("POST", "/api/billing/checkout", checkout_payload, token=active_shop_token)
    assert status == 201, f"Checkout failed after resumption ({status}): {checkout_res}"
    created_bill = checkout_res["bill"]
    print(f"[OK] Checkout successfully permitted. Bill No: {created_bill['bill_no']}, Shop Name: {created_bill['shop_name']}, User ID: {created_bill['user_id']}")

    # 10. Safe Shop Deletion & Compliance Retention Policy
    print("\n--- TEST 10: Safe Shop Deletion & Compliance Retention Policy ---")
    # A) Attempt to delete Developer account (MUST FAIL)
    status, del_dev_res = api_request("DELETE", f"/api/developer/users/{dev_data['user']['id']}", token=dev_token)
    assert status == 400, "Developer account deletion should have been blocked"
    print("[OK] Developer super admin account deletion is strictly protected (HTTP 400).")

    # B) Attempt to delete shop account that now has 1 financial bill (MUST ARCHIVE, NOT DESTROY)
    status, del_shop_res = api_request("DELETE", f"/api/developer/users/{test_user_id}", token=dev_token)
    assert status == 200, f"Shop deletion call failed ({status}): {del_shop_res}"
    assert del_shop_res["action_taken"] == "archived"
    assert del_shop_res["bills_count"] >= 1
    print(f"[OK] Retention Policy Enforced: {del_shop_res['message']}")

    # Verify that the archived shop user is blocked from logging in
    status, archived_login_res = api_request("POST", "/api/auth/login", {
        "username": "pune_flagship_store",
        "password": "NewSecurePassword2026!"
    })
    assert status == 403, f"Archived user login should be 403, got {status}"
    print("[OK] Archived shop account login blocked with HTTP 403 under compliance retention policy.")

    # Verify that the invoice still exists in the database
    status, bill_check_res = api_request("GET", f"/api/bills/{created_bill['id']}")
    assert status == 200, f"Invoice should still exist! Got {status}"
    print(f"[OK] Financial Invoice {created_bill['bill_no']} was safely preserved.")

    # 11. Clean Deletion for Account with 0 Bills
    print("\n--- TEST 11: Clean Permanent Deletion for Account with 0 Bills ---")
    status, create_zero = api_request("POST", "/api/developer/users", {
        "shop_name": "Temporary Zero Bill Shop",
        "username": "temp_zero_shop",
        "password": "TempPassword123!",
        "role": "Cashier"
    }, token=dev_token)
    zero_shop_id = create_zero["user_id"]
    status, del_zero_res = api_request("DELETE", f"/api/developer/users/{zero_shop_id}", token=dev_token)
    assert status == 200
    assert del_zero_res["action_taken"] == "deleted"
    print(f"[OK] Shop with 0 financial records permanently deleted: {del_zero_res['message']}")

    # Clean up test archived user
    with psycopg.connect(
        host="localhost", port=5432, dbname="ajay_footwear", user="postgres", password="Dattu@1234"
    ) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM bill_items WHERE bill_id = %s", (created_bill['id'],))
            cur.execute("DELETE FROM bills WHERE id = %s", (created_bill['id'],))
            cur.execute("DELETE FROM user_sessions WHERE user_id = %s", (test_user_id,))
            cur.execute("DELETE FROM users WHERE id = %s", (test_user_id,))
            conn.commit()

    print("\n=================================================================")
    print("ALL TESTS PASSED SUCCESSFULLY! FULL SPECIFICATION SATISFIED.")
    print("=================================================================")

if __name__ == "__main__":
    try:
        import psycopg
        run_tests()
    except Exception as e:
        print(f"\n[FAIL] TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
