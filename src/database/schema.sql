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
  account_type account_type NOT NULL DEFAULT 'current',
  status account_status NOT NULL DEFAULT 'active',
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
  amount NUMERIC(15, 2) NOT NULL,
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

-- Atomically deposit into an account
CREATE FUNCTION deposit(acc_id UUID, amt NUMERIC, descr TEXT DEFAULT NULL)
RETURNS transactions AS $$
DECLARE
  txn transactions;
BEGIN
  INSERT INTO transactions (account_id, type, amount, balance_before, balance_after, description)
  SELECT acc_id, 'deposit', amt, balance, balance + amt, descr
  FROM accounts
  WHERE id = acc_id
  FOR UPDATE;

  UPDATE accounts SET balance = balance + amt, updated_at = now() WHERE id = acc_id;

  SELECT * INTO txn FROM transactions WHERE id = lastval();
  RETURN txn;
END;
$$ LANGUAGE plpgsql;

-- Atomically withdraw from an account (raises error if insufficient funds)
CREATE FUNCTION withdraw(acc_id UUID, amt NUMERIC, descr TEXT DEFAULT NULL)
RETURNS transactions AS $$
DECLARE
  txn transactions;
  curr_balance NUMERIC(15,2);
BEGIN
  SELECT balance INTO curr_balance FROM accounts WHERE id = acc_id FOR UPDATE;

  IF curr_balance < amt THEN
    RAISE EXCEPTION 'Insufficient funds: have %, need %', curr_balance, amt;
  END IF;

  INSERT INTO transactions (account_id, type, amount, balance_before, balance_after, description)
  VALUES (acc_id, 'withdrawal', amt, curr_balance, curr_balance - amt, descr);

  UPDATE accounts SET balance = balance - amt, updated_at = now() WHERE id = acc_id;

  SELECT * INTO txn FROM transactions WHERE id = lastval();
  RETURN txn;
END;
$$ LANGUAGE plpgsql;

-- Atomically transfer between two accounts
CREATE FUNCTION transfer(from_acc UUID, to_acc UUID, amt NUMERIC, descr TEXT DEFAULT NULL)
RETURNS TABLE(outgoing transactions, incoming transactions) AS $$
DECLARE
  from_balance NUMERIC(15,2);
  to_balance NUMERIC(15,2);
  transfer_id UUID := gen_random_uuid();
  out_txn transactions;
  in_txn transactions;
BEGIN
  -- Lock both accounts (ordered by id to prevent deadlock)
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
  VALUES (from_acc, 'transfer_out', amt, from_balance, from_balance - amt, descr, transfer_id);
  SELECT * INTO out_txn FROM transactions WHERE id = lastval();

  INSERT INTO transactions (account_id, type, amount, balance_before, balance_after, description, transfer_id)
  VALUES (to_acc, 'transfer_in', amt, to_balance, to_balance + amt, descr, transfer_id);
  SELECT * INTO in_txn FROM transactions WHERE id = lastval();

  UPDATE accounts SET balance = balance - amt, updated_at = now() WHERE id = from_acc;
  UPDATE accounts SET balance = balance + amt, updated_at = now() WHERE id = to_acc;

  RETURN QUERY SELECT out_txn, in_txn;
END;
$$ LANGUAGE plpgsql;
