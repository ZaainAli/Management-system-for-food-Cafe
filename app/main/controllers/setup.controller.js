const fs   = require('fs');
const path = require('path');
const { app } = require('electron');
const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

let _client = null;
function getSupabaseClient() {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      _client = createClient(url, key, { auth: { persistSession: false } });
    }
  }
  return _client;
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'branch-config.json');
}

async function getBranchId() {
  try {
    // Check in-memory env first (set at startup via .env or after saveBranchId)
    if (process.env.SUPABASE_BRANCH_ID) {
      return { success: true, data: { branchId: process.env.SUPABASE_BRANCH_ID } };
    }
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
      return { success: true, data: { branchId: null } };
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return { success: true, data: { branchId: config.branchId || null } };
  } catch (err) {
    logger.error('[setup] getBranchId failed:', err.message);
    return { success: false, error: err.message };
  }
}

async function saveBranchId({ branchId }) {
  try {
    if (!branchId || typeof branchId !== 'string' || !branchId.trim()) {
      return { success: false, error: 'Branch ID cannot be empty.' };
    }
    const trimmed = branchId.trim();

    // Validate the branch exists in Supabase before saving
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('branches')
        .select('id')
        .eq('id', trimmed)
        .single();
      if (error || !data) {
        logger.error('[setup] saveBranchId — Supabase lookup failed', {
          branchId: trimmed,
          supabaseCode: error?.code,
          supabaseMessage: error?.message,
          supabaseHint: error?.hint,
          supabaseDetails: error?.details,
        });
        const reason = error?.message || 'No matching row found';
        return {
          success: false,
          error: `Branch not found (${reason}). Make sure the Branch ID exists in the admin portal.`,
        };
      }
    } else {
      logger.warn('[setup] Supabase not configured (missing URL/key) — skipping branch validation.');
    }

    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify({ branchId: trimmed }, null, 2), 'utf-8');
    // Set in-memory so pull/sync services pick it up without a restart
    process.env.SUPABASE_BRANCH_ID = trimmed;
    logger.info(`[setup] Branch ID saved: ${trimmed}`);
    return { success: true };
  } catch (err) {
    logger.error('[setup] saveBranchId failed:', err.message);
    return { success: false, error: err.message };
  }
}

async function getBranchInfo() {
  try {
    const branchId = process.env.SUPABASE_BRANCH_ID || (() => {
      try {
        const configPath = getConfigPath();
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          return config.branchId || null;
        }
      } catch {}
      return null;
    })();

    if (!branchId) {
      return { success: false, error: 'No branch configured.' };
    }

    const client = getSupabaseClient();
    if (!client) {
      return { success: true, data: { branchId, name: null, address: null, phone: null, connected: false } };
    }

    const { data, error } = await client
      .from('branches')
      .select('id, name, address, phone, created_at')
      .eq('id', branchId)
      .single();

    if (error || !data) {
      logger.warn('[setup] getBranchInfo cloud fetch failed:', error?.message);
      return { success: true, data: { branchId, name: null, address: null, phone: null, connected: false } };
    }

    return {
      success: true,
      data: {
        branchId: data.id,
        name: data.name,
        address: data.address || null,
        phone: data.phone || null,
        createdAt: data.created_at,
        connected: true,
      },
    };
  } catch (err) {
    logger.error('[setup] getBranchInfo failed:', err.message);
    return { success: false, error: err.message };
  }
}

async function getSupabaseConfig() {
  try {
    const configured = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    return { success: true, data: { configured } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function saveSupabaseConfig({ supabaseUrl, supabaseKey }) {
  try {
    if (!supabaseUrl || !supabaseUrl.trim()) {
      return { success: false, error: 'Supabase URL is required.' };
    }
    if (!supabaseKey || !supabaseKey.trim()) {
      return { success: false, error: 'Service Role Key is required.' };
    }
    const url = supabaseUrl.trim();
    const key = supabaseKey.trim();
    const configPath = path.join(app.getPath('userData'), 'supabase-config.json');
    fs.writeFileSync(configPath, JSON.stringify({ supabaseUrl: url, supabaseKey: key }, null, 2), 'utf-8');
    process.env.SUPABASE_URL = url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = key;
    // Reset cached client so it picks up new credentials
    _client = null;
    logger.info('[setup] Supabase config saved');
    return { success: true };
  } catch (err) {
    logger.error('[setup] saveSupabaseConfig failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { getBranchId, saveBranchId, getBranchInfo, getSupabaseConfig, saveSupabaseConfig };
