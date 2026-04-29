"""
Migration script to add user_id column to leads table
Run this once before starting the backend
"""

import os
from dotenv import load_dotenv
import pymysql

load_dotenv()

DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_NAME = os.getenv('DB_NAME', 'nexcrm')

try:
    conn = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )
    cursor = conn.cursor()
    
    # Check if user_id column exists
    cursor.execute("""
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME='leads' AND COLUMN_NAME='user_id'
    """)
    
    if cursor.fetchone():
        print("✓ user_id column already exists in leads table")
    else:
        print("Adding user_id column to leads table...")
        
        # Create users table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(120) NOT NULL,
                email VARCHAR(200) NOT NULL UNIQUE,
                password_hash VARCHAR(256) NOT NULL,
                role VARCHAR(50) DEFAULT 'Sales Rep',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB
        """)
        print("✓ Users table created/verified")
        
        # Add user_id column
        cursor.execute("""
            ALTER TABLE leads ADD COLUMN user_id INT,
            ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
            ADD INDEX idx_user_id (user_id)
        """)
        print("✓ user_id column added to leads table")
    
    # Add new columns (win_probability, tags, next_action)
    for col, definition in [
        ('win_probability', 'INT DEFAULT 0'),
        ('tags', 'VARCHAR(255) DEFAULT ""'),
        ('next_action', 'VARCHAR(255) DEFAULT ""')
    ]:
        cursor.execute(f"SHOW COLUMNS FROM `leads` LIKE '{col}'")
        if cursor.fetchone():
            print(f"✓ {col} column already exists")
        else:
            print(f"Adding {col} column...")
            cursor.execute(f"ALTER TABLE `leads` ADD COLUMN `{col}` {definition}")
            print(f"✓ {col} column added")

    conn.commit()
    cursor.close()
    conn.close()
    print("\n✅ Schema migration complete! You can now start the backend.")
    
except Exception as e:
    print(f"❌ Error: {e}")
    print("\nMake sure:")
    print("1. MySQL is running")
    print("2. Database 'nexcrm' exists")
    print("3. .env file has correct DB credentials")
