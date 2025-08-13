DROP DATABASE IF EXISTS pd_samuel_arena_caiman;
CREATE DATABASE pd_samuel_arena_caiman;
USE pd_samuel_arena_caiman;

-- Table: platforms
CREATE TABLE platforms (
  platform_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

-- Table: customers
CREATE TABLE customers (
  customer_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  identification_number VARCHAR(100) NOT NULL UNIQUE,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(150) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: invoices
CREATE TABLE invoices (
  invoice_id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  billing_period VARCHAR(20) NOT NULL,
  amount_billed DECIMAL(14,2) NOT NULL,
  customer_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Table: transactions
CREATE TABLE transactions (
  transaction_id VARCHAR(50) PRIMARY KEY,
  transaction_datetime DATETIME NOT NULL,
  transaction_amount DECIMAL(14,2) NOT NULL,
  transaction_status VARCHAR(50) NOT NULL,
  transaction_type VARCHAR(50),
  customer_id INT NOT NULL,
  platform_id INT,
  invoice_id INT,
  amount_paid DECIMAL(14,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tx_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_tx_platform FOREIGN KEY (platform_id) REFERENCES platforms(platform_id),
  CONSTRAINT fk_tx_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id) ON DELETE CASCADE ON UPDATE CASCADE
);