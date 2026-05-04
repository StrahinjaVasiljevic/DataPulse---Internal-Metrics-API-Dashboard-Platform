/**
 * ContractValidator — validacija metrike prema MetricContract
 * 
 * Non-goals: nije JSON Schema validator (ne uvodi ajv/joi za sada)
 *            nije real-time streaming
 */

'use strict';

const ContractModel = require('../models/MetricContract');
const ViolationLog = require('../models/ViolationLog');

/**
 * @typedef {Object} ValidationResult
 * @property {'ok' | 'warn' | 'fail'} status
 * @property {string[]} errors
 * @property {string[]} warnings
 * @property {Object|null} contract
 */

/**
 * Validira dolazni metric payload prema contractu
 * @param {string} workspace_id
 * @param {Object} payload - { metric_name, value, unit, timestamp, source, ... }
 * @returns {ValidationResult}
 */
function validate(workspace_id, payload) {
  const contract = ContractModel.get(workspace_id, payload.metric_name);

  // Nema contracta → warn, prihvati
  if (!contract) {
    return {
      status: 'warn',
      errors: [],
      warnings: [`No contract defined for metric "${payload.metric_name}". Consider creating one.`],
      contract: null,
    };
  }

  const errors = [];
  const warnings = [];

  // 1. Unit validacija
  if (contract.unit && payload.unit && payload.unit !== contract.unit) {
    errors.push(
      `Unit mismatch: expected "${contract.unit}", received "${payload.unit}".`
    );
  }

  // 2. Range validacija
  const val = Number(payload.value);
  if (!isNaN(val)) {
    if (contract.allowed_min !== null && val < contract.allowed_min) {
      errors.push(
        `Value ${val} is below allowed minimum of ${contract.allowed_min}.`
      );
    }
    if (contract.allowed_max !== null && val > contract.allowed_max) {
      errors.push(
        `Value ${val} exceeds allowed maximum of ${contract.allowed_max}.`
      );
    }
  } else {
    errors.push(`Value "${payload.value}" is not a valid number.`);
  }

  // 3. Payload shape validacija
  const shape = contract.payload_shape;
  if (shape && shape.required) {
    for (const field of shape.required) {
      if (payload[field] === undefined || payload[field] === null) {
        errors.push(`Required field "${field}" is missing from payload.`);
      }
    }
  }
  if (shape && shape.types) {
    for (const [field, expectedType] of Object.entries(shape.types)) {
      if (payload[field] !== undefined) {
        const actualType = typeof payload[field];
        if (actualType !== expectedType) {
          errors.push(
            `Field "${field}" type mismatch: expected "${expectedType}", got "${actualType}".`
          );
        }
      }
    }
  }

  // 4. Versioning rules
  if (
    contract.versioning_rules === 'breaking_requires_new_version' &&
    payload.version &&
    payload.previous_version &&
    !_isCompatibleVersion(payload.version, payload.previous_version)
  ) {
    errors.push(
      `Breaking version change detected (${payload.previous_version} → ${payload.version}). ` +
      `Please register a new metric name or bump the major version explicitly.`
    );
  }

  // Određivanje statusa
  let status = 'ok';
  if (errors.length > 0) {
    status = contract.violation_policy === 'hard_fail' ? 'fail' : 'warn';
    if (contract.violation_policy === 'warn') warnings.push(...errors);
  }

  // Loguj kršenje ako postoji
  if (errors.length > 0 || warnings.length > 0) {
    ViolationLog.record({
      workspace_id,
      metric_name: payload.metric_name,
      status,
      errors,
      warnings,
      payload_snapshot: {
        value: payload.value,
        unit: payload.unit,
        source: payload.source,
      },
      timestamp: new Date().toISOString(),
    });
  }

  return { status, errors, warnings: status === 'warn' ? warnings : warnings, contract };
}

/**
 * Provera kompatibilnosti verzija (semver-lite)
 * "Breaking" = major version bump (v1 → v2)
 */
function _isCompatibleVersion(newVer, oldVer) {
  const parseM = v => parseInt((v || '1').toString().split('.')[0].replace('v', ''), 10);
  return parseM(newVer) === parseM(oldVer);
}

module.exports = { validate };
