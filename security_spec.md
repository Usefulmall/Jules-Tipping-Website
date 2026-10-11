# Security Protocol and Technical Spec for Tipping Platform

## 1. Data Invariants
- **User Role Immutability**: A user cannot modify their own `role` field on update to prevent privilege escalation.
- **Admin Verification**: Only verified users with the bootstrapped email `'exellentoak@gmail.com'` can access records as the platform admin.
- **Worker Payout Identity Protection**: A registered worker's payout details (`bankName`, `bankCode`, `accountNumber`, `accountName`, `subaccountCode`) cannot be modified except by the employer who onboarded them or the platform admin.
- **Tip Non-Modifiability**: Once a tipping ledger entry status is marked `success`, it becomes terminal and non-updateable to prevent ledger tampering.
- **Audit Field Immutability**: `createdAt` timestamps cannot be changed on update.

---

## 2. The "Dirty Dozen" Malicious Payloads

### Payload 1: Privilege Escalation on Creation (Self-Assigned Admin Role)
```json
{
  "uid": "attacker_uid",
  "email": "attacker@email.com",
  "name": "Attacker",
  "role": "admin",
  "createdAt": "2026-06-07T13:54:48Z"
}
```
*Expected Result*: `PERMISSION_DENIED`. Users must not be able to register themselves with `role: "admin"`.

### Payload 2: Role Hijacking on Active Update
```json
{
  "uid": "employer_uid",
  "email": "employer@email.com",
  "name": "Modified Employer",
  "role": "admin",
  "createdAt": "2026-06-07T13:54:48Z"
}
```
*Expected Result*: `PERMISSION_DENIED`. Employers cannot change their own roles to admin.

### Payload 3: Worker Onboarding Identity Theft (Impersonating another Employer)
```json
{
  "id": "worker123",
  "employerId": "other_employer_uid",
  "name": "John Doe",
  "position": "Server",
  "bankName": "GTBank",
  "bankCode": "058",
  "accountNumber": "0123456789",
  "accountName": "John Doe",
  "subaccountCode": "ACCT_123",
  "createdAt": "2026-06-07T13:54:48Z"
}
```
*Expected Result*: `PERMISSION_DENIED`. An employer cannot register a worker under a different employer ID.

### Payload 4: Worker Bank Modification by Anonymous User
```json
{
  "id": "worker123",
  "employerId": "real_employer_uid",
  "name": "John Doe",
  "position": "Server",
  "bankName": "Malicious Bank",
  "bankCode": "999",
  "accountNumber": "9999999999",
  "accountName": "Malicious Attacker",
  "subaccountCode": "ACCT_666",
  "createdAt": "2026-06-07T13:54:48Z"
}
```
*Expected Result*: `PERMISSION_DENIED`. Only the owning employer can update a worker's payout profile.

### Payload 5: Tampering with Tip Amounts (Owner Spoofing)
```json
{
  "id": "tip789",
  "workerId": "worker123",
  "workerName": "John Doe",
  "employerId": "employer_uid",
  "amount": 10.0,
  "feeAmount": 0.2,
  "workerAmount": 9.8,
  "status": "success",
  "reference": "ref_123",
  "customerEmail": "customer@email.com",
  "createdAt": "2026-06-07T13:54:48Z"
}
```
*Expected Result*: `PERMISSION_DENIED`. Tip documents can only be created with status `pending`, and we check exact fee splits (2% vs 98%).

### Payload 6: Modifying Completed Tip Transaction (Status Shortcutting / Fraud)
```json
{
  "id": "tip789",
  "workerId": "worker123",
  "workerName": "John Doe",
  "employerId": "employer_uid",
  "amount": 10000.0,
  "feeAmount": 200.0,
  "workerAmount": 9800.0,
  "status": "success",
  "reference": "fake_ref",
  "customerEmail": "customer@email.com",
  "createdAt": "2026-06-07T13:54:48Z"
}
```
*Expected Result*: `PERMISSION_DENIED`. Successful transactions are locked and immutable.

### Payload 7: Anonymous Worker Retrieval / Scraping PII without Authentication
*Action*: Anonymous GET query on multiple worker documents.
*Expected Result*: `PERMISSION_DENIED`. Although public profiles are viewable by single GET requests, blanket listings or queries without target constraints must be blocked.

### Payload 8: Creating Tip with Future Timestamp
```json
{
  "id": "tip999",
  "workerId": "worker123",
  "workerName": "John Doe",
  "employerId": "employer_uid",
  "amount": 10.0,
  "feeAmount": 0.2,
  "workerAmount": 9.8,
  "status": "pending",
  "reference": "ref_999",
  "customerEmail": "customer@email.com",
  "createdAt": "2099-12-31T23:59:59Z"
}
```
*Expected Result*: `PERMISSION_DENIED`. `createdAt` must strictly match `request.time`.

### Payload 9: Denial-of-Wallet Long Injection String Attack
```json
{
  "id": "too_long_string_representing_a_malicious_id_payload_that_is_over_twohundred_bytes_in_length_designed_to_inflate_storage_costs_and_exhaust_the_monthly_free_tier_limits_of_the_project_extremely_easily",
  "employerId": "uid",
  "name": "Spam",
  "position": "Server",
  "bankName": "Bank",
  "bankCode": "123",
  "accountNumber": "123456",
  "accountName": "Name",
  "subaccountCode": "ACCT_1",
  "createdAt": "2026-06-07T13:54:48Z"
}
```
*Expected Result*: `PERMISSION_DENIED`. Length validation on ID fields blocks large malicious buffers.

### Payload 10: Deleting Historical Tip Records to Cover Fraud
*Action*: Trying to execute deletion on `tips/tip789` by worker or employer.
*Expected Result*: `PERMISSION_DENIED`. Historical tips are permanent ledger items and cannot be deleted.

### Payload 11: Stealing Other Employer's Tip History Logs
*Action*: Employer `B` attempting a query fetching `tips` where `employerId == 'Employer_A'`.
*Expected Result*: `PERMISSION_DENIED`. Rules enforce query limits based on the authenticating user (`resource.data.employerId == request.auth.uid`).

### Payload 12: Anonymous Creation of Workers
*Expected Result*: `PERMISSION_DENIED`. Only authenticated employers can onboard and write worker profiles.

---

## 3. The Test Spec Outline

A typical robust execution sequence of standard tests ensuring these payloads are rejected:
- Assert sign-in requirements for operations.
- Assert strict schema keys.
- Prevent spoofing of owner credentials.
