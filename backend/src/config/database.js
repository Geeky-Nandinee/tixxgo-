const mysql = require('mysql2/promise');
const env = require('./env');

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isMySql = false;
    this.memoryStore = {
      bookings: new Map(),
      travellers: new Map(),
      audit_logs: [],
      cancellations: new Map()
    };
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      // 1. First connect to MySQL server to auto-create database if not exists
      const initConn = await mysql.createConnection({
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        connectTimeout: 3000
      });
      await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\`;`);
      await initConn.end();

      // 2. Initialize connection pool targeting the database
      this.pool = mysql.createPool({
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 3000
      });

      const connection = await this.pool.getConnection();
      console.log(`[Database] Successfully connected to MySQL database "${env.DB_NAME}" at ${env.DB_HOST}:${env.DB_PORT}`);
      connection.release();
      this.isMySql = true;
      await this.runMigrations();
    } catch (err) {
      console.warn(`[Database] Notice: MySQL server connection could not be established (${err.message}).`);
      console.log('[Database] Auto-switching to embedded memory relational store. Full functionality active.');
      this.isMySql = false;
      this.pool = null;
    }
  }

  async runMigrations() {
    if (!this.isMySql) return;

    const createBookingsTable = `
      CREATE TABLE IF NOT EXISTS bookings (
        id VARCHAR(64) PRIMARY KEY,
        booking_reference VARCHAR(32) UNIQUE NOT NULL,
        pnr VARCHAR(32),
        supplier_code VARCHAR(32) NOT NULL,
        supplier_result_id VARCHAR(64) NOT NULL,
        flight_details JSON NOT NULL,
        supplier_cost JSON NOT NULL,
        customer_price JSON NOT NULL,
        payment_status VARCHAR(32) NOT NULL,
        booking_status VARCHAR(32) NOT NULL,
        ticketing_status VARCHAR(32) NOT NULL,
        idempotency_key VARCHAR(128) UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `;

    const createTravellersTable = `
      CREATE TABLE IF NOT EXISTS travellers (
        id VARCHAR(64) PRIMARY KEY,
        booking_reference VARCHAR(32) NOT NULL,
        title VARCHAR(10),
        first_name VARCHAR(64) NOT NULL,
        last_name VARCHAR(64) NOT NULL,
        email VARCHAR(128) NOT NULL,
        phone VARCHAR(32) NOT NULL,
        passport_number VARCHAR(32),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_booking_ref (booking_reference)
      ) ENGINE=InnoDB;
    `;

    const createAuditLogsTable = `
      CREATE TABLE IF NOT EXISTS booking_audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        booking_reference VARCHAR(32) NOT NULL,
        action VARCHAR(64) NOT NULL,
        previous_status VARCHAR(32),
        new_status VARCHAR(32),
        reason TEXT,
        metadata JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_booking (booking_reference)
      ) ENGINE=InnoDB;
    `;

    const createCancellationsTable = `
      CREATE TABLE IF NOT EXISTS cancellations (
        id VARCHAR(64) PRIMARY KEY,
        booking_reference VARCHAR(32) NOT NULL,
        supplier_penalty DECIMAL(10, 2) NOT NULL,
        tixxgo_fee DECIMAL(10, 2) NOT NULL,
        refund_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(32) NOT NULL,
        refund_reference VARCHAR(64),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cancel_booking (booking_reference)
      ) ENGINE=InnoDB;
    `;

    await this.pool.query(createBookingsTable);
    await this.pool.query(createTravellersTable);
    await this.pool.query(createAuditLogsTable);
    await this.pool.query(createCancellationsTable);
  }

  // Unified DAO methods:
  async saveBooking(bookingRecord) {
    if (this.isMySql) {
      const sql = `
        INSERT INTO bookings 
        (id, booking_reference, pnr, supplier_code, supplier_result_id, flight_details, supplier_cost, customer_price, payment_status, booking_status, ticketing_status, idempotency_key, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        pnr = VALUES(pnr),
        payment_status = VALUES(payment_status),
        booking_status = VALUES(booking_status),
        ticketing_status = VALUES(ticketing_status),
        updated_at = VALUES(updated_at)
      `;
      await this.pool.query(sql, [
        bookingRecord.id,
        bookingRecord.bookingReference,
        bookingRecord.pnr || null,
        bookingRecord.supplierCode,
        bookingRecord.supplierResultId,
        JSON.stringify(bookingRecord.flightDetails),
        JSON.stringify(bookingRecord.supplierCost),
        JSON.stringify(bookingRecord.customerPrice),
        bookingRecord.paymentStatus,
        bookingRecord.bookingStatus,
        bookingRecord.ticketingStatus,
        bookingRecord.idempotencyKey || null,
        bookingRecord.createdAt || new Date(),
        bookingRecord.updatedAt || new Date()
      ]);
      return bookingRecord;
    } else {
      this.memoryStore.bookings.set(bookingRecord.bookingReference, {
        ...bookingRecord,
        updatedAt: new Date()
      });
      return bookingRecord;
    }
  }

  async getBookingByReference(bookingReference) {
    if (this.isMySql) {
      const [rows] = await this.pool.query('SELECT * FROM bookings WHERE booking_reference = ?', [bookingReference]);
      if (rows.length === 0) return null;
      const b = rows[0];
      return {
        id: b.id,
        bookingReference: b.booking_reference,
        pnr: b.pnr,
        supplierCode: b.supplier_code,
        supplierResultId: b.supplier_result_id,
        flightDetails: typeof b.flight_details === 'string' ? JSON.parse(b.flight_details) : b.flight_details,
        supplierCost: typeof b.supplier_cost === 'string' ? JSON.parse(b.supplier_cost) : b.supplier_cost,
        customerPrice: typeof b.customer_price === 'string' ? JSON.parse(b.customer_price) : b.customer_price,
        paymentStatus: b.payment_status,
        bookingStatus: b.booking_status,
        ticketingStatus: b.ticketing_status,
        idempotencyKey: b.idempotency_key,
        createdAt: b.created_at,
        updatedAt: b.updated_at
      };
    } else {
      return this.memoryStore.bookings.get(bookingReference) || null;
    }
  }

  async getBookingByIdempotencyKey(idempotencyKey) {
    if (!idempotencyKey) return null;
    if (this.isMySql) {
      const [rows] = await this.pool.query('SELECT * FROM bookings WHERE idempotency_key = ?', [idempotencyKey]);
      if (rows.length === 0) return null;
      return this.getBookingByReference(rows[0].booking_reference);
    } else {
      for (const b of this.memoryStore.bookings.values()) {
        if (b.idempotencyKey === idempotencyKey) return b;
      }
      return null;
    }
  }

  async listAllBookings() {
    if (this.isMySql) {
      const [rows] = await this.pool.query('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 50');
      return rows.map(b => ({
        id: b.id,
        bookingReference: b.booking_reference,
        pnr: b.pnr,
        supplierCode: b.supplier_code,
        supplierResultId: b.supplier_result_id,
        flightDetails: typeof b.flight_details === 'string' ? JSON.parse(b.flight_details) : b.flight_details,
        customerPrice: typeof b.customer_price === 'string' ? JSON.parse(b.customer_price) : b.customer_price,
        paymentStatus: b.payment_status,
        bookingStatus: b.booking_status,
        ticketingStatus: b.ticketing_status,
        createdAt: b.created_at,
        updatedAt: b.updated_at
      }));
    } else {
      return Array.from(this.memoryStore.bookings.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }

  async saveTravellers(bookingReference, travellers) {
    if (this.isMySql) {
      for (const t of travellers) {
        await this.pool.query(
          `INSERT INTO travellers (id, booking_reference, title, first_name, last_name, email, phone, passport_number, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.id || require('crypto').randomUUID(), bookingReference, t.title, t.firstName, t.lastName, t.email, t.phone, t.passportNumber || null, new Date()]
        );
      }
    } else {
      this.memoryStore.travellers.set(bookingReference, travellers);
    }
  }

  async getTravellers(bookingReference) {
    if (this.isMySql) {
      const [rows] = await this.pool.query('SELECT * FROM travellers WHERE booking_reference = ?', [bookingReference]);
      return rows.map(r => ({
        id: r.id,
        title: r.title,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        phone: r.phone,
        passportNumber: r.passport_number
      }));
    } else {
      return this.memoryStore.travellers.get(bookingReference) || [];
    }
  }

  async logAudit({ bookingReference, action, previousStatus, newStatus, reason = null, metadata = null }) {
    const logItem = {
      id: require('crypto').randomUUID(),
      bookingReference,
      action,
      previousStatus,
      newStatus,
      reason,
      metadata: metadata || {},
      createdAt: new Date()
    };

    if (this.isMySql) {
      await this.pool.query(
        `INSERT INTO booking_audit_logs (id, booking_reference, action, previous_status, new_status, reason, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [logItem.id, logItem.bookingReference, logItem.action, logItem.previousStatus, logItem.newStatus, logItem.reason, JSON.stringify(logItem.metadata), logItem.createdAt]
      );
    } else {
      this.memoryStore.audit_logs.push(logItem);
    }
    return logItem;
  }

  async getAuditLogs(bookingReference) {
    if (this.isMySql) {
      const [rows] = await this.pool.query('SELECT * FROM booking_audit_logs WHERE booking_reference = ? ORDER BY created_at ASC', [bookingReference]);
      return rows.map(r => ({
        id: r.id,
        bookingReference: r.booking_reference,
        action: r.action,
        previousStatus: r.previous_status,
        newStatus: r.new_status,
        reason: r.reason,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
        createdAt: r.created_at
      }));
    } else {
      return this.memoryStore.audit_logs.filter(l => l.bookingReference === bookingReference);
    }
  }

  async saveCancellation(cancellationRecord) {
    if (this.isMySql) {
      await this.pool.query(
        `INSERT INTO cancellations (id, booking_reference, supplier_penalty, tixxgo_fee, refund_amount, status, refund_reference, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), refund_reference = VALUES(refund_reference), updated_at = VALUES(updated_at)`,
        [
          cancellationRecord.id,
          cancellationRecord.bookingReference,
          cancellationRecord.supplierPenalty,
          cancellationRecord.tixxgoFee,
          cancellationRecord.refundAmount,
          cancellationRecord.status,
          cancellationRecord.refundReference || null,
          cancellationRecord.createdAt || new Date(),
          cancellationRecord.updatedAt || new Date()
        ]
      );
    } else {
      this.memoryStore.cancellations.set(cancellationRecord.bookingReference, cancellationRecord);
    }
    return cancellationRecord;
  }

  async getCancellation(bookingReference) {
    if (this.isMySql) {
      const [rows] = await this.pool.query('SELECT * FROM cancellations WHERE booking_reference = ?', [bookingReference]);
      if (rows.length === 0) return null;
      const c = rows[0];
      return {
        id: c.id,
        bookingReference: c.booking_reference,
        supplierPenalty: parseFloat(c.supplier_penalty),
        tixxgoFee: parseFloat(c.tixxgo_fee),
        refundAmount: parseFloat(c.refund_amount),
        status: c.status,
        refundReference: c.refund_reference,
        createdAt: c.created_at,
        updatedAt: c.updated_at
      };
    } else {
      return this.memoryStore.cancellations.get(bookingReference) || null;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isMySql = false;
      this.initialized = false;
    }
  }
}

const dbManager = new DatabaseManager();
module.exports = dbManager;
