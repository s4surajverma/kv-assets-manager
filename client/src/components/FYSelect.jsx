import React, { useEffect, useState } from 'react';
import { getFinancialYears } from '../api/masters';

/**
 * Reusable Financial Year Dropdown Component
 * Dynamically fetches active and configured financial years from the database.
 * Highlights the current active financial year.
 */
export default function FYSelect({
  value,
  onChange,
  name = 'financial_year',
  id = 'financial_year',
  className = '',
  required = false,
  disabled = false,
  includeAll = false,
  autoSelectCurrent = false,
  placeholder = 'Select Financial Year',
  onFYLoaded,
  ...rest
}) {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function loadYears() {
      try {
        setLoading(true);
        const res = await getFinancialYears({ include_all: includeAll });
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : (res?.data?.data || []));
        if (mounted) {
          setYears(list);
          if (onFYLoaded) onFYLoaded(list);

          // Auto-select current FY if requested and no value is selected
          if (autoSelectCurrent && !value && list.length > 0) {
            const current = list.find((y) => y.is_current);
            const defaultCode = current ? current.code : list[0].code;
            if (onChange) {
              onChange({ target: { name, value: defaultCode } });
            }
          }
        }
      } catch (err) {
        console.error('Failed to load financial years:', err);
        if (mounted) setError('Could not load FY list');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadYears();
    return () => {
      mounted = false;
    };
  }, [includeAll]);

  const defaultClasses =
    'border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors disabled:bg-gray-100 disabled:text-gray-400';

  return (
    <div className="relative inline-block w-full">
      <select
        id={id}
        name={name}
        value={value || ''}
        onChange={onChange}
        required={required}
        disabled={disabled || loading}
        className={`${defaultClasses} ${className}`}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {loading && <option disabled>Loading Financial Years...</option>}
        {error && <option disabled>⚠️ {error}</option>}
        {!loading &&
          years.map((fy) => (
            <option key={fy.code} value={fy.code}>
              {fy.code}
              {fy.is_current ? ' (Current FY)' : ''}
              {fy.is_closed ? ' [Closed]' : ''}
              {fy.is_system_generated ? ' [Historical]' : ''}
            </option>
          ))}
      </select>
    </div>
  );
}
