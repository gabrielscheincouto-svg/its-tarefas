-- Migration: Recurring Tasks
-- Creates the recurring_rules table for auto-creating tasks on schedule

CREATE TABLE IF NOT EXISTS recurring_rules (
    id SERIAL PRIMARY KEY,
    -- Template fields (copied to new task when triggered)
    client VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    assignee_id INTEGER REFERENCES users(id),
    priority VARCHAR(20) DEFAULT 'normal',
    value NUMERIC(12,2),
    contract_link VARCHAR(500),
    additional_assignees TEXT, -- JSON array of user IDs
    -- Recurrence configuration
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('mensal', 'semanal', 'personalizado')),
    target_day INTEGER, -- Day of month (1-31) for mensal, day of week (0=dom,1=seg..6=sab) for semanal
    interval_days INTEGER, -- For personalizado: every N days
    days_before INTEGER DEFAULT 0, -- Create task N days before the target date
    -- Scheduling state
    next_run_date DATE NOT NULL,
    last_run_date DATE,
    end_date DATE, -- Optional: stop recurring after this date
    active BOOLEAN DEFAULT true,
    -- Metadata
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_rules_active ON recurring_rules(active);
CREATE INDEX IF NOT EXISTS idx_recurring_rules_next_run ON recurring_rules(next_run_date);
