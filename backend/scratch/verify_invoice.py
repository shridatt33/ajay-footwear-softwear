import urllib.request
import json
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

req = urllib.request.Request('http://127.0.0.1:5000/api/bills')
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    latest_bill = data['bills'][0]
    print('Latest Bill in Register:', latest_bill['bill_no'])
    print('  Display Amount:', latest_bill['amount'])
    print('  Subtotal:', latest_bill.get('subtotal'))
    print('  Discount %:', latest_bill.get('discount_percent'))
    print('  Discount Amount:', latest_bill.get('discount_amount'))
    print('  Delivery Charges:', latest_bill.get('delivery_charges'))
    print('  Round Off:', latest_bill.get('round_off'))
    bill_id = latest_bill['id']

req_detail = urllib.request.Request(f'http://127.0.0.1:5000/api/bills/{bill_id}')
with urllib.request.urlopen(req_detail) as resp:
    detail = json.loads(resp.read().decode())['bill']
    print('\nBill Detail for', detail['bill_no'], ':')
    print('  Customer:', detail['customer_name'])
    print('  Subtotal:', detail['subtotal'])
    print('  Discount Percent:', detail['discount_percent'])
    print('  Discount Amount:', detail['discount_amount'])
    print('  Delivery Charges:', detail['delivery_charges'])
    print('  Round Off:', detail['round_off'])
    print('  Grand Total:', detail['total_amount'])
    print('  Items in DB:', len(detail['items']))
    for it in detail['items']:
        print(f"    - {it['product_name']} | Size: {it['size']} | Qty: {it['quantity']} | Unit Price: ₹{it['selling_price']:.2f} | Total: ₹{it['total_price']:.2f}")

# Also test an older bill
if len(data['bills']) > 1:
    older_bill = data['bills'][-1]
    older_id = older_bill['id']
    req_old = urllib.request.Request(f'http://127.0.0.1:5000/api/bills/{older_id}')
    with urllib.request.urlopen(req_old) as resp:
        old_detail = json.loads(resp.read().decode())['bill']
        print('\nOlder Bill Verification (Backwards Compatibility):')
        print('  Bill No:', old_detail['bill_no'])
        print('  Subtotal:', old_detail['subtotal'])
        print('  Discount Percent:', old_detail['discount_percent'])
        print('  Discount Amount:', old_detail['discount_amount'])
        print('  Delivery Charges:', old_detail['delivery_charges'])
        print('  Round Off:', old_detail['round_off'])
        print('  Grand Total:', old_detail['total_amount'])
