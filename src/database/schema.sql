CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE account_type AS ENUM ('current', 'savings');
CREATE TYPE account_status AS ENUM ('active', 'frozen', 'closed');

CREATE TABLE accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_number VARCHAR(20) UNIQUE NOT NULL,
  account_type account_type NOT NULL DEFAULT 'savings',
  status account_status NOT NULL DEFAULT 'active',
  -- Cached balance for fast reads. Source of truth is still the sum of
  -- transactions.balance_after history; this column is only ever updated
  -- inside the same DB transaction as the transaction row that justifies it,
  -- so it should never drift. Reconcile periodically if you want a safety net.
  balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'transfer_in', 'transfer_out');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'reversed');

CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  balance_before NUMERIC(15, 2) NOT NULL,
  balance_after NUMERIC(15, 2) NOT NULL,
  status transaction_status NOT NULL DEFAULT 'completed',
  description TEXT,
  transfer_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_transfer_id ON transactions(transfer_id);

-- Refresh tokens are stored as SHA-256 hashes, never raw, matching your
-- auth setup on the other app (JWT access token in memory, refresh token
-- as an HttpOnly cookie, hashed before it ever touches the DB).
CREATE TABLE refresh_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- ============================================================
-- NEW: transfers to OTHER banks (via NIBSS / Paystack / Flutterwave etc.)
-- Internal account-to-account transfers stay on the transfer() function
-- below and never touch this table. This table exists for the async,
-- provider-mediated leg of a transfer that leaves your system.
-- ============================================================

CREATE TYPE external_transfer_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'reversed');

CREATE TABLE external_transfers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Client-generated key (see our earlier discussion: generate once per
  -- form session on the frontend, reuse it across retries of the same attempt).
  idempotency_key VARCHAR(100) UNIQUE NOT NULL,
  source_account_id UUID NOT NULL REFERENCES accounts(id),
  -- Points at the 'withdrawal' row in `transactions` that actually debited
  -- the local account. Keeps one source of truth for the ledger movement.
  transaction_id UUID REFERENCES transactions(id),
  destination_bank_code VARCHAR(10) NOT NULL,
  destination_account_number VARCHAR(10) NOT NULL,
  destination_account_name VARCHAR(100),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  fee NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status external_transfer_status NOT NULL DEFAULT 'pending',
  provider VARCHAR(30),
  provider_reference VARCHAR(100),
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_external_transfers_source_account ON external_transfers(source_account_id);
CREATE INDEX idx_external_transfers_status ON external_transfers(status);

-- ============================================================
-- NEW: audit log, same pattern you're already using on the school app
-- ============================================================

CREATE TABLE transaction_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id),
  external_transfer_id UUID REFERENCES external_transfers(id),
  actor_user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- e.g. 'initiated', 'status_changed', 'webhook_received'
  old_status TEXT,
  new_status TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_transaction_id ON transaction_audit_logs(transaction_id);
CREATE INDEX idx_audit_logs_external_transfer_id ON transaction_audit_logs(external_transfer_id);

-- ============================================================
-- Functions — same logic as before, but using RETURNING instead of
-- lastval(), which does not work with gen_random_uuid() primary keys
-- (lastval() depends on a sequence having been called via nextval()
-- in the current session; UUID defaults never touch a sequence, so
-- the original functions would throw at runtime).
-- ============================================================

CREATE FUNCTION deposit(acc_id UUID, amt NUMERIC, descr TEXT DEFAULT NULL)
RETURNS transactions AS $$
DECLARE
  txn transactions;
  curr_balance NUMERIC(15,2);
BEGIN
  IF amt <= 0 THEN
    RAISE EXCEPTION 'Deposit amount must be positive';
  END IF;

  SELECT balance INTO curr_balance FROM accounts WHERE id = acc_id FOR UPDATE;

  INSERT INTO transactions (account_id, type, amount, balance_before, balance_after, description)
  VALUES (acc_id, 'deposit', amt, curr_balance, curr_balance + amt, descr)
  RETURNING * INTO txn;

  UPDATE accounts SET balance = balance + amt, updated_at = now() WHERE id = acc_id;

  RETURN txn;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION withdraw(acc_id UUID, amt NUMERIC, descr TEXT DEFAULT NULL)
RETURNS transactions AS $$
DECLARE
  txn transactions;
  curr_balance NUMERIC(15,2);
BEGIN
  IF amt <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be positive';
  END IF;

  SELECT balance INTO curr_balance FROM accounts WHERE id = acc_id FOR UPDATE;

  IF curr_balance < amt THEN
    RAISE EXCEPTION 'Insufficient funds: have %, need %', curr_balance, amt;
  END IF;

  INSERT INTO transactions (account_id, type, amount, balance_before, balance_after, description)
  VALUES (acc_id, 'withdrawal', amt, curr_balance, curr_balance - amt, descr)
  RETURNING * INTO txn;

  UPDATE accounts SET balance = balance - amt, updated_at = now() WHERE id = acc_id;

  RETURN txn;
END;
$$ LANGUAGE plpgsql;

-- Internal transfer between two accounts you hold in this DB.
-- For transfers to OTHER banks, use withdraw() for the local debit,
-- then create a row in external_transfers to hand off to your provider.
CREATE FUNCTION transfer(from_acc UUID, to_acc UUID, amt NUMERIC, descr TEXT DEFAULT NULL)
RETURNS TABLE(outgoing transactions, incoming transactions) AS $$
DECLARE
  from_balance NUMERIC(15,2);
  to_balance NUMERIC(15,2);
  xfer_id UUID := gen_random_uuid();
  out_txn transactions;
  in_txn transactions;
BEGIN
  IF amt <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive';
  END IF;

  IF from_acc = to_acc THEN
    RAISE EXCEPTION 'Cannot transfer to the same account';
  END IF;

  -- Lock both accounts in a fixed order (by id) to prevent deadlocks
  -- when two transfers between the same pair of accounts run concurrently
  -- in opposite directions.
  IF from_acc < to_acc THEN
    SELECT balance INTO from_balance FROM accounts WHERE id = from_acc FOR UPDATE;
    SELECT balance INTO to_balance FROM accounts WHERE id = to_acc FOR UPDATE;
  ELSE
    SELECT balance INTO to_balance FROM accounts WHERE id = to_acc FOR UPDATE;
    SELECT balance INTO from_balance FROM accounts WHERE id = from_acc FOR UPDATE;
  END IF;

  IF from_balance < amt THEN
    RAISE EXCEPTION 'Insufficient funds: have %, need %', from_balance, amt;
  END IF;

  INSERT INTO transactions (account_id, type, amount, balance_before, balance_after, description, transfer_id)
  VALUES (from_acc, 'transfer_out', amt, from_balance, from_balance - amt, descr, xfer_id)
  RETURNING * INTO out_txn;

  INSERT INTO transactions (account_id, type, amount, balance_before, balance_after, description, transfer_id)
  VALUES (to_acc, 'transfer_in', amt, to_balance, to_balance + amt, descr, xfer_id)
  RETURNING * INTO in_txn;

  UPDATE accounts SET balance = balance - amt, updated_at = now() WHERE id = from_acc;
  UPDATE accounts SET balance = balance + amt, updated_at = now() WHERE id = to_acc;

  RETURN QUERY SELECT out_txn, in_txn;
END;
$$ LANGUAGE plpgsql;